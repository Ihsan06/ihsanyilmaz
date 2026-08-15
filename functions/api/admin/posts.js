// /api/admin/posts — Instagram-Redaktionsplan
import { json, nurAngemeldet } from '../../_lib/auth.js';

const ERLAUBTE_STATUS = ['idee', 'entwurf', 'geplant', 'veroeffentlicht'];

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT id, titel, caption, hashtags, geplant_am, status, erstellt_am
     FROM posts
     ORDER BY (geplant_am IS NULL), geplant_am ASC, id DESC
     LIMIT 200`,
  ).all();
  return json({ ok: true, posts: results ?? [] });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  const { titel, caption, hashtags, geplant_am, status } = await request.json();
  if (!titel?.trim()) return json({ ok: false, error: 'Titel fehlt.' }, 400);

  const st = ERLAUBTE_STATUS.includes(status) ? status : 'idee';
  const { meta } = await env.DB.prepare(
    `INSERT INTO posts (titel, caption, hashtags, geplant_am, status)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(titel.trim(), caption ?? null, hashtags ?? null, geplant_am || null, st).run();

  return json({ ok: true, id: meta?.last_row_id });
});

export const onRequestPatch = nurAngemeldet(async ({ request, env }) => {
  const { id, titel, caption, hashtags, geplant_am, status } = await request.json();
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  if (status !== undefined && !ERLAUBTE_STATUS.includes(status)) {
    return json({ ok: false, error: 'Unbekannter Status.' }, 400);
  }

  // Nur die Felder ändern, die auch mitgeschickt wurden.
  const felder = [];
  const werte = [];
  const setze = (spalte, wert) => { felder.push(`${spalte} = ?`); werte.push(wert); };

  if (titel !== undefined) setze('titel', titel);
  if (caption !== undefined) setze('caption', caption);
  if (hashtags !== undefined) setze('hashtags', hashtags);
  if (geplant_am !== undefined) setze('geplant_am', geplant_am || null);
  if (status !== undefined) setze('status', status);

  if (!felder.length) return json({ ok: true });

  werte.push(id);
  await env.DB.prepare(`UPDATE posts SET ${felder.join(', ')} WHERE id = ?`).bind(...werte).run();
  return json({ ok: true });
});

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  const { id } = await request.json();
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return json({ ok: true });
});
