// /api/admin/akquise/google-suche — Autohaeuser und Werkstaetten eines
// Kartenausschnitts bei Google Maps finden und mit der Liste zusammenfuehren.
//
// POST { bbox:[sued, west, nord, ost], typ:'car'|'car_repair', region }
//   → { ok, gefunden, neu, verknuepft, aktualisiert, voll, kontingent }
//
// Den Ausschnitt waehlt der Browser: Google liefert je Abfrage hoechstens 60
// Treffer (drei Seiten zu 20). Kommt "voll" zurueck, teilt der Browser das
// Feld in vier und fragt jedes einzeln – so wird auch die Innenstadt
// vollstaendig, ohne dass leere Landkreise viele Abfragen kosten.
//
// Jeder Treffer landet so in der Liste:
//   gleiche Place-ID schon da        → Google-Werte auffrischen
//   OSM-Betrieb in <300 m mit Namen  → verknuepfen (Place-ID, Website, Bewertung)
//   sonst                            → neuer Betrieb, Quelle "google"
// Dauerhaft geschlossene Betriebe fallen weg, endgueltig geloeschte
// (akquise_ausgeschlossen) auch.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { istBoersenSeite, kategorieOhnePruefung, istHaendler } from '../../../_lib/akquise.js';
import {
  textSuche, kontingent, fehlerMeldung, fehlerMerken, placeTrifft, adresseAus, websiteAusPlace, abstandM,
  adresseVoll, anschriftSetzen,
} from '../../../_lib/places.js';

const FELDER = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents', 'places.location',
  'places.websiteUri', 'places.rating', 'places.userRatingCount', 'places.businessStatus', 'places.nationalPhoneNumber',
  'nextPageToken',
].join(',');
const TYPEN = {
  car: { includedType: 'car_dealer', textQuery: 'Autohaus' },
  car_repair: { includedType: 'car_repair', textQuery: 'Kfz Werkstatt' },
};
const SEITEN = 3;
const NAH_M = 300;       // so weit darf ein OSM-Punkt vom Google-Eintrag weg sein
const RAND_GRAD = 0.004; // ~400 m Rand um das Feld fuer die Kandidatensuche
const BLOCK = 40;

function bboxLesen(roh) {
  if (!Array.isArray(roh) || roh.length !== 4) return null;
  const b = roh.map(n => (typeof n === 'number' ? Math.round(n * 1e5) / 1e5 : NaN));
  if (b.some(n => !Number.isFinite(n))) return null;
  if (b[0] < -90 || b[2] > 90 || b[1] < -180 || b[3] > 180 || b[0] >= b[2] || b[1] >= b[3]) return null;
  // Ein Feld groesser als ~2 Breitengrade waere ein Bedienfehler.
  if (b[2] - b[0] > 2 || b[3] - b[1] > 3) return null;
  return b;
}

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  if (!env.PLACES_KEY) return json({ ok: false, error: 'Google Places nicht eingerichtet: PLACES_KEY in Cloudflare hinterlegen.' });
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const bbox = bboxLesen(body?.bbox);
  if (!bbox) return json({ ok: false, error: 'Ungültiger Bereich.' }, 400);
  const typ = Object.hasOwn(TYPEN, body?.typ) ? body.typ : null;
  if (!typ) return json({ ok: false, error: 'Unbekannter Typ.' }, 400);
  const region = String(body?.region || '').trim().slice(0, 120) || null;

  // Bis zu drei Seiten holen. "voll" heisst: nach der dritten Seite gab es
  // noch mehr – dann muss der Browser das Feld teilen.
  const places = [];
  let voll = false;
  try {
    let token = null;
    for (let seite = 0; seite < SEITEN; seite++) {
      const anfrage = {
        textQuery: TYPEN[typ].textQuery,
        includedType: TYPEN[typ].includedType,
        strictTypeFiltering: true,
        languageCode: 'de',
        regionCode: 'DE',
        pageSize: 20,
        locationRestriction: { rectangle: { low: { latitude: bbox[0], longitude: bbox[1] }, high: { latitude: bbox[2], longitude: bbox[3] } } },
      };
      if (token) anfrage.pageToken = token;
      const daten = await textSuche(env, anfrage, FELDER);
      places.push(...(Array.isArray(daten?.places) ? daten.places : []));
      token = daten?.nextPageToken || null;
      if (!token) break;
      if (seite === SEITEN - 1) voll = true;
    }
  } catch (e) {
    const msg = fehlerMeldung(e);
    await fehlerMerken(env, 'google', `Flächensuche ${typ}`, msg);
    // Was bis zum Fehler kam, wird trotzdem verarbeitet.
    if (!places.length) return json({ ok: false, error: msg });
  }

  const offen = places.filter(p => p?.id && p.businessStatus !== 'CLOSED_PERMANENTLY'
    && Number.isFinite(p?.location?.latitude) && Number.isFinite(p?.location?.longitude));

  // Kandidaten in einem Zug laden: alles mit einer der Place-IDs, dazu alle
  // noch nicht verknuepften Betriebe im Feld (mit Rand).
  const ids = [...new Set(offen.map(p => String(p.id)))];
  const [mitId, imFeld, aus] = await env.DB.batch([
    ids.length
      // Zusammengefuehrte zuerst, aktive zuletzt – in der Map gewinnt der aktive.
      ? env.DB.prepare(`SELECT id, google_place_id, website, website_quelle FROM akquise_betriebe WHERE google_place_id IN (${ids.map(() => '?').join(',')}) ORDER BY (zusammengefuehrt_in IS NULL)`).bind(...ids)
      : env.DB.prepare('SELECT id, google_place_id, website, website_quelle FROM akquise_betriebe WHERE 0'),
    env.DB.prepare(`SELECT id, name, plz, ort, lat, lng, website, website_quelle FROM akquise_betriebe
      WHERE google_place_id IS NULL AND zusammengefuehrt_in IS NULL AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`)
      .bind(bbox[0] - RAND_GRAD, bbox[2] + RAND_GRAD, bbox[1] - RAND_GRAD, bbox[3] + RAND_GRAD),
    ids.length
      ? env.DB.prepare(`SELECT quelle_id FROM akquise_ausgeschlossen WHERE quelle = 'google' AND quelle_id IN (${ids.map(() => '?').join(',')})`).bind(...ids)
      : env.DB.prepare('SELECT quelle_id FROM akquise_ausgeschlossen WHERE 0'),
  ]);
  const nachId = new Map((mitId.results ?? []).map(r => [r.google_place_id, r]));
  const ausgeschlossen = new Set((aus.results ?? []).map(r => r.quelle_id));
  const kandidaten = imFeld.results ?? [];
  const vergeben = new Set();

  const stand = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const befehle = [];
  let neu = 0, verknuepft = 0, aktualisiert = 0;

  // Google-Website gilt, ausser der Nutzer hat selbst eine eingetragen oder
  // bestaetigt; eine Boersen-Adresse von Google ersetzt keine eigene Seite.
  const websiteFuer = (vorhanden, quelle, google) => {
    if (!google) return null;
    if (quelle === 'manuell' || quelle === 'bestaetigt') return null;
    if (istBoersenSeite(google) && vorhanden && !istBoersenSeite(vorhanden)) return null;
    return google;
  };

  // Bei Google dauerhaft geschlossen: bekannte Betriebe in den Papierkorb,
  // damit kein Brief mehr an eine tote Anschrift geht.
  let geschlossen = 0;
  for (const p of places) {
    if (p?.businessStatus !== 'CLOSED_PERMANENTLY') continue;
    const z = nachId.get(String(p.id));
    if (!z) continue;
    befehle.push(env.DB.prepare(
      `UPDATE akquise_betriebe SET geloescht = datetime('now'),
         notiz = TRIM(COALESCE(notiz || ' · ', '') || 'Bei Google dauerhaft geschlossen'), geaendert = datetime('now')
       WHERE id = ? AND geloescht IS NULL`,
    ).bind(z.id));
    geschlossen++;
  }

  for (const p of offen) {
    const lat = p.location.latitude, lng = p.location.longitude;
    const bewertung = Number.isFinite(Number(p.rating)) ? Number(p.rating) : null;
    const anzahl = Number.isInteger(Number(p.userRatingCount)) ? Number(p.userRatingCount) : null;
    const website = websiteAusPlace(p);

    const schon = nachId.get(String(p.id));
    // Endgueltig geloescht: weder neu anlegen noch mit OSM verknuepfen.
    if (!schon && ausgeschlossen.has(String(p.id))) continue;
    if (schon) {
      const w = websiteFuer(schon.website, schon.website_quelle, website);
      const an = anschriftSetzen(adresseVoll(p));
      befehle.push(env.DB.prepare(
        `UPDATE akquise_betriebe SET google_bewertung = ?, google_anzahl = ?, google_stand = ?,
           website = COALESCE(?, website), website_quelle = CASE WHEN ? IS NOT NULL THEN 'google' ELSE website_quelle END${an.sql},
           geaendert = datetime('now') WHERE id = ?`,
      ).bind(bewertung, anzahl, stand, w, w, ...an.werte, schon.id));
      aktualisiert++;
      continue;
    }

    // Naechster passender OSM-Betrieb: Name muss passen, Abstand unter 300 m.
    let best = null, bestAbstand = Infinity;
    for (const k of kandidaten) {
      if (vergeben.has(k.id) || k.lat == null || k.lng == null) continue;
      const d = abstandM(lat, lng, k.lat, k.lng);
      if (d < NAH_M && d < bestAbstand && placeTrifft(k, p)) { best = k; bestAbstand = d; }
    }
    if (best) {
      vergeben.add(best.id);
      const w = websiteFuer(best.website, best.website_quelle, website);
      const an = anschriftSetzen(adresseVoll(p));
      befehle.push(env.DB.prepare(
        `UPDATE akquise_betriebe SET google_place_id = ?, google_bewertung = ?, google_anzahl = ?, google_stand = ?,
           website = COALESCE(?, website), website_quelle = CASE WHEN ? IS NOT NULL THEN 'google' ELSE website_quelle END,
           kategorie = CASE WHEN ? IS NOT NULL AND website IS NULL THEN ? ELSE kategorie END${an.sql},
           geaendert = datetime('now') WHERE id = ?`,
      ).bind(String(p.id), bewertung, anzahl, stand, w, w, w, kategorieOhnePruefung(w), ...an.werte, best.id));
      verknuepft++;
      continue;
    }

    // Neu: nur bei Google bekannt – und nur Autohaeuser (siehe istHaendler).
    if (!istHaendler(p.displayName?.text, typ)) continue;
    const a = adresseAus(p);
    befehle.push(env.DB.prepare(
      `INSERT INTO akquise_betriebe
         (quelle, quelle_id, name, art, strasse, plz, ort, lat, lng, telefon, website, website_quelle, kategorie, region,
          google_place_id, google_bewertung, google_anzahl, google_stand)
       VALUES ('google', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(quelle, quelle_id) DO NOTHING`,
    ).bind(
      String(p.id), String(p.displayName?.text || 'Ohne Namen').slice(0, 200), typ,
      a.strasse, a.plz, a.ort, lat, lng, p.nationalPhoneNumber ? String(p.nationalPhoneNumber).slice(0, 60) : null,
      website, website ? 'google' : null, kategorieOhnePruefung(website), region,
      String(p.id), bewertung, anzahl, stand,
    ));
    neu++;
  }

  for (let i = 0; i < befehle.length; i += BLOCK) await env.DB.batch(befehle.slice(i, i + BLOCK));
  return json({ ok: true, gefunden: offen.length, neu, verknuepft, aktualisiert, geschlossen, voll, kontingent: await kontingent(env) });
});
