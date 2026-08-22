// POST /api/admin/zusammenstellen – aus dem Nichts einen fertigen Beitrag.
//
//   { thema: "service" }   in diese Richtung
//   { }                    das Modell sucht sich selbst etwas aus
//
// Der Unterschied zum alten Planer: hier geht KEIN Bild zur KI. Alle 266
// Fotos sind einmal angesehen worden (siehe beschreiben.js) und liegen als
// Saetze in der Datenbank. Das Modell liest also Text und antwortet Text –
// das dauert Sekunden statt Minuten, kostet einen Bruchteil, und es kann
// dabei den GANZEN Vorrat ueberblicken statt acht mitgeschickter Bilder.
//
// Warum es trotzdem nicht jedes Mal dasselbe vorschlaegt: der Worker legt dem
// Modell eine gewuerfelte Auswahl vor, nicht immer die staerksten. Die
// Vielfalt kommt also aus der Ziehung, die Qualitaet aus dem Modell.
//
// Der Text wird mitgeschrieben, passend zu genau diesen Bildern – das ist der
// eigentliche Punkt. Ein Baukastentext weiss nicht, dass auf Bild 3 jemand
// eine Bremsscheibe in der Hand haelt; dieser hier schon.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const MODELL = 'claude-sonnet-5';

// Feste Angaben gehoeren nicht ins Modell: eine erfundene Telefonnummer faellt
// keinem auf, bis jemand sie waehlt. Der Worker haengt sie selbst an.
// Notfallwerte. Der wirkliche Schluss steht in studio_einstellungen unter
// "fuss" und wird zur Laufzeit geholt – hier stand vorher die Nummer und die
// Ortsmarken des Autohauses, aus dem dieser Baukasten stammt.
const SCHLUSS = 'Anfragen per Mail:\n\u{1F4E7}  kontakt@ihsan-yilmaz.de\n\u{1F449}  Mehr auf ihsan-yilmaz.de';
const ORT = ['aiyweb', 'wuerzburg', 'würzburg', 'unterfranken', 'mainfranken'];

// Holt den gespeicherten Schluss. Dass die Symbole darin stehen, ist kein
// Zufall: der Text, den das Modell schreibt, endet sonst nackt, und der
// Beitrag saehe anders aus als jeder von Hand gebaute.
// Was das Modell schreibt, bleibt liegen. Bisher war ein Vorschlag weg,
// sobald man die Seite verlassen hat – und ein guter Satz laesst sich zwei
// Monate spaeter noch einmal verwenden.
//
// Still im Hintergrund: scheitert das Merken, ist der Beitrag trotzdem
// fertig. Ein Vorschlag, der an einer vollen Tabelle stirbt, waere die
// schlechtere Seite des Handels.
async function satzMerken(db, thema, text, marken) {
  if (!db || !text || text.trim().length < 20) return;
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO studio_saetze (thema, text, hashtags, herkunft)
       VALUES (?, ?, ?, 'ki')`
    ).bind(String(thema || '').slice(0, 80), text.trim(), String(marken || '').slice(0, 400)).run();
  } catch (err) {
    console.error('Satz merken:', err);
  }
}

async function schlussHolen(db) {
  try {
    const r = await db.prepare(
      "SELECT wert FROM studio_einstellungen WHERE schluessel = 'fuss'").first();
    if (!r || !r.wert) return { nummer: SCHLUSS, hashtags: '' };
    const d = JSON.parse(r.wert);
    return { nummer: d.nummer || SCHLUSS, hashtags: d.hashtags || '' };
  } catch {
    return { nummer: SCHLUSS, hashtags: '' };
  }
}

const TON = `So klingt der Kanal – zwei echte Beispiele:

"Ihre Website ist älter als Ihr Smartphone?

Dann sehen Kunden dort etwas anderes als das, was Ihr Betrieb heute ist. Eine
neue Seite muss weder Monate dauern noch ein Vermögen kosten.

Schreiben Sie mir:"

"Kein Betrieb braucht zwanzig Unterseiten.

Er braucht eine, auf der steht, was er macht, für wen, und wie man ihn
erreicht. Alles andere ist Beiwerk.

Melden Sie sich:"

Merkmale: Sie-Form, kurze Sätze, eine Frage oder Feststellung als Einstieg,
dann zwei bis drei Sätze Inhalt, dann die Aufforderung, sich zu melden.
Nüchtern und sachlich, aus der Sicht eines Einzelnen ("ich"), nicht eines
Teams ("wir"). Keine Werbesprache, keine Ausrufezeichen, keine Emojis,
kein "Ihr Partner für", kein "Wir freuen uns auf Sie".`;

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);
  if (!env.ANTHROPIC_API_KEY) {
    return antwort({ ok: false, fehler: 'Kein Zugang zum Modell hinterlegt.' }, 400);
  }

  let d;
  try { d = await request.json(); } catch { d = {}; }
  const thema = String((d && d.thema) || '').slice(0, 40);
  const machart = ['beitrag', 'story', 'reel'].includes(d && d.format) ? d.format : 'beitrag';

  // Zweiter Weg: ein Fahrzeug aus dem Bestand. Dessen Bilder kommen von
  // mobile.de und stehen in keiner Beschreibung – die sieht sich das Modell
  // hier direkt an. Die Fahrzeugdaten sind dabei wichtiger als die Fotos:
  // Baujahr, Laufleistung und Ausstattung tragen den Text.
  if (d && d.fahrzeug) {
    try {
      return antwort({ ok: true, ...(await fuerFahrzeug(env, d.fahrzeug, d.bilder || [], machart)) });
    } catch (err) {
      console.error('Zusammenstellen Fahrzeug:', err);
      return antwort({ ok: false, fehler: String(err.message || err) }, 502);
    }
  }

  try {
    // Der Klartextname der Kategorie: eine frisch angelegte steht noch in
    // keinem "motiv"-Feld, aber ihr Wort kann in Beschreibungen vorkommen.
    const k = thema
      ? await db.prepare('SELECT titel FROM studio_kategorien WHERE id = ?').bind(thema).first()
      : null;
    const vorrat = await lesen(db, thema, k && k.titel);
    if (!vorrat.length) {
      return antwort({ ok: false, fehler: 'Kein Bild ist bisher angesehen worden. '
        + 'In der Galerie einmal „ansehen lassen“ starten.' }, 400);
    }

    const { plan, verbrauch } = await fragen(env.ANTHROPIC_API_KEY,
      anweisung(vorrat, (k && k.titel) || thema, machart));

    // Nummern zurueck auf Schluessel. Das Modell zaehlt ab 1 und erfindet
    // gelegentlich eine Nummer zu viel – was nicht passt, faellt raus.
    const bilder = (Array.isArray(plan.bilder) ? plan.bilder : [])
      .map(n => vorrat[Number(n) - 1])
      .filter(Boolean)
      .filter((b, i, a) => a.findIndex(x => x.schluessel === b.schluessel) === i)
      .slice(0, 10);

    if (!bilder.length) throw new Error('Das Modell hat keine Bilder benannt.');

    // Der gespeicherte Schluss samt Symbolen – derselbe, den ein von Hand
    // gebauter Beitrag traegt. Vorher hing hier nur eine Telefonnummer.
    const schluss = await schlussHolen(db);
    // Der lesbare Titel der Kategorie, nicht die Kennung: aus "Bei Google
    // gefunden" wird ein brauchbares Schlagwort, aus "sichtbarkeit" nicht.
    const gewaehltesThema = String((k && k.titel) || plan.thema || thema || '').slice(0, 80);
    const marken = hashtags(plan.hashtags, gewaehltesThema);
    // Nur ganze Beitragstexte merken. Eine Story ist eine Zeile im Bild und
    // taugt nicht als Spruch fuer spaeter.
    if (machart !== 'story') {
      await satzMerken(db, gewaehltesThema, saeubern(plan.text), marken);
    }

    return antwort({
      ok: true,
      beitrag: {
        thema: gewaehltesThema,
        bilder: bilder.map(b => b.schluessel),
        text: machart === 'story' ? String(plan.zeile || plan.text || '').slice(0, 90)
          : saeubern(plan.text) + '\n\n' + schluss.nummer,
        zeile: String(plan.zeile || '').slice(0, 90),
      unterzeile: String(plan.unterzeile || '').slice(0, 90),
      stelle: ['oben', 'mitte', 'unten'].includes(plan.stelle) ? plan.stelle : 'unten',
      sticker: plan.sticker && plan.sticker.art && plan.sticker.art !== 'keiner' ? {
        art: String(plan.sticker.art).slice(0, 20),
        text: String(plan.sticker.text || '').slice(0, 90),
        antworten: (Array.isArray(plan.sticker.antworten) ? plan.sticker.antworten : [])
          .slice(0, 4).map(w => String(w).slice(0, 30))
      } : null,
        szenen: Array.isArray(plan.szenen) ? plan.szenen.slice(0, 8) : null,
        musik: String(plan.musik || '').slice(0, 160),
        hashtags: marken
      },
      gemerkt: machart !== 'story',
      gelesen: vorrat.length,
      cent: verbrauch
    });
  } catch (err) {
    console.error('Zusammenstellen:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 502);
  }
}

// ─── Der Vorrat ───

// Die Ziehung passiert in der Datenbank, nicht im Worker. Alle 266 Zeilen zu
// holen und einzeln zu zerlegen ist Rechenzeit, und davon hat ein Worker sehr
// wenig – wird sie knapp, bricht Cloudflare mit einer eigenen Fehlerseite ab,
// noch bevor unser Code eine ordentliche Meldung schreiben kann.
//
// Zwei Zuege: einer im Thema, einer quer durch alles. So hat das Thema
// Vorrang und es sind trotzdem Ueberraschungen dabei.
async function lesen(db, thema, titel) {
  // Was in den letzten dreissig Tagen in einem Beitrag war, faellt hinten
  // runter – gesperrt wird es nicht. Manchmal ist ein Bild einfach das beste,
  // und bei einem Thema mit wenigen Bildern waere ein Verbot toedlich.
  const FRISCH = "COALESCE(zuletzt_benutzt, '') < datetime('now', '-30 days')";
  // geloescht_am IS NULL: was im Papierkorb liegt, darf nicht wieder
  // vorgeschlagen werden. Die Datei bleibt beim Loeschen in R2 liegen und
  // /bilder/<schluessel> liefert sie weiter aus – ohne diese Bedingung waere
  // ein weggeworfenes Foto also nicht nur waehlbar, sondern ginge auch
  // wirklich zu Instagram. In der Galerie taucht es dann nicht einmal als
  // Kachel auf, es liesse sich gar nicht wieder abwaehlen.
  const SATZ = `SELECT schluessel, motiv, beschreibung FROM studio_vorrat
                 WHERE beschreibung IS NOT NULL AND geloescht_am IS NULL`;
  const zuege = [];
  if (thema) {
    // Erst genau: die Spalte motiv ist das eingestellte Thema – sie wird beim
    // Einsortieren gesetzt und ist das, was die Galerie als Filter zeigt.
    // Dazu "taugt fuer" aus der Beschreibung, denn ein Foto passt oft zu
    // mehreren Themen.
    //
    // Frueher stand hier nur der LIKE auf den Beschreibungstext. Der trifft
    // aber das motiv, das beim ANSEHEN ins JSON geschrieben wurde – und
    // Einsortieren ruehrt das JSON nicht an, es setzt die Spalte. Von 265
    // beschriebenen Bildern trugen dadurch 214 im JSON ein anderes Thema als
    // in der Spalte, und ein frisch einsortiertes Thema fand null Bilder.
    zuege.push(db.prepare(
      `${SATZ} AND (motiv = ? OR beschreibung LIKE ?)
        ORDER BY ${FRISCH} DESC, RANDOM() LIMIT 40`)
      .bind(thema, `%"${thema}"%`).all());
    // Dann unscharf im Beschreibungstext. Das ist der Weg fuer eine gerade
    // angelegte Kategorie: kein Bild traegt sie als Etikett, aber "Oldtimer"
    // steht vielleicht mitten im Satz.
    if (titel && titel.length > 3) {
      zuege.push(db.prepare(`${SATZ} AND beschreibung LIKE ? ORDER BY RANDOM() LIMIT 20`)
        .bind(`%${titel}%`).all());
    }
  }
  zuege.push(db.prepare(
    `${SATZ} ORDER BY ${FRISCH} DESC, RANDOM() LIMIT ${thema ? 25 : 55}`).all());

  const zeilen = [];
  const drin = new Set();
  for (const zug of await Promise.all(zuege)) {
    for (const r of (zug.results || [])) {
      if (drin.has(r.schluessel)) continue;
      drin.add(r.schluessel);
      zeilen.push(r);
    }
  }

  return zeilen.map(r => {
    let b = null;
    try { b = JSON.parse(r.beschreibung); } catch { /* alte Zeile, dann eben ohne */ }
    if (!b || !b.beschreibung) return null;
    return {
      schluessel: r.schluessel,
      // Die Spalte zuerst: sie traegt das eingestellte Thema. Das motiv im
      // JSON stammt vom Ansehen und ist oft veraltet – es kuendigte dem
      // Modell sonst ein "werkstatt" an, wo laengst "lackierung" eingestellt
      // war.
      motiv: r.motiv || b.motiv || 'unsortiert',
      satz: String(b.beschreibung).replace(/\s+/g, ' ').trim(),
      staerke: Number(b.staerke) || 3,
      hinweis: String(b.hinweis || '').trim()
    };
  }).filter(Boolean);
}

// ─── Das Modell ───

function anweisung(vorlage, thema, machart) {
  const liste = vorlage.map((b, i) =>
    `${i + 1}. [${b.motiv}${b.staerke >= 4 ? ', stark' : ''}${b.hinweis ? ', Achtung: ' + b.hinweis : ''}] ${b.satz}`
  ).join('\n');

  return `Du stellst einen Instagram-Beitrag für AIY | Ihsan Yilmaz zusammen –
Webentwicklung und IT aus Würzburg, ein Einzelner, keine Agentur, alle
Marken, dazu Gebrauchtwagen und Mietwagen. Der Kanal ist klein und lokal; es
lesen Leute aus der Gegend mit, keine Autofans aus dem Internet.

Du bekommst Beschreibungen echter Fotos aus dem Betrieb. Du wählst daraus aus
und schreibst den Text dazu. Du erfindest nichts, was nicht auf den Bildern
ist, und keine Preise, Termine oder Namen.

${thema ? `Richtung: ${thema}\n` : `Such dir selbst aus, worum es geht – nimm das, wozu die Bilder am meisten hergeben.\n`}
FOTOS:
${liste}

${TON}

Antworte NUR mit JSON:

${machart === 'story' ? `{
  "thema": "<worum es geht, drei bis fünf Wörter>",
  "bilder": [<eine Nummer – das stärkste Foto>],
  "zeile": "<die große Zeile, höchstens 32 Zeichen. Kurz und laut.>",
  "unterzeile": "<eine kleinere Zeile darunter, höchstens 42 Zeichen – oder leer>",
  "stelle": "<oben | mitte | unten – dorthin, wo das Bild ruhig ist und nichts Wichtiges verdeckt wird>",
  "sticker": {
    "art": "<Umfrage | Frage | Quiz | Schieberegler | Countdown | Standort | Link | keiner>",
    "text": "<was auf dem Sticker steht>",
    "antworten": [<bei Umfrage genau zwei, bei Quiz drei bis vier – sonst leer>]
  },
  "hashtags": [<vier bis sechs Wörter ohne Raute>]
}

Eine Story wird im Vorbeiwischen gelesen: zwei Sekunden, ein Gedanke. Die
große Zeile trägt ihn, die kleine ergänzt. Beide zusammen dürfen nicht mehr
sagen als ein Satz.

Zur Stelle: schau, wo im Bild Platz ist. Steht das Fahrzeug unten im Bild,
gehört der Text nach oben. Ist der Himmel groß, ebenfalls oben. Sind Gesichter
oder Hände in der Mitte, dann nicht mitte.

Zum Sticker: er wird in Instagram gesetzt, nicht von uns ins Bild gerechnet –
du schlägst nur vor, was daraufstehen soll. Er ist der Grund, warum jemand
stehenbleibt statt weiterzuwischen, also nimm einen, der zum Bild passt:

  Umfrage – zwei Antworten, funktioniert bei allem mit zwei Meinungen
  Frage – offene Box, gut wenn es etwas zu erzählen gibt
  Quiz – eine richtige Antwort, gut bei Technik und Zahlen
  Schieberegler – ein Emoji zum Ziehen, gut bei allem Schönen
  Countdown – nur wenn es einen echten Termin gibt
  Standort – bei Aufnahmen vom Hof oder aus der Halle
  Link – nur wenn es eine Seite dazu gibt

Wechsle ab. Nicht bei jeder Story eine Umfrage, und nie zweimal dieselbe
Frage. Passt keiner, dann "keiner" – ein aufgesetzter Sticker ist schlechter
als keiner.` : `{
  "thema": "<worum es geht, drei bis fünf Wörter>",
  "bilder": [<Nummern in der Reihenfolge, in der sie im Beitrag stehen sollen; das erste ist das Titelbild>],
  "text": "<der Beitragstext, ohne Hashtags, ohne Telefonnummer, endet mit der Aufforderung anzurufen und einem Doppelpunkt>",
  "hashtags": [<vier bis sieben Wörter ohne Raute, thematisch, klein geschrieben>]
}`}

${machart === 'story' ? '' : `Zur Anzahl: nimm so viele Bilder, wie die Geschichte braucht – manchmal reicht
eines, meistens sind es drei bis fünf, bei einem echten Ablauf dürfen es sieben
sein. Nicht auf eine feste Zahl auffüllen.

Die Bilder sollen zusammen etwas erzählen und nicht dreimal dasselbe zeigen.
Das Titelbild entscheidet, ob jemand stehenbleibt: Menschen bei der Arbeit
wirken stärker als eine leere Werkstattecke.

Der Text muss zu genau diesen Bildern passen. Wenn auf dem Titelbild jemand
eine Bremsscheibe in der Hand hält, dann geht es im Text um Bremsen – nicht
allgemein um Service.`}`;
}

// ─── Fahrzeuge ───

async function fuerFahrzeug(env, v, bilder, machart) {
  // Kleine Vorschauen statt der grossen Bilder: mobile.de liefert dieselbe
  // Aufnahme in mehreren Groessen aus. Zum Beurteilen reicht die kleine, und
  // ein Worker hat sehr wenig Rechenzeit – 1024er Bilder in Base64 zu wandeln
  // sprengt sie.
  const wege = bilder.slice(0, 4)
    .map(u => String(u).replace(/mo-\d+\.jpg/, 'mo-360.jpg'));

  const inhalt = [];
  for (let i = 0; i < wege.length; i++) {
    try {
      inhalt.push({ type: 'text', text: `Foto ${i + 1}:` });
      inhalt.push({ type: 'image', source: await alsDaten(wege[i]) });
    } catch { inhalt.pop(); }        // eines fehlt, der Rest reicht
  }
  inhalt.push({ type: 'text', text: fahrzeugAuftrag(v, machart, wege.length) });

  const { plan, verbrauch } = await fragen(env.ANTHROPIC_API_KEY, inhalt);
  // Auch hier der gespeicherte Schluss – vorher stand an dieser Stelle eine
  // fest eingetragene Telefonnummer.
  const schluss = env.DB ? await schlussHolen(env.DB) : { nummer: SCHLUSS };

  // Doppelte Nummern herauswerfen: nennt das Modell dieselbe zweimal, stuende
  // dasselbe Foto zweimal im Beitrag. Der Vorratsweg macht das weiter oben
  // genauso.
  const reihe = [...new Set((Array.isArray(plan.bilder) ? plan.bilder : [])
    .map(n => bilder[Number(n) - 1]).filter(Boolean))];

  return {
    beitrag: {
      thema: String(plan.thema || '').slice(0, 80),
      bilder: reihe.length ? reihe : bilder.slice(0, 5),
      text: machart === 'story' ? String(plan.zeile || '').slice(0, 90)
        : saeubern(plan.text) + '\n\n' + schluss.nummer,
      zeile: String(plan.zeile || '').slice(0, 90),
      unterzeile: String(plan.unterzeile || '').slice(0, 90),
      stelle: ['oben', 'mitte', 'unten'].includes(plan.stelle) ? plan.stelle : 'unten',
      sticker: plan.sticker && plan.sticker.art && plan.sticker.art !== 'keiner' ? {
        art: String(plan.sticker.art).slice(0, 20),
        text: String(plan.sticker.text || '').slice(0, 90),
        antworten: (Array.isArray(plan.sticker.antworten) ? plan.sticker.antworten : [])
          .slice(0, 4).map(w => String(w).slice(0, 30))
      } : null,
      szenen: Array.isArray(plan.szenen) ? plan.szenen.slice(0, 8) : null,
      musik: String(plan.musik || '').slice(0, 160),
      hashtags: hashtags(plan.hashtags, plan.thema)
    },
    gelesen: wege.length,
    cent: verbrauch
  };
}

// Das Modell bekommt die Angaben, die im Inserat stehen – und nur die. Was
// nicht dasteht, darf es nicht erfinden: kein TÜV-Datum, keine Scheckheft-
// pflege, keine Unfallfreiheit.
function fahrzeugDaten(v) {
  const zeilen = [
    ['Fahrzeug', [v.make, v.model].filter(Boolean).join(' ') || v.title],
    ['Genaue Bezeichnung', v.title],
    ['Aufbau', v.category],
    ['Erstzulassung', v.firstRegistration],
    ['Laufleistung', v.mileage ? Number(v.mileage).toLocaleString('de-DE') + ' km' : null],
    ['Leistung', v.powerPs ? `${v.powerPs} PS (${v.powerKw} kW)` : null],
    ['Kraftstoff', ({ DIESEL: 'Diesel', PETROL: 'Benzin', ELECTRICITY: 'Elektro',
      HYBRID: 'Hybrid', LPG: 'Autogas', CNG: 'Erdgas' })[v.fuel] || v.fuel],
    // Drei Faelle, nicht zwei: ist das Feld leer, wissen wir es nicht. Der
    // Zweiweg-Test hat jedem Fahrzeug ohne Angabe "Schaltgetriebe" angedichtet,
    // und das Modell schrieb es dann in den Beitrag. Leer faellt unten aus der
    // Liste heraus – wie beim Kraftstoff daneben auch.
    ['Getriebe', /AUTOMATIC/.test(v.gearbox || '') ? 'Automatik'
      : (/MANUAL/.test(v.gearbox || '') ? 'Schaltgetriebe' : '')],
    ['Preis', v.price ? Number(v.price).toLocaleString('de-DE') + ' €' : null],
    ['Ausstattung', (v.features || []).slice(0, 30).join(', ')]
  ];
  return zeilen.filter(([, w]) => w).map(([k, w]) => `${k}: ${w}`).join('\n');
}

function fahrzeugAuftrag(v, machart, anzahl) {
  const kopf = `Du baust Inhalt für den Instagram-Kanal von AIY | Ihsan Yilmaz
aus Würzburg. Es geht um ein Fahrzeug aus einem Kundenbestand. Du
bekommst ${anzahl} nummerierte Fotos davon und die Angaben aus dem Inserat.

ANGABEN:
${fahrzeugDaten(v)}

Nur was oben steht, ist bekannt. Erfinde nichts dazu – keine Unfallfreiheit,
kein TÜV-Datum, keine Vorbesitzer, keine Scheckheftpflege, keine Garantie.
Der Preis darf genannt werden, muss aber nicht.

${TON}`;

  if (machart === 'story') {
    return `${kopf}

Eine Story: ein Bild, eine kurze Zeile, 24 Stunden sichtbar.

Antworte NUR mit JSON:

{
  "thema": "<worum es geht, drei bis fünf Wörter>",
  "bilder": [<eine Nummer – das stärkste Foto>],
  "zeile": "<die große Zeile, höchstens 32 Zeichen. Kurz und laut.>",
  "unterzeile": "<eine kleinere Zeile darunter, höchstens 42 Zeichen – oder leer>",
  "stelle": "<oben | mitte | unten – dorthin, wo das Bild ruhig ist und nichts Wichtiges verdeckt wird>",
  "sticker": {
    "art": "<Umfrage | Frage | Quiz | Schieberegler | Countdown | Standort | Link | keiner>",
    "text": "<was auf dem Sticker steht>",
    "antworten": [<bei Umfrage genau zwei, bei Quiz drei bis vier – sonst leer>]
  },
  "hashtags": [<vier bis sechs Wörter ohne Raute>]
}

Eine Story wird im Vorbeiwischen gelesen: zwei Sekunden, ein Gedanke. Die
große Zeile trägt ihn, die kleine ergänzt. Beide zusammen dürfen nicht mehr
sagen als ein Satz.

Zur Stelle: schau, wo im Bild Platz ist. Steht das Fahrzeug unten im Bild,
gehört der Text nach oben. Ist der Himmel groß, ebenfalls oben. Sind Gesichter
oder Hände in der Mitte, dann nicht mitte.

Zum Sticker: er wird in Instagram gesetzt, nicht von uns ins Bild gerechnet –
du schlägst nur vor, was daraufstehen soll. Er ist der Grund, warum jemand
stehenbleibt statt weiterzuwischen, also nimm einen, der zum Bild passt:

  Umfrage – zwei Antworten, funktioniert bei allem mit zwei Meinungen
  Frage – offene Box, gut wenn es etwas zu erzählen gibt
  Quiz – eine richtige Antwort, gut bei Technik und Zahlen
  Schieberegler – ein Emoji zum Ziehen, gut bei allem Schönen
  Countdown – nur wenn es einen echten Termin gibt
  Standort – bei Aufnahmen vom Hof oder aus der Halle
  Link – nur wenn es eine Seite dazu gibt

Wechsle ab. Nicht bei jeder Story eine Umfrage, und nie zweimal dieselbe
Frage. Passt keiner, dann "keiner" – ein aufgesetzter Sticker ist schlechter
als keiner.`;
  }

  if (machart === 'reel') {
    return `${kopf}

Ein Reel: ein Drehplan aus Standbildern, 12 bis 18 Sekunden, senkrecht.

Antworte NUR mit JSON:

{
  "thema": "<drei bis fünf Wörter>",
  "bilder": [<Nummern in der Reihenfolge der Szenen, 4 bis 6 Stück>],
  "szenen": [{ "zeit": "0–3 s", "was": "<was zu sehen ist und welcher Text eingeblendet wird>" }],
  "musik": "<welche Art Musik dazu passt: Stimmung, Tempo, mit oder ohne Gesang – KEIN Titel, keine Band>",
  "text": "<die Bildunterschrift unter dem Reel, wie ein Beitragstext, endet mit der Aufforderung anzurufen und einem Doppelpunkt>",
  "hashtags": [<vier bis sieben Wörter ohne Raute>]
}

Zur Musik: in Instagram wird der Ton aus dem hauseigenen Katalog gewählt.
Beschreibe deshalb die Art, nicht einen Titel – zu einem ruhigen Familien-SUV
passt etwas anderes als zu einem Diesel mit 184 PS.

Die erste Sekunde entscheidet: das auffälligste Bild zuerst, nicht die
Rückansicht.`;
  }

  return `${kopf}

Ein Beitrag im Feed: mehrere Bilder und ein Text.

Antworte NUR mit JSON:

{
  "thema": "<drei bis fünf Wörter>",
  "bilder": [<Nummern in der Reihenfolge; das erste ist das Titelbild>],
  "text": "<der Text, ohne Hashtags, ohne Telefonnummer, endet mit der Aufforderung anzurufen und einem Doppelpunkt>",
  "hashtags": [<vier bis sieben Wörter ohne Raute, thematisch, klein geschrieben>]
}

Der Text muss zu diesem Auto passen und zu dem, was auf den Fotos zu sehen
ist. Ein Kombi mit 160.000 km und Automatik verdient einen anderen Text als
ein junger Kleinwagen. Greif eine Sache heraus, statt alle Daten aufzuzählen –
die stehen im Inserat.

Reihenfolge wie ein Rundgang: außen, Detail, innen, Kofferraum.`;
}

// Bilder holen und als Daten mitschicken: Anthropic kann unsere und
// mobile.de-Adressen nicht selbst abrufen.
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

async function fragen(schluessel, inhalt) {
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
      messages: [{ role: 'user', content: inhalt }]
    })
  });

  const roh = await a.text();
  let d = null;
  try { d = JSON.parse(roh); } catch { /* siehe unten */ }
  if (!d) throw new Error(`Antwort war kein JSON (Status ${a.status}): ${roh.slice(0, 120)}`);
  if (!a.ok) throw new Error((d.error && d.error.message) || `Modell antwortete mit ${a.status}.`);

  // Was der Klick gekostet hat. Die Preise stehen hier fest, weil die API sie
  // nicht mitschickt – wenn sie sich aendern, aendert sich die Zahl hier.
  const u = d.usage || {};
  const verbrauch = Math.round(
    (((u.input_tokens || 0) * 3 + (u.output_tokens || 0) * 15) / 1e6) * 100 * 10) / 10;

  const text = (d.content || []).filter(t => t.type === 'text').map(t => t.text).join('');
  const anfang = text.indexOf('{');
  const ende = text.lastIndexOf('}');
  if (anfang < 0 || ende < anfang) {
    // Beim naechsten Mal soll dastehen, WORAN es lag – "kein Vorschlag" allein
    // sagt einem nichts.
    throw new Error(d.stop_reason === 'max_tokens'
      ? 'Die Antwort war zu lang und wurde abgeschnitten.'
      : `Kein Vorschlag im Text (Grund: ${d.stop_reason || 'unbekannt'}): `
        + text.slice(0, 140).replace(/\s+/g, ' '));
  }
  try { return { plan: JSON.parse(text.slice(anfang, ende + 1)), verbrauch }; }
  catch { throw new Error('Der Vorschlag war nicht lesbar.'); }
}

// ─── Kleinkram ───

// Falls doch Rauten oder eine Nummer im Text landen: raus damit, beides
// haengen wir selbst an.
function saeubern(t) {
  return String(t || '')
    .replace(/#\S+/g, '')
    .replace(/0?9\d{3}\s*\/?\s*\d{4,}/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Die Ortsmarken stehen unter jedem Beitrag gleich – ohne einen Teil, der
// zum Thema gehoert, sind alle Beitraege unter denselben Schlagwoertern
// unterwegs und keiner findet den einen, um den es geht. Deshalb wandert das
// Thema fest mit hinein, direkt hinter den Ort und vor dem, was das Modell
// vorgeschlagen hat.
function themaWort(titel) {
  return String(titel || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 28);
}

function hashtags(roh, thema) {
  const saeubern = w => String(w).toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
  const eigene = (Array.isArray(roh) ? roh : String(roh || '').split(/[\s,#]+/))
    .map(saeubern)
    .filter(w => w.length > 2);

  // Aus "Bei Google gefunden" wird "beigooglegefunden" – ein Wort, das nur
  // zu diesem Thema gehoert. Dazu die einzelnen Woerter daraus, denn danach
  // sucht eher jemand.
  const ausThema = [];
  if (thema) {
    const ganz = themaWort(thema);
    if (ganz.length > 2) ausThema.push(ganz);
    String(thema).toLowerCase().split(/[^a-zäöüß0-9]+/)
      .map(saeubern)
      .filter(w => w.length > 3 && !['fuer','fur','eine','einen','sich','beim','nach','aus','das','der','die','und','mit'].includes(w))
      .forEach(w => ausThema.push(w));
  }

  return [...ORT, ...ausThema, ...eigene]
    .filter(w => w && w.length > 2)
    .filter((w, i, a) => a.indexOf(w) === i)
    .slice(0, 14)
    .map(w => '#' + w).join(' ');
}

const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
