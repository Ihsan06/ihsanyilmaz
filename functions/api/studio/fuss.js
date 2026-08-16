// /api/admin/fuss – der Schluss, der unter jedem Beitrag gleich ist.
//
//   GET   { ok, nummer, hashtags }
//   POST  { nummer, hashtags }
//
// Telefonnummer und Hashtags stehen unter jedem Text, egal welche Variante
// gerade dran ist. Wer sie einmal aendert, meint fast immer alle – deshalb
// gibt es beim Bearbeiten zwei Knoepfe: einen fuer diesen Beitrag und einen
// fuer alle kuenftigen.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

// "nummer" ist der ganze dreizeilige Schluss – Einladung, Telefonnummer und
// Verweis auf die Seite –, nicht bloss die Nummer. Der Baukastenschluss allein
// ist schon 72 Zeichen lang. Eine Grenze von 60 hat ihn deshalb jedes Mal
// mitten im Wort gekappt: so ist "Mehr auf autohaus" in die Datenbank gekommen.
// Jetzt ist die Grenze grosszuegig – und was darueber liegt, wird abgelehnt
// statt stillschweigend gekuerzt. Ein halb gespeicherter Schluss steht sonst
// unter jedem kuenftigen Beitrag, ohne dass jemand es merkt.
const GRENZE_SCHLUSS  = 240;
const GRENZE_HASHTAGS = 400;

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);
  const r = await db.prepare("SELECT wert FROM studio_einstellungen WHERE schluessel = 'fuss'").first();
  let d = null;
  try { d = r && r.wert ? JSON.parse(r.wert) : null; } catch { /* alte Zeile */ }
  return antwort({ ok: true, nummer: (d && d.nummer) || '', hashtags: (d && d.hashtags) || '' });
}

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  const nummer = String((d && d.nummer) || '').trim();
  const hashtags = String((d && d.hashtags) || '').trim();

  if (nummer.length > GRENZE_SCHLUSS) {
    return antwort({ ok: false, fehler:
      `Der gemeinsame Schluss ist ${nummer.length} Zeichen lang – mehr als ${GRENZE_SCHLUSS} passen nicht.` }, 400);
  }
  if (hashtags.length > GRENZE_HASHTAGS) {
    return antwort({ ok: false, fehler:
      `Die Hashtags sind ${hashtags.length} Zeichen lang – mehr als ${GRENZE_HASHTAGS} passen nicht.` }, 400);
  }
  // Rauten gehoeren ins Hashtag-Feld. Stehen sie im Schluss, ist beim Zerlegen
  // etwas schiefgegangen – dann lieber gar nichts speichern als einen Beitrag
  // mit halben Hashtags mitten im Text.
  if (nummer.includes('#')) {
    return antwort({ ok: false, fehler: 'Im gemeinsamen Schluss stehen Hashtags – so gespeichert wäre er kaputt.' }, 400);
  }

  await db.prepare(
    `INSERT INTO studio_einstellungen (schluessel, wert, geaendert) VALUES ('fuss', ?, ?)
       ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert`
  ).bind(JSON.stringify({ nummer, hashtags }), new Date().toISOString()).run();

  return antwort({ ok: true, nummer, hashtags });
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
