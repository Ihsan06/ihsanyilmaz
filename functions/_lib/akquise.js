// Akquise: Websites von Autohaeusern pruefen und bewerten.
//
// Alles hier sind reine Funktionen bzw. Funktionen, die nur fetch brauchen –
// damit sie sich ohne Worker mit node testen lassen. Die Endpunkte unter
// /api/admin/akquise/* kuemmern sich um D1 und Auth.
//
// Zwei Zahlen je Betrieb:
//   score_website  Schwaeche der Website 0–100 (hoch = schlecht)
//   score_betrieb  Staerke des Betriebs   0–100 (hoch = etabliert)
//   prioritaet     round(0.6 * schwaeche + 0.4 * staerke)
// Ziel: etablierte Betriebe mit vernachlaessigter Website ganz oben.

export const UA_CHECK = 'Mozilla/5.0 (compatible; AIY-Website-Check/1.0; +https://ihsan-yilmaz.de)';
const HTML_MAX_BYTES = 400 * 1024;   // mehr HTML braucht die Auswertung nicht
const FETCH_TIMEOUT_MS = 12_000;
// Der CDX-Dienst braucht gemessen 3–40 s (collapse=digest muss alle
// Snapshots durchgehen). Mit 20 s blieben die Felder bei jeder zweiten
// Seite leer, deshalb grosszuegiger; die Website wird parallel geholt.
const WAYBACK_TIMEOUT_MS = 35_000;

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

// Jahr aus "© 2017", "Copyright 2015", "(c) 2012-2019" → letztes Jahr.
// Bei mehreren Treffern das groesste plausible – die Seite bekommt den
// Vorteil des Zweifels.
export function copyrightJahr(text, jetztJahr = new Date().getFullYear()) {
  const re = /(?:©|\(c\)|copyright)\s*(?:by\s+)?(?:[^\d<]{0,40}?)?(\d{4})(?:\s*[-–—\/]\s*(\d{4}|\d{2}))?/gi;
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
      vertragshaendler: vertragshaendler ? 1 : 0,
      rechtsform: RECHTSFORM_RE.test(text) ? 1 : 0,
      oeffnungszeiten: /(?:ö|oe)ffnungszeiten/i.test(text) ? 1 : 0,
      werkstatt_und_handel: (/werkstatt|service|reparatur|inspektion/i.test(text)
        && /fahrzeuge|gebrauchtwagen|neuwagen|jahreswagen/i.test(text)) ? 1 : 0,
      zusatzangebote: /mietwagen|finanzierung|leasing|ankauf|autovermietung/i.test(text) ? 1 : 0,
    },
  };
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

// Betrieb-Staerke: aus OSM-Daten, Website-Text und Wayback.
export function betriebSignale(betrieb, pruefung, roh, { jetzt = Date.now(), mehrfach = false } = {}) {
  const s = [];
  const add = (code, text, punkte) => s.push({ code, text, punkte, seite: 'betrieb' });
  const b = betrieb || {};
  const p = pruefung || {};
  const r = roh || {};

  // OSM traegt bei Ketten den eigenen Namen als "brand" ein (A.T.U,
  // "1a autoservice Dressner") – das ist keine Herstellermarke. Zaehlt nur,
  // wenn die Marke ein Hersteller ist oder nicht schon im Namen steckt.
  const marken = String(b.marken || '').trim();
  const imNamen = marken && String(b.name || '').toLowerCase().includes(marken.toLowerCase());
  const marke = marken && (!imNamen || MARKEN_RE.test(marken)) ? marken : '';
  if (marke || r.vertragshaendler) add('vertragshaendler', marke ? `Vertragshändler: ${marke}` : 'Vertragshändler laut Website', 20);

  const alter = jahre(p.wayback_erster, jetzt);
  if (alter !== null && alter >= 10) add('praesenz_alt', `Seit ${Math.floor(alter)} Jahren im Netz`, 20);
  else if (alter !== null && alter >= 5) add('praesenz_alt', `Seit ${Math.floor(alter)} Jahren im Netz`, 10);

  if (RECHTSFORM_RE.test(String(b.name || '')) || r.rechtsform) add('rechtsform', 'Eingetragene Gesellschaft', 10);
  if (b.telefon) add('telefon', 'Telefon bekannt', 5);
  if (b.oeffnungszeiten || r.oeffnungszeiten) add('oeffnungszeiten', 'Öffnungszeiten gepflegt', 5);
  if (mehrfach) add('mehrere_standorte', 'Mehrere Standorte', 10);
  if (r.werkstatt_und_handel) add('werkstatt_und_handel', 'Werkstatt und Handel', 5);
  if (r.zusatzangebote) add('zusatzangebote', 'Zusatzangebote (Miete, Finanzierung, Ankauf)', 5);

  if (b.website) {
    const host = hostVon(b.website);
    if (host && !FREMDE_DOMAINS.test(host)) add('eigene_domain', 'Eigene Domain', 5);
  }
  return s;
}

const deckel = n => Math.max(0, Math.min(100, Math.round(n)));

// Alles zusammen: Signale beider Seiten und die drei Zahlen.
export function bewerten(betrieb, pruefung, roh, optionen = {}) {
  const sw = websiteSignale(betrieb, pruefung, roh, optionen);
  const sb = betriebSignale(betrieb, pruefung, roh, optionen);
  const score_website = deckel(sw.reduce((a, x) => a + x.punkte, 0));
  const score_betrieb = deckel(sb.reduce((a, x) => a + x.punkte, 0));
  const prioritaet = Math.round(0.6 * score_website + 0.4 * score_betrieb);
  return { score_website, score_betrieb, prioritaet, signale: [...sw, ...sb] };
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
async function einmalAbrufen(url) {
  const start = Date.now();
  return mitTimeout(FETCH_TIMEOUT_MS, async signal => {
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
function fehlerText(err, url) {
  if (err?.name === 'AbortError') return 'Zeitüberschreitung (12 s)';
  const roh = String(err?.message || err);
  if (/internal error|certificate|tls|ssl|handshake/i.test(roh)) {
    return url.startsWith('https:') ? 'TLS-Fehler (Zertifikat oder Verschlüsselung kaputt)' : 'Verbindungsfehler';
  }
  return roh.slice(0, 160);
}

// Startseite holen. Reihenfolge: erst https, dann http – so ergibt sich
// "kein HTTPS" von selbst, wenn nur http klappt.
export async function websiteAbrufen(website) {
  const aus = { erreichbar: 0, https: null, status: null, endUrl: null, html: '', antwort_ms: null, groesse_kb: null, fehler: null };
  if (!hostErlaubt(website)) { aus.fehler = 'Adresse nicht erlaubt'; return aus; }

  const u = new URL(website);
  const versuche = [];
  u.protocol = 'https:'; versuche.push(u.toString());
  u.protocol = 'http:'; versuche.push(u.toString());

  let ersterFehler = null;
  for (const url of versuche) {
    try {
      const e = await einmalAbrufen(url);
      // 4xx/5xx: nichts Auswertbares. 403/429 ist meist Bot-Schutz.
      if (e.status >= 400) {
        if (!ersterFehler) ersterFehler = `HTTP ${e.status}`;
        continue;
      }
      if (!hostErlaubt(e.endUrl)) { ersterFehler = 'Weiterleitung auf unzulässige Adresse'; continue; }
      return { ...aus, ...e, erreichbar: 1, https: e.endUrl.startsWith('https:') ? 1 : 0, fehler: null };
    } catch (err) {
      const msg = fehlerText(err, url);
      if (!ersterFehler) ersterFehler = msg;
    }
  }
  aus.fehler = ersterFehler || 'Nicht erreichbar';
  return aus;
}

// Wayback-CDX: erster und letzter Snapshot mit geaendertem Inhalt (collapse=
// digest), plus Anzahl. Fehler tolerieren – dann bleiben die Felder null.
export async function waybackAbfragen(host) {
  const leer = { wayback_erster: null, wayback_letzter: null, wayback_anzahl: null };
  if (!host) return leer;
  const url = 'https://web.archive.org/cdx/search/cdx?url=' + encodeURIComponent(host)
    + '&output=json&fl=timestamp&filter=statuscode:200&collapse=digest&limit=1500';
  try {
    // Auch das Lesen der Antwort gehoert unter den Timeout.
    const daten = await mitTimeout(WAYBACK_TIMEOUT_MS, async signal => {
      const r = await fetch(url, { signal, headers: { 'User-Agent': UA_CHECK } });
      return r.ok ? r.json() : null;
    });
    if (!daten) return leer;
    return waybackAuswerten(daten);
  } catch {
    return leer;
  }
}

export function waybackAuswerten(daten) {
  const leer = { wayback_erster: null, wayback_letzter: null, wayback_anzahl: null };
  if (!Array.isArray(daten) || daten.length < 2) return { ...leer, wayback_anzahl: 0 };
  const zeilen = daten.slice(1).map(z => String(z[0] || '')).filter(z => /^\d{8}/.test(z)).sort();
  if (!zeilen.length) return { ...leer, wayback_anzahl: 0 };
  const iso = ts => `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
  return { wayback_erster: iso(zeilen[0]), wayback_letzter: iso(zeilen[zeilen.length - 1]), wayback_anzahl: zeilen.length };
}

// Komplette Pruefung eines Betriebs: Website und Wayback parallel, dann
// auswerten und bewerten. Ergebnis: Zeile fuer akquise_pruefungen (ohne id,
// betrieb_id, zeitpunkt) plus Scores.
export async function betriebPruefen(betrieb, { mehrfach = false, jetzt = Date.now() } = {}) {
  const jetztJahr = new Date(jetzt).getFullYear();
  const leereSpalten = {
    erreichbar: null, https: null, viewport: null, cms: null, baukasten: null, jquery: null, copyright_jahr: null,
    impressum: null, datenschutz: null, schema_org: null, fahrzeuge_eigen: null, boersen_link: null,
    psi_leistung: null, psi_lcp: null, psi_cls: null,
    wayback_erster: null, wayback_letzter: null, wayback_anzahl: null,
    titel: null, generator: null, antwort_ms: null, groesse_kb: null, fehler: null,
  };

  if (!betrieb.website) {
    const roh = {};
    const bew = bewerten(betrieb, leereSpalten, roh, { jetzt, mehrfach });
    return { pruefung: { ...leereSpalten, signale: bew.signale, roh }, ...bew };
  }

  const [abruf, wayback] = await Promise.all([
    websiteAbrufen(betrieb.website),
    waybackAbfragen(hostVon(betrieb.website)),
  ]);

  let spalten = { ...leereSpalten, ...wayback, erreichbar: abruf.erreichbar, https: abruf.https, antwort_ms: abruf.antwort_ms, groesse_kb: abruf.groesse_kb, fehler: abruf.fehler };
  let roh = { end_url: abruf.endUrl, status: abruf.status };
  if (abruf.erreichbar) {
    const aus = htmlAuswerten(abruf.html, { jetztJahr });
    spalten = { ...spalten, ...aus.spalten };
    roh = { ...roh, ...aus.roh };
  }
  const bew = bewerten(betrieb, spalten, roh, { jetzt, mehrfach });
  return { pruefung: { ...spalten, signale: bew.signale, roh }, ...bew };
}
