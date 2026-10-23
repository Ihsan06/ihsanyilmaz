// Website-Vorschau fuer einen angeschriebenen Betrieb (/fuer/<token>/website).
//
// Grundsatz (Rechtsrahmen 2026-09-23): nur Fakten zum Betrieb – Name, Ort,
// Art, Marken, Oeffnungszeiten, Telefon – und eigene bzw. frei nutzbare
// Bilder. Keine Fotos, Texte oder Logos von der Website des Betriebs, keine
// Fahrzeuge von mobile.de (Kopieren = Vervielfaeltigung, § 16 UrhG; mobile.de
// verbietet das Auslesen). Aussehen und Beispielfahrzeuge legt der Steckbrief
// fest (steckbrief.js, fahrzeugpool.js); BEISPIEL_FAHRZEUGE bleiben fuer
// Vorschauen ohne Steckbrief (vor 2026-10-22 gebaut).
//
// Die Texte schreibt Claude einmal beim Bauen (Admin → Zweiter Brief), sie
// liegen in akquise_vorschauen und laufen nach 30 Tagen ab.

import { fahrzeugAnzeige, NICHT_ALS_TITEL } from './fahrzeugpool.js';
import { SYMBOLE } from './steckbrief.js';

export const LAUFZEIT_TAGE = 30;
export const MODELL = 'claude-opus-5';

const IMG = id => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;
export const HERO_BILD = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1920&q=80&auto=format';

// Beispiel-Anzeigen aus der eigenen Autohaus-Demo (gleiche Fahrzeuge, gleiche Fotos).
export const BEISPIEL_FAHRZEUGE = [
  { marke: 'Porsche', modell: 'Panamera Turbo 4.0 PDK', preis: 84900, km: 58400, ez: '09/2018', ps: 549, kraftstoff: 'Benzin', bild: IMG('1503376780353-7e6692767b70') },
  { marke: 'BMW', modell: '420i Coupé M Sport', preis: 38490, km: 27800, ez: '03/2022', ps: 184, kraftstoff: 'Benzin', bild: IMG('1655286986273-c247d49e25dc') },
  { marke: 'Volkswagen', modell: 'Tiguan 2.0 TDI R-Line', preis: 34980, km: 58300, ez: '06/2021', ps: 200, kraftstoff: 'Diesel', bild: IMG('1655286182008-2a6578c7f487') },
  { marke: 'Polestar', modell: '2 Standard Range', preis: 33900, km: 24600, ez: '07/2022', ps: 224, kraftstoff: 'Elektro', bild: IMG('1655287778401-ce90c81a630f') },
  { marke: 'Audi', modell: 'A4 Avant 35 TFSI S line', preis: 32990, km: 36900, ez: '04/2022', ps: 150, kraftstoff: 'Benzin', bild: IMG('1655225450022-a555e697c314') },
  { marke: 'Volkswagen', modell: 'Golf VIII 1.5 eTSI Style', preis: 24490, km: 31200, ez: '02/2022', ps: 150, kraftstoff: 'Benzin', bild: IMG('1655285142221-2ecd4a91776f') },
];

const SCHEMA = {
  type: 'object',
  properties: {
    claim: { type: 'string', description: 'Überschrift der Startseite, 3–6 Wörter, ohne Ausrufezeichen.' },
    unterzeile: { type: 'string', description: 'Ein Satz unter der Überschrift, max. 18 Wörter.' },
    ueber_uns: { type: 'string', description: '2–3 Sätze „Über uns“, ohne erfundene Fakten.' },
    leistungen: {
      type: 'array',
      description: 'Genau 4 Leistungen passend zur Art des Betriebs.',
      items: {
        type: 'object',
        properties: {
          titel: { type: 'string', description: '1–3 Wörter.' },
          text: { type: 'string', description: 'Ein Satz, max. 16 Wörter.' },
        },
        required: ['titel', 'text'],
        additionalProperties: false,
      },
    },
    vorteile: { type: 'array', description: 'Genau 3 kurze Vorteile, je max. 6 Wörter.', items: { type: 'string' } },
  },
  required: ['claim', 'unterzeile', 'ueber_uns', 'leistungen', 'vorteile'],
  additionalProperties: false,
};

const SYSTEM = `Du schreibst die Texte für die Vorschau einer Website eines Autohauses oder einer Kfz-Werkstatt in Deutschland. Die Vorschau zeigt dem Betrieb, wie seine neue Website aussehen könnte.

Regeln:
- Deutsch, Kunden werden mit „Sie“ angesprochen. Ton: bodenständig, regional, seriös. Keine Superlative („bester“, „Nr. 1“), keine Ausrufezeichen, kein Marketing-Geschwurbel.
- Erfinde KEINE Fakten: kein Gründungsjahr, keine Inhaber- oder Mitarbeiternamen, keine Anzahl Fahrzeuge, keine Auszeichnungen, keine Zertifikate, keine Preise, keine Garantien, keine Leistungen, die nicht zur Art des Betriebs passen.
- Nutze nur, was du bekommst: Name, Ort, Art, Marken, Öffnungszeiten. Marken nur nennen, wenn sie angegeben sind.
- Leistungen allgemein und typisch halten (z. B. Gebrauchtwagen, Ankauf, Finanzierung, Werkstatt-Service), passend zur Art.
- Marken nur als beschreibende Angabe („Gebrauchte Renault und Dacia“), nie „Vertragshändler“, „offizieller Partner“ oder „autorisiert“ – das wissen wir nicht.`;

// Fakten zum Betrieb, so wie Claude sie bekommt (und wie die Seite sie zeigt).
export function fakten(b) {
  const marken = String(b.marken || '').split(/[;,]/).map(m => m.trim()).filter(Boolean).slice(0, 4);
  const werkstatt = b.art === 'car_repair' && !/autohaus|automobil|autohandel|auto-?handel|gebrauchtwagen|cars\b/i.test(b.name || '');
  return { name: b.name, ort: b.ort || '', art: werkstatt ? 'Kfz-Werkstatt' : 'Autohaus', werkstatt, marken, zeiten: zeitenLesen(b.oeffnungszeiten) };
}

// OSM opening_hours („Mo-Fr 08:00-18:00; Sa 09:00-13:00“) → Zeilen fuer die Seite.
export function zeitenLesen(roh) {
  const t = String(roh || '').trim();
  if (!t || t.length > 140) return [];
  const TAG = { Mo: 'Mo', Tu: 'Di', We: 'Mi', Th: 'Do', Fr: 'Fr', Sa: 'Sa', Su: 'So', PH: 'Feiertag' };
  return t.split(/\s*;\s*/).filter(Boolean).slice(0, 5).map(teil => teil
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, m => TAG[m])
    .replace(/(\d\d:\d\d)-(\d\d:\d\d)/g, '$1–$2')
    .replace(/\boff\b/g, 'geschlossen'));
}

// Ohne Claude (Schluessel fehlt oder Anfrage scheitert): schlichte Vorlage.
export function vorlagenTexte(f) {
  return {
    claim: f.werkstatt ? 'Ihr Auto in guten Händen' : 'Gute Autos. Ehrliche Beratung.',
    unterzeile: `${f.art} in ${f.ort || 'Ihrer Region'} – persönlich, verlässlich und gleich um die Ecke.`,
    ueber_uns: `${f.name} ist Ihr Ansprechpartner rund ums Auto in ${f.ort || 'der Region'}. Wir nehmen uns Zeit für Ihre Fragen und finden gemeinsam die passende Lösung.`,
    leistungen: f.werkstatt
      ? [{ titel: 'Inspektion', text: 'Wartung nach Herstellervorgaben, damit Ihr Auto zuverlässig bleibt.' },
        { titel: 'Reparatur', text: 'Schnelle Hilfe bei Verschleiß und Schäden.' },
        { titel: 'Reifenservice', text: 'Wechsel, Einlagerung und neue Reifen.' },
        { titel: 'HU-Vorbereitung', text: 'Wir bereiten Ihr Fahrzeug auf die Hauptuntersuchung vor.' }]
      : [{ titel: 'Gebrauchtwagen', text: 'Geprüfte Fahrzeuge mit klarer Beschreibung und fairen Preisen.' },
        { titel: 'Ankauf', text: 'Wir machen Ihnen ein Angebot für Ihr Fahrzeug.' },
        { titel: 'Finanzierung', text: 'Passende Raten, transparent erklärt.' },
        { titel: 'Service', text: 'Ansprechpartner auch nach dem Kauf.' }],
    vorteile: ['Persönliche Beratung', 'Faire Preise', 'Kurze Wege'],
  };
}

// Texte von Claude. Wirft bei Fehlern (der Aufrufer faellt auf die Vorlage zurueck
// oder meldet den Grund im Admin).
export async function texteSchreiben(env, f) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('Secret ANTHROPIC_API_KEY fehlt.');
  const angaben = [
    `Name: ${f.name}`,
    `Art: ${f.art}`,
    f.ort ? `Ort: ${f.ort}` : '',
    f.marken.length ? `Marken: ${f.marken.join(', ')}` : 'Marken: keine angegeben',
    f.zeiten.length ? `Öffnungszeiten: ${f.zeiten.join('; ')}` : '',
  ].filter(Boolean).join('\n');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `Schreibe die Texte für diese Vorschau:\n\n${angaben}` }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Anthropic meldet: ${d?.error?.message || `HTTP ${r.status}`}`);
  if (d.stop_reason === 'refusal') throw new Error('Claude hat die Anfrage abgelehnt.');
  const text = (d.content || []).find(b => b.type === 'text')?.text;
  const t = JSON.parse(text);
  // Grenzen hart ziehen – die Seite soll nie aus dem Raster laufen.
  const kurz = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  return {
    claim: kurz(t.claim, 60),
    unterzeile: kurz(t.unterzeile, 160),
    ueber_uns: kurz(t.ueber_uns, 600),
    leistungen: (Array.isArray(t.leistungen) ? t.leistungen : []).slice(0, 4).map(l => ({ titel: kurz(l.titel, 30), text: kurz(l.text, 140) })),
    vorteile: (Array.isArray(t.vorteile) ? t.vorteile : []).slice(0, 3).map(v => kurz(v, 50)),
  };
}

// Vorschau eines Betriebs, nur solange sie nicht abgelaufen ist.
export async function vorschauLaden(env, betriebId) {
  if (!betriebId || !env.DB) return null;
  const z = await env.DB.prepare(
    "SELECT * FROM akquise_vorschauen WHERE betrieb_id = ? AND ablauf > datetime('now')",
  ).bind(betriebId).first();
  if (!z) return null;
  let steckbrief = null;
  try { steckbrief = z.steckbrief ? JSON.parse(z.steckbrief) : null; } catch { /* alte Vorschau */ }
  try { return { ...z, texte: JSON.parse(z.texte), steckbrief }; } catch { return null; }
}

// Was auf der Seite steht, auch wenn es fehlt: ohne Telefon, Anschrift oder
// Zeiten wirkt die Vorschau leer. Fehlendes wird als Platzhalter gezeigt
// (platzhalter: true, kein Link) – nie eine erfundene Nummer, die echt
// aussieht und jemand anderem gehoeren koennte.
export function anzeigeMitPlatzhaltern(brief, f) {
  const ziffern = String(brief.telefon || '').replace(/[^\d+]/g, '');
  const international = ziffern.startsWith('+') ? ziffern.slice(1) : ziffern.startsWith('00') ? ziffern.slice(2) : ziffern.startsWith('0') ? '49' + ziffern.slice(1) : ziffern;
  const mobil = /^491[567]\d{7,}$/.test(international);
  const plzOrt = [brief.plz, brief.ort].filter(Boolean).join(' ');
  return {
    telefon: brief.telefon
      ? { text: brief.telefon, link: `tel:${ziffern}`, platzhalter: false }
      : { text: 'Ihre Telefonnummer', link: null, platzhalter: true },
    whatsapp: mobil
      ? { text: brief.telefon, link: `https://wa.me/${international}`, platzhalter: false }
      : { text: 'Ihre WhatsApp-Nummer', link: null, platzhalter: true },
    adresse: {
      strasse: brief.strasse || 'Ihre Straße 1',
      plz_ort: brief.plz && brief.ort ? plzOrt : `${brief.plz || 'PLZ'} ${brief.ort || 'Ort'}`,
      platzhalter: !brief.strasse || !brief.plz || !brief.ort,
    },
    oeffnungszeiten: f.zeiten.length
      ? { zeilen: f.zeiten, platzhalter: false }
      : { zeilen: ['Mo–Fr 08:00–18:00', 'Sa 09:00–13:00'], platzhalter: true },
  };
}

// Alles, was eine Vorschau zeigt, als ein Objekt – fuer die eigene Seite
// (/fuer/<token>/website) und fuer die Demo (/api/vorschau/<token>), damit
// beide aus derselben Quelle lesen.
export function vorschauDaten(brief, vorschau, { token, meinTelefon = '' } = {}) {
  const f = fakten(brief);
  const sb = vorschau.steckbrief;
  const marken = sb?.marken?.length ? sb.marken : f.marken;
  const fahrzeuge = sb
    ? sb.fahrzeuge.map(id => fahrzeugAnzeige(id, brief.betrieb_id)).filter(Boolean)
    : BEISPIEL_FAHRZEUGE.map(a => ({ ...a, id: null, getriebe: null, foto: null }));
  const google = brief.google_anzahl >= 10 && brief.google_bewertung >= 4
    ? { bewertung: brief.google_bewertung, anzahl: brief.google_anzahl } : null;
  return {
    token,
    ablauf: vorschau.ablauf,
    anzeige: anzeigeMitPlatzhaltern(brief, f),
    betrieb: {
      name: f.name || 'Ihr Betrieb', art: f.art, werkstatt: f.werkstatt, ort: f.ort,
      strasse: brief.strasse || '', plz: brief.plz || '', telefon: brief.telefon || '',
      oeffnungszeiten: f.zeiten, marken,
      lage: Number.isFinite(brief.lat) && Number.isFinite(brief.lng) ? { lat: brief.lat, lng: brief.lng } : null,
      google,
    },
    design: {
      farben: sb?.farben || { knopf: '#1B6FA8', akzent: '#4DA3E0' },
      logo: { art: sb?.logo || 'schrift', initialen: sb?.initialen || '', symbol: sb?.symbol || null,
        symbol_svg: sb?.logo === 'symbol' && SYMBOLE[sb.symbol] ? SYMBOLE[sb.symbol] : null },
    },
    texte: vorschau.texte,
    fahrzeuge: fahrzeuge.map(a => ({
      id: a.id, marke: a.marke, modell: a.modell, preis: a.preis, km: a.km, ez: a.ez, ps: a.ps,
      kraftstoff: a.kraftstoff, getriebe: a.getriebe, bild: a.bild, foto: a.foto,
    })),
    hero_bild: (sb && fahrzeuge.find(a => !NICHT_ALS_TITEL.has(a.id))?.bild) || HERO_BILD,
    kontakt: { telefon_ihsan: meinTelefon, aktion_url: 'https://ihsan-yilmaz.de/api/fuer', persoenliche_seite: `https://ihsan-yilmaz.de/fuer/${token}?seite=1` },
  };
}
