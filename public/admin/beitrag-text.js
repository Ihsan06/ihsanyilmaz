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
  const EINLADUNG = 'Anfragen einfach per Mail:';
  const FUSS = [EINLADUNG, TELEFON, 'Mehr auf ihsan-yilmaz.de'].join('\n');

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
  const ORT = ['aiyweb', 'aiy.web', 'weidhausen', 'coburg', 'oberfranken'];
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
      id: 'service', titel: 'Service & Reparatur', monate: null,
      motive: ['werkstatt', 'detail'],
      tags: ['werkstatt', 'kfzwerkstatt', 'service', 'reparatur', 'meisterbetrieb'],
      texte: [
        'Ihr Fahrzeug braucht einen Service oder eine Reparatur?\n\nWir helfen Ihnen schnell zurück auf die Straße – von der Inspektion bis zur größeren Sache. Gerne beraten wir Sie persönlich.\n\nTermin einfach telefonisch:',
        'Werkstatttermin gesucht?\n\nBei uns bekommen Sie beides: einen Termin in absehbarer Zeit und jemanden, der Ihnen hinterher erklärt, was gemacht wurde. Meisterbetrieb, alle Marken.\n\nRufen Sie uns an:',
        'Ein Geräusch, das vorher nicht da war?\n\nDann lieber einmal zu früh vorbeikommen als einmal zu spät. Wir schauen es uns an und sagen Ihnen ehrlich, was zu tun ist – und was warten kann.\n\nSie erreichen uns unter:',
        'Reparatur beim Meisterbetrieb, ohne wochenlang zu warten.\n\nWir arbeiten an allen Marken und halten Ihre Garantie am Leben.\n\nTermin unter:',
        'Wartungsintervall fällig?\n\nWir machen die Inspektion nach Herstellervorgabe – mit Stempel ins Scheckheft und ohne dass Sie Ihre Garantie verlieren.\n\nMelden Sie sich einfach:',
        'Die Bremsen quietschen?\n\nDas muss nichts Schlimmes sein – nachsehen sollte man trotzdem. Wir messen die Beläge durch und sagen Ihnen, wie viel noch drin ist.\n\nTermin unter:',
        'Warnleuchte im Cockpit?\n\nWir lesen den Fehlerspeicher aus und erklären Ihnen im Klartext, was dahintersteckt. Danach entscheiden Sie.\n\nRufen Sie an:',
        'Ölwechsel, Bremsen, Zahnriemen – alles bei uns im Haus.\n\nSie bekommen vorher einen Preis genannt und hinterher keine Überraschung auf der Rechnung.\n\nSie erreichen uns unter:',
        'Auto in der Werkstatt, Sie ohne Auto?\n\nSprechen Sie uns an, wir finden eine Lösung – manchmal geht der Termin auch an einem Tag durch.\n\nTelefonisch unter:',
        'Freie Werkstatt heißt nicht zweite Wahl.\n\nWir arbeiten nach Herstellervorgabe, mit den passenden Teilen und mit Stempel ins Scheckheft. Nur eben nicht zum Vertragspreis.\n\nMelden Sie sich:',
        'Klappern beim Überfahren einer Bodenwelle?\n\nMeist sind es Koppelstangen oder Domlager – ärgerlich, aber keine große Sache, wenn man früh dran ist.\n\nTermin unter:',
        'Kupplung rutscht beim Beschleunigen?\n\nDann bitte nicht bis zum Sommerurlaub warten. Wir schauen sie uns an und sagen Ihnen, wie lange sie noch macht.\n\nRufen Sie an:',
        'Zahnriemen fällig?\n\nDas ist die Reparatur, die man nicht aufschiebt: reißt er, ist meist der ganze Motor hin. Wir machen sie nach Herstellerintervall.\n\nTermin unter:',
        'Auspuff wird lauter?\n\nOft ist es nur eine Aufhängung oder ein durchgerostetes Rohrstück. Zeigen Sie ihn uns, bevor die Prüfstelle das tut.\n\nSie erreichen uns unter:',
        'Klimaanlage, Bremsen, Inspektion – alles an einem Tag.\n\nWer bei uns einmal auf der Hebebühne steht, muss nicht dreimal kommen. Sagen Sie beim Termin, was alles ansteht.\n\nRufen Sie an:',
        'Scheibe hat einen Steinschlag?\n\nSolange der Riss klein ist, lässt sich harzen statt tauschen. Das geht schnell und die Versicherung zahlt es meist ohne Selbstbeteiligung.\n\nMelden Sie sich:',
        'Getriebeöl wird gerne vergessen.\n\nBei Automatikgetrieben steht der Wechsel öfter an, als viele denken – und ein Getriebe ist teurer als ein Ölservice.\n\nFragen Sie uns unter:',
        'Der Wagen zieht beim Bremsen zur Seite?\n\nDann sitzt meistens ein Bremssattel fest. Bitte nicht damit auf die Autobahn.\n\nRufen Sie an:',
        'Ihr Fahrzeug ist über die Garantie hinaus?\n\nDann können Sie frei wählen, wer daran arbeitet. Wir machen dieselbe Wartung, dokumentiert und mit Stempel.\n\nSie erreichen uns unter:',
        'Standlicht defekt, Blinker zu schnell?\n\nKleinigkeiten machen wir zwischendurch. Kommen Sie einfach vorbei, meistens geht es sofort.\n\nWir sind erreichbar unter:',
        'Ein Kostenvoranschlag kostet Sie nichts.\n\nWir schauen uns das Fahrzeug an, rechnen zusammen und Sie entscheiden in Ruhe. Ohne Termindruck.\n\nMelden Sie sich:',
        'Elektrik spinnt?\n\nDas ist das Undankbarste am Auto – und genau deshalb lesen wir erst den Fehlerspeicher, statt auf Verdacht Teile zu tauschen.\n\nTermin unter:',
        'Ölfleck in der Einfahrt?\n\nBringen Sie den Wagen vorbei, bevor der Stand zu niedrig wird. Woher es kommt, sieht man auf der Hebebühne in zehn Minuten.\n\nRufen Sie an:',
        'Stoßdämpfer sind Verschleißteile.\n\nSie geben nicht plötzlich auf, sondern langsam – deshalb merkt man es selbst kaum. Beim Bremsweg macht es trotzdem Meter aus.\n\nSie erreichen uns unter:',
        'Nach dem Winter einmal von unten schauen lassen.\n\nStreusalz arbeitet weiter, auch wenn es draußen längst warm ist. Wer früh nachsieht, spart sich Schweißarbeit.\n\nTermin unter:',
        'Klimaanlage kühlt, riecht aber?\n\nDann liegt es am Verdampfer, nicht am Kältemittel. Eine Desinfektion hilft – und der Innenraumfilter gehört dazu.\n\nMelden Sie sich:',
        'Wir reparieren auch das, was andere schon aufgegeben haben.\n\nNicht immer, und wir sagen es Ihnen ehrlich, wenn es sich nicht mehr lohnt. Aber angeschaut haben wir es dann wenigstens.\n\nRufen Sie an:',
        'Räder wuchten nach dem Wechsel?\n\nGehört bei uns dazu, nicht extra. Ein Lenkrad, das ab 90 km/h zittert, ist kein Schicksal.\n\nSie erreichen uns unter:',
        'Wartung nach Zeit oder nach Kilometern?\n\nBei Wenigfahrern zählt das Datum: Öl altert auch im Stand. Wir schauen ins Serviceheft und sagen Ihnen, was gilt.\n\nFragen Sie uns:',
        'Zweitwagen, der kaum bewegt wird?\n\nGerade die brauchen einen Blick: Bremsen setzen Rost an, Batterien entladen sich, Reifen bekommen Standplatten.\n\nTermin unter:'
      ]
    },
    {
      id: 'tuev', titel: 'HU & AU', monate: null,
      motive: ['werkstatt', 'detail'],
      tags: ['tüv', 'hauptuntersuchung', 'werkstatt', 'kfzwerkstatt', 'hu'],
      texte: [
        'Die Plakette läuft ab?\n\nHU und AU machen wir bei uns im Haus – und wenn dabei etwas auffällt, reparieren wir es gleich mit. Ein Termin statt zwei.\n\nMelden Sie sich einfach:',
        'Ein Blick auf Ihr Kennzeichen lohnt sich.\n\nIst die Plakette bald fällig, machen Sie am besten jetzt einen Termin – dann bleibt Zeit, falls doch etwas zu richten ist.\n\nWir sind erreichbar unter:',
        'Zur Hauptuntersuchung ohne böse Überraschung.\n\nWir schauen vorher drüber, sagen Ihnen was ansteht, und Sie entscheiden. Danach zur Prüfung – bei uns im Haus.\n\nTermin unter:',
        'HU schon abgelaufen?\n\nHalb so wild, das passiert. Kommen Sie vorbei, wir bekommen das zusammen wieder gerade.\n\nEinfach anrufen:',
        'Zwei Monate über der Frist?\n\nDann wird es Zeit – ab vier Monaten kostet es zusätzlich. Wir bekommen Sie meist kurzfristig unter.\n\nTermin unter:',
        'Kein Termin bekommen woanders?\n\nBei uns geht die HU im Haus. Fragen Sie kurz nach, oft passt es schneller als gedacht.\n\nRufen Sie an:',
        'Vorabcheck vor der HU: die günstigste halbe Stunde des Jahres.\n\nWir schauen auf Licht, Bremsen, Reifen und Rost. Was fehlt, machen wir gleich mit.\n\nSie erreichen uns unter:',
        'Durchgefallen bei der HU?\n\nDas ist kein Weltuntergang. Bringen Sie uns den Mängelbericht, wir arbeiten ihn ab, und zur Nachprüfung geht es zusammen.\n\nRufen Sie an:',
        'Rost an tragenden Teilen ist der häufigste Grund für Ärger bei der HU.\n\nFrüh gesehen ist es Schweißarbeit an einer Stelle – spät gesehen an fünf.\n\nTermin unter:',
        'Beleuchtung ist der Klassiker.\n\nEin Standlicht kostet ein paar Euro, eine zweite Vorführung deutlich mehr. Wir gehen sie vorher durch.\n\nMelden Sie sich:',
        'Wann war die letzte HU?\n\nSteht auf der Plakette hinten: die Zahl oben ist der Monat, außen der Jahrgang. Wer unsicher ist, fragt uns einfach.\n\nSie erreichen uns unter:',
        'HU beim Gebrauchtwagenkauf?\n\nEine frische Plakette sagt viel, aber nicht alles. Wir schauen unabhängig drüber, bevor Sie kaufen.\n\nRufen Sie an:',
        'Abgasuntersuchung fällt bei uns nicht extra an.\n\nSie läuft zusammen mit der HU – ein Termin, ein Weg, eine Rechnung.\n\nTermin unter:',
        'Reifen unter 1,6 mm gehen nicht durch.\n\nWir messen nach, bevor Sie zur Prüfung fahren. Das erspart die zweite Vorführung.\n\nMelden Sie sich:',
        'Bremsflüssigkeit wird bei der HU nicht geprüft.\n\nSie gehört trotzdem alle zwei Jahre gewechselt – sie zieht Wasser, und das merkt man erst bei Vollbremsung.\n\nSie erreichen uns unter:',
        'Wohnwagen oder Anhänger?\n\nAuch die brauchen ihre Plakette. Bringen Sie beides mit, dann ist es an einem Vormittag erledigt.\n\nRufen Sie an:',
        'Vier Wochen Vorlauf sind angenehmer als vier Tage.\n\nDann bleibt Zeit für alles, was auffällt, ohne dass es hektisch wird.\n\nTermin unter:',
        'Fahrzeug seit Jahren in der Familie?\n\nDann kennen wir es vermutlich. Ein Blick ins Scheckheft sagt uns oft schon, worauf wir dieses Mal achten.\n\nMelden Sie sich:',
        'Prüfplakette abgelaufen und geblitzt worden?\n\nDas ist unangenehm, aber schnell erledigt. Rufen Sie durch, wir schauen, was diese Woche noch geht.\n\nSie erreichen uns unter:',
        'Nach dem Winter zur HU?\n\nGute Wahl – dann sind Salzschäden schon sichtbar und werden gleich mitbehandelt.\n\nTermin unter:',
        'Was bei der HU tatsächlich geprüft wird, überrascht viele.\n\nFragen Sie uns beim Termin, wir gehen den Bericht mit Ihnen durch. Sie sollen wissen, wofür Sie zahlen.\n\nRufen Sie an:'
      ]
    },
    {
      id: 'winter', titel: 'Winter-Check', monate: [9, 10, 11],
      motive: ['reifen', 'werkstatt'],
      tags: ['wintercheck', 'reifenwechsel', 'winterreifen', 'werkstatt', 'reifen'],
      texte: [
        'Sie wollen Ihr Fahrzeug für den Winter vorbereiten?\n\nGerne können Sie bei uns einen Winter-Check machen lassen: Reifen, Batterie, Licht, Frostschutz. Sprechen Sie uns direkt an oder vereinbaren Sie einen Termin.\n\nTelefonisch unter:',
        'Von O bis O – von Oktober bis Ostern.\n\nZeit für den Reifenwechsel. Wir montieren, wuchten und lagern Ihre Sommerreifen bei uns ein, bis Sie sie wieder brauchen.\n\nTermin unter:',
        'Die erste kalte Nacht kommt schneller als gedacht.\n\nBatterie, Scheibenwischer, Frostschutz, Reifen – in einer halben Stunde durchgesehen. Danach fahren Sie beruhigt.\n\nRufen Sie an:',
        'Kein Platz für die Sommerreifen im Keller?\n\nWir lagern sie ein: sauber, trocken und richtig gestapelt. Im Frühjahr liegen sie bereit.\n\nFragen Sie uns unter:',
        'Die Batterie merkt den ersten Frost zuerst.\n\nWir prüfen sie in fünf Minuten – das ist billiger als der Anruf beim Pannendienst am Montagmorgen.\n\nRufen Sie an:',
        'Winterreifen unter vier Millimeter?\n\nDann sind sie im Schnee kaum besser als Sommerreifen. Wir messen nach und beraten Sie ehrlich.\n\nTermin unter:',
        'Streusalz frisst sich fest.\n\nVor dem Winter einmal Unterboden und Türdichtungen anschauen – hilft mehr, als man denkt.\n\nSie erreichen uns unter:',
        'Die erste Frostnacht kommt immer unangekündigt.\n\nBatterie, Frostschutz, Wischwasser, Reifen – eine halbe Stunde, und der Winter kann kommen.\n\nTermin unter:',
        'Türgummis einfetten klingt nach Kleinigkeit.\n\nBis die Tür bei minus zehn Grad festfriert und die Dichtung reißt. Machen wir beim Winter-Check mit.\n\nRufen Sie an:',
        'Wischwasser ohne Frostschutz gefriert in der Düse.\n\nDann steht man mit Salzschleier auf der Scheibe da und sieht nichts. Wir füllen richtig auf.\n\nMelden Sie sich:',
        'Winterreifen sind nicht gleich Winterreifen.\n\nÜber sechs Jahre alt taugt auch ein tiefes Profil wenig – Gummi härtet aus. Wir schauen aufs Datum, nicht nur auf die Millimeter.\n\nTermin unter:',
        'Standheizung vor dem Winter prüfen lassen?\n\nSie steht acht Monate still. Im November merkt man dann, ob sie noch will.\n\nSie erreichen uns unter:',
        'Scheibenwischer, die im Sommer noch gingen, schmieren im Winter.\n\nGefrorene Blätter machen die Gummilippe kaputt. Neue kosten wenig.\n\nRufen Sie an:',
        'Reifenwechsel dauert bei uns keine Stunde.\n\nMontieren, wuchten, Druck prüfen, Sommerreifen einlagern. Sie warten bei einem Kaffee.\n\nTermin unter:',
        'Eiskratzer im Handschuhfach ist die halbe Miete.\n\nDie andere Hälfte: eine Batterie, die morgens noch dreht. Wir messen sie durch.\n\nMelden Sie sich:',
        'Allradantrieb ersetzt keine Winterreifen.\n\nAnfahren geht besser, Bremsen nicht. Das ist der Teil, auf den es ankommt.\n\nSie erreichen uns unter:',
        'Reifendruck fällt bei Kälte von selbst.\n\nZehn Grad weniger sind schnell 0,1 bar. Wer im Herbst füllt, fährt im Januar zu weich.\n\nRufen Sie an:',
        'Sommerreifen bei uns einlagern?\n\nSauber, trocken, richtig gestapelt und im Frühjahr griffbereit. Der Keller bleibt frei.\n\nFragen Sie uns unter:',
        'Vor der Fahrt in den Skiurlaub einmal durchsehen lassen.\n\nSchneeketten passen nicht auf jedes Rad, und in Österreich wird das kontrolliert.\n\nTermin unter:',
        'Kalt gestartet und gleich losgefahren?\n\nDas ist heute in Ordnung – aber nur mit Öl, das zur Jahreszeit passt. Wir schauen, was drin ist.\n\nMelden Sie sich:',
        'Der Winter-Check kostet weniger als ein Abschleppwagen.\n\nUnd deutlich weniger als ein Blechschaden auf Glatteis.\n\nSie erreichen uns unter:'
      ]
    },
    {
      id: 'sommer', titel: 'Klima & Sommer', monate: [3, 4, 5],
      motive: ['reifen', 'werkstatt', 'detail'],
      tags: ['klimaservice', 'klimaanlage', 'werkstatt', 'sommer', 'reifenwechsel'],
      texte: [
        'Bläst die Klimaanlage nur noch lauwarm?\n\nEin Klimaservice bringt sie wieder auf Temperatur – und schont nebenbei den Kompressor. Am besten, bevor die ersten heißen Tage kommen.\n\nTermin unter:',
        'Reifenwechsel und Klimaservice in einem Termin?\n\nMachen wir gerne zusammen – dann müssen Sie nur einmal kommen.\n\nRufen Sie uns an:',
        'Die Klimaanlage verliert jedes Jahr Kältemittel.\n\nDas merkt man erst, wenn es draußen dreißig Grad hat. Vorher prüfen kostet weniger als der Kompressor danach.\n\nSie erreichen uns unter:',
        'Sommerreifen schon drauf?\n\nWenn nicht, wird es Zeit. Wir wechseln, wuchten und schauen gleich auf die Profiltiefe.\n\nTermin einfach telefonisch:',
        'Klimaanlage riecht muffig?\n\nDann sitzt meistens der Innenraumfilter voll. Der ist schnell getauscht – und man merkt es sofort.\n\nRufen Sie an:',
        'Pollen, Staub, Hitze: der Frühling fordert das Auto mehr, als man denkt.\n\nWir machen Klimaservice, Filter und Reifen in einem Rutsch.\n\nTermin unter:',
        'Scheibenwischer schmieren seit dem Winter?\n\nNeue kosten wenig und man sieht den Unterschied beim ersten Regen.\n\nSie erreichen uns unter:',
        'Klimaanlage im Winter ab und zu einschalten.\n\nDas hält die Dichtungen geschmeidig. Wer sie ein halbes Jahr ruhen lässt, zahlt später den Kompressor.\n\nRufen Sie an:',
        'Der Klimaservice ist kein Nachfüllen.\n\nAbsaugen, prüfen, trocknen, neu befüllen – erst dann weiß man, ob das System dicht ist.\n\nTermin unter:',
        'Innenraumfilter einmal im Jahr.\n\nEr sitzt hinter dem Handschuhfach, kostet wenig und entscheidet darüber, was Sie einatmen.\n\nMelden Sie sich:',
        'Beschlagene Scheiben im Sommer?\n\nMeistens ist der Filter zu und die Klimaanlage kommt nicht durch. Fünfzehn Minuten Arbeit.\n\nSie erreichen uns unter:',
        'Sommerreifen ab sieben Grad.\n\nNicht ab einem Datum – die Temperatur entscheidet. Bei uns hält der Frühling sich selten an den Kalender.\n\nTermin unter:',
        'Lack nach dem Winter stumpf?\n\nSalz und Split hinterlassen mehr als Schmutz. Eine ordentliche Wäsche mit Unterbodenspülung ist der Anfang.\n\nRufen Sie an:',
        'Kühlflüssigkeit prüfen, bevor es dreißig Grad hat.\n\nIm Stau zeigt sich, ob das Kühlsystem in Ordnung ist – dann ist es zu spät.\n\nMelden Sie sich:',
        'Cabrio-Verdeck vor der Saison pflegen lassen?\n\nImprägnierung und Dichtungen halten es dicht. Wasserflecken im Innenraum gehen nicht wieder weg.\n\nSie erreichen uns unter:',
        'Klimaanlage arbeitet gegen die Sonne.\n\nJe voller das Auto und je heißer der Innenraum, desto mehr muss sie leisten. Einmal im Jahr Service ist keine Übertreibung.\n\nTermin unter:',
        'Pollen sind für den Filter, was Schnee für die Reifen ist.\n\nIm Frühjahr setzt er sich am schnellsten zu. Wer Heuschnupfen hat, merkt es zuerst.\n\nRufen Sie an:',
        'Nach dem Reifenwechsel bitte nachziehen lassen.\n\nNach 50 bis 100 Kilometern. Das macht man nicht, weil es Vorschrift ist, sondern weil sich Radbolzen setzen.\n\nSie erreichen uns unter:',
        'Bremsen setzen nach dem Winter Rost an.\n\nDas fährt sich meist frei – wenn nicht, quietscht es dauerhaft. Wir schauen es uns an.\n\nTermin unter:',
        'Der Sommer ist die Zeit für alles, was liegen geblieben ist.\n\nIn der kalten Jahreszeit schiebt man Reparaturen auf. Jetzt geht es ohne Frieren.\n\nMelden Sie sich:',
        'Klimaservice und Urlaubscheck zusammen?\n\nMachen wir gern in einem Termin – dann steht der Wagen einmal da statt zweimal.\n\nSie erreichen uns unter:'
      ]
    },
    {
      id: 'urlaub', titel: 'Urlaubscheck', monate: [5, 6, 7],
      motive: ['werkstatt', 'reifen', 'hof'],
      tags: ['urlaubscheck', 'werkstatt', 'sicherunterwegs', 'reise'],
      texte: [
        'Vor der großen Fahrt einmal drübergeschaut.\n\nÖl, Reifen, Bremsen, Licht, Kühlwasser – der Urlaubscheck dauert nicht lange und erspart Ihnen den Abschleppwagen auf der Brennerautobahn.\n\nTermin unter:',
        'Vollgepackt in den Urlaub?\n\nDann trägt Ihr Auto mehr als sonst. Wir prüfen Reifendruck, Bremsen und Beleuchtung, bevor es losgeht.\n\nRufen Sie kurz an:',
        'Sicher ankommen ist der halbe Urlaub.\n\nKommen Sie vor der Abfahrt vorbei, wir schauen einmal komplett drüber. Dauert eine halbe Stunde.\n\nWir sind erreichbar unter:',
        'Dachbox drauf, Anhänger dran?\n\nDann bitte vorher die Reifen und die Beleuchtung prüfen lassen. Wir machen das schnell und Sie fahren beruhigt.\n\nTermin unter:',
        'Warnwesten, Verbandskasten, Abschleppseil – im Ausland wird das kontrolliert.\n\nWir schauen mit rein, wenn Sie zum Urlaubscheck kommen.\n\nRufen Sie an:',
        'Lieber eine halbe Stunde bei uns als drei Stunden auf dem Standstreifen.\n\nÖl, Kühlwasser, Bremsen, Reifen. Danach kann der Urlaub kommen.\n\nSie erreichen uns unter:',
        'Volles Auto, volle Ladung, voller Reifendruck?\n\nBei Beladung gilt ein anderer Wert – er steht im Tankdeckel. Wir stellen ihn richtig ein.\n\nTermin unter:',
        'Zwei Wochen Süden mit dem Fahrradträger?\n\nDann tragen Heckklappe und Anhängerkupplung mehr als sonst. Ein Blick vorher lohnt.\n\nRufen Sie an:',
        'Die Panne kommt selten aus dem Nichts.\n\nMeistens hat sich vorher etwas angekündigt – ein Geräusch, ein Fleck, eine Leuchte. Bringen Sie es vor der Abfahrt vorbei.\n\nMelden Sie sich:',
        'Klimaanlage vor der Urlaubsfahrt prüfen.\n\nSechshundert Kilometer Autobahn bei dreißig Grad sind mit Kindern hinten kein Spaß.\n\nSie erreichen uns unter:',
        'Ersatzrad ist da – aber wann haben Sie zuletzt hineingesehen?\n\nOft fehlt Luft, manchmal das Werkzeug. Beides prüfen wir mit.\n\nTermin unter:',
        'Im Ausland ist die Werkstatt teurer und die Verständigung schwieriger.\n\nDeshalb lieber hier eine Stunde investieren als dort einen Tag.\n\nRufen Sie an:',
        'Öl reicht bis zum Urlaub – aber auch bis zurück?\n\nWir schauen auf den Stand und auf das Intervall, nicht nur auf den Peilstab.\n\nMelden Sie sich:',
        'Bremsen tragen im Gebirge mehr ab als das ganze Jahr in Oberfranken.\n\nWer über den Brenner will, sollte sie vorher messen lassen.\n\nSie erreichen uns unter:',
        'Warnwesten für alle Mitfahrer, nicht nur für den Fahrer.\n\nIn manchen Ländern wird das kontrolliert. Wir sagen Ihnen, was ins Auto gehört.\n\nTermin unter:',
        'Kühlwasser wird unterschätzt.\n\nEs kühlt nicht nur, es schützt auch vor Korrosion im Motorblock. Und im Stau zeigt sich, ob genug drin ist.\n\nRufen Sie an:',
        'Reifen älter als sechs Jahre?\n\nBei 130 km/h und dreißig Grad Asphalt ist das die Stelle, an der man nicht sparen sollte.\n\nMelden Sie sich:',
        'Nach dem Urlaub ist vor dem Service.\n\nWer dreitausend Kilometer am Stück gefahren ist, hat oft das Intervall voll. Sagen Sie Bescheid, wir schauen ins Heft.\n\nSie erreichen uns unter:'
      ]
    },
    {
      id: 'team', titel: 'Team & Betrieb', monate: null,
      motive: ['team', 'hof', 'hund'],
      tags: ['aiyweb', 'handwerk', 'meisterbetrieb', 'familienbetrieb', 'weidhausen'],
      texte: [
        'Hinter jedem Auto, das bei uns vom Hof fährt, steht dieses Team.\n\nMeisterbetrieb, gewachsen über Jahre, alle aus der Region. Deshalb wissen wir auch, was auf den Straßen hier draußen mit einem Auto passiert.\n\nSie erreichen uns unter:',
        'So sieht es bei uns aus, wenn niemand hinschaut.\n\nKein Hochglanz, sondern Werkstattalltag – und genau das ist der Grund, warum Sie wissen, wer an Ihrem Auto arbeitet.\n\nFragen? Rufen Sie an:',
        'Viele kennen uns seit Jahren – manche seit zwei Generationen.\n\nDas geht nur, wenn man ehrlich sagt, was gemacht werden muss und was nicht. Daran hat sich bei uns nichts geändert.\n\nWir sind da unter:',
        'Zwischen Hebebühne und Hof passiert bei uns den ganzen Tag etwas.\n\nAnnahme, Reparatur, Probefahrt, Übergabe – und dazwischen ein Kaffee. Schauen Sie gern vorbei.\n\nSie erreichen uns unter:',
        'Wer bei uns anruft, landet nicht in einer Warteschleife.\n\nSondern bei jemandem, der das Auto danach selbst in der Hand hat.\n\nWir sind erreichbar unter:',
        'Ein Betrieb ist so gut wie die Leute darin.\n\nDeshalb steht hier keine Werbeagentur im Bild, sondern die, die Ihr Auto reparieren.\n\nRufen Sie an:',
        'Weidhausen ist klein. Der Anspruch nicht.\n\nMeisterbetrieb, alle Marken, eigener Gebrauchtwagenhof – und trotzdem kennt man sich beim Namen.\n\nSie erreichen uns unter:',
        'Manche Kunden kommen aus Coburg, manche aus dem Nachbarort, manche seit zwanzig Jahren.\n\nDanke dafür. Wir geben uns weiter Mühe.\n\nWir sind da unter:',
        'Der erste Kaffee ist um kurz vor sieben.\n\nDann rollt das erste Fahrzeug auf die Hebebühne, und der Tag nimmt seinen Lauf.\n\nSie erreichen uns unter:',
        'Wer bei uns anruft, bekommt keinen Bandansage-Dschungel.\n\nSondern jemanden, der weiß, welches Auto gerade in der Halle steht.\n\nWir sind erreichbar unter:',
        'Autos sind Technik. Werkstatt ist Vertrauen.\n\nDeshalb erklären wir, was gemacht wurde – auch wenn niemand danach fragt.\n\nRufen Sie an:',
        'Bei uns arbeiten Leute aus der Gegend.\n\nDie kennen die Straßen, auf denen Ihr Auto unterwegs ist – und wissen, was die mit einem Fahrwerk machen.\n\nSie erreichen uns unter:',
        'Zwischen Annahme und Übergabe liegt der ganze Betrieb.\n\nDiagnose, Teile, Hebebühne, Probefahrt, Endkontrolle. Man sieht davon am Ende nur die Rechnung.\n\nWir sind da unter:',
        'Manche Werkzeuge liegen seit Jahrzehnten am selben Platz.\n\nWeil jeder weiß, wo sie hingehören. Das ist keine Romantik, das ist Ablauf.\n\nRufen Sie an:',
        'Das Auto vom Nachbarn, vom Chef und vom Fußballtrainer – alles schon dagewesen.\n\nIn einem Ort wie Weidhausen spricht sich beides herum: gute Arbeit und schlechte.\n\nSie erreichen uns unter:',
        'Freitagnachmittag ist die ehrlichste Zeit der Woche.\n\nDann zeigt sich, ob man den Terminplan im Griff hatte. Meistens haben wir ihn.\n\nWir sind erreichbar unter:',
        'Ein Betrieb lebt davon, dass jemand die Tür aufschließt.\n\nJeden Morgen, seit vielen Jahren, auch wenn draußen Schnee liegt.\n\nRufen Sie an:',
        'Werkstatt und Verkauf unter einem Dach.\n\nDeshalb kennen wir die Fahrzeuge auf unserem Hof nicht nur vom Papier – wir haben sie selbst durchgesehen.\n\nSie erreichen uns unter:',
        'Wir sagen auch mal ab.\n\nWenn ein Termin nicht sorgfältig zu schaffen ist, ist ein ehrliches Nein besser als eine schnelle Reparatur.\n\nWir sind da unter:',
        'Die schönsten Momente sind die Übergaben.\n\nSchlüssel rüber, Papiere dazu, und jemand fährt mit einem guten Gefühl vom Hof.\n\nRufen Sie an:',
        'Kein Hochglanzprospekt, sondern Werkstattalltag.\n\nÖlige Hände, laute Maschinen, kalte Finger im Winter. Genau daraus wird die Arbeit, für die Sie herkommen.\n\nSie erreichen uns unter:',
        'Wir sind nicht die Größten in der Gegend.\n\nDafür sitzt derjenige, der Ihr Auto repariert, zwanzig Meter von dem entfernt, der Ihnen den Termin gegeben hat.\n\nWir sind erreichbar unter:',
        'Manche Fahrzeuge begleiten wir über zehn Jahre.\n\nVom Verkauf über jede Inspektion bis zur Inzahlungnahme. Das ist uns lieber als ein schneller Abschluss.\n\nRufen Sie an:',
        'Vor dem Feierabend wird noch einmal durchgekehrt.\n\nEine saubere Halle am Morgen ist der halbe Tag – klingt banal, macht aber den Unterschied.\n\nSie erreichen uns unter:'
      ]
    },
    {
      id: 'nachwuchs', titel: 'Ausbildung', monate: [0, 1, 2, 6, 7],
      motive: ['team', 'werkstatt'],
      tags: ['ausbildung', 'kfzmechatroniker', 'handwerk', 'aiyweb', 'coburg'],
      texte: [
        'Sie suchen einen Ausbildungsplatz, bei dem Sie mehr machen als Kaffee holen?\n\nBei uns stehen Sie vom ersten Tag an mit an der Hebebühne. Kfz-Mechatronik, Meisterbetrieb, echte Autos statt Schulungsmodelle.\n\nMelden Sie sich einfach:',
        'Schrauben statt Bildschirm?\n\nWir bilden aus – und übernehmen gern, wer bleiben will. Wer sich vorstellen möchte, kommt am besten einfach vorbei.\n\nWir sind erreichbar unter:',
        'Handwerk braucht Nachwuchs.\n\nWenn Sie wissen wollen, ob der Beruf zu Ihnen passt: Kommen Sie für ein paar Tage zum Praktikum. Danach wissen Sie es.\n\nRufen Sie an:',
        'Kfz-Mechatroniker ist längst kein reiner Schrauberberuf mehr.\n\nDiagnose, Elektronik, Assistenzsysteme – wer Technik mag, langweilt sich hier nicht.\n\nMelden Sie sich:',
        'Noch keinen Plan nach der Schule?\n\nKommen Sie eine Woche zum Praktikum. Kostet Sie nichts außer früh aufstehen.\n\nRufen Sie einfach an:',
        'Wir bilden aus, weil wir wissen, wo unsere eigenen Leute herkommen.\n\nWer bei uns anfängt, lernt am echten Auto – nicht am Modell.\n\nSie erreichen uns unter:',
        'Schule bald vorbei und noch nichts in der Tasche?\n\nBei uns beginnt jedes Jahr jemand neu. Fragen kostet nichts und dauert fünf Minuten.\n\nRufen Sie an:',
        'Praktikum ist kein Kaffeekochen.\n\nSie stehen dabei, wenn ein Motor aufgeht, und dürfen anfassen. Danach wissen Sie, ob der Beruf zu Ihnen passt.\n\nMelden Sie sich:',
        'Kfz-Mechatroniker: dreieinhalb Jahre, Berufsschule im Blockunterricht.\n\nWas dazwischen passiert, erzählen wir Ihnen lieber persönlich als in einer Anzeige.\n\nSie erreichen uns unter:',
        'Noten sind uns wichtig – aber nicht das Wichtigste.\n\nPünktlich, ehrlich und bereit, dreckige Hände zu bekommen: damit kommt man bei uns weit.\n\nRufen Sie an:',
        'Diagnosegerät statt Schraubenschlüssel?\n\nBeides. Moderne Autos sind halb Elektronik, halb Mechanik – und man braucht Verständnis für beides.\n\nMelden Sie sich:',
        'Wer bei uns ausgelernt hat, ist meistens geblieben.\n\nDas sagt mehr über einen Betrieb als jeder Werbespruch.\n\nSie erreichen uns unter:',
        'Eltern dürfen mitkommen.\n\nWer wissen will, wo sein Kind die nächsten Jahre arbeitet, soll sich das ansehen dürfen. Wir zeigen die Halle gern.\n\nRufen Sie an:',
        'Erst Praktikum, dann entscheiden.\n\nEine Woche bei uns sagt mehr als zehn Berufsinformationsseiten im Netz.\n\nMelden Sie sich:',
        'Ein Auto verstehen heißt, es reparieren können.\n\nDas lernt man nicht am Bildschirm, sondern an der Hebebühne – bei jemandem, der es einem zeigt.\n\nSie erreichen uns unter:',
        'Umschulung oder Quereinstieg?\n\nAuch darüber reden wir. Wer mit dreißig anfängt, bringt oft mit, was mit sechzehn noch fehlt.\n\nRufen Sie an:',
        'Handwerk hat Zukunft – auch wenn das jeder sagt.\n\nBei uns heißt das ganz konkret: Autos gehen kaputt, egal wie die Wirtschaft läuft.\n\nMelden Sie sich:',
        'Bewerbung muss nicht perfekt sein.\n\nEin Anruf reicht für den Anfang. Den Rest besprechen wir, wenn Sie hier stehen.\n\nSie erreichen uns unter:'
      ]
    },
    {
      id: 'ankauf', titel: 'Ankauf', monate: null,
      motive: ['hof', 'uebergabe'],
      tags: ['autoankauf', 'gebrauchtwagen', 'autohaus', 'autoverkaufen'],
      texte: [
        'Sie möchten Ihr Fahrzeug verkaufen?\n\nWir machen Ihnen ein faires, unverbindliches Angebot – schnell, unkompliziert und ohne dass Sie Ihr Auto wochenlang inserieren müssen. Alle Marken, auch mit Mängeln.\n\nEinfach anrufen:',
        'Was ist Ihr Auto noch wert?\n\nDie Bewertung kostet Sie nichts und dauert nicht lange. Kommen Sie vorbei oder rufen Sie vorher an.\n\nWir sind da unter:',
        'Keine Lust auf Besichtigungstermine mit Fremden?\n\nVerständlich. Wir kaufen direkt an, kümmern uns um die Abmeldung, und Sie haben es hinter sich.\n\nMelden Sie sich unter:',
        'Auch mit fälligem TÜV oder höherem Kilometerstand.\n\nWir schauen uns jedes Auto an und sagen Ihnen ehrlich, was es bei uns bringt.\n\nRufen Sie an:',
        'Neues Auto gefunden, altes soll weg?\n\nWir nehmen es in Zahlung – dann haben Sie beides an einem Tag erledigt.\n\nMelden Sie sich unter:',
        'Auto steht seit Monaten in der Einfahrt?\n\nSchade drum. Wir machen Ihnen ein Angebot, kümmern uns um die Abmeldung und holen es ab.\n\nRufen Sie an:',
        'Ankauf heißt bei uns: anschauen, Preis nennen, fertig.\n\nKein Onlineformular, das hinterher den Preis wieder senkt.\n\nSie erreichen uns unter:',
        'Erbschaft, Umzug, Führerschein abgegeben?\n\nEs gibt viele Gründe, ein Auto abzugeben. Wir machen es unkompliziert – auch die Abmeldung.\n\nRufen Sie an:',
        'Motorschaden?\n\nAuch dann ist der Wagen etwas wert. Sagen Sie uns ehrlich, was ist, dann sagen wir ehrlich, was geht.\n\nMelden Sie sich:',
        'Zwei Autos, aber nur eine Einfahrt?\n\nDann kaufen wir das an, das steht. Sie brauchen es nur einmal herzubringen.\n\nSie erreichen uns unter:',
        'Wir kaufen auch, was wir selbst nicht verkaufen.\n\nNicht jedes Fahrzeug passt auf unseren Hof – einen Preis bekommen Sie trotzdem.\n\nRufen Sie an:',
        'Privatverkauf heißt: Fremde in der Einfahrt, Probefahrten, Diskussionen.\n\nUnd hinterher die Frage, ob die Haftung wirklich ausgeschlossen war.\n\nMelden Sie sich unter:',
        'Gutachten oder Schätzung von woanders?\n\nBringen Sie es mit. Wir schauen es uns an und sagen Ihnen, ob wir mithalten können.\n\nSie erreichen uns unter:',
        'Was den Preis wirklich macht: Zustand, Historie, Nachfrage.\n\nKilometerstand ist nur ein Teil davon – ein gepflegter Wagen mit 180.000 kann mehr wert sein als ein vernachlässigter mit 90.000.\n\nRufen Sie an:',
        'Der Wagen läuft noch, aber die nächste HU wäre teuer?\n\nGenau dann lohnt sich das Gespräch. Rechnen Sie nicht allein.\n\nTermin unter:',
        'Wir zahlen sofort und melden ab.\n\nSie geben den Schlüssel, den Brief und die Papiere – den Rest übernehmen wir.\n\nMelden Sie sich:',
        'Firmenfahrzeug aus dem Leasing zurück?\n\nAuch da reden wir gern mit. Manchmal ist die Übernahme günstiger als die Rückgabe.\n\nSie erreichen uns unter:',
        'Ein Angebot ist unverbindlich.\n\nSie können damit vergleichen, überlegen und wiederkommen. Wir drängen niemanden.\n\nRufen Sie an:',
        'Oldtimer oder Liebhaberstück?\n\nDa sind wir vorsichtig – so etwas verkauft man besser an jemanden, der es sucht. Wir sagen Ihnen offen, wenn wir nicht der Richtige sind.\n\nMelden Sie sich:',
        'Erst Neues finden, dann Altes abgeben.\n\nGeht bei uns in einem Termin: Sie kommen mit dem einen und fahren mit dem anderen.\n\nSie erreichen uns unter:',
        'Der Wagen steht seit dem Winter abgemeldet?\n\nJeder Monat kostet Wert. Ein Anruf klärt in fünf Minuten, ob sich Warten noch lohnt.\n\nRufen Sie an:'
      ]
    },
    {
      id: 'finanzierung', titel: 'Finanzierung', monate: null,
      motive: ['uebergabe', 'team', 'hof'],
      tags: ['autofinanzierung', 'finanzierung', 'autohaus', 'gebrauchtwagen'],
      texte: [
        'Das passende Auto gefunden, aber nicht alles auf einmal?\n\nWir stimmen die Finanzierung mit Ihnen ab – Laufzeit und Rate so, dass es zu Ihnen passt. Vorab rechnen können Sie selbst auf unserer Seite.\n\nFragen beantworten wir unter:',
        'Erst rechnen, dann entscheiden.\n\nAuf unsere Seite sehen Sie in einer Minute, wie eine Rate aussehen könnte. Die genauen Konditionen besprechen wir dann persönlich.\n\nSie erreichen uns unter:',
        'Finanzierung muss nicht kompliziert sein.\n\nWir erklären Ihnen, was die Zahlen bedeuten, und Sie entscheiden in Ruhe. Ohne Druck und ohne Kleingedrucktes am Ende.\n\nRufen Sie an:',
        'Rate, Laufzeit, Anzahlung – drei Zahlen, die zusammenpassen müssen.\n\nRechnen Sie vorab auf unserer Seite, den Rest machen wir gemeinsam.\n\nFragen unter:',
        'Finanzieren beim Händler statt bei der Bank um die Ecke?\n\nOft geht es schneller und Sie haben alles an einem Ort. Wir rechnen Ihnen beides ehrlich vor.\n\nSie erreichen uns unter:',
        'Wir verkaufen keine Finanzierung, wir suchen eine, die passt.\n\nWenn Bar günstiger ist, sagen wir das auch.\n\nRufen Sie an:',
        'Anzahlung senkt die Rate – aber nicht immer sinnvoll.\n\nWer die Rücklage lieber behält, fährt manchmal besser. Darüber reden wir vorher.\n\nSie erreichen uns unter:',
        'Schlussrate klingt bequem, ist aber eine Entscheidung auf später.\n\nWir rechnen Ihnen beide Wege durch, damit die Überraschung ausbleibt.\n\nMelden Sie sich:',
        'Wie lange soll das Auto halten, wie lange die Rate laufen?\n\nBeides sollte zusammenpassen. Eine Finanzierung, die den Wagen überlebt, ist selten eine gute.\n\nRufen Sie an:',
        'Rechnen Sie in Ruhe zu Hause.\n\nAuf unsere Seite steht der Rechner. Was dabei herauskommt, besprechen wir dann persönlich.\n\nSie erreichen uns unter:',
        'Inzahlungnahme zählt als Anzahlung.\n\nDas verkürzt die Laufzeit oder senkt die Rate – je nachdem, was Ihnen lieber ist.\n\nTermin unter:',
        'Kein Kleingedrucktes zum Schluss.\n\nAlles, was zählt, steht vorher auf dem Tisch. Fragen sind ausdrücklich erwünscht.\n\nMelden Sie sich:',
        'Selbstständig und deshalb unsicher?\n\nDas ist kein Ausschlussgrund. Bringen Sie mit, was Sie haben, wir schauen es zusammen an.\n\nRufen Sie an:',
        'Versicherung, Steuer, Sprit – die Rate ist nur ein Teil.\n\nWir rechnen die laufenden Kosten mit durch, damit die Zahl am Ende auch stimmt.\n\nSie erreichen uns unter:',
        'Sondertilgung möglich?\n\nMeistens ja. Fragen Sie danach, bevor Sie unterschreiben – hinterher lässt sich das nicht mehr ändern.\n\nMelden Sie sich:',
        'Zwei Angebote sind besser als eines.\n\nHolen Sie ruhig eines bei Ihrer Bank ein. Wenn unseres besser ist, sehen Sie es sofort.\n\nRufen Sie an:',
        'Wir finanzieren keine Träume, sondern Autos.\n\nWenn eine Rate zu knapp wird, sagen wir das. Ein zufriedener Kunde ist uns lieber als ein schneller Abschluss.\n\nSie erreichen uns unter:',
        'Der Papierkram ist an einem Nachmittag erledigt.\n\nBringen Sie Ausweis, Führerschein und die letzten Gehaltsnachweise mit, dann geht es zügig.\n\nTermin unter:'
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
