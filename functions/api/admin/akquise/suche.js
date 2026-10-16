// /api/admin/akquise/suche — Autohaeuser und Werkstaetten aus OpenStreetMap
// (shop=car, shop=car_repair) in akquise_betriebe ablegen.
//
// Overpass ruft seit Runde 2 der BROWSER: die Antwort ist gross und der
// Dienst braucht oft 30–90 s – beides passt nicht in eine Function mit
// wenig CPU. Die Function liefert nur Bereich und Query und nimmt die
// Elemente entgegen.
//
// GET  ?region=wuerzburg|unterfranken|ort&ort=&radiusKm=
//   → { ok, region, bbox, query }   (Nominatim weiter serverseitig)
// POST { region, bbox, elements }   (Body hoechstens 5 MB, 5000 Elemente)
//   → { ok, gefunden, neu, region, bbox }
//
// Bestehende Betriebe (gleiche quelle_id) bekommen nur Adresse, Website und
// Telefon aufgefrischt – Status, Notiz, Auswahl und Scores bleiben, sonst
// waere die Arbeit des Nutzers nach jedem Suchlauf weg. Endgueltig geloeschte
// (akquise_ausgeschlossen) kommen nicht wieder.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { websiteNormalisieren, kategorieOhnePruefung, istHaendler } from '../../../_lib/akquise.js';

const UA = 'AIY-Akquise/1.0 (kontakt@ihsan-yilmaz.de)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const BLOCK = 40;                       // D1-Batch-Groesse
const MAX_BODY = 5 * 1024 * 1024;
const MAX_ELEMENTE = 5000;

// Presets: Wuerzburg = 25 km um den Dom, Unterfranken = grobe Huelle des
// Regierungsbezirks. Reihenfolge wie bei Overpass: sued, west, nord, ost.
const PRESETS = {
  wuerzburg: { bbox: [49.566, 9.605, 50.016, 10.301], name: 'Würzburg 25 km' },
  unterfranken: { bbox: [49.48, 8.97, 50.57, 10.88], name: 'Unterfranken' },
};

async function mitTimeout(ms, fn) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fn(ac.signal); } finally { clearTimeout(t); }
}

// Ort → Mittelpunkt ueber Nominatim, dann ein Kasten mit radiusKm Halbkante.
async function ortSuchen(ort) {
  const url = `${NOMINATIM}?q=${encodeURIComponent(ort)}&format=json&limit=1&countrycodes=de`;
  const r = await mitTimeout(15_000, signal => fetch(url, { signal, headers: { 'User-Agent': UA, 'Accept': 'application/json' } }));
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const liste = await r.json();
  const treffer = Array.isArray(liste) ? liste[0] : null;
  const lat = Number(treffer?.lat), lng = Number(treffer?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name: String(treffer.display_name || ort).split(',')[0].trim() };
}

function bboxUm(lat, lng, radiusKm) {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}

// Die bbox geht als Zahlen in die Query – nie als String aus dem Request.
function overpassQuery(bbox) {
  const b = bbox.map(n => Number(n).toFixed(4)).join(',');
  return `[out:json][timeout:90];
(
  node["shop"="car"](${b});
  way["shop"="car"](${b});
  node["shop"="car_repair"](${b});
  way["shop"="car_repair"](${b});
);
out center tags;`;
}

const leerZuNull = s => { const t = String(s ?? '').trim(); return t ? t : null; };

function fehlerKurz(e) {
  if (e?.name === 'AbortError') return 'Zeitüberschreitung';
  const m = String(e?.message || '');
  return /^Nominatim/.test(m) ? m : 'Dienst nicht erreichbar';
}

// bbox aus dem Request: genau vier endliche Zahlen in plausiblem Bereich.
function bboxLesen(roh) {
  if (!Array.isArray(roh) || roh.length !== 4) return null;
  const b = roh.map(n => (typeof n === 'number' ? Math.round(n * 1e4) / 1e4 : NaN));
  if (b.some(n => !Number.isFinite(n))) return null;
  if (b[0] < -90 || b[2] > 90 || b[1] < -180 || b[3] > 180 || b[0] >= b[2] || b[1] >= b[3]) return null;
  return b;
}

// Ein Overpass-Element streng lesen: Typ, numerische ID, Tags als Strings,
// Koordinaten als Zahlen. Alles andere wird verworfen – der Body kommt
// zwar vom eigenen Browser, aber die Function traut keinem Body.
function zeileAus(e) {
  if (!e || typeof e !== 'object') return null;
  if (!['node', 'way', 'relation'].includes(e.type)) return null;
  if (typeof e.id !== 'number' || !Number.isInteger(e.id) || e.id <= 0) return null;
  const t = e.tags && typeof e.tags === 'object' ? e.tags : {};
  const tag = k => (typeof t[k] === 'string' ? t[k].slice(0, 300) : null);
  const name = leerZuNull(tag('name'));
  if (!name) return null;
  const lat = typeof e.lat === 'number' ? e.lat : (typeof e.center?.lat === 'number' ? e.center.lat : NaN);
  const lng = typeof e.lon === 'number' ? e.lon : (typeof e.center?.lon === 'number' ? e.center.lon : NaN);
  const website = websiteNormalisieren(tag('contact:website') || tag('website'));
  return {
    quelle_id: `${e.type}/${e.id}`,
    name: name.slice(0, 200),
    art: leerZuNull(tag('shop')),
    // Nur "brand" – official_name ist der Firmenname, keine Marke, und wuerde
    // sonst faelschlich als Vertragshaendler zaehlen.
    marken: leerZuNull(tag('brand')),
    strasse: leerZuNull([tag('addr:street'), tag('addr:housenumber')].filter(Boolean).join(' ')),
    plz: leerZuNull(tag('addr:postcode')),
    ort: leerZuNull(tag('addr:city')),
    lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
    lng: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
    telefon: leerZuNull(tag('contact:phone') || tag('phone')),
    email: leerZuNull(tag('contact:email') || tag('email')),
    website,
    website_quelle: website ? 'osm' : null,
    kategorie: kategorieOhnePruefung(website),
    oeffnungszeiten: leerZuNull(tag('opening_hours')),
  };
}

// Node und Way fuer denselben Betrieb (gleicher Name + PLZ) → einer reicht,
// bevorzugt der mit Website.
function doppelteEntfernen(zeilen) {
  const nachSchluessel = new Map();
  for (const z of zeilen) {
    const k = `${z.name.toLowerCase()}|${z.plz || ''}`;
    const alt = nachSchluessel.get(k);
    if (!alt || (!alt.website && z.website)) nachSchluessel.set(k, z);
  }
  return [...nachSchluessel.values()];
}

// Beim Auffrischen bleibt eine vorhandene Website stehen (auch geratene und
// bestaetigte); nur wo noch keine ist, kommt die aus OSM samt Quelle und
// Kategorie herein.
const UPSERT = `INSERT INTO akquise_betriebe
  (quelle, quelle_id, name, art, marken, strasse, plz, ort, lat, lng, telefon, email, website, website_quelle, kategorie, oeffnungszeiten, region)
  VALUES ('osm', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(quelle, quelle_id) DO UPDATE SET
    strasse = COALESCE(excluded.strasse, strasse),
    plz = COALESCE(excluded.plz, plz),
    ort = COALESCE(excluded.ort, ort),
    lat = COALESCE(excluded.lat, lat),
    lng = COALESCE(excluded.lng, lng),
    telefon = COALESCE(excluded.telefon, telefon),
    website_quelle = CASE WHEN website IS NULL AND excluded.website IS NOT NULL THEN 'osm' ELSE website_quelle END,
    kategorie = CASE WHEN website IS NULL AND excluded.website IS NOT NULL THEN excluded.kategorie ELSE kategorie END,
    website = COALESCE(website, excluded.website),
    geaendert = datetime('now')`;

// Region aus den Parametern aufloesen – gemeinsam fuer GET und POST.
async function regionAufloesen(region, ortRoh, radiusRoh) {
  // hasOwn statt PRESETS[region]: "constructor" wuerde sonst als Region gelten.
  if (Object.hasOwn(PRESETS, region)) {
    return { bbox: PRESETS[region].bbox, regionName: PRESETS[region].name, parameter: { region } };
  }
  if (region !== 'ort') return { fehler: json({ ok: false, error: 'Unbekannte Region.' }, 400) };
  const ort = String(ortRoh || '').trim().slice(0, 120);
  if (!ort) return { fehler: json({ ok: false, error: 'Ort fehlt.' }, 400) };
  let radius = Number(radiusRoh);
  if (!Number.isFinite(radius) || radius <= 0) radius = 25;
  radius = Math.min(80, Math.max(1, radius));
  let treffer;
  try { treffer = await ortSuchen(ort); } catch (e) { return { fehler: json({ ok: false, error: `Ortssuche fehlgeschlagen: ${fehlerKurz(e)}` }) }; }
  if (!treffer) return { fehler: json({ ok: false, error: 'Ort nicht gefunden.' }, 404) };
  return {
    bbox: bboxUm(treffer.lat, treffer.lng, radius),
    regionName: `${treffer.name} ${radius} km`,
    parameter: { region, ort, radiusKm: radius, mittelpunkt: [treffer.lat, treffer.lng] },
  };
}

export const onRequestGet = nurAngemeldet(async ({ request }) => {
  const q = new URL(request.url).searchParams;
  const r = await regionAufloesen(String(q.get('region') || ''), q.get('ort'), q.get('radiusKm'));
  if (r.fehler) return r.fehler;
  const bbox = bboxLesen(r.bbox.map(n => Number(n)));
  if (!bbox) return json({ ok: false, error: 'Ungültiger Bereich.' }, 400);
  return json({ ok: true, region: r.regionName, bbox, query: overpassQuery(bbox), parameter: r.parameter });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  const laenge = Number(request.headers.get('content-length'));
  if (Number.isFinite(laenge) && laenge > MAX_BODY) return json({ ok: false, error: 'Zu viele Daten (mehr als 5 MB).' }, 413);
  let text;
  try { text = await request.text(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  if (text.length > MAX_BODY) return json({ ok: false, error: 'Zu viele Daten (mehr als 5 MB).' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }

  const regionName = String(body?.region || '').trim().slice(0, 120);
  if (!regionName) return json({ ok: false, error: 'Region fehlt.' }, 400);
  const bbox = bboxLesen(body?.bbox);
  if (!bbox) return json({ ok: false, error: 'Ungültiger Bereich.' }, 400);
  const elements = body?.elements;
  if (!Array.isArray(elements)) return json({ ok: false, error: 'Elemente fehlen.' }, 400);
  if (elements.length > MAX_ELEMENTE) return json({ ok: false, error: `Zu viele Elemente (mehr als ${MAX_ELEMENTE}).` }, 413);

  const lauf = async (gefunden, neu, fehler) => {
    await env.DB.prepare(
      'INSERT INTO akquise_laeufe (art, region, parameter, gefunden, neu, fehler) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind('suche', regionName, JSON.stringify({ bbox, elemente: elements.length }), gefunden, neu, fehler).run().catch(() => {});
  };

  // Nur Autohaeuser – Werkstaetten nur, wenn der Name nach Haendler klingt.
  const zeilen = doppelteEntfernen(elements.map(zeileAus).filter(z => z && istHaendler(z.name, z.art)));

  try {
    // Welche gibt es schon, welche sind endgueltig geloescht? Nur die
    // ID-Spalten, das bleibt klein.
    const [da, aus] = await env.DB.batch([
      env.DB.prepare("SELECT quelle_id FROM akquise_betriebe WHERE quelle = 'osm'"),
      env.DB.prepare("SELECT quelle_id FROM akquise_ausgeschlossen WHERE quelle = 'osm'"),
    ]);
    const bekannt = new Set((da.results ?? []).map(r => r.quelle_id));
    const ausgeschlossen = new Set((aus.results ?? []).map(r => r.quelle_id));
    const rein = zeilen.filter(z => !ausgeschlossen.has(z.quelle_id));
    const neu = rein.filter(z => !bekannt.has(z.quelle_id)).length;

    const st = env.DB.prepare(UPSERT);
    for (let i = 0; i < rein.length; i += BLOCK) {
      await env.DB.batch(rein.slice(i, i + BLOCK).map(z => st.bind(
        z.quelle_id, z.name, z.art, z.marken, z.strasse, z.plz, z.ort, z.lat, z.lng,
        z.telefon, z.email, z.website, z.website_quelle, z.kategorie, z.oeffnungszeiten, regionName,
      )));
    }
    await lauf(zeilen.length, neu, null);
    return json({ ok: true, gefunden: zeilen.length, neu, region: regionName, bbox });
  } catch (e) {
    await lauf(zeilen.length, null, String(e.message || e).slice(0, 300));
    return json({ ok: false, error: 'Speichern fehlgeschlagen.' });
  }
});
