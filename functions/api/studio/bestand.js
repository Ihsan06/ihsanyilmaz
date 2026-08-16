// GET /api/admin/bestand – das Gedaechtnis des Fahrzeugbestands.
//
// Warum es das gibt: mobile.de liefert bei jedem Abruf nur den JETZIGEN
// Bestand. Ob ein Fahrzeug neu ist, wie lange es steht oder ob es verkauft
// wurde, steht dort nirgends – das weiss nur, wer sich merkt, was gestern da
// war. Dieser Abruf vergleicht den aktuellen Bestand mit dem gemerkten und
// schreibt die Unterschiede fort. Er liefert danach den Stand zurueck.
//
// Cloudflare Pages kennt keine Zeitsteuerung, es gibt also niemanden, der das
// naechtlich anstoesst. Deshalb laeuft der Abgleich, wenn eine Adminseite ihn
// aufruft. Damit haeufiges Neuladen nicht bei mobile.de durchschlaegt, wird
// hoechstens alle FRISCH_MINUTEN wirklich abgerufen – sonst kommt der zuletzt
// gespeicherte Stand zurueck.
//
// Der Endpunkt liegt unter /api/admin/ und ist damit durch _middleware.js
// geschuetzt; ohne Anmeldung gibt es 401.

import { fetchVehicleList } from './vehicles.js';

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const FRISCH_MINUTEN = 15;
const NEU_TAGE = 7;

export async function onRequestGet({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  // ?frisch=1 umgeht die Schonfrist – das ist der Knopf "Jetzt abgleichen".
  const erzwingen = new URL(request.url).searchParams.get('frisch') === '1';

  const jetzt = new Date();
  let abgeglichen = false;
  let fehler = null;

  try {
    if (erzwingen || await faellig(db, jetzt)) {
      await abgleichen(db, env, jetzt);
      abgeglichen = true;
    }
  } catch (err) {
    // Der Stand von vorhin ist mehr wert als eine Fehlermeldung an seiner
    // Stelle – also weitermachen und den Fehler nur mitgeben.
    console.error('Bestandsabgleich:', err);
    fehler = String(err && err.message || err);
  }

  return antwort({ ok: true, abgeglichen, fehler, ...(await stand(db, jetzt)) });
}

// Haelt fest, dass ein Fahrzeug einen Beitrag hatte. Danach faellt es aus der
// Warteschlange und taucht unter "Schon gepostet" auf.
export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let daten;
  try { daten = await request.json(); } catch { daten = null; }

  const id = daten && daten.fahrzeug_id ? String(daten.fahrzeug_id) : null;
  // 'story' gehoert dazu: der Baukasten schickt es beim Teilen und beim
  // Veroeffentlichen einer Story, und stand() zaehlt ohne_story genau darueber.
  // Ohne den Eintrag hier fiel jede Story auf 'neuzugang' zurueck – das
  // Fahrzeug verschwand aus der Feed-Warteschlange, obwohl im Feed nie etwas
  // stand, und "ohne Story" blieb fuer immer auf derselben Zahl stehen.
  const thema = ['neuzugang', 'verkauft', 'frei', 'story'].includes(daten && daten.thema)
    ? daten.thema : 'neuzugang';
  if (!id) return antwort({ ok: false, fehler: 'Kein Fahrzeug angegeben.' }, 400);

  // Zweimal derselbe Eintrag waere kein Fehler, aber unnoetig – der Knopf
  // laesst sich versehentlich zweimal druecken.
  const schon = await db.prepare(
    'SELECT id FROM studio_beitraege WHERE fahrzeug_id = ? AND thema = ?'
  ).bind(id, thema).first();

  if (!schon) {
    await db.prepare(
      'INSERT INTO studio_beitraege (fahrzeug_id, thema, zeitpunkt) VALUES (?, ?, ?)'
    ).bind(id, thema, new Date().toISOString()).run();
  }

  return antwort({ ok: true, abgeglichen: false, fehler: null, ...(await stand(db, new Date())) });
}

// ─── Abgleich ───

async function faellig(db, jetzt) {
  const z = await db.prepare('SELECT MAX(zuletzt_gesehen) AS letzte FROM studio_bestand').first();
  if (!z || !z.letzte) return true;                       // noch nie gelaufen
  return jetzt - new Date(z.letzte) > FRISCH_MINUTEN * 60000;
}

async function abgleichen(db, env, jetzt) {
  const { live, vehicles } = await fetchVehicleList(env);

  // Ohne hinterlegten mobile.de-Zugang liefert fetchVehicleList die
  // Beispielliste aus vehicles.js. Die ist fuer die oeffentliche Seite
  // gedacht und darf den Bestand nicht anfassen: sie wuerde acht erfundene
  // Fahrzeuge eintragen und alle echten als verkauft markieren, weil sie in
  // ihr nicht vorkommen. Genau das war beim Testen zu sehen.
  if (!live) throw new Error('Kein Zugang zu mobile.de hinterlegt – Abgleich uebersprungen.');

  // Sicherung gegen den schlimmsten Fall: liefert mobile.de eine leere Liste
  // (Stoerung, abgelaufener Zugang), wuerde der Abgleich sonst den kompletten
  // Bestand als verkauft markieren. Lieber gar nichts tun.
  if (!vehicles.length) throw new Error('Bestandsliste war leer – Abgleich uebersprungen.');

  const stempel = jetzt.toISOString();

  // Gesehene fortschreiben. zuerst_gesehen bleibt stehen – der Wert laesst
  // sich spaeter durch keinen Abruf mehr rekonstruieren.
  const schreiben = db.prepare(
    `INSERT INTO studio_bestand (fahrzeug_id, titel, marke, preis, bild, zuerst_gesehen, zuletzt_gesehen, verschwunden_am)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(fahrzeug_id) DO UPDATE SET
       titel = excluded.titel, marke = excluded.marke, preis = excluded.preis,
       bild = excluded.bild, zuletzt_gesehen = excluded.zuletzt_gesehen,
       verschwunden_am = NULL`
  );

  await db.batch(vehicles.map(v => schreiben.bind(
    String(v.id), v.title || null, v.make || null,
    Number.isFinite(v.price) ? v.price : null,
    (v.images && v.images[0]) || null,
    stempel, stempel
  )));

  // Was jetzt nicht mitgekommen ist, fehlt im Bestand – also verkauft oder
  // offline genommen. Taucht es wieder auf, hebt der Einfuegepfad oben das
  // wieder auf.
  await db.prepare(
    `UPDATE studio_bestand SET verschwunden_am = ?
      WHERE verschwunden_am IS NULL AND zuletzt_gesehen < ?`
  ).bind(stempel, stempel).run();
}

// ─── Stand ───

async function stand(db, jetzt) {
  const seit = new Date(jetzt - NEU_TAGE * 86400000).toISOString();

  const zahlen = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM studio_bestand WHERE verschwunden_am IS NULL) AS im_bestand,
       (SELECT COUNT(*) FROM studio_bestand WHERE verschwunden_am IS NULL AND zuerst_gesehen >= ?) AS neu,
       (SELECT COUNT(*) FROM studio_bestand WHERE verschwunden_am >= ?) AS verschwunden,
       (SELECT COUNT(*) FROM studio_bestand b
          LEFT JOIN studio_beitraege p ON p.fahrzeug_id = b.fahrzeug_id AND p.thema = 'neuzugang'
         WHERE b.verschwunden_am IS NULL AND p.id IS NULL) AS ohne_beitrag,
       -- Zweite Spur: die Story im Highlight "Aktuelle Fahrzeuge". Sie ist
       -- kein Beitrag, sondern der Katalog – ein Fahrzeug kann im Feed schon
       -- dran gewesen sein und trotzdem im Highlight fehlen.
       (SELECT COUNT(*) FROM studio_bestand b
          LEFT JOIN studio_beitraege p ON p.fahrzeug_id = b.fahrzeug_id AND p.thema = 'story'
         WHERE b.verschwunden_am IS NULL AND p.id IS NULL) AS ohne_story,
       (SELECT MAX(zuletzt_gesehen) FROM studio_bestand) AS zuletzt,
       (SELECT MIN(zuerst_gesehen) FROM studio_bestand) AS seit_wann`
  ).bind(seit, seit).first();

  // Die eigentliche Warteschlange: was steht im Bestand und hatte noch keinen
  // Beitrag? Neueste zuerst – ein frisch hereingekommener Wagen ist der
  // naheliegendste naechste Beitrag. Ohne Grenze: die Seite blaettert selbst,
  // und eine abgeschnittene Liste laesst Fahrzeuge verschwinden, die noch
  // dran waeren.
  const offen = await db.prepare(
    `SELECT b.fahrzeug_id, b.titel, b.marke, b.preis, b.bild, b.zuerst_gesehen
       FROM studio_bestand b
       LEFT JOIN studio_beitraege p ON p.fahrzeug_id = b.fahrzeug_id AND p.thema = 'neuzugang'
      WHERE b.verschwunden_am IS NULL AND p.id IS NULL
      ORDER BY b.zuerst_gesehen DESC`
  ).all();

  // Die Gegenseite der Warteschlange: was schon draussen ist. Der Titel kommt
  // aus dem Bestand – steht das Fahrzeug nicht mehr drin (verkauft), bleibt
  // der Eintrag trotzdem erhalten, dann eben ohne Bild.
  const raus = await db.prepare(
    `SELECT p.id, p.fahrzeug_id, p.thema, p.zeitpunkt, p.notiz,
            b.titel, b.bild, b.verschwunden_am
       FROM studio_beitraege p
       LEFT JOIN studio_bestand b ON b.fahrzeug_id = p.fahrzeug_id
      ORDER BY p.zeitpunkt DESC
      LIMIT 20`
  ).all();

  return {
    imBestand: zahlen?.im_bestand || 0,
    neu: zahlen?.neu || 0,
    verschwunden: zahlen?.verschwunden || 0,
    zuletzt: zahlen?.zuletzt || null,
    seitWann: zahlen?.seit_wann || null,
    neuTage: NEU_TAGE,
    // Gezaehlt wird in der Datenbank, nicht an der Liste – sonst haengt die
    // Zahl an deren Laenge statt am Bestand.
    ohneBeitrag: zahlen?.ohne_beitrag || 0,
    ohneStory: zahlen?.ohne_story || 0,
    warteschlange: offen.results || [],
    gepostet: raus.results || []
  };
}

function antwort(daten, status = 200) {
  return new Response(JSON.stringify(daten), { status, headers: KOPF });
}
