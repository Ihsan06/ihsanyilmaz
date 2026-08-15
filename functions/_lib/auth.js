// Gemeinsame Helfer für den Adminbereich.
// Dateien/Ordner mit "_" am Anfang werden von Cloudflare Pages NICHT als Route ausgeliefert.
//
// Benötigte Umgebungsvariablen im Pages-Projekt:
//   ADMIN_PASSWORD  — dein Login-Passwort (als "Secret" anlegen, nicht als normale Variable)
//   SESSION_SECRET  — lange Zufallszeichenkette zum Signieren der Session (ebenfalls Secret)
// Benötigtes Binding:
//   DB              — die D1-Datenbank

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const COOKIE_NAME = 'aiy_session';
const MAX_AGE_SEKUNDEN = 60 * 60 * 12; // 12 Stunden

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function b64urlEncode(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, daten) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(daten));
  return b64urlEncode(sig);
}

// Zeitkonstanter Vergleich — verhindert, dass sich das Passwort/die Signatur
// über Antwortzeiten Zeichen für Zeichen erraten lässt.
function sicherGleich(a, b) {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function sessionCookieErstellen(env) {
  const ablauf = Math.floor(Date.now() / 1000) + MAX_AGE_SEKUNDEN;
  const signatur = await hmac(env.SESSION_SECRET, String(ablauf));
  const wert = `${ablauf}.${signatur}`;
  return `${COOKIE_NAME}=${wert}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SEKUNDEN}`;
}

export function sessionCookieLoeschen() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function cookieLesen(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const teil of header.split(';')) {
    const [k, ...rest] = teil.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export async function istAngemeldet(request, env) {
  if (!env.SESSION_SECRET) return false;
  const wert = cookieLesen(request, COOKIE_NAME);
  if (!wert) return false;

  const [ablaufStr, signatur] = wert.split('.');
  const ablauf = Number(ablaufStr);
  if (!ablauf || !signatur) return false;
  if (ablauf < Math.floor(Date.now() / 1000)) return false;

  const erwartet = await hmac(env.SESSION_SECRET, ablaufStr);
  return sicherGleich(erwartet, signatur);
}

// Wrapper für alle geschützten Endpunkte.
export function nurAngemeldet(handler) {
  return async (context) => {
    const { request, env } = context;
    if (!env.DB) {
      return json({ ok: false, error: 'Datenbank ist nicht verbunden.' }, 500);
    }
    if (!(await istAngemeldet(request, env))) {
      return json({ ok: false, error: 'Nicht angemeldet.' }, 401);
    }
    try {
      return await handler(context);
    } catch (e) {
      return json({ ok: false, error: `Datenbankfehler: ${e.message}` }, 500);
    }
  };
}

export { sicherGleich, hmac };
