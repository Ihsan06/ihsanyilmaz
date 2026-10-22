// GET /api/vorschau/<token> — die Daten einer Website-Vorschau als JSON,
// fuer die Autohaus-Demo (Weg C der Recherche 2026-10-22): die Demo zeigt
// mit ?vorschau=<token> statt „Autohaus Mustermann“ den Betrieb hinter dem
// Token – Name, Anschrift, Zeiten, Farben, Logo-Zeichen, Texte, Fahrzeuge.
//
// Oeffentlich wie /fuer/<token>: wer das Token hat, hat den Brief. Gezaehlt
// wird hier nichts (das passiert vorher auf /fuer/<token>/website), nichts
// gecacht, nicht in Suchmaschinen. Ohne gueltige Vorschau: 404.
// Bilder liefern absolute Adressen (/bilder/… auf ihsan-yilmaz.de).
import { briefZuToken } from '../../fuer/[token].js';
import { vorschauLaden, vorschauDaten } from '../../_lib/vorschau.js';
import { postEinstellungenLaden } from '../admin/akquise/post-einstellungen.js';
import { TOKEN_RE } from '../../_lib/brief.js';

const ERLAUBT = /^https:\/\/([a-z0-9-]+\.)?autohaus-demo\.pages\.dev$|^http:\/\/localhost:\d+$/;

function antwort(body, status, request) {
  const kopf = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    Vary: 'Origin',
  };
  const herkunft = request.headers.get('Origin') || '';
  if (ERLAUBT.test(herkunft)) kopf['Access-Control-Allow-Origin'] = herkunft;
  return new Response(JSON.stringify(body), { status, headers: kopf });
}

export async function onRequestGet({ request, params, env }) {
  const token = String(params.token || '');
  if (!TOKEN_RE.test(token)) return antwort({ ok: false, fehler: 'unbekannt' }, 404, request);
  const brief = await briefZuToken(env, token).catch(() => null);
  const vorschau = brief?.betrieb_id ? await vorschauLaden(env, brief.betrieb_id).catch(() => null) : null;
  if (!vorschau) return antwort({ ok: false, fehler: 'unbekannt' }, 404, request);
  const e = await postEinstellungenLaden(env).catch(() => null);
  const d = vorschauDaten(brief, vorschau, { token, meinTelefon: e?.absender?.telefon || '' });
  const absolut = u => (u && u.startsWith('/') ? `https://ihsan-yilmaz.de${u}` : u);
  d.hero_bild = absolut(d.hero_bild);
  d.fahrzeuge = d.fahrzeuge.map(f => ({ ...f, bild: absolut(f.bild) }));
  return antwort({ ok: true, ...d }, 200, request);
}

export function onRequestOptions({ request }) {
  const herkunft = request.headers.get('Origin') || '';
  return new Response(null, {
    status: 204,
    headers: ERLAUBT.test(herkunft)
      ? { 'Access-Control-Allow-Origin': herkunft, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : {},
  });
}
