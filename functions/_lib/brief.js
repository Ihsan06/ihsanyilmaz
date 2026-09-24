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
  { name: '{absender_name}', erklaerung: 'Name aus den Absenderdaten' },
  { name: '{absender_email}', erklaerung: 'E-Mail aus den Absenderdaten' },
  { name: '{absender_telefon}', erklaerung: 'Telefon aus den Absenderdaten' },
  { name: '{datum}', erklaerung: 'heutiges Datum, z. B. 24. September 2026' },
];

// Aufbau der Vorlage: erste Zeile = Betreff. Zeilen, die mit "– " beginnen,
// werden als Aufzaehlung gesetzt. Alles unter einer Zeile "---" ist der
// Hinweis in kleiner Schrift.
export const VORLAGE_STANDARD = `Drei Punkte zu Ihrer Website

Sehr geehrte Damen und Herren,

ich bin Webentwickler in Würzburg und baue Websites für Autohäuser und Werkstätten in der Region. Beim Blick auf den Auftritt von {firma} sind mir einige Punkte aufgefallen, die Sie selbst nachprüfen können:

{befunde}

Wie eine zeitgemäße Seite für ein Autohaus aussehen kann, zeige ich Ihnen unter {link} – dort können Sie sich einen Demo-Zugang schicken lassen. Der QR-Code neben dem Link führt auf dieselbe Seite.

Wenn Sie darüber sprechen möchten, erreichen Sie mich unter {absender_telefon} oder per E-Mail an {absender_email}.

Mit freundlichen Grüßen

{absender_name}

---
Hinweis nach Art. 14 und 21 DSGVO: Ihre Firmenanschrift stammt aus OpenStreetMap, dem Google-Karteneintrag und Ihrer Website. Ich nutze sie für dieses eine Anschreiben (Art. 6 Abs. 1 f DSGVO) und gebe sie nicht weiter. Möchten Sie keine weitere Post von mir: {link}/nein aufrufen oder eine kurze Nachricht an {absender_email} senden.`;

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
  nur_boerse: () => 'Es gibt nur die Händlerseite bei mobile.de, keine eigene Website – dort entscheidet allein der Preis.',
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
    return n != null ? `Google misst die mobile Ladezeit mit ${n} von 100 Punkten.` : 'Google bewertet die mobile Ladezeit als schwach.';
  },
  baukasten: (s, p) => {
    const name = p?.baukasten || zahlAus(s.text, /Baukasten:\s*(.+)$/);
    return name ? `Die Seite läuft auf einem Baukasten (${name}); eigene Anpassungen sind dort eng begrenzt.` : 'Die Seite läuft auf einem Baukasten; eigene Anpassungen sind dort eng begrenzt.';
  },
  technik_alt: s => {
    const liste = zahlAus(s.text, /Alte Technik:\s*(.+)$/);
    return liste ? `Die Seite setzt auf ${liste} – Technik, die seit Jahren nicht mehr gepflegt wird.` : 'Die Seite setzt auf Technik, die seit Jahren nicht mehr gepflegt wird.';
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

// Fuer den Testbrief an mich, wenn der Betrieb noch keine Pruefung hat.
export const BEFUNDE_BEISPIEL = [
  { code: 'kein_https', text: SAETZE.kein_https() },
  { code: 'kein_viewport', text: SAETZE.kein_viewport() },
  { code: 'copyright_alt', text: 'Im Fuß der Seite steht © 2017.' },
];

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function datumDeutsch(d = new Date()) {
  return `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

// Platzhalter ersetzen. {befunde} wird zur Aufzaehlung mit Spiegelstrich;
// unbekannte Platzhalter bleiben stehen, damit man sie in der Vorschau sieht.
export function briefFuellen(vorlage, werte) {
  const w = werte || {};
  const absender = { ...ABSENDER_STANDARD, ...(w.absender || {}) };
  const befunde = (Array.isArray(w.befunde) ? w.befunde : [])
    .map(b => (typeof b === 'string' ? b : b?.text)).filter(Boolean)
    .map(t => `– ${t}`).join('\n');
  const ersatz = {
    firma: sauber(w.firma),
    ort: sauber(w.ort),
    befunde,
    link: sauber(w.link),
    absender_name: sauber(absender.name),
    absender_email: sauber(absender.email),
    absender_telefon: sauber(absender.telefon),
    datum: w.datum || datumDeutsch(),
  };
  return String(vorlage || '').replace(/\{([a-z_]+)\}/g, (voll, name) => (name in ersatz ? ersatz[name] : voll));
}

// Den fertigen Text in Bloecke zerlegen – Vorschau und PDF setzen daraus
// dieselben Absaetze. Zeilen: erste nicht leere = Betreff, "– " = Listenpunkt,
// "---" = ab hier der Hinweis in kleiner Schrift.
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
      const art = hinweis ? 'hinweis' : 'text';
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
