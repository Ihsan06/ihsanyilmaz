// POST /api/fuer — Widerspruch von der persoenlichen Seite /fuer/<token>.
//
// { token, aktion:'nein' } → Betrieb auf die Sperrliste (grund 'Landingpage'),
// Status 'aus'. Oeffentlich, deshalb: Tokenformat vor der Datenbank pruefen,
// nichts ueber den Betrieb verraten, nie 5xx (davor schiebt Cloudflare eine
// eigene Fehlerseite, die der Browser nicht lesen kann).
import { TOKEN_RE } from '../_lib/brief.js';

const KOPF = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: KOPF });

export async function onRequestPost({ request, env }) {
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, fehler: 'ungueltig' }, 400); }
  const token = String(d?.token || '');
  if (!TOKEN_RE.test(token) || d?.aktion !== 'nein') return json({ ok: false, fehler: 'ungueltig' }, 400);
  if (!env.DB) return json({ ok: false, fehler: 'nichtGespeichert' });

  try {
    const brief = await env.DB.prepare(
      `SELECT br.betrieb_id, b.name FROM akquise_briefe br LEFT JOIN akquise_betriebe b ON b.id = br.betrieb_id WHERE br.token = ?`,
    ).bind(token).first();
    if (!brief) return json({ ok: false, fehler: 'unbekannt' }, 404);
    // Betrieb inzwischen endgueltig geloescht: nichts mehr zu sperren. Ohne
    // diese Pruefung entstuende bei jedem Klick eine neue Zeile ohne Bezug.
    if (!brief.betrieb_id) return json({ ok: true });

    const bereits = await env.DB.prepare('SELECT id FROM akquise_sperrliste WHERE betrieb_id = ? LIMIT 1').bind(brief.betrieb_id).first();
    if (!bereits) {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO akquise_sperrliste (betrieb_id, name, grund) VALUES (?, ?, ?)').bind(brief.betrieb_id, brief.name || null, 'Landingpage'),
        env.DB.prepare("UPDATE akquise_betriebe SET status = 'aus', geaendert = datetime('now') WHERE id = ?").bind(brief.betrieb_id),
      ]);
    }
    return json({ ok: true });
  } catch {
    return json({ ok: false, fehler: 'nichtGespeichert' });
  }
}
