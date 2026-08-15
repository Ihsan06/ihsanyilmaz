// GET /api/admin/me — prüft, ob die Session gültig ist (für den Auth-Gate im Frontend)
import { json, istAngemeldet } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const angemeldet = await istAngemeldet(request, env);
  return json({ ok: true, angemeldet, dbVerbunden: Boolean(env.DB) });
}
