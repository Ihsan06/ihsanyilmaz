// Baut aus einem Fahrzeug den fertigen Beitragstext.
//
// Bewusst ohne Sprachmodell: bei einem Datenblatt gibt es nichts zu
// erfinden, und eine Vorlage ist umsonst, sofort da und immer gleich
// verlaesslich. Wird der Ton mit der Zeit zu gleichfoermig, kann ein Modell
// spaeter an derselben Stelle einsteigen – gebraucht wird von aussen nur
// beitragText.bauen(fahrzeug, variante).
//
// Festgelegt mit Flo (siehe Artefakt "Instagram, ohne dass es Zeit frisst"):
//   * gesiezt, wie auf der Website
//   * KEIN Preis im Beitrag – der steht auf der Fahrzeugseite
//   * Telefonnummer ausgeschrieben: Instagram macht Links im Beitragstext
//     nicht klickbar, eine Nummer laesst sich am Telefon aber antippen
//
// Ein Fahrzeugbeitrag besteht aus drei Teilen, die unabhaengig voneinander
// wechseln: Einstieg, Koerper und Schluss. Weil sie unterschiedlich schnell
// durchlaufen, klingt auch die zweite Runde nicht wie die erste – erst nach
// dem kleinsten gemeinsamen Vielfachen wiederholt sich eine Kombination.
window.beitragText = (function () {

  const FUEL = {
    PETROL: 'Benzin', DIESEL: 'Diesel', HYBRID: 'Hybrid', ELECTRICITY: 'Elektro',
    HYBRID_PETROL: 'Hybrid', HYBRID_DIESEL: 'Hybrid', LPG: 'Autogas', CNG: 'Erdgas'
  };
  const GEAR = {
    MANUAL_GEAR: 'Schaltgetriebe', AUTOMATIC_GEAR: 'Automatik',
    SEMIAUTOMATIC_GEAR: 'Halbautomatik'
  };

  const TELEFON = 'kontakt@ihsan-yilmaz.de';
  // Der gemeinsame Schluss, ueberall gleich – Einladung, Nummer, Seite. Die
  // Hashtags kommen in der Anzeige dahinter. Weil er fest ist, laesst er sich
  // einmal aendern und gilt dann fuer alle Beitraege.
  // Wortlaut und Zeichen wie im gespeicherten Schluss (studio_einstellungen,
  // Schluessel "fuss"). Der hier greift nur, wenn keiner gespeichert ist –
  // dann soll er trotzdem gleich aussehen und nicht wie ein zweiter Absender.
  const EINLADUNG = 'Anfragen per Mail:';
  const FUSS = [EINLADUNG, '\u{1F4E7}  ' + TELEFON, '\u{1F449}  Mehr auf ihsan-yilmaz.de'].join('\n');

  // Was niemanden hinter dem Ofen hervorholt. ABS und Servolenkung hat seit
  // dreissig Jahren jedes Auto – in einem Beitrag klingt das nach Fuellmaterial
  // und drueckt die wirklich interessanten Punkte nach hinten.
  const SELBSTVERSTAENDLICH = new Set([
    'ABS', 'ESP', 'Servolenkung', 'Wegfahrsperre', 'Zentralverriegelung',
    'Elektr. Fensterheber', 'Elektr. Außenspiegel', 'Airbag', 'Beifahrerairbag',
    'Seitenairbag', 'Traktionskontrolle', 'Bordcomputer', 'Isofix',
    'Reifendruckkontrolle', 'Armlehne', 'Nichtraucherfahrzeug'
  ]);

  // Reihenfolge = Rangfolge. Was hier oben steht, kommt zuerst in den Text.
  const AUFFAELLIG = [
    'Anhängerkupplung', 'Standheizung', 'Navigationssystem', 'Panorama-Dach',
    'Schiebedach', 'Rückfahrkamera', 'Einparkhilfe', 'Sitzheizung',
    'Klimaautomatik', 'Klimaanlage', 'Tempomat', 'Abstandswarner',
    'LED-Scheinwerfer', 'Xenonscheinwerfer', 'Leichtmetallfelgen',
    'Multifunktionslenkrad', 'Lederausstattung', 'Sportsitze', 'Soundsystem',
    'Freisprecheinrichtung', 'Bluetooth', 'Winterpaket', 'Scheckheftgepflegt'
  ];

  // ─── Einstiege ───────────────────────────────────────────────────────
  //
  // Der erste Satz ist das, was Instagram in der Vorschau zeigt – dort
  // gehoert der Nutzen hin, nicht das Datenblatt. Jede Zeile prueft selbst,
  // ob sie zum Fahrzeug passt; was nicht passt, faellt raus. Deshalb stehen
  // bei einem Kombi im Oktober andere Einstiege zur Wahl als bei einem
  // Cabrio im Mai.
  const EINSTIEG = [
    // Leistung
    v => v.powerPs >= 250 ? `${v.powerPs} PS. Viel mehr muss man dazu nicht sagen.` : null,
    v => v.powerPs >= 200 ? `${v.powerPs} PS – für alle, die die Auffahrt zur Autobahn mögen.` : null,
    v => v.powerPs >= 150 && v.kategorie === 'Kleinwagen'
      ? `${v.powerPs} PS, und er passt trotzdem auf jeden Parkplatz.` : null,
    v => v.powerPs >= 150 ? `${v.powerPs} PS unter der Haube.` : null,
    v => v.powerPs && v.powerPs <= 75 ? 'Klein, sparsam, ehrlich.' : null,

    // Fahrzeugart
    v => v.kategorie === 'Kombi' ? 'Platz für alles, was mitmuss.' : null,
    v => v.kategorie === 'Kombi' ? 'Urlaub, Baumarkt, Hundebox – passt.' : null,
    v => v.kategorie === 'Kombi' ? 'Der Kofferraum, über den man nicht diskutieren muss.' : null,
    v => /SUV|Geländewagen/.test(v.kategorie) ? 'Höher sitzen, mehr sehen.' : null,
    v => /SUV|Geländewagen/.test(v.kategorie) ? 'Für alle, die im Winter nicht schieben wollen.' : null,
    v => v.kategorie === 'Kleinwagen' ? 'Parkplatzsuche war gestern.' : null,
    v => v.kategorie === 'Kleinwagen' ? 'Klein von außen, überraschend groß von innen.' : null,
    v => v.kategorie === 'Limousine' ? 'Wenn der Weg zur Arbeit der ruhigste Teil des Tages sein soll.' : null,
    v => /Van|Kleinbus/.test(v.kategorie) ? 'Wenn der Kofferraum das Wichtigste ist.' : null,
    v => /Van|Kleinbus/.test(v.kategorie) ? 'Ein Auto, viele Sitze, keine Diskussionen.' : null,
    v => /Cabrio|Roadster/.test(v.kategorie) ? 'Das Dach kann weg.' : null,
    v => /Coupé|Sportwagen/.test(v.kategorie) ? 'Zwei Türen, kein Bedauern.' : null,
    v => /Transporter|Nutzfahrzeug/.test(v.kategorie) ? 'Der arbeitet, statt zu posieren.' : null,

    // Antrieb
    v => v.gearbox === 'AUTOMATIC_GEAR' ? 'Automatik – für alle, die im Berufsverkehr genug zu tun haben.' : null,
    v => v.gearbox === 'AUTOMATIC_GEAR' ? 'Automatik. Das linke Bein hat frei.' : null,
    v => v.kraftstoff === 'Elektro' ? 'Leise, günstig im Unterhalt, sofort da.' : null,
    v => v.kraftstoff === 'Hybrid' ? 'Strom in der Stadt, Benzin auf der Langstrecke.' : null,
    v => v.kraftstoff === 'Diesel' && v.mileage > 120000 ? 'Ein Diesel, der noch lange nicht müde ist.' : null,
    v => v.kraftstoff === 'Diesel' ? 'Der Selbstzünder für die Langstrecke.' : null,

    // Zustand
    v => v.jahre !== null && v.jahre <= 3 ? 'Jung, gepflegt und ab sofort bei uns auf dem Hof.' : null,
    v => v.mileage !== null && v.mileage < 40000 ? 'Kaum eingefahren.' : null,
    v => v.mileage !== null && v.mileage < 60000 ? 'Wenig gelaufen, viel übrig.' : null,
    v => v.hat('Scheckheftgepflegt') ? 'Scheckheft lückenlos – das sieht man nicht mehr oft.' : null,

    // Ausstattung, die eine Geschichte erzaehlt
    v => v.hat('Anhängerkupplung') ? 'Mit Anhängerkupplung – für alles, was hinten dranhängt.' : null,
    v => v.hat('Standheizung') ? 'Standheizung. Im Januar werden Sie daran denken.' : null,
    v => v.hat('Panorama-Dach') || v.hat('Schiebedach') ? 'Mit Panoramadach – selbst der Stau sieht besser aus.' : null,
    v => v.hat('Sitzheizung') && v.winter ? 'Sitzheizung. Ab Oktober das beste Argument.' : null,
    v => v.hat('Rückfahrkamera') ? 'Rückfahrkamera – Einparken ohne Diskussion.' : null,

    // Leistung, zweite Reihe
    v => v.powerPs >= 300 ? `${v.powerPs} PS. Wir sagen dazu nichts mehr, fahren Sie ihn.` : null,
    v => v.powerPs >= 180 && /Kombi/.test(v.kategorie)
      ? `${v.powerPs} PS und ein Kofferraum, in den der halbe Hausstand passt.` : null,
    v => v.powerPs >= 120 && v.powerPs < 150 ? `${v.powerPs} PS – genug für alles, was man wirklich fährt.` : null,
    v => v.powerPs && v.powerPs <= 90 ? 'Wenig Verbrauch, wenig Aufregung, wenig Werkstattbesuche.' : null,
    v => v.powerPs && v.powerPs <= 100 ? 'Das Auto für Leute, die nichts beweisen müssen.' : null,

    // Fahrzeugart, zweite Reihe
    v => v.kategorie === 'Kombi' ? 'Fahrrad, Hund, Kinderwagen – alles gleichzeitig.' : null,
    v => v.kategorie === 'Kombi' ? 'Der Klassiker für alle, die am Wochenende was vorhaben.' : null,
    v => /SUV|Geländewagen/.test(v.kategorie) ? 'Einsteigen statt hineinfallen.' : null,
    v => /SUV|Geländewagen/.test(v.kategorie) ? 'Der Blick über den Verkehr ist Gewohnheitssache – im guten Sinn.' : null,
    v => v.kategorie === 'Kleinwagen' ? 'In Coburg in jede Lücke, auf der Autobahn trotzdem entspannt.' : null,
    v => v.kategorie === 'Kleinwagen' ? 'Der Erste für die Tochter oder der Zweite für den Haushalt.' : null,
    v => v.kategorie === 'Limousine' ? 'Vorne einsteigen, hinten Platz haben, dazwischen Ruhe.' : null,
    v => v.kategorie === 'Limousine' ? 'Langstrecke ohne Rückenschmerzen.' : null,
    v => /Van|Kleinbus/.test(v.kategorie) ? 'Wenn alle mitfahren wollen und keiner hinten sitzen muss.' : null,
    v => /Cabrio|Roadster/.test(v.kategorie) && v.sommer ? 'Der Sommer wird kurz. Das Dach nicht.' : null,
    v => /Cabrio|Roadster/.test(v.kategorie) ? 'Vier Monate im Jahr das beste Auto der Welt.' : null,
    v => /Coupé|Sportwagen/.test(v.kategorie) ? 'Nicht vernünftig. Aber richtig.' : null,
    v => /Transporter|Nutzfahrzeug/.test(v.kategorie) ? 'Werkzeug rein, losfahren, Feierabend.' : null,
    v => /Transporter|Nutzfahrzeug/.test(v.kategorie) ? 'Der verdient sein Geld selbst.' : null,

    // Antrieb, zweite Reihe
    v => v.gearbox === 'AUTOMATIC_GEAR' && /Stadt|Kleinwagen/.test(v.kategorie)
      ? 'Automatik in der Stadt – man will nichts anderes mehr.' : null,
    v => v.gearbox === 'AUTOMATIC_GEAR' ? 'Einmal Automatik gefahren, und die Kupplung fehlt keinem.' : null,
    v => v.gearbox === 'MANUAL_GEAR' && v.powerPs >= 150 ? 'Handgeschaltet. Wer das mag, weiß warum.' : null,
    v => v.kraftstoff === 'Elektro' ? 'Zuhause laden, morgens voll losfahren.' : null,
    v => v.kraftstoff === 'Elektro' ? 'Kein Öl, kein Auspuff, kein Warmlaufen.' : null,
    v => v.kraftstoff === 'Hybrid' ? 'Kurzstrecke leise, Langstrecke ohne Suchen nach der Säule.' : null,
    v => v.kraftstoff === 'Diesel' && v.mileage > 180000 ? 'Der hat schon was gesehen – und hat noch was vor.' : null,
    v => v.kraftstoff === 'Benzin' && v.mileage !== null && v.mileage < 80000
      ? 'Benziner mit überschaubarer Laufleistung – die Kombination sucht man länger.' : null,
    v => v.kraftstoff === 'Autogas' || v.kraftstoff === 'Erdgas'
      ? 'Sparsam an der Zapfsäule, unauffällig im Alltag.' : null,

    // Zustand, zweite Reihe
    v => v.jahre !== null && v.jahre <= 2 ? 'Fast neu, aber ohne den Aufschlag von nebenan.' : null,
    v => v.jahre !== null && v.jahre >= 10 && v.mileage !== null && v.mileage < 120000
      ? 'Älteres Baujahr, erstaunlich wenig Kilometer – so etwas stand lange in einer Garage.' : null,
    v => v.mileage !== null && v.mileage < 20000 ? 'Praktisch ungefahren.' : null,
    v => v.mileage !== null && v.mileage < 100000 ? 'Unter 100.000 – und ordentlich behandelt.' : null,
    v => v.hat('Scheckheftgepflegt') ? 'Jeder Service dokumentiert. Wir haben nachgesehen.' : null,
    v => v.hat('Garantie') ? 'Mit Garantie – damit der Bauch ruhig bleibt.' : null,

    // Ausstattung, zweite Reihe
    v => v.hat('Anhängerkupplung') ? 'Anhängerkupplung dran. Der Nachbar wird sich melden.' : null,
    v => v.hat('Standheizung') && v.winter ? 'Standheizung. Sie kratzen, wir winken.' : null,
    v => v.hat('Navigationssystem') ? 'Navi an Bord – Handy bleibt in der Tasche.' : null,
    v => v.hat('Sitzheizung') ? 'Sitzheizung: die Ausstattung, die man am häufigsten benutzt.' : null,
    v => v.hat('Einparkhilfe') ? 'Piept, bevor es teuer wird.' : null,
    v => v.hat('Klimaautomatik') && v.sommer ? 'Klimaautomatik. Im Juli das wichtigste Bedienteil.' : null,
    v => v.hat('LED-Scheinwerfer') ? 'LED-Licht – auf der Landstraße merkt man den Unterschied sofort.' : null,
    v => v.hat('Lederausstattung') ? 'Leder, gepflegt, ohne Risse.' : null,
    v => v.hat('Tempomat') ? 'Tempomat dran – die A73 wird deutlich entspannter.' : null,
    v => v.hat('Winterpaket') && v.winter ? 'Winterpaket komplett. Kommen Sie, bevor es schneit.' : null,

    // Jahreszeit
    v => v.winter ? 'Vor dem Winter noch einmal umsteigen? Der hier bietet sich an.' : null,
    v => v.sommer ? 'Passend zur Urlaubszeit auf den Hof gerollt.' : null,

    // Immer moeglich
    v => 'Neu auf unserem Hof.',
    v => 'Frisch hereingekommen.',
    v => 'Der hier ist neu bei uns.',
    v => 'Seit heute bei uns auf dem Hof.',
    v => 'Gerade angekommen.',
    v => 'Heute Morgen hat er seinen Platz bei uns bekommen.',
    v => 'Kurz geputzt, durchgesehen, hingestellt: bitte schön.',
    v => 'Der Neue in Weidhausen.',
    v => 'Reingekommen, geprüft, freigegeben.',
    v => 'Direkt in die erste Reihe gestellt.',
    v => 'Vom Hof, nicht aus dem Prospekt.',
    v => 'Angeschaut, für gut befunden, aufgenommen.',
    v => 'Der steht ab heute bei uns – und wahrscheinlich nicht lange.'
  ];

  // ─── Koerper ─────────────────────────────────────────────────────────
  //
  // Der Mittelteil traegt die Daten. Er wechselt langsamer als der Einstieg,
  // weil er ohnehin nuechtern ist – zu viel Abwechslung wirkt hier gewollt.
  const KOERPER = [
    (n, e) => `Der ${n} steht ab sofort bei uns auf dem Hof – ${e}.`,
    (n, e) => `${n}, ${e}.`,
    (n, e) => `Zu den Daten: ${e}. So steht der ${n} bei uns.`,
    (n, e) => `Der ${n} – ${e}.`,
    (n, e) => `Was drinsteckt: ${e}. Der ${n} wartet bei uns.`,
    (n, e) => `Auf einen Blick: ${n}, ${e}.`,
    (n, e) => `Die Eckdaten zum ${n}: ${e}.`,
    (n, e) => `${n}. In Zahlen: ${e}.`,
    (n, e) => `Der ${n} bringt mit: ${e}.`,
    (n, e) => `Kurz und ohne Umschweife: ${n}, ${e}.`,
    (n, e) => `Beim ${n} sieht das so aus: ${e}.`
  ];

  const AUSSTATTUNG_SATZ = [
    l => `${l} sind an Bord.`,
    l => `Dazu: ${l}.`,
    l => `An Ausstattung unter anderem ${l}.`,
    l => `Mit ${l}.`,
    l => `Serienmäßig mit dabei: ${l}.`,
    l => `Und drin ist außerdem ${l}.`,
    l => `Ausstattung, die man merkt: ${l}.`,
    l => `Er hat ${l}.`,
    l => `Nicht selbstverständlich, hier aber dabei: ${l}.`
  ];

  // ─── Schluesse ───────────────────────────────────────────────────────
  // Saetze mit der Adresse fallen heraus: sie steht jetzt im gemeinsamen
  // Schluss, und zweimal in einem Beitrag liest sich wie ein Versehen. Die
  // Liste bleibt lang genug – gefiltert wird beim Bauen, damit die Saetze
  // erhalten bleiben, falls der Schluss einmal anders aussieht.
  const SCHLUSS = [
    'Alle Fotos und Daten finden Sie auf unserer Seite – oder rufen Sie uns einfach an, dann halten wir ihn für eine Probefahrt bereit.',
    'Sämtliche Fotos und Eckdaten stehen auf unserer Seite. Für eine Probefahrt genügt ein Anruf.',
    'Mehr Fotos und alle Daten auf unserer Seite. Probefahrt gefällig? Melden Sie sich einfach.',
    'Kommen Sie vorbei und schauen Sie ihn sich an – oder rufen Sie kurz vorher an, dann steht er bereit.',
    'Probefahrt? Ein Anruf genügt, um den Rest kümmern wir uns.',
    'Alles Weitere steht auf unserer Seite. Fragen beantworten wir am liebsten persönlich.',
    'Ansehen lohnt sich: unsere Seite. Wenn Sie ihn fahren möchten, sagen Sie kurz Bescheid.',
    'Wir halten ihn gern für Sie bereit – ein Anruf reicht.',
    'Bei Fragen rufen Sie an. Bei uns geht noch jemand ans Telefon.',
    'Fotos, Ausstattung und alle Daten auf unserer Seite – oder Sie schauen einfach vorbei.',
    'Schreiben Sie uns hier eine Nachricht oder rufen Sie an – beides landet bei uns.',
    'Sie finden ihn samt aller Fotos auf unserer Seite. Und wenn Sie lieber reden: Wir sind da.',
    'Vorbeikommen kostet nichts. Kaffee gibt es dazu.',
    'Wer ihn zuerst fährt, hat die besten Karten. Melden Sie sich einfach.',
    'Ihr Wagen soll in Zahlung? Sagen Sie Bescheid, wir schauen ihn uns an.',
    'Alle Daten stehen online. Alles andere klären wir am besten persönlich.',
    'Fragen zur Finanzierung? Auch die beantworten wir hier vor Ort.',
    'Rufen Sie durch, dann steht er beim nächsten Besuch schon startklar.',
    'Wir sind Montag bis Freitag da – und am Samstagvormittag auch.',
    'Kurz anrufen, kurz vorbeikommen, in Ruhe anschauen. So einfach ist das bei uns.'
  ];
  const OHNE_ADRESSE = SCHLUSS.filter(t => !/ihsan-yilmaz\.de/i.test(t));


  // ─── Hashtags ────────────────────────────────────────────────────────
  //
  // Die Haelfte regional, die andere zum Fahrzeug. Reine Themen-Tags bringen
  // bei einem Haendler wenig – gefunden werden will er von Leuten, die auch
  // herkommen koennen. #aiyweb steht unter fast jedem Beitrag, den Flo
  // selbst gemacht hat: sein Hauszeichen, deshalb an erster Stelle.
  const ORT = ['aiyweb', 'wuerzburg', 'würzburg', 'unterfranken', 'mainfranken'];
  const ALLGEMEIN = ['gebrauchtwagen', 'autohaus', 'freiewerkstatt', 'probefahrt', 'autokaufen'];
  const NACH_ART = {
    'Kombi': ['kombi', 'familienauto'],
    'SUV': ['suv'],
    'Geländewagen/Pickup': ['suv', 'gelaendewagen'],
    'Kleinwagen': ['kleinwagen', 'stadtauto'],
    'Limousine': ['limousine'],
    'Van / Kleinbus': ['van', 'transporter'],
    'Cabrio/Roadster': ['cabrio', 'sommerauto'],
    'Sportwagen/Coupé': ['coupe', 'sportwagen'],
    'Transporter': ['transporter', 'nutzfahrzeug']
  };

  // ─── Aufbereitung ────────────────────────────────────────────────────

  function aufbereiten(v) {
    const jahr = jahrAus(v.firstRegistration);
    const da = new Set(v.features || []);
    const monat = new Date().getMonth();
    return {
      ...v,
      kategorie: v.category || '',
      jahre: jahr === null ? null : Math.max(0, new Date().getFullYear() - jahr),
      kraftstoff: FUEL[v.fuel] || v.fuel || '',
      getriebeWort: GEAR[v.gearbox] || '',
      hat: m => da.has(m),
      winter: monat >= 8 || monat <= 1,
      sommer: monat >= 3 && monat <= 7,
      name: name(v)
    };
  }

  function jahrAus(ez) {
    const m = String(ez || '').match(/(\d{4})/);
    return m ? Number(m[1]) : null;
  }

  function name(v) {
    const marke = huebsch(v.make || '');
    let rest = String(v.title || '').trim();
    // Der Titel faengt bei mobile.de mit der Marke an und wiederholt oft das
    // Modell direkt danach: "ABARTH 500 F595 1.4 …".
    if (rest.toUpperCase().startsWith(String(v.make || '').toUpperCase())) {
      rest = rest.slice(String(v.make || '').length).trim();
    }
    const modell = String(v.model || '').trim();
    if (modell && rest.toUpperCase().startsWith(modell.toUpperCase())) {
      const ohne = rest.slice(modell.length).trim();
      if (ohne.toUpperCase().startsWith(modell.toUpperCase())) rest = ohne;
    }
    // Nur die ersten Worte: der Rest des mobile.de-Titels ist eine
    // Stichwortliste fuer die Suche, kein Name.
    const kurz = rest.split(/\s+/).slice(0, 4).join(' ');
    return `${marke} ${kurz}`.replace(/\s+/g, ' ').trim();
  }

  // ABARTH -> Abarth, VW und BMW bleiben, wie sie sind.
  function huebsch(marke) {
    if (marke.length <= 3) return marke;
    return marke.charAt(0) + marke.slice(1).toLowerCase();
  }

  function merkmale(v, wieviele) {
    const da = new Set(v.features || []);
    const raus = [];
    for (const m of AUFFAELLIG) if (da.has(m)) raus.push(m);
    // Was nicht in der Rangfolge steht, aber auch nicht selbstverstaendlich
    // ist, kommt hinten dran – sonst faellt Ausgefallenes unter den Tisch.
    for (const m of (v.features || [])) {
      if (!SELBSTVERSTAENDLICH.has(m) && !raus.includes(m)) raus.push(m);
    }
    return raus.slice(0, wieviele || 5);
  }

  function aufzaehlen(liste) {
    if (liste.length <= 1) return liste[0] || '';
    return liste.slice(0, -1).join(', ') + ' und ' + liste[liste.length - 1];
  }

  // Sicher auch bei negativen Zahlen – der Zurueck-Knopf zaehlt rueckwaerts,
  // und in JavaScript ist -1 % 5 gleich -1, nicht 4.
  const platz = (n, laenge) => ((n % laenge) + laenge) % laenge;
  const ggt = (a, b) => (b ? ggt(b, a % b) : a);
  const kgv = (a, b) => (a * b) / ggt(a, b);

  // ─── Fahrzeugbeitrag ─────────────────────────────────────────────────

  function bauen(fahrzeug, variante) {
    const v = aufbereiten(fahrzeug);
    const n = Number.isFinite(variante) ? variante : 0;

    const moeglich = EINSTIEG.map(f => f(v)).filter(Boolean);
    const einstieg = moeglich[platz(n, moeglich.length)];

    const eckdaten = [
      v.firstRegistration ? `Erstzulassung ${v.firstRegistration}` : null,
      v.mileage != null ? `${v.mileage.toLocaleString('de-DE')} km` : null,
      v.getriebeWort || null,
      v.kraftstoff || null
    ].filter(Boolean).join(', ');

    const koerper = KOERPER[platz(n, KOERPER.length)](v.name, eckdaten);

    const punkte = merkmale(v, 5);
    const aus = punkte.length
      ? AUSSTATTUNG_SATZ[platz(n, AUSSTATTUNG_SATZ.length)](aufzaehlen(punkte))
      : '';

    const schluss = OHNE_ADRESSE[platz(n, OHNE_ADRESSE.length)];

    return {
      text: [einstieg, '', [koerper, aus].filter(Boolean).join(' '), '', schluss, '', FUSS]
        .join('\n').replace(/\n{3,}/g, '\n\n'),
      hashtags: hashtags(v),
      // Erst nach so vielen Schritten wiederholt sich eine Kombination.
      varianten: [moeglich.length, KOERPER.length, AUSSTATTUNG_SATZ.length, OHNE_ADRESSE.length].reduce(kgv)
    };
  }

  function hashtags(v) {
    const marke = String(v.make || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const art = NACH_ART[v.kategorie] || [];
    const alle = [...ORT.slice(0, 4), marke, ...art, ...ALLGEMEIN]
      .filter(Boolean)
      .filter((w, i, a) => a.indexOf(w) === i);
    // Vierzehn: genug, um gefunden zu werden, wenig genug, dass es nicht nach
    // Verzweiflung aussieht. Instagram erlaubt dreissig.
    return alle.slice(0, 14).map(w => '#' + w).join(' ');
  }

  // ─── Reels ───────────────────────────────────────────────────────────
  //
  // Ein Reel kann kein Baukasten bauen – filmen muss jemand selbst. Was ihm
  // aber abgenommen werden kann, ist die eigentliche Huerde: zu wissen, WAS
  // man filmt. Deshalb hier ein Drehplan in Sekunden statt eines Videos.
  //
  // Zum Ton: bei Unternehmenskonten ist die Musikauswahl kleiner, aktuelle
  // Titel fehlen meist. Fuer ein Autohaus ist das kein Verlust – Motorstart
  // und Auspuff sind das Produkt und haben kein Lizenzproblem. Nur bei
  // Elektroautos gibt es nichts zu hoeren, dort also Musik aus der Bibliothek.

  const HAKEN = [
    v => v.powerPs >= 200 ? `${v.powerPs} PS. Ton an.` : null,
    v => v.powerPs >= 150 ? `${v.powerPs} PS. Kopfhörer auf.` : null,
    v => v.kraftstoff === 'Elektro' ? 'Kein Motorgeräusch. Kein Tankstopp.' : null,
    v => v.mileage != null && v.mileage < 60000 ? `Nur ${Math.round(v.mileage / 1000)}.000 km.` : null,
    v => v.kategorie === 'Kombi' ? 'Wie viel da reinpasst? Schauen Sie selbst.' : null,
    v => /SUV|Geländewagen/.test(v.kategorie) ? 'Einmal von oben herab.' : null,
    v => v.gearbox === 'AUTOMATIC_GEAR' ? 'Einsteigen, D einlegen, fertig.' : null,
    v => v.hat('Anhängerkupplung') ? 'Was hinten dranhängt, kommt auch mit.' : null,
    v => v.powerPs >= 300 ? `${v.powerPs} PS. Lautstärke aufdrehen.` : null,
    v => v.kraftstoff === 'Diesel' && v.mileage > 150000 ? 'Der läuft und läuft. Immer noch.' : null,
    v => v.kraftstoff === 'Hybrid' ? 'Erst leise, dann laut.' : null,
    v => v.jahre !== null && v.jahre <= 3 ? 'So jung sieht man die selten.' : null,
    v => v.mileage != null && v.mileage < 30000 ? 'Der Kilometerstand ist kein Tippfehler.' : null,
    v => /Cabrio|Roadster/.test(v.kategorie) ? 'Dach auf in acht Sekunden.' : null,
    v => /Coupé|Sportwagen/.test(v.kategorie) ? 'Zwei Türen. Mehr braucht es nicht.' : null,
    v => v.kategorie === 'Kleinwagen' ? 'Klein. Und dann von innen.' : null,
    v => /Van|Kleinbus/.test(v.kategorie) ? 'Wie viele passen rein? Zählen Sie mit.' : null,
    v => v.hat('Panorama-Dach') || v.hat('Schiebedach') ? 'Dach auf, Blick nach oben.' : null,
    v => v.hat('Standheizung') ? 'Der Knopf, der im Januar Gold wert ist.' : null,
    v => v.hat('Lederausstattung') ? 'Türe auf – und dann der Innenraum.' : null,
    v => 'Kaltstart. Ton an.',
    v => 'Neu auf dem Hof.',
    v => 'Einmal rundherum.',
    v => `${v.name} – von innen und außen.`,
    v => 'In fünfzehn Sekunden durch.',
    v => 'Bleiben Sie bis zum Cockpit.',
    v => 'Der Rundgang, den Sie sonst hier vor Ort machen.',
    v => 'Fünfzehn Sekunden, alles Wichtige.',
    v => 'Ehrlich gefilmt, nichts geschönt.',
    v => 'Das Beste kommt am Schluss.',
    v => 'Kein Prospektfoto. Unser Hof, heute.'
  ];

  function reel(fahrzeug, variante) {
    const v = aufbereiten(fahrzeug);
    const n = Number.isFinite(variante) ? variante : 0;
    const elektro = v.kraftstoff === 'Elektro';
    const nutzfahrzeug = /Transporter|Van/.test(v.kategorie);

    const moeglich = HAKEN.map(f => f(v)).filter(Boolean);
    const haken = moeglich[platz(n, moeglich.length)];

    // Der Plan waechst mit dem Fahrzeug: was es hat, wird gezeigt.
    const plan = [
      { zeit: '0–2 s', was: 'Front schräg von vorn, langsam näher gehen. Dieses Bild wird auch das Titelbild.' },
      elektro
        ? { zeit: '2–5 s', was: 'Ladeklappe öffnen, Stecker ansetzen. Ruhig bleiben, das ist der Reiz.' }
        : { zeit: '2–5 s', was: 'Kaltstart. Handy nah ans Heck, Auspuff im Bild – Originalton, nicht wegdrücken.' },
      { zeit: '5–8 s', was: 'Einmal an der Seite entlang: Felge, Türgriff, Heck.' },
      { zeit: '8–11 s', was: `Einsteigen, Cockpit${v.hat('Navigationssystem') ? ', Navi anschalten' : ''}${v.hat('Sitzheizung') ? ', Sitzheizung drücken' : ''}.` },
      nutzfahrzeug
        ? { zeit: '11–14 s', was: 'Hecktüren auf, Laderaum zeigen – da geht es bei dem Wagen hin.' }
        : (v.hat('Anhängerkupplung')
          ? { zeit: '11–14 s', was: 'Anhängerkupplung zeigen – danach wird oft gefragt.' }
          : { zeit: '11–14 s', was: 'Kofferraum auf, einmal komplett ins Bild.' }),
      { zeit: '14–15 s', was: `Schlussbild auf dem Hof. Text einblenden: „Probefahrt? ${TELEFON}“.` }
    ];

    const ton = elektro
      ? 'Musik aus der Instagram-Bibliothek (bei Unternehmenskonten kleinere Auswahl). Niemals eigene Musikdateien unterlegen.'
      : 'Originalton – Motorstart und Auspuff. Klingt besser als jede Bibliotheksmusik und hat kein Lizenzproblem.';

    const punkte = merkmale(v, 3);
    const text = [
      haken,
      '',
      `${v.name}, Erstzulassung ${v.firstRegistration || '–'}${v.mileage != null ? `, ${v.mileage.toLocaleString('de-DE')} km` : ''}.`
        + (punkte.length ? ` ${aufzaehlen(punkte)} an Bord.` : ''),
      '',
      OHNE_ADRESSE[platz(n, OHNE_ADRESSE.length)],
      '',
      FUSS
    ].join('\n');

    return {
      haken, ton, plan, text,
      hashtags: hashtags(v),
      dauer: '15 Sekunden',
      varianten: kgv(moeglich.length, OHNE_ADRESSE.length)
    };
  }

  // ─── Werkstatt, Team, Alltag ─────────────────────────────────────────
  //
  // Kein Fahrzeug, keine Daten – hier gibt es nichts abzuleiten, also sind
  // es echte Vorlagen. Der Ton ist Flos eigener: gesiezt, kurz, ein Angebot
  // am Ende. Sein bester Werkstattbeitrag ("Ihr Fahrzeug benoetigt einen
  // Service oder eine Reparatur?") hatte 45 Likes – mehr als die meisten
  // Fahrzeuge. Daran ist nichts zu verbessern ausser der Regelmaessigkeit.
  //
  // "monate" steuert die Reihenfolge: einen Winter-Check im Mai
  // vorzuschlagen ist Unsinn, und genau solche Vorschlaege sorgen dafuer,
  // dass ein Werkzeug nicht mehr benutzt wird. "motive" sagt, welche Bilder
  // passen – danach greift der Vorschlag unter dem Bildvorrat.
  const WERKSTATT = [
    {
      id: 'websites', titel: 'Websites für Betriebe', monate: null,
      motive: ['websites', 'software', 'projekt'],
      tags: ['webdesign', 'website', 'homepage', 'kleinunternehmen', 'handwerk'],
      texte: [
        'Ihre Website ist älter als Ihr Smartphone?\n\nDann sehen Kunden dort etwas anderes als das, was Ihr Betrieb heute ist. Eine neue Seite muss weder Monate dauern noch ein Vermögen kosten.\n\nSchreiben Sie mir:',
        'Kein Betrieb braucht zwanzig Unterseiten.\n\nEr braucht eine, auf der steht, was er macht, für wen, und wie man ihn erreicht. Alles andere ist Beiwerk.\n\nMelden Sie sich:',
        'Was kostet eine Website?\n\nDas hängt davon ab, was drin sein soll – aber Sie bekommen vorher eine Zahl und nicht hinterher eine Überraschung.\n\nFragen Sie einfach:',
        'Viele Betriebe haben gar keine Website.\n\nDas ist kein Drama, solange die Kundschaft über Empfehlung kommt. Es wird eines, wenn der Nachwuchs anfängt zu googeln.\n\nSprechen wir darüber:',
        'Eine Website ist kein Prospekt.\n\nSie kann Termine annehmen, Fragen beantworten und Anfragen sortieren – auch nachts, auch am Sonntag.\n\nMehr dazu gern per Mail:',
        'Baukasten oder selbst gemacht?\n\nBeides geht. Der Unterschied zeigt sich meist erst, wenn etwas geändert werden soll oder Google sie nicht mag.\n\nSchreiben Sie mir:',
        'Wer macht eigentlich Ihre Website?\n\nWenn die Antwort „ein Bekannter, aber der hat gerade keine Zeit" lautet, kennen Sie das Problem.\n\nMelden Sie sich:',
        'Eine gute Seite lädt in unter zwei Sekunden.\n\nAlles darüber kostet Besucher – und zwar bevor sie gesehen haben, was Sie anbieten.\n\nFragen Sie mich:',
        'Ihre Öffnungszeiten stehen auf drei Seiten unterschiedlich?\n\nDann glaubt der Kunde keiner davon und ruft lieber woanders an.\n\nSchreiben Sie mir:',
        'Text ist wichtiger als Design.\n\nEine schlichte Seite mit klaren Sätzen bringt mehr Anrufe als eine schöne, auf der man suchen muss.\n\nSprechen wir darüber:',
        'Sie haben Fotos vom Betrieb auf dem Handy?\n\nDann haben Sie schon das Wichtigste. Echte Bilder schlagen jedes gekaufte Stockfoto.\n\nMelden Sie sich:',
        'Website fertig – und dann?\n\nSie bekommen sie so übergeben, dass Sie Preise und Zeiten selbst ändern können. Für alles andere bin ich erreichbar.\n\nFragen Sie einfach:',
        'Muss es WordPress sein?\n\nNein. Für die meisten Betriebe ist es sogar unnötig aufwendig – mit allem, was da regelmäßig aktualisiert werden will.\n\nSchreiben Sie mir:',
        'Eine Seite, die niemand pflegt, altert schnell.\n\nDeshalb baue ich sie so, dass die Sachen, die sich ändern, an einer Stelle stehen.\n\nMelden Sie sich:'
      ]
    },
    {
      id: 'sichtbarkeit', titel: 'Bei Google gefunden', monate: null,
      motive: ['sichtbarkeit', 'wuerzburg', 'netzwerk'],
      tags: ['google', 'localseo', 'sichtbarkeit', 'googlemaps', 'regional'],
      texte: [
        'Googeln Sie sich mal selbst.\n\nWenn Sie mit Ihrem eigenen Firmennamen nicht auf Platz eins stehen, findet Sie auch sonst niemand.\n\nSchreiben Sie mir:',
        'Die meisten Kunden suchen mit „in meiner Nähe".\n\nWer da nicht auftaucht, existiert für die Suche schlicht nicht – egal wie gut die Arbeit ist.\n\nMelden Sie sich:',
        'Ihr Google-Eintrag ist kostenlos.\n\nUnd trotzdem bei vielen Betrieben halb leer: keine Fotos, alte Öffnungszeiten, keine Antwort auf Bewertungen.\n\nFragen Sie mich:',
        'Bewertungen beantworten lohnt sich.\n\nNicht wegen der Sterne, sondern weil man sieht, dass da jemand zuhört. Auch bei Kritik.\n\nSprechen wir darüber:',
        'Feiertagszeiten im Google-Eintrag pflegen.\n\nNichts ärgert mehr als eine verschlossene Tür, obwohl im Netz „geöffnet" stand.\n\nSchreiben Sie mir:',
        'Sichtbarkeit ist kein Zufall.\n\nEs sind ein paar Dinge, die stimmen müssen – und die meisten davon macht man einmal und dann nie wieder.\n\nMelden Sie sich:',
        'Suchmaschinen lesen Ihre Seite wie ein Fremder.\n\nSie wissen nicht, was Sie machen, bis es irgendwo klar dasteht. Genau das fehlt oft.\n\nFragen Sie einfach:',
        'Ein Foto vom Laden bringt mehr als zehn Schlagworte.\n\nMenschen klicken auf das, was sie wiedererkennen, wenn sie davorstehen.\n\nSchreiben Sie mir:',
        'Sie stehen bei Google, aber niemand ruft an?\n\nDann liegt es selten an der Position und meistens daran, was dort zu sehen ist.\n\nMelden Sie sich:',
        'Regional schlägt allgemein.\n\nGegen die großen Portale gewinnt man nicht bei „Website erstellen" – aber sehr wohl bei „Website Würzburg".\n\nSprechen wir darüber:',
        'Karteneintrag, Website, Telefonnummer.\n\nÜberall dieselbe Schreibweise. Klingt nach Kleinkram, ist aber genau das, worauf Google achtet.\n\nFragen Sie mich:',
        'Wer zuerst gefunden wird, wird zuerst angerufen.\n\nDas ist unfair gegenüber dem besseren Betrieb – aber es ist die Lage.\n\nMelden Sie sich:',
        'Ein Eintrag ohne Fotos wird seltener geklickt.\n\nZehn ehrliche Bilder vom Betrieb reichen – Handy genügt.\n\nSchreiben Sie mir:',
        'Öffnungszeiten an Feiertagen pflegen.\n\nWer vor verschlossener Tür steht, schreibt das in die Bewertung.\n\nMelden Sie sich:'
      ]
    },
    {
      id: 'zeitsparen', titel: 'Zeit sparen', monate: null,
      motive: ['zeitsparen', 'software', 'ki'],
      tags: ['digitalisierung', 'automatisierung', 'buero', 'zeitsparen', 'prozesse'],
      texte: [
        'Wie oft beantworten Sie dieselbe Frage?\n\nÖffnungszeiten, Preise, Anfahrt. Das kann die Website übernehmen – dann bleibt das Telefon für das Wichtige frei.\n\nSchreiben Sie mir:',
        'Anfragen kommen abends und am Wochenende.\n\nGenau dann, wenn niemand im Büro ist. Ein Formular, das die richtigen Fragen stellt, spart am Montag eine Stunde.\n\nMelden Sie sich:',
        'Termine per Telefon kosten beide Seiten Zeit.\n\nErst dreimal hin und her, dann steht er doch im falschen Kalender.\n\nFragen Sie mich:',
        'Zettel, Rückrufe, Notizen auf dem Tresen.\n\nDas funktioniert – bis der Zettel weg ist. Digital heißt nicht kompliziert, es heißt nur: auffindbar.\n\nSprechen wir darüber:',
        'Jede Anfrage komplett, oder Sie müssen nachfragen?\n\nEin gut gebautes Formular holt gleich beim ersten Mal, was Sie wirklich brauchen.\n\nSchreiben Sie mir:',
        'Automatisch heißt nicht unpersönlich.\n\nDie Technik nimmt die Wiederholungen ab. Das Gespräch führen Sie danach immer noch selbst.\n\nMelden Sie sich:',
        'Was macht Ihre Website, während Sie arbeiten?\n\nBei den meisten Betrieben: nichts. Dabei könnte sie in der Zeit Anfragen sortieren.\n\nFragen Sie einfach:',
        'Eine Stunde pro Woche ist ein Arbeitstag im Jahr.\n\nSo viel geht bei vielen für Dinge drauf, die sich einmal einrichten und dann vergessen lassen.\n\nSchreiben Sie mir:',
        'Angebote schreiben dauert immer länger als gedacht.\n\nMeistens, weil man die Daten aus drei Quellen zusammensucht.\n\nSprechen wir darüber:',
        'Kunden erwarten heute eine Antwort am selben Tag.\n\nDas muss keine ausführliche sein – aber es muss eine sein.\n\nMelden Sie sich:',
        'Digitalisierung klingt nach großem Projekt.\n\nIst es selten. Meist sind es zwei, drei Handgriffe, die den Tag spürbar leichter machen.\n\nFragen Sie mich:',
        'Was sich jede Woche wiederholt, lohnt sich anzuschauen.\n\nAlles andere kann ruhig von Hand bleiben.\n\nSchreiben Sie mir:',
        'Was machen Sie dreimal am Tag von Hand?\n\nDas ist meistens die Stelle, an der sich Automatisieren zuerst lohnt.\n\nSchreiben Sie mir:',
        'Automatisieren heißt nicht abschaffen.\n\nEs heißt, dass der Handgriff bleibt, aber nicht mehr bei Ihnen liegt.\n\nMelden Sie sich:'
      ]
    },
    {
      id: 'mobil', titel: 'Am Handy', monate: null,
      motive: ['mobil', 'projekt', 'websites'],
      tags: ['mobil', 'smartphone', 'responsive', 'ladezeit', 'usability'],
      texte: [
        'Drei von vier Besuchern kommen vom Handy.\n\nWenn man dort zoomen muss, um die Telefonnummer zu lesen, ist der Anruf meist schon verloren.\n\nSchreiben Sie mir:',
        'Rufen Sie Ihre eigene Seite mal am Handy auf.\n\nUnterwegs, ohne WLAN. Was dort in drei Sekunden nicht steht, steht für viele gar nicht da.\n\nMelden Sie sich:',
        'Die Telefonnummer gehört nach oben.\n\nAntippen und es klingelt – nicht abschreiben und selbst eintippen.\n\nFragen Sie mich:',
        'Kleine Schrift ist keine Designfrage.\n\nSie ist der Grund, warum jemand weiterwischt statt anzurufen.\n\nSprechen wir darüber:',
        'Eine Seite, die am Handy ruckelt, wirkt unzuverlässig.\n\nZu Unrecht – aber der Eindruck bleibt.\n\nSchreiben Sie mir:',
        'Wie sieht Ihre Seite im Sonnenlicht aus?\n\nGrauer Text auf hellem Grund ist auf der Baustelle nicht lesbar.\n\nMelden Sie sich:',
        'Formulare am Handy sind Geduldsproben.\n\nSie müssen es nicht sein: weniger Felder, richtige Tastatur, kein Neuanfang bei einem Tippfehler.\n\nFragen Sie einfach:',
        'Google bewertet die Handy-Ansicht zuerst.\n\nNicht die am Rechner. Das überrascht immer noch viele.\n\nSchreiben Sie mir:',
        'Karte, Route, Anruf – drei Antipper.\n\nMehr braucht niemand, der Sie gerade sucht.\n\nMelden Sie sich:',
        'Jede Sekunde Ladezeit kostet Besucher.\n\nDas ist keine Theorie, das sieht man in den Zahlen jeder Seite.\n\nSprechen wir darüber:',
        'Zwei Drittel Ihrer Besucher kommen vom Handy.\n\nWenn Sie Ihre Seite nur am Rechner geprüft haben, kennen Sie sie nicht.\n\nSchreiben Sie mir:',
        'Die Telefonnummer sollte anrufbar sein.\n\nEin Fingertipp statt Abtippen – das klingt klein und entscheidet oft.\n\nMelden Sie sich:',
        'Querformat testen lohnt sich.\n\nViele halten das Handy quer, und genau da bricht die Hälfte der Seiten.\n\nFragen Sie mich:',
        'Große Bilder sind am Handy teuer.\n\nSie kosten Ladezeit und beim Kunden echtes Datenvolumen.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'projekt', titel: 'Projekt: Autohaus', monate: null,
      motive: ['projekt'],
      tags: ['referenz', 'projekt', 'autohaus', 'webdesign', 'praxisbeispiel'],
      texte: [
        'Ein Autohaus komplett neu im Netz.\n\nFahrzeugsuche mit Filtern, Probefahrt-Anfrage, Finanzierungsrechner, Mietwagen – alles auf einer Seite, alles vom Handy aus bedienbar.\n\nSo etwas auch für Ihren Betrieb?\n\nSchreiben Sie mir:',
        'Die Fahrzeuge stehen nicht doppelt gepflegt.\n\nSie kommen automatisch aus dem Bestand auf die Website. Was verkauft ist, verschwindet von allein.\n\nMelden Sie sich:',
        'Ein Finanzierungsrechner, der wirklich rechnet.\n\nRate schieben, Laufzeit wählen, Anzahlung eintragen – der Kunde sieht sofort, woran er ist. Ohne Anruf, ohne Wartezeit.\n\nFragen Sie mich:',
        'Probefahrt anfragen in unter einer Minute.\n\nFahrzeug, Wunschtermin, Kontakt – fertig. Die Anfrage landet vollständig im Postfach, nicht als Rückruf-Zettel.\n\nSprechen wir darüber:',
        'Mietwagen buchen ohne Umwege.\n\nVerfügbarkeit sehen, Zeitraum wählen, anfragen. Was vorher drei Telefonate waren, ist jetzt ein Formular.\n\nSchreiben Sie mir:',
        'Ankauf: Daten rein, Angebot raus.\n\nWer sein Auto verkaufen will, füllt sieben Felder aus statt eine Stunde zu telefonieren.\n\nMelden Sie sich:',
        'Dahinter läuft ein eigener Verwaltungsbereich.\n\nAnfragen, Belegungen, Zahlen – alles an einer Stelle, ohne dass jemand eine Software lernen muss.\n\nFragen Sie einfach:',
        'Solche Funktionen sind kein Konzern-Privileg.\n\nWas hier für ein Autohaus gebaut ist, passt genauso zu Werkstatt, Praxis oder Handwerksbetrieb.\n\nSchreiben Sie mir:',
        'Vom ersten Gespräch bis online: wenige Wochen.\n\nNicht, weil es gehetzt wird – sondern weil klar war, was gebraucht wird.\n\nMelden Sie sich:',
        'Die Seite lädt auch mit schlechtem Netz.\n\nWichtig, wenn Kunden auf dem Hof stehen und schnell etwas nachschauen wollen.\n\nSprechen wir darüber:',
        'Aus einer Autohaus-Website wurde ein Werkzeug.\n\nFahrzeuge, Mietwagen, Anfragen – alles an einer Stelle statt in drei Programmen.\n\nSchreiben Sie mir:',
        'Der Bestand pflegt sich selbst.\n\nWas auf mobile.de steht, steht auch auf der eigenen Seite – ohne zweimal tippen.\n\nMelden Sie sich:',
        'Eine Verwaltung, die der Inhaber selbst bedient.\n\nDas war die eigentliche Anforderung, nicht das Design.\n\nFragen Sie mich:',
        'Vom ersten Entwurf bis online: wenige Wochen.\n\nWeil vorher klar war, was die Seite können muss.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'ablauf', titel: 'So läuft es ab', monate: null,
      motive: ['ablauf', 'software', 'ihsan'],
      tags: ['ablauf', 'zusammenarbeit', 'beratung', 'transparenz', 'festpreis'],
      texte: [
        'Erst reden, dann rechnen.\n\nIm ersten Gespräch geht es darum, was Sie brauchen – nicht darum, was ich anbieten kann.\n\nSchreiben Sie mir:',
        'Sie bekommen einen Preis, bevor es losgeht.\n\nKeine Stundenzettel, keine Nachträge für Dinge, die vorher besprochen waren.\n\nMelden Sie sich:',
        'Zwischendurch sehen Sie, wie es aussieht.\n\nNicht erst am Ende. Ändern ist unterwegs einfacher als hinterher.\n\nFragen Sie mich:',
        'Sie müssen keine Texte schreiben können.\n\nErzählen Sie mir, was Sie machen – daraus wird die Seite. Sie lesen gegen und sagen, was nicht stimmt.\n\nSprechen wir darüber:',
        'Fotos vom Betrieb sind Gold wert.\n\nSelbst gemachte reichen völlig. Sie zeigen, wie es bei Ihnen wirklich aussieht.\n\nSchreiben Sie mir:',
        'Nach dem Start bin ich noch da.\n\nEine Preisänderung, ein neues Foto, eine Frage – dafür braucht es kein neues Angebot.\n\nMelden Sie sich:',
        'Die Seite gehört Ihnen.\n\nZugänge, Domain, Inhalte. Auch wenn wir irgendwann nicht mehr zusammenarbeiten.\n\nFragen Sie einfach:',
        'Kein Abo, das Sie nicht brauchen.\n\nWas laufend Geld kostet, sage ich vorher – und meistens ist es weniger, als Sie denken.\n\nSchreiben Sie mir:',
        'Ich arbeite neben dem Hauptberuf.\n\nDas heißt: kleine Zahl an Projekten, dafür jedes mit Zeit. Wer sofort alles braucht, ist bei mir falsch.\n\nMelden Sie sich:',
        'Ein Gespräch kostet nichts.\n\nAuch wenn danach klar ist, dass Sie gerade keine neue Seite brauchen.\n\nSprechen wir darüber:',
        'Erst reden, dann bauen.\n\nEin Gespräch von einer Stunde spart später drei Runden Korrektur.\n\nSchreiben Sie mir:',
        'Sie sehen Zwischenstände.\n\nNicht am Ende eine Überraschung, sondern zwischendurch etwas zum Anschauen.\n\nMelden Sie sich:',
        'Texte schreibe ich vor, Sie korrigieren.\n\nDas geht schneller, als vor einem leeren Blatt zu sitzen.\n\nFragen Sie mich:',
        'Was ich von Ihnen brauche, sage ich am Anfang.\n\nMeist sind es Fotos, Zeiten und eine Handvoll Sätze über den Betrieb.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'wuerzburg', titel: 'Aus Würzburg', monate: null,
      motive: ['wuerzburg', 'freiheit'],
      tags: ['wuerzburg', 'mainfranken', 'lokal', 'mittelstand', 'handwerk'],
      texte: [
        'Betriebe aus der Region, Websites aus der Region.\n\nKurze Wege sind kein Marketingspruch – sie sind der Grund, warum Rückfragen am selben Tag geklärt sind.\n\nSchreiben Sie mir:',
        'Man kann sich auch treffen.\n\nManches ist bei einem Kaffee in zwanzig Minuten geklärt, wofür sonst fünf Mails nötig wären.\n\nMelden Sie sich:',
        'Würzburg und Umgebung.\n\nWer weiter weg sitzt, ist trotzdem willkommen – nur das Treffen wird dann ein Videocall.\n\nFragen Sie mich:',
        'Lokale Betriebe haben einen Vorteil.\n\nSie sind bereits bekannt. Das muss die Website nur noch abbilden statt neu zu erfinden.\n\nSprechen wir darüber:',
        'Die Konkurrenz im Netz ist selten der Nachbar.\n\nEs sind Portale, die zwischen Ihnen und dem Kunden stehen wollen. Eine eigene Seite holt den direkten Weg zurück.\n\nSchreiben Sie mir:',
        'Kunden aus der Nähe suchen anders.\n\nSie wissen ungefähr, wo Sie sind – sie prüfen nur noch, ob es passt.\n\nMelden Sie sich:',
        'Ich arbeite aus Würzburg.\n\nFür Betriebe in Mainfranken heißt das: ein Ansprechpartner, der die Gegend kennt.\n\nSchreiben Sie mir:',
        'Regional gefunden werden ist anders als überregional.\n\nDafür zählen Ort, Bewertungen und Erreichbarkeit mehr als jede Werbeanzeige.\n\nMelden Sie sich:',
        'Kunden aus der Umgebung googeln mit Ortsnamen.\n\nWer den nirgends stehen hat, taucht bei genau dieser Suche nicht auf.\n\nFragen Sie mich:',
        'Ein Termin vor Ort ist manchmal einfacher als drei Mails.\n\nIn und um Würzburg komme ich gern vorbei.\n\nSprechen wir darüber:',
        'Unterfranken ist keine Großstadt.\n\nDas ist ein Vorteil: Empfehlung wirkt hier stärker als anderswo.\n\nSchreiben Sie mir:',
        'Viele gute Betriebe hier haben keine Website.\n\nSolange die Kundschaft über Empfehlung kommt, geht das gut.\n\nMelden Sie sich:',
        'Ich kenne die Wege hier.\n\nDas klingt nebensächlich und macht bei Terminen den Unterschied.\n\nFragen Sie einfach:',
        'Nähe heißt: Sie erreichen jemanden.\n\nNicht ein Postfach in einer anderen Zeitzone.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'einblick', titel: 'Einblick', monate: null,
      motive: ['einblick', 'ihsan', 'devops'],
      tags: ['selbststaendig', 'nebenberuflich', 'einblick', 'arbeitsalltag', 'freelancer'],
      texte: [
        'Nebenberuflich selbstständig heißt: Abende und Wochenenden.\n\nDafür kann ich mir aussuchen, woran ich arbeite – und das merkt man den Projekten an.\n\nSchreiben Sie mir:',
        'Wirtschaftsinformatik studiert, Websites gebaut.\n\nDas eine erklärt, warum mich Abläufe im Betrieb genauso interessieren wie die Seite selbst.\n\nMelden Sie sich:',
        'Warum ich wenige Projekte gleichzeitig mache.\n\nWeil ich sonst nur noch verwalten würde statt zu bauen.\n\nFragen Sie mich:',
        'Das Beste am Selbermachen: nichts ist Standard.\n\nJeder Betrieb funktioniert anders, und genau das darf man sehen.\n\nSprechen wir darüber:',
        'Ich baue lieber weniger, das dafür richtig.\n\nEine Seite mit drei Funktionen, die laufen, ist mehr wert als zehn, die halb fertig sind.\n\nSchreiben Sie mir:',
        'Am liebsten arbeite ich mit Leuten, die ihr Handwerk können.\n\nDie wissen genau, was ihre Kunden fragen – und das ist der halbe Text der Website.\n\nMelden Sie sich:',
        'Mein Werkzeug ist überschaubar.\n\nEditor, Terminal, Browser. Alles andere lenkt ab.\n\nSchreiben Sie mir:',
        'Die meisten Projekte fangen mit einer Skizze an.\n\nPapier ist immer noch das schnellste Werkzeug.\n\nMelden Sie sich:',
        'Ich baue lieber weniger, das dafür richtig.\n\nDrei Funktionen, die laufen, schlagen zehn halbfertige.\n\nFragen Sie mich:',
        'Was mich an dieser Arbeit hält.\n\nDass am Ende etwas dasteht, das jemand benutzt.\n\nSprechen wir darüber:',
        'Fehler gehören dazu.\n\nWichtig ist nur, dass sie einem selbst auffallen und nicht dem Kunden.\n\nSchreiben Sie mir:',
        'Ich teste auf echten Geräten.\n\nEin Vorschaufenster im Browser ist kein Handy in der Sonne.\n\nMelden Sie sich:',
        'Abends und am Wochenende.\n\nDafür arbeite ich an Projekten, die ich mir aussuchen konnte.\n\nFragen Sie einfach:',
        'Am liebsten arbeite ich mit Leuten, die ihr Handwerk können.\n\nDie wissen genau, was ihre Kunden fragen – das ist der halbe Text der Website.\n\nSprechen wir darüber:'
      ]
    },
    // Die folgenden sieben kamen aus der Galerie. Vorher gab es sie nur dort
    // als Bildschublade – ein Thema, unter dem Bilder liegen, aber zu dem sich
    // kein Beitrag bauen laesst, ist eine halbe Sache.
    {
      id: 'software', titel: 'Betrieb & Software', monate: null,
      motive: ['software', 'zeitsparen', 'ablauf'],
      tags: ['software', 'betrieb', 'digitalisierung', 'buero', 'kleinunternehmen'],
      texte: [
        'Drei Programme, die nicht miteinander reden.\n\nDas ist in kleinen Betrieben eher die Regel als die Ausnahme – und der Grund, warum Zahlen doppelt eingetippt werden.\n\nSchreiben Sie mir:',
        'Software muss nicht teuer sein.\n\nSie muss zu dem passen, was Sie ohnehin schon tun. Alles andere wird nach vier Wochen nicht mehr benutzt.\n\nMelden Sie sich:',
        'Excel ist keine Schande.\n\nFür vieles reicht es. Eng wird es erst, wenn zwei Leute gleichzeitig dieselbe Datei brauchen.\n\nFragen Sie mich:',
        'Die teuerste Lösung ist die, die niemand bedient.\n\nDeshalb frage ich zuerst, wer damit arbeiten soll – und dann, was das Programm können muss.\n\nSprechen wir darüber:',
        'Ein Betrieb, ein Ablauf, eine Stelle zum Nachschauen.\n\nWo etwas an drei Orten gepflegt wird, stimmt spätestens nach einem Monat keiner davon.\n\nSchreiben Sie mir:',
        'Brauchen Sie wirklich ein neues System?\n\nOft reicht es, das vorhandene richtig einzustellen. Das sage ich Ihnen lieber vorher als hinterher.\n\nMelden Sie sich:',
        'Daten, die nur auf einem Rechner liegen, sind keine Daten.\n\nSie sind ein Risiko mit Ablaufdatum.\n\nFragen Sie einfach:',
        'Jede Schnittstelle spart Tipparbeit.\n\nUnd jede, die niemand wartet, wird irgendwann zur Fehlerquelle. Beides gehört zur Planung.\n\nSchreiben Sie mir:',
        'Software ist selten das Problem.\n\nMeistens ist es der Ablauf drumherum – und der lässt sich ohne Lizenzkosten ändern.\n\nSprechen wir darüber:',
        'Was passiert, wenn der eine Mitarbeiter ausfällt, der das System kennt?\n\nWenn die Antwort unangenehm ist, lohnt ein Blick darauf.\n\nMelden Sie sich:',
        'Ein Programm mehr ist selten die Lösung.\n\nMeistens ist es eine Schnittstelle zwischen zweien, die schon da sind.\n\nSchreiben Sie mir:',
        'Schulung gehört dazu.\n\nEine halbe Stunde am Anfang spart Monate an Rückfragen.\n\nMelden Sie sich:',
        'Papier ist nicht das Problem.\n\nDas Problem ist, wenn dasselbe auf Papier und im Rechner steht.\n\nFragen Sie mich:',
        'Was passiert, wenn der Anbieter aufhört?\n\nDiese Frage gehört vor die Unterschrift, nicht danach.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'devops', titel: 'Entwicklung', monate: null,
      motive: ['devops', 'einblick', 'netzwerk'],
      tags: ['entwicklung', 'code', 'webentwicklung', 'technik', 'handwerk'],
      texte: [
        'Eine Seite ist nie fertig, wenn sie online geht.\n\nSie ist fertig, wenn sie auch in einem halben Jahr noch ohne Angst geändert werden kann.\n\nSchreiben Sie mir:',
        'Ich baue ohne Baukasten.\n\nDas dauert am Anfang länger und zahlt sich aus, sobald etwas gefordert ist, was der Baukasten nicht vorgesehen hat.\n\nMelden Sie sich:',
        'Jede Änderung wird vorher getestet, nicht live.\n\nKlingt selbstverständlich. Ist es bei vielen Seiten nicht.\n\nFragen Sie mich:',
        'Warum Ihre Seite schnell sein sollte.\n\nNicht wegen Google. Wegen dem Kunden, der auf dem Parkplatz steht und Ihre Nummer sucht.\n\nSprechen wir darüber:',
        'Der beste Code ist der, den man in einem Jahr noch versteht.\n\nAuch wenn ihn dann jemand anderes liest.\n\nSchreiben Sie mir:',
        'Kein Projekt ohne Sicherung.\n\nJeder Stand lässt sich zurückholen – das kostet nichts und erspart schlaflose Nächte.\n\nMelden Sie sich:',
        'Neue Funktion oder erst aufräumen?\n\nMeistens aufräumen. Auf einem sauberen Unterbau geht das Neue danach doppelt so schnell.\n\nFragen Sie einfach:',
        'Fehler meldet mir die Seite selbst.\n\nSo erfahre ich davon, bevor ein Kunde anruft – das ist der ganze Unterschied.\n\nSchreiben Sie mir:',
        'Technik altert.\n\nDeshalb baue ich mit Sachen, die es in fünf Jahren noch gibt, statt mit dem, was gerade neu ist.\n\nSprechen wir darüber:',
        'Was hinter einer Seite steckt, sieht man ihr nicht an.\n\nMerken tut man es trotzdem – an dem Tag, an dem etwas geändert werden soll.\n\nMelden Sie sich:',
        'Eine Änderung, die Angst macht, ist ein Warnzeichen.\n\nDann stimmt etwas mit dem Unterbau nicht.\n\nSchreiben Sie mir:',
        'Ich arbeite mit Versionsverwaltung.\n\nJeder Stand ist nachvollziehbar, jeder Schritt umkehrbar.\n\nMelden Sie sich:',
        'Weniger Abhängigkeiten, weniger Ärger.\n\nJedes zusätzliche Paket ist etwas, das jemand pflegen muss.\n\nFragen Sie mich:',
        'Was schnell gebaut ist, ist selten schnell.\n\nDie Zeit kommt später zurück, mit Zinsen.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'netzwerk', titel: 'IT & Netzwerk', monate: null,
      motive: ['netzwerk', 'devops', 'software'],
      tags: ['it', 'netzwerk', 'edv', 'sicherheit', 'betrieb'],
      texte: [
        'Das WLAN reicht nicht bis in die Werkstatt.\n\nDas ist kein Schicksal, sondern meistens eine Frage von zwei Geräten an der richtigen Stelle.\n\nSchreiben Sie mir:',
        'Wann haben Sie zuletzt geprüft, ob Ihre Sicherung wirklich läuft?\n\nEine Sicherung, die niemand zurückgespielt hat, ist eine Vermutung.\n\nMelden Sie sich:',
        'Ein Passwort für alles ist ein Schlüssel für alle.\n\nDas lässt sich in einer Stunde ändern und erspart im Ernstfall sehr viel.\n\nFragen Sie mich:',
        'Alte Geräte sind nicht das Problem.\n\nAlte Geräte ohne Sicherheitsaktualisierung schon – die stehen offen im Netz.\n\nSprechen wir darüber:',
        'Wer kommt eigentlich an Ihre Daten?\n\nIn kleinen Betrieben lautet die Antwort oft: alle. Das lässt sich sauber trennen.\n\nSchreiben Sie mir:',
        'Kabel schlägt Funk.\n\nÜberall dort, wo es auf Verlässlichkeit ankommt – Kasse, Server, Arbeitsplatz.\n\nMelden Sie sich:',
        'Der Drucker ist im Netz. Und sonst?\n\nGenau diese Geräte werden bei der Sicherheit als Erstes vergessen.\n\nFragen Sie einfach:',
        'Zwei Minuten Ausfall am Tag sind zehn Stunden im Jahr.\n\nSo gerechnet lohnt sich die Ursachensuche schnell.\n\nSchreiben Sie mir:',
        'Ihre Daten gehören Ihnen.\n\nAuch dann, wenn sie bei einem Anbieter liegen – das gehört in den Vertrag und nicht ins Vertrauen.\n\nSprechen wir darüber:',
        'Ordnung im Netz sieht man nicht.\n\nMan merkt sie nur an dem, was nicht passiert.\n\nMelden Sie sich:',
        'Ein Netzplan auf einem Blatt.\n\nKlingt altmodisch und rettet im Störfall den Abend.\n\nSchreiben Sie mir:',
        'Gäste-WLAN gehört getrennt.\n\nSonst hängt der Besuch im selben Netz wie Ihre Buchhaltung.\n\nMelden Sie sich:',
        'Router vom Anbieter sind selten die beste Wahl.\n\nFür ein paar Geräte reicht er, darüber wird es eng.\n\nFragen Sie mich:',
        'Strom weg, Daten weg?\n\nEine kleine Absicherung am Server kostet wenig und verhindert viel.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'ki', titel: 'KI & Technik', monate: null,
      motive: ['ki', 'zeitsparen', 'devops'],
      tags: ['ki', 'automatisierung', 'technik', 'zukunft', 'mittelstand'],
      texte: [
        'KI ersetzt Ihr Handwerk nicht.\n\nSie kann Ihnen aber den Papierkram abnehmen, der abends liegen bleibt.\n\nSchreiben Sie mir:',
        'Der ehrlichste Einsatz von KI: Texte vorbereiten, nicht verschicken.\n\nDas Letzte liest immer noch ein Mensch.\n\nMelden Sie sich:',
        'Was KI im Betrieb wirklich bringt.\n\nMeist nicht das Große, sondern zwanzig kleine Handgriffe am Tag, die niemand vermisst.\n\nFragen Sie mich:',
        'Vorsicht bei allem, was mit Kundendaten arbeitet.\n\nWo die Daten landen, gehört geklärt, bevor das erste Programm läuft.\n\nSprechen wir darüber:',
        'KI ist kein Knopf, den man drückt.\n\nSie ist ein Werkzeug, das eingerichtet werden will – und danach still im Hintergrund arbeitet.\n\nSchreiben Sie mir:',
        'Muss ich da jetzt mitmachen?\n\nNein. Sinnvoll wird es erst, wenn es eine konkrete Aufgabe gibt, die zu oft von Hand erledigt wird.\n\nMelden Sie sich:',
        'Automatisch heißt nicht unbeaufsichtigt.\n\nJeder Ablauf, den ich baue, meldet sich, wenn er stolpert.\n\nFragen Sie einfach:',
        'Anfragen sortieren, Termine vorschlagen, Texte entwerfen.\n\nDrei Dinge, die keine Erfahrung brauchen – und deshalb gut abgeben werden können.\n\nSchreiben Sie mir:',
        'Der Fehler ist, mit der Technik anzufangen.\n\nFangen Sie mit der Frage an, was Sie am meisten Zeit kostet.\n\nSprechen wir darüber:',
        'Was heute noch beeindruckt, ist in zwei Jahren Alltag.\n\nDeshalb baue ich lieber so, dass sich das Werkzeug austauschen lässt.\n\nMelden Sie sich:',
        'Lassen Sie sich Entwürfe schreiben, keine Antworten.\n\nDer Unterschied entscheidet, ob es peinlich wird.\n\nSchreiben Sie mir:',
        'Ein Modell weiß nicht, was in Ihrem Betrieb gilt.\n\nDeshalb gehört Ihr Wissen dazu, sonst klingt es nach jedem.\n\nMelden Sie sich:',
        'Der Nutzen liegt im Wiederkehrenden.\n\nEinmalige Aufgaben lohnen sich nicht zu automatisieren.\n\nFragen Sie mich:',
        'Prüfen Sie stichprobenartig weiter.\n\nAuch ein Ablauf, der monatelang läuft, kann leise falsch werden.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'marke', titel: 'Logo & Marke', monate: null,
      motive: ['marke', 'websites', 'projekt'],
      tags: ['logo', 'marke', 'design', 'wiedererkennung', 'kleinunternehmen'],
      texte: [
        'Ein Logo muss auf einem Transporter und auf einer Visitenkarte funktionieren.\n\nAlles, was nur in Großaufnahme gut aussieht, ist keins.\n\nSchreiben Sie mir:',
        'Wiedererkennung entsteht durch Wiederholung.\n\nDieselbe Farbe, dieselbe Schrift, überall – das wirkt mehr als jedes neue Motiv.\n\nMelden Sie sich:',
        'Ihr Firmenname steht in vier Schreibweisen im Netz?\n\nDann sucht Google vier Firmen und findet keine richtig.\n\nFragen Sie mich:',
        'Zwei Farben reichen.\n\nDrei sind meistens schon eine zu viel, und ab vier sieht es nach Baukasten aus.\n\nSprechen wir darüber:',
        'Ein Logo ist kein Bild, sondern eine Datei in mehreren Größen.\n\nWer nur ein JPG hat, merkt das beim ersten Schild.\n\nSchreiben Sie mir:',
        'Marke klingt groß.\n\nGemeint ist: dass Leute Sie erkennen, bevor sie den Namen gelesen haben.\n\nMelden Sie sich:',
        'Die Schrift entscheidet mehr als das Zeichen.\n\nSie steht auf jeder Seite, jedem Angebot, jeder Rechnung.\n\nFragen Sie einfach:',
        'Neues Logo, alte Website?\n\nDann fällt der Bruch stärker auf als vorher das alte Logo.\n\nSchreiben Sie mir:',
        'Ihr Auftritt ist so alt wie sein ältester Teil.\n\nMeistens ist das der Briefbogen.\n\nSprechen wir darüber:',
        'Ein gutes Zeichen funktioniert auch in Schwarzweiß.\n\nDas ist der einfachste Test, den Sie selbst machen können.\n\nMelden Sie sich:',
        'Ihr Logo braucht einen weißen Rand.\n\nSonst klebt es auf jedem Hintergrund am Rand fest.\n\nSchreiben Sie mir:',
        'Eine Farbe, die auf dem Bildschirm gut aussieht, kann im Druck kippen.\n\nDeshalb gehören beide Werte festgehalten.\n\nMelden Sie sich:',
        'Wer das Logo hat, sollte auch die offene Datei haben.\n\nOhne sie fängt jede Änderung von vorn an.\n\nFragen Sie mich:',
        'Ein Zeichen muss aus zehn Metern erkennbar sein.\n\nDas ist der Test für jedes Firmenschild.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'ihsan', titel: 'Ihsan', monate: null,
      motive: ['ihsan', 'einblick', 'wuerzburg'],
      tags: ['ihsanyilmaz', 'wuerzburg', 'webentwickler', 'ansprechpartner', 'regional'],
      texte: [
        'Sie reden bei mir mit der Person, die auch baut.\n\nKein Vertrieb dazwischen, keine Weitergabe an ein Team, das Sie nie sehen.\n\nSchreiben Sie mir:',
        'Wirtschaftsinformatik, dann Websites und IT.\n\nDeshalb interessiert mich zuerst Ihr Ablauf und erst danach die Technik.\n\nMelden Sie sich:',
        'Ich arbeite aus Würzburg.\n\nFür ein erstes Gespräch reicht das Telefon – danach komme ich in der Region auch vorbei.\n\nFragen Sie mich:',
        'Warum nebenberuflich?\n\nWeil ich mir dadurch aussuchen kann, welche Projekte ich annehme. Das kommt am Ende dem Projekt zugute.\n\nSprechen wir darüber:',
        'Was ich nicht mache, sage ich Ihnen auch.\n\nDas spart uns beiden die Runde über ein Angebot, das nicht passt.\n\nSchreiben Sie mir:',
        'Erreichbar heißt bei mir: Sie bekommen eine Antwort.\n\nNicht immer sofort, aber immer.\n\nMelden Sie sich:',
        'Ich erkläre, was ich tue.\n\nSie sollen hinterher verstehen, wofür Sie bezahlt haben – auch ohne Fachbegriffe.\n\nFragen Sie einfach:',
        'Kleine Betriebe sind mir am liebsten.\n\nDa entscheidet der, mit dem ich rede – und das merkt man am Tempo.\n\nSchreiben Sie mir:',
        'Ein fester Preis vorher.\n\nStundenzettel hinterher mögen weder Sie noch ich.\n\nSprechen wir darüber:',
        'Nach der Übergabe bin ich nicht weg.\n\nDas ist der Teil, den man erst später zu schätzen weiß.\n\nMelden Sie sich:',
        'Ich komme aus der Wirtschaftsinformatik.\n\nDeshalb frage ich zuerst nach dem Ablauf und erst dann nach dem Design.\n\nSchreiben Sie mir:',
        'Mir ist lieber, Sie verstehen, was ich gebaut habe.\n\nDeshalb erkläre ich es ohne Fachbegriffe.\n\nMelden Sie sich:',
        'Ich nehme wenige Projekte gleichzeitig.\n\nSonst würde ich nur noch verwalten statt zu bauen.\n\nFragen Sie mich:',
        'Ein erstes Gespräch kostet nichts.\n\nDanach wissen wir beide, ob es passt.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'freiheit', titel: 'Freiheit & Weite', monate: null,
      motive: ['freiheit', 'wuerzburg', 'einblick'],
      tags: ['selbststaendigkeit', 'unternehmertum', 'mittelstand', 'freiheit', 'mainfranken'],
      texte: [
        'Selbstständig heißt nicht, alles selbst zu machen.\n\nEs heißt, entscheiden zu dürfen, was man abgibt.\n\nSchreiben Sie mir:',
        'Der schönste Satz eines Kunden: „Darum muss ich mich jetzt nicht mehr kümmern."\n\nGenau dafür baut man Sachen.\n\nMelden Sie sich:',
        'Jeder Betrieb hat eine Stelle, an der es hakt.\n\nMeistens weiß der Inhaber genau, welche – nur nicht, wie man sie löst.\n\nFragen Sie mich:',
        'Unabhängig von einem Anbieter zu sein, ist mehr wert als jeder Rabatt.\n\nDeshalb gehören Zugänge und Daten immer Ihnen.\n\nSprechen wir darüber:',
        'Wachsen muss nicht größer heißen.\n\nEs kann auch heißen: gleich viel Umsatz, halb so viel Verwaltung.\n\nSchreiben Sie mir:',
        'Der Feierabend ist ein Betriebsziel.\n\nWer das ernst nimmt, richtet seine Abläufe anders ein.\n\nMelden Sie sich:',
        'Man kann nicht alles gleichzeitig verbessern.\n\nAber fast immer das eine, das am meisten nervt.\n\nFragen Sie einfach:',
        'Ein Betrieb, der ohne den Chef läuft, ist frei.\n\nDazu gehört, dass Wissen nicht nur in einem Kopf liegt.\n\nSchreiben Sie mir:',
        'Die Region ist kein Nachteil.\n\nWer hier gut arbeitet, wird weiterempfohlen – das ersetzt viel Werbung.\n\nSprechen wir darüber:',
        'Anfangen ist einfacher als es aussieht.\n\nMeistens reicht ein Gespräch, um zu wissen, ob es sich lohnt.\n\nMelden Sie sich:',
        'Das Ziel ist nicht mehr Arbeit.\n\nDas Ziel ist, dass die gleiche Arbeit weniger Zeit frisst.\n\nSchreiben Sie mir:',
        'Ein Betrieb ohne Notizzettel-Wissen ist belastbarer.\n\nAuch wenn jemand ausfällt.\n\nMelden Sie sich:',
        'Abhängigkeit von einem Anbieter ist teurer als jede Lizenz.\n\nDeshalb gehören Zugänge und Daten immer Ihnen.\n\nFragen Sie mich:',
        'Der erste Schritt ist meistens klein.\n\nEine Sache, die nervt, weniger nervig machen – das reicht für den Anfang.\n\nSprechen wir darüber:'
      ]
    },
    {
      id: 'preise', titel: 'Was es kostet', monate: null,
      motive: ['preise', 'ablauf', 'websites'],
      tags: ['preise', 'festpreis', 'angebot', 'transparenz', 'kleinunternehmen'],
      texte: [
        'Was kostet eine Website?\n\nSie bekommen von mir vorher eine Zahl. Keine Spanne, kein Stundensatz – eine Zahl.\n\nSchreiben Sie mir:',
        'Warum ich keine Stundenzettel schreibe.\n\nWeil dann Sie das Risiko tragen, wenn ich langsam bin. Das gehört auf meine Seite.\n\nMelden Sie sich:',
        'Ein Angebot, das auf eine Seite passt.\n\nWas drin ist, was nicht, was es kostet, wie lange es dauert. Mehr braucht es nicht.\n\nFragen Sie mich:',
        'Günstig ist die Seite, die man nicht zweimal bauen muss.\n\nDas ist der ganze Unterschied zwischen billig und günstig.\n\nSprechen wir darüber:',
        'Laufende Kosten gehören ins Angebot.\n\nDomain, Postfach, Betrieb – wer das erst hinterher aufzählt, hat vorher zu wenig gesagt.\n\nSchreiben Sie mir:',
        'Was passiert bei Änderungswünschen?\n\nKleine mache ich mit. Große bekommen vorher wieder eine Zahl. So bleibt es fair.\n\nMelden Sie sich:',
        'Es gibt Projekte, die lehne ich ab.\n\nWenn mein Preis nicht zum Nutzen passt, sage ich das lieber vorher.\n\nFragen Sie einfach:',
        'Ratenzahlung ist möglich.\n\nGerade bei Betrieben, die gerade erst anfangen, ergibt das mehr Sinn als eine Rechnung auf einmal.\n\nSprechen wir darüber:',
        'Ein Vergleichsangebot ist kein Misstrauen.\n\nHolen Sie sich ruhig zwei. Danach reden wir über den Unterschied.\n\nSchreiben Sie mir:',
        'Der Preis hängt an drei Dingen.\n\nWie viele Seiten, wie viel Funktion, wie viel Text von mir. Alles andere ist Beiwerk.\n\nMelden Sie sich:',
        'Kleinunternehmer nach §19 UStG.\n\nHeißt für Sie: keine Mehrwertsteuer auf der Rechnung.\n\nFragen Sie mich:',
        'Am teuersten ist der Stillstand.\n\nEine Seite, die seit fünf Jahren niemanden erreicht, kostet jeden Monat etwas – nur steht es auf keiner Rechnung.\n\nSprechen wir darüber:',
        'Ein Preis ohne Leistung dahinter sagt nichts.\n\nDeshalb steht bei mir daneben, was Sie dafür bekommen.\n\nSchreiben Sie mir:',
        'Nachträgliche Rechnungen mag niemand.\n\nWenn etwas dazukommt, sprechen wir vorher darüber.\n\nMelden Sie sich:'
      ]
    },
    {
      id: 'sicherheit', titel: 'Sicherheit & Datenschutz', monate: null,
      motive: ['sicherheit', 'netzwerk', 'software'],
      tags: ['datenschutz', 'dsgvo', 'sicherheit', 'impressum', 'rechtssicher'],
      texte: [
        'Ihre Website sammelt Daten, ob Sie wollen oder nicht.\n\nSchon ein eingebundenes Schriftpaket reicht. Das lässt sich sauber lösen.\n\nSchreiben Sie mir:',
        'Impressum und Datenschutz sind Pflicht.\n\nUnd zwar auffindbar, nicht versteckt auf der dritten Unterseite.\n\nMelden Sie sich:',
        'Ein Cookie-Banner ist kein Freifahrtschein.\n\nWer trotzdem vorher lädt, was er nicht darf, hat nur einen Banner mehr.\n\nFragen Sie mich:',
        'Kontaktformular ohne Verschlüsselung?\n\nDann steht die Anfrage Ihres Kunden offen im Netz. Das ist heute keine Kleinigkeit mehr.\n\nSprechen wir darüber:',
        'Ich binde keine Dienste ein, die ich nicht erklären kann.\n\nWo Daten hinfließen, gehört ins Gespräch, bevor die Seite steht.\n\nSchreiben Sie mir:',
        'Abmahnungen treffen selten die Großen.\n\nSie treffen die Seite, bei der es am einfachsten war.\n\nMelden Sie sich:',
        'Karten, Videos, Schriften.\n\nDrei Dinge, die auf fast jeder Seite stecken – und drei, die fast immer nachgebessert werden müssen.\n\nFragen Sie einfach:',
        'Datenschutz ist kein Text, den man kopiert.\n\nEr muss zu dem passen, was die Seite tatsächlich tut.\n\nSprechen wir darüber:',
        'Wer hat Zugang zu Ihrer Website?\n\nWenn die Antwort einen früheren Dienstleister enthält, gehört das geändert.\n\nSchreiben Sie mir:',
        'Sicherheitsaktualisierungen macht keiner gern.\n\nDeshalb baue ich so, dass es möglichst wenige gibt.\n\nMelden Sie sich:',
        'Ihre Domain sollte auf Ihren Namen laufen.\n\nNicht auf den der Agentur. Das merkt man erst, wenn man wechseln will.\n\nFragen Sie mich:',
        'Sicherheit sieht man nicht.\n\nMan merkt sie nur an dem Anruf, der nie kommt.\n\nSprechen wir darüber:',
        'Zwei-Faktor überall, wo es geht.\n\nDas ist die günstigste Sicherheitsmaßnahme, die es gibt.\n\nSchreiben Sie mir:',
        'Alte Zugänge gehören gelöscht.\n\nJeder, der einmal Zugriff hatte, hat ihn sonst immer noch.\n\nMelden Sie sich:'
      ]
    },
    {
      id: 'pflege', titel: 'Betreuung danach', monate: null,
      motive: ['pflege', 'ablauf', 'software'],
      tags: ['betreuung', 'wartung', 'support', 'erreichbar', 'langfristig'],
      texte: [
        'Nach der Übergabe fängt es erst an.\n\nÖffnungszeiten, Preise, neue Fotos – das ändert sich, und dann muss jemand erreichbar sein.\n\nSchreiben Sie mir:',
        'Sie sollen Texte selbst ändern können.\n\nDeshalb liegt das, was sich oft ändert, an einer Stelle und nicht verteilt im Code.\n\nMelden Sie sich:',
        'Was ich nicht mache: Sie an einen Vertrag binden.\n\nBetreuung ja, Knebel nein.\n\nFragen Sie mich:',
        'Eine Seite, die niemand anfasst, altert schnell.\n\nNicht technisch – inhaltlich. Und das sieht der Kunde zuerst.\n\nSprechen wir darüber:',
        'Wenn etwas nicht geht, melden Sie sich einfach.\n\nSie müssen kein Ticketsystem bedienen und keine Nummer ziehen.\n\nSchreiben Sie mir:',
        'Ich sichere jeden Stand.\n\nFalls eine Änderung schiefgeht, ist die Seite in Minuten wieder da, wo sie war.\n\nMelden Sie sich:',
        'Einmal im Jahr durchsehen lohnt sich.\n\nMeist findet man drei Kleinigkeiten, die längst nicht mehr stimmen.\n\nFragen Sie einfach:',
        'Ihre Seite meldet sich bei mir, wenn sie ein Problem hat.\n\nSo weiß ich es meistens vor Ihnen.\n\nSprechen wir darüber:',
        'Was, wenn Sie mit mir nicht mehr arbeiten wollen?\n\nDann bekommen Sie alles: Zugänge, Dateien, Domain. Ohne Diskussion.\n\nSchreiben Sie mir:',
        'Kleine Änderungen kosten nichts.\n\nEine neue Telefonnummer ist kein Auftrag, sondern eine Minute.\n\nMelden Sie sich:',
        'Betreuung heißt nicht, dass ich alles mache.\n\nOft zeige ich es Ihnen einmal, und danach machen Sie es selbst.\n\nFragen Sie mich:',
        'Der Unterschied zeigt sich im dritten Jahr.\n\nDann steht entweder eine gepflegte Seite da oder eine, die niemand mehr anfassen will.\n\nSprechen wir darüber:',
        'Erreichbarkeit ist Teil der Leistung.\n\nEine Seite ohne Ansprechpartner ist eine halbe Seite.\n\nSchreiben Sie mir:',
        'Ich melde mich, wenn etwas ansteht.\n\nSie müssen nicht daran denken, wann was fällig ist.\n\nMelden Sie sich:'
      ]
    },
    {
      id: 'barrierefrei', titel: 'Für alle bedienbar', monate: null,
      motive: ['barrierefrei', 'mobil', 'websites'],
      tags: ['barrierefreiheit', 'bfsg', 'bedienbarkeit', 'lesbarkeit', 'website'],
      texte: [
        'Grauer Text auf hellgrauem Grund sieht ruhig aus.\n\nLesen kann ihn ab vierzig kaum noch jemand.\n\nSchreiben Sie mir:',
        'Barrierefrei heißt nicht hässlich.\n\nEs heißt: genug Kontrast, große genug Schrift, Knöpfe, die man trifft.\n\nMelden Sie sich:',
        'Seit dem Barrierefreiheitsstärkungsgesetz gelten für viele Anbieter feste Anforderungen.\n\nOb Sie dazugehören, klären wir in fünf Minuten.\n\nFragen Sie mich:',
        'Jedes Bild braucht eine Beschreibung.\n\nNicht nur für Vorleseprogramme – Google liest sie auch.\n\nSprechen wir darüber:',
        'Können Sie Ihre Seite mit der Tastatur bedienen?\n\nProbieren Sie es mit der Tabulatortaste. Das Ergebnis überrascht die meisten.\n\nSchreiben Sie mir:',
        'Schrift unter 16 Pixel ist auf dem Handy zu klein.\n\nDas ist kein Geschmack, das ist messbar.\n\nMelden Sie sich:',
        'Ein Knopf muss aussehen wie ein Knopf.\n\nWo man raten muss, wird nicht geklickt, sondern weggegangen.\n\nFragen Sie einfach:',
        'Videos ohne Untertitel laufen bei den meisten stumm.\n\nWeil sie im Wartezimmer oder im Bus geschaut werden.\n\nSprechen wir darüber:',
        'Formulare sind die häufigste Hürde.\n\nFehlende Beschriftungen, unklare Fehler, kein Hinweis, was falsch war.\n\nSchreiben Sie mir:',
        'Barrierefreiheit hilft allen.\n\nAuch dem, der bei Sonne auf dem Parkplatz Ihre Nummer sucht.\n\nMelden Sie sich:',
        'Man muss nicht alles auf einmal richten.\n\nKontrast und Schriftgröße bringen schon den größten Teil.\n\nFragen Sie mich:',
        'Eine Seite, die jeder bedienen kann, verliert niemanden.\n\nDas ist der ganze Punkt.\n\nSprechen wir darüber:',
        'Bewegte Elemente sollten sich abschalten lassen.\n\nFür manche sind sie nicht nur störend, sondern unangenehm.\n\nSchreiben Sie mir:',
        'Überschriften sind kein Gestaltungsmittel.\n\nSie geben der Seite die Struktur, an der sich alle entlanghangeln.\n\nMelden Sie sich:'
      ]
    },
    {
      id: 'bewertungen', titel: 'Bewertungen', monate: null,
      motive: ['bewertungen', 'sichtbarkeit', 'wuerzburg'],
      tags: ['bewertungen', 'google', 'empfehlung', 'vertrauen', 'regional'],
      texte: [
        'Die meisten lesen Bewertungen, bevor sie anrufen.\n\nAuch bei Betrieben, die sie schon kennen.\n\nSchreiben Sie mir:',
        'Vier Bewertungen sind wenig.\n\nVier gute mit Antwort sind mehr wert als vierzig ohne.\n\nMelden Sie sich:',
        'Antworten Sie auf jede Bewertung.\n\nAuch auf die guten. Das liest der Nächste, der überlegt.\n\nFragen Sie mich:',
        'Eine schlechte Bewertung ist kein Drama.\n\nEine unbeantwortete schon.\n\nSprechen wir darüber:',
        'Fragen Sie zufriedene Kunden einfach.\n\nDie meisten schreiben gern etwas, kommen nur von selbst nicht drauf.\n\nSchreiben Sie mir:',
        'Bewertungen kaufen bringt nichts.\n\nMan sieht es, und Google sieht es auch.\n\nMelden Sie sich:',
        'Der beste Moment zum Fragen ist direkt nach der Übergabe.\n\nNicht drei Wochen später per Serienbrief.\n\nFragen Sie einfach:',
        'Bewertungen gehören auch auf Ihre Website.\n\nAber die echten, mit Datum – nicht drei anonyme Sätze im Kasten.\n\nSprechen wir darüber:',
        'Ein QR-Code auf der Rechnung wirkt Wunder.\n\nZwei Sekunden statt Suchen im Handy.\n\nSchreiben Sie mir:',
        'Wer nie eine schlechte Bewertung hat, wirkt unecht.\n\nEine mit einer ruhigen Antwort schadet nicht, sie hilft.\n\nMelden Sie sich:',
        'Bewertungen wirken auf die Suche.\n\nZahl, Note und wie frisch sie sind – alle drei zählen.\n\nFragen Sie mich:',
        'Empfehlung ist die beste Werbung.\n\nOnline ist die Bewertung genau das, nur an Fremde.\n\nSprechen wir darüber:',
        'Bitten Sie nie um „fünf Sterne\".\n\nBitten Sie um eine ehrliche Rückmeldung. Das kommt besser an und wirkt echter.\n\nSchreiben Sie mir:',
        'Eine Antwort in zwei Sätzen reicht.\n\nDanke, kurzer Bezug, Einladung zum Wiederkommen.\n\nMelden Sie sich:'
      ]
    },
    {
      id: 'formulare', titel: 'Anfragen & Formulare', monate: null,
      motive: ['formulare', 'zeitsparen', 'websites'],
      tags: ['formular', 'anfragen', 'kontakt', 'erreichbarkeit', 'automatisierung'],
      texte: [
        'Ein Kontaktformular mit zwölf Feldern füllt niemand aus.\n\nName, Nachricht, Erreichbarkeit. Der Rest klärt sich im Gespräch.\n\nSchreiben Sie mir:',
        'Wo landen Ihre Anfragen?\n\nWenn die Antwort „im Spam-Ordner, manchmal" lautet, ist das ein teurer Fehler.\n\nMelden Sie sich:',
        'Jede Anfrage sollte eine Bestätigung auslösen.\n\nSonst schreibt der Kunde zur Sicherheit noch dem Nächsten.\n\nFragen Sie mich:',
        'Ein Formular kann vorsortieren.\n\nTermin, Angebot oder Reklamation – das spart den ersten Rückruf.\n\nSprechen wir darüber:',
        'Pflichtfelder sparsam einsetzen.\n\nJedes Sternchen kostet Anfragen.\n\nSchreiben Sie mir:',
        'Telefonnummer abfragen oder nicht?\n\nWenn Sie zurückrufen wollen: ja. Wenn nicht: weglassen.\n\nMelden Sie sich:',
        'Anfragen gehören nicht nur ins Postfach.\n\nEine Kopie, die bleibt, hilft, wenn das Postfach aufgeräumt wird.\n\nFragen Sie einfach:',
        'Fehlermeldungen müssen sagen, was fehlt.\n\n„Ungültige Eingabe" hilft niemandem weiter.\n\nSprechen wir darüber:',
        'Ein Formular ersetzt kein Telefon.\n\nBeides gehört sichtbar auf die Seite, und zwar oben.\n\nSchreiben Sie mir:',
        'Automatische Antwort heißt nicht unpersönlich.\n\nZwei Sätze mit einer realistischen Frist reichen völlig.\n\nMelden Sie sich:',
        'Spam lässt sich stoppen, ohne den Kunden zu quälen.\n\nBilderrätsel sind dafür der schlechteste Weg.\n\nFragen Sie mich:',
        'Termine direkt buchbar zu machen, spart beiden Seiten das Hin und Her.\n\nOb das zu Ihrem Betrieb passt, klären wir vorher.\n\nSprechen wir darüber:',
        'Datenschutzhinweis gehört ans Formular.\n\nEin Satz mit Verweis, nicht ein Absatz zum Wegklicken.\n\nSchreiben Sie mir:',
        'Dateianhänge ermöglichen spart Rückfragen.\n\nEin Foto vom Problem sagt mehr als drei Mails.\n\nMelden Sie sich:'
      ]
    }
  ];

  // Service steht immer vorne: das ist das Brot-und-Butter-Thema des Betriebs
  // und der Beitrag, der am haeufigsten gebraucht wird. Danach kommt, was zur
  // Jahreszeit passt, dann der Rest.
  function werkstattThemen() {
    const monat = new Date().getMonth();
    const passt = t => !!(t.monate && t.monate.includes(monat));
    const rang = t => (t.id === 'service' ? 2 : (passt(t) ? 1 : 0));
    return [...WERKSTATT].sort((a, b) => rang(b) - rang(a))
      .map(t => ({ id: t.id, titel: t.titel, saison: passt(t), motive: t.motive || [] }));
    // Die Jahreszeit bestimmt nur die Reihenfolge – als Beschriftung am Chip
    // stand sie im Weg.
  }

  function werkstatt(id, variante) {
    // Eine in der Galerie angelegte Kategorie hat keine Baukastentexte. Frueher
    // fiel sie hier auf das erste Thema zurueck und zeigte einen Text ueber
    // Service, obwohl "Oldtimer" gewaehlt war. Besser ehrlich nichts liefern:
    // dafuer gibt es den Knopf, der einen Text schreiben laesst.
    const t = WERKSTATT.find(x => x.id === id);
    if (!t) return { titel: id, text: '', hashtags: ORT.map(w => '#' + w).join(' '), varianten: 0 };
    const n = Number.isFinite(variante) ? variante : 0;
    const roh = t.texte[platz(n, t.texte.length)].split('\n');
    // Die letzte Zeile ist die eigene Aufforderung des Bausteins – sie weicht
    // der gemeinsamen, sonst stuende zweimal dasselbe untereinander.
    while (roh.length && !roh[roh.length - 1].trim()) roh.pop();
    if (roh.length && /[:.]$/.test(roh[roh.length - 1].trim())
        && roh[roh.length - 1].length < 60) roh.pop();
    while (roh.length && !roh[roh.length - 1].trim()) roh.pop();
    const text = roh.join('\n') + '\n\n' + FUSS;
    const tags = [...ORT.slice(0, 4), ...t.tags].filter((w, i, a) => a.indexOf(w) === i);
    return {
      titel: t.titel,
      text,
      hashtags: tags.slice(0, 14).map(w => '#' + w).join(' '),
      varianten: t.texte.length
    };
  }

  // ─── Stories ─────────────────────────────────────────────────────────
  //
  // Eine Story ist kein kleiner Beitrag. Sie lebt von einer kurzen Zeile auf
  // dem Bild und davon, dass man antippen kann – und sie ist nach 24 Stunden
  // weg, wenn sie nicht in ein Highlight wandert.
  //
  // Der Text wird bewusst NICHT ins Bild gerechnet: Instagram hat dafuer
  // eigene Schriften und Sticker, die dort zu Hause aussehen. Alles, was wir
  // einbrennen wuerden, saehe nach Fremdkoerper aus. Wir liefern das Bild im
  // richtigen Format und die Zeile zum Einfuegen.
  const STORY_ZEILE = [
    v => 'NEU AUF DEM HOF',
    v => v.powerPs >= 150 ? `${v.powerPs} PS` : null,
    v => `${v.name}`,
    v => v.mileage != null && v.mileage < 60000 ? `NUR ${Math.round(v.mileage / 1000)}.000 KM` : null,
    v => 'FRISCH REINGEKOMMEN',
    v => v.gearbox === 'AUTOMATIC_GEAR' ? 'AUTOMATIK' : null,
    v => 'PROBEFAHRT?',
    v => 'AB SOFORT BEI UNS',
    v => 'HEUTE REINGEKOMMEN',
    v => 'SCHON GESEHEN?',
    v => 'DER HIER.',
    v => v.jahre !== null && v.jahre <= 3 ? 'JUNG & GEPFLEGT' : null,
    v => v.kraftstoff === 'Elektro' ? 'VOLLELEKTRISCH' : null,
    v => v.kraftstoff ? `${v.kraftstoff.toUpperCase()}` : null,
    v => v.hat('Anhängerkupplung') ? 'MIT AHK' : null,
    v => v.hat('Standheizung') && v.winter ? 'MIT STANDHEIZUNG' : null,
    v => v.hat('Navigationssystem') ? 'NAVI DRIN' : null,
    v => /SUV|Geländewagen/.test(v.kategorie) ? 'HÖHER SITZEN' : null,
    v => v.kategorie === 'Kombi' ? 'PLATZ OHNE ENDE' : null,
    v => /Cabrio|Roadster/.test(v.kategorie) ? 'DACH KANN WEG' : null,
    v => 'MITNEHMEN?',
    v => 'FRAGEN? EINFACH ANTIPPEN',
    v => 'BEI UNS IN WEIDHAUSEN',
    v => 'WER WILL?'
  ];

  const STICKER = [
    { was: 'Umfrage', wie: 'Zwei Antworten anbieten: „Würde ich fahren" / „Nicht mein Fall". Antworten kosten einen Tipp und heben die Story im Algorithmus.' },
    { was: 'Frage-Sticker', wie: '„Was wollen Sie über das Auto wissen?" – die Antworten sind gleich das Thema für die nächste Story.' },
    { was: 'Link', wie: 'Auf die Fahrzeugseite verlinken. In Stories sind Links anklickbar, im Beitrag nicht – das ist der eigentliche Vorteil.' },
    { was: 'Standort', wie: 'Würzburg setzen. Stories mit Ort werden Leuten aus der Gegend eher gezeigt.' },
    { was: 'Countdown', wie: 'Nur wenn wirklich etwas ansteht – ein Countdown ohne Anlass wirkt aufgesetzt.' },
    { was: 'Quiz', wie: '„Was schätzen Sie: wie viele Kilometer?" Drei Antworten, eine richtig. Wer tippt, bleibt.' },
    { was: 'Schieberegler', wie: 'Emoji-Regler mit „Wie gut gefällt er Ihnen?" – die niedrigste Hürde von allen, deshalb die meisten Reaktionen.' },
    { was: 'Musik', wie: 'Aus der Instagram-Bibliothek, ruhig und unaufdringlich. Nie eine eigene Musikdatei unterlegen.' },
    { was: 'Erwähnung', wie: 'Kollegen oder Werkstatt markieren, wenn sie im Bild sind – dann teilen sie die Story oft weiter.' },
    { was: 'Hashtag', wie: 'Ein einziger, klein in die Ecke: #aiyweb. Mehr sieht in der Story überladen aus.' },
    { was: 'Antwortfeld', wie: '„Fragen? Einfach hier schreiben." Direktnachrichten zählen bei Instagram mehr als jedes Like.' }
  ];

  function story(fahrzeug, variante) {
    const v = aufbereiten(fahrzeug);
    const n = Number.isFinite(variante) ? variante : 0;
    const moeglich = STORY_ZEILE.map(f => f(v)).filter(Boolean);
    const zeile = moeglich[platz(n, moeglich.length)];

    const text = [
      zeile,
      '',
      `${v.name}${v.firstRegistration ? `, ${v.firstRegistration}` : ''}${v.mileage != null ? `, ${v.mileage.toLocaleString('de-DE')} km` : ''}`,
      '',
      FUSS
    ].join('\n');

    return {
      zeile, text,
      sticker: STICKER[platz(n, STICKER.length)],
      hashtags: hashtags(v),
      varianten: kgv(moeglich.length, STICKER.length)
    };
  }

  return { bauen, reel, story, werkstatt, werkstattThemen, merkmale, name };
})();
