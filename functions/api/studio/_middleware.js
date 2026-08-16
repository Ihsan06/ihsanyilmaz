// Torwächter für die Studio-Endpunkte (der von Diezmann portierte
// Content-erstellen-Bereich). Prüft die AIY-Session — dieselbe Anmeldung
// wie der restliche Adminbereich, nur antwortet hier ein 401 mit JSON.
import { istAngemeldet } from '../../_lib/auth.js';

export async function onRequest({ request, env, next }) {
  if (!(await istAngemeldet(request, env))) {
    return new Response(JSON.stringify({ ok: false, fehler: 'nicht angemeldet' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private' },
    });
  }
  return next();
}
