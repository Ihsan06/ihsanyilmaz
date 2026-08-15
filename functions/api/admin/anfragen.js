// /api/admin/anfragen — Kontaktanfragen ansehen, Status/Notiz ändern, löschen
import { json, nurAngemeldet } from '../../_lib/auth.js';

const ERLAUBTE_STATUS = ['neu', 'in_bearbeitung', 'beantwortet', 'archiviert'];

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, betrieb, nachricht, status, notiz, erstellt_am
     FROM anfragen ORDER BY erstellt_am DESC LIMIT 200`,
  ).all();
  return json({ ok: true, anfragen: results ?? [] });
});

export const onRequestPatch = nurAngemeldet(async ({ request, env }) => {
  const { id, status, notiz } = await request.json();
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  if (status !== undefined) {
    if (!ERLAUBTE_STATUS.includes(status)) {
      return json({ ok: false, error: 'Unbekannter Status.' }, 400);
    }
    await env.DB.prepare('UPDATE anfragen SET status = ? WHERE id = ?').bind(status, id).run();
  }
  if (notiz !== undefined) {
    await env.DB.prepare('UPDATE anfragen SET notiz = ? WHERE id = ?').bind(notiz, id).run();
  }
  return json({ ok: true });
});

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  const { id } = await request.json();
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  await env.DB.prepare('DELETE FROM anfragen WHERE id = ?').bind(id).run();
  return json({ ok: true });
});
