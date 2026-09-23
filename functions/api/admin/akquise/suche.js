// POST /api/admin/akquise/suche — Autohaeuser und Werkstaetten in einer
// Region aus OpenStreetMap holen (shop=car, shop=car_repair) und in
// akquise_betriebe ablegen.
//
// Body: { region: 'wuerzburg' | 'unterfranken' | 'ort', ort?: string, radiusKm?: number }
// Antwort: { ok:true, gefunden, neu, region, bbox }
//
// Bestehende Betriebe (gleiche quelle_id) bekommen nur Adresse, Website und
// Telefon aufgefrischt – Status, Notiz und Scores bleiben, sonst waere die
// Arbeit des Nutzers nach jedem Suchlauf weg.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { websiteNormalisieren } from '../../../_lib/akquise.js';

const UA = 'AIY-Akquise/1.0 (kontakt@ihsan-yilmaz.de)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const BLOCK = 40;   // D1-Batch-Groesse

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

async function overpassHolen(query) {
  let letzter = null;
  for (const url of OVERPASS) {
    try {
      const r = await mitTimeout(100_000, signal => fetch(url, {
        method: 'POST', signal,
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      }));
      if (!r.ok) { letzter = new Error(`Overpass ${r.status}`); continue; }
      const d = await r.json();
      if (!Array.isArray(d?.elements)) { letzter = new Error('Overpass: keine Elemente'); continue; }
      return d.elements;
    } catch (e) {
      letzter = e?.name === 'AbortError' ? new Error('Overpass: Zeitüberschreitung') : e;
    }
  }
  throw letzter || new Error('Overpass nicht erreichbar');
}

const leerZuNull = s => { const t = String(s ?? '').trim(); return t ? t : null; };

// Fehler fuer die Antwort: nur, was wir selbst formuliert haben. Was die
// Runtime meldet ("internal error; reference = …") sagt dem Nutzer nichts
// und gehoert nicht nach aussen – es landet nur im Lauf-Protokoll.
function fehlerKurz(e) {
  if (e?.name === 'AbortError') return 'Zeitüberschreitung';
  const m = String(e?.message || '');
  return /^(?:Overpass|Nominatim)/.test(m) ? m : 'Dienst nicht erreichbar';
}

// OSM-Element → Zeile. Ohne Namen ist ein Eintrag fuer die Akquise wertlos.
function zeileAus(e) {
  const t = e.tags || {};
  const name = leerZuNull(t.name);
  if (!name) return null;
  const lat = Number(e.lat ?? e.center?.lat), lng = Number(e.lon ?? e.center?.lon);
  return {
    quelle_id: `${e.type}/${e.id}`,
    name,
    art: leerZuNull(t.shop),
    // Nur "brand" – official_name ist der Firmenname, keine Marke, und wuerde
    // sonst faelschlich als Vertragshaendler zaehlen.
    marken: leerZuNull(t.brand),
    strasse: leerZuNull([t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ')),
    plz: leerZuNull(t['addr:postcode']),
    ort: leerZuNull(t['addr:city']),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    telefon: leerZuNull(t['contact:phone'] || t.phone),
    email: leerZuNull(t['contact:email'] || t.email),
    website: websiteNormalisieren(t['contact:website'] || t.website),
    oeffnungszeiten: leerZuNull(t.opening_hours),
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

const UPSERT = `INSERT INTO akquise_betriebe
  (quelle, quelle_id, name, art, marken, strasse, plz, ort, lat, lng, telefon, email, website, oeffnungszeiten, region)
  VALUES ('osm', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(quelle, quelle_id) DO UPDATE SET
    strasse = COALESCE(excluded.strasse, strasse),
    plz = COALESCE(excluded.plz, plz),
    ort = COALESCE(excluded.ort, ort),
    lat = COALESCE(excluded.lat, lat),
    lng = COALESCE(excluded.lng, lng),
    telefon = COALESCE(excluded.telefon, telefon),
    website = COALESCE(excluded.website, website),
    geaendert = datetime('now')`;

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const region = String(body?.region || '');

  let bbox, regionName, parameter;
  // hasOwn statt PRESETS[region]: "constructor" wuerde sonst als Region gelten.
  if (Object.hasOwn(PRESETS, region)) {
    bbox = PRESETS[region].bbox;
    regionName = PRESETS[region].name;
    parameter = { region };
  } else if (region === 'ort') {
    const ort = String(body?.ort || '').trim().slice(0, 120);
    if (!ort) return json({ ok: false, error: 'Ort fehlt.' }, 400);
    let radius = Number(body?.radiusKm);
    if (!Number.isFinite(radius) || radius <= 0) radius = 25;
    radius = Math.min(80, Math.max(1, radius));
    let treffer;
    try { treffer = await ortSuchen(ort); } catch (e) { return json({ ok: false, error: `Ortssuche fehlgeschlagen: ${fehlerKurz(e)}` }); }
    if (!treffer) return json({ ok: false, error: 'Ort nicht gefunden.' }, 404);
    bbox = bboxUm(treffer.lat, treffer.lng, radius);
    regionName = `${treffer.name} ${radius} km`;
    parameter = { region, ort, radiusKm: radius, mittelpunkt: [treffer.lat, treffer.lng] };
  } else {
    return json({ ok: false, error: 'Unbekannte Region.' }, 400);
  }
  bbox = bbox.map(n => Math.round(Number(n) * 1e4) / 1e4);
  if (bbox.some(n => !Number.isFinite(n))) return json({ ok: false, error: 'Ungültiger Bereich.' }, 400);

  const lauf = async (gefunden, neu, fehler) => {
    await env.DB.prepare(
      'INSERT INTO akquise_laeufe (art, region, parameter, gefunden, neu, fehler) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind('suche', regionName, JSON.stringify({ ...parameter, bbox }), gefunden, neu, fehler).run().catch(() => {});
  };

  let elemente;
  try {
    elemente = await overpassHolen(overpassQuery(bbox));
  } catch (e) {
    await lauf(null, null, String(e.message || e).slice(0, 300));
    return json({ ok: false, error: `Suche fehlgeschlagen: ${fehlerKurz(e)}` });
  }

  const zeilen = doppelteEntfernen(elemente.map(zeileAus).filter(Boolean));

  try {
    // Welche gibt es schon? Nur die ID-Spalte, das bleibt klein.
    const { results } = await env.DB.prepare("SELECT quelle_id FROM akquise_betriebe WHERE quelle = 'osm'").all();
    const bekannt = new Set((results ?? []).map(r => r.quelle_id));
    const neu = zeilen.filter(z => !bekannt.has(z.quelle_id)).length;

    const st = env.DB.prepare(UPSERT);
    for (let i = 0; i < zeilen.length; i += BLOCK) {
      await env.DB.batch(zeilen.slice(i, i + BLOCK).map(z => st.bind(
        z.quelle_id, z.name, z.art, z.marken, z.strasse, z.plz, z.ort, z.lat, z.lng,
        z.telefon, z.email, z.website, z.oeffnungszeiten, regionName,
      )));
    }
    await lauf(zeilen.length, neu, null);
    return json({ ok: true, gefunden: zeilen.length, neu, region: regionName, bbox });
  } catch (e) {
    await lauf(zeilen.length, null, String(e.message || e).slice(0, 300));
    return json({ ok: false, error: 'Speichern fehlgeschlagen.' });
  }
});
