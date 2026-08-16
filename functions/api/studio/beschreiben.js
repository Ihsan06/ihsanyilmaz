// POST /api/admin/beschreiben – ein Modell sieht sich Bilder an und schreibt
// auf, was darauf zu sehen ist. Die Beschreibung landet in der Datenbank.
//
//   { schluessel: ["abc.jpg", …] }   genau diese beschreiben
//   { offene: 20 }                   die naechsten 20 ohne Beschreibung
//
// Warum das getrennt vom Beitragsbauen laeuft:
//   Ein Bild aendert sich nie. Es einmal anzusehen und das Ergebnis zu
//   behalten ist billiger, schneller und besser als es bei jedem Klick neu
//   anzuschauen – und der Beitragsbauer arbeitet danach nur noch mit Text.
//   Aus Text lassen sich in einer Sekunde zwanzig Varianten bauen; aus
//   Bildern nicht.
//
// Beschrieben wird in Saetzen, nicht in Schlagworten: "Zwei Mechaniker heben
// gemeinsam ein Rad an, Hebebuehne im Hintergrund, Werkstatthalle" sagt einem
// spaeteren Modell weit mehr als "werkstatt".

import { alle } from './kategorien.js';

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const MODELL = 'claude-sonnet-5';
const AUF_EINMAL = 25;      // Obergrenze je Aufruf – sonst laeuft der Worker in die Zeit

// Die Kategorien stehen in der Datenbank, nicht hier: legt jemand in der
// Galerie eine neue an, sortiert das Modell ab dem naechsten Bild danach ein,
// ohne dass jemand Code anfassen muss.
const THEMEN = 'service, tuev, winter, sommer, urlaub, team, nachwuchs, ankauf, finanzierung';

function anweisung(kategorien) {
  const auswahl = kategorien.map(k => k.id).join(', ') || 'werkstatt, team, detail';
  const erklaert = kategorien.filter(k => k.hinweis)
    .map(k => `  ${k.id} – ${k.hinweis}`).join('\n');

  return `Du beschreibst ein Foto aus dem Alltag eines Autohauses mit
eigener Werkstatt (Autohaus Diezmann, Weidhausen bei Coburg). Die Beschreibung
wird später benutzt, um passende Bilder für Instagram-Beiträge auszuwählen –
sie muss also sagen, was zu sehen ist und wofür sich das Bild eignet.

Diese Kategorien gibt es:
${erklaert || '  (ohne nähere Beschreibung)'}

Antworte NUR mit JSON:

{
  "beschreibung": "<2 bis 3 Sätze: was ist zu sehen, wie viele Personen, was tun sie, wo, welches Licht, welche Stimmung>",
  "motiv": "<die EINE Kategorie, die am besten passt: ${auswahl}>",
  "taugt_fuer": ["<wozu das Bild sonst noch taugt – Kategorien von oben und/oder Themen: ${THEMEN}>"],
  "staerke": <1 bis 5, wie stark das Bild als Titelbild wirkt>,
  "personen": "<keine | unkenntlich | erkennbar>",
  "hinweis": "<nur falls etwas dagegen spricht: lesbares Kennzeichen, unscharf, unaufgeräumt – sonst leerer String>"
}`;
}

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);
  if (!env.ANTHROPIC_API_KEY) {
    return antwort({ ok: false, fehler: 'Kein Zugang zum Modell hinterlegt.' }, 400);
  }

  let d;
  try { d = await request.json(); } catch { d = null; }
  if (!d) return antwort({ ok: false, fehler: 'Nichts erhalten.' }, 400);

  // Welche Bilder? Entweder ausdruecklich genannt oder die naechsten offenen.
  let schluessel = [];
  if (Array.isArray(d.schluessel) && d.schluessel.length) {
    schluessel = d.schluessel.map(String).slice(0, AUF_EINMAL);
  } else {
    const wieviele = Math.min(Number(d.offene) || 10, AUF_EINMAL);
    const { results } = await db.prepare(
      `SELECT schluessel FROM studio_vorrat
        WHERE beschreibung IS NULL AND geloescht_am IS NULL ORDER BY quelle LIMIT ?`
    ).bind(wieviele).all();
    schluessel = (results || []).map(r => r.schluessel);
  }
  if (!schluessel.length) {
    return antwort({ ok: true, fertig: 0, offen: await offeneZaehlen(db), meldung: 'Alle Bilder sind beschrieben.' });
  }

  const { fertig, schief } = await beschreibeBilder(env, new URL(request.url).origin, schluessel);
  return antwort({ ok: true, fertig: fertig.length, offen: await offeneZaehlen(db),
                   beispiele: fertig.slice(0, 3), schief });
}

// Was im Papierkorb liegt, zaehlt nicht als offen – sonst zeigt der Knopf
// dauerhaft eine Zahl an, die sich durch Ansehen nicht mehr abbauen laesst,
// und schickt geloeschte Fotos zum Modell.
const offeneZaehlen = async db => (await db.prepare(
  'SELECT COUNT(*) n FROM studio_vorrat WHERE beschreibung IS NULL AND geloescht_am IS NULL'
).first())?.n || 0;

// Die eigentliche Arbeit – auch von aussen aufrufbar. Der Upload in vorrat.js
// nimmt diesen Weg statt eines fetch auf die eigene Domain: ein Worker, der
// sich selbst per HTTP aufruft, landet nicht zuverlaessig bei der Function.
export async function beschreibeBilder(env, basis, schluessel) {
  const db = env.DB;
  const fertig = [];
  const schief = [];

  // Einmal je Lauf, nicht je Bild: die Liste aendert sich waehrenddessen nicht.
  const kategorien = await alle(db);
  const auftrag = anweisung(kategorien);
  const erlaubt = new Set(kategorien.map(k => k.id));

  for (const s of schluessel) {
    try {
      const bild = await alsDaten(`${basis}/bilder/${s}`);
      const plan = await fragen(env.ANTHROPIC_API_KEY, bild, auftrag);
      // Erfindet das Modell eine Kategorie, bleibt das Bild lieber unsortiert
      // als in einer Schublade, die es nicht gibt.
      if (plan.motiv && !erlaubt.has(plan.motiv)) plan.motiv = null;
      await db.prepare(
        'UPDATE studio_vorrat SET beschreibung = ?, motiv = COALESCE(?, motiv) WHERE schluessel = ?'
      ).bind(JSON.stringify(plan), plan.motiv || null, s).run();
      fertig.push({ schluessel: s, beschreibung: plan.beschreibung, motiv: plan.motiv });
    } catch (err) {
      console.error('Beschreiben', s, err);
      schief.push({ schluessel: s, fehler: String(err && err.message || err).slice(0, 140) });
    }
  }
  return { fertig, schief };
}

// ─── Kleinkram ───

async function alsDaten(u) {
  const a = await fetch(u, { headers: { Accept: 'image/*' } });
  if (!a.ok) throw new Error(`Bild nicht abrufbar (${a.status}).`);
  const puffer = new Uint8Array(await a.arrayBuffer());
  let roh = '';
  for (let i = 0; i < puffer.length; i += 8192) {
    roh += String.fromCharCode(...puffer.subarray(i, i + 8192));
  }
  const typ = (a.headers.get('content-type') || 'image/jpeg').split(';')[0];
  return { type: 'base64', media_type: /^image\//.test(typ) ? typ : 'image/jpeg', data: btoa(roh) };
}

async function fragen(schluessel, bild, auftrag) {
  const a = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': schluessel,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODELL,
      max_tokens: 500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: bild },
        { type: 'text', text: auftrag }
      ] }]
    })
  });
  const roh = await a.text();
  let d = null;
  try { d = JSON.parse(roh); } catch { /* siehe unten */ }
  if (!d) throw new Error(`Modell antwortete kein JSON (${a.status}): ${roh.slice(0, 120)}`);
  if (!a.ok) throw new Error((d.error && d.error.message) || `Status ${a.status}`);

  const text = (d.content || []).filter(t => t.type === 'text').map(t => t.text).join('');
  const anfang = text.indexOf('{');
  const ende = text.lastIndexOf('}');
  if (anfang < 0) throw new Error('Keine Beschreibung zurückbekommen.');
  return JSON.parse(text.slice(anfang, ende + 1));
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
