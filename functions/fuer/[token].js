// GET /fuer/<token> — die persoenliche Seite zu einem Akquise-Brief.
//
// Der Brief traegt Link und QR-Code hierher. Die Seite zeigt die Befunde aus
// dem Brief, den Weg zur Demo und ein Formular fuer den Admin-Zugang (geht an
// /api/demo mit dem Token, damit die Anforderung beim Brief landet).
//
// Datensparsam: kein Cookie, keine IP, kein Skript von Dritten. Gezaehlt
// wird nur "aufgerufen" am Brief – hoechstens einmal je Minute, damit ein
// Scanner oder ein Vorschau-Bot die Zahl nicht aufblaest.
// Suchmaschinen bleiben draussen (X-Robots-Tag + Meta), nichts wird gecacht.
import { TOKEN_RE, CHECK_LABELS, rueckChecks, quellenZeile } from '../_lib/brief.js';
import { eigenerAufruf } from '../_lib/auth.js';
import { postEinstellungenLaden } from '../api/admin/akquise/post-einstellungen.js';
import { vorschauLaden } from '../_lib/vorschau.js';
import { betriebMelden } from '../_lib/mitteilung.js';

const STARTSEITE = 'https://ihsan-yilmaz.de';
const DEMO_URL = 'https://autohaus-demo.pages.dev';
const INSTAGRAM = 'https://www.instagram.com/aiy.web/';
// Bilder der Demo-Website und des Verwaltungsbereichs (eigene Screenshots, Beispieldaten).
const WEB_SLIDES = [
  { bild: '/leistungen/web-start.jpg', titel: 'Startseite', text: 'Der erste Eindruck – klar, schnell, auf jedem Gerät.' },
  { bild: '/leistungen/web-fahrzeuge.jpg', titel: 'Fahrzeuge', text: 'Ihr Bestand mit Bildern und Preisen – auf Wunsch automatisch aus mobile.de.' },
  { bild: '/leistungen/web-finanzierung.jpg', titel: 'Finanzierung', text: 'Rate selbst ausrechnen, Anfrage direkt abschicken.' },
  { bild: '/leistungen/web-mietwagen.jpg', titel: 'Mietwagen', text: 'Freie Tage sehen und direkt anfragen.' },
];
const ADMIN_SLIDES = [
  { bild: '/leistungen/adm-uebersicht.jpg', titel: 'Übersicht', text: 'Besuche, Anfragen und Instagram auf einen Blick.' },
  { bild: '/leistungen/ki-website.jpg', titel: 'Website ändern', text: 'Sagen, was anders werden soll – der Assistent schlägt den Wortlaut vor.' },
  { bild: '/leistungen/ki-content.jpg', titel: 'Content erstellen', text: 'Beiträge für Instagram aus Ihren eigenen Fotos, in wenigen Minuten.' },
];
const KONTAKT = 'kontakt@ihsan-yilmaz.de';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Die AIY-Bildmarke (public/admin/marke.js, viewBox 0 0 100 100) – hier als
// Kopie, weil eine Function nichts aus public/ laden kann.
const BILDMARKE = 'M90.45,89 L90.55,89 L90.95,88.96 L91.16,88.93 L91.5,88.85 L91.7,88.78 L92.02,88.64 L92.2,88.55 L92.5,88.36 L92.67,88.24 L92.93,88.01 L93.08,87.86 L93.3,87.59 L93.42,87.42 L93.6,87.11 L93.69,86.93 L93.82,86.6 L93.87,86.4 L93.95,86.06 L93.98,85.85 L93.99,85.5 L93.99,85.29 L93.95,84.94 L93.91,84.74 L93.82,84.4 L93.75,84.21 L93.58,83.84 L93.53,83.75 L70.47,42.47 L70.33,42.26 L70.15,42.09 L69.93,41.95 L69.7,41.86 L69.45,41.81 L69.2,41.81 L68.95,41.86 L68.72,41.96 L68.51,42.1 L68.33,42.28 L55.19,58.39 L55.03,58.64 L54.93,58.91 L54.9,59.21 L54.9,87.7 L54.92,87.95 L55,88.2 L55.12,88.42 L55.28,88.62 L55.48,88.78 L55.7,88.9 L55.95,88.98 L56.2,89 Z M36.03,30.83 L35.93,31.06 L35.88,31.32 L35.87,31.57 L35.92,31.83 L36.02,32.07 L36.16,32.28 L48.99,48.01 L49.17,48.19 L49.39,48.34 L49.62,48.44 L49.87,48.49 L50.13,48.49 L50.38,48.44 L50.61,48.34 L50.83,48.19 L51.01,48.01 L63.84,32.28 L63.98,32.07 L64.08,31.83 L64.13,31.57 L64.12,31.32 L64.07,31.06 L63.97,30.83 L53.08,11.34 L53.03,11.25 L52.82,10.93 L52.7,10.78 L52.47,10.53 L52.33,10.4 L52.07,10.19 L51.91,10.07 L51.62,9.91 L51.45,9.82 L51.14,9.7 L50.95,9.64 L50.62,9.56 L50.43,9.53 L50.1,9.51 L49.9,9.51 L49.57,9.53 L49.38,9.56 L49.05,9.64 L48.86,9.7 L48.55,9.82 L48.38,9.91 L48.09,10.07 L47.93,10.19 L47.67,10.4 L47.53,10.53 L47.3,10.78 L47.18,10.93 L46.97,11.25 L46.92,11.34 Z M6.47,83.75 L6.42,83.84 L6.25,84.21 L6.18,84.4 L6.09,84.74 L6.05,84.94 L6.01,85.29 L6.01,85.5 L6.02,85.85 L6.05,86.06 L6.13,86.4 L6.18,86.6 L6.31,86.93 L6.4,87.11 L6.58,87.42 L6.7,87.59 L6.92,87.86 L7.07,88.01 L7.33,88.24 L7.5,88.36 L7.8,88.55 L7.98,88.64 L8.3,88.78 L8.5,88.85 L8.84,88.93 L9.05,88.96 L9.45,89 L9.55,89 L43.8,89 L44.05,88.98 L44.3,88.9 L44.52,88.78 L44.72,88.62 L44.88,88.42 L45,88.2 L45.08,87.95 L45.1,87.7 L45.1,59.21 L45.07,58.91 L44.97,58.64 L44.81,58.39 L31.67,42.28 L31.49,42.1 L31.28,41.96 L31.05,41.86 L30.8,41.81 L30.55,41.81 L30.3,41.86 L30.07,41.95 L29.85,42.09 L29.67,42.26 L29.53,42.47 Z';

const CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0A0F14; color:#F2F5F7; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height:1.6; -webkit-font-smoothing:antialiased; }
  a { color:#4DA3E0; }
  .huelle { max-width:680px; margin:0 auto; padding:40px 20px 56px; }
  .kopf { display:flex; align-items:center; gap:12px; margin-bottom:40px; text-decoration:none; color:#F2F5F7; }
  .kopf svg { width:32px; height:32px; flex:none; }
  .kopf b { font-size:1.15rem; letter-spacing:-.01em; }
  .kopf span { display:block; font-size:.72rem; color:#7C8A97; text-transform:uppercase; letter-spacing:.1em; }
  .eyebrow { color:#4DA3E0; font-size:.78rem; font-weight:600; text-transform:uppercase; letter-spacing:.1em; margin:0 0 8px; }
  h1 { font-size:clamp(1.7rem, 4vw, 2.3rem); line-height:1.15; margin:0 0 8px; letter-spacing:-.02em; }
  .unter { color:#B4BFC9; margin:0 0 36px; }
  h2 { font-size:1.15rem; margin:0 0 12px; }
  section { margin-bottom:36px; }
  .karte { background:#111820; border:1px solid #243039; border-radius:14px; padding:22px 24px; }
  ul.befunde { list-style:none; margin:0; padding:0; }
  ul.befunde li { position:relative; padding:10px 0 10px 26px; border-bottom:1px solid #243039; color:#E6EBEF; }
  ul.befunde li:last-child { border-bottom:0; }
  ul.befunde li::before { content:""; position:absolute; left:4px; top:19px; width:8px; height:8px; border-radius:50%; background:#4DA3E0; }
  ul.befunde li.gruen::before { background:#2F9E5F; }
  ul.befunde li b { color:#F2F5F7; margin-right:6px; }
  p { margin:0 0 12px; color:#B4BFC9; }
  .knopf { display:inline-flex; align-items:center; justify-content:center; gap:10px; padding:14px 26px; border-radius:999px; background:#1B6FA8; color:#fff; text-decoration:none; border:0; font:inherit; font-size:1.02rem; font-weight:600; cursor:pointer; }
  .knopf:hover { background:#2380c0; }
  .knopf.leise { background:transparent; border:1px solid #7C8A97; color:#F2F5F7; }
  .knopf.leise:hover { background:#182129; }
  .knopf.gross { width:100%; padding:17px 20px; font-size:1.1rem; white-space:nowrap; }
  .knopf svg { width:20px; height:20px; flex:none; }
  .aktionen { display:grid; gap:10px; margin-top:8px; }
  @media (min-width:560px) { .aktionen { grid-template-columns:1fr 1fr; } }
  .browser { border-radius:12px; background:#1E293B; overflow:hidden; box-shadow:0 14px 34px rgba(0,0,0,.45); }
  .browser .leiste { display:flex; align-items:center; gap:6px; padding:9px 12px; }
  .browser .leiste i { width:8px; height:8px; border-radius:50%; background:#64748B; }
  .browser .leiste span { flex:1; margin-left:8px; padding:3px 12px; border-radius:999px; background:#0F172A; color:#94A3B8; font-size:.72rem; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .browser img { display:block; width:100%; }
  ul.checks { list-style:none; margin:0 0 6px; padding:0; }
  ul.checks li { position:relative; padding:8px 0 8px 32px; color:#E6EBEF; }
  ul.checks li i { position:absolute; left:2px; top:9px; width:20px; height:20px; border-radius:50%; background:#2F9E5F; }
  ul.checks li i::after { content:""; position:absolute; left:6px; top:4px; width:5px; height:9px; border:solid #fff; border-width:0 2.5px 2.5px 0; transform:rotate(45deg); }
  ul.checks li b { color:#F2F5F7; }
  .schritte { list-style:none; margin:0; padding:0; counter-reset:s; }
  .schritte li { position:relative; padding:6px 0 6px 34px; color:#B4BFC9; }
  .schritte li::before { counter-increment:s; content:counter(s); position:absolute; left:0; top:5px; width:24px; height:24px; border-radius:50%; background:#1B6FA8; color:#fff; font-weight:700; font-size:.85rem; display:flex; align-items:center; justify-content:center; }
  .schritte li b { color:#F2F5F7; }
  .quelle { margin:10px 0 0; font-size:.78rem; color:#7C8A97; }
  /* Vorschau mit dem Namen des Betriebs: Handy im Demo-Look, daneben der Knopf */
  .vorschau { display:grid; grid-template-columns:minmax(0,1fr); gap:22px; align-items:center; margin:6px 0 36px; padding:22px; border-radius:18px; background:linear-gradient(160deg,#111c27,#0d141b); border:1px solid #243039; }
  @media (min-width:600px) { .vorschau { grid-template-columns:220px minmax(0,1fr); } }
  .mock { justify-self:center; width:220px; padding:7px; border-radius:28px; background:#1E293B; box-shadow:0 18px 40px rgba(0,0,0,.5); }
  .mock-bild { position:relative; height:440px; border-radius:22px; overflow:hidden; background:#0b1118 url('/brief/mock-hero.jpg') 30% center/cover; }
  .mock-bild::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,15,20,.8) 0%, rgba(10,15,20,.05) 30%, rgba(10,15,20,.25) 48%, rgba(10,15,20,.92) 72%); }
  .mock-inhalt { position:absolute; inset:0; z-index:1; display:flex; flex-direction:column; padding:16px 14px; }
  .mock-marke { font-size:.6rem; letter-spacing:.14em; text-transform:uppercase; color:#94A3B8; }
  .mock-name { font-family:Georgia, "Times New Roman", serif; font-size:1.02rem; font-weight:700; color:#fff; line-height:1.2; margin-top:2px; }
  .mock-text { margin-top:auto; }
  .mock-eyebrow { font-size:.58rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#4DA3E0; margin:0 0 6px; }
  .mock-titel { font-family:Georgia, "Times New Roman", serif; font-size:1.25rem; font-weight:700; line-height:1.15; color:#fff; margin:0 0 8px; }
  .mock-unter { font-size:.66rem; color:#CBD5E1; margin:0 0 12px; line-height:1.45; }
  .mock-knopf { display:block; text-align:center; font-size:.66rem; font-weight:600; padding:8px; border-radius:6px; margin-top:6px; }
  .mock-knopf.voll { background:#1B6FA8; color:#fff; }
  .mock-knopf.rand { border:1px solid #CBD5E1; color:#fff; }
  .mock-marken { display:flex; flex-wrap:wrap; gap:4px; margin:0 0 10px; }
  .mock-marken span { font-size:.56rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:3px 7px; border-radius:999px; background:rgba(255,255,255,.12); color:#E2E8F0; }
  .mock-zeiten { font-size:.56rem; color:#94A3B8; margin:8px 0 0; line-height:1.4; }
  .vorschau h2 { margin-bottom:8px; }
  /* Verwaltungsbereich als Wischleiste – ohne Bibliothek, mit Einrast-Scrollen */
  .slider { position:relative; }
  .slides { display:flex; gap:14px; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; -webkit-overflow-scrolling:touch; padding-bottom:4px; }
  .slides::-webkit-scrollbar { display:none; }
  .slide { flex:0 0 100%; scroll-snap-align:center; margin:0; }
  .slide .browser { margin-bottom:12px; }
  .slider + .checks { margin-top:18px; }
  .fuss span { flex-basis:100%; font-size:.74rem; }
  .slide figcaption { color:#B4BFC9; font-size:.94rem; }
  .slide figcaption b { color:#F2F5F7; display:block; margin-bottom:2px; }
  .slider-nav { display:flex; align-items:center; justify-content:center; gap:14px; margin-top:14px; }
  .slider-nav button { width:38px; height:38px; border-radius:50%; border:1px solid #243039; background:#111820; color:#F2F5F7; font-size:1.1rem; cursor:pointer; }
  .slider-nav button:hover { border-color:#4DA3E0; }
  .punkte { display:flex; gap:8px; }
  .punkte i { width:8px; height:8px; border-radius:50%; background:#334155; transition:background .2s ease, width .2s ease; }
  .punkte i.an { background:#4DA3E0; width:22px; border-radius:999px; }
  .preis { display:grid; gap:10px; }
  .preis div { display:flex; gap:12px; align-items:flex-start; }
  .preis div::before { content:""; flex:none; margin-top:9px; width:8px; height:8px; border-radius:50%; background:#4DA3E0; }
  .preis p { margin:0; }
  .preis b { color:#F2F5F7; }
  .vorschau p { margin-bottom:16px; }
  form { display:grid; gap:12px; margin-top:16px; }
  label { font-size:.85rem; color:#B4BFC9; display:block; }
  .referenz p { margin:0 0 14px; color:#E6EBEF; }
  .referenz .knopf { white-space:normal; text-align:center; }
  .vorschau-hinweis { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:28px; text-decoration:none; color:inherit; border-color:#2F9E5F; background:linear-gradient(180deg, #13261d, #111820); }
  .vorschau-hinweis b { display:block; font-size:1.1rem; margin-bottom:4px; }
  .vorschau-hinweis span:first-child { flex:1; min-width:220px; color:#B4BFC9; }
  .vorschau-hinweis .knopf { background:#2F9E5F; }
  .kontakt-karte { border-color:#1B6FA8; background:linear-gradient(180deg, #13202b, #111820); }
  .kontakt-karte h2 { margin-bottom:4px; }
  .kontakt-karte p { margin:0 0 14px; color:#B4BFC9; }
  .kontakt-karte .klein { margin:10px 0 0; }
  .kontakt-karte .knopf.erledigt { background:#2F9E5F; cursor:default; }
  input[type=email], input[type=tel], select { width:100%; font-size:1.05rem; padding:12px 14px; border-radius:10px; border:1px solid #243039; background:#182129; color:#F2F5F7; font:inherit; }
  input:focus, select:focus { outline:none; border-color:#4DA3E0; box-shadow:0 0 0 3px rgba(77,163,224,.18); }
  .fax { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }
  .meldung { font-size:.92rem; margin-top:8px; }
  .meldung.ok { color:#6fcf97; }
  .meldung.fehler { color:#f2a0a0; }
  .kontakt { display:flex; flex-wrap:wrap; gap:8px 22px; }
  .fuss { border-top:1px solid #243039; margin-top:48px; padding-top:20px; font-size:.82rem; color:#7C8A97; display:flex; flex-wrap:wrap; gap:8px 20px; }
  .fuss a { color:#7C8A97; }
  .klein { font-size:.8rem; color:#7C8A97; }
`;

const KOPF_HTML = `<a class="kopf" href="${STARTSEITE}">
  <svg viewBox="0 0 100 100" aria-hidden="true"><path d="${BILDMARKE}" fill="#4DA3E0"/></svg>
  <div><b>AIY</b><span>Ihsan Yilmaz · Webentwicklung</span></div>
</a>`;

export function seite({ titel, inhalt, status = 200 }) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${esc(titel)}</title>
<style>${CSS}</style></head>
<body><div class="huelle">${KOPF_HTML}${inhalt}</div></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function nichtGefunden() {
  return seite({
    titel: 'Seite nicht gefunden', status: 404,
    inhalt: `<p class="eyebrow">Persönliche Seite</p><h1>Diese Seite gibt es nicht</h1>
      <p>Der Link ist unvollständig oder nicht mehr gültig. Bitte prüfen Sie die Adresse aus dem Brief.</p>
      <p><a class="knopf" href="${STARTSEITE}">Zur Startseite</a></p>`,
  });
}

// Brief + Betrieb zu einem Token. Null, wenn das Token unbekannt ist. Der
// Status spielt keine Rolle: auch ein stornierter Brief kann schon im
// Briefkasten liegen, und ein Entwurf wird im Cockpit als Vorschau geoeffnet.
export async function briefZuToken(env, token) {
  if (!TOKEN_RE.test(token || '') || !env.DB) return null;
  const z = await env.DB.prepare(
    `SELECT br.id, br.token, br.status, br.befunde, br.angelegt, br.gesendet_am,
            b.id AS betrieb_id, b.name, b.ort, b.art, b.marken, b.telefon, b.oeffnungszeiten,
            b.status AS betrieb_status, b.geprueft_am, b.google_stand,
            b.strasse, b.plz, b.lat, b.lng, b.google_bewertung, b.google_anzahl, br.art AS brief_art
     FROM akquise_briefe br LEFT JOIN akquise_betriebe b ON b.id = br.betrieb_id
     WHERE br.token = ?`,
  ).bind(token).first();
  if (!z) return null;
  let befunde = [];
  try { const p = JSON.parse(z.befunde || '[]'); if (Array.isArray(p)) befunde = p; } catch { /* leer */ }
  return { ...z, befunde };
}

// Der Widerspruchsweg (/fuer/<token>/nein) steht im Brief selbst (DSGVO-Hinweis);
// die Seite /nein bleibt erreichbar, im Fuss hier verlinkt sie nicht mehr.
function fussHtml(token, osm = false) {
  return `<div class="fuss">
    <a href="${STARTSEITE}/impressum">Impressum</a>
    <a href="${STARTSEITE}/datenschutz">Datenschutz</a>
    ${osm ? '<span>Angaben teils aus OpenStreetMap (© OpenStreetMap-Mitwirkende)</span>' : ''}
  </div>`;
}

// Referenz-Satz aus den Einstellungen: die erste Domain darin (z. B.
// autohaus-diezmann.de) wird zum Link und bekommt einen eigenen Knopf.
const DOMAIN_RE = /\b((?:[a-z0-9-]+\.)+(?:de|com|net|eu|info))\b/i;
function referenzUrl(text) {
  const m = String(text || '').match(DOMAIN_RE);
  return m ? `https://${m[1].toLowerCase()}` : '';
}
function referenzHtml(text) {
  const url = referenzUrl(text);
  const sicher = esc(text);
  return url ? sicher.replace(DOMAIN_RE, d => `<a href="${esc(url)}" target="_blank" rel="noopener">${d}</a>`) : sicher;
}

// Wischleiste aus Browser-Bildern; Pfeile und Punkte steuert das Skript unten.
function sliderHtml(slides, praefix) {
  return `<div class="slider">
    <div class="slides">
      ${slides.map(f => `<figure class="slide">
        <div class="browser"><div class="leiste"><i></i><i></i><i></i><span>${esc(praefix)} · ${esc(f.titel)}</span></div><img src="${f.bild}" alt="${esc(f.titel)} – Demo" loading="lazy"></div>
        <figcaption><b>${esc(f.titel)}</b>${esc(f.text)}</figcaption>
      </figure>`).join('')}
    </div>
    <div class="slider-nav">
      <button type="button" class="zurueck" aria-label="Vorheriges Bild">‹</button>
      <span class="punkte">${slides.map((_, i) => `<i${i ? '' : ' class="an"'}></i>`).join('')}</span>
      <button type="button" class="weiter" aria-label="Nächstes Bild">›</button>
    </div>
  </div>`;
}

export async function onRequestGet({ request, params, env, waitUntil }) {
  const token = String(params.token || '');
  const brief = await briefZuToken(env, token).catch(() => null);
  if (!brief) return nichtGefunden();
  const vorschau = brief.betrieb_id ? await vorschauLaden(env, brief.betrieb_id).catch(() => null) : null;
  // Der QR-Code des zweiten Briefs fuehrt direkt zur Website-Vorschau, wenn es
  // eine gibt; die persoenliche Seite bleibt ueber den Hinweis oben erreichbar
  // (?seite=1). Der Aufruf wird dort gezaehlt.
  const url = new URL(request.url);
  if (vorschau && brief.brief_art === 'nachfass' && !url.searchParams.has('seite')) {
    return Response.redirect(new URL(`/fuer/${token}/website`, request.url).toString(), 302);
  }

  // Zaehlen – hoechstens einmal je Minute je Token (also max. 60 je Stunde).
  // Nicht gezaehlt: eigene Geraete (Admin-Login, siehe eigenerAufruf),
  // Testbriefe und die ersten zwei Tage nach dem Versand – da kann der Brief
  // noch nicht angekommen sein, Aufrufe sind dann eigene Kontrollen.
  if (!(await eigenerAufruf(request, env))) {
    // Beim allerersten Aufruf eine Mail an mich – dann weiss ich, wer reagiert.
    const zaehlung = env.DB.prepare(
      `UPDATE akquise_briefe SET aufrufe = aufrufe + 1, zuletzt_aufgerufen = datetime('now')
       WHERE id = ? AND art != 'test' AND gesendet_am IS NOT NULL AND gesendet_am <= datetime('now', '-2 days')
         AND (zuletzt_aufgerufen IS NULL OR zuletzt_aufgerufen < datetime('now', '-60 seconds'))
       RETURNING aufrufe, betrieb_id`,
    ).bind(brief.id).first()
      .then(z => (z && z.aufrufe === 1 ? betriebMelden(env, request, z.betrieb_id, 'Persönliche Seite geöffnet') : null))
      .catch(() => {});
    if (typeof waitUntil === 'function') waitUntil(zaehlung); else await zaehlung;
  }

  const e = await postEinstellungenLaden(env).catch(() => null);
  const telefon = e?.absender?.telefon || '';
  const email = e?.absender?.email || KONTAKT;
  const referenz = e?.referenz || '';
  const firma = brief.name || 'Ihren Betrieb';
  // Was die Vorschau persoenlich macht – nur aus OpenStreetMap (Marken,
  // Oeffnungszeiten), nichts von der Website des Betriebs. Die Quelle steht
  // im Fuss.
  const marken = String(brief.marken || '').split(/[;,]/).map(m => m.trim()).filter(Boolean).slice(0, 3);
  const zeitenRoh = String(brief.oeffnungszeiten || '').trim();
  const zeiten = zeitenRoh && zeitenRoh.length <= 70 ? zeitenRoh.replace(/\s*;\s*/g, ' · ').replace(/(\d\d:\d\d)-(\d\d:\d\d)/g, '$1–$2') : '';
  const ausOsm = marken.length || zeiten;
  // Werkstatt-Texte nur, wenn der Name nicht nach Autohaus klingt.
  const werkstatt = brief.art === 'car_repair' && !/autohaus|automobil|autohandel/i.test(firma);

  const befundeHtml = brief.befunde.length
    ? `<ul class="befunde">${brief.befunde.map(b => {
        const label = CHECK_LABELS[b.code];
        return `<li${b.code === 'google_note' ? ' class="gruen"' : ''}>${label ? `<b>${esc(label)}</b>` : ''}${esc(b.text)}</li>`;
      }).join('')}</ul>`
    : '<p>Die Punkte stehen in Ihrem Brief.</p>';
  const quelle = quellenZeile(brief.befunde, brief.geprueft_am, brief.google_stand);
  const checks = rueckChecks(brief.befunde);
  const telLink = telefon ? `tel:${esc(telefon.replace(/[^\d+]/g, ''))}` : '';
  const TELEFON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';

  // Dieselben Bausteine wie der Brief: Befunde mit Stichwort, die drei Haken,
  // die Demo-Ausschnitte, drei Schritte – und die Knoepfe gross, weil die
  // meisten die Seite auf dem Handy oeffnen.
  const inhalt = `
    <p class="eyebrow">Persönliche Seite</p>
    <h1>Für ${esc(firma)}</h1>
    <p class="unter">${esc([brief.ort, 'zu meinem Brief an Sie'].filter(Boolean).join(' · '))}</p>

    ${vorschau ? `<a class="karte vorschau-hinweis" href="/fuer/${esc(token)}/website">
      <span><b>Ihre Website-Vorschau ist fertig</b>So könnte die Website von ${esc(firma)} aussehen – mit Ihrem Namen, Ihren Öffnungszeiten und Marken.</span>
      <span class="knopf">Vorschau ansehen</span>
    </a>` : ''}

    <div class="vorschau">
      <div class="mock" aria-hidden="true">
        <div class="mock-bild"><div class="mock-inhalt">
          ${new RegExp(werkstatt ? 'werkstatt' : 'autohaus', 'i').test(firma) ? '' : `<span class="mock-marke">${werkstatt ? 'Kfz-Werkstatt' : 'Autohaus'}</span>`}
          <span class="mock-name">${esc(firma)}</span>
          <div class="mock-text">
            ${marken.length ? `<div class="mock-marken">${marken.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
            <p class="mock-eyebrow">${esc([werkstatt ? 'Werkstatt' : 'Autohaus', brief.ort ? `in ${brief.ort}` : ''].filter(Boolean).join(' '))}</p>
            <p class="mock-titel">${werkstatt ? 'Ihr Auto in guten Händen.' : 'Gute Autos. Ehrliche Preise.'}</p>
            <p class="mock-unter">${werkstatt ? 'Inspektion, Reparatur und Reifen – Termin direkt online.' : 'Gebrauchtwagen, Ankauf und Werkstatt – alles unter einem Dach.'}</p>
            <span class="mock-knopf voll">${werkstatt ? 'Termin anfragen' : 'Fahrzeuge ansehen'}</span>
            <span class="mock-knopf rand">Kontakt aufnehmen</span>
            ${zeiten ? `<p class="mock-zeiten">Geöffnet: ${esc(zeiten)}</p>` : ''}
          </div>
        </div></div>
      </div>
      <div>
        <h2>So könnte Ihre Startseite aussehen</h2>
        <p>Ein erster Eindruck mit Ihrem Namen – dahinter die fertige Demo zum Durchklicken.</p>
        <a class="knopf gross" id="demo-knopf" href="${DEMO_URL}" target="_blank" rel="noopener">Demo jetzt ansehen</a>
      </div>
    </div>

    <section>
      <div class="karte kontakt-karte">
        <h2>Interesse?</h2>
        <p>Ein Klick genügt – ich melde mich per Telefon oder E-Mail bei Ihnen.</p>
        <button class="knopf gross" type="button" id="kontakt-knopf">Ja, bitte melden Sie sich</button>
        <p class="meldung" id="kontakt-meldung" aria-live="polite"></p>
        <p class="klein">Damit erlauben Sie mir, ${esc(firma)} zu diesem Angebot per Telefon oder E-Mail zu kontaktieren. Sie können das jederzeit formlos widerrufen.</p>
      </div>
    </section>

    <section>
      <h2>Das ist mir aufgefallen</h2>
      <div class="karte">${befundeHtml}${quelle ? `<p class="quelle">${esc(quelle)}</p>` : ''}</div>
    </section>

    <section>
      <h2>So kann Ihre Website aussehen</h2>
      ${sliderHtml(WEB_SLIDES, 'Demo')}
      <ul class="checks">${checks.map(c => `<li><i></i><b>${esc(c.label)}</b> – ${esc(c.text)}</li>`).join('')}</ul>
    </section>

    <section>
      <h2>Dahinter: Ihr Verwaltungsbereich</h2>
      <p>Änderungen machen Sie selbst – ohne Agentur, ohne Wartezeit.</p>
      ${sliderHtml(ADMIN_SLIDES, 'Verwaltung')}
    </section>

    ${referenz ? `<section>
      <h2>Bereits im Einsatz</h2>
      <div class="karte referenz">
        <p>${referenzHtml(referenz)}</p>
        ${referenzUrl(referenz) ? `<a class="knopf gross leise" href="${esc(referenzUrl(referenz))}" target="_blank" rel="noopener">Website live ansehen</a>` : ''}
      </div>
    </section>` : ''}

    <section>
      <h2>Was es kostet</h2>
      <div class="karte preis">
        <div><p><b>Festpreis vorab</b> – keine versteckten Kosten.</p></div>
        <div><p><b>Bezahlbar durch KI-Werkzeuge</b> – wenig Aufwand, kleiner Preis.</p></div>
        <div><p><b>Ein Ansprechpartner aus Würzburg</b> – ohne Agentur dazwischen.</p></div>
      </div>
    </section>

    <section>
      <h2>So geht es weiter</h2>
      <ol class="schritte">
        <li><b>Demo ansehen</b> – direkt oben, ohne Anmeldung.</li>
        <li><b>Kontakt erlauben</b> – ein Klick, ich melde mich.</li>
        <li><b>Angebot</b> – zum Festpreis, unverbindlich.</li>
      </ol>
    </section>

    <section>
      <div class="karte">
        <h2 style="font-size:1.05rem">Admin-Zugang</h2>
        <p>Den Verwaltungsbereich zeige ich Ihnen gern – der Zugang kommt per E-Mail.</p>
        <form id="demo" autocomplete="off">
          <div><label for="email">Ihre E-Mail-Adresse</label><input type="email" id="email" name="email" required maxlength="254" placeholder="name@autohaus.de"></div>
          <input type="hidden" name="auswahl" value="autohaus">
          <div class="fax" aria-hidden="true"><label>Fax<input type="text" name="fax" tabindex="-1" autocomplete="off"></label></div>
          <div class="aktionen">
            <button class="knopf gross" type="submit">Admin-Zugang anfordern</button>
            ${telefon ? `<a class="knopf gross leise" href="${telLink}" aria-label="Anrufen: ${esc(telefon)}">${TELEFON_SVG}${esc(telefon)}</a>` : ''}
          </div>
          <p class="meldung" id="meldung" aria-live="polite"></p>
        </form>
      </div>
    </section>

    <section>
      <h2>Direkt erreichbar</h2>
      <p class="kontakt">
        ${telefon ? `<a href="${telLink}">${esc(telefon)}</a>` : ''}
        <a href="mailto:${esc(email)}">${esc(email)}</a>
        <a href="${STARTSEITE}" target="_blank" rel="noopener">ihsan-yilmaz.de</a>
        <a href="${INSTAGRAM}" target="_blank" rel="noopener">Instagram @aiy.web</a>
      </p>
      <p class="klein">Rückruf bis zum nächsten Werktag.</p>
    </section>
    ${fussHtml(token, ausOsm)}
    <script>
      (function () {
        // Wischleisten: Pfeile und Punkte je Leiste
        document.querySelectorAll('.slider').forEach(function (w) {
          var sl = w.querySelector('.slides'), pk = w.querySelectorAll('.punkte i');
          var gehe = function (d) { sl.scrollBy({ left: d * sl.clientWidth, behavior: 'smooth' }); };
          w.querySelector('.zurueck').addEventListener('click', function () { gehe(-1); });
          w.querySelector('.weiter').addEventListener('click', function () { gehe(1); });
          sl.addEventListener('scroll', function () {
            var i = Math.round(sl.scrollLeft / sl.clientWidth);
            pk.forEach(function (p, j) { p.className = j === i ? 'an' : ''; });
          }, { passive: true });
        });
        // Klick auf „Demo jetzt ansehen“ merken – der Link oeffnet die Demo trotzdem sofort.
        var dk = document.getElementById('demo-knopf');
        if (dk) dk.addEventListener('click', function () {
          var b = JSON.stringify({ token: ${JSON.stringify(token)}, aktion: 'demo' });
          try { navigator.sendBeacon('/api/fuer', new Blob([b], { type: 'application/json' })); }
          catch (e) { fetch('/api/fuer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: b, keepalive: true }); }
        });
        var kk = document.getElementById('kontakt-knopf'), km = document.getElementById('kontakt-meldung');
        kk.addEventListener('click', function () {
          kk.disabled = true; km.textContent = ''; km.className = 'meldung';
          fetch('/api/fuer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ${JSON.stringify(token)}, aktion: 'kontakt' }) })
            .then(function (r) { return r.json().catch(function () { return {}; }); })
            .then(function (a) {
              if (a && a.ok) { kk.textContent = 'Danke – ich melde mich'; kk.className = 'knopf gross erledigt'; km.textContent = 'In den nächsten Tagen, per Telefon oder E-Mail.'; km.className = 'meldung ok'; }
              else { kk.disabled = false; km.textContent = 'Das hat nicht geklappt. Rufen Sie mich gern direkt an.'; km.className = 'meldung fehler'; }
            })
            .catch(function () { kk.disabled = false; km.textContent = 'Keine Verbindung. Bitte später noch einmal versuchen.'; km.className = 'meldung fehler'; });
        });
        var f = document.getElementById('demo'), m = document.getElementById('meldung');
        f.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var b = f.querySelector('button'); b.disabled = true; m.textContent = 'Wird gesendet …'; m.className = 'meldung';
          var d = { email: f.email.value, auswahl: f.auswahl.value, sprache: 'de', fax: f.fax.value, token: ${JSON.stringify(token)} };
          fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
            .then(function (r) { return r.json().catch(function () { return {}; }); })
            .then(function (a) {
              if (a && a.ok) { m.textContent = a.bereits ? 'Die Links wurden an diese Adresse bereits geschickt – bitte ins Postfach schauen.' : 'Danke – die Links sind unterwegs.'; m.className = 'meldung ok'; f.email.value = ''; }
              else { m.textContent = a && a.fehler === 'ungueltig' ? 'Bitte eine gültige E-Mail-Adresse angeben.' : 'Das hat nicht geklappt. Schreiben Sie mir kurz an ${esc(email)}.'; m.className = 'meldung fehler'; }
            })
            .catch(function () { m.textContent = 'Keine Verbindung. Bitte später noch einmal versuchen.'; m.className = 'meldung fehler'; })
            .then(function () { b.disabled = false; });
        });
      })();
    </script>`;

  return seite({ titel: `Für ${firma} – Ihsan Yilmaz`, inhalt });
}
