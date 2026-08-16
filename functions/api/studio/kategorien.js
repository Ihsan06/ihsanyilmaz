// /api/admin/kategorien – womit Bilder einsortiert werden.
//
//   GET     Liste mit Anzahl je Kategorie
//   POST    { titel: "Oldtimer", hinweis: "…" }   neue anlegen
//   DELETE  ?id=oldtimer                          wieder entfernen
//
// Warum das in der Datenbank steht und nicht im Code: eine neue Kategorie
// wirkt an drei Stellen gleichzeitig. Das Modell bekommt sie beim Ansehen
// neuer Bilder mit in die Auswahl, die Galerie zeigt sie als Filter, und im
// Baukasten wird sie zu einem Thema, über das sich ein Beitrag bauen laesst.
// Stuende sie im Code, muesste fuer jede neue Kategorie jemand etwas
// programmieren.
//
// Die sieben ersten sind als "fest" markiert: sie stecken in 266 bereits
// beschriebenen Bildern, sie zu loeschen wuerde die alle heimatlos machen.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);
  return antwort({ ok: true, kategorien: await alle(db) });
}

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  const titel = String((d && d.titel) || '').trim().slice(0, 40);
  const hinweis = String((d && d.hinweis) || '').trim().slice(0, 200);
  if (!titel) return antwort({ ok: false, fehler: 'Ohne Namen geht es nicht.' }, 400);

  const id = kurzform(titel);
  if (!id) return antwort({ ok: false, fehler: 'Aus dem Namen lässt sich kein Kürzel bilden.' }, 400);

  // Den Titel des vorhandenen Eintrags melden, nicht den gerade getippten:
  // kurzform() wirft Sonderzeichen weg und kuerzt, sehr verschiedene Namen
  // ergeben dieselbe ID. Sonst nennt die Meldung einen Namen, den es in der
  // Themenzeile gar nicht gibt, und man sucht vergeblich.
  const da = await db.prepare('SELECT titel FROM studio_kategorien WHERE id = ?').bind(id).first();
  if (da) {
    return antwort({ ok: false, fehler: da.titel === titel
      ? `„${titel}“ gibt es schon.`
      : `„${titel}“ und das vorhandene „${da.titel}“ ergeben dasselbe Kürzel (${id}).` }, 409);
  }

  await db.prepare(
    'INSERT INTO studio_kategorien (id, titel, hinweis, fest, angelegt) VALUES (?, ?, ?, 0, ?)'
  ).bind(id, titel, hinweis || null, new Date().toISOString().slice(0, 10)).run();

  return antwort({ ok: true, angelegt: id, kategorien: await alle(db) });
}

export async function onRequestDelete({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const id = new URL(request.url).searchParams.get('id') || '';
  const k = await db.prepare('SELECT id, titel, fest FROM studio_kategorien WHERE id = ?').bind(id).first();
  if (!k) return antwort({ ok: false, fehler: 'Diese Kategorie gibt es nicht.' }, 404);
  if (k.fest) {
    return antwort({ ok: false, fehler: `„${k.titel}“ ist eine der Grundkategorien und bleibt.` }, 400);
  }

  // Bilder nicht mitloeschen, nur heimatlos machen: sie sind ja noch da.
  await db.prepare("UPDATE studio_vorrat SET motiv = 'unsortiert' WHERE motiv = ?").bind(id).run();
  await db.prepare('DELETE FROM studio_kategorien WHERE id = ?').bind(id).run();

  return antwort({ ok: true, kategorien: await alle(db) });
}

// ─── Gemeinsam genutzt ───

// Auch von beschreiben.js und zusammenstellen.js aufgerufen: beide muessen
// wissen, welche Kategorien es gerade gibt.
export async function alle(db) {
  const { results } = await db.prepare(
    `SELECT k.id, k.titel, k.hinweis, k.fest,
            (SELECT COUNT(*) FROM studio_vorrat v WHERE v.motiv = k.id) AS bilder
       FROM studio_kategorien k
      ORDER BY k.fest DESC, k.titel`
  ).all();
  return results || [];
}

// Aus "Oldtimer & Youngtimer" wird "oldtimeryoungtimer": das Kuerzel steht
// spaeter in der Bildbeschreibung und muss ohne Umlaute und Leerzeichen
// auskommen, damit die Suche danach zuverlaessig greift.
function kurzform(titel) {
  return titel.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
