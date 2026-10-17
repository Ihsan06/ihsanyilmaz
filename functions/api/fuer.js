// POST /api/fuer — Widerspruch von der persoenlichen Seite /fuer/<token>.
//
// { token, aktion:'nein' } → Betrieb auf die Sperrliste (grund 'Landingpage'),
// Status 'aus'.
// { token, aktion:'demo' } → merkt den ersten Klick auf „Demo jetzt ansehen“
// (akquise_briefe.demo_geoeffnet); die Seite schickt das per sendBeacon, der
// Link selbst fuehrt direkt zur Demo. Beim ersten Mal kommt eine Mail an mich.
// { token, aktion:'kontakt' } → ein Klick: Kontakt per Telefon/E-Mail erlaubt
// (akquise_briefe.kontakt_erlaubt), Betrieb auf 'kontakt', Mail an mich.
// Oeffentlich, deshalb: Tokenformat vor der Datenbank pruefen,
// nichts ueber den Betrieb verraten, nie 5xx (davor schiebt Cloudflare eine
// eigene Fehlerseite, die der Browser nicht lesen kann).
import { TOKEN_RE } from '../_lib/brief.js';
import { eigenerAufruf } from '../_lib/auth.js';
import { mirMitteilen, betriebMelden, adminLink, esc } from '../_lib/mitteilung.js';

const KOPF = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: KOPF });

export async function onRequestPost({ request, env, waitUntil }) {
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, fehler: 'ungueltig' }, 400); }
  const token = String(d?.token || '');
  if (!TOKEN_RE.test(token) || !['nein', 'demo', 'kontakt'].includes(d?.aktion)) return json({ ok: false, fehler: 'ungueltig' }, 400);
  if (!env.DB) return json({ ok: false, fehler: 'nichtGespeichert' });

  if (d.aktion === 'demo') {
    // Eigene Klicks (Admin-Vorschau, eigene Geraete) und die ersten zwei Tage
    // nach dem Versand zaehlen nicht – wie die Aufrufe in /fuer/<token>.
    if (await eigenerAufruf(request, env)) return json({ ok: true });
    const erst = await env.DB.prepare(`UPDATE akquise_briefe SET demo_geoeffnet = datetime('now')
      WHERE token = ? AND demo_geoeffnet IS NULL AND art != 'test' AND gesendet_am IS NOT NULL AND gesendet_am <= datetime('now', '-2 days')
      RETURNING betrieb_id`).bind(token).first().catch(() => null);
    if (erst) nebenbei(waitUntil, betriebMelden(env, request, erst.betrieb_id, 'Demo geöffnet'));
    return json({ ok: true });
  }

  if (d.aktion === 'kontakt') return kontaktErlauben(token, request, env, waitUntil);

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

// Laeuft nach der Antwort weiter (Mail, Telegram) – die Seite wartet nicht darauf.
function nebenbei(waitUntil, lauf) {
  const sicher = Promise.resolve(lauf).catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(sicher);
  return sicher;
}


// Ein Klick „Ja, bitte melden Sie sich“: der Betrieb erlaubt, dass ich mich zu
// diesem Angebot per Telefon oder E-Mail melde. Kein Eingabefeld – die
// Kontaktdaten stehen am Betrieb (OSM/Google/Website). Gespeichert wird nur
// der Zeitpunkt am Brief; eigene Geraete zaehlen nicht (sonst gaebe ein
// Test eine Erlaubnis, die es nicht gibt).
async function kontaktErlauben(token, request, env, waitUntil) {
  if (await eigenerAufruf(request, env)) return json({ ok: true });
  try {
    const brief = await env.DB.prepare(
      `SELECT br.id, br.betrieb_id, br.art, br.kontakt_erlaubt, b.name, b.ort, b.status, b.telefon, b.email, b.website
       FROM akquise_briefe br LEFT JOIN akquise_betriebe b ON b.id = br.betrieb_id WHERE br.token = ?`,
    ).bind(token).first();
    if (!brief) return json({ ok: false, fehler: 'unbekannt' }, 404);
    if (brief.kontakt_erlaubt) return json({ ok: true }); // schon erlaubt, keine zweite Mail

    const schreiben = [env.DB.prepare("UPDATE akquise_briefe SET kontakt_erlaubt = datetime('now') WHERE id = ? AND kontakt_erlaubt IS NULL").bind(brief.id)];
    if (brief.betrieb_id && brief.art !== 'test' && ['neu', 'beobachten', 'brief'].includes(brief.status)) {
      schreiben.push(env.DB.prepare("UPDATE akquise_betriebe SET status = 'kontakt', geaendert = datetime('now') WHERE id = ?").bind(brief.betrieb_id));
    }
    await env.DB.batch(schreiben);

    const firma = brief.name || 'Unbekannter Betrieb';
    const tel = String(brief.telefon || '').replace(/[^\d+]/g, '');
    nebenbei(waitUntil, mirMitteilen(env, {
      betreff: `Kontakt erlaubt: ${firma}`,
      zeilen: [
        `<b>${esc(firma)}</b>${brief.ort ? ` · ${esc(brief.ort)}` : ''} hat auf der persönlichen Seite erlaubt, dass du dich per Telefon oder E-Mail meldest.`,
        brief.telefon ? `Telefon: <a href="tel:${esc(tel)}">${esc(brief.telefon)}</a>` : 'Telefon: nicht hinterlegt – bitte im Internet nachsehen',
        brief.email ? `E-Mail: <a href="mailto:${esc(brief.email)}">${esc(brief.email)}</a>` : '',
        brief.website ? `Website: <a href="${esc(brief.website)}">${esc(brief.website)}</a>` : '',
      ],
      link: adminLink(request),
      telegram: '📞 Akquise: ein Betrieb hat Kontakt erlaubt – Details in deinem Postfach.',
    }));
    return json({ ok: true });
  } catch {
    return json({ ok: false, fehler: 'nichtGespeichert' });
  }
}
