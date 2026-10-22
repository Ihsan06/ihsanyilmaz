// Steckbrief einer Website-Vorschau: wie die Seite fuer einen Betrieb
// aussieht – Farben, Logo, Marken, Beispielfahrzeuge.
//
// Rechtsrahmen (Recherche 2026-10-22, gegengeprueft):
// - Farben eines lokalen Betriebs sind frei (kein Werk, keine Farbmarke mit
//   Verkehrsdurchsetzung). Ausgelesen wird nur aus dem oeffentlichen HTML/CSS
//   seiner eigenen Website. Hersteller-CI (Renault-Gelb usw.) wird NICHT
//   uebernommen – die gehoert dem Hersteller, nicht dem Haendler.
// - Kein Logo-Nachbau (§§ 16, 23 UrhG): der Name des Betriebs als Schriftzug,
//   daneben ein Monogramm aus seinen Initialen oder ein Symbol aus dem
//   eigenen Katalog unten. Keine Hersteller-Bildmarken.
// - Marken nur als Wort (§ 23 Abs. 1 Nr. 3 MarkenG), nie „Vertragshaendler“.
import { fahrzeugeWaehlen, markeNormal } from './fahrzeugpool.js';

// Dunkles Thema wie die Demo; je Palette Knopf (weisse Schrift drauf) und
// Akzent (Schrift auf dunklem Grund).
export const PALETTEN = {
  nachtblau: { name: 'Nachtblau', knopf: '#1B6FA8', akzent: '#4DA3E0' },
  rot: { name: 'Rot', knopf: '#B3262E', akzent: '#F0757A' },
  gruen: { name: 'Grün', knopf: '#1F7A4D', akzent: '#52C48E' },
  orange: { name: 'Orange', knopf: '#B85410', akzent: '#F59E4B' },
  petrol: { name: 'Petrol', knopf: '#0F766E', akzent: '#3CC4B6' },
  violett: { name: 'Violett', knopf: '#5B3FB0', akzent: '#A58FF0' },
  graphit: { name: 'Graphit', knopf: '#475569', akzent: '#C3CDD9' },
};

// Eigene, schlichte Symbole (24er Raster, Strich) – bewusst nichts, was an
// ein Hersteller-Emblem erinnert.
export const SYMBOLE = {
  strasse: { name: 'Straße', pfad: 'M8 21c0-6 8-9 8-15M12 3v2.5M12 9.5v2.5M12 16v2.5', zusatz: 'M4 21 9.5 3M20 21 14.5 3' },
  lenkrad: { name: 'Lenkrad', pfad: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3.5 10.5l6.1 1M14.4 11.5l6.1-1M12 14.5V21' },
  tacho: { name: 'Tacho', pfad: 'M3.5 17a9 9 0 1 1 17 0M12 15l4.5-5.5M12 15a1.6 1.6 0 1 0 0 .01M6.3 9.8l1.2.9M12 6.5V8M17.7 9.8l-1.2.9' },
  schild: { name: 'Schild', pfad: 'M12 3l7.5 3v5.5c0 4.7-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.8-7.5-9.5V6z', zusatz: 'M8.5 12.2l2.4 2.4 4.6-5' },
  berge: { name: 'Hügel', pfad: 'M2.5 19l6-8 3.5 4.5 3-3.5 6.5 7z', zusatz: 'M2.5 19h19' },
  schluessel: { name: 'Schlüssel', pfad: 'M14.5 4a5.5 5.5 0 1 0 .01 0zM10.6 13.4 3.5 20.5M6 18l2.5 2.5M8.5 15.5 11 18', zusatz: 'M15.8 7.2a1.4 1.4 0 1 0 .01 0z' },
  blitz: { name: 'Blitz', pfad: 'M13.5 2.5 5 13.5h6.5L10.5 21.5 19 10.5h-6.5z' },
  stern: { name: 'Kompass', pfad: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z' },
};

// Woerter, die im Monogramm nichts verloren haben: Rechtsform, Branche und
// Herstellernamen (das Monogramm soll den Betrieb zeigen, nicht die Marke).
const FUELL = /^(autohaus|auto|autos|automobile?|automobil|automobiles|autohandel|kfz|kfz-handel|handel|gmbh|ug|kg|ohg|gbr|e\.?k\.?|co\.?|und|&|\+|der|die|das|am|an|im|in|bei|von|cars|car|motors?|service|center|centrum|zentrum|garage|werkstatt|gebrauchtwagen|fahrzeuge|fahrzeughandel)$/i;

export function initialen(name) {
  const teile = String(name || '').replace(/[()„“"']/g, ' ').split(/[\s/-]+/).filter(Boolean);
  const kern = teile.filter(t => !FUELL.test(t) && !markeNormal(t) && /\p{L}/u.test(t));
  const quelle = kern.length ? kern : teile.filter(t => /\p{L}/u.test(t));
  return quelle.slice(0, 2).map(t => t.match(/\p{L}/u)[0].toUpperCase()).join('') || 'A';
}

// ---------------------------------------------------------------- Farben

const hexZuRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbZuHex = ([r, g, b]) => '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
function luminanz(hex) {
  const [r, g, b] = hexZuRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function kontrast(a, b) {
  const [x, y] = [luminanz(a), luminanz(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
function hsl(hex) {
  const [r, g, b] = hexZuRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
  return { s, l };
}
const mischen = (a, b, t) => rgbZuHex(hexZuRgb(a).map((v, i) => v + (hexZuRgb(b)[i] - v) * t));

const GRUND = '#0A0F14';
// Aus einer Markenfarbe eine Palette machen, die lesbar bleibt: der Knopf
// traegt weisse Schrift (Kontrast >= 4.5), der Akzent steht auf dunklem Grund
// (Kontrast >= 4.5). Notfalls wird abgedunkelt bzw. aufgehellt.
export function paletteAusFarbe(hex) {
  let knopf = hex.toUpperCase();
  for (let i = 0; i < 12 && kontrast(knopf, '#FFFFFF') < 4.5; i++) knopf = mischen(knopf, '#000000', 0.12);
  let akzent = hex.toUpperCase();
  for (let i = 0; i < 12 && kontrast(akzent, GRUND) < 4.5; i++) akzent = mischen(akzent, '#FFFFFF', 0.14);
  return { name: 'Von der Website', knopf, akzent, quelle: hex.toUpperCase() };
}

// Farbe der eigenen Website des Betriebs: theme-color, sonst die haeufigste
// kraeftige Farbe im HTML und in bis zu zwei Stylesheets desselben Hosts.
// Boersen-Seiten (home.mobile.de …) zeigen die Boerse, nicht den Betrieb.
export async function farbeVonWebsite(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return null; }
  // Am Host pruefen, nicht an der ganzen Adresse: „papke-automobile.de“ ist keine Boerse.
  if (/(^|\.)(mobile\.de|autoscout24\.[a-z]+|ebay\.[a-z]+|kleinanzeigen\.de|facebook\.com|instagram\.com|google\.[a-z]+)$/i.test(host)) return null;
  const holen = async (u, ms = 7000) => {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIY-Website-Check/1.0; +https://ihsan-yilmaz.de)' }, signal: AbortSignal.timeout(ms), redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.text()).slice(0, 600000);
  };
  let html;
  try { html = await holen(url); } catch { return null; }
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["'](#[0-9a-f]{6}|#[0-9a-f]{3})["']/i)
    || html.match(/<meta[^>]+content=["'](#[0-9a-f]{6}|#[0-9a-f]{3})["'][^>]*name=["']theme-color["']/i);
  const lang = h => (h.length === 4 ? '#' + [...h.slice(1)].map(c => c + c).join('') : h).toUpperCase();
  const kraeftig = h => { const { s, l } = hsl(h); return s > 0.35 && l > 0.18 && l < 0.7; };
  if (theme && kraeftig(lang(theme[1]))) return lang(theme[1]);

  // Eingebettetes CSS, style-Attribute und alte color/bgcolor-Attribute.
  // Die Standardpalette von WordPress (--wp--preset--color) gehoert nicht
  // zum Betrieb und wird herausgefiltert.
  let css = [
    ...(html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []),
    ...(html.match(/style=["'][^"']*["']/gi) || []),
    ...(html.match(/\b(?:bg)?color=["']?#[0-9a-f]{3,6}/gi) || []),
  ].join('\n').replace(/--wp--preset--[^;]+;/g, '');
  const basis = new URL(url);
  // Eigene Stylesheets zuerst (Theme, Elementor-Kit), Bibliotheken und Plugins nie.
  const rang = p => (/elementor\/css\/post-|\/themes\/|style\.css|main|custom|theme|site/i.test(p) ? 0 : 1);
  const links = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
    .map(m => (m[0].match(/href=["']([^"']+)["']/i) || [])[1]).filter(Boolean)
    .map(h => { try { return new URL(h, basis); } catch { return null; } })
    .filter(u => u && u.host.replace(/^www\./, '') === basis.host.replace(/^www\./, '')
      && !/bootstrap|fontawesome|font-awesome|jquery|wp-includes|\/plugins\/|elementor\/assets|swiper|slick|lightbox|animate/i.test(u.pathname))
    .sort((a, b) => rang(a.pathname) - rang(b.pathname)).slice(0, 3);
  for (const l of links) { try { css += '\n' + (await holen(l.href, 5000)).replace(/--wp--preset--[^;]+;/g, ''); } catch { /* weiter */ } }

  const zaehl = new Map();
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const h = lang('#' + m[1]);
    if (kraeftig(h)) zaehl.set(h, (zaehl.get(h) || 0) + 1);
  }
  const best = [...zaehl.entries()].sort((a, b) => b[1] - a[1])[0];
  // Bei alten Seiten reicht eine Farbe einmal im Markup; sonst mind. dreimal.
  return best && (best[1] >= 3 || zaehl.size === 1) ? best[0] : null;
}

// ---------------------------------------------------------------- Steckbrief

export const LOGO_ARTEN = { monogramm: 'Monogramm', symbol: 'Symbol', schrift: 'Nur Schriftzug' };

// Vollstaendiger Steckbrief aus dem Betrieb und den Wuenschen aus dem Admin.
// wunsch: { palette?, farbe?, logo?, symbol?, marken?, fahrzeuge?, mischung? }
// Was fehlt, wird vorgeschlagen; die Website wird nur gelesen, wenn keine
// Palette gewuenscht ist und noch keine Farbe vorliegt.
export async function steckbriefBauen(b, wunsch = {}, alt = null) {
  const marken = (Array.isArray(wunsch.marken) ? wunsch.marken
    : String(b.marken || '').split(/[;,]/)).map(m => String(m).trim()).filter(Boolean).slice(0, 4);

  let websiteFarbe = wunsch.farbe !== undefined ? wunsch.farbe : (alt?.website_farbe ?? undefined);
  if (websiteFarbe === undefined) websiteFarbe = await farbeVonWebsite(b.website).catch(() => null);
  if (websiteFarbe && !/^#[0-9A-F]{6}$/i.test(websiteFarbe)) websiteFarbe = null;

  const paletteSchluessel = wunsch.palette || alt?.palette || (websiteFarbe ? 'website' : 'nachtblau');
  const palette = paletteSchluessel === 'website' && websiteFarbe ? paletteAusFarbe(websiteFarbe)
    : { ...(PALETTEN[paletteSchluessel] || PALETTEN.nachtblau) };

  const logo = LOGO_ARTEN[wunsch.logo] ? wunsch.logo : (alt?.logo || 'monogramm');
  const symbol = SYMBOLE[wunsch.symbol] ? wunsch.symbol : (alt?.symbol || 'strasse');
  const mischung = Number.isInteger(wunsch.mischung) ? wunsch.mischung : (alt?.mischung ?? 0);
  const fahrzeuge = Array.isArray(wunsch.fahrzeuge) && wunsch.fahrzeuge.length
    ? wunsch.fahrzeuge
    : fahrzeugeWaehlen(marken, 6, b.id * 7 + mischung).map(f => f.id);

  return {
    palette: paletteSchluessel === 'website' ? (websiteFarbe ? 'website' : 'nachtblau') : (PALETTEN[paletteSchluessel] ? paletteSchluessel : 'nachtblau'),
    farben: { knopf: palette.knopf, akzent: palette.akzent },
    website_farbe: websiteFarbe || null,
    logo, symbol, initialen: initialen(b.name),
    marken, fahrzeuge, mischung,
  };
}
