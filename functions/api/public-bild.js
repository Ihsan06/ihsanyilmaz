// GET /api/public-bild?s=<schluessel>&e=<ablauf>&sig=<signatur>
//
// Einziger öffentlicher Weg an ein Galeriebild — existiert nur, damit
// Instagram beim Veröffentlichen das Bild abholen kann. Die Adresse ist
// signiert (HMAC über Schlüssel + Ablauf) und verfällt nach einer Stunde;
// raten oder wiederverwenden führt ins Leere.
import { json, hmac, sicherGleich } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const s = url.searchParams.get('s') || '';
  const e = url.searchParams.get('e') || '';
  const sig = url.searchParams.get('sig') || '';

  if (!s.startsWith('galerie/') || !/^\d+$/.test(e)) {
    return json({ ok: false, error: 'Ungültige Anfrage.' }, 400);
  }
  if (Number(e) < Math.floor(Date.now() / 1000)) {
    return json({ ok: false, error: 'Link abgelaufen.' }, 410);
  }
  if (!env.SESSION_SECRET || !env.BILDER) {
    return json({ ok: false, error: 'Nicht konfiguriert.' }, 503);
  }

  const erwartet = await hmac(env.SESSION_SECRET, `${s}|${e}`);
  if (!sicherGleich(erwartet, sig)) {
    return json({ ok: false, error: 'Ungültige Signatur.' }, 403);
  }

  const objekt = await env.BILDER.get(s);
  if (!objekt) return json({ ok: false, error: 'Bild nicht gefunden.' }, 404);

  return new Response(objekt.body, {
    headers: {
      'Content-Type': objekt.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
