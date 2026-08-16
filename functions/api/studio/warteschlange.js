// /api/studio/warteschlange – zeitversetztes Posten.
//
//   GET               alle Eintraege, Geplantes zuerst
//   POST { zeitpunkt, format, text, bilder }   neuen Eintrag einplanen
//   POST { id, aktion: 'sofort' }              Eintrag jetzt veroeffentlichen
//   POST { id, aktion: 'nochmal' }             gescheiterten Eintrag neu einreihen
//   PUT  { id, zeitpunkt?, text? }             Geplantes verschieben/umtexten
//   DELETE ?id=…                                Eintrag samt Zwischenkopien entfernen
//
// Die Bilder sind beim Einplanen bereits zugeschnitten und liegen in R2 –
// gespeichert werden hier nur die /bilder/-Pfade. Rausgeschickt wird von
// zwei Stellen: dem Cron-Worker (worker/planer) zur geplanten Zeit oder dem
// "Jetzt veröffentlichen"-Knopf ueber beitragPosten aus veroeffentlichen.js.
// Nach dem Posten (oder Loeschen) werden die Zwischenkopien weggeraeumt,
// sonst waechst der Speicher mit jedem Beitrag.

import { beitragPosten } from './veroeffentlichen.js';

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const MAX_BILDER = 10;
const MAX_GEPLANT = 50;   // mehr offene Eintraege sind kein Plan, sondern ein Stau

export async function onRequestGet({ env }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const { results } = await db.prepare(
    `SELECT id, zeitpunkt, format, text, bilder, status, fehler, beitrag_id, weg,
            angelegt, gepostet_am
       FROM studio_warteschlange
      ORDER BY CASE status WHEN 'geplant' THEN 0 WHEN 'laeuft' THEN 0 ELSE 1 END,
               zeitpunkt`
  ).all();

  const eintraege = (results || []).map(z => ({ ...z, bilder: JSON.parse(z.bilder || '[]') }));
  return antwort({
    ok: true,
    geplant: eintraege.filter(z => z.status === 'geplant' || z.status === 'laeuft'),
    erledigt: eintraege.filter(z => z.status === 'gepostet' || z.status === 'fehler')
  });
}

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  if (!d) return antwort({ ok: false, fehler: 'Nichts erhalten.' }, 400);

  if (d.aktion === 'sofort')  return sofort(db, env, d, request);
  if (d.aktion === 'nochmal') return nochmal(db, d);
  return einplanen(db, d, request);
}

// ─── Einplanen ───

async function einplanen(db, d, request) {
  const zeitpunkt = zeitPruefen(d.zeitpunkt);
  if (!zeitpunkt) return antwort({ ok: false, fehler: 'Kein gültiger Zeitpunkt.' }, 400);
  if (new Date(zeitpunkt) < new Date(Date.now() - 60 * 1000)) {
    return antwort({ ok: false, fehler: 'Der Zeitpunkt liegt in der Vergangenheit.' }, 400);
  }

  const bilder = bilderPruefen(d.bilder, request);
  if (!bilder.length) return antwort({ ok: false, fehler: 'Keine gültigen Bilder übergeben.' }, 400);

  const story = d.format === 'story';
  if (story && bilder.length > 1) {
    return antwort({ ok: false, fehler: 'Eine Story nimmt genau ein Bild.' }, 400);
  }
  if (bilder.length > MAX_BILDER) {
    return antwort({ ok: false, fehler:
      `Instagram nimmt höchstens ${MAX_BILDER} Bilder je Beitrag – ausgewählt sind ${bilder.length}.` }, 400);
  }

  const offen = await db.prepare(
    `SELECT COUNT(*) AS n FROM studio_warteschlange WHERE status IN ('geplant','laeuft')`
  ).first();
  if (offen && offen.n >= MAX_GEPLANT) {
    return antwort({ ok: false, fehler: `Es sind schon ${MAX_GEPLANT} Beiträge eingeplant.` }, 400);
  }

  const text = String(d.text || '').slice(0, 2200);
  const r = await db.prepare(
    `INSERT INTO studio_warteschlange (zeitpunkt, format, text, bilder)
     VALUES (?, ?, ?, ?)`
  ).bind(zeitpunkt, story ? 'story' : 'beitrag', text, JSON.stringify(bilder)).run();

  return antwort({ ok: true, id: r.meta.last_row_id, zeitpunkt });
}

// ─── Jetzt veroeffentlichen ───
//
// Erst den Eintrag beanspruchen (geplant -> laeuft), dann posten: laeuft der
// Cron-Worker zufaellig zeitgleich, nimmt nur einer von beiden den Eintrag.
async function sofort(db, env, d, request) {
  const zeile = await holen(db, d.id);
  if (!zeile) return antwort({ ok: false, fehler: 'Eintrag nicht gefunden.' }, 404);
  if (zeile.status !== 'geplant' && zeile.status !== 'fehler') {
    return antwort({ ok: false, fehler: 'Der Eintrag ist schon unterwegs oder gepostet.' }, 400);
  }

  const claim = await db.prepare(
    `UPDATE studio_warteschlange SET status = 'laeuft' WHERE id = ? AND status = ?`
  ).bind(zeile.id, zeile.status).run();
  if (!claim.meta.changes) {
    return antwort({ ok: false, fehler: 'Der Eintrag ist gerade schon unterwegs.' }, 409);
  }

  const eigene = new URL(request.url).origin;
  const bilder = JSON.parse(zeile.bilder || '[]').map(p => eigene + p);

  try {
    const { id, weg } = await beitragPosten(db, env, {
      bilder, text: zeile.text || '', story: zeile.format === 'story'
    });
    await db.prepare(
      `UPDATE studio_warteschlange
          SET status = 'gepostet', beitrag_id = ?, weg = ?, fehler = NULL,
              gepostet_am = datetime('now')
        WHERE id = ?`
    ).bind(id, weg, zeile.id).run();
    await aufraeumen(db, env, JSON.parse(zeile.bilder || '[]'));
    return antwort({ ok: true, id, weg });
  } catch (err) {
    console.error('Warteschlange sofort:', err);
    await db.prepare(
      `UPDATE studio_warteschlange SET status = 'fehler', fehler = ? WHERE id = ?`
    ).bind(String(err.message || err), zeile.id).run();
    return antwort({ ok: false, fehler: String(err.message || err) }, 502);
  }
}

// ─── Gescheitertes neu einreihen ───

async function nochmal(db, d) {
  const zeitpunkt = new Date().toISOString();
  const r = await db.prepare(
    `UPDATE studio_warteschlange
        SET status = 'geplant', fehler = NULL, zeitpunkt = ?
      WHERE id = ? AND status = 'fehler'`
  ).bind(zeitpunkt, Number(d.id) || 0).run();
  if (!r.meta.changes) return antwort({ ok: false, fehler: 'Eintrag nicht gefunden oder nicht gescheitert.' }, 404);
  return antwort({ ok: true, zeitpunkt });
}

// ─── Verschieben / Umtexten ───

export async function onRequestPut({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  if (!d || !d.id) return antwort({ ok: false, fehler: 'Kein Eintrag angegeben.' }, 400);

  const zeile = await holen(db, d.id);
  if (!zeile) return antwort({ ok: false, fehler: 'Eintrag nicht gefunden.' }, 404);
  if (zeile.status !== 'geplant') {
    return antwort({ ok: false, fehler: 'Nur Geplantes lässt sich noch ändern.' }, 400);
  }

  const setzen = [];
  const werte = [];
  if (d.zeitpunkt !== undefined) {
    const z = zeitPruefen(d.zeitpunkt);
    if (!z) return antwort({ ok: false, fehler: 'Kein gültiger Zeitpunkt.' }, 400);
    setzen.push('zeitpunkt = ?'); werte.push(z);
  }
  if (d.text !== undefined) { setzen.push('text = ?'); werte.push(String(d.text).slice(0, 2200)); }
  if (!setzen.length) return antwort({ ok: false, fehler: 'Nichts zu ändern.' }, 400);

  werte.push(zeile.id);
  await db.prepare(`UPDATE studio_warteschlange SET ${setzen.join(', ')} WHERE id = ?`)
    .bind(...werte).run();
  return antwort({ ok: true });
}

// ─── Entfernen ───

export async function onRequestDelete({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const id = Number(new URL(request.url).searchParams.get('id')) || 0;
  const zeile = await holen(db, id);
  if (!zeile) return antwort({ ok: false, fehler: 'Eintrag nicht gefunden.' }, 404);
  if (zeile.status === 'laeuft') {
    return antwort({ ok: false, fehler: 'Der Eintrag ist gerade unterwegs.' }, 400);
  }

  await db.prepare('DELETE FROM studio_warteschlange WHERE id = ?').bind(zeile.id).run();
  // Gepostetes hat seine Kopien schon beim Posten weggeraeumt.
  if (zeile.status !== 'gepostet') {
    await aufraeumen(db, env, JSON.parse(zeile.bilder || '[]'));
  }
  return antwort({ ok: true });
}

// ─── Helfer ───

async function holen(db, id) {
  return db.prepare('SELECT * FROM studio_warteschlange WHERE id = ?')
    .bind(Number(id) || 0).first();
}

// Angenommen wird alles, was Date versteht; gespeichert wird einheitlich UTC.
function zeitPruefen(wert) {
  const d = new Date(String(wert || ''));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Nur eigene, frisch abgelegte Studio-Bilder – dasselbe Muster wie beim
// direkten Veroeffentlichen. Gespeichert wird der Pfad ohne Ursprung, damit
// der Eintrag nicht an einer Domain klebt.
function bilderPruefen(roh, request) {
  const eigene = new URL(request.url).origin;
  return (Array.isArray(roh) ? roh : [])
    .map(String)
    .map(u => u.startsWith(eigene) ? u.slice(eigene.length) : u)
    .filter(p => /^\/bilder\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(p));
}

// Zwischenkopien wegwerfen: R2-Objekt und Speicherstand-Zeile.
async function aufraeumen(db, env, pfade) {
  for (const pfad of pfade) {
    const schluessel = String(pfad).replace(/^\/bilder\//, '');
    if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(schluessel)) continue;
    try {
      if (env.BILDER) await env.BILDER.delete(schluessel);
      await db.prepare('DELETE FROM studio_bilder WHERE schluessel = ?').bind(schluessel).run();
    } catch (err) {
      console.error('Warteschlange aufraeumen:', err);
    }
  }
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
