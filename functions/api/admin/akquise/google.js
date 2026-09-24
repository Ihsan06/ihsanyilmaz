// /api/admin/akquise/google — Betrieb bei Google Places (New) nachschlagen.
//
// GET        → { ok, eingerichtet }   (PLACES_KEY im Cloudflare-Dashboard)
// POST { id } → Text Search mit Name + Adresse, Umkreis 2 km um die
//               OSM-Koordinate. Ergebnis am Betrieb: google_place_id,
//               google_bewertung, google_anzahl, google_stand (Momentaufnahme
//               – Google erlaubt kein dauerhaftes Kopieren, nur die Place-ID).
//               websiteUri: Boerse/Social → als Website mit Kategorie
//               nur_boerse (keine Analyse); sonst Abruf und Verifikation
//               (Ort/PLZ/Telefon/Name im HTML) und normale Pruefung.
//               Nicht verifizierbar → trotzdem uebernehmen, Signal sagt es.
//               Kein Treffer → { ok:true, gefunden:false }; google_stand wird
//               trotzdem gesetzt, damit der Sammellauf nicht ewig wiederholt.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import {
  betriebPruefen, websiteAbrufen, websiteNormalisieren, websiteVerifizieren, istBoersenSeite, hostVon, hostErlaubt,
  nameWoerter, umlautfrei, betriebLaden, istMehrfach, letztePruefungLaden, pruefungSpeichern,
  pruefungNeuBewerten, pruefAntwort,
} from '../../../_lib/akquise.js';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FELDER = 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus';
const PLACES_TIMEOUT_MS = 10_000;
const VERIFIKATION_TIMEOUT_MS = 8_000;
const NICHT_EINGERICHTET = 'Google Places nicht eingerichtet: PLACES_KEY in Cloudflare hinterlegen.';

export const onRequestGet = nurAngemeldet(async ({ env }) => json({ ok: true, eingerichtet: !!env.PLACES_KEY }));

async function placesSuchen(env, betrieb) {
  const body = {
    textQuery: [betrieb.name, betrieb.strasse, betrieb.plz, betrieb.ort].filter(Boolean).join(' ').slice(0, 300),
    languageCode: 'de',
    regionCode: 'DE',
    maxResultCount: 1,
  };
  if (Number.isFinite(betrieb.lat) && Number.isFinite(betrieb.lng)) {
    body.locationBias = { circle: { center: { latitude: betrieb.lat, longitude: betrieb.lng }, radius: 2000 } };
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), PLACES_TIMEOUT_MS);
  try {
    const r = await fetch(PLACES_URL, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.PLACES_KEY, 'X-Goog-FieldMask': FELDER },
      body: JSON.stringify(body),
    });
    const daten = await r.json().catch(() => ({}));
    if (!r.ok) {
      // Der Schluessel darf nie in Antwort oder Datenbank landen – falls
      // Google ihn in einer Fehlermeldung zitiert, wird er ausgeblendet.
      const grund = String(daten?.error?.message || '').split(env.PLACES_KEY).join('[Schlüssel]').slice(0, 160);
      throw new Error(`Google Places: HTTP ${r.status}${grund ? ` – ${grund}` : ''}`);
    }
    return Array.isArray(daten?.places) ? daten.places[0] || null : null;
  } finally {
    clearTimeout(t);
  }
}

// Ist das wirklich unser Betrieb? Ein Wort des Namens (ohne Gattungswoerter
// wie "Autohaus") muss im Google-Namen stehen; hat der Name nur solche
// Woerter, muss wenigstens PLZ oder Ort in der Adresse stehen.
const GATTUNG = new Set(['autohaus', 'auto', 'autos', 'autoservice', 'autocenter', 'werkstatt', 'kfz', 'service', 'automobile', 'fahrzeuge', 'garage', 'meisterbetrieb', 'autohandel', 'automobil', 'zentrum', 'center']);
export function placeTrifft(betrieb, place) {
  const gName = umlautfrei(String(place?.displayName?.text || '').toLowerCase());
  const gAdresse = umlautfrei(String(place?.formattedAddress || '').toLowerCase());
  const woerter = nameWoerter(betrieb.name).filter(w => w.length >= 3 && !GATTUNG.has(w));
  if (woerter.length) return woerter.some(w => gName.includes(w));
  const plz = String(betrieb.plz || '');
  const ort = umlautfrei(String(betrieb.ort || '').toLowerCase());
  return (plz && gAdresse.includes(plz)) || (ort.length >= 3 && gAdresse.includes(ort));
}

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  if (!env.PLACES_KEY) return json({ ok: false, error: NICHT_EINGERICHTET });
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  const betrieb = await betriebLaden(env, id);
  if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);

  let place;
  try {
    place = await placesSuchen(env, betrieb);
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'Google Places: Zeitüberschreitung' : String(e?.message || e);
    return json({ ok: false, error: /^Google Places/.test(msg) ? msg : 'Google Places nicht erreichbar.' });
  }

  const stand = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (!place || !placeTrifft(betrieb, place)) {
    await env.DB.prepare("UPDATE akquise_betriebe SET google_stand = ?, geaendert = datetime('now') WHERE id = ?").bind(stand, id).run();
    return json({ ok: true, gefunden: false, google_stand: stand, geprueft_name: place?.displayName?.text || null });
  }

  const bewertung = Number.isFinite(Number(place.rating)) ? Number(place.rating) : null;
  const anzahl = Number.isInteger(Number(place.userRatingCount)) ? Number(place.userRatingCount) : null;
  const google = {
    google_place_id: String(place.id || '').slice(0, 300) || null,
    google_bewertung: bewertung,
    google_anzahl: anzahl,
    google_stand: stand,
  };
  Object.assign(betrieb, google);

  // Website von Google: uebernehmen, wenn noch keine da ist, die vorhandene
  // nur geraten war oder nur auf eine Boerse zeigt und Google eine eigene
  // kennt. Gleicher Host wie die geratene → bestaetigt. Adressen, die die
  // Function nicht abrufen duerfte (IP, localhost), werden gar nicht erst
  // gespeichert.
  let websiteGoogle = websiteNormalisieren(place.websiteUri);
  if (websiteGoogle && !hostErlaubt(websiteGoogle)) websiteGoogle = null;
  let websiteNeu = null;
  let quelleNeu = null;
  if (websiteGoogle) {
    if (!betrieb.website) { websiteNeu = websiteGoogle; quelleNeu = 'google'; }
    else if (betrieb.website_quelle === 'vermutet') {
      if (hostVon(betrieb.website) === hostVon(websiteGoogle)) quelleNeu = 'bestaetigt';
      else { websiteNeu = websiteGoogle; quelleNeu = 'google'; }
    } else if (istBoersenSeite(betrieb.website) && !istBoersenSeite(websiteGoogle)) {
      websiteNeu = websiteGoogle; quelleNeu = 'google';
    }
  }

  const felder = ['google_place_id = ?', 'google_bewertung = ?', 'google_anzahl = ?', 'google_stand = ?'];
  const werte = [google.google_place_id, google.google_bewertung, google.google_anzahl, google.google_stand];
  if (websiteNeu) { felder.push('website = ?'); werte.push(websiteNeu); betrieb.website = websiteNeu; }
  if (quelleNeu) { felder.push('website_quelle = ?'); werte.push(quelleNeu); betrieb.website_quelle = quelleNeu; }
  await env.DB.prepare(`UPDATE akquise_betriebe SET ${felder.join(', ')}, geaendert = datetime('now') WHERE id = ?`).bind(...werte, id).run();

  const mehrfach = await istMehrfach(env, betrieb);
  const extra = {
    gefunden: true,
    google: { ...google, name: place.displayName?.text || null, adresse: place.formattedAddress || null, website: websiteGoogle, status: place.businessStatus || null },
    website_uebernommen: !!websiteNeu,
  };

  // Neue Website (eigene Domain): Abruf mit Verifikation, dann normale
  // Pruefung mit diesem Abruf. Boerse: keine Analyse, Bewertung steht fest.
  if (websiteNeu) {
    let abruf = null;
    if (!istBoersenSeite(websiteNeu)) {
      try { abruf = await websiteAbrufen(websiteNeu, { timeoutMs: VERIFIKATION_TIMEOUT_MS }); } catch { abruf = null; }
      if (abruf?.erreichbar) extra.verifiziert = websiteVerifizieren(abruf.html, betrieb);
    }
    let ergebnis;
    try {
      ergebnis = await betriebPruefen(betrieb, { mehrfach, abruf });
    } catch (e) {
      return json({ ok: false, error: `Prüfung fehlgeschlagen: ${String(e?.message || e).slice(0, 200)}` });
    }
    const pruefung = await pruefungSpeichern(env, betrieb, ergebnis);
    return json(pruefAntwort(betrieb, ergebnis, pruefung, extra));
  }

  // Nur Zahlen: die letzte Pruefung mit den Google-Signalen neu rechnen.
  const letzte = await letztePruefungLaden(env, id);
  if (!letzte) return json({ ok: true, ...extra, website: betrieb.website ?? null, website_quelle: betrieb.website_quelle ?? null, kategorie: betrieb.kategorie ?? null });
  const ergebnis = await pruefungNeuBewerten(env, betrieb, letzte, {});
  return json(pruefAntwort(betrieb, ergebnis, ergebnis.pruefung, extra));
});
