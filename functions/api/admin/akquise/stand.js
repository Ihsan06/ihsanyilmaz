// GET /api/admin/akquise/stand — Kennzahlen fuer das Cockpit
// → { ok, betriebe, mitWebsite, geprueft, prioHoch, nachStatus:{…}, laeufe:[ letzte 5 ] }
import { json, nurAngemeldet } from '../../../_lib/auth.js';

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const [zahlen, status, laeufe] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS betriebe,
        SUM(website IS NOT NULL) AS mitWebsite,
        SUM(geprueft_am IS NOT NULL) AS geprueft,
        SUM(prioritaet >= 60) AS prioHoch
      FROM akquise_betriebe`),
    env.DB.prepare('SELECT status, COUNT(*) AS n FROM akquise_betriebe GROUP BY status'),
    env.DB.prepare('SELECT id, art, region, parameter, gefunden, neu, fehler, zeitpunkt FROM akquise_laeufe ORDER BY id DESC LIMIT 5'),
  ]);

  const z = zahlen.results?.[0] || {};
  const nachStatus = {};
  for (const r of status.results ?? []) nachStatus[r.status] = Number(r.n || 0);

  return json({
    ok: true,
    betriebe: Number(z.betriebe || 0),
    mitWebsite: Number(z.mitWebsite || 0),
    geprueft: Number(z.geprueft || 0),
    prioHoch: Number(z.prioHoch || 0),
    nachStatus,
    laeufe: laeufe.results ?? [],
  });
});
