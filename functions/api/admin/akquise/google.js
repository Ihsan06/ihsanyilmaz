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
  betriebPruefen, istBoersenSeite, hostVon, betriebLaden, istMehrfach, letztePruefungLaden, pruefungSpeichern,
  pruefungNeuBewerten, pruefAntwort,
} from '../../../_lib/akquise.js';
import { textSuche, kontingent, fehlerMeldung, fehlerMerken, placeTrifft, websiteAusPlace, adresseVoll, anschriftSetzen } from '../../../_lib/places.js';

const FELDER = 'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus';
const NICHT_EINGERICHTET = 'Google Places nicht eingerichtet: PLACES_KEY in Cloudflare hinterlegen.';

// GET → { ok, eingerichtet, kontingent:{ monat, genutzt, grenze, frei } }
export const onRequestGet = nurAngemeldet(async ({ env }) => json({
  ok: true, eingerichtet: !!env.PLACES_KEY, kontingent: env.PLACES_KEY ? await kontingent(env) : null,
}));

async function placesSuchen(env, betrieb) {
  const body = {
    textQuery: [betrieb.name, betrieb.strasse, betrieb.plz, betrieb.ort].filter(Boolean).join(' ').slice(0, 300),
    languageCode: 'de',
    regionCode: 'DE',
    pageSize: 1,
  };
  if (Number.isFinite(betrieb.lat) && Number.isFinite(betrieb.lng)) {
    body.locationBias = { circle: { center: { latitude: betrieb.lat, longitude: betrieb.lng }, radius: 2000 } };
  }
  const daten = await textSuche(env, body, FELDER);
  return Array.isArray(daten?.places) ? daten.places[0] || null : null;
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
    await fehlerMerken(env, 'google', `Betrieb ${id}`, msg);
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
  const websiteGoogle = websiteAusPlace(place);
  let websiteNeu = null;
  let quelleNeu = null;
  const vomNutzer = betrieb.website_quelle === 'manuell' || betrieb.website_quelle === 'bestaetigt';
  if (websiteGoogle && !vomNutzer && !(istBoersenSeite(websiteGoogle) && betrieb.website && !istBoersenSeite(betrieb.website))) {
    if (betrieb.website && hostVon(betrieb.website) === hostVon(websiteGoogle)) quelleNeu = 'google';
    else { websiteNeu = websiteGoogle; quelleNeu = 'google'; }
  }

  const felder = ['google_place_id = ?', 'google_bewertung = ?', 'google_anzahl = ?', 'google_stand = ?'];
  const werte = [google.google_place_id, google.google_bewertung, google.google_anzahl, google.google_stand];
  // Bei Google dauerhaft geschlossen: in den Papierkorb, kein Brief mehr dorthin.
  const zu = place.businessStatus === 'CLOSED_PERMANENTLY';
  if (zu) {
    felder.push("geloescht = COALESCE(geloescht, datetime('now'))", "notiz = TRIM(COALESCE(notiz || ' · ', '') || 'Bei Google dauerhaft geschlossen')");
  }
  // Vollstaendige Anschrift von Google ersetzt die aus OSM (ausser von Hand eingetragen).
  const an = anschriftSetzen(adresseVoll(place));
  const anschriftVorher = [betrieb.strasse, betrieb.plz, betrieb.ort].join('|');
  if (websiteNeu) { felder.push('website = ?'); werte.push(websiteNeu); betrieb.website = websiteNeu; }
  if (quelleNeu) { felder.push('website_quelle = ?'); werte.push(quelleNeu); betrieb.website_quelle = quelleNeu; }
  await env.DB.prepare(`UPDATE akquise_betriebe SET ${felder.join(', ')}${an.sql}, geaendert = datetime('now') WHERE id = ?`).bind(...werte, ...an.werte, id).run();
  if (an.sql) {
    const neu = await env.DB.prepare('SELECT strasse, plz, ort FROM akquise_betriebe WHERE id = ?').bind(id).first();
    Object.assign(betrieb, neu);
  }

  const mehrfach = await istMehrfach(env, betrieb);
  const extra = {
    gefunden: true,
    google: { ...google, name: place.displayName?.text || null, adresse: place.formattedAddress || null, website: websiteGoogle, status: place.businessStatus || null },
    website_uebernommen: !!websiteNeu,
    anschrift_geaendert: [betrieb.strasse, betrieb.plz, betrieb.ort].join('|') !== anschriftVorher,
    geschlossen: zu,
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
