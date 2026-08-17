// GET /api/instagram-feed — die letzten Beitraege von @aiy.web, oeffentlich.
//
// Warum ueber den eigenen Server statt direkt im Browser: der Zugriffstoken
// darf die Seite nie erreichen. Hier bleibt er auf dem Server, hinaus geht
// nur, was ohnehin jeder auf dem Profil sieht — Bild, Text, Datum, Verweis.
//
// Zwischengespeichert wird eine Stunde. Instagram zaehlt Abrufe gegen ein
// Stundenlimit, und ein Beitrag, der sechzig Minuten spaeter auf der Seite
// erscheint, faellt niemandem auf.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  // Der Browser darf eine Stunde behalten, Cloudflares Netz sechs.
  'Cache-Control': 'public, max-age=3600, s-maxage=21600',
};

const BASIS = 'https://graph.instagram.com';
const ANZAHL = 9;

export async function onRequestGet({ env, waitUntil, request }) {
  // Cloudflares eigener Zwischenspeicher: erspart den Aufruf bei Meta ganz.
  const schluessel = new Request(new URL(request.url).origin + '/api/instagram-feed');
  const lager = caches.default;
  const liegt = await lager.match(schluessel);
  if (liegt) return liegt;

  const token = await tokenHolen(env);
  if (!token) return antwort({ ok: false, beitraege: [] });

  try {
    const felder = 'id,caption,media_type,permalink,media_url,thumbnail_url,timestamp';
    const a = await fetch(
      `${BASIS}/me/media?fields=${felder}&limit=${ANZAHL}&access_token=${encodeURIComponent(token)}`,
      { headers: { Accept: 'application/json' } },
    );
    const d = await a.json().catch(() => null);
    if (!a.ok || !d || d.error) throw new Error((d && d.error && d.error.message) || 'HTTP ' + a.status);

    const beitraege = (d.data || [])
      // Videos tragen als Kachelbild nur ihr Standbild; fehlt auch das,
      // waere die Kachel leer – dann lieber weglassen.
      .map(m => ({
        id: m.id,
        bild: m.media_type === 'VIDEO' ? (m.thumbnail_url || '') : (m.media_url || ''),
        text: (m.caption || '').split('\n')[0].slice(0, 120),
        weg: m.permalink || '',
        zeitpunkt: m.timestamp || '',
      }))
      .filter(b => b.bild && b.weg);

    const antw = antwort({ ok: true, beitraege });
    waitUntil(lager.put(schluessel, antw.clone()));
    return antw;
  } catch (err) {
    console.error('Instagram-Feed:', err);
    // Keine Fehlerseite fuer Besucher: der Abschnitt blendet sich dann
    // einfach aus, statt eine kaputte Reihe zu zeigen.
    return antwort({ ok: false, beitraege: [] });
  }
}

// Frischester Token gewinnt: die Profilseite verlaengert ihn still und legt
// ihn in der Datenbank ab. Das Secret ist nur die Erst-Einrichtung.
async function tokenHolen(env) {
  try {
    const r = await env.DB.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?')
      .bind('ig_token').first();
    if (r && r.wert) return r.wert;
  } catch { /* Tabelle kann fehlen */ }
  return env.INSTAGRAM_TOKEN || null;
}

const antwort = (d) => new Response(JSON.stringify(d), { headers: KOPF });
