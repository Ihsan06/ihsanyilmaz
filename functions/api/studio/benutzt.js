// POST /api/admin/benutzt – haelt fest, welche Bilder gerade in einem Beitrag
// waren.
//
//   { schluessel: ["abc.jpg", …] }
//
// Warum: dasselbe Foto zweimal in einer Woche faellt auf, und bei einem Thema
// mit wenigen Bildern passiert das schnell. Gesperrt wird nichts – der
// Vorschlag gewichtet nur um, was frisch dran war. Ein hartes Verbot waere
// falsch: manchmal ist ein Bild einfach das beste, und nach acht Wochen
// erinnert sich ohnehin niemand.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  const schluessel = (Array.isArray(d && d.schluessel) ? d.schluessel : [])
    .map(s => String(s).replace(/^\/bilder\//, ''))
    .filter(s => s && !/^https?:/.test(s))     // Fahrzeugbilder liegen nicht im Vorrat
    .slice(0, 20);
  if (!schluessel.length) return antwort({ ok: true, gemerkt: 0 });

  const jetzt = new Date().toISOString();
  for (const s of schluessel) {
    await db.prepare('UPDATE studio_vorrat SET zuletzt_benutzt = ? WHERE schluessel = ?')
      .bind(jetzt, s).run();
  }
  return antwort({ ok: true, gemerkt: schluessel.length });
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
