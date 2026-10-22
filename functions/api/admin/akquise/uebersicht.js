// /api/admin/akquise/uebersicht — alle Kennzahlen fuer „Vertrieb → Übersicht“
// in einem Aufruf: Trichter (angeschrieben → Seite → Demo → Kontakt), Kosten,
// Rückläufer, Verlauf je Woche, Aufschluesselung nach Kategorie und Region,
// offene Aufgaben, letzte Aktivitaet, noch nicht angeschriebener Bestand und
// der Zustand der Dienste (Guthaben, Google-Kontingent, letzter Suchlauf).
//
// GET → { ok, … }   Nur lesend.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import * as lxp from '../../../_lib/letterxpress.js';

// Ein verschickter Brief: gesendet, zugestellt oder als Rückläufer zurueck.
const VERSCHICKT = "b.art != 'test' AND b.status IN ('gesendet', 'zugestellt', 'zurueck')";
// Je Gruppe dieselben Kennzahlen.
const KENNZAHLEN = `COUNT(*) AS briefe,
  SUM(b.status = 'zurueck') AS zurueck,
  SUM(b.aufrufe > 0) AS geoeffnet,
  SUM(b.demo_geoeffnet IS NOT NULL OR b.demo_angefordert IS NOT NULL) AS demo,
  SUM(b.kontakt_erlaubt IS NOT NULL) AS kontakt,
  SUM(COALESCE(b.kosten_cent, 0)) AS kosten_cent`;
// Anschrift, an die ein Brief gehen kann (wie anschriftOk in der Post-Seite).
const ANSCHRIFT_OK = "t.strasse GLOB '*[0-9]*' AND t.plz GLOB '[0-9][0-9][0-9][0-9][0-9]' AND COALESCE(t.ort, '') != ''";
const PASSEND = "('ohne_website', 'nur_boerse', 'veraltet', 'baukasten')";

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  if (!env.DB) return json({ ok: false, error: 'Datenbank nicht verbunden.' }, 503);
  const monat = new Date().toISOString().slice(0, 7);
  try {
    const q = sql => env.DB.prepare(sql);
    const [gesamt, monatlich, nachKat, nachRegion, wochen, aktivitaet, kontakte, warm, zurueck, bestand, betriebe, laeufe, google, offen] = await env.DB.batch([
      q(`SELECT ${KENNZAHLEN}, COUNT(DISTINCT b.betrieb_id) AS betriebe, MIN(b.gesendet_am) AS erster, MAX(b.gesendet_am) AS letzter
         FROM akquise_briefe b WHERE ${VERSCHICKT}`),
      q(`SELECT ${KENNZAHLEN} FROM akquise_briefe b WHERE ${VERSCHICKT} AND b.gesendet_am >= strftime('%Y-%m-01', 'now')`),
      q(`SELECT COALESCE(t.kategorie, 'offen') AS gruppe, ${KENNZAHLEN}
         FROM akquise_briefe b LEFT JOIN akquise_betriebe t ON t.id = b.betrieb_id WHERE ${VERSCHICKT}
         GROUP BY gruppe ORDER BY briefe DESC`),
      q(`SELECT COALESCE(t.region, '—') AS gruppe, ${KENNZAHLEN}
         FROM akquise_briefe b LEFT JOIN akquise_betriebe t ON t.id = b.betrieb_id WHERE ${VERSCHICKT}
         GROUP BY gruppe ORDER BY briefe DESC`),
      // Montag der Kalenderwoche als Schluessel – so sind auch leere Wochen eindeutig.
      q(`SELECT date(b.gesendet_am, '-6 days', 'weekday 1') AS woche, ${KENNZAHLEN}
         FROM akquise_briefe b WHERE ${VERSCHICKT} AND b.gesendet_am IS NOT NULL
         GROUP BY woche ORDER BY woche`),
      q(`SELECT * FROM (
           SELECT b.zuletzt_aufgerufen AS zeit, 'aufruf' AS art, b.id, b.aufrufe, t.name, t.ort FROM akquise_briefe b LEFT JOIN akquise_betriebe t ON t.id = b.betrieb_id
             WHERE ${VERSCHICKT} AND b.zuletzt_aufgerufen IS NOT NULL
           UNION ALL SELECT b.demo_geoeffnet, 'demo', b.id, b.aufrufe, t.name, t.ort FROM akquise_briefe b LEFT JOIN akquise_betriebe t ON t.id = b.betrieb_id
             WHERE ${VERSCHICKT} AND b.demo_geoeffnet IS NOT NULL
           UNION ALL SELECT b.kontakt_erlaubt, 'kontakt', b.id, b.aufrufe, t.name, t.ort FROM akquise_briefe b LEFT JOIN akquise_betriebe t ON t.id = b.betrieb_id
             WHERE ${VERSCHICKT} AND b.kontakt_erlaubt IS NOT NULL
           UNION ALL SELECT b.zurueck_am, 'zurueck', b.id, b.aufrufe, t.name, t.ort FROM akquise_briefe b LEFT JOIN akquise_betriebe t ON t.id = b.betrieb_id
             WHERE b.status = 'zurueck' AND b.zurueck_am IS NOT NULL
         ) ORDER BY zeit DESC LIMIT 15`),
      q(`SELECT b.id, b.kontakt_erlaubt, t.id AS betrieb_id, t.name, t.ort, t.telefon, t.email, t.website, t.status
         FROM akquise_briefe b JOIN akquise_betriebe t ON t.id = b.betrieb_id
         WHERE ${VERSCHICKT} AND b.kontakt_erlaubt IS NOT NULL AND t.status NOT IN ('kunde', 'aus') ORDER BY b.kontakt_erlaubt DESC LIMIT 20`),
      q(`SELECT b.id, b.aufrufe, b.zuletzt_aufgerufen, b.demo_geoeffnet, t.id AS betrieb_id, t.name, t.ort, t.telefon
         FROM akquise_briefe b JOIN akquise_betriebe t ON t.id = b.betrieb_id
         WHERE ${VERSCHICKT} AND b.kontakt_erlaubt IS NULL AND (b.demo_geoeffnet IS NOT NULL OR b.aufrufe >= 2)
         ORDER BY COALESCE(b.demo_geoeffnet, b.zuletzt_aufgerufen) DESC LIMIT 20`),
      q(`SELECT b.id, b.zurueck_am, b.gesendet_am, b.empfaenger, t.id AS betrieb_id, t.name, t.strasse, t.plz, t.ort, t.website, t.google_place_id IS NOT NULL AS google,
                t.geloescht IS NOT NULL AS im_korb
         FROM akquise_briefe b LEFT JOIN akquise_betriebe t ON t.id = b.betrieb_id
         WHERE b.status = 'zurueck' ORDER BY b.zurueck_am DESC`),
      // Noch nicht angeschriebene, passende Betriebe – das, was als Naechstes rausgehen kann.
      q(`SELECT COALESCE(t.kategorie, 'offen') AS kategorie, COUNT(*) AS alle, SUM(${ANSCHRIFT_OK}) AS versandfertig,
                SUM(t.google_anzahl > 10) AS stark
         FROM akquise_betriebe t
         WHERE t.geloescht IS NULL AND t.kategorie IN ${PASSEND}
           AND NOT EXISTS (SELECT 1 FROM akquise_briefe x WHERE x.betrieb_id = t.id AND x.art != 'test' AND x.status NOT IN ('storniert'))
         GROUP BY t.kategorie ORDER BY versandfertig DESC`),
      q(`SELECT COUNT(*) AS aktiv, SUM(auswahl) AS auswahl, SUM(status = 'kunde') AS kunden,
                (SELECT COUNT(*) FROM akquise_betriebe WHERE geloescht IS NOT NULL) AS papierkorb
         FROM akquise_betriebe WHERE geloescht IS NULL`),
      q(`SELECT art, region, gefunden, neu, fehler, zeitpunkt FROM akquise_laeufe
         WHERE art = 'suche' ORDER BY id DESC LIMIT 1`),
      q('SELECT wert FROM einstellungen WHERE schluessel = ?').bind(`akquise.google.${monat}`),
      q(`SELECT SUM(status = 'entwurf') AS entwurf, SUM(status = 'freigegeben') AS freigegeben, SUM(status = 'fehler') AS fehler
         FROM akquise_briefe WHERE art != 'test'`),
    ]);

    // Guthaben live von LetterXpress – darf die Seite nie scheitern lassen.
    let guthaben_cent = null, preis_cent = null;
    try { [guthaben_cent, preis_cent] = await Promise.all([lxp.guthabenCent(env), lxp.preisCent(env, 2)]); } catch { /* bleibt leer */ }

    const zeile = r => r?.results?.[0] || {};
    return json({
      ok: true,
      gesamt: zeile(gesamt),
      monat: zeile(monatlich),
      nach_kategorie: nachKat.results ?? [],
      nach_region: nachRegion.results ?? [],
      wochen: wochen.results ?? [],
      aktivitaet: aktivitaet.results ?? [],
      kontakte: kontakte.results ?? [],
      warm: warm.results ?? [],
      ruecklaeufer: zurueck.results ?? [],
      bestand: bestand.results ?? [],
      betriebe: zeile(betriebe),
      offen: zeile(offen),
      dienste: {
        letterxpress: { eingerichtet: lxp.konfiguriert(env), modus: lxp.modus(env), guthaben_cent, preis_cent },
        google: { monat, genutzt: Number(zeile(google).wert || 0), grenze: 950 },
        suchlauf: zeile(laeufe),
      },
    });
  } catch (e) {
    return json({ ok: false, error: `Datenbankfehler: ${e.message}` }, 500);
  }
});
