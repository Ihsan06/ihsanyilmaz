// /api/admin/instagram — Verbindung zur Instagram-API (Business-Konto @aiy.web)
//
// Benötigt das Secret INSTAGRAM_TOKEN (aus Meta: App → Instagram → API setup
// with Instagram business login → Access Token, 60 Tage gültig).
//
// Der Token wird automatisch verlängert: Meta erlaubt ab 24 h Alter einen
// Refresh um weitere 60 Tage. Weil Secrets aus Functions heraus nicht
// beschreibbar sind, landet der jeweils frischeste Token in der Tabelle
// "einstellungen" — sie geht dem Secret vor.
//
// GET  → Verbindungsstatus + Kontozahlen (username, Beiträge, Follower)
// POST → Bild aus der Galerie veröffentlichen: { schluessel, caption, postId? }
import { json, nurAngemeldet, hmac } from '../../_lib/auth.js';

const G = 'https://graph.instagram.com';

async function einstellung(env, schluessel) {
  try {
    const r = await env.DB.prepare('SELECT wert, geaendert FROM einstellungen WHERE schluessel = ?')
      .bind(schluessel).first();
    return r || null;
  } catch { return null; }
}

async function einstellungSetzen(env, schluessel, wert) {
  await env.DB.prepare(
    `INSERT INTO einstellungen (schluessel, wert, geaendert) VALUES (?, ?, datetime('now'))
     ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = datetime('now')`,
  ).bind(schluessel, wert).run();
}

// Frischester Token gewinnt: DB (verlängert) vor Secret (Erst-Einrichtung).
async function tokenHolen(env) {
  const db = await einstellung(env, 'ig_token');
  if (db?.wert) return db.wert;
  return env.INSTAGRAM_TOKEN || null;
}

// Alle ~7 Tage still um 60 Tage verlängern — schlägt das fehl, läuft der
// alte Token einfach weiter (er hält ja noch Wochen).
async function tokenPflegen(env, token) {
  const stand = await einstellung(env, 'ig_token');
  if (stand?.geaendert) {
    const alterTage = (Date.now() - new Date(stand.geaendert.replace(' ', 'T') + 'Z').getTime()) / 86400000;
    if (alterTage < 7) return token;
  }
  try {
    const r = await fetch(`${G}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
    const d = await r.json();
    if (r.ok && d.access_token) {
      await einstellungSetzen(env, 'ig_token', d.access_token);
      return d.access_token;
    }
  } catch { /* Verlängerung ist Pflege, kein Muss */ }
  return token;
}

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  let token = await tokenHolen(env);
  if (!token) return json({ ok: true, verbunden: false });

  token = await tokenPflegen(env, token);

  const r = await fetch(`${G}/me?fields=user_id,username,account_type,media_count,followers_count&access_token=${encodeURIComponent(token)}`);
  const d = await r.json();
  if (!r.ok) {
    return json({
      ok: true, verbunden: false,
      fehler: d?.error?.message || 'Token ungültig oder abgelaufen.',
    });
  }
  return json({
    ok: true, verbunden: true,
    konto: {
      username: d.username,
      beitraege: d.media_count ?? null,
      follower: d.followers_count ?? null,
    },
  });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  const { schluessel, caption, postId } = await request.json();

  if (!schluessel?.startsWith('galerie/')) {
    return json({ ok: false, error: 'Bitte ein Bild aus der Galerie wählen.' }, 400);
  }
  // Instagram akzeptiert über die API ausschließlich JPEG.
  const eintrag = await env.DB.prepare('SELECT typ FROM bilder WHERE schluessel = ?')
    .bind(schluessel).first();
  if (!eintrag) return json({ ok: false, error: 'Bild nicht gefunden.' }, 404);
  if (eintrag.typ !== 'image/jpeg') {
    return json({ ok: false, error: 'Instagram nimmt über die API nur JPG-Bilder an. Bitte das Bild neu hochladen — die Galerie wandelt es dann automatisch um.' }, 415);
  }

  let token = await tokenHolen(env);
  if (!token) return json({ ok: false, error: 'Instagram ist noch nicht verbunden (INSTAGRAM_TOKEN fehlt).' }, 503);
  token = await tokenPflegen(env, token);

  const me = await fetch(`${G}/me?fields=user_id&access_token=${encodeURIComponent(token)}`).then(r => r.json());
  const userId = me?.user_id;
  if (!userId) return json({ ok: false, error: `Konto nicht abrufbar: ${me?.error?.message || 'unbekannt'}` }, 502);

  // Instagram lädt das Bild selbst herunter — dafür eine kurzlebige,
  // signierte öffentliche Adresse (1 Stunde), sonst bleibt der Speicher zu.
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sig = await hmac(env.SESSION_SECRET, `${schluessel}|${exp}`);
  const basis = new URL(request.url).origin;
  const bildUrl = `${basis}/api/public-bild?s=${encodeURIComponent(schluessel)}&e=${exp}&sig=${sig}`;

  // Schritt 1: Container anlegen
  const container = await fetch(`${G}/${userId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image_url: bildUrl, caption: caption || '', access_token: token }),
  }).then(r => r.json());
  if (!container?.id) {
    return json({ ok: false, error: `Instagram hat das Bild nicht angenommen: ${container?.error?.message || 'unbekannt'}` }, 502);
  }

  // Schritt 2: veröffentlichen
  const veroeffentlicht = await fetch(`${G}/${userId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: container.id, access_token: token }),
  }).then(r => r.json());
  if (!veroeffentlicht?.id) {
    return json({ ok: false, error: `Veröffentlichen fehlgeschlagen: ${veroeffentlicht?.error?.message || 'unbekannt'}` }, 502);
  }

  // Den Planer-Eintrag direkt abhaken
  if (postId) {
    await env.DB.prepare(`UPDATE posts SET status = 'veroeffentlicht' WHERE id = ?`)
      .bind(postId).run().catch(() => {});
  }

  return json({ ok: true, igMediaId: veroeffentlicht.id });
});
