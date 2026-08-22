// /api/admin/vorrat – die Fotos aus der Betriebsreportage.
//
//   GET    liefert alle Bilder mit Motiv, Personen-Stand und Freigabe.
//   POST   aendert einen Eintrag  { schluessel, motiv?, personen?, freigabe? }
//   POST   (multipart, Feld "datei") legt neue Bilder in den Vorrat
//   DELETE ?schluessel=…          nimmt eines wieder heraus
//
// Hochladen und Loeschen teilen sich Grenzen und Helfer mit bild.js – zwei
// Stellen mit denselben Zahlen laufen frueher oder spaeter auseinander.
//
// Warum die Freigabe kein Merkposten, sondern ein Feld ist: Auf einem Teil
// der Fotos sind Mitarbeiter erkennbar. Ohne deren Einwilligung darf so ein
// Bild nicht veroeffentlicht werden. Der Baukasten fragt deshalb nur nach
// freigegebenen Bildern – gesperrte tauchen dort gar nicht erst auf.
//
// Die Dateien selbst liegen in R2 und werden ueber /bilder/<schluessel> von
// der eigenen Domain ausgeliefert (functions/bilder/[name].js).

import { GRENZE_GESAMT, GRENZE_DATEI, TYPEN, belegung, zufall, mb, gb } from './bild.js';

import { beschreibeBilder } from './beschreiben.js';
import { alle as alleKategorien } from './kategorien.js';

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

// Welche Motive es gibt, steht in der Datenbank und nicht hier: legt jemand
// in der Galerie ein Thema an, muss es sich auch von Hand zuweisen lassen.
// Eine feste Liste im Code haette das neue Thema still verworfen.
const motive = async db => ['unsortiert', ...(await alleKategorien(db)).map(k => k.id)];
const PERSONEN = ['unbekannt', 'keine', 'unkenntlich', 'erkennbar'];

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const { results } = await db.prepare(
    `SELECT schluessel, quelle, motiv, personen, freigabe, beschreibung, zuletzt_benutzt,
            geloescht_am, favorit
       FROM studio_vorrat ORDER BY freigabe DESC, quelle`
  ).all();

  // Geloeschtes bleibt liegen, bis es jemand endgueltig wegwirft – ein Foto
  // aus Versehen zu verlieren ist schlimmer als ein voller Papierkorb.
  const alle = results || [];
  const bilder = alle.filter(b => !b.geloescht_am);
  const papierkorb = alle.filter(b => b.geloescht_am);
  return antwort({
    ok: true,
    motive: await motive(db),
    personen: PERSONEN,
    gesamt: bilder.length,
    frei: bilder.filter(b => b.freigabe).length,
    offen: bilder.filter(b => b.personen === 'unbekannt').length,
    ohneBeschreibung: bilder.filter(b => !b.beschreibung).length,
    favoriten: bilder.filter(b => b.favorit).length,
    kategorien: await alleKategorien(env.DB),
    bilder,
    papierkorb
  });
}

export async function onRequestPost({ env, request, waitUntil }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  // Kommt ein Formular statt JSON, sind es neue Bilder.
  if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
    return hochladen({ env, request });
  }

  let d;
  try { d = await request.json(); } catch { d = null; }
  const schluessel = d && d.schluessel ? String(d.schluessel) : null;
  if (!schluessel) return antwort({ ok: false, fehler: 'Kein Bild angegeben.' }, 400);

  const setzen = [];
  const werte = [];

  const erlaubt = await motive(db);
  if (d.motiv && erlaubt.includes(d.motiv)) { setzen.push('motiv = ?'); werte.push(d.motiv); }
  if (d.personen && PERSONEN.includes(d.personen)) {
    setzen.push('personen = ?'); werte.push(d.personen);
    // Die Freigabe folgt aus der Einstufung: Wo niemand erkennbar ist, gibt
    // es nichts abzuwaegen. Ein erkennbares Gesicht sperrt das Bild wieder –
    // auch wenn es vorher freigegeben war, denn dann war die Einstufung
    // falsch.
    if (d.freigabe === undefined) {
      setzen.push('freigabe = ?');
      werte.push(d.personen === 'keine' || d.personen === 'unkenntlich' ? 1 : 0);
    }
  }
  if (d.freigabe !== undefined) { setzen.push('freigabe = ?'); werte.push(d.freigabe ? 1 : 0); }
  // Das Herz ist eine reine Merkhilfe fuer den Betreiber – es sortiert nichts
  // aus und sperrt nichts, es faellt nur ins Auge.
  if (d.favorit !== undefined) { setzen.push('favorit = ?'); werte.push(d.favorit ? 1 : 0); }

  if (!setzen.length) return antwort({ ok: false, fehler: 'Nichts zu ändern.' }, 400);

  werte.push(schluessel);
  await db.prepare(`UPDATE studio_vorrat SET ${setzen.join(', ')} WHERE schluessel = ?`).bind(...werte).run();

  return onRequestGet({ env });
}

function antwort(daten, status = 200) {
  return new Response(JSON.stringify(daten), { status, headers: KOPF });
}

// ─── Neue Bilder in den Vorrat ───
//
// Mehrere auf einmal: wer Fotos nachliefert, hat selten genau eines. Was
// durchgeht, wird gemeldet; was nicht, mit Grund – ein stiller Teilerfolg
// waere schlimmer als eine Fehlermeldung.
async function hochladen({ env, request }) {
  if (!env.BILDER) return antwort({ ok: false, fehler: 'Bildspeicher nicht verbunden.' }, 503);

  let dateien = [];
  let motiv = 'unsortiert';
  try {
    const formular = await request.formData();
    dateien = formular.getAll('datei').filter(f => f && typeof f !== 'string');
    const m = formular.get('motiv');
    if (m && env.DB && (await motive(env.DB)).includes(String(m))) motiv = String(m);
  } catch {
    return antwort({ ok: false, fehler: 'Dateien konnten nicht gelesen werden.' }, 400);
  }
  if (!dateien.length) return antwort({ ok: false, fehler: 'Keine Datei erhalten.' }, 400);

  let belegt = await belegung(env);
  const angelegt = [];
  const abgelehnt = [];

  for (const datei of dateien) {
    const endung = TYPEN[datei.type];
    if (!endung) { abgelehnt.push(`${datei.name}: nur JPG, PNG oder WebP`); continue; }
    if (datei.size > GRENZE_DATEI) {
      abgelehnt.push(`${datei.name}: ${mb(datei.size)}, erlaubt sind ${mb(GRENZE_DATEI)}`);
      continue;
    }
    if (belegt + datei.size > GRENZE_GESAMT) {
      abgelehnt.push(`${datei.name}: Speicher voll (${gb(belegt)} von ${gb(GRENZE_GESAMT)})`);
      continue;
    }

    const schluessel = `${zufall()}.${endung}`;
    try {
      await env.BILDER.put(schluessel, datei.stream(), {
        httpMetadata: { contentType: datei.type, cacheControl: 'public, max-age=31536000, immutable' }
      });
      const jetzt = new Date().toISOString();
      // Zwei Tabellen: "bilder" fuehrt den Speicherstand, "vorrat" die
      // Motive. Ohne den Eintrag in "bilder" waere die Kostenbremse blind.
      await env.DB.prepare(
        'INSERT INTO studio_bilder (schluessel, groesse, typ, angelegt) VALUES (?, ?, ?, ?)'
      ).bind(schluessel, datei.size, datei.type, jetzt).run();
      await env.DB.prepare(
        `INSERT INTO studio_vorrat (schluessel, quelle, motiv, personen, freigabe, angelegt)
         VALUES (?, ?, ?, 'keine', 1, ?)`
      ).bind(schluessel, datei.name || schluessel, motiv, jetzt).run();
      belegt += datei.size;
      angelegt.push(schluessel);
    } catch (err) {
      console.error('Vorrat hochladen:', err);
      abgelehnt.push(`${datei.name}: ${String(err.message || err)}`);
    }
  }

  // Frisch hochgeladene Bilder gleich ansehen lassen: sonst haengen sie ohne
  // Beschreibung im Vorrat und tauchen in keinem Vorschlag auf.
  //
  // Im Hintergrund, nicht im Upload: bei zehn Bildern dauert das Ansehen eine
  // halbe Minute, und so lange soll niemand vor einem drehenden Rad sitzen.
  // Die Bilder sind da, die Beschreibung kommt Sekunden spaeter nach.
  // Scheitert sie, ist der Upload trotzdem gelungen – der Knopf in der
  // Galerie holt es jederzeit nach.
  if (angelegt.length && env.ANTHROPIC_API_KEY && waitUntil) {
    waitUntil(beschreibeBilder(env, new URL(request.url).origin, angelegt)
      .catch(err => console.error('Beschreiben nach Upload:', err)));
  }

  const stand = await onRequestGet({ env });
  const daten = await stand.json();
  return antwort({ ...daten, angelegt, abgelehnt });
}

// ─── Ein Bild wieder heraus ───
// PUT /api/admin/vorrat?schluessel=… – aus dem Papierkorb zurueckholen.
export async function onRequestPut({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);
  const schluessel = new URL(request.url).searchParams.get('schluessel') || '';
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(schluessel)) {
    return antwort({ ok: false, fehler: 'Unbekanntes Bild.' }, 400);
  }
  await db.prepare('UPDATE studio_vorrat SET geloescht_am = NULL WHERE schluessel = ?')
    .bind(schluessel).run();
  const stand = await onRequestGet({ env });
  return antwort({ ...(await stand.json()) });
}

export async function onRequestDelete({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);
  if (!env.BILDER) return antwort({ ok: false, fehler: 'Bildspeicher nicht verbunden.' }, 503);

  const schluessel = new URL(request.url).searchParams.get('schluessel') || '';
  // Nur eigene Schluessel – kein Pfadwechsel in fremde Ablagen.
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(schluessel)) {
    return antwort({ ok: false, fehler: 'Unbekanntes Bild.' }, 400);
  }

  // Zwei Stufen: der erste Klick legt das Bild in den Papierkorb, erst
  // "endgueltig" wirft es weg. Ein Foto aus Versehen zu verlieren ist
  // schlimmer als ein voller Papierkorb – bei den Mietwagen ist es genauso.
  const endgueltig = new URL(request.url).searchParams.get('endgueltig') === 'ja';

  try {
    if (endgueltig) {
      await env.BILDER.delete(schluessel);
      await db.prepare('DELETE FROM studio_vorrat WHERE schluessel = ?').bind(schluessel).run();
      await db.prepare('DELETE FROM studio_bilder WHERE schluessel = ?').bind(schluessel).run();
    } else {
      await db.prepare('UPDATE studio_vorrat SET geloescht_am = ? WHERE schluessel = ?')
        .bind(new Date().toISOString(), schluessel).run();
    }
  } catch (err) {
    console.error('Vorrat loeschen:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 500);
  }
  return onRequestGet({ env });
}
