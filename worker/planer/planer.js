// aiy-planer – der Cron-Worker hinter "Content planen".
//
// Laeuft alle fuenf Minuten (siehe wrangler.jsonc), nimmt sich die faelligen
// Eintraege der studio_warteschlange und reicht sie bei Instagram ein.
// Die Bilder wurden beim Einplanen schon zugeschnitten und liegen in R2;
// Instagram laedt sie ueber die oeffentliche Adresse https://ihsan-yilmaz.de
// herunter. Nach dem Posten werden die Zwischenkopien weggeraeumt.
//
// Der Instagram-Teil ist bewusst dieselbe Logik wie in
// functions/api/studio/veroeffentlichen.js – ein Worker kann Pages-Functions
// nicht importieren, deshalb liegt hier eine Kopie des Kerns. Wer dort etwas
// aendert, aendert es auch hier.

const BASIS = 'https://graph.instagram.com';
const DOMAIN = 'https://ihsan-yilmaz.de';
// Gleiche Abstufung wie in functions/api/studio/veroeffentlichen.js – die
// beiden Dateien teilen sich diesen Ablauf, weil ein Worker keine
// Pages-Function importieren kann.
const ABSTAENDE = [250, 400, 650, 900, 1300, 1800, 2400, 3000, 3500];
const JE_LAUF = 3;        // mehr als drei je Lauf waere kein Zeitplan, sondern ein Schwall

export default {
  async scheduled(ereignis, env, ctx) {
    ctx.waitUntil(faelligesPosten(env));
  }
};

async function faelligesPosten(env) {
  const db = env.DB;
  const jetzt = new Date().toISOString();

  const { results } = await db.prepare(
    `SELECT id, zeitpunkt, format, text, bilder FROM studio_warteschlange
      WHERE status = 'geplant' AND zeitpunkt <= ?
      ORDER BY zeitpunkt LIMIT ?`
  ).bind(jetzt, JE_LAUF).all();

  for (const zeile of results || []) {
    // Erst beanspruchen (geplant -> laeuft): laeuft ein zweiter Lauf oder der
    // "Jetzt veröffentlichen"-Knopf zeitgleich, nimmt nur einer den Eintrag.
    const claim = await db.prepare(
      `UPDATE studio_warteschlange SET status = 'laeuft' WHERE id = ? AND status = 'geplant'`
    ).bind(zeile.id).run();
    if (!claim.meta.changes) continue;

    const pfade = JSON.parse(zeile.bilder || '[]');
    try {
      const { id, weg } = await beitragPosten(db, env, {
        bilder: pfade.map(p => DOMAIN + p),
        text: zeile.text || '',
        story: zeile.format === 'story'
      });
      await db.prepare(
        `UPDATE studio_warteschlange
            SET status = 'gepostet', beitrag_id = ?, weg = ?, fehler = NULL,
                gepostet_am = datetime('now')
          WHERE id = ?`
      ).bind(id, weg, zeile.id).run();
      await aufraeumen(db, env, pfade);
      console.log(`Eintrag ${zeile.id} gepostet: ${id}`);
    } catch (err) {
      console.error(`Eintrag ${zeile.id} gescheitert:`, err);
      // Die Bilder bleiben liegen – auf der Planen-Seite gibt es
      // "Noch einmal versuchen".
      await db.prepare(
        `UPDATE studio_warteschlange SET status = 'fehler', fehler = ? WHERE id = ?`
      ).bind(String(err && err.message || err), zeile.id).run();
    }
  }
}

// ─── Instagram (Kern wie in veroeffentlichen.js) ───

async function beitragPosten(db, env, { bilder, text, story }) {
  const token = await tokenHolen(db, env);
  if (!token) throw new Error('Kein Zugriffstoken hinterlegt.');

  const id = await kontoId(token);
  const container = story
    ? await anlegen(id, token, { image_url: bilder[0], media_type: 'STORIES' })
    : (bilder.length === 1
      ? await anlegen(id, token, { image_url: bilder[0], caption: text })
      : await galerie(id, token, bilder, text));

  await fertig(container, token);
  const beitrag = await fragen(
    `${BASIS}/${id}/media_publish?creation_id=${enc(container)}&access_token=${enc(token)}`,
    'POST'
  );
  if (!beitrag || !beitrag.id) throw new Error('Instagram hat keine Beitrags-ID zurückgegeben.');

  let weg = '';
  try {
    const m = await fragen(`${BASIS}/${beitrag.id}?fields=permalink&access_token=${enc(token)}`);
    weg = m.permalink || '';
  } catch { /* der Beitrag steht trotzdem */ }

  return { id: beitrag.id, weg };
}

async function anlegen(id, token, felder) {
  const teile = Object.entries(felder).map(([k, v]) => `${k}=${enc(v)}`).join('&');
  const d = await fragen(`${BASIS}/${id}/media?${teile}&access_token=${enc(token)}`, 'POST');
  if (!d || !d.id) throw new Error('Instagram hat keinen Container angelegt.');
  return d.id;
}

async function galerie(id, token, bilder, text) {
  // Nebeneinander statt nacheinander; Promise.all haelt die Reihenfolge, und
  // die bestimmt, wie die Galerie durchgeblaettert wird.
  const kinder = await Promise.all(
    bilder.map(u => anlegen(id, token, { image_url: u, is_carousel_item: 'true' }))
  );
  return anlegen(id, token, {
    media_type: 'CAROUSEL',
    children: kinder.join(','),
    caption: text
  });
}

async function fertig(container, token) {
  for (let i = 0; i <= ABSTAENDE.length; i++) {
    const d = await fragen(
      `${BASIS}/${container}?fields=status_code,status&access_token=${enc(token)}`
    );
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') {
      throw new Error(d.status || `Instagram konnte das Bild nicht verarbeiten (${d.status_code}).`);
    }
    if (i < ABSTAENDE.length) await new Promise(r => setTimeout(r, ABSTAENDE[i]));
  }
  throw new Error('Instagram hat das Bild nicht rechtzeitig verarbeitet.');
}

async function kontoId(token) {
  const d = await fragen(`${BASIS}/me?fields=user_id&access_token=${enc(token)}`);
  const id = d.user_id || d.id;
  if (!id) throw new Error('Das Konto ließ sich nicht bestimmen.');
  return id;
}

async function fragen(url, methode = 'GET') {
  const a = await fetch(url, { method: methode, headers: { Accept: 'application/json' } });
  const d = await a.json().catch(() => null);
  if (!a.ok || (d && d.error)) {
    const e = d && d.error;
    const teile = [e && e.error_user_msg, e && e.message].filter(Boolean);
    throw new Error(teile.join(' · ') || `Instagram antwortete mit ${a.status}.`);
  }
  return d || {};
}

// Frischester Token gewinnt: die Profil-Seite verlaengert ihn still und legt
// ihn unter einstellungen/ig_token ab. Das Secret ist nur die Erst-Einrichtung.
async function tokenHolen(db, env) {
  try {
    const z = await db.prepare('SELECT wert FROM studio_zugaenge WHERE name = ?')
      .bind('instagram').first();
    if (z && z.wert) return z.wert;
  } catch { /* Tabelle kann fehlen */ }
  try {
    const e = await db.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?')
      .bind('ig_token').first();
    if (e && e.wert) return e.wert;
  } catch { /* Tabelle kann fehlen */ }
  return env.INSTAGRAM_TOKEN || null;
}

// Zwischenkopien wegwerfen: R2-Objekt und Speicherstand-Zeile.
async function aufraeumen(db, env, pfade) {
  for (const pfad of pfade) {
    const schluessel = String(pfad).replace(/^\/bilder\//, '');
    if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(schluessel)) continue;
    try {
      if (env.BILDER) await env.BILDER.delete(schluessel);
      await db.prepare('DELETE FROM studio_bilder WHERE schluessel = ?').bind(schluessel).run();
    } catch (err) {
      console.error('Aufraeumen:', err);
    }
  }
}

const enc = encodeURIComponent;
