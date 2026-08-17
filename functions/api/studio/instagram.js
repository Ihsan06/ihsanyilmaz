// GET /api/admin/instagram – Zahlen und Beitraege des Instagram-Kontos.
//
// Holt Profil und Beitraege ueber die Instagram-API (Zugang mit
// Instagram-Login, Konto @autohausdiezmann). Von jedem Abruf bleibt hoechstens
// ein Stand pro Tag in der Tabelle "instagram" stehen – daraus entsteht der
// Verlauf. Die frueher von Hand eingetragenen Staende bleiben Teil davon.
//
// Was dieser Zugang NICHT liefert: Reichweite, Profilaufrufe, Hashtags. Die
// haengen an der Einrichtung mit Facebook-Login und einer verknuepften
// Facebook-Seite. Follower, Beitraege, Likes und Kommentare gibt es hier.
//
// Zum Token: Es laeuft nach 60 Tagen ab. Verlaengert wird es hier automatisch,
// sobald es aelter als ERNEUERN_AB_TAGEN ist – dabei entsteht ein neues, und
// weil ein Worker seine eigenen Secrets nicht ueberschreiben kann, liegt das
// jeweils gueltige in der Tabelle "zugaenge". Das Secret INSTAGRAM_TOKEN ist
// nur der Startwert.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const KONTO = 'aiy.web';
const BASIS = 'https://graph.instagram.com';
const ERNEUERN_AB_TAGEN = 30;   // Haelfte der Laufzeit – Luft nach beiden Seiten
const BEITRAEGE = 36;   // drei Seiten zu zwoelf

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let fehler = null;
  let medien = [];
  let profil = null;

  const token = await tokenHolen(db, env);

  if (token) {
    try {
      profil = await profilHolen(token);
      medien = await medienHolen(token);
      await standMerken(db, profil);
      await vielleichtErneuern(db, token);
    } catch (err) {
      // Der letzte gespeicherte Stand ist mehr wert als eine leere Seite –
      // also weitermachen und den Grund mitgeben.
      console.error('Instagram:', err);
      fehler = String(err && err.message || err);
    }
  } else {
    fehler = 'Kein Zugriffstoken hinterlegt (INSTAGRAM_TOKEN).';
  }

  // profil traegt den Stand von jetzt (Benutzername, Follower, Folgt,
  // Beitraege). Ohne es sah die Profilseite nur die Konstante und den
  // gespeicherten Verlauf – die aktuellen Zahlen fehlten.
  return antwort({ ok: true, konto: KONTO, profil, fehler, medien, ...(await verlauf(db)) });
}

// ─── Instagram ───

async function profilHolen(token) {
  const felder = 'user_id,username,followers_count,follows_count,media_count';
  const d = await fragen(`${BASIS}/me?fields=${felder}&access_token=${encodeURIComponent(token)}`);
  return {
    benutzer: d.username || KONTO,
    follower: zahl(d.followers_count),
    folgt: zahl(d.follows_count),
    beitraege: zahl(d.media_count)
  };
}

async function medienHolen(token) {
  // children liefert die Einzelbilder einer Galerie – ohne sie zeigt die
  // Vorschau nur das Titelbild, und gerade bei Fahrzeugen steckt der Rest
  // des Beitrags in den Bildern zwei bis zehn.
  // media_product_type unterscheidet Reel von Video-im-Feed; media_type sagt
  // bei beiden nur VIDEO.
  const felder = 'id,caption,media_type,media_product_type,permalink,media_url,' +
    'thumbnail_url,timestamp,like_count,comments_count,' +
    'children{id,media_type,media_url,thumbnail_url}';
  const d = await fragen(
    `${BASIS}/me/media?fields=${felder}&limit=${BEITRAEGE}&access_token=${encodeURIComponent(token)}`
  );
  return (d.data || []).map(m => ({
    id: m.id,
    text: m.caption || '',
    art: m.media_type || '',
    sorte: m.media_product_type || '',
    weg: m.permalink || '',
    // Bei Videos ist media_url die Videodatei. Als Kachelbild taugt nur das
    // Standbild – in der Einzelansicht laesst sich das Video aber abspielen,
    // deshalb kommt es getrennt mit.
    bild: standbild(m),
    video: m.media_type === 'VIDEO' ? (m.media_url || '') : '',
    bilder: ((m.children && m.children.data) || []).map(standbild).filter(Boolean),
    zeitpunkt: m.timestamp || '',
    likes: zahl(m.like_count),
    kommentare: zahl(m.comments_count)
  }));
}

const standbild = m => (m.media_type === 'VIDEO' ? (m.thumbnail_url || '') : (m.media_url || ''));

async function fragen(url) {
  const a = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const d = await a.json().catch(() => null);
  if (!a.ok || (d && d.error)) {
    const m = d && d.error && d.error.message;
    // Der haeufigste Fall in einem halben Jahr: das Token ist abgelaufen.
    // Dann soll auf der Seite nicht "OAuthException" stehen.
    if (m && /expired|session|invalid/i.test(m)) {
      throw new Error('Das Zugriffstoken ist abgelaufen oder ungültig – bitte neu erzeugen und hinterlegen.');
    }
    throw new Error(m || `Instagram antwortete mit ${a.status}.`);
  }
  return d || {};
}

// ─── Token ───

async function tokenHolen(db, env) {
  const z = await db.prepare('SELECT wert FROM studio_zugaenge WHERE name = ?').bind('instagram').first();
  return (z && z.wert) || env.INSTAGRAM_TOKEN || null;
}

async function vielleichtErneuern(db, token) {
  const z = await db.prepare('SELECT erneuert FROM studio_zugaenge WHERE name = ?').bind('instagram').first();
  const alter = z && z.erneuert ? (Date.now() - new Date(z.erneuert)) / 86400000 : Infinity;
  if (alter < ERNEUERN_AB_TAGEN) return;

  try {
    const d = await fragen(
      `${BASIS}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
    );
    if (!d.access_token) return;
    await db.prepare(
      `INSERT INTO studio_zugaenge (name, wert, erneuert) VALUES ('instagram', ?, ?)
       ON CONFLICT(name) DO UPDATE SET wert = excluded.wert, erneuert = excluded.erneuert`
    ).bind(d.access_token, new Date().toISOString()).run();
  } catch (err) {
    // Scheitert die Verlaengerung, laeuft der Abruf mit dem alten Token
    // weiter – solange es gilt. Nur melden, nicht abbrechen.
    console.error('Instagram-Token verlaengern:', err);
  }
}

// ─── Verlauf ───

// Hoechstens ein Stand je Tag: die Seite wird mehrmals taeglich geoeffnet,
// und fuenf Punkte auf demselben Tag sind kein Verlauf, sondern Rauschen.
async function standMerken(db, profil) {
  if (!profil || profil.follower == null) return;
  const heute = new Date().toISOString().slice(0, 10);
  const schon = await db.prepare(
    'SELECT id FROM studio_instagram WHERE substr(zeitpunkt, 1, 10) = ? AND quelle = ?'
  ).bind(heute, 'api').first();
  if (schon) {
    await db.prepare('UPDATE studio_instagram SET follower = ?, beitraege = ?, zeitpunkt = ? WHERE id = ?')
      .bind(profil.follower, profil.beitraege, new Date().toISOString(), schon.id).run();
    return;
  }
  await db.prepare(
    'INSERT INTO studio_instagram (zeitpunkt, follower, beitraege, quelle) VALUES (?, ?, ?, ?)'
  ).bind(new Date().toISOString(), profil.follower, profil.beitraege, 'api').run();
}

async function verlauf(db) {
  const { results } = await db.prepare(
    'SELECT zeitpunkt, follower, beitraege, quelle FROM studio_instagram ORDER BY zeitpunkt DESC LIMIT 60'
  ).all();

  const reihe = (results || []).slice().reverse();
  const jetzt = reihe[reihe.length - 1] || null;

  // Vergleich mit dem letzten Eintrag, der mindestens 20 Tage zurueckliegt –
  // sonst vergleicht man mit sich selbst.
  const grenze = new Date(Date.now() - 20 * 86400000).toISOString();
  const davor = reihe.filter(z => z.zeitpunkt <= grenze).pop()
    || (reihe.length > 1 ? reihe[0] : null);

  return { jetzt, davor: davor && davor !== jetzt ? davor : null, verlauf: reihe };
}

const zahl = w => (Number.isFinite(Number(w)) ? Number(w) : null);

function antwort(daten, status = 200) {
  return new Response(JSON.stringify(daten), { status, headers: KOPF });
}
