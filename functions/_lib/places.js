// Google Places (New) fuer die Akquise: Text Search, Monatszaehler und
// Fehler im Klartext – gemeinsam fuer die Einzelabfrage (google.js), die
// Flaechensuche (google-suche.js) und die Dubletten.
//
// Kosten: Abfragen mit websiteUri, rating und userRatingCount laufen als
// "Text Search Enterprise". Davon sind 1.000 je Monat frei, danach kostet es.
// Der Zaehler haelt die Akquise unter einer Grenze (Standard 950), damit ein
// Suchlauf ueber ganz Unterfranken nicht unbemerkt in die Kosten laeuft.
import { nameWoerter, umlautfrei, websiteNormalisieren, hostErlaubt } from './akquise.js';

export const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
export const GRATIS_IM_MONAT = 1000;
const GRENZE_STANDARD = 950;
const TIMEOUT_MS = 12_000;

const monat = () => new Date().toISOString().slice(0, 7);
const zaehlerSchluessel = () => `akquise.google.${monat()}`;

export async function kontingent(env) {
  const [z, g] = await env.DB.batch([
    env.DB.prepare('SELECT wert FROM einstellungen WHERE schluessel = ?').bind(zaehlerSchluessel()),
    env.DB.prepare("SELECT wert FROM einstellungen WHERE schluessel = 'akquise.google_grenze'"),
  ]);
  const genutzt = Number(z.results?.[0]?.wert) || 0;
  const grenzeRoh = Number(g.results?.[0]?.wert);
  const grenze = Number.isInteger(grenzeRoh) && grenzeRoh > 0 ? grenzeRoh : GRENZE_STANDARD;
  return { monat: monat(), genutzt, grenze, frei: GRATIS_IM_MONAT };
}

async function zaehlen(env, anzahl) {
  if (!anzahl) return;
  await env.DB.prepare(
    `INSERT INTO einstellungen (schluessel, wert, geaendert) VALUES (?, ?, datetime('now'))
     ON CONFLICT(schluessel) DO UPDATE SET wert = CAST(wert AS INTEGER) + ?, geaendert = datetime('now')`,
  ).bind(zaehlerSchluessel(), String(anzahl), anzahl).run();
}

// Googles Fehler in Klartext: Grund (error.details[].reason bzw. error.status)
// auf das, was im Google-Projekt zu tun ist.
export function klartext(status, fehler, api = 'Places API (New)') {
  const gruende = [fehler?.status, ...(Array.isArray(fehler?.details) ? fehler.details.map(d => d?.reason) : [])]
    .filter(Boolean).join(' ');
  const text = `${gruende} ${fehler?.message || ''}`;
  if (/API_KEY_INVALID|API key not valid/i.test(text)) return 'Schlüssel ungültig – in Cloudflare den aktuellen Schlüssel als PLACES_KEY eintragen';
  if (/API_KEY_SERVICE_BLOCKED|are blocked/i.test(text)) return `Schlüssel ist für die ${api} gesperrt – bei der API-Einschränkung „${api}“ anhaken`;
  if (/SERVICE_DISABLED|has not been used|is disabled/i.test(text)) return `${api} ist im Google-Projekt nicht aktiviert`;
  if (/BILLING|billing/i.test(text)) return 'Abrechnung im Google-Projekt nicht aktiviert – Rechnungskonto verknüpfen';
  if (/API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|referer|referrer|IP address/i.test(text)) return 'Schlüssel ist auf Websites oder IP-Adressen beschränkt – nur die API-Einschränkung verwenden';
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(text)) return 'Kontingent erschöpft oder zu viele Anfragen – später erneut';
  return '';
}

export function fehlerMeldung(e, vorsatz = 'Google Places') {
  const msg = e?.name === 'AbortError' ? `${vorsatz}: Zeitüberschreitung` : String(e?.message || e);
  return msg.startsWith(vorsatz) ? msg : `${vorsatz} nicht erreichbar.`;
}

// Fehler landen im Laufprotokoll – so ist der Grund auch nach dem Schliessen
// der Seite noch nachzulesen.
export async function fehlerMerken(env, art, parameter, msg) {
  try {
    await env.DB.prepare('INSERT INTO akquise_laeufe (art, region, parameter, gefunden, neu, fehler) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(art, null, String(parameter).slice(0, 200), 0, 0, String(msg).slice(0, 300)).run();
  } catch { /* Protokoll ist Beiwerk */ }
}

// Eine Text-Search-Abfrage. Prueft vorher die Monatsgrenze, zaehlt danach.
// Wirft Error('Google Places: …') mit Klartext; der Schluessel steht nie in
// der Meldung.
export async function textSuche(env, body, feldmaske) {
  const k = await kontingent(env);
  if (k.genutzt >= k.grenze) {
    throw new Error(`Google Places: Monatsgrenze erreicht (${k.genutzt} von ${k.grenze} Abfragen) – weiter ab dem 1. des nächsten Monats`);
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(PLACES_URL, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.PLACES_KEY, 'X-Goog-FieldMask': feldmaske },
      body: JSON.stringify(body),
    });
    const daten = await r.json().catch(() => ({}));
    // Abgelehnte Anfragen (Schluessel, API aus) berechnet Google nicht.
    if (r.ok) await zaehlen(env, 1);
    if (!r.ok) {
      const roh = String(daten?.error?.message || '').split(env.PLACES_KEY).join('[Schlüssel]').slice(0, 160);
      const klar = klartext(r.status, daten?.error);
      throw new Error(`Google Places: ${klar || `HTTP ${r.status}`}${roh ? ` (${roh})` : ''}`);
    }
    return daten;
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
  ? new RegExp(`(^|[^a-z0-9])${wort}([^a-z0-9]|$)`).test(text) || (text.replace(/[^a-z0-9]/g, '').startsWith(wort) && wort.length === 3)
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

// Adresse aus den addressComponents: Strasse + Hausnummer, PLZ, Ort.
export function adresseAus(place) {
  const teile = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const hol = typ => teile.find(t => Array.isArray(t?.types) && t.types.includes(typ))?.longText || null;
  const strasse = [hol('route'), hol('street_number')].filter(Boolean).join(' ') || null;
  return { strasse, plz: hol('postal_code'), ort: hol('locality') || hol('postal_town') || hol('administrative_area_level_3') };
}

// Anschrift von Google nur, wenn sie vollstaendig ist (Strasse mit Nummer,
// fuenfstellige PLZ, Ort) – sonst null. OSM-Anschriften sind oft veraltet
// (Rueckläufer im Oktober 2026), deshalb gilt Google, ausser die Anschrift
// wurde von Hand eingetragen (anschrift_stand = 'manuell').
export function adresseVoll(place) {
  const a = adresseAus(place);
  return a.strasse && /\d/.test(a.strasse) && /^\d{5}$/.test(a.plz || '') && a.ort ? a : null;
}
// SQL-Baustein fuer ein UPDATE: ", strasse = …, plz = …, ort = …" samt Werten,
// leer, wenn Google keine vollstaendige Anschrift hat.
export function anschriftSetzen(a) {
  if (!a) return { sql: '', werte: [] };
  const wenn = feld => `${feld} = CASE WHEN COALESCE(anschrift_stand, '') = 'manuell' THEN ${feld} ELSE ? END`;
  return { sql: `, ${wenn('strasse')}, ${wenn('plz')}, ${wenn('ort')}`, werte: [a.strasse.slice(0, 200), a.plz, a.ort.slice(0, 200)] };
}

// Website aus dem Profil: normalisiert und nur, wenn die Function sie abrufen
// duerfte (keine IP, kein localhost).
export function websiteAusPlace(place) {
  const w = websiteNormalisieren(place?.websiteUri);
  return w && hostErlaubt(w) ? w : null;
}

// Abstand in Metern (fuer den Abgleich mit OSM-Punkten reicht die Naeherung).
export function abstandM(lat1, lng1, lat2, lng2) {
  const dy = (lat2 - lat1) * 111_320;
  const dx = (lng2 - lng1) * 111_320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}
