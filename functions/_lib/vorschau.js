// Website-Vorschau fuer einen angeschriebenen Betrieb (/fuer/<token>/website).
//
// Grundsatz (Rechtsrahmen 2026-09-23): nur Fakten zum Betrieb – Name, Ort,
// Art, Marken, Oeffnungszeiten, Telefon – und eigene bzw. frei nutzbare
// Bilder. Keine Fotos, Texte oder Logos von der Website des Betriebs, keine
// Fahrzeuge von mobile.de (Kopieren = Vervielfaeltigung, § 16 UrhG; mobile.de
// verbietet das Auslesen). Die Fahrzeuge sind die Beispiel-Anzeigen der
// eigenen Autohaus-Demo, die Fotos stammen von Unsplash (frei nutzbar).
//
// Die Texte schreibt Claude einmal beim Bauen (Admin → Zweiter Brief), sie
// liegen in akquise_vorschauen und laufen nach 30 Tagen ab.

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
- Leistungen allgemein und typisch halten (z. B. Gebrauchtwagen, Ankauf, Finanzierung, Werkstatt-Service), passend zur Art.`;

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
  try { return { ...z, texte: JSON.parse(z.texte) }; } catch { return null; }
}
