// POST /api/admin/logout — Abmelden
import { json, sessionCookieLoeschen } from '../../_lib/auth.js';

export async function onRequestPost() {
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookieLoeschen() });
}
