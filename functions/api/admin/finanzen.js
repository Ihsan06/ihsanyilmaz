// /api/admin/finanzen — Einnahmen & Ausgaben
// Beträge werden IMMER als ganze Cent gespeichert (keine Fließkomma-Rundungsfehler).
import { json, nurAngemeldet } from '../../_lib/auth.js';

const ERLAUBTE_ART = ['einnahme', 'ausgabe'];

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT id, art, betrag_cent, beschreibung, kategorie, datum
     FROM transaktionen ORDER BY datum DESC, id DESC LIMIT 500`,
  ).all();
  return json({ ok: true, transaktionen: results ?? [] });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  const { art, betrag_cent, beschreibung, kategorie, datum } = await request.json();

  if (!ERLAUBTE_ART.includes(art)) {
    return json({ ok: false, error: 'Art muss "einnahme" oder "ausgabe" sein.' }, 400);
  }
  const cent = Math.round(Number(betrag_cent));
  if (!Number.isFinite(cent) || cent <= 0) {
    return json({ ok: false, error: 'Bitte einen gültigen Betrag angeben.' }, 400);
  }
  if (!beschreibung?.trim()) {
    return json({ ok: false, error: 'Bitte eine Beschreibung angeben.' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum ?? '')) {
    return json({ ok: false, error: 'Bitte ein gültiges Datum angeben.' }, 400);
  }

  const { meta } = await env.DB.prepare(
    `INSERT INTO transaktionen (art, betrag_cent, beschreibung, kategorie, datum)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(art, cent, beschreibung.trim(), kategorie || null, datum).run();

  return json({ ok: true, id: meta?.last_row_id });
});

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  const { id } = await request.json();
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  await env.DB.prepare('DELETE FROM transaktionen WHERE id = ?').bind(id).run();
  return json({ ok: true });
});
