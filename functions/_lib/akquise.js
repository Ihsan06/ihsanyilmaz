// Akquise: Websites von Autohaeusern pruefen und bewerten.
//
// Alles hier sind reine Funktionen bzw. Funktionen, die nur fetch brauchen –
// damit sie sich ohne Worker mit node testen lassen. Ganz unten stehen die
// D1-Helfer, die die Endpunkte unter /api/admin/akquise/* gemeinsam nutzen.
//
// Zwei Zahlen je Betrieb:
//   score_website  Schwaeche der Website 0–100 (hoch = schlecht)
//   score_betrieb  Staerke des Betriebs   0–100 (hoch = etabliert)
//   prioritaet     round(0.6 * schwaeche + 0.4 * staerke)
// Ziel: etablierte Betriebe mit vernachlaessigter Website ganz oben.
//
// Wayback holt seit Runde 2 der Browser (archive.org/wayback/available
// sendet Access-Control-Allow-Origin *, der CDX-Dienst nicht) und schickt
// die Werte per PATCH /pruefen – die Function wartet nicht mehr darauf.

export const UA_CHECK = 'Mozilla/5.0 (compatible; AIY-Website-Check/1.0; +https://ihsan-yilmaz.de)';
const HTML_MAX_BYTES = 400 * 1024;   // mehr HTML braucht die Auswertung nicht
const FETCH_TIMEOUT_MS = 12_000;
const RATEN_TIMEOUT_MS = 6_000;      // je Kandidat beim Raten der Website
const CDX_FALLBACK_MS = 8_000;       // Server-Fallback fuer den ersten Snapshot

export const KATEGORIEN = ['ohne_website', 'nur_boerse', 'baukasten', 'veraltet', 'mittel', 'gepflegt'];
export const WEBSITE_QUELLEN = ['osm', 'manuell', 'vermutet', 'bestaetigt', 'google'];

// ---------------------------------------------------------------- URL-Helfer

// OSM liefert Websites in allen Formen ("autohaus-x.de", "HTTP://Www.X.de/").
// Einheitlich: Schema ergaenzt, Host klein, Slash am Ende weg. Ungueltig → null.
export function websiteNormalisieren(roh) {
  let s = String(roh ?? '').trim();
  if (!s) return null;
  // OSM erlaubt mehrere Adressen mit ";" – die erste reicht.
  // Leerzeichen kommen als Tippfehler vor ("www. autohaus.de") – in einer
  // Adresse haben sie nie etwas zu suchen.
  s = s.split(';')[0].replace(/\s+/g, '');
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname || !u.hostname.includes('.')) return null;
  // Zugangsdaten (user:pass@host) gehoeren nicht in die Datenbank und
  // wuerden beim Pruefen mitgeschickt.
  u.username = ''; u.password = '';
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  let aus = u.toString();
  if (u.pathname === '/' && !u.search) aus = aus.replace(/\/$/, '');
  else aus = aus.replace(/\/+$/, '');
  return aus;
}

export function hostVon(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

// SSRF-Schutz: Die Function ruft fremde Adressen ab – die duerfen nicht ins
// eigene Netz zeigen. Nur http(s), keine IP-Literale, kein localhost/.local.
export function hostErlaubt(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;                 // keine Zugangsdaten mitschicken
  const h = u.hostname.toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost')) return false;
  if (h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.arpa')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;       // IPv4
  if (h.startsWith('[') || h.includes(':')) return false;    // IPv6
  if (/^0x[0-9a-f]+$/i.test(h) || /^\d+$/.test(h)) return false; // Zahl-Notation
  // Auch "0x7f.1" oder "0177.0.0.1" sind IP-Schreibweisen: alle Labels Zahlen.
  if (h.split('.').every(l => /^(?:0x[0-9a-f]+|\d+)$/i.test(l))) return false;
  if (!h.includes('.')) return false;
  return true;
}

// Boersen und soziale Netze: ein Link dorthin ist keine eigene Website.
// Solche Adressen werden nicht analysiert, sondern als "nur Boerse" gefuehrt.
const BOERSEN = [
  ['mobile.de', /(?:^|\.)mobile\.de$/i],
  ['AutoScout24', /(?:^|\.)autoscout24\.(?:de|com|at|ch)$/i],
  ['Kleinanzeigen', /(?:^|\.)(?:ebay-)?kleinanzeigen\.de$/i],
  ['eBay', /(?:^|\.)ebay\.(?:de|com)$/i],
  ['Facebook', /(?:^|\.)(?:facebook\.com|fb\.com|fb\.me)$/i],
  ['Instagram', /(?:^|\.)instagram\.com$/i],
  ['Google', /(?:^|\.)(?:google\.(?:com|de)|g\.page|business\.site|goo\.gl)$/i],
  ['YouTube', /(?:^|\.)(?:youtube\.com|youtu\.be)$/i],
  ['TikTok', /(?:^|\.)tiktok\.com$/i],
  ['WhatsApp', /(?:^|\.)(?:whatsapp\.com|wa\.me)$/i],
  ['LinkedIn', /(?:^|\.)linkedin\.com$/i],
  ['Xing', /(?:^|\.)xing\.com$/i],
  ['Gelbe Seiten', /(?:^|\.)gelbeseiten\.de$/i],
  ['11880', /(?:^|\.)11880\.com$/i],
  ['Yelp', /(?:^|\.)yelp\.(?:de|com)$/i],
  ['autohaus24', /(?:^|\.)autohaus24\.de$/i],
  ['pkw.de', /(?:^|\.)pkw\.de$/i],
  ['12gebrauchtwagen', /(?:^|\.)12gebrauchtwagen\.de$/i],
  ['heycar', /(?:^|\.)heycar\.(?:de|com)$/i],
  ['auto.de', /(?:^|\.)auto\.de$/i],
  ['gebrauchtwagen.de', /(?:^|\.)gebrauchtwagen\.de$/i],
];

// Name der Boerse bzw. des Netzes, sonst null (= eigene Website).
export function boersenName(url) {
  const h = hostVon(url);
  if (!h) return null;
  for (const [name, re] of BOERSEN) if (re.test(h)) return name;
  return null;
}
export const istBoersenSeite = url => boersenName(url) !== null;

// ---------------------------------------------------------------- HTML lesen

const BAUKAESTEN = [
  ['Jimdo', /jimdo(?:site|free|page)?\.com|cdn\.jimdo|jimdo-|"jimdo"/i],
  ['Wix', /wixstatic\.com|wix\.com|wixsite\.com|parastorage\.com/i],
  ['IONOS MyWebsite', /\.ionos\.(?:de|com)\/|1und1\.de\/|1and1\.com\/|mywebsite-editor|ionos-mywebsite|websitebuilder\.1and1|webs\.ionos/i],
  ['Weebly', /weebly\.com|weeblycloud/i],
  ['Strato Homepage-Baukasten', /sitebuilder\.strato|livepages\.strato|strato-editor|homepage-baukasten\.strato|strato\.de\/homepage-baukasten|sitedesigner\.strato/i],
  ['Webnode', /webnode\.(?:com|de|page)/i],
  ['Squarespace', /squarespace\.com|squarespace-cdn/i],
  ['Homepage-Baukasten', /homepage-baukasten\.de/i],
  ['webgo', /webgo\.de\/baukasten|webgo-baukasten|\.webgo\.de/i],
];

// Subdomains, hinter denen kein eigener Auftritt steckt – zaehlt bei
// "eigene Domain" nicht.
const FREMDE_DOMAINS = /(?:^|\.)(?:jimdo(?:site|free)?\.com|jimdo\.de|wixsite\.com|wix\.com|weebly\.com|webnode\.(?:com|de|page)|squarespace\.com|ionos\.space|site\.webgo\.de|homepage-baukasten\.de|mobile\.de|autoscout24\.(?:de|com|at|ch)|facebook\.com|instagram\.com|google\.com|business\.site)$/i;

const MARKEN = [
  'Volkswagen', 'VW', 'Audi', 'BMW', 'Mercedes', 'Opel', 'Ford', 'Toyota', 'Skoda', 'Škoda', 'Seat',
  'Cupra', 'Renault', 'Dacia', 'Peugeot', 'Citroën', 'Citroen', 'Hyundai', 'Kia', 'Mazda', 'Honda',
  'Nissan', 'Fiat', 'Volvo', 'Suzuki', 'Mitsubishi', 'Subaru', 'Porsche', 'Mini', 'Tesla', 'Jeep',
  'Land Rover', 'Jaguar', 'Alfa Romeo', 'Lexus', 'Smart', 'Isuzu', 'Iveco', 'MAN', 'Piaggio', 'Polestar',
  'MG', 'BYD', 'Ssangyong', 'KGM',
];
const MARKEN_RE = new RegExp('(?:^|[\\s,.|–-])(?:' + MARKEN.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?=$|[\\s,.|–-])', 'i');

const RECHTSFORM_RE = /(?:^|[\s,(])(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|gGmbH|KG|AG|OHG|UG|e\.\s?K\.|e\.Kfm\.|e\.Kfr\.|GbR)(?=$|[\s,.)])/;

function entitiesDekodieren(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&copy;/gi, '©').replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä').replace(/&uuml;/g, 'ü')
    .replace(/&Ouml;/g, 'Ö').replace(/&Auml;/g, 'Ä').replace(/&Uuml;/g, 'Ü').replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

// Sichtbarer Text ohne Script/Style/Tags – fuer Wortsuchen (Rechtsform,
// Werkstatt, Oeffnungszeiten), damit Klassennamen und Skripte nicht zaehlen.
function textAus(html) {
  return entitiesDekodieren(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ');
}

function metaInhalt(html, name) {
  const re1 = new RegExp(`<meta[^>]+name=["']?${name}["']?[^>]*content=["']([^"']*)`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']?${name}["']?`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? entitiesDekodieren(m[1]).trim() : null;
}

const COPYRIGHT_RE = /(?:©|\(c\)|copyright)\s*(?:by\s+)?(?:[^\d<]{0,40}?)?(\d{4})(?:\s*[-–—\/]\s*(\d{4}|\d{2}))?/gi;

// Jahr aus "© 2017", "Copyright 2015", "(c) 2012-2019" → letztes Jahr.
// Bei mehreren Treffern das groesste plausible – die Seite bekommt den
// Vorteil des Zweifels.
export function copyrightJahr(text, jetztJahr = new Date().getFullYear()) {
  const re = new RegExp(COPYRIGHT_RE.source, 'gi');
  let best = null;
  let m;
  while ((m = re.exec(text))) {
    let jahr = Number(m[1]);
    if (m[2]) {
      const bis = m[2].length === 2 ? Number(m[1].slice(0, 2) + m[2]) : Number(m[2]);
      if (bis >= jahr) jahr = bis;
    }
    if (jahr < 1995 || jahr > jetztJahr + 1) continue;
    if (best === null || jahr > best) best = jahr;
  }
  return best;
}

// Startjahr aus "© 2008–2024": Ersatz fuer den ersten Wayback-Snapshot,
// wenn der Browser keinen liefern konnte. Nur aus echten Spannen – ein
// einzelnes "© 2024" sagt nichts ueber das Alter.
export function copyrightStartjahr(text, jetztJahr = new Date().getFullYear()) {
  const re = new RegExp(COPYRIGHT_RE.source, 'gi');
  let best = null;
  let m;
  while ((m = re.exec(text))) {
    if (!m[2]) continue;
    const von = Number(m[1]);
    if (von < 1995 || von > jetztJahr) continue;
    if (best === null || von < best) best = von;
  }
  return best;
}

function jqueryVersion(html) {
  // Pfad wie /js/jquery-1.12.4.min.js oder jquery.min.js?ver=1.12.4
  let m = html.match(/jquery(?:[.-]?(?:min|slim))?[.-](\d+\.\d+(?:\.\d+)?)(?:[.-]min)?\.js/i)
    || html.match(/jquery(?:\.min)?\.js\?ver=(\d+\.\d+(?:\.\d+)?)/i)
    || html.match(/jquery\/(\d+\.\d+(?:\.\d+)?)\/jquery/i)                   // CDN-Pfade
    || html.match(/jQuery (?:JavaScript Library )?v(\d+\.\d+(?:\.\d+)?)/);  // Kopf-Kommentar
  return m ? m[1] : null;
}

function cmsErkennen(html, generator) {
  const g = (generator || '').toLowerCase();
  if (g.includes('wordpress') || /wp-content\/|wp-includes\//i.test(html)) return 'WordPress';
  if (g.includes('joomla') || /\/media\/jui\/|\/media\/system\/js\/|com_content/i.test(html)) return 'Joomla';
  if (g.includes('typo3') || /typo3conf\/|typo3temp\/|\/_assets\/[0-9a-f]{32}\//i.test(html)) return 'TYPO3';
  if (g.includes('drupal') || /sites\/(?:default|all)\/files\/|drupal\.js|drupalSettings/i.test(html)) return 'Drupal';
  if (g.includes('contao') || /contao\/|\/files\/.*\.css.*contao|system\/modules\//i.test(html)) return 'Contao';
  if (/shopware/i.test(g) || /shopware/i.test(html)) return 'Shopware';
  if (/webflow/i.test(g) || /webflow\.js|assets\.website-files\.com/i.test(html)) return 'Webflow';
  if (/hubspot/i.test(g)) return 'HubSpot';
  if (g) return generator.split(/\s|\/|\d/)[0] || null;
  return null;
}

function baukastenErkennen(html, generator) {
  const pruef = (generator || '') + '\n' + html;
  for (const [name, re] of BAUKAESTEN) if (re.test(pruef)) return name;
  return null;
}

// Alte Technik: jede Fundstelle als kurzer Text, damit das Signal sagt, was
// genau alt ist.
function alteTechnik(html, jquery, generator) {
  const funde = [];
  if (jquery && /^[12]\./.test(jquery)) funde.push(`jQuery ${jquery}`);
  if (/\.swf["'?\s)]/i.test(html) || /application\/x-shockwave-flash/i.test(html)) funde.push('Flash');
  if (/<frameset[\s>]/i.test(html)) funde.push('Frameset');
  if (/<font[\s>]/i.test(html)) funde.push('<font>');
  if (/<marquee[\s>]/i.test(html)) funde.push('<marquee>');
  // Tabellen-Layout: viele <table>, kaum <div> – so wurde vor CSS gebaut.
  const tabellen = (html.match(/<table[\s>]/gi) || []).length;
  const divs = (html.match(/<div[\s>]/gi) || []).length;
  if (tabellen >= 6 && divs < tabellen) funde.push(`Tabellen-Layout (${tabellen} Tabellen)`);
  const g = generator || '';
  let m;
  if ((m = g.match(/WordPress\s*(\d+)/i)) && Number(m[1]) < 5) funde.push(`WordPress ${m[1]}`);
  if ((m = g.match(/Joomla!?\s*(\d+)/i)) && Number(m[1]) <= 3) funde.push(`Joomla ${m[1]}`);
  if ((m = g.match(/TYPO3(?:\s*CMS)?\s*(\d+)/i)) && Number(m[1]) < 9) funde.push(`TYPO3 ${m[1]}`);
  return funde;
}

// Eigene Fahrzeugseite: ein Link, der NICHT zu mobile.de/autoscout24 fuehrt
// und nach Fahrzeugen/Gebrauchtwagen klingt.
function eigeneFahrzeugseite(html) {
  const re = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  const wort = /fahrzeug|gebrauchtwagen|neuwagen|jahreswagen|vorf(?:ü|ue|&uuml;)hrwagen|tageszulassung|bestand|angebote/i;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (/mobile\.de|autoscout24|autohaus24|12gebrauchtwagen|pkw\.de|heycar|auto\.de/i.test(href)) continue;
    const text = m[2].replace(/<[^>]+>/g, ' ');
    if (wort.test(href) || wort.test(text)) return true;
  }
  return false;
}

function linkVorhanden(html, wort) {
  const re = new RegExp(`href=["'][^"']*${wort}[^"']*["']|<a\\b[^>]*>[^<]{0,60}${wort}`, 'i');
  return re.test(html);
}

function schemaOrgVorhanden(html) {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/"@type"\s*:\s*\[?\s*"(?:AutoDealer|AutoRepair|AutomotiveBusiness|LocalBusiness|Organization|Place|Store|Corporation)"/i.test(m[1])) return true;
  }
  return false;
}

// Das HTML einer Startseite lesen. Ergebnis: Spaltenwerte fuer
// akquise_pruefungen plus "roh" mit dem, was nur die Bewertung braucht.
export function htmlAuswerten(html, { jetztJahr = new Date().getFullYear() } = {}) {
  const h = String(html || '').slice(0, HTML_MAX_BYTES);
  const text = textAus(h);
  const generator = metaInhalt(h, 'generator');
  const titelM = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titel = titelM ? entitiesDekodieren(titelM[1]).replace(/\s+/g, ' ').trim().slice(0, 200) || null : null;
  const jquery = jqueryVersion(h);
  const cms = cmsErkennen(h, generator);
  const baukasten = baukastenErkennen(h, generator);
  const technik = alteTechnik(h, jquery, generator);
  const boersen_link = /mobile\.de|autoscout24\.(?:de|com|at|ch)/i.test(h) ? 1 : 0;
  const fahrzeuge_eigen = eigeneFahrzeugseite(h) ? 1 : 0;

  const vertragshaendler = /vertragsh(?:ä|ae)ndler|vertragspartner|vertragswerkstatt|autorisierte[rn]? (?:service|partner|händler|haendler)|service ?partner|servicepartner/i.test(text)
    || (titel ? MARKEN_RE.test(titel) : false);

  return {
    spalten: {
      viewport: /<meta[^>]+name=["']?viewport["']?/i.test(h) ? 1 : 0,
      cms,
      baukasten,
      jquery,
      copyright_jahr: copyrightJahr(text, jetztJahr),
      impressum: linkVorhanden(h, 'impressum') || linkVorhanden(h, 'imprint') ? 1 : 0,
      datenschutz: linkVorhanden(h, 'datenschutz') || linkVorhanden(h, 'privacy') ? 1 : 0,
      schema_org: schemaOrgVorhanden(h) ? 1 : 0,
      fahrzeuge_eigen,
      boersen_link,
      titel,
      generator,
    },
    roh: {
      technik,
      copyright_startjahr: copyrightStartjahr(text, jetztJahr),
      vertragshaendler: vertragshaendler ? 1 : 0,
      rechtsform: RECHTSFORM_RE.test(text) ? 1 : 0,
      oeffnungszeiten: /(?:ö|oe)ffnungszeiten/i.test(text) ? 1 : 0,
      werkstatt_und_handel: (/werkstatt|service|reparatur|inspektion/i.test(text)
        && /fahrzeuge|gebrauchtwagen|neuwagen|jahreswagen/i.test(text)) ? 1 : 0,
      zusatzangebote: /mietwagen|finanzierung|leasing|ankauf|autovermietung/i.test(text) ? 1 : 0,
    },
  };
}

// ---------------------------------------------------------------- Website raten

// Umlaute wie in Domains ueblich (ae/oe/ue/ss), andere Akzente weg.
export function umlautfrei(s) {
  return String(s || '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Woerter, die in einer Domain nie stehen: Rechtsformen und Fuellwoerter.
const RECHTSFORM_WOERTER = new Set(['gmbh', 'ggmbh', 'kg', 'ag', 'ohg', 'ug', 'ek', 'gbr', 'co', 'cokg', 'mbh', 'haftungsbeschraenkt', 'inh', 'inhaber', 'und', 'e', 'k', 'kfm', 'kfr']);
// Zu allgemein fuer eine eigene Domain wie "autohaus.de" – wird als
// einzelnes Wort nicht probiert.
const GENERISCH = new Set(['autohaus', 'auto', 'autos', 'autoservice', 'autocenter', 'autowerkstatt', 'werkstatt', 'kfz', 'kfzwerkstatt', 'kfzservice', 'service', 'autofit', 'automobile', 'fahrzeuge', 'car', 'cars', 'garage', 'autotechnik', 'meisterbetrieb', 'autohandel', 'automobil', 'zentrum', 'center']);

// Name ohne Rechtsform, als kleine ASCII-Woerter: "Autohaus Müller GmbH &
// Co. KG" → ["autohaus", "mueller"].
export function nameWoerter(name) {
  const s = umlautfrei(String(name || '').toLowerCase())
    .replace(/e\.\s?k(?:fm|fr)?\.?/g, ' ')
    .replace(/&/g, ' ');
  return s.split(/[^a-z0-9]+/).filter(w => w && !RECHTSFORM_WOERTER.has(w));
}

// Name ohne Rechtsform fuer die Textsuche: "Autohaus Müller GmbH & Co. KG"
// → "Autohaus Müller".
export function nameOhneRechtsform(name) {
  return String(name || '')
    .replace(/\s*(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|gGmbH|KG|AG|OHG|UG(?:\s*\(haftungsbeschränkt\))?|e\.\s?K\.?|e\.Kfm\.|e\.Kfr\.|GbR|Inh\.?[^,]*)\s*(?:&\s*Co\.?)?\s*$/i, '')
    .replace(/\s*&\s*Co\.?\s*(?:KG)?\s*$/i, '')
    .trim();
}

// Kandidaten fuer die Domain, plausibelste zuerst. Hoechstens max Stueck,
// weil jeder Kandidat einen Abruf kostet.
export function websiteKandidaten(name, { max = 6 } = {}) {
  const w = nameWoerter(name);
  if (!w.length) return [];
  const slug = w.join('-');
  const hatGmbh = /gmbh/i.test(String(name || ''));
  const alle = [];
  const push = h => { if (h && !alle.includes(h)) alle.push(h); };

  push(`${slug}.de`);
  if (w.length === 2) push(`${w[0]}${w[1]}.de`);
  if (w.length >= 2 && w[0].length >= 6 && !GENERISCH.has(w[0])) push(`${w[0]}.de`);
  // "1a autoservice Kürnach": ohne das Kuerzel bzw. das Gattungswort vorn.
  if (w.length >= 3 && (GENERISCH.has(w[0]) || w[0].length <= 2)) push(`${w.slice(1).join('-')}.de`);
  if (!slug.startsWith('autohaus')) push(`autohaus-${slug}.de`);
  if (hatGmbh) push(`${slug}-gmbh.de`);
  if (!slug.startsWith('auto')) push(`auto-${slug}.de`);
  push(`${slug}.com`);
  push(`www.${slug}.de`);
  return alle.slice(0, max);
}

function telefonZiffern(s) {
  let z = String(s || '').replace(/\D/g, '');
  if (z.startsWith('0049')) z = z.slice(4);
  else if (z.startsWith('49') && z.length > 9) z = z.slice(2);
  z = z.replace(/^0+/, '');
  return z;
}

// Gehoert die Seite zum Betrieb? Gruende: Ort, PLZ, Telefon, Name. Leer =
// nicht belegt. Wird beim Raten und bei Adressen von Google gebraucht,
// damit kein fremder Auftritt am Betrieb haengen bleibt.
export function websiteVerifizieren(html, betrieb) {
  const b = betrieb || {};
  const text = textAus(String(html || '').slice(0, HTML_MAX_BYTES)).toLowerCase();
  const textAscii = umlautfrei(text);
  const gruende = [];
  const wortDrin = (wort) => {
    const w = String(wort || '').toLowerCase().trim();
    if (w.length < 3) return false;
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[^a-z0-9äöüß])${esc(w)}(?:$|[^a-z0-9äöüß])`);
    const reAscii = new RegExp(`(?:^|[^a-z0-9])${esc(umlautfrei(w))}(?:$|[^a-z0-9])`);
    return re.test(text) || reAscii.test(textAscii);
  };

  if (b.plz && /^\d{5}$/.test(String(b.plz)) && new RegExp(`(?:^|\\D)${b.plz}(?:\\D|$)`).test(text)) gruende.push('PLZ');
  if (b.ort && wortDrin(String(b.ort).split(/[\/,(]/)[0])) gruende.push('Ort');

  const tel = telefonZiffern(b.telefon);
  if (tel.length >= 6) {
    const kandidaten = text.match(/\+?\d[\d\s\/().-]{5,}\d/g) || [];
    if (kandidaten.some(k => { const z = telefonZiffern(k); return z.length >= 6 && (z === tel || z.endsWith(tel) || tel.endsWith(z)); })) gruende.push('Telefon');
  }

  const kurz = nameOhneRechtsform(b.name);
  if (kurz.length >= 4 && wortDrin(kurz)) gruende.push('Name');
  return gruende;
}

// ---------------------------------------------------------------- Bewertung

const jahre = (isoDatum, jetzt) => {
  if (!isoDatum) return null;
  const t = Date.parse(isoDatum);
  if (!Number.isFinite(t)) return null;
  return (jetzt - t) / (365.25 * 24 * 3600 * 1000);
};

// Website-Schwaeche: Signale mit Punkten aus einer Pruefung (Spalten) und roh.
export function websiteSignale(betrieb, pruefung, roh, { jetzt = Date.now() } = {}) {
  const s = [];
  const add = (code, text, punkte) => s.push({ code, text, punkte, seite: 'website' });
  const jetztJahr = new Date(jetzt).getFullYear();
  const p = pruefung || {};
  const r = roh || {};

  if (!betrieb?.website) {
    add('keine_website', 'Keine Website hinterlegt', 100);
    return s;
  }
  if (istBoersenSeite(betrieb.website)) {
    add('nur_boerse', 'Nur Börsen-Seite, keine eigene Website', 100);
    return s;
  }

  // Herkunft der Adresse: 0 Punkte, aber sichtbar – der Nutzer soll wissen,
  // dass die Seite geraten oder von Google uebernommen ist.
  if (betrieb.website_quelle === 'vermutet') add('website_vermutet', 'Website geraten – bitte bestätigen', 0);
  else if (betrieb.website_quelle === 'google') {
    if (r.website_verifiziert) add('website_google', 'Website von Google Maps übernommen', 0);
    else add('website_google_offen', 'Website von Google – nicht verifiziert', 0);
  }

  const still = jahre(p.wayback_letzter, jetzt);
  if (still !== null && still > 4) add('lange_still', `Seit ${Math.floor(still)} Jahren keine Änderung (Wayback)`, 15);
  else if (still !== null && still > 2) add('lange_still', `Seit ${Math.floor(still)} Jahren keine Änderung (Wayback)`, 10);

  if (p.erreichbar === 0 || p.erreichbar === null || p.erreichbar === undefined) {
    add('nicht_erreichbar', 'Nicht erreichbar – evtl. Bot-Schutz, von Hand prüfen', 15);
    return s;   // ohne HTML gibt es nichts weiter zu bewerten
  }

  if (p.https === 0) add('kein_https', 'Kein HTTPS', 15);
  if (p.viewport === 0) add('kein_viewport', 'Nicht für Handy gebaut (kein viewport)', 20);

  if (p.psi_leistung !== null && p.psi_leistung !== undefined) {
    if (p.psi_leistung < 40) add('psi_schwach', `PageSpeed ${p.psi_leistung} (mobil)`, 15);
    else if (p.psi_leistung < 60) add('psi_schwach', `PageSpeed ${p.psi_leistung} (mobil)`, 8);
  }

  if (p.copyright_jahr) {
    if (p.copyright_jahr <= jetztJahr - 6) add('copyright_alt', `© ${p.copyright_jahr} im Fuß`, 15);
    else if (p.copyright_jahr <= jetztJahr - 3) add('copyright_alt', `© ${p.copyright_jahr} im Fuß`, 10);
  }

  if (p.baukasten) add('baukasten', `Baukasten: ${p.baukasten}`, 6);
  if (Array.isArray(r.technik) && r.technik.length) add('technik_alt', `Alte Technik: ${r.technik.join(', ')}`, 10);

  if (p.impressum === 0) add('kein_impressum', 'Kein Impressum verlinkt', 8);
  if (p.datenschutz === 0) add('kein_datenschutz', 'Keine Datenschutzerklärung verlinkt', 8);
  if (p.schema_org === 0) add('kein_schema', 'Keine strukturierten Daten (schema.org)', 5);

  if (p.boersen_link && !p.fahrzeuge_eigen) add('bestand_nur_boerse', 'Fahrzeuge nur über mobile.de/AutoScout24', 8);
  else if (!p.boersen_link && !p.fahrzeuge_eigen) add('kein_bestand', 'Keine Fahrzeuge auf der Seite', 4);

  if ((p.antwort_ms ?? 0) > 4000 || (p.groesse_kb ?? 0) > 2048) {
    add('langsam', (p.antwort_ms ?? 0) > 4000 ? `Antwort ${(p.antwort_ms / 1000).toFixed(1)} s` : `HTML ${Math.round(p.groesse_kb / 1024 * 10) / 10} MB`, 5);
  }
  if (!p.titel) add('kein_titel', 'Kein Seitentitel', 3);
  return s;
}

// Betrieb-Staerke: aus OSM-Daten, Google, Website-Text und Wayback.
export function betriebSignale(betrieb, pruefung, roh, { jetzt = Date.now(), mehrfach = false } = {}) {
  const s = [];
  const add = (code, text, punkte) => s.push({ code, text, punkte, seite: 'betrieb' });
  const b = betrieb || {};
  const p = pruefung || {};
  const r = roh || {};
  const jetztJahr = new Date(jetzt).getFullYear();

  // OSM traegt bei Ketten den eigenen Namen als "brand" ein (A.T.U,
  // "1a autoservice Dressner") – das ist keine Herstellermarke. Zaehlt nur,
  // wenn die Marke ein Hersteller ist oder nicht schon im Namen steckt.
  const marken = String(b.marken || '').trim();
  const imNamen = marken && String(b.name || '').toLowerCase().includes(marken.toLowerCase());
  const marke = marken && (!imNamen || MARKEN_RE.test(marken)) ? marken : '';
  if (marke || r.vertragshaendler) add('vertragshaendler', marke ? `Vertragshändler: ${marke}` : 'Vertragshändler laut Website', 20);

  // Google: viele Bewertungen = viel Laufkundschaft, gute Note = gepflegter
  // Betrieb. Die Zahlen stehen als Momentaufnahme am Betrieb.
  const anzahl = Number(b.google_anzahl);
  if (Number.isFinite(anzahl) && anzahl >= 100) add('google_bewertungen', `${anzahl} Google-Bewertungen`, 20);
  else if (Number.isFinite(anzahl) && anzahl >= 30) add('google_bewertungen', `${anzahl} Google-Bewertungen`, 10);
  const note = Number(b.google_bewertung);
  if (Number.isFinite(note) && note >= 4.3) add('google_note', `Google ${note.toFixed(1).replace('.', ',')} Sterne`, 5);

  const alter = jahre(p.wayback_erster, jetzt);
  if (alter !== null && alter >= 10) add('praesenz_alt', `Seit ${Math.floor(alter)} Jahren im Netz`, 20);
  else if (alter !== null && alter >= 5) add('praesenz_alt', `Seit ${Math.floor(alter)} Jahren im Netz`, 10);
  else if (alter === null && r.copyright_startjahr) {
    // Ohne Wayback: das Startjahr aus "© 2008–2024" im Fuss.
    const seit = jetztJahr - r.copyright_startjahr;
    if (seit >= 10) add('praesenz_alt', `Seit ${seit} Jahren im Netz (© im Fuß)`, 20);
    else if (seit >= 5) add('praesenz_alt', `Seit ${seit} Jahren im Netz (© im Fuß)`, 10);
  }

  if (RECHTSFORM_RE.test(String(b.name || '')) || r.rechtsform) add('rechtsform', 'Eingetragene Gesellschaft', 10);
  if (b.telefon) add('telefon', 'Telefon bekannt', 5);
  if (b.oeffnungszeiten || r.oeffnungszeiten) add('oeffnungszeiten', 'Öffnungszeiten gepflegt', 5);
  if (mehrfach) add('mehrere_standorte', 'Mehrere Standorte', 10);
  if (r.werkstatt_und_handel) add('werkstatt_und_handel', 'Werkstatt und Handel', 5);
  if (r.zusatzangebote) add('zusatzangebote', 'Zusatzangebote (Miete, Finanzierung, Ankauf)', 5);

  if (b.website) {
    const host = hostVon(b.website);
    if (host && !FREMDE_DOMAINS.test(host) && !istBoersenSeite(b.website)) add('eigene_domain', 'Eigene Domain', 5);
  }
  return s;
}

const deckel = n => Math.max(0, Math.min(100, Math.round(n)));

// Kategorie aus Website, Signalen und Schwaeche. null = noch nicht
// einzuordnen (keine Pruefung oder Seite nicht erreichbar).
export function kategorieErmitteln(betrieb, signale, score_website) {
  if (!betrieb?.website) return 'ohne_website';
  const codes = new Set((signale || []).map(s => s.code));
  if (istBoersenSeite(betrieb.website) || codes.has('nur_boerse')) return 'nur_boerse';
  if (score_website === null || score_website === undefined) return null;
  if (codes.has('nicht_erreichbar')) return null;
  if (codes.has('baukasten')) return 'baukasten';
  if (score_website >= 50) return 'veraltet';
  if (score_website >= 25) return 'mittel';
  return 'gepflegt';
}

// Kategorie ohne Pruefung – nach dem Eintragen oder Verwerfen einer Adresse.
export function kategorieOhnePruefung(website) {
  if (!website) return 'ohne_website';
  if (istBoersenSeite(website)) return 'nur_boerse';
  return null;
}

// Alles zusammen: Signale beider Seiten, die drei Zahlen und die Kategorie.
export function bewerten(betrieb, pruefung, roh, optionen = {}) {
  const sw = websiteSignale(betrieb, pruefung, roh, optionen);
  const sb = betriebSignale(betrieb, pruefung, roh, optionen);
  const score_website = deckel(sw.reduce((a, x) => a + x.punkte, 0));
  const score_betrieb = deckel(sb.reduce((a, x) => a + x.punkte, 0));
  const prioritaet = Math.round(0.6 * score_website + 0.4 * score_betrieb);
  const signale = [...sw, ...sb];
  return { score_website, score_betrieb, prioritaet, signale, kategorie: kategorieErmitteln(betrieb, signale, score_website) };
}

// ---------------------------------------------------------------- Abrufen

async function mitTimeout(ms, fn) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fn(ac.signal); } finally { clearTimeout(t); }
}

// Nur die ersten 400 KB lesen, dann den Stream abbrechen – grosse Seiten
// wuerden sonst Zeit und Speicher fressen.
async function koerperLesen(response) {
  const reader = response.body?.getReader();
  if (!reader) return { html: await response.text(), bytes: 0 };
  const teile = [];
  let bytes = 0;
  while (bytes < HTML_MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    teile.push(value);
    bytes += value.byteLength;
  }
  try { await reader.cancel(); } catch { /* egal */ }
  const alle = new Uint8Array(bytes);
  let pos = 0;
  for (const t of teile) { alle.set(t, pos); pos += t.byteLength; }
  return { html: new TextDecoder('utf-8', { fatal: false }).decode(alle), bytes };
}

const MAX_WEITERLEITUNGEN = 5;
const ABRUF_HEADERS = {
  'User-Agent': UA_CHECK,
  'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.5',
};

// Weiterleitungen selbst verfolgen statt redirect:'follow' – so wird jedes
// Ziel vor dem Abruf gegen hostErlaubt geprueft (SSRF), nicht erst danach.
// Der Timeout deckt auch das Lesen des Bodys ab, sonst koennte ein
// tropfender Server die Function beliebig lange festhalten.
async function einmalAbrufen(url, timeoutMs) {
  const start = Date.now();
  return mitTimeout(timeoutMs, async signal => {
    let aktuell = url;
    let r;
    for (let hop = 0; ; hop++) {
      r = await fetch(aktuell, { signal, redirect: 'manual', headers: ABRUF_HEADERS });
      if (![301, 302, 303, 307, 308].includes(r.status)) break;
      const ziel = r.headers.get('location');
      try { await r.body?.cancel(); } catch { /* egal */ }
      if (!ziel || hop >= MAX_WEITERLEITUNGEN) throw new Error('Zu viele Weiterleitungen');
      let naechste;
      try { naechste = new URL(ziel, aktuell).toString(); } catch { throw new Error('Weiterleitung ungültig'); }
      if (!hostErlaubt(naechste)) throw new Error('Weiterleitung auf unzulässige Adresse');
      aktuell = naechste;
    }
    const antwort_ms = Date.now() - start;
    const { html, bytes } = await koerperLesen(r);
    const laenge = Number(r.headers.get('content-length'));
    const groesse_kb = Math.round((Number.isFinite(laenge) && laenge > 0 ? laenge : bytes) / 1024);
    return { status: r.status, endUrl: aktuell, html, antwort_ms, groesse_kb };
  });
}

// Fehler aus fetch lesbar machen. Die Runtime meldet ein kaputtes
// Zertifikat nur als "internal error; reference = …" – das sagt dem
// Nutzer nichts, dabei ist genau das ein Befund.
function fehlerText(err, url, timeoutMs) {
  if (err?.name === 'AbortError') return `Zeitüberschreitung (${Math.round(timeoutMs / 1000)} s)`;
  const roh = String(err?.message || err);
  if (/internal error|certificate|tls|ssl|handshake/i.test(roh)) {
    return url.startsWith('https:') ? 'TLS-Fehler (Zertifikat oder Verschlüsselung kaputt)' : 'Verbindungsfehler';
  }
  return roh.slice(0, 160);
}

// Startseite holen. Reihenfolge: erst https, dann http – so ergibt sich
// "kein HTTPS" von selbst, wenn nur http klappt.
export async function websiteAbrufen(website, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const aus = { erreichbar: 0, https: null, status: null, endUrl: null, html: '', antwort_ms: null, groesse_kb: null, fehler: null };
  if (!hostErlaubt(website)) { aus.fehler = 'Adresse nicht erlaubt'; return aus; }

  const u = new URL(website);
  const versuche = [];
  u.protocol = 'https:'; versuche.push(u.toString());
  u.protocol = 'http:'; versuche.push(u.toString());

  let ersterFehler = null;
  for (const url of versuche) {
    try {
      const e = await einmalAbrufen(url, timeoutMs);
      // 4xx/5xx: nichts Auswertbares. 403/429 ist meist Bot-Schutz.
      if (e.status >= 400) {
        if (!ersterFehler) ersterFehler = `HTTP ${e.status}`;
        continue;
      }
      if (!hostErlaubt(e.endUrl)) { ersterFehler = 'Weiterleitung auf unzulässige Adresse'; continue; }
      return { ...aus, ...e, erreichbar: 1, https: e.endUrl.startsWith('https:') ? 1 : 0, fehler: null };
    } catch (err) {
      const msg = fehlerText(err, url, timeoutMs);
      if (!ersterFehler) ersterFehler = msg;
    }
  }
  aus.fehler = ersterFehler || 'Nicht erreichbar';
  return aus;
}

// Website eines Betriebs ohne Adresse raten: alle Kandidaten parallel
// abrufen (6 s je Kandidat), Treffer nur bei belegtem Bezug zum Betrieb.
// Der Abruf des Treffers wird mitgegeben, damit die Pruefung ihn nicht ein
// zweites Mal holen muss.
export async function websiteRaten(betrieb, { timeoutMs = RATEN_TIMEOUT_MS, max = 6 } = {}) {
  const kandidaten = websiteKandidaten(betrieb?.name, { max });
  const versuche = kandidaten.map(async host => {
    const url = 'https://' + host;
    if (!hostErlaubt(url)) return null;
    try {
      const abruf = await websiteAbrufen(url, { timeoutMs });
      if (!abruf.erreichbar) return null;
      const gruende = websiteVerifizieren(abruf.html, betrieb);
      if (!gruende.length) return null;
      return { website: websiteNormalisieren(abruf.endUrl) || websiteNormalisieren(url), host, gruende, abruf };
    } catch {
      return null;
    }
  });
  const ergebnisse = await Promise.all(versuche);
  return { kandidaten, treffer: ergebnisse.find(Boolean) || null };
}

// Wayback-Zeitstempel "20150312101512" oder ISO-Datum → "2015-03-12", sonst null.
export function waybackDatum(wert) {
  const s = String(wert || '').trim();
  let m = s.match(/^(\d{4})(\d{2})(\d{2})\d*$/);
  if (!m) m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const jahr = Number(m[1]), monat = Number(m[2]), tag = Number(m[3]);
  if (jahr < 1995 || jahr > 2100 || monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// Server-Fallback fuer den ersten Snapshot, wenn der Browser keinen liefern
// konnte: CDX mit limit=1 und knappem Timeout. Fehler → null.
export async function waybackErsterAbfragen(host, { timeoutMs = CDX_FALLBACK_MS } = {}) {
  if (!host) return null;
  const url = 'https://web.archive.org/cdx/search/cdx?url=' + encodeURIComponent(host)
    + '&output=json&fl=timestamp&filter=statuscode:200&limit=1';
  try {
    const daten = await mitTimeout(timeoutMs, async signal => {
      const r = await fetch(url, { signal, headers: { 'User-Agent': UA_CHECK } });
      return r.ok ? r.json() : null;
    });
    return Array.isArray(daten) && daten[1] ? waybackDatum(daten[1][0]) : null;
  } catch {
    return null;
  }
}

export const LEERE_PRUEFUNG = Object.freeze({
  erreichbar: null, https: null, viewport: null, cms: null, baukasten: null, jquery: null, copyright_jahr: null,
  impressum: null, datenschutz: null, schema_org: null, fahrzeuge_eigen: null, boersen_link: null,
  psi_leistung: null, psi_lcp: null, psi_cls: null,
  wayback_erster: null, wayback_letzter: null, wayback_anzahl: null,
  titel: null, generator: null, antwort_ms: null, groesse_kb: null, fehler: null,
});

// Komplette Pruefung eines Betriebs: Website holen (oder den mitgegebenen
// Abruf nutzen), auswerten, bewerten. Boersen-Seiten werden nicht geholt –
// die Bewertung steht fest. Ergebnis: Zeile fuer akquise_pruefungen (ohne
// id, betrieb_id, zeitpunkt) plus Scores und Kategorie.
export async function betriebPruefen(betrieb, { mehrfach = false, jetzt = Date.now(), abruf = null } = {}) {
  const jetztJahr = new Date(jetzt).getFullYear();

  if (!betrieb.website || istBoersenSeite(betrieb.website)) {
    const roh = {};
    const bew = bewerten(betrieb, LEERE_PRUEFUNG, roh, { jetzt, mehrfach });
    return { pruefung: { ...LEERE_PRUEFUNG, signale: bew.signale, roh }, ...bew };
  }

  const a = abruf || await websiteAbrufen(betrieb.website);
  let spalten = { ...LEERE_PRUEFUNG, erreichbar: a.erreichbar, https: a.https, antwort_ms: a.antwort_ms, groesse_kb: a.groesse_kb, fehler: a.fehler };
  let roh = { end_url: a.endUrl, status: a.status };
  if (a.erreichbar) {
    const aus = htmlAuswerten(a.html, { jetztJahr });
    spalten = { ...spalten, ...aus.spalten };
    const gruende = websiteVerifizieren(a.html, betrieb);
    roh = { ...roh, ...aus.roh, website_verifiziert: gruende.length ? 1 : 0, verifiziert_durch: gruende };
  }
  const bew = bewerten(betrieb, spalten, roh, { jetzt, mehrfach });
  return { pruefung: { ...spalten, signale: bew.signale, roh }, ...bew };
}

// ---------------------------------------------------------------- D1-Helfer
// Gemeinsam fuer pruefen.js und google.js, damit beide Pruefzeilen und
// Scores auf dieselbe Weise schreiben.

export const PRUEF_SPALTEN = Object.keys(LEERE_PRUEFUNG);

export const jsonLesen = (s, leer) => { if (!s) return leer; try { return JSON.parse(s); } catch { return leer; } };

export async function betriebLaden(env, id) {
  return env.DB.prepare('SELECT * FROM akquise_betriebe WHERE id = ?').bind(id).first();
}

// Gleicher Name mehrfach in der Tabelle → mehrere Standorte.
export async function istMehrfach(env, betrieb) {
  const z = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM akquise_betriebe WHERE lower(name) = lower(?) AND id != ? AND geloescht IS NULL',
  ).bind(betrieb.name, betrieb.id).first();
  return Number(z?.n || 0) > 0;
}

export async function letztePruefungLaden(env, betriebId) {
  return env.DB.prepare(
    'SELECT * FROM akquise_pruefungen WHERE betrieb_id = ? ORDER BY zeitpunkt DESC, id DESC LIMIT 1',
  ).bind(betriebId).first();
}

// Scores und Kategorie an den Betrieb; geprueft_am nur, wenn gewuenscht.
export function scoresStatement(env, id, bew, { geprueft = false } = {}) {
  return env.DB.prepare(
    `UPDATE akquise_betriebe SET score_website = ?, score_betrieb = ?, prioritaet = ?, kategorie = ?,
       ${geprueft ? "geprueft_am = datetime('now')," : ''} geaendert = datetime('now') WHERE id = ?`,
  ).bind(bew.score_website, bew.score_betrieb, bew.prioritaet, bew.kategorie ?? null, id);
}

// Ergebnis von betriebPruefen als neue Pruefzeile speichern und den
// Betrieb aktualisieren. Antwort: die Zeile, wie GET /pruefen sie liefert.
export async function pruefungSpeichern(env, betrieb, ergebnis) {
  const { pruefung } = ergebnis;
  const { meta } = await env.DB.prepare(
    `INSERT INTO akquise_pruefungen (betrieb_id, ${PRUEF_SPALTEN.join(', ')}, signale, roh)
     VALUES (?, ${PRUEF_SPALTEN.map(() => '?').join(', ')}, ?, ?)`,
  ).bind(betrieb.id, ...PRUEF_SPALTEN.map(s => pruefung[s] ?? null), JSON.stringify(ergebnis.signale), JSON.stringify(pruefung.roh ?? {})).run();
  await scoresStatement(env, betrieb.id, ergebnis, { geprueft: true }).run();
  return {
    id: meta?.last_row_id,
    betrieb_id: betrieb.id,
    zeitpunkt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    ...pruefung,
  };
}

// Letzte Pruefung mit geaenderten Spalten neu bewerten (PSI, Wayback,
// Google-Zahlen am Betrieb) – ohne neue Zeile.
export async function pruefungNeuBewerten(env, betrieb, letzte, aenderungen = {}) {
  const roh = jsonLesen(letzte.roh, {});
  const pruefung = { ...letzte, ...aenderungen };
  const bew = bewerten(betrieb, pruefung, roh, { mehrfach: await istMehrfach(env, betrieb) });
  const spalten = Object.keys(aenderungen).filter(k => PRUEF_SPALTEN.includes(k));
  const set = [...spalten.map(k => `${k} = ?`), 'signale = ?'];
  const werte = [...spalten.map(k => aenderungen[k] ?? null), JSON.stringify(bew.signale)];
  await env.DB.batch([
    env.DB.prepare(`UPDATE akquise_pruefungen SET ${set.join(', ')} WHERE id = ?`).bind(...werte, letzte.id),
    scoresStatement(env, betrieb.id, bew),
  ]);
  return { pruefung: { ...pruefung, signale: bew.signale, roh }, ...bew };
}

// Antwort fuer den Browser: alles, was die Zeile im Cockpit braucht.
export function pruefAntwort(betrieb, ergebnis, pruefung, extra = {}) {
  return {
    ok: true,
    pruefung,
    score_website: ergebnis.score_website,
    score_betrieb: ergebnis.score_betrieb,
    prioritaet: ergebnis.prioritaet,
    signale: ergebnis.signale,
    kategorie: ergebnis.kategorie ?? null,
    website: betrieb.website ?? null,
    website_quelle: betrieb.website_quelle ?? null,
    ...extra,
  };
}
