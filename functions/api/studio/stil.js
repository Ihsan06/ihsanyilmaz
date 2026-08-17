// /api/admin/stil – wie die Angaben im Bild aussehen.
//
// Gilt fuer alle Beitraege, nicht fuer einen: ein Kanal, der bei jedem Bild
// anders aussieht, hat keinen Wiedererkennungswert.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const FELDER = ['schrift', 'groesse', 'dicke', 'farbe', 'grund', 'grundfarbe', 'deckung',
  'drehung', 'buendig', 'kursiv', 'unterstrichen', 'durchgestrichen'];

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);
  const r = await db.prepare("SELECT wert FROM studio_einstellungen WHERE schluessel = 'stil'").first();
  let d = null;
  try { d = r && r.wert ? JSON.parse(r.wert) : null; } catch { /* alte Zeile */ }
  return antwort({ ok: true, stil: d });
}

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  // Zwei Saetze: einer fuer die Angaben, einer fuer den Titel.
  const roh = (d && d.stil) || {};
  const saubern = q => {
    const raus = {};
    for (const f of FELDER) {
      if (!q || q[f] === undefined) continue;
      raus[f] = (typeof q[f] === 'number' || typeof q[f] === 'boolean')
        ? q[f] : String(q[f]).slice(0, 120);
    }
    return raus;
  };
  const stil = roh.angaben || roh.titel
    ? { angaben: saubern(roh.angaben), titel: saubern(roh.titel) }
    : saubern(roh);

  await db.prepare(
    `INSERT INTO studio_einstellungen (schluessel, wert, geaendert) VALUES ('stil', ?, ?)
       ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert`
  ).bind(JSON.stringify(stil), new Date().toISOString()).run();

  return antwort({ ok: true, stil });
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
