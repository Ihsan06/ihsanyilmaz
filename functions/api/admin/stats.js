// GET /api/admin/stats — Kennzahlen für die Übersichtsseite
import { json, nurAngemeldet } from '../../_lib/auth.js';

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const eineZahl = async (sql, ...bind) => {
    const { results } = await env.DB.prepare(sql).bind(...bind).all();
    return Number(results?.[0]?.wert ?? 0);
  };

  const monatsStart = new Date().toISOString().slice(0, 7) + '-01';

  const [neueAnfragen, anfragenGesamt, einnahmen, ausgaben, geplantePosts, offeneAufgaben,
         dokumente] =
    await Promise.all([
      eineZahl(`SELECT COUNT(*) AS wert FROM anfragen WHERE status = 'neu'`),
      eineZahl(`SELECT COUNT(*) AS wert FROM anfragen`),
      eineZahl(
        `SELECT COALESCE(SUM(betrag_cent), 0) AS wert FROM transaktionen
         WHERE art = 'einnahme' AND datum >= ?`, monatsStart),
      eineZahl(
        `SELECT COALESCE(SUM(betrag_cent), 0) AS wert FROM transaktionen
         WHERE art = 'ausgabe' AND datum >= ?`, monatsStart),
      eineZahl(`SELECT COUNT(*) AS wert FROM posts WHERE status IN ('geplant', 'entwurf')`),
      eineZahl(`SELECT COUNT(*) AS wert FROM notizen WHERE erledigt = 0`),
      eineZahl(`SELECT COUNT(*) AS wert FROM dokumente`),
    ]);

  return json({
    ok: true,
    stats: {
      neueAnfragen,
      anfragenGesamt,
      einnahmenCent: einnahmen,
      ausgabenCent: ausgaben,
      saldoCent: einnahmen - ausgaben,
      geplantePosts,
      offeneAufgaben,
      dokumente,
    },
  });
});
