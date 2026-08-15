// /api/admin/notizen — Selbständigkeit: Aufgaben, Ideen, Termine
import { json, nurAngemeldet } from '../../_lib/auth.js';

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT id, titel, inhalt, kategorie, erledigt, faellig_am, erstellt_am
     FROM notizen
     ORDER BY erledigt ASC, (faellig_am IS NULL), faellig_am ASC, id DESC
     LIMIT 300`,
  ).all();
  return json({ ok: true, notizen: results ?? [] });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  const { titel, inhalt, kategorie, faellig_am } = await request.json();
  if (!titel?.trim()) return json({ ok: false, error: 'Titel fehlt.' }, 400);

  const { meta } = await env.DB.prepare(
    `INSERT INTO notizen (titel, inhalt, kategorie, faellig_am) VALUES (?, ?, ?, ?)`,
  ).bind(titel.trim(), inhalt ?? null, kategorie || null, faellig_am || null).run();

  return json({ ok: true, id: meta?.last_row_id });
});

export const onRequestPatch = nurAngemeldet(async ({ request, env }) => {
  const { id, titel, inhalt, kategorie, faellig_am, erledigt } = await request.json();
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  const felder = [];
  const werte = [];
  const setze = (spalte, wert) => { felder.push(`${spalte} = ?`); werte.push(wert); };

  if (titel !== undefined) setze('titel', titel);
  if (inhalt !== undefined) setze('inhalt', inhalt);
  if (kategorie !== undefined) setze('kategorie', kategorie || null);
  if (faellig_am !== undefined) setze('faellig_am', faellig_am || null);
  if (erledigt !== undefined) setze('erledigt', erledigt ? 1 : 0);

  if (!felder.length) return json({ ok: true });

  werte.push(id);
  await env.DB.prepare(`UPDATE notizen SET ${felder.join(', ')} WHERE id = ?`).bind(...werte).run();
  return json({ ok: true });
});

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  const { id } = await request.json();
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  await env.DB.prepare('DELETE FROM notizen WHERE id = ?').bind(id).run();
  return json({ ok: true });
});
