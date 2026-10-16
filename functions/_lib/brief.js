// Akquise-Post: reine Funktionen rund um einen Brief. Keine Datenbank, kein
// fetch – damit sich alles mit node ohne Worker durchspielen laesst.
//
//   tokenErzeugen()                – 12 Zeichen [a-z0-9] fuer /fuer/<token>
//   empfaengerBlock(betrieb)       – Anschrift, wie sie ins Fenster kommt
//   absenderBlock(absender)        – dasselbe fuer den Testbrief an mich
//   befundeAusPruefung(...)        – Website-Signale als nachpruefbare Saetze
//   briefFuellen(vorlage, werte)   – Platzhalter ersetzen
//   briefAufbauen(text)            – Betreff / Absaetze / Liste / Hinweis trennen
//
// Die Adresse traegt bewusst keinen Personennamen: "z. Hd. Geschäftsleitung"
// reicht fuer die Zustellung, und es landet kein Name in der Datenbank, den
// niemand gebraucht haette.

export const TOKEN_RE = /^[a-z0-9]{12}$/;

export const LANDING_BASIS_STANDARD = 'https://ihsan-yilmaz.de/fuer/';

// Voreinstellung aus dem Impressum (src/app/impressum/page.tsx).
export const ABSENDER_STANDARD = {
  name: 'Ihsan Yilmaz',
  zusatz: 'Webentwicklung',
  strasse: 'Oberer Mainkai 9',
  plz_ort: '97070 Würzburg',
  telefon: '+49 176 63657207',
  email: 'kontakt@ihsan-yilmaz.de',
  web: 'ihsan-yilmaz.de',
};

export const PLATZHALTER = [
  { name: '{firma}', erklaerung: 'Name des Betriebs' },
  { name: '{ort}', erklaerung: 'Ort des Betriebs' },
  { name: '{befunde}', erklaerung: 'die angekreuzten Befunde, je Zeile ein Spiegelstrich' },
  { name: '{link}', erklaerung: 'Adresse der persönlichen Seite, z. B. https://ihsan-yilmaz.de/fuer/ab12cd34ef56' },
  { name: '{link_kurz}', erklaerung: 'dieselbe Adresse ohne https://' },
  { name: '{absender_name}', erklaerung: 'Name aus den Absenderdaten' },
  { name: '{absender_email}', erklaerung: 'E-Mail aus den Absenderdaten' },
  { name: '{absender_telefon}', erklaerung: 'Telefon aus den Absenderdaten' },
  { name: '{datum}', erklaerung: 'heutiges Datum, z. B. 24. September 2026' },
  { name: '{referenz}', erklaerung: 'der Referenz-Satz aus „Vorlage & Absender“ – leer, solange keiner eingetragen ist' },
];

// Aufbau der Vorlage: erste Zeile = Betreff. Zeilen, die mit "– " beginnen,
// werden zum Befund-Kasten. Der Absatz nach "Mit freundlichen Grüßen" ist der
// Namensblock (zweite Zeile klein), ein Absatz mit "PS:" wird als PS gesetzt.
// Alles unter einer Zeile "---" ist der Hinweis in kleiner Schrift, fest
// unten auf dem Blatt. Link und QR-Code kommen automatisch als Handlungsblock
// ins dritte Falzfeld – die Vorlage braucht keinen {link}-Absatz mehr.
export const VORLAGE_STANDARD = `Eine Idee für {firma}

Sehr geehrte Damen und Herren,

ich bin Webentwickler in Würzburg und habe mir angesehen, was ein Kunde findet, der Sie im Internet sucht. Jeden Punkt können Sie selbst nachprüfen:

{befunde}

Für Autohäuser und Werkstätten habe ich eine eigene Website-Lösung entwickelt – gebaut mit den KI-Werkzeugen von heute, deshalb zu einem Preis, der vor wenigen Jahren nicht möglich war. Die Rückseite zeigt ein Beispiel.

{referenz}

Mit freundlichen Grüßen

{absender_name}
Webentwickler, Würzburg

PS: Die Seite hinter dem QR-Code ist nur für {firma} angelegt – ohne Konto, ohne Newsletter.

---
Hinweis nach Art. 14 und 21 DSGVO: Ihre Firmenanschrift stammt aus OpenStreetMap, dem Google-Karteneintrag oder Ihrer Website. Ich nutze sie nur für dieses Anschreiben (Art. 6 Abs. 1 f DSGVO); Druck und Versand übernimmt ein Dienstleister in meinem Auftrag, sonst erhält sie niemand. Der Aufruf Ihrer persönlichen Seite wird nur gezählt, ohne Cookie und IP-Adresse. Keine weitere Post: {link_kurz}/nein oder eine E-Mail an {absender_email}. Mehr: ihsan-yilmaz.de/datenschutz`;

// Zweiter Brief an Betriebe ohne Reaktion: kein neuer Befund-Kasten, sondern
// ein anderer Aufhaenger (Referenz) und der Rueckruf als kleinster Schritt.
// Ist keine Referenz eingetragen, faellt der Absatz {referenz} einfach weg.
export const VORLAGE_NACHFASS = `Noch einmal: eine Idee für {firma}

Sehr geehrte Damen und Herren,

vor ein paar Wochen habe ich Ihnen geschrieben, was mir an Ihrem Auftritt im Internet aufgefallen ist. Vielleicht ist der Brief im Alltag untergegangen – deshalb ein kurzer zweiter Anlauf.

{referenz}

Ihre persönliche Seite ist weiterhin für Sie angelegt. Dort sehen Sie die Demo und können um einen Rückruf bitten: Nummer eintragen, ich melde mich bis zum nächsten Werktag.

Wenn es gerade nicht passt, ist das völlig in Ordnung – dann bleibt es bei diesem Brief.

Mit freundlichen Grüßen

{absender_name}
Webentwickler, Würzburg

---
${VORLAGE_STANDARD.split('\n---\n')[1].replace('nur für dieses Anschreiben', 'nur für meine beiden Anschreiben')}`;

export function tokenErzeugen() {
  const zeichen = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const zufall = new Uint8Array(12);
  crypto.getRandomValues(zufall);
  // 256 ist kein Vielfaches von 36 – der Rest verzerrt die Verteilung ein
  // wenig. Fuer einen unerratbaren Link mit 36^12 Moeglichkeiten egal.
  let t = '';
  for (const b of zufall) t += zeichen[b % zeichen.length];
  return t;
}

const sauber = s => String(s ?? '').replace(/\s+/g, ' ').trim();

// Anschrift des Betriebs, Zeilen mit \n. Fehlt etwas, fehlt die Zeile –
// die Oberflaeche zeigt dann "Anschrift unvollständig".
export function empfaengerBlock(betrieb) {
  const b = betrieb || {};
  const plzOrt = [sauber(b.plz), sauber(b.ort)].filter(Boolean).join(' ');
  return [sauber(b.name), 'z. Hd. Geschäftsleitung', sauber(b.strasse), plzOrt].filter(Boolean).join('\n');
}

export function absenderBlock(absender) {
  const a = { ...ABSENDER_STANDARD, ...(absender || {}) };
  return [sauber(a.name), sauber(a.zusatz), sauber(a.strasse), sauber(a.plz_ort)].filter(Boolean).join('\n');
}

// Die einzeilige Ruecksendeangabe ueber der Anschrift.
export function absenderZeile(absender) {
  const a = { ...ABSENDER_STANDARD, ...(absender || {}) };
  return [sauber(a.name), sauber(a.strasse), sauber(a.plz_ort)].filter(Boolean).join(' · ');
}

// Vollstaendig heisst: Name, Strasse und "PLZ Ort" – mindestens drei Zeilen,
// die letzte beginnt mit einer Postleitzahl.
export function anschriftVollstaendig(empfaenger) {
  const zeilen = String(empfaenger || '').split('\n').map(z => z.trim()).filter(Boolean);
  if (zeilen.length < 3) return false;
  return /^\d{5}\s+\S/.test(zeilen[zeilen.length - 1]);
}

const jahrVon = s => { const m = /^(\d{4})/.exec(String(s || '')); return m ? m[1] : null; };
const zahlAus = (text, re) => { const m = re.exec(String(text || '')); return m ? m[1] : null; };

// Je Signalcode ein Satz, den der Empfaenger selbst nachpruefen kann. Bekommt
// das Signal und die Pruefzeile, weil manche Saetze eine Zahl brauchen.
const SAETZE = {
  keine_website: () => 'Bei OpenStreetMap und Google ist keine Website hinterlegt; Kunden finden Sie dort nur über den Karteneintrag.',
  // Boersenname kommt aus der Erkennung (mobile.de, AutoScout24 …), keine Wertung ueber Dritte.
  nur_boerse: (s, p) => (p?.boerse ? `Es gibt nur die Händlerseite bei ${p.boerse}, keine eigene Website.` : 'Es gibt nur eine Händlerseite auf einer Fahrzeugbörse, keine eigene Website.'),
  bestand_nur_boerse: () => 'Fahrzeuge sind nur über mobile.de oder AutoScout24 erreichbar, nicht auf der eigenen Seite.',
  kein_https: () => 'Ihre Seite wird ohne verschlüsselte Verbindung ausgeliefert – Browser zeigen „Nicht sicher“.',
  kein_viewport: () => 'Auf dem Smartphone erscheint die Seite in Desktop-Größe, Text muss gezoomt werden.',
  copyright_alt: (s, p) => {
    const jahr = p?.copyright_jahr || zahlAus(s.text, /(\d{4})/);
    return jahr ? `Im Fuß der Seite steht © ${jahr}.` : 'Die Jahreszahl im Fuß der Seite ist mehrere Jahre alt.';
  },
  lange_still: (s, p) => {
    const jahr = jahrVon(p?.wayback_letzter);
    return jahr
      ? `Laut Internet-Archiv seit ${jahr} keine inhaltliche Änderung.`
      : 'Laut Internet-Archiv seit Jahren keine inhaltliche Änderung.';
  },
  psi_schwach: (s, p) => {
    const n = p?.psi_leistung ?? zahlAus(s.text, /PageSpeed\s+(\d+)/);
    return n != null ? `Google PageSpeed bewertet die Seite auf dem Handy mit ${n} von 100 Punkten.` : 'Google PageSpeed bewertet die Seite auf dem Handy als schwach.';
  },
  baukasten: (s, p) => {
    const name = p?.baukasten || zahlAus(s.text, /Baukasten:\s*(.+)$/);
    return name ? `Die Seite läuft auf dem Baukasten ${name}.` : 'Die Seite läuft auf einem Baukasten.';
  },
  technik_alt: s => {
    const liste = zahlAus(s.text, /Alte Technik:\s*(.+)$/);
    return liste ? `Die Seite nutzt veraltete Technik (${liste}), die seit Jahren nicht mehr gepflegt wird.` : 'Die Seite nutzt Technik, die seit Jahren nicht mehr gepflegt wird.';
  },
  kein_impressum: () => 'Von der Startseite aus ist kein Impressum verlinkt.',
  kein_datenschutz: () => 'Von der Startseite aus ist keine Datenschutzerklärung verlinkt.',
  kein_schema: () => 'Suchmaschinen bekommen keine strukturierten Daten zu Adresse und Öffnungszeiten.',
  kein_bestand: () => 'Auf der Seite sind keine Fahrzeuge zu sehen.',
  langsam: s => {
    const sek = zahlAus(s.text, /Antwort\s+([\d,.]+)\s*s/);
    return sek ? `Die Startseite antwortet erst nach ${sek} Sekunden.` : 'Die Startseite lädt sehr langsam.';
  },
  kein_titel: () => 'Die Startseite hat keinen Seitentitel – in Google-Ergebnissen steht dann nur die Adresse.',
  nicht_erreichbar: () => 'Die Seite war bei meinem Aufruf nicht erreichbar.',
};

// Website-Signale der letzten Pruefung in Saetze uebersetzen, staerkste
// zuerst. `vorgewaehlt` markiert die drei staerksten – die Oberflaeche kreuzt
// sie an. "nicht_erreichbar" bleibt hinten: das kann auch Bot-Schutz sein.
export function befundeAusPruefung(signale, pruefung, { anzahl = 3 } = {}) {
  const liste = (Array.isArray(signale) ? signale : [])
    .filter(s => s && s.seite === 'website' && SAETZE[s.code])
    .sort((a, b) => (b.punkte || 0) - (a.punkte || 0));
  const gesehen = new Set();
  const befunde = [];
  for (const s of liste) {
    if (gesehen.has(s.code)) continue;
    gesehen.add(s.code);
    befunde.push({ code: s.code, text: SAETZE[s.code](s, pruefung || {}), punkte: s.punkte || 0, vorgewaehlt: false });
  }
  let n = 0;
  for (const b of befunde) {
    if (b.code === 'nicht_erreichbar') continue;
    if (n < anzahl) { b.vorgewaehlt = true; n++; }
  }
  return befunde;
}

// Fuer den Testbrief an mich, wenn der Betrieb noch keine Pruefung hat, und
// fuer die Vorschau mit dem Beispielbetrieb.
export const BEFUNDE_BEISPIEL = [
  { code: 'kein_https', text: SAETZE.kein_https() },
  { code: 'kein_viewport', text: SAETZE.kein_viewport() },
  { code: 'copyright_alt', text: 'Im Fuß der Seite steht © 2017.' },
  { code: 'google_note', text: '4,6 Sterne bei 38 Bewertungen – das spricht für Sie.' },
];

// Stichwort je Befund-Code – im Befund-Kasten des Briefs und auf der
// persoenlichen Seite als Lesehilfe vor dem Satz. Keine Ampel, keine Wertung.
export const CHECK_LABELS = {
  keine_website: 'Eigene Website', nur_boerse: 'Eigene Website', bestand_nur_boerse: 'Fahrzeuge', kein_bestand: 'Fahrzeuge',
  nicht_erreichbar: 'Erreichbarkeit', kein_viewport: 'Handy-Ansicht', kein_https: 'Verschlüsselung', psi_schwach: 'Ladezeit Handy',
  langsam: 'Ladezeit', copyright_alt: 'Stand', lange_still: 'Letzte Änderung', baukasten: 'Technik', technik_alt: 'Technik',
  kein_impressum: 'Impressum', kein_datenschutz: 'Datenschutz', kein_schema: 'Google-Daten', kein_titel: 'Seitentitel', google_note: 'Google',
};

// Eine Zeile des Befund-Kastens lesen: Stichwort und Satz. Das Stichwort
// steht vor dem Doppelpunkt ("Technik: …") und muss eines der bekannten sein;
// aeltere Entwuerfe ohne Stichwort im Text werden ueber den unveraenderten
// Satz erkannt.
const STICHWOERTER = new Set(Object.values(CHECK_LABELS));
const glatt = t => String(t || '').replace(/\s+/g, ' ').trim();
export function befundZeile(zeile, befunde) {
  const m = /^([^:]{2,30}):\s+(.+)$/.exec(glatt(zeile));
  if (m && STICHWOERTER.has(m[1])) return { label: m[1], satz: m[2], google: m[1] === CHECK_LABELS.google_note };
  const b = (Array.isArray(befunde) ? befunde : []).find(x => glatt(x?.text) === glatt(zeile));
  const label = b ? CHECK_LABELS[b.code] : undefined;
  return { label, satz: glatt(zeile), google: b?.code === 'google_note' };
}

// Die positive Google-Zeile: nur mit echten Zahlen, die fuer den Betrieb
// sprechen (Note ab 4,0, mindestens 10 Bewertungen, Stand bekannt). Sie
// steht als letzte Zeile im Kasten, ohne Ziffer, gruenes Label.
export function googleZeile(betrieb) {
  const note = Number(betrieb?.google_bewertung), anzahl = Number(betrieb?.google_anzahl);
  if (!betrieb?.google_stand || !Number.isFinite(note) || note < 4 || !Number.isInteger(anzahl) || anzahl < 10) return null;
  const noteText = note.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return { code: 'google_note', text: `${noteText} Sterne bei ${anzahl.toLocaleString('de-DE')} Bewertungen – das spricht für Sie.` };
}

// Rueckseite: je Befund-Code die Nutzen-Zeile, die dazu passt – Handy,
// Fahrzeuge, Anpassbarkeit, KI-Suche (GEO). Verschluesselung und Impressum
// bekommen keine eigene Zeile (User: lieber Nutzen als Technik).
export const LOESUNGEN = {
  kein_viewport: { label: 'Handy-Ansicht', text: 'passt sich jedem Bildschirm an' },
  keine_website: { label: 'Fahrzeuge', text: 'Ihr Bestand, automatisch aus mobile.de' },
  nur_boerse: { label: 'Fahrzeuge', text: 'Ihr Bestand, automatisch aus mobile.de' },
  bestand_nur_boerse: { label: 'Fahrzeuge', text: 'Ihr Bestand, automatisch aus mobile.de' },
  kein_bestand: { label: 'Fahrzeuge', text: 'Ihr Bestand, automatisch aus mobile.de' },
  copyright_alt: { label: 'Anpassbar', text: 'Änderungen schnell und günstig' },
  lange_still: { label: 'Anpassbar', text: 'Änderungen schnell und günstig' },
  baukasten: { label: 'Anpassbar', text: 'Änderungen schnell und günstig' },
  technik_alt: { label: 'Anpassbar', text: 'Änderungen schnell und günstig' },
  kein_schema: { label: 'KI-Suche', text: 'auch ChatGPT und Google AI finden Sie' },
  kein_titel: { label: 'KI-Suche', text: 'auch ChatGPT und Google AI finden Sie' },
};
const STANDARD_CHECKS = ['kein_schema', 'copyright_alt', 'kein_viewport', 'nur_boerse'];

// Genau drei Zeilen fuer die Rueckseite: in der Reihenfolge der Befunde,
// Doppelte (gleiches Label) weg, aufgefuellt aus der Standardliste – so
// antwortet die Rueckseite auf das, was vorn steht.
export function rueckChecks(befunde) {
  const codes = [...(Array.isArray(befunde) ? befunde : []).map(b => b?.code), ...STANDARD_CHECKS];
  const aus = [];
  for (const code of codes) {
    const l = LOESUNGEN[code];
    if (l && !aus.some(x => x.label === l.label)) aus.push(l);
    if (aus.length === 3) break;
  }
  return aus;
}

// Quellenzeile unter dem Kasten: womit geprueft wurde und wann – nur die
// Werkzeuge, die zu den gezeigten Befunden gehoeren. Zwei Daten, weil
// Website-Pruefung und Google-Abfrage getrennt laufen.
const QUELLE_WEBSITE = new Set(['kein_https', 'kein_viewport', 'copyright_alt', 'baukasten', 'technik_alt', 'kein_impressum', 'kein_datenschutz', 'kein_schema', 'kein_bestand', 'bestand_nur_boerse', 'langsam', 'kein_titel', 'nicht_erreichbar', 'lange_still', 'psi_schwach']);
export function datumKurz(wert) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(wert || ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}
export function quellenZeile(befunde, geprueftAm, googleStand) {
  const codes = new Set((Array.isArray(befunde) ? befunde : []).map(b => b?.code).filter(Boolean));
  if (!codes.size) return null;
  const erster = [];
  if ([...codes].some(c => QUELLE_WEBSITE.has(c))) erster.push('Ihre Website');
  if (codes.has('psi_schwach')) erster.push('Google PageSpeed');
  if (codes.has('lange_still')) erster.push('Internet-Archiv');
  if (codes.has('keine_website') || codes.has('nur_boerse')) erster.push('OpenStreetMap');
  const google = codes.has('keine_website') || codes.has('nur_boerse') || codes.has('google_note');
  const teile = [];
  if (erster.length) {
    const d = datumKurz(geprueftAm);
    teile.push(erster.join(', ') + (d ? ` (geprüft am ${d})` : ''));
  }
  if (google) {
    const d = datumKurz(googleStand);
    teile.push('Google-Karteneintrag' + (d ? ` (Stand ${d})` : ''));
  }
  return teile.length ? `Quellen: ${teile.join('; ')}.` : null;
}

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function datumDeutsch(d = new Date()) {
  return `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

// Platzhalter ersetzen. {befunde} wird zur Aufzaehlung mit Spiegelstrich;
// unbekannte Platzhalter bleiben stehen, damit man sie in der Vorschau sieht.
export function briefFuellen(vorlage, werte) {
  const w = werte || {};
  const absender = { ...ABSENDER_STANDARD, ...(w.absender || {}) };
  // Das Stichwort steht mit im Text ("– Technik: …"): so bleibt es stehen,
  // wenn der Satz dahinter von Hand geaendert wird.
  const befunde = (Array.isArray(w.befunde) ? w.befunde : [])
    .map(b => (typeof b === 'string' ? { text: b } : b)).filter(b => b?.text)
    .map(b => `– ${CHECK_LABELS[b.code] ? `${CHECK_LABELS[b.code]}: ` : ''}${b.text}`).join('\n');
  const ersatz = {
    firma: sauber(w.firma),
    ort: sauber(w.ort),
    befunde,
    link: sauber(w.link),
    link_kurz: sauber(w.link).replace(/^https?:\/\//, ''),
    absender_name: sauber(absender.name),
    absender_email: sauber(absender.email),
    absender_telefon: sauber(absender.telefon),
    datum: w.datum || datumDeutsch(),
    referenz: sauber(w.referenz),
  };
  // Leere Platzhalter-Absaetze (z. B. ohne {referenz}) hinterlassen keine Luecke.
  return String(vorlage || '').replace(/\{([a-z_]+)\}/g, (voll, name) => (name in ersatz ? ersatz[name] : voll))
    .replace(/\n{3,}/g, '\n\n');
}

// Den fertigen Text in Bloecke zerlegen – Vorschau und PDF setzen daraus
// dieselben Absaetze. Zeilen: erste nicht leere = Betreff, "– " = Listenpunkt,
// "PS:" am Absatzanfang = PS, "---" = ab hier der Hinweis in kleiner Schrift.
export function briefAufbauen(text) {
  const zeilen = String(text || '').replace(/\r/g, '').split('\n');
  let betreff = '';
  const absaetze = [];
  let hinweis = false;
  let aktuell = null;
  const schliessen = () => { if (aktuell) { absaetze.push(aktuell); aktuell = null; } };
  for (const roh of zeilen) {
    const z = roh.trim();
    if (!betreff && z) { betreff = z; continue; }
    if (z === '---') { schliessen(); hinweis = true; continue; }
    if (!z) { schliessen(); continue; }
    const punkt = /^[–\-•]\s+/.test(z);
    if (punkt) {
      if (!aktuell || aktuell.art !== 'liste') { schliessen(); aktuell = { art: 'liste', zeilen: [] }; }
      aktuell.zeilen.push(z.replace(/^[–\-•]\s+/, ''));
    } else {
      const art = hinweis ? 'hinweis' : (!aktuell && /^PS:\s/.test(z) ? 'ps' : 'text');
      if (!aktuell || aktuell.art !== art) { schliessen(); aktuell = { art, zeilen: [] }; }
      aktuell.zeilen.push(z);
    }
  }
  schliessen();
  return { betreff, absaetze };
}

// Link fuer den Brief: Basis + Token, ohne doppelten Schraegstrich.
export function landingLink(basis, token) {
  const b = String(basis || LANDING_BASIS_STANDARD).trim();
  return (b.endsWith('/') ? b : b + '/') + token;
}
