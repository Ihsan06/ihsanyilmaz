// /api/studio/entwuerfe – Beitraege und Stories, die noch nicht fertig sind.
// (Aus dem Diezmann-Baukasten uebernommen; Tabelle studio_entwuerfe, Anmeldung
// prueft _middleware.js daneben.)
//
//   GET                                       alle Entwuerfe, zuletzt geaendert zuerst
//   GET  ?id=…                                ein Entwurf
//   POST { format, quelle, bilder, … }        neuen Entwurf anlegen
//   POST { id, aktion: 'kopie' }              Entwurf verdoppeln
//   POST { id, aktion: 'verwendet', wie }     vermerken: gepostet oder eingeplant
//   PUT  { id, format, quelle, bilder, … }    Entwurf ueberschreiben
//   PUT  { id, titel }                        nur umbenennen
//   DELETE ?id=…                              Entwurf loeschen (samt Bildern, die nur er noch braucht)
//
// Ein Entwurf ist ein Bauplan: Originalbilder und die Einstellungen des
// Baukastens. Geprueft wird hier nur, was spaeter gefaehrlich werden kann –
// fremde Bildadressen und uebergrosse Eintraege. Was im Zustand steht, legt
// der Baukasten selbst fest; der Server reicht ihn unveraendert zurueck.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const FORMATE = ['beitrag', 'story'];
const QUELLEN = ['galerie', 'bestand'];
const MAX_ENTWUERFE = 200;   // mehr sind keine Entwuerfe mehr, sondern ein Archiv
const MAX_BILDER = 10;       // mehr nimmt Instagram in keinem Beitrag
const MAX_ZUSTAND = 64000;   // Zeichen – ein voller Baukasten braucht wenige Kilobyte

// Nur Bilder aus dem eigenen Speicher. Eine beliebige Adresse hier hiesse,
// dass spaeter ein fremdes Bild zugeschnitten und gepostet wird.
const BILD_ERLAUBT = [
  /^\/bilder\/[a-f0-9]{24}\.(jpg|png|webp)$/
];

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
const jetzt = () => new Date().toISOString();

export async function onRequestGet({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const id = Number(new URL(request.url).searchParams.get('id')) || 0;
  if (id) {
    const z = await holen(db, id);
    if (!z) return antwort({ ok: false, fehler: 'Diesen Entwurf gibt es nicht mehr.' }, 404);
    return antwort({ ok: true, entwurf: aufbereiten(z) });
  }

  const { results } = await db.prepare(
    'SELECT * FROM studio_entwuerfe ORDER BY geaendert DESC'
  ).all();
  return antwort({ ok: true, entwuerfe: (results || []).map(aufbereiten) });
}

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  if (!d) return antwort({ ok: false, fehler: 'Nichts erhalten.' }, 400);

  if (d.aktion === 'kopie') return kopieren(db, d);
  if (d.aktion === 'verwendet') return vermerken(db, d);

  const menge = await db.prepare('SELECT COUNT(*) AS n FROM studio_entwuerfe').first();
  if (menge && menge.n >= MAX_ENTWUERFE) {
    return antwort({ ok: false, fehler:
      `Es liegen schon ${MAX_ENTWUERFE} Entwürfe. Bitte erst alte löschen.` }, 400);
  }

  const e = pruefen(d);
  if (e.fehler) return antwort({ ok: false, fehler: e.fehler }, 400);

  const zeit = jetzt();
  const r = await db.prepare(
    `INSERT INTO studio_entwuerfe (format, quelle, titel, text, bilder, fahrzeug_id, zustand,
                            angelegt, geaendert)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(e.format, e.quelle, e.titel, e.text, JSON.stringify(e.bilder), e.fahrzeug,
         e.zustand, zeit, zeit).run();

  const neu = await holen(db, r.meta.last_row_id);
  return antwort({ ok: true, entwurf: aufbereiten(neu) });
}

export async function onRequestPut({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  if (!d || !d.id) return antwort({ ok: false, fehler: 'Kein Entwurf angegeben.' }, 400);

  const alt = await holen(db, d.id);
  if (!alt) return antwort({ ok: false, fehler: 'Diesen Entwurf gibt es nicht mehr.' }, 404);

  // Nur umbenennen: kommt von der Entwurfsseite. Der Name bleibt danach fest –
  // spaeteres Speichern aus dem Baukasten soll ihn nicht wieder ersetzen.
  if (d.titel !== undefined && d.bilder === undefined) {
    const titel = String(d.titel).trim().slice(0, 120);
    if (!titel) return antwort({ ok: false, fehler: 'Der Name darf nicht leer sein.' }, 400);
    await db.prepare('UPDATE studio_entwuerfe SET titel = ?, titel_fest = 1, geaendert = ? WHERE id = ?')
      .bind(titel, jetzt(), alt.id).run();
    return antwort({ ok: true, entwurf: aufbereiten(await holen(db, alt.id)) });
  }

  const e = pruefen(d);
  if (e.fehler) return antwort({ ok: false, fehler: e.fehler }, 400);

  await db.prepare(
    `UPDATE studio_entwuerfe SET format = ?, quelle = ?, titel = ?, text = ?, bilder = ?,
            fahrzeug_id = ?, zustand = ?, geaendert = ?
      WHERE id = ?`
  ).bind(e.format, e.quelle, alt.titel_fest ? alt.titel : e.titel, e.text,
         JSON.stringify(e.bilder), e.fahrzeug, e.zustand, jetzt(), alt.id).run();

  return antwort({ ok: true, entwurf: aufbereiten(await holen(db, alt.id)) });
}

export async function onRequestDelete({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const id = Number(new URL(request.url).searchParams.get('id')) || 0;
  const alt = await holen(db, id);
  const r = await db.prepare('DELETE FROM studio_entwuerfe WHERE id = ?').bind(id).run();
  if (!r.meta || !r.meta.changes) {
    return antwort({ ok: false, fehler: 'Diesen Entwurf gibt es nicht mehr.' }, 404);
  }
  if (alt) await verwaisteBilderWeg(db, env, aufbereiten(alt).bilder);
  return antwort({ ok: true });
}

// Ein Entwurf kann Bilder tragen, die nicht in der Galerie stehen – etwa
// fertig gestaltete Bilder aus einem frueheren Eintrag in Content planen.
// Die sollen beim Loeschen nicht als Waisen im Speicher liegen bleiben.
// Weg kommt nur, was weder im Bildvorrat steht noch in einem anderen Entwurf
// oder einem geplanten Beitrag gebraucht wird.
async function verwaisteBilderWeg(db, env, bilder) {
  for (const pfad of bilder || []) {
    const schluessel = String(pfad).replace(/^\/bilder\//, '');
    if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(schluessel)) continue;
    try {
      const muster = '%' + schluessel + '%';
      const [imVorrat, imEntwurf, geplant] = await Promise.all([
        db.prepare('SELECT 1 FROM studio_vorrat WHERE schluessel = ?').bind(schluessel).first(),
        db.prepare('SELECT 1 FROM studio_entwuerfe WHERE bilder LIKE ?').bind(muster).first(),
        db.prepare("SELECT 1 FROM studio_warteschlange WHERE bilder LIKE ? AND status IN ('geplant', 'laeuft', 'fehler')").bind(muster).first()
      ]);
      if (imVorrat || imEntwurf || geplant) continue;
      if (env.BILDER) await env.BILDER.delete(schluessel);
      await db.prepare('DELETE FROM studio_bilder WHERE schluessel = ?').bind(schluessel).run();
    } catch (err) {
      console.error('Entwurf-Bild aufraeumen:', err);
    }
  }
}

// ─── Verdoppeln ───
//
// Fuer die Vorlage: derselbe Aufbau, andere Bilder oder ein anderes Thema.
// Die Kopie gilt als neu – nicht verwendet, eigener Zeitstempel.
async function kopieren(db, d) {
  const alt = await holen(db, d.id);
  if (!alt) return antwort({ ok: false, fehler: 'Diesen Entwurf gibt es nicht mehr.' }, 404);

  const menge = await db.prepare('SELECT COUNT(*) AS n FROM studio_entwuerfe').first();
  if (menge && menge.n >= MAX_ENTWUERFE) {
    return antwort({ ok: false, fehler:
      `Es liegen schon ${MAX_ENTWUERFE} Entwürfe. Bitte erst alte löschen.` }, 400);
  }

  const zeit = jetzt();
  const titel = (String(alt.titel || 'Entwurf').replace(/ \(Kopie\)$/, '') + ' (Kopie)').slice(0, 120);
  const r = await db.prepare(
    `INSERT INTO studio_entwuerfe (format, quelle, titel, titel_fest, text, bilder, fahrzeug_id,
                            zustand, angelegt, geaendert)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
  ).bind(alt.format, alt.quelle, titel, alt.text, alt.bilder, alt.fahrzeug_id,
         alt.zustand, zeit, zeit).run();
  return antwort({ ok: true, entwurf: aufbereiten(await holen(db, r.meta.last_row_id)) });
}

// ─── Verwendet ───
//
// Ein Entwurf verschwindet nach dem Posten nicht: er kann Vorlage fuer den
// naechsten sein. Er traegt dann aber sichtbar, dass er schon draussen ist –
// sonst postet man denselben Beitrag aus Versehen zweimal.
async function vermerken(db, d) {
  const wie = d.wie === 'geplant' ? 'geplant' : 'gepostet';
  const r = await db.prepare(
    'UPDATE studio_entwuerfe SET verwendet = ?, verwendet_am = ? WHERE id = ?'
  ).bind(wie, jetzt(), Number(d.id) || 0).run();
  if (!r.meta || !r.meta.changes) {
    return antwort({ ok: false, fehler: 'Diesen Entwurf gibt es nicht mehr.' }, 404);
  }
  return antwort({ ok: true });
}

// ─── Helfer ───

function pruefen(d) {
  const format = FORMATE.includes(d.format) ? d.format : null;
  if (!format) return { fehler: 'Unbekanntes Format.' };
  const quelle = QUELLEN.includes(d.quelle) ? d.quelle : null;
  if (!quelle) return { fehler: 'Unbekannte Quelle.' };

  const roh = Array.isArray(d.bilder) ? d.bilder.map(String) : [];
  const bilder = roh.filter(u => BILD_ERLAUBT.some(m => m.test(u)));
  if (bilder.length !== roh.length) return { fehler: 'Ein Bild stammt nicht aus dem eigenen Bestand.' };
  if (bilder.length > MAX_BILDER) {
    return { fehler: `Höchstens ${MAX_BILDER} Bilder je Entwurf – ausgewählt sind ${bilder.length}.` };
  }

  let zustand = '{}';
  if (d.zustand && typeof d.zustand === 'object') {
    zustand = JSON.stringify(d.zustand);
    if (zustand.length > MAX_ZUSTAND) return { fehler: 'Der Entwurf ist zu groß zum Speichern.' };
  }

  // Leer ist erlaubt – auch ein angefangener Text ohne Bild ist ein Entwurf.
  // Ganz ohne alles lohnt das Speichern aber nicht.
  const text = String(d.text || '').slice(0, 2200);
  if (!bilder.length && !text.trim() && zustand === '{}') {
    return { fehler: 'Der Entwurf ist noch leer.' };
  }

  return {
    format, quelle, bilder, text, zustand,
    titel: String(d.titel || '').trim().slice(0, 120) || (format === 'story' ? 'Story' : 'Beitrag'),
    fahrzeug: quelle === 'bestand' && d.fahrzeug_id ? String(d.fahrzeug_id).slice(0, 40) : null
  };
}

const holen = (db, id) =>
  db.prepare('SELECT * FROM studio_entwuerfe WHERE id = ?').bind(Number(id) || 0).first();

function aufbereiten(z) {
  const lesen = (roh, leer) => { try { return JSON.parse(roh) ?? leer; } catch { return leer; } };
  return {
    id: z.id,
    format: z.format,
    quelle: z.quelle,
    titel: z.titel,
    titel_fest: !!z.titel_fest,
    text: z.text || '',
    bilder: lesen(z.bilder, []),
    fahrzeug_id: z.fahrzeug_id,
    zustand: lesen(z.zustand, {}),
    verwendet: z.verwendet,
    verwendet_am: z.verwendet_am,
    angelegt: z.angelegt,
    geaendert: z.geaendert
  };
}
