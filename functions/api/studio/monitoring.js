// GET /api/admin/monitoring?tage=30
//
// Liefert zwei Dinge getrennt, weil sie aus zwei Welten kommen:
//
//   formulare – aus der eigenen D1-Datenbank. Wie oft Kontakt, Ankauf,
//               Probefahrt, Mietwagen und Suchauftrag abgeschickt wurden.
//               Das ist die Zahl, an der ein Autohaus sein Geschaeft misst.
//   besucher  – aus Cloudflare Web Analytics ueber die GraphQL-Schnittstelle.
//               Kontext: wie viele Leute kamen ueberhaupt, ueber welche Seiten
//               und woher.
//
// Beide Bloecke koennen einzeln fehlschlagen, ohne den anderen mitzureissen –
// die Seite zeigt dann eben nur die eine Haelfte. Ein fehlender Analytics-
// Token darf den Formular-Zaehler nicht unbrauchbar machen.
//
// Wichtig zur Einordnung der Zahlen: Web Analytics zaehlt nur Seiten mit
// Beacon und filtert Bots. Die Zahlen aus dem Cloudflare-Zonenreport sind
// etwas voellig anderes (dort waren zuletzt ~90 % Bot-Verkehr) – die beiden
// nie nebeneinanderstellen.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

// Beides ist nicht geheim: die Konto-Kennung steht in jeder Dashboard-URL,
// das Site-Tag im Quelltext jeder Seite (Beacon). Ueber Umgebungsvariablen
// ueberschreibbar, falls das Projekt mal in ein anderes Konto umzieht.
const KONTO_VORGABE = 'dad9b3e70113cef802e07d68cfc5ca1e';
const SEITE_VORGABE = '4dd4de00c766442180efeebf0e9e84fa';

// Laenger als ein halbes Jahr haelt Cloudflare die Besucherdaten im Gratis-
// Tarif nicht vor – eine groessere Spanne wuerde nur stillschweigend leere
// Balken liefern. Deshalb hier eine Grenze mit klarer Meldung.
const MAX_TAGE = 180;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  let zeitraum;
  try {
    zeitraum = spanne(url.searchParams);
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, fehler: err.message }), { status: 400, headers: KOPF });
  }
  const { von, bis, tage } = zeitraum;

  // Gleich langer Zeitraum unmittelbar davor – nur fuer die Vergleichspfeile
  // an den Kacheln. Faellt er aus, fehlt eben der Pfeil.
  const davorBis = new Date(von.getTime() - 1);
  const davorVon = new Date(davorBis.getTime() - (bis - von));

  const [formulare, besucher, davor] = await Promise.all([
    formularZahlen(env, von, bis).catch(fehlerAls('Formular-Zahlen')),
    besucherZahlen(env, von, bis).catch(fehlerAls('Besucher-Zahlen')),
    vergleich(env, davorVon, davorBis).catch(() => null)
  ]);

  return new Response(JSON.stringify({
    ok: true,
    tage,
    von: von.toISOString(),
    bis: bis.toISOString(),
    formulare,
    besucher,
    davor
  }), { headers: KOPF });
}

// Nur die drei Summen des Vorzeitraums. Bewusst ohne Listen und Verlauf –
// die will niemand sehen, und jede Abfrage kostet Zeit.
async function vergleich(env, von, bis) {
  const [f, b] = await Promise.all([
    formularZahlen(env, von, bis).catch(() => null),
    besucherZahlen(env, von, bis).catch(() => null)
  ]);
  if (!f && !b) return null;
  return {
    besuche: b?.besuche ?? null,
    aufrufe: b?.aufrufe ?? null,
    anfragen: f ? Object.values(f.nachFormular).reduce((s, e) => s + (e.ok || 0), 0) : null
  };
}

// Entweder ?tage=30 (Schnellauswahl) oder ?von=2026-07-01&bis=2026-07-30
// (freier Zeitraum). "bis" meint immer den ganzen Tag, sonst fehlt dem Nutzer
// unerklaerlicherweise der zuletzt gewaehlte Tag.
function spanne(p) {
  const vonRoh = p.get('von');
  const bisRoh = p.get('bis');

  if (vonRoh || bisRoh) {
    const von = tagesBeginn(vonRoh);
    const bis = tagesEnde(bisRoh);
    if (!von || !bis) throw new Error('Bitte beide Daten im Format JJJJ-MM-TT angeben.');
    if (von > bis) throw new Error('Das Startdatum liegt nach dem Enddatum.');

    const jetzt = new Date();
    const echtBis = bis > jetzt ? jetzt : bis;
    const tage = Math.ceil((echtBis - von) / 86400000);
    if (tage > MAX_TAGE) throw new Error(`Höchstens ${MAX_TAGE} Tage am Stück.`);

    return { von, bis: echtBis, tage: Math.max(tage, 1) };
  }

  const tage = Math.min(MAX_TAGE, Math.max(1, Math.round(Number(p.get('tage')) || 30)));
  const bis = new Date();
  return { von: new Date(bis.getTime() - tage * 86400000), bis, tage };
}

function tagesBeginn(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return null;
  const d = new Date(text + 'T00:00:00Z');
  return isNaN(d) ? null : d;
}

function tagesEnde(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return null;
  const d = new Date(text + 'T23:59:59Z');
  return isNaN(d) ? null : d;
}

function fehlerAls(was) {
  return err => {
    console.error(`${was} fehlgeschlagen:`, err);
    return { ok: false, fehler: String(err && err.message || err) };
  };
}

// ─── Formulare (eigene Datenbank) ───

async function formularZahlen(env, von, bis) {
  if (!env.DB) throw new Error('Keine Datenbank verbunden.');
  const seit = von.toISOString();
  const okBis = bis.toISOString();

  const summe = await env.DB.prepare(
    `SELECT formular, ergebnis, COUNT(*) AS anzahl
       FROM studio_eingaenge
      WHERE zeitpunkt >= ? AND zeitpunkt <= ?
      GROUP BY formular, ergebnis`
  ).bind(seit, okBis).all();

  const verlauf = await env.DB.prepare(
    `SELECT substr(zeitpunkt, 1, 10) AS tag, COUNT(*) AS anzahl
       FROM studio_eingaenge
      WHERE zeitpunkt >= ? AND zeitpunkt <= ? AND ergebnis = 'ok'
      GROUP BY tag
      ORDER BY tag`
  ).bind(seit, okBis).all();

  // Nach Formular buendeln: { kontakt: { ok: 3, ungueltig: 1, ... }, ... }
  // Die Spalte "host" der Tabelle wird hier bewusst nicht ausgewertet – sie
  // steht fuer den Zweifelsfall in der Datenbank ("kam das von der echten
  // Seite oder aus einem Test?"), gehoert aber nicht in die Auswertung.
  const nachFormular = {};
  for (const z of summe.results || []) {
    (nachFormular[z.formular] ||= {})[z.ergebnis] = z.anzahl;
  }

  return { ok: true, nachFormular, verlauf: verlauf.results || [] };
}

// ─── Besucher (Cloudflare Web Analytics) ───

const ABFRAGE = `
query Besucher($konto: String!, $seite: String!, $von: Time!, $bis: Time!) {
  viewer {
    accounts(filter: { accountTag: $konto }) {
      proTag: rumPageloadEventsAdaptiveGroups(
        filter: { siteTag: $seite, datetime_geq: $von, datetime_leq: $bis }
        limit: 100
        orderBy: [date_ASC]
      ) {
        count
        sum { visits }
        dimensions { date }
      }
      proSeite: rumPageloadEventsAdaptiveGroups(
        filter: { siteTag: $seite, datetime_geq: $von, datetime_leq: $bis }
        limit: 15
        orderBy: [count_DESC]
      ) {
        count
        dimensions { requestPath }
      }
      proHerkunft: rumPageloadEventsAdaptiveGroups(
        filter: { siteTag: $seite, datetime_geq: $von, datetime_leq: $bis }
        limit: 25
        orderBy: [count_DESC]
      ) {
        count
        dimensions { refererHost }
      }
    }
  }
}`;

async function besucherZahlen(env, von, bis) {
  const token = env.CF_API_TOKEN;
  if (!token) throw new Error('Kein Analytics-Token hinterlegt.');

  const antwort = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: ABFRAGE,
      variables: {
        konto: env.CF_ACCOUNT_ID || KONTO_VORGABE,
        seite: env.CF_SITE_TAG || SEITE_VORGABE,
        von: von.toISOString(),
        bis: bis.toISOString()
      }
    })
  });

  const daten = await antwort.json();

  // GraphQL antwortet auch bei Fehlern mit HTTP 200 – der Statuscode allein
  // sagt hier nichts. Die Meldungen enthalten keine Geheimnisse (Feldnamen,
  // Rechtehinweise) und helfen beim Einrichten, deshalb gehen sie an den
  // angemeldeten Admin durch.
  if (daten.errors?.length) {
    throw new Error(daten.errors.map(e => e.message).join(' | '));
  }
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);

  const konto = daten.data?.viewer?.accounts?.[0];
  if (!konto) throw new Error('Kein Konto in der Antwort – stimmt die Konto-Kennung?');

  const proTag = (konto.proTag || []).map(z => ({
    tag: z.dimensions.date,
    aufrufe: z.count,
    besuche: z.sum?.visits ?? 0
  }));

  return {
    ok: true,
    aufrufe: proTag.reduce((s, z) => s + z.aufrufe, 0),
    besuche: proTag.reduce((s, z) => s + z.besuche, 0),
    proTag,
    proSeite: (konto.proSeite || []).map(z => ({ pfad: z.dimensions.requestPath, aufrufe: z.count })),
    proHerkunft: herkunft(konto.proHerkunft || [])
  };
}

// Die eigene Domain taucht als Verweisquelle auf, sobald jemand INNERHALB der
// Website weiterklickt. Unter "woher kommen die Besucher" hat das nichts zu
// suchen – es waere die groesste Zeile und wuerde die echten Quellen
// (Google, mobile.de, Facebook) optisch erschlagen.
const EIGENE = new Set([
  'autohaus-diezmann.de',
  'www.autohaus-diezmann.de',
  'autohaus-diezmann.pages.dev'
]);

function herkunft(zeilen) {
  return zeilen
    .filter(z => !EIGENE.has((z.dimensions.refererHost || '').toLowerCase()))
    .map(z => ({
      // Leer heisst: direkt eingetippt, Lesezeichen, oder die Quelle hat den
      // Verweis unterdrueckt (haeufig bei WhatsApp und E-Mail-Programmen).
      herkunft: z.dimensions.refererHost || 'Direkt / Lesezeichen',
      aufrufe: z.count
    }))
    .slice(0, 10);
}
