// /api/admin/akquise/google — Betrieb bei Google Places (New) nachschlagen.
//
// GET        → { ok, eingerichtet }   (PLACES_KEY im Cloudflare-Dashboard)
// POST { id } → Text Search mit Name + Adresse, Umkreis 2 km um die
//               OSM-Koordinate. Ergebnis am Betrieb: google_place_id,
//               google_bewertung, google_anzahl, google_stand (Momentaufnahme
//               – Google erlaubt kein dauerhaftes Kopieren, nur die Place-ID).
//               websiteUri: Boerse/Social → als Website mit Kategorie
//               nur_boerse (keine Analyse); sonst uebernehmen und normal
//               pruefen. Keine eigene Verifikation mehr: Google kennt die
//               Website aus dem Unternehmensprofil, das der Betrieb selbst
//               pflegt – der Abgleich mit dem HTML hat nur Fehlalarme erzeugt.
//               Nur eine von Hand eingetragene Website bleibt stehen.
//               Kein Treffer → { ok:true, gefunden:false }; google_stand wird
//               trotzdem gesetzt, damit der Sammellauf nicht ewig wiederholt.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import {
  betriebPruefen, websiteNormalisieren, istBoersenSeite, hostVon, hostErlaubt,
  nameWoerter, umlautfrei, betriebLaden, istMehrfach, letztePruefungLaden, pruefungSpeichern,
  pruefungNeuBewerten, pruefAntwort,
} from '../../../_lib/akquise.js';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FELDER = 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus';
const PLACES_TIMEOUT_MS = 10_000;
const NICHT_EINGERICHTET = 'Google Places nicht eingerichtet: PLACES_KEY in Cloudflare hinterlegen.';

// GET ?test=1 macht eine echte Abfrage mit einem festen Betrieb. Ohne das
// sah man nur "eingerichtet", obwohl Google jede Anfrage abwies – der erste
// Lauf in Produktion lief so komplett ins Leere, ohne dass der Grund irgendwo
// stand.
const TEST_BETRIEB = { name: 'Autohaus', plz: '97070', ort: 'Würzburg', lat: 49.7913, lng: 9.9534 };

export const onRequestGet = nurAngemeldet(async ({ request, env }) => {
  const eingerichtet = !!env.PLACES_KEY;
  if (!eingerichtet || new URL(request.url).searchParams.get('test') !== '1') return json({ ok: true, eingerichtet });
  try {
    const place = await placesSuchen(env, TEST_BETRIEB);
    return json({ ok: true, eingerichtet, test: { ok: true, name: place?.displayName?.text || null, website: place?.websiteUri || null } });
  } catch (e) {
    const msg = fehlerMeldung(e);
    await fehlerMerken(env, 'Verbindungstest', msg);
    return json({ ok: true, eingerichtet, test: { ok: false, fehler: msg } });
  }
});

// Googles Fehler in Klartext: Grund (error.details[].reason bzw. error.status)
// auf das, was im Google-Projekt zu tun ist. Der Rohtext bleibt dahinter
// stehen, damit auch Unbekanntes lesbar ist.
function klartext(status, fehler) {
  const gruende = [fehler?.status, ...(Array.isArray(fehler?.details) ? fehler.details.map(d => d?.reason) : [])]
    .filter(Boolean).join(' ');
  const text = `${gruende} ${fehler?.message || ''}`;
  if (/API_KEY_INVALID|API key not valid/i.test(text)) return 'Schlüssel ungültig – in Cloudflare den aktuellen Schlüssel als PLACES_KEY eintragen';
  if (/API_KEY_SERVICE_BLOCKED|are blocked/i.test(text)) return 'Schlüssel ist für die Places API (New) gesperrt – bei der API-Einschränkung „Places API (New)“ anhaken';
  if (/SERVICE_DISABLED|has not been used|is disabled/i.test(text)) return 'Places API (New) ist im Google-Projekt nicht aktiviert';
  if (/BILLING|billing/i.test(text)) return 'Abrechnung im Google-Projekt nicht aktiviert – Rechnungskonto verknüpfen';
  if (/API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|referer|referrer|IP address/i.test(text)) return 'Schlüssel ist auf Websites oder IP-Adressen beschränkt – nur die API-Einschränkung verwenden';
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(text)) return 'Kontingent erschöpft oder zu viele Anfragen – später erneut';
  return '';
}

function fehlerMeldung(e) {
  const msg = e?.name === 'AbortError' ? 'Google Places: Zeitüberschreitung' : String(e?.message || e);
  return /^Google Places/.test(msg) ? msg : 'Google Places nicht erreichbar.';
}

// Fehler landen zusaetzlich im Laufprotokoll – so ist der Grund auch nach
// dem Schliessen der Seite noch nachzulesen.
async function fehlerMerken(env, parameter, msg) {
  try {
    await env.DB.prepare('INSERT INTO akquise_laeufe (art, region, parameter, gefunden, neu, fehler) VALUES (?, ?, ?, ?, ?, ?)')
      .bind('google', null, String(parameter).slice(0, 200), 0, 0, String(msg).slice(0, 300)).run();
  } catch { /* Protokoll ist Beiwerk */ }
}

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
      const roh = String(daten?.error?.message || '').split(env.PLACES_KEY).join('[Schlüssel]').slice(0, 160);
      const klar = klartext(r.status, daten?.error);
      throw new Error(`Google Places: ${klar || `HTTP ${r.status}`}${roh ? ` (${roh})` : ''}`);
    }
    return Array.isArray(daten?.places) ? daten.places[0] || null : null;
  } finally {
    clearTimeout(t);
  }
}

// Ist das wirklich unser Betrieb? Ein unterscheidendes Wort des Namens (nicht
// "Autohaus", "Kfz" …) muss im Google-Namen stehen; nur wenn der Name gar
// keins hat, reicht PLZ oder Ort in der Adresse.
// Kurze Woerter ("NU", "3R", "1a") und Kuerzel mit Punkten ("A.M.T." → amt)
// zaehlen mit, muessen aber als ganzes Wort stehen – "nu" steckt sonst in
// "Neumann". Ohne sie fiel "3R-Kfz Werkstatt" auf die PLZ zurueck und bekam
// den Eintrag des Nachbarbetriebs.
const GATTUNG = new Set(['autohaus', 'auto', 'autos', 'autoservice', 'autocenter', 'werkstatt', 'kfz', 'service', 'automobile', 'fahrzeuge', 'garage', 'meisterbetrieb', 'autohandel', 'automobil', 'zentrum', 'center']);
export function kennwoerter(name) {
  const klein = umlautfrei(String(name || '').toLowerCase());
  const kuerzel = (klein.match(/\b(?:[a-z]\.){2,}[a-z]?\.?/g) || []).map(k => k.replace(/\./g, ''));
  return [...new Set([...nameWoerter(name), ...kuerzel])].filter(w => w.length >= 2 && !GATTUNG.has(w));
}
const wortIn = (wort, text) => (wort.length <= 3
  ? new RegExp(`(^|[^a-z0-9])${wort}([^a-z0-9]|$)`).test(text) || text.replace(/[^a-z0-9]/g, '').startsWith(wort) && wort.length === 3
  : text.includes(wort));
export function placeTrifft(betrieb, place) {
  const gName = umlautfrei(String(place?.displayName?.text || '').toLowerCase());
  const gAdresse = umlautfrei(String(place?.formattedAddress || '').toLowerCase());
  const woerter = kennwoerter(betrieb.name);
  if (woerter.length) return woerter.some(w => wortIn(w, gName));
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
    const msg = fehlerMeldung(e);
    await fehlerMerken(env, `Betrieb ${id}`, msg);
    return json({ ok: false, error: msg });
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

  // Website von Google gilt: sie ersetzt eine geratene, eine aus OSM (die
  // ist oft veraltet) und eine Boersen-Seite, wenn Google eine eigene kennt.
  // Stehen bleibt nur, was der Nutzer selbst eingetragen oder bestaetigt hat.
  // Adressen, die die Function nicht abrufen duerfte (IP, localhost), werden
  // gar nicht erst gespeichert.
  let websiteGoogle = websiteNormalisieren(place.websiteUri);
  if (websiteGoogle && !hostErlaubt(websiteGoogle)) websiteGoogle = null;
  let websiteNeu = null;
  let quelleNeu = null;
  const vomNutzer = betrieb.website_quelle === 'manuell' || betrieb.website_quelle === 'bestaetigt';
  if (websiteGoogle && !vomNutzer && !(istBoersenSeite(websiteGoogle) && betrieb.website && !istBoersenSeite(betrieb.website))) {
    if (betrieb.website && hostVon(betrieb.website) === hostVon(websiteGoogle)) quelleNeu = 'google';
    else { websiteNeu = websiteGoogle; quelleNeu = 'google'; }
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

  // Neue Website: normal pruefen. Boerse: keine Analyse, Bewertung steht fest.
  if (websiteNeu) {
    let ergebnis;
    try {
      ergebnis = await betriebPruefen(betrieb, { mehrfach });
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
