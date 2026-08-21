// POST /api/admin/zuordnen – jedes Bild bekommt sein führendes Thema.
//
//   { wieviele: 40 }   die nächsten, die noch keinem Thema zugeordnet sind
//
// Warum das getrennt vom Beschreiben laeuft: die Bilder sind laengst
// angesehen, ihre Beschreibungen stehen in der Datenbank. Fuer die Zuordnung
// muss also kein Foto mehr zur KI – sie liest Saetze und antwortet mit
// Nummern. Das ist rund zwanzigmal billiger als ein neuer Bilddurchlauf und
// dauert Minuten statt einer Viertelstunde.
//
// Gebraucht wird es, wenn sich die Themen aendern: neue kommen dazu, alte
// fallen weg. Dann steht hier ein Knopf statt einer Datenbankwanderung.

import { alle } from './kategorien.js';

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const MODELL = 'claude-sonnet-5';
const AUF_EINMAL = 25;   // Beschreibungen je Aufruf – mehr sprengt die Antwort

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);
  if (!env.ANTHROPIC_API_KEY) {
    return antwort({ ok: false, fehler: 'Kein Zugang zum Modell hinterlegt.' }, 400);
  }

  let d;
  try { d = await request.json(); } catch { d = {}; }
  const wieviele = Math.min(Number(d && d.wieviele) || AUF_EINMAL, AUF_EINMAL);

  try {
    const themen = (await alle(db)).map(k => ({ id: k.id, titel: k.titel, hinweis: k.hinweis }));
    if (!themen.length) return antwort({ ok: false, fehler: 'Es gibt keine Themen.' }, 400);

    // Alles, was kein gueltiges Thema traegt – dazu gehoert auch, was noch
    // unter einem geloeschten steht.
    const gueltig = themen.map(t => `'${t.id.replace(/'/g, "''")}'`).join(',');
    const { results } = await db.prepare(
      `SELECT schluessel, beschreibung FROM studio_vorrat
        WHERE beschreibung IS NOT NULL AND geloescht_am IS NULL
          AND (motiv IS NULL OR motiv NOT IN (${gueltig}))
        ORDER BY quelle LIMIT ?`
    ).bind(wieviele).all();

    const offene = (results || []).map(r => {
      let b = null;
      try { b = JSON.parse(r.beschreibung); } catch { /* alte Zeile */ }
      return b && b.beschreibung
        ? { schluessel: r.schluessel, satz: String(b.beschreibung).replace(/\s+/g, ' ').trim() }
        : null;
    }).filter(Boolean);

    if (!offene.length) {
      return antwort({ ok: true, fertig: 0, offen: await zaehlen(db, gueltig) });
    }

    const zuordnung = await fragen(env.ANTHROPIC_API_KEY, offene, themen);

    const erlaubt = new Set(themen.map(t => t.id));
    let fertig = 0;
    for (const [i, bild] of offene.entries()) {
      const thema = zuordnung[String(i + 1)];
      if (!thema || !erlaubt.has(thema)) continue;
      await db.prepare('UPDATE studio_vorrat SET motiv = ? WHERE schluessel = ?')
        .bind(thema, bild.schluessel).run();
      fertig += 1;
    }

    return antwort({ ok: true, fertig, offen: await zaehlen(db, gueltig) });
  } catch (err) {
    console.error('Zuordnen:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 502);
  }
}

const zaehlen = async (db, gueltig) => (await db.prepare(
  `SELECT COUNT(*) n FROM studio_vorrat WHERE beschreibung IS NOT NULL AND geloescht_am IS NULL
     AND (motiv IS NULL OR motiv NOT IN (${gueltig}))`
).first())?.n || 0;

async function fragen(schluessel, bilder, themen) {
  const auftrag = `Du ordnest Bilder aus der Galerie von AIY | Ihsan Yilmaz
(Webentwicklung und IT aus Würzburg) jeweils EINEM Thema zu. Die Themen sind
die, unter denen später Instagram-Beiträge entstehen.

THEMEN:
${themen.map(t => `  ${t.id} – ${t.titel}${t.hinweis ? ': ' + t.hinweis : ''}`).join('\n')}

FOTOS (Beschreibung, nummeriert):
${bilder.map((b, i) => `${i + 1}. ${b.satz}`).join('\n')}

Antworte NUR mit dem JSON, ohne ein Wort davor oder danach. Für jede Nummer
genau ein Thema, in einer einzigen Zeile:

{"1":"technik","2":"wuerzburg",…}

Nimm das Thema, unter dem das Bild am ehesten in einem Beitrag stünde – nicht
das, was zufällig auch zu sehen ist. Ein Bildschirm mit Code gehört zu
Entwicklung, auch wenn eine Kaffeetasse danebensteht. Ein Foto von Ihsan
gehört zu Ihsan, auch wenn er vor einem Rechner sitzt. Im Zweifel das
naheliegendste, nicht das seltenste.`;

  const a = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': schluessel,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODELL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: auftrag }]
    })
  });

  const roh = await a.text();
  let d = null;
  try { d = JSON.parse(roh); } catch { /* siehe unten */ }
  if (!d) throw new Error(`Antwort war kein JSON (${a.status}): ${roh.slice(0, 120)}`);
  if (!a.ok) throw new Error((d.error && d.error.message) || `Status ${a.status}`);

  const text = (d.content || []).filter(t => t.type === 'text').map(t => t.text).join('');
  const anfang = text.indexOf('{');
  const ende = text.lastIndexOf('}');
  if (anfang < 0 || ende < anfang) {
    throw new Error(d.stop_reason === 'max_tokens'
      ? 'Die Antwort war zu lang und wurde abgeschnitten.'
      : 'Keine Zuordnung zurückbekommen.');
  }
  return JSON.parse(text.slice(anfang, ende + 1));
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
