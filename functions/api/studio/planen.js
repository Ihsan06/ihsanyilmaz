// POST /api/admin/planen – ein Modell schaut sich die Fotos an und sagt,
// wie der Beitrag gebaut werden sollte.
//
//   { bilder: [...], angaben: "BMW M3 · 2022 · 35.400 km" }   Fahrzeug
//   { bilder: [...], thema: "service" }                       Werkstatt
//
// WICHTIG – die Arbeitsteilung:
//   Das Modell PLANT. Es sagt, welches Bild vorn steht, in welcher
//   Reihenfolge die anderen kommen, wo das Fahrzeug im Bild sitzt und worauf
//   der Text eingehen sollte. Es VERAENDERT nichts. Zugeschnitten, beschriftet
//   und zusammengesetzt wird anschliessend von unserem Canvas – pixelgenau
//   und nachvollziehbar.
//
// Das ist nicht nur sauberer, es ist auch die rechtlich ruhige Seite: seit
// dem 2. August 2026 muss kennzeichnen, wer Fahrzeugbilder mit KI erzeugt
// oder veraendert (EU AI Act). Auswaehlen und Anordnen faellt nicht darunter,
// Retuschieren schon. Deshalb tun wir Letzteres nicht.
//
// Braucht das Secret ANTHROPIC_API_KEY. Ohne es antwortet der Endpunkt mit
// einer klaren Meldung statt mit einem Fehler.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const MODELL = 'claude-sonnet-5';   // Vision, schnell, guenstig
const MAX_BILDER = 8;       // als Daten mitgeschickt – acht reichen fuer einen Plan

export async function onRequestPost({ env, request }) {
  if (!env.ANTHROPIC_API_KEY) {
    return antwort({ ok: false, fehler: 'Kein Zugang zum Modell hinterlegt (ANTHROPIC_API_KEY).' }, 400);
  }

  let d;
  try { d = await request.json(); } catch { d = null; }
  if (!d) return antwort({ ok: false, fehler: 'Nichts erhalten.' }, 400);

  try {
    const { bilder, angaben, auftrag } = await sammeln(d, request);
    if (!bilder.length) return antwort({ ok: false, fehler: 'Keine Bilder zum Ansehen.' }, 400);

    const plan = await fragen(env.ANTHROPIC_API_KEY, bilder, angaben, auftrag);
    return antwort({ ok: true, plan, angesehen: bilder.length });
  } catch (err) {
    console.error('Planen:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 502);
  }
}

// ─── Was angeschaut wird ───

async function sammeln(d, request) {
  const eigene = new URL(request.url).origin;

  // Die Bilder kommen vom Browser mit. Frueher holte dieser Endpunkt sie sich
  // selbst ueber /api/vehicles – ein Worker, der seine eigene Domain per fetch
  // aufruft, landet dabei aber nicht zwingend bei der Function, sondern bei
  // der statischen Auslieferung. Zurueck kam HTML, und daraus wurde
  // "unexpected token <". Der Browser hat die Bilder ohnehin schon geladen.
  const bilder = (Array.isArray(d.bilder) ? d.bilder : [])
    .map(u => String(u))
    .map(u => (u.startsWith('http') ? u : eigene + u))
    .filter(u => /^https?:\/\//.test(u))
    .slice(0, MAX_BILDER);

  return {
    bilder,
    angaben: String(d.angaben || d.thema || '').slice(0, 300),
    auftrag: d.thema ? 'werkstatt' : 'fahrzeug'
  };
}


// ─── Das Modell ───

function anweisung(auftrag, angaben) {
  const gemeinsam = `Du planst einen Instagram-Beitrag für ein Autohaus in Weidhausen bei
Coburg (Autohaus Diezmann). Du bekommst nummerierte Fotos. Du veränderst KEINE
Bilder – du wählst aus und ordnest an.

Antworte NUR mit JSON, ohne Fließtext davor oder danach.`;

  if (auftrag === 'fahrzeug') {
    return `${gemeinsam}

Fahrzeug: ${angaben || 'keine Angaben'}

{
  "titelbild": <Nummer>,
  "reihenfolge": [<Nummern, 4 bis 6 Stück, beginnend mit dem Titelbild>],
  "begruendung": "<ein Satz, warum dieses Titelbild>",
  "zuschnitt": { "waagrecht": <-30 bis 30>, "senkrecht": <-30 bis 30> },
  "auffaellig": "<was auf den Fotos auffällt und in den Text gehört, ein Satz>",
  "warnung": "<nur falls ein Foto ungeeignet ist: Kennzeichen lesbar, Person erkennbar, unscharf – sonst leerer String>"
}

Zum Titelbild: das Fahrzeug möglichst ganz im Bild, schräg von vorn, ruhiger
Hintergrund, gutes Licht. Zur Reihenfolge: außen, dann Detail, dann Innenraum,
dann Kofferraum oder Besonderheit – wie ein Rundgang.

zuschnitt gibt an, wie weit der Ausschnitt beim TITELBILD verschoben werden
soll, damit das Fahrzeug mittig sitzt: in Prozent der Bildbreite bzw. -höhe,
positiv heißt nach rechts bzw. nach unten. 0 wenn es schon passt.`;
  }

  return `${gemeinsam}

${angaben || ''}

{
  "reihenfolge": [<Nummern, 3 bis 5 Stück, das erste ist das stärkste>],
  "begruendung": "<ein Satz>",
  "auffaellig": "<was die Bilder zusammen erzählen, ein Satz>",
  "warnung": "<nur falls ein Foto ungeeignet ist – sonst leerer String>"
}

Die Bilder sollen zusammen eine Geschichte ergeben, nicht dasselbe dreimal.
Menschen bei der Arbeit wirken stärker als leere Werkstattecken.`;
}

// Die Bilder gehen als Daten mit, nicht als Adresse. Der Weg ueber die
// Adresse waere kuerzer, scheitert hier aber: Anthropic antwortet mit
// "Unable to download the file" – unsere Bilder liegen hinter Cloudflare und
// mobile.de laesst fremde Abrufe ohnehin nicht ohne Weiteres zu. Der Worker
// holt sie also selbst und reicht sie durch.
// Base64 blaeht um rund ein Drittel auf, und die Messages-API weist einzelne
// Bilder ueber 5 MB ab. Ohne Grenze bringt EIN zu grosses Foto die ganze
// Anfrage zu Fall – hochgeladen werden duerfen bis zu 5 MB (siehe bild.js),
// der Fall ist also erreichbar. Ueber der Grenze wirft es wie ein nicht
// abrufbares Bild, und der Aufrufer ueberspringt es.
const GRENZE_ROH = 3.6 * 1024 * 1024;

async function alsDaten(u) {
  const a = await fetch(u, { headers: { Accept: 'image/*' } });
  if (!a.ok) throw new Error(`Bild nicht abrufbar (${a.status}).`);
  const puffer = new Uint8Array(await a.arrayBuffer());
  if (puffer.length > GRENZE_ROH) {
    throw new Error(`Bild zu gross fuer das Modell (${Math.round(puffer.length / 1024 / 1024 * 10) / 10} MB).`);
  }
  // In Haeppchen umwandeln: bei einem Schlag ueber alles laeuft der
  // Argumentstapel von String.fromCharCode ueber.
  let roh = '';
  for (let i = 0; i < puffer.length; i += 8192) {
    roh += String.fromCharCode(...puffer.subarray(i, i + 8192));
  }
  const typ = (a.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return { type: 'base64', media_type: /^image\//.test(typ) ? typ : 'image/jpeg', data: btoa(roh) };
}

async function fragen(schluessel, bilder, angaben, auftrag) {
  const inhalt = [];
  for (let i = 0; i < bilder.length; i++) {
    let quelle;
    try { quelle = await alsDaten(bilder[i]); } catch { continue; }   // eines fehlt, der Rest reicht
    inhalt.push({ type: 'text', text: `Foto ${i + 1}:` });
    inhalt.push({ type: 'image', source: quelle });
  }
  if (!inhalt.length) throw new Error('Keines der Bilder ließ sich laden.');
  inhalt.push({ type: 'text', text: anweisung(auftrag, angaben) });

  const a = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': schluessel,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODELL,
      max_tokens: 700,
      messages: [{ role: 'user', content: inhalt }]
    })
  });

  // Erst als Text lesen, dann selbst auswerten: kommt HTML zurueck – etwa
  // von einem Zwischenserver oder einer Fehlerseite – soll in der Meldung
  // stehen, WER geantwortet hat. "unexpected token <" allein sagt das nicht.
  const roh = await a.text();
  let d = null;
  try { d = JSON.parse(roh); } catch { /* siehe unten */ }
  if (!d) {
    throw new Error(`Antwort von api.anthropic.com war kein JSON (Status ${a.status}): `
      + roh.slice(0, 160).replace(/\s+/g, ' '));
  }
  if (!a.ok) {
    throw new Error((d.error && d.error.message) || `Modell antwortete mit ${a.status}.`);
  }

  const text = (d.content || []).filter(t => t.type === 'text').map(t => t.text).join('');
  // Das Modell soll nur JSON liefern – falls doch etwas drumherum steht,
  // schneiden wir es heraus, statt an der Antwort zu scheitern.
  const anfang = text.indexOf('{');
  const ende = text.lastIndexOf('}');
  if (anfang < 0 || ende < anfang) throw new Error('Das Modell hat keinen Plan zurückgegeben.');
  try {
    return JSON.parse(text.slice(anfang, ende + 1));
  } catch {
    throw new Error('Der Plan war nicht lesbar.');
  }
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
