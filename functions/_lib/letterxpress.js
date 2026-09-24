// LetterXpress API v3 – Briefe drucken und per Post zustellen lassen.
//
// Umgebungsvariablen (nur im Cloudflare-Dashboard, nie im Code):
//   LETTERXPRESS_USER   – Benutzername des Kontos
//   LETTERXPRESS_KEY    – API-Key (Mein Konto > Zugangsdaten > LXP API)
//   LETTERXPRESS_MODUS  – 'test' (Standard: Auftrag landet nur in der
//                          Postbox) oder 'live' (wird gedruckt und versandt)
//
// Besonderheiten der API (Stand der Recherche, September 2026):
//   - Zugangsdaten stehen im JSON-Body, bei JEDEM Aufruf – auch bei GET.
//     fetch() in Workers erlaubt bei GET keinen Body. Deshalb schicken wir
//     solche Anfragen als POST mit "X-HTTP-Method-Override: GET" (Laravel/
//     Symfony werten den Header aus). Ob der Server das annimmt, ist erst
//     mit echtem Schluessel belegbar – die Aufrufer behandeln null als
//     "nicht abrufbar", nicht als Fehler.
//   - Pruefsumme: MD5 ueber den Base64-String. crypto.subtle kann kein MD5,
//     daher die kleine Implementierung unten.
//   - Storno nur 15 Minuten nach der Uebertragung.

const BASIS = 'https://api.letterxpress.de/v3';
const ZEIT_MS = 25000;

export function konfiguriert(env) {
  return Boolean(env?.LETTERXPRESS_USER && env?.LETTERXPRESS_KEY);
}

export function modus(env) {
  return env?.LETTERXPRESS_MODUS === 'live' ? 'live' : 'test';
}

export const FEHLER_NICHT_EINGERICHTET = 'Versand nicht eingerichtet: LETTERXPRESS_USER und LETTERXPRESS_KEY in Cloudflare hinterlegen.';

function auth(env) {
  return { username: env.LETTERXPRESS_USER, apikey: env.LETTERXPRESS_KEY, mode: modus(env) };
}

// Ein Aufruf. Liefert { ok, status, daten, text } – wirft nie, damit der
// Aufrufer den Fehler in der Datenbank ablegen kann.
async function anfrage(env, methode, pfad, body) {
  const kopf = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  let m = methode;
  if (methode === 'GET') { m = 'POST'; kopf['X-HTTP-Method-Override'] = 'GET'; }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ZEIT_MS);
  try {
    const r = await fetch(BASIS + pfad, {
      method: m, headers: kopf, signal: ac.signal,
      body: JSON.stringify({ auth: auth(env), ...(body || {}) }),
    });
    const text = await r.text();
    let daten = null;
    try { daten = JSON.parse(text); } catch { /* kein JSON – Text reicht */ }
    return { ok: r.ok, status: r.status, daten, text: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, status: 0, daten: null, text: String(e?.message || e).slice(0, 200) };
  } finally {
    clearTimeout(t);
  }
}

// Kurzer, lesbarer Fehlertext fuer die Spalte akquise_briefe.fehler. Nur
// die Meldung aus dem JSON – ein roher Antwortkoerper (HTML-Fehlerseite)
// gehoert weder in die Datenbank noch in die Oberflaeche. Zugangsdaten
// werden vorsorglich ausgeblendet, falls der Dienst sie je zitieren sollte.
function fehlerText(a, env) {
  const nachricht = a.daten?.message || a.daten?.error;
  const details = a.daten?.errors && typeof a.daten.errors === 'object'
    ? Object.values(a.daten.errors).flat().map(String).join(' ') : '';
  let kern = [nachricht, details].filter(Boolean).join(' ');
  if (!kern) kern = a.status ? 'keine lesbare Antwort' : (a.text || 'keine Antwort');
  for (const geheim of [env?.LETTERXPRESS_KEY, env?.LETTERXPRESS_USER]) {
    if (geheim) kern = kern.split(geheim).join('…');
  }
  return `LetterXpress ${a.status || 'ohne Verbindung'}: ${kern}`.slice(0, 300);
}

// Bytes → Base64, stueckweise (btoa auf einem 3-MB-String waere okay, aber
// String.fromCharCode(...grosseListe) sprengt den Aufrufstapel).
export function base64Aus(bytes) {
  let s = '';
  const schritt = 0x8000;
  for (let i = 0; i < bytes.length; i += schritt) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + schritt));
  }
  return btoa(s);
}

// POST /v3/printjobs – Auftrag anlegen.
// → { ok:true, id, kosten_cent, adresse, status } oder { ok:false, fehler }
export async function auftragAnlegen(env, { pdfBytes, dateiname, notiz }) {
  if (!konfiguriert(env)) return { ok: false, fehler: FEHLER_NICHT_EINGERICHTET };
  const b64 = base64Aus(pdfBytes);
  const a = await anfrage(env, 'POST', '/printjobs', {
    letter: {
      base64_file: b64,
      base64_file_checksum: md5(b64),
      specification: { color: '1', mode: 'simplex', shipping: 'national' },
      filename_original: dateiname || 'brief.pdf',
      notice: String(notiz || '').slice(0, 255),
    },
  });
  if (!a.ok || !a.daten?.data?.id) return { ok: false, fehler: fehlerText(a, env) };
  const d = a.daten.data;
  return {
    ok: true,
    id: String(d.id),
    kosten_cent: kostenCent(d.items),
    adresse: d.items?.[0]?.address || null,
    status: d.status || null,
  };
}

// Netto + MwSt aller Positionen, in Cent gerundet. Fehlt beides: null.
function kostenCent(items) {
  if (!Array.isArray(items) || !items.length) return null;
  let summe = 0;
  let gefunden = false;
  for (const it of items) {
    const a = Number(it?.amount), v = Number(it?.vat);
    if (Number.isFinite(a)) { summe += a; gefunden = true; }
    if (Number.isFinite(v)) summe += v;
  }
  return gefunden ? Math.round(summe * 100) : null;
}

// GET /v3/printjobs/{id} – Auftragsstatus.
// → { ok:true, status, itemStatus, roh } oder { ok:false, fehler }
export async function auftragAbrufen(env, id) {
  if (!konfiguriert(env)) return { ok: false, fehler: FEHLER_NICHT_EINGERICHTET };
  const a = await anfrage(env, 'GET', `/printjobs/${encodeURIComponent(id)}`);
  if (!a.ok || !a.daten?.data) return { ok: false, fehler: fehlerText(a, env) };
  const d = a.daten.data;
  return { ok: true, status: d.status || null, itemStatus: d.items?.[0]?.status || null, kosten_cent: kostenCent(d.items) };
}

// DELETE /v3/printjobs/{id} – Storno, nur binnen 15 Minuten.
export async function auftragStornieren(env, id) {
  if (!konfiguriert(env)) return { ok: false, fehler: FEHLER_NICHT_EINGERICHTET };
  const a = await anfrage(env, 'DELETE', `/printjobs/${encodeURIComponent(id)}`);
  if (!a.ok) return { ok: false, fehler: fehlerText(a, env) };
  return { ok: true };
}

// GET /v3/balance → Guthaben in Cent oder null (nicht abrufbar).
export async function guthabenCent(env) {
  if (!konfiguriert(env)) return null;
  const a = await anfrage(env, 'GET', '/balance');
  const wert = Number(a.daten?.data?.balance);
  return a.ok && Number.isFinite(wert) ? Math.round(wert * 100) : null;
}

// GET /v3/price → Nettopreis in Cent fuer einen s/w-Brief mit n Seiten, oder null.
export async function preisCent(env, seiten = 1) {
  if (!konfiguriert(env)) return null;
  const a = await anfrage(env, 'GET', '/price', {
    letter: { specification: { color: '1', mode: 'simplex', shipping: 'national', pages: seiten } },
  });
  const wert = Number(a.daten?.data?.price);
  return a.ok && Number.isFinite(wert) ? Math.round(wert * 100) : null;
}

// ---------------------------------------------------------------- MD5
// Nach RFC 1321, fuer ASCII-Strings (Base64 enthaelt nichts anderes).

const K = new Uint32Array(64);
for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];

export function md5(text) {
  const bytes = new TextEncoder().encode(text);
  const laenge = bytes.length;
  const blockZahl = ((laenge + 8) >> 6) + 1;
  const puffer = new Uint8Array(blockZahl * 64);
  puffer.set(bytes);
  puffer[laenge] = 0x80;
  const sicht = new DataView(puffer.buffer);
  const bits = laenge * 8;
  sicht.setUint32(puffer.length - 8, bits >>> 0, true);
  sicht.setUint32(puffer.length - 4, Math.floor(bits / 2 ** 32), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let blk = 0; blk < puffer.length; blk += 64) {
    for (let i = 0; i < 16; i++) M[i] = sicht.getUint32(blk + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const tmp = D;
      D = C;
      C = B;
      const summe = (A + F + K[i] + M[g]) >>> 0;
      B = (B + ((summe << S[i]) | (summe >>> (32 - S[i])))) >>> 0;
      A = tmp;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const aus = new DataView(new ArrayBuffer(16));
  aus.setUint32(0, a0, true); aus.setUint32(4, b0, true); aus.setUint32(8, c0, true); aus.setUint32(12, d0, true);
  let hex = '';
  for (let i = 0; i < 16; i++) hex += aus.getUint8(i).toString(16).padStart(2, '0');
  return hex;
}
