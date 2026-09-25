// GET /api/admin/akquise/stand — Kennzahlen fuer das Cockpit
// → { ok, betriebe, mitWebsite, ohneWebsite, nurBoerse, geprueft, prioHoch,
//     auswahl, papierkorb, nachStatus:{…}, laeufe:[ letzte 5 ],
//     google:{ eingerichtet, monat, genutzt, grenze, frei } }
// Alle Zahlen ausser papierkorb zaehlen nur, was nicht im Papierkorb liegt.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { kontingent } from '../../../_lib/places.js';

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const [zahlen, status, laeufe] = await env.DB.batch([
    env.DB.prepare(`SELECT
        SUM(geloescht IS NULL) AS betriebe,
        SUM(geloescht IS NULL AND website IS NOT NULL) AS mitWebsite,
        SUM(geloescht IS NULL AND website IS NULL) AS ohneWebsite,
        SUM(geloescht IS NULL AND kategorie = 'nur_boerse') AS nurBoerse,
        SUM(geloescht IS NULL AND geprueft_am IS NOT NULL) AS geprueft,
        SUM(geloescht IS NULL AND prioritaet >= 60) AS prioHoch,
        SUM(geloescht IS NULL AND auswahl = 1) AS auswahl,
        SUM(geloescht IS NOT NULL AND zusammengefuehrt_in IS NULL) AS papierkorb
      FROM akquise_betriebe`),
    env.DB.prepare('SELECT status, COUNT(*) AS n FROM akquise_betriebe WHERE geloescht IS NULL GROUP BY status'),
    env.DB.prepare("SELECT id, art, region, parameter, gefunden, neu, fehler, zeitpunkt FROM akquise_laeufe WHERE art = 'suche' ORDER BY id DESC LIMIT 5"),
  ]);

  const z = zahlen.results?.[0] || {};
  const nachStatus = {};
  for (const r of status.results ?? []) nachStatus[r.status] = Number(r.n || 0);
  const n = k => Number(z[k] || 0);

  return json({
    ok: true,
    betriebe: n('betriebe'),
    mitWebsite: n('mitWebsite'),
    ohneWebsite: n('ohneWebsite'),
    nurBoerse: n('nurBoerse'),
    geprueft: n('geprueft'),
    prioHoch: n('prioHoch'),
    auswahl: n('auswahl'),
    papierkorb: n('papierkorb'),
    nachStatus,
    laeufe: laeufe.results ?? [],
    google: env.PLACES_KEY ? { eingerichtet: true, ...(await kontingent(env)) } : { eingerichtet: false },
  });
});
