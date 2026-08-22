// /api/studio/saetze – die gemerkten Sprueche.
//
//   GET               alle, nach Thema gruppierbar
//   GET ?thema=…      nur zu einem Thema
//   DELETE ?id=…      einen wegwerfen
//
// Gefuellt wird die Tabelle von zusammenstellen.js: jeder Text, den das
// Modell schreibt, landet dort. Der Baukasten mischt sie unter die fest
// eingebauten Varianten, damit ein guter Vorschlag nicht einmalig bleibt.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};
const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });

export async function onRequestGet({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const thema = new URL(request.url).searchParams.get('thema');
  const satz = thema
    ? db.prepare(`SELECT id, thema, text, hashtags, herkunft, benutzt, angelegt
                    FROM studio_saetze WHERE thema = ? ORDER BY angelegt DESC LIMIT 200`).bind(thema)
    : db.prepare(`SELECT id, thema, text, hashtags, herkunft, benutzt, angelegt
                    FROM studio_saetze ORDER BY angelegt DESC LIMIT 500`);

  const { results } = await satz.all();
  const saetze = results || [];

  // Nach Thema gebuendelt: so kann der Baukasten sie ohne weiteres Sortieren
  // an die fest eingebauten Varianten haengen.
  const nachThema = {};
  saetze.forEach(s => { (nachThema[s.thema] = nachThema[s.thema] || []).push(s); });

  return antwort({ ok: true, gesamt: saetze.length, saetze, nachThema });
}

export async function onRequestDelete({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const id = Number(new URL(request.url).searchParams.get('id') || 0);
  if (!id) return antwort({ ok: false, fehler: 'Kein Satz angegeben.' }, 400);

  await db.prepare('DELETE FROM studio_saetze WHERE id = ?').bind(id).run();
  return onRequestGet({ env, request });
}
