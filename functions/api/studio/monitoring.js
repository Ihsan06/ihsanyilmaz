// /api/studio/monitoring – die Zahlen zur eigenen Seite.
//
// Vier Quellen, jede fuer sich abgesichert: faellt eine aus, fehlt nur ihr
// Block, der Rest steht trotzdem da. Genau das war beim Vorgaenger der Punkt –
// eine fehlende Analytics-Kennung darf nicht die ganze Seite leer lassen.
//
//   Anfragen   Tabelle "anfragen" – das Kontaktformular der Website
//   Besucher   Cloudflare Web Analytics ueber die GraphQL-Schnittstelle
//   Instagram  Tabelle "studio_instagram" – der Follower-Verlauf
//   Speicher   Tabelle "studio_bilder" – wie voll der Bildspeicher ist
//
// Diese Datei kam urspruenglich aus dem Autohaus-Baukasten und fragte dort
// "studio_eingaenge" ab – eine Tabelle, die hier nie beschrieben wird und
// deshalb immer leer war. Das Kontaktformular schreibt nach "anfragen".

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

// Laenger als ein halbes Jahr haelt Cloudflare die Besucherdaten im
// Gratis-Tarif nicht vor – eine groessere Spanne liefert stillschweigend
// leere Balken. Deshalb hier eine Grenze mit klarer Meldung.
const MAX_TAGE = 180;

// Der Bildspeicher ist auf 9,5 GB gedeckelt (siehe bild.js) – hier nur zum
// Anzeigen des Fuellstands.
const SPEICHER_GRENZE = 9.5 * 1024 * 1024 * 1024;

// Die Kontokennung steht ohnehin in jeder Dashboard-Adresse; ueberschreiben
// laesst sie sich per Umgebungswert.
//
// Gezaehlt wird nach Domain, nicht nach Web-Analytics-Kennung: Die Kennung im
// Beacon ist ein anderer Wert als die, nach der die API filtert – mit der
// falschen kam still eine Null zurueck. Und wechselt die Zaehlung einmal (vom
// Zonen-Einbau auf den des Pages-Projekts), bekommt sie eine neue Kennung,
// die Domain bleibt.
//
// Geheim ist nur der Token, mit dem die Zahlen abgefragt werden – der steht
// als CF_API_TOKEN im Pages-Projekt und nirgends im Code.
const KONTO_VORGABE = 'dad9b3e70113cef802e07d68cfc5ca1e';
const HOSTS = ['ihsan-yilmaz.de', 'www.ihsan-yilmaz.de'];

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);

  let zeitraum;
  try { zeitraum = spanne(url.searchParams); }
  catch (err) { return antwort({ ok: false, fehler: err.message }, 400); }

  const { bis, alles } = zeitraum;

  // "Insgesamt" beginnt beim ersten Eintrag in der eigenen Datenbank. Steht
  // dort noch nichts, bleibt es beim groessten Fenster, das Cloudflare fuer
  // die Besucherzahlen ueberhaupt vorhaelt.
  const von = alles ? await ersterTag(env, bis) : zeitraum.von;
  const tage = alles ? Math.max(1, Math.ceil((bis - von) / 86400000)) : zeitraum.tage;

  // Besucherzahlen hoechstens fuer die letzten MAX_TAGE Tage – aeltere haelt
  // Cloudflare im Gratistarif nicht vor. Die Anfragen gehen weiter zurueck,
  // die stehen in der eigenen Datenbank.
  const grenze = new Date(bis.getTime() - MAX_TAGE * 86400000);
  const besucherVon = von < grenze ? grenze : von;

  // Gleich langer Zeitraum unmittelbar davor – nur fuer die Vergleichspfeile
  // an den Kacheln. Faellt er aus, fehlt eben der Pfeil.
  const davorBis = new Date(von.getTime() - 1);
  const davorVon = new Date(davorBis.getTime() - (bis - von));

  const [anfragen, besucher, instagram, speicher, davor] = await Promise.all([
    anfrageZahlen(env, von, bis).catch(fehlerAls('Anfragen')),
    besucherZahlen(env, besucherVon, bis).catch(fehlerAls('Besucher')),
    instagramVerlauf(env, von, bis).catch(fehlerAls('Instagram')),
    speicherStand(env).catch(fehlerAls('Speicher')),
    vergleich(env, davorVon, davorBis).catch(() => null)
  ]);

  return antwort({
    ok: true,
    tage,
    von: von.toISOString(),
    bis: bis.toISOString(),
    anfragen, besucher, instagram, speicher, davor
  });
}

// Nur die Summen des Vorzeitraums. Bewusst ohne Verlauf und Listen – die
// will an dieser Stelle niemand sehen, und jede Abfrage kostet Zeit.
async function vergleich(env, von, bis) {
  const [a, b] = await Promise.all([
    anfrageZahlen(env, von, bis).catch(() => null),
    besucherZahlen(env, von, bis).catch(() => null)
  ]);
  if (!a && !b) return null;
  return {
    anfragen: a?.gesamt ?? null,
    besuche: b?.besuche ?? null,
    aufrufe: b?.aufrufe ?? null
  };
}

// ─── Anfragen aus dem Kontaktformular ───

async function anfrageZahlen(env, von, bis) {
  if (!env.DB) throw new Error('Keine Datenbank verbunden.');
  // Nur die Datumsanteile vergleichen. "anfragen" speichert
  // "2026-08-18 01:15:45" mit Leerzeichen, "studio_instagram" dagegen
  // "2026-08-18T01:15:45.175Z" mit T. Ein Textvergleich gegen einen
  // ISO-Zeitstempel wuerde jeden Eintrag am Starttag verschlucken, weil das
  // Leerzeichen vor dem T sortiert.
  const seit = tagText(von);
  const okBis = tagText(bis);

  const [nachStatus, verlauf, offen] = await Promise.all([
    env.DB.prepare(
      `SELECT status, COUNT(*) AS anzahl FROM anfragen
        WHERE substr(erstellt_am, 1, 10) >= ? AND substr(erstellt_am, 1, 10) <= ?
        GROUP BY status`
    ).bind(seit, okBis).all(),
    env.DB.prepare(
      `SELECT substr(erstellt_am, 1, 10) AS tag, COUNT(*) AS anzahl FROM anfragen
        WHERE substr(erstellt_am, 1, 10) >= ? AND substr(erstellt_am, 1, 10) <= ?
        GROUP BY tag ORDER BY tag`
    ).bind(seit, okBis).all(),
    // Unbeantwortetes zaehlt unabhaengig vom Zeitraum: eine Anfrage von
    // letztem Monat ist heute genauso offen wie eine von gestern.
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM anfragen WHERE status IN ('neu', 'in_bearbeitung')`
    ).first()
  ]);

  const status = {};
  (nachStatus.results || []).forEach(z => { status[z.status] = z.anzahl; });
  const gesamt = Object.values(status).reduce((s, n) => s + n, 0);

  return {
    ok: true,
    gesamt,
    status,
    offen: offen?.n || 0,
    proTag: (verlauf.results || []).map(z => ({ tag: z.tag, anzahl: z.anzahl }))
  };
}

// Der aelteste Eintrag, den es ueberhaupt gibt – aus Anfragen und
// Instagram-Verlauf, je nachdem was frueher beginnt.
async function ersterTag(env, bis) {
  const rueckfall = new Date(bis.getTime() - MAX_TAGE * 86400000);
  if (!env.DB) return rueckfall;
  try {
    const z = await env.DB.prepare(
      `SELECT MIN(t) AS erste FROM (
         SELECT MIN(substr(erstellt_am, 1, 10)) AS t FROM anfragen
         UNION ALL
         SELECT MIN(substr(zeitpunkt, 1, 10)) AS t FROM studio_instagram
       ) WHERE t IS NOT NULL`
    ).first();
    if (!z || !z.erste) return rueckfall;
    // Auf den Tagesbeginn, sonst faengt die Zeitachse mitten am Tag an.
    const d = new Date(z.erste + 'T00:00:00Z');
    return isNaN(d) ? rueckfall : d;
  } catch {
    return rueckfall;
  }
}

// ─── Besucher aus Cloudflare Web Analytics ───

const ABFRAGE = `
query ($konto: String!, $hosts: [String!], $von: Time!, $bis: Time!) {
  viewer {
    accounts(filter: { accountTag: $konto }) {
      proTag: rumPageloadEventsAdaptiveGroups(
        limit: 200
        filter: { requestHost_in: $hosts, datetime_geq: $von, datetime_leq: $bis }
        orderBy: [date_ASC]
      ) { count sum { visits } dimensions { date } }
      proSeite: rumPageloadEventsAdaptiveGroups(
        limit: 15
        filter: { requestHost_in: $hosts, datetime_geq: $von, datetime_leq: $bis }
        orderBy: [count_DESC]
      ) { count dimensions { requestPath } }
      proHerkunft: rumPageloadEventsAdaptiveGroups(
        limit: 20
        filter: { requestHost_in: $hosts, datetime_geq: $von, datetime_leq: $bis }
        orderBy: [count_DESC]
      ) { count dimensions { refererHost } }
    }
  }
}`;

// Die eigene Domain taucht als Verweisquelle auf, sobald jemand INNERHALB der
// Seite weiterklickt. Unter "woher kommen die Besucher" hat das nichts zu
// suchen – es waere die groesste Zeile und wuerde die echten Quellen
// (Google, Instagram) optisch erschlagen.
const EIGENE = new Set([
  'ihsan-yilmaz.de',
  'www.ihsan-yilmaz.de',
  'ihsan-yilmaz.pages.dev'
]);

function herkunft(zeilen) {
  const raus = [];
  for (const z of zeilen) {
    const host = z.dimensions.refererHost || '';
    if (EIGENE.has(host)) continue;
    raus.push({ host: host || 'direkt', aufrufe: z.count });
  }
  return raus.slice(0, 8);
}

async function besucherZahlen(env, von, bis) {
  // Ohne Token gibt es keine Besucherzahlen – aber einen Hinweis, was fehlt
  // und wo er herkommt. Eine leere Kachel ohne Grund laesst einen ratlos
  // zurueck.
  // Beide Namen gelten. autohaus-diezmann fuehrt denselben Token unter
  // CF_ANALYTICS_TOKEN – wer die Benennung von dort uebernimmt, soll nicht
  // an einem Wort scheitern.
  const token = env.CF_API_TOKEN || env.CF_ANALYTICS_TOKEN;
  if (!token) {
    throw new Error('Es fehlt der Zugang zu den Besucherzahlen. Im Cloudflare-Dashboard '
      + 'unter „Mein Profil → API-Tokens“ einen Token mit der Berechtigung '
      + '„Account · Account Analytics · Read“ anlegen und im Pages-Projekt '
      + 'ihsan-yilmaz als CF_API_TOKEN hinterlegen. Derselbe Token deckt auch '
      + 'die Tageszahlen unter „API & Verbrauch“ ab.');
  }

  const a = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: ABFRAGE,
      variables: {
        konto: env.CF_ACCOUNT_ID || KONTO_VORGABE,
        hosts: HOSTS,
        von: von.toISOString(),
        bis: bis.toISOString()
      }
    })
  });

  const daten = await a.json();

  // GraphQL antwortet auch bei Fehlern mit HTTP 200 – der Statuscode allein
  // sagt hier nichts. Die Meldungen enthalten keine Geheimnisse (Feldnamen,
  // Rechtehinweise) und helfen beim Einrichten, deshalb gehen sie an den
  // angemeldeten Betreiber durch.
  if (daten.errors?.length) throw new Error(daten.errors.map(e => e.message).join(' | '));
  if (!a.ok) throw new Error(`HTTP ${a.status}`);

  const konto = daten.data?.viewer?.accounts?.[0];
  if (!konto) throw new Error('Kein Konto in der Antwort – stimmt die Konto-Kennung?');

  const proTag = (konto.proTag || []).map(z => ({
    tag: z.dimensions.date,
    aufrufe: z.count,
    besuche: z.sum?.visits ?? 0
  }));

  return {
    ok: true,
    // Kann spaeter beginnen als der gewaehlte Zeitraum – siehe MAX_TAGE.
    // Die Seite schreibt daraus einen Hinweis, sonst sieht der abgeschnittene
    // Anfang wie ein Einbruch aus.
    von: von.toISOString(),
    aufrufe: proTag.reduce((s, z) => s + z.aufrufe, 0),
    besuche: proTag.reduce((s, z) => s + z.besuche, 0),
    proTag,
    proSeite: (konto.proSeite || []).map(z => ({ pfad: z.dimensions.requestPath, aufrufe: z.count })),
    proHerkunft: herkunft(konto.proHerkunft || [])
  };
}

// ─── Instagram: der Follower-Verlauf ───

async function instagramVerlauf(env, von, bis) {
  if (!env.DB) throw new Error('Keine Datenbank verbunden.');

  const { results } = await env.DB.prepare(
    `SELECT substr(zeitpunkt, 1, 10) AS tag, MAX(follower) AS follower, MAX(beitraege) AS beitraege
       FROM studio_instagram
      WHERE substr(zeitpunkt, 1, 10) >= ? AND substr(zeitpunkt, 1, 10) <= ?
      GROUP BY tag ORDER BY tag`
  ).bind(tagText(von), tagText(bis)).all();

  const punkte = results || [];
  if (!punkte.length) return { ok: true, punkte: [], follower: null, zuwachs: null, beitraege: null };

  const erst = punkte[0];
  const letzt = punkte[punkte.length - 1];
  return {
    ok: true,
    punkte,
    follower: letzt.follower,
    beitraege: letzt.beitraege,
    // Zuwachs im Zeitraum, nicht seit Beginn – sonst waere die Zahl
    // unabhaengig vom gewaehlten Zeitraum immer dieselbe.
    zuwachs: letzt.follower - erst.follower
  };
}

// ─── Bildspeicher ───

async function speicherStand(env) {
  if (!env.DB) throw new Error('Keine Datenbank verbunden.');
  const z = await env.DB.prepare(
    'SELECT COUNT(*) AS bilder, COALESCE(SUM(groesse), 0) AS bytes FROM studio_bilder'
  ).first();
  return {
    ok: true,
    bilder: z?.bilder || 0,
    bytes: z?.bytes || 0,
    grenze: SPEICHER_GRENZE,
    anteil: Math.round(((z?.bytes || 0) / SPEICHER_GRENZE) * 1000) / 10
  };
}

// ─── Zeitraum ───

// Entweder ?tage=30 (Schnellauswahl) oder ?von=2026-07-01&bis=2026-07-30
// (freier Zeitraum). "bis" meint immer den ganzen Tag, sonst fehlt dem
// Betrachter unerklaerlicherweise der zuletzt gewaehlte Tag.
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

  const bis = new Date();

  // "Insgesamt": den Anfang kennt erst der Aufrufer, der in die Datenbank
  // schauen kann – hier steht nur die Marke.
  if (p.get('tage') === 'alles') return { von: null, bis, tage: null, alles: true };

  const tage = Math.min(MAX_TAGE, Math.max(1, Math.round(Number(p.get('tage')) || 30)));
  return { von: new Date(bis.getTime() - tage * 86400000), bis, tage };
}

// "2026-08-18" – der gemeinsame Nenner beider Zeitstempelformate.
const tagText = d => d.toISOString().slice(0, 10);

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
