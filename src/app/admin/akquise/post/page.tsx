"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LineCapStyle, PDFDocument, PageSizes, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { ArrowLeft, ExternalLink, FileText, Maximize2, RefreshCw, Trash2, X } from "lucide-react";
import { useSeiten } from "@/components/admin/Seiten";
import AdminShell, { api, datum, euro } from "@/components/admin/AdminShell";
import { BEFUNDE_BEISPIEL, befundZeile, briefAufbauen, briefFuellen, datumDeutsch, empfaengerBlock, landingLink, quellenZeile, rueckChecks } from "../../../../../functions/_lib/brief.js";
import { LOGO_BREIT, LOGO_FARBE, LOGO_HOCH, LOGO_PFADE, LOGO_X0 } from "./briefLogo";
import SteckbriefFenster from "./Steckbrief";
import "./post.css";

// Akquise → Post: Briefe an Betriebe. Der Server (functions/api/admin/akquise/
// briefe.js) haelt Entwurf, Befunde, Text und Status; das PDF entsteht hier
// im Browser mit pdf-lib – die Function haette dafuer zu wenig CPU – und
// wird hochgeladen. Versand und Statusabfrage laufen dann ueber den Server.
//
// Layout des Blatts (mm) nach DIN 5008 Form B und den LetterXpress-Vorgaben:
// Logo oben links auf der Textkante, Absender rechtsbuendig an der rechten
// Textkante (wie das Datum), Anschriftenfeld 20/45 mm, 85 × 45 mm (nur
// Ruecksendezeile + Empfaenger),
// Text ab 98,5 mm, Raender 25/20 mm, Falzmarken 105/210 mm. Die Vorschau
// (post.css) nutzt dieselben Zahlen.

type Befund = { code: string; text: string };
// Sammelversand: Betriebe ohne verschickten Brief, wie sie die Betriebe-Liste liefert.
type SammelBetrieb = {
  id: number; name: string; ort: string | null; strasse: string | null; plz: string | null; kategorie: string | null;
  auswahl: number; google_anzahl: number | null; google_bewertung: number | null; brief_gesendet?: string | null;
  brief_entwurf?: number; geprueft_am: string | null; google_stand: string | null; geloescht?: string | null;
};
type SammelStand = { art: "laeuft" | "bereit" | "ok" | "fehler"; text: string; briefId?: number };
const SAMMEL_KAT: [string, string][] = [["auswahl", "★ Auswahl"], ["nur_boerse", "Nur Börse"], ["ohne_website", "Ohne Website"], ["veraltet", "Veraltet"], ["baukasten", "Baukasten"], ["alle", "Alle"]];
const anschriftOk = (b: SammelBetrieb) => /\d/.test(b.strasse || "") && /^\d{5}$/.test(b.plz || "") && !!(b.ort || "").trim();
type Kandidat = Befund & { punkte: number; vorgewaehlt: boolean };
type Brief = {
  id: number; betrieb_id: number; token: string; status: string; art: string;
  empfaenger: string | null; befunde: Befund[]; text: string | null; pdf_schluessel: string | null;
  anbieter: string | null; anbieter_id: string | null; kosten_cent: number | null; fehler: string | null;
  aufrufe: number; zuletzt_aufgerufen: string | null; demo_angefordert: string | null; demo_geoeffnet?: string | null;
  kontakt_erlaubt?: string | null; betrieb_telefon?: string | null;
  betrieb_kategorie?: string | null; betrieb_google_bewertung?: number | null; betrieb_google_anzahl?: number | null;
  angelegt: string; gesendet_am: string | null; zugestellt_am: string | null;
  betrieb_name?: string | null; betrieb_ort?: string | null; betrieb_status?: string | null;
  betrieb_geprueft_am?: string | null; betrieb_google_stand?: string | null;
};
type BetriebKurz = {
  id: number; name: string; strasse: string | null; plz: string | null; ort: string | null;
  website: string | null; status: string; kategorie?: string | null; geprueft_am: string | null; geloescht?: string | null;
  google_stand?: string | null; brief_gesendet?: string | null;
};
type Absender = { name: string; zusatz: string; strasse: string; plz_ort: string; telefon: string; email: string; web: string };
type Einstellungen = {
  absender: Absender; vorlage: string; vorlage_nachfass: string; referenz: string; landing_basis: string;
  platzhalter: { name: string; erklaerung: string }[];
  standard: { absender: Absender; vorlage: string; vorlage_nachfass: string; referenz: string; landing_basis: string };
};
type Zaehler = { entwurf: number; freigegeben: number; gesendet: number; zugestellt: number; fehler: number; storniert: number; aufrufe: number; demo: number; kontakt?: number; kosten_cent?: number; kosten_monat_cent?: number };
type Stand = { eingerichtet: boolean; modus: string; anbieter: string; guthaben_cent?: number; preis_cent?: number };
type Editor = { brief: Brief; betrieb: BetriebKurz | null; kandidaten: Kandidat[]; vorschau?: boolean };
type Reiter = "briefe" | "brief" | "sammel" | "zweiter" | "vorlage";
// Was links in der Vorschau steht: chip sagt, woher (Entwurf, Beispiel …).
type Schau = {
  chip: string; titel: string; text: string; empfaenger: string; absender: Absender; link: string; datumText: string; briefId?: number;
  befunde: Befund[]; geprueftAm?: string | null; googleStand?: string | null;
  token?: string; // gesetzt, sobald es die persoenliche Seite gibt (Entwurf oder Brief)
};

const STATUS_LABEL: Record<string, string> = {
  entwurf: "Entwurf", freigegeben: "Freigegeben", gesendet: "Gesendet", zugestellt: "Zugestellt", fehler: "Fehler", storniert: "Storniert",
};
const ART_LABEL: Record<string, string> = { brief: "Brief", nachfass: "Nachfass", test: "Test an mich" };
const BETRIEB_STATUS: Record<string, string> = { neu: "Neu", beobachten: "Beobachten", brief: "Brief", kontakt: "Kontakt", kunde: "Kunde", aus: "Aus" };
const KATEGORIE_LABEL: Record<string, string> = {
  ohne_website: "ohne Website", nur_boerse: "nur Börse", baukasten: "Baukasten", veraltet: "veraltet", mittel: "mittel", gepflegt: "gepflegt",
};
// Farbig, beidseitig (Vorderseite Brief, Rueckseite Demo): 1,00 € netto
// laut LetterXpress-Preisliste 02/2026, 1,19 € brutto.
const PREIS_FALLBACK = "≈ 1,19 € inkl. MwSt.";
// Solange kein echter Betrieb gewaehlt ist, zeigt die Vorschau diesen.
const BEISPIEL = { name: "Autohaus Beispiel GmbH", strasse: "Hauptstraße 1", plz: "97070", ort: "Würzburg" };
// Platzhalter fuer den Link, bevor ein Entwurf seinen Token hat.
const VORSCHAU_TOKEN = "vorschau0000";

const zahl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("de-DE"));

// Datum auf dem Blatt: bei verschickten Briefen der Versandtag.
function datumAus(wert: string | null | undefined, sonst: string) {
  if (!wert) return sonst;
  const d = new Date(wert.includes("T") ? wert : `${wert.replace(" ", "T")}Z`);
  return isNaN(d.getTime()) ? sonst : (datumDeutsch(d) as string);
}

function anschriftVollstaendig(e: string) {
  const zeilen = e.split("\n").map(z => z.trim()).filter(Boolean);
  return zeilen.length >= 3 && /^\d{5}\s+\S/.test(zeilen[zeilen.length - 1]);
}

// ------------------------------------------------------------------ PDF

// Positionen in mm. Vorderseite nach DIN 5008 Form B und LetterXpress:
// Anschriftfeld 20/45 mm, 85 × 45 mm (nur Ruecksendezeile + Empfaenger),
// Text ab 98,5 mm, Raender 25/20 mm, Falzmarken 105/210 mm. Der Handlungs-
// block mit QR-Code sitzt fest im dritten Falzfeld (241–267 mm), damit nie
// ein Knick durch den Code laeuft; der Textfluss muss davor enden (238 mm).
// Alte Briefe mit {link}-Absatz laufen weiter wie frueher (QR neben dem
// Absatz, Grenze 268 mm). Die Vorschau (post.css) nutzt dieselben Zahlen.
const LAYOUT = {
  fensterX: 20, fensterY: 45, fensterB: 85,
  textX: 25, textRechts: 20, textY: 98.5,
  falz: [105, 210], falzX: [5, 10],
  logoX: 25, logoY: 14, logoH: 15,
  portraet: { x: 172, y: 14, groesse: 18 },
  absenderY: 16, absenderYMitPortraet: 35.5, datumY: 90,
  strich: { y: 94.5, b: 10, h: 0.6 },
  betreff: { groesse: 15, zeile: 5.8, abstand: 3.5 },
  groesse: 10.5, zeile: 4.9, absatz: 2.6,
  kasten: { pad: 2.5, zwischen: 1.6, ziffernX: 29.5, labelX: 35, satzX: 68, satzBreite: 119, ohneLabelBreite: 152, radius: 1.5, kante: 1.2 },
  quelle: { abstand: 1.5, groesse: 7, zeile: 3, maxZeilen: 2 },
  unterschrift: { raum: 8, breite: 36, hoehe: 8.5, versatz: 2 },
  zusatz: { groesse: 8.5, zeile: 3.8 },
  // Der Block sitzt mittig zwischen Textende und Hinweis – aber nie ueber der
  // Falz bei 210 mm (fruehestens 213) und nie unter 241 (3,5 mm vor dem Hinweis).
  cta: { yMin: 213, yMax: 241, hoehe: 26, qr: 20, qrX: 29, qrVersatz: 3, textX: 54, textBreite: 132, linkVersatz: 4.5, scanVersatz: 10.5, scanZeile: 4.2, anrufVersatz: 20, radius: 2, linie: 0.35 },
  qrAlt: 25,
  textEnde: 238, textEndeAlt: 268,
  hinweis: { y: 270.5, groesse: 7, zeile: 3, maxZeilen: 4 },
  fussY: 285, fussGroesse: 7,
};
// Dichte-Stufen: passt der Text nicht vor den Handlungsblock (viele Befunde,
// langer Name), wird er schrittweise enger und kleiner gesetzt, statt in den
// Block zu laufen. PDF und Vorschau (post.css, data-stufe) nutzen dieselben Werte.
// g/z = Schrift/Zeile Fliesstext, a = Absatzabstand, kg/kz = Kasten, kzw =
// Abstand der Kastenzeilen, bg/bz = Betreff.
const STUFEN = [
  { g: 10.5, z: 4.9, a: 2.6, kg: 10.5, kz: 4.9, kzw: 1.6, bg: 15, bz: 5.8 },
  { g: 10.5, z: 4.9, a: 2.2, kg: 10, kz: 4.5, kzw: 1.2, bg: 15, bz: 5.8 },
  { g: 10, z: 4.6, a: 2, kg: 9.5, kz: 4.3, kzw: 1, bg: 14, bz: 5.5 },
  { g: 9.5, z: 4.4, a: 1.8, kg: 9, kz: 4.1, kzw: 0.8, bg: 13, bz: 5.2 },
];
const CTA = {
  scan: "Ihre persönliche Seite: mit der Handykamera scannen oder die Adresse eintippen. Dort finden Sie die Demo und können mit einem Klick um Kontakt bitten.",
  anrufen: "Oder anrufen:",
  teaser: "Rückseite: So kann Ihre Website aussehen »",
  // Zweiter Brief mit Website-Vorschau: der QR-Code fuehrt direkt dorthin.
  scanVorschau: "Ihre Website-Vorschau: mit der Handykamera scannen oder die Adresse eintippen. Dort können Sie mich mit einem Klick bitten, mich zu melden.",
};
const scanText = (text: string) => (/eine Vorschau gebaut|Website schon einmal vorgebaut/.test(text) ? CTA.scanVorschau : CTA.scan);
const A4_H = PageSizes.A4[1];

// Rueckseite (farbig, beidseitig gedruckt): ein Bild je Falzfeld, nichts
// ueber 105/210 mm. Screenshots der eigenen Autohaus-Demo – nie Inhalte des
// angeschriebenen Betriebs (§ 16 UrhG). Fuer den Druck aufgehellte Fassungen
// (druck-*.jpg), weil die dunkle Demo im Laserdruck sonst zulaeuft.
// Tupel: [x, y oben, Breite, Hoehe, Radius] in mm.
const RUECK = {
  titel: ["So kann Ihre", "Website aussehen"], titelY: [20, 28.5], titelGroesse: 20,
  text: "Meine Demo für das fiktive Autohaus Mustermann: Fahrzeuge mit Preisen (auf Wunsch automatisch aus mobile.de), Finanzierungsrechner, Kontakt per WhatsApp – zum Anschauen und Ausprobieren.",
  textY: 38, textBreite: 100, textGroesse: 10, textZeile: 4.8,
  checksY: [60, 68, 76],
  // Zweites Argument (der Preis steht schon vorn): ein Ansprechpartner vor Ort.
  preis: "Ein Ansprechpartner aus Würzburg – vom ersten Entwurf bis zur laufenden Pflege, ohne Agentur dazwischen.",
  preisY: 86, preisBreite: 108, preisGroesse: 9.5, preisZeile: 4.5,
  sockel: [136, 12, 54, 86, 6] as const,
  handy: { rahmen: [144.4, 16.4, 37.2, 76.9, 4.2] as const, ring: [145.6, 17.6, 34.8, 74.5, 3.2] as const, bild: [146, 18, 34, 73.7] as const },
  fenster: [34.8, 110, 140.4, 93.95, 3] as const, leiste: 6.5, punkte: [39, 42.4, 45.8], punktY: 113.25,
  pille: [62, 111.05, 86, 4.4, 2.2] as const, pilleText: "Demo · Autohaus Mustermann · Beispieldaten", pilleGroesse: 7.5,
  desktop: [36, 116.5, 138, 86.25] as const,
  // Handy mit derselben Fahrzeugliste ueber der rechten unteren Browser-Ecke –
  // wie auf ihsan-yilmaz.de unter „Smart Websites“. Unterkante 208,5 mm, bleibt
  // also vor dem Falz bei 210 mm.
  handy2: { rahmen: [151.2, 146.8, 30, 61.7, 3.6] as const, ring: [152.2, 147.8, 28, 59.7, 2.8] as const, bild: [152.6, 148.2, 27.2, 58.9] as const },
  panel: [20, 216, 170, 46, 3] as const, qrBox: [25, 221, 36, 36, 1.5] as const, qr: [29, 225, 28] as const,
  titel3: "Demo ansehen – so geht es", titel3Y: 222, schrittX: 66, textX: 72, schrittY: [229.5, 241.5, 248], linkY: 234.5,
  schritte: ["QR-Code scannen oder Adresse eingeben:", "Demo direkt ansehen – ohne Anmeldung, ohne Newsletter.", "Einfach anrufen:"],
  nameY: 255.5, nameZusatz: "Webentwickler, Würzburg",
  bilder: { handy: "/leistungen/druck-handy-start.jpg", desktop: "/leistungen/druck-web-fahrzeuge.jpg", handy2: "/leistungen/druck-handy-fahrzeuge.jpg" },
  schatten: [[0.4, 0.6], [0.8, 1.2]],
};
// Bilddateien, die nur dann aufs Blatt kommen, wenn es sie gibt.
const DATEI = { portraet: "/brief/portrait.png", unterschrift: "/brief/unterschrift.png" };

// Farben – dieselben Hex-Werte wie in post.css.
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const FARBE = {
  akzent: hex("#12557F"), dunkel: hex("#0F172A"), text: hex("#111111"), sekundaer: hex("#334155"), klein: hex("#555555"),
  grau2: hex("#64748B"), toenung: hex("#E8F0F6"), gruen: hex("#2F9E5F"), rahmen: hex("#1E293B"), ring: hex("#64748B"),
  chrom: hex("#E2E8F0"), chromRand: hex("#CBD5E1"), punkte: hex("#94A3B8"), weiss: rgb(1, 1, 1), schwarz: rgb(0, 0, 0),
};
// Abgerundetes Rechteck als SVG-Pfad (Punkte, y nach unten) fuer drawSvgPath;
// nurRechts laesst die linken Ecken eckig (Innenflaeche des Befund-Kastens).
const rund = (w: number, h: number, r: number, nurRechts = false) => (nurRechts
  ? `M 0 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H 0 Z`
  : `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`);
// Weisses Haekchen im gruenen Kreis (3,6 mm) – als Pfad, „✓“ fehlt im Schriftschnitt.
const HAKEN = "M 1.05 1.85 L 1.6 2.4 L 2.65 1.25";
const bildDaten: Record<string, Promise<ArrayBuffer>> = {};
const bildLaden = (url: string) => {
  if (!bildDaten[url]) {
    bildDaten[url] = fetch(url).then(r => { if (!r.ok) throw new Error("Demo-Bild nicht ladbar."); return r.arrayBuffer(); });
    bildDaten[url].catch(() => { delete bildDaten[url]; });
  }
  return bildDaten[url];
};
// Optionale PNGs: null, wenn es die Datei nicht gibt. Der Typ wird geprueft,
// weil ein Hosting-Fallback fuer unbekannte Pfade auch mit 200 antworten kann.
const pngDaten: Record<string, Promise<ArrayBuffer | null>> = {};
const pngLaden = (url: string) => {
  if (!pngDaten[url]) {
    pngDaten[url] = fetch(url)
      .then(r => (r.ok && (r.headers.get("content-type") || "").startsWith("image/png") ? r.arrayBuffer() : null))
      .catch(() => null);
  }
  return pngDaten[url];
};
function usePngVorhanden(url: string) {
  const [da, setDa] = useState(false);
  useEffect(() => {
    let weg = false;
    pngLaden(url).then(b => { if (!weg) setDa(!!b); });
    return () => { weg = true; };
  }, [url]);
  return da;
}
const mm = (v: number) => (v * 72) / 25.4;
const linkKurz = (link: string) => link.replace(/^https?:\/\//, "");
// Oberkante des Handlungsblocks: mittig zwischen Textende und Hinweis, in den Grenzen.
const ctaOben = (textEnde: number) => {
  const C = LAYOUT.cta;
  const mitte = textEnde + (LAYOUT.hinweis.y - textEnde - C.hoehe) / 2;
  return Math.min(C.yMax, Math.max(C.yMin, mitte));
};

// Zwei statische Schnitte von Inter als TTF (aus public/fonts/inter-latin.woff2
// mit fontTools herausgerechnet): WOFF2 liesse sich nicht als FontFile2
// einbetten, und die Variable-Font-Datei bringt fontkit beim Unterteilen aus
// dem Tritt. Einmal geladen, dann im Speicher.
const FONT_DATEIEN = { regular: "/fonts/inter-brief.ttf", semibold: "/fonts/inter-brief-semibold.ttf" };
const fontDaten: Partial<Record<keyof typeof FONT_DATEIEN, Promise<ArrayBuffer>>> = {};
function fontLaden(schnitt: keyof typeof FONT_DATEIEN) {
  if (!fontDaten[schnitt]) {
    const p = fetch(FONT_DATEIEN[schnitt]).then(r => {
      if (!r.ok) throw new Error("Schrift nicht ladbar.");
      return r.arrayBuffer();
    });
    p.catch(() => { delete fontDaten[schnitt]; });
    fontDaten[schnitt] = p;
  }
  return fontDaten[schnitt] as Promise<ArrayBuffer>;
}

type PdfDaten = {
  text: string; empfaenger: string; absender: Absender; link: string; datum: string;
  befunde: Befund[]; geprueftAm?: string | null; googleStand?: string | null;
};

// Liefert das PDF (immer zwei Seiten) und den Ueberlauf in mm: laeuft der
// Textfluss ueber die Grenze oder der Hinweis ueber vier Zeilen, wird nichts
// abgeschnitten, sondern der Aufrufer bricht ab.
async function pdfErzeugen(d: PdfDaten): Promise<{ bytes: Uint8Array; ueberlauf: number }> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // LetterXpress verlangt eingebettete Schriften – pdf-lib bettet die TTF
  // als Untermenge der benutzten Zeichen ein.
  const [regular, semibold, portraetPng, unterschriftPng, handyJpg, deskJpg, handy2Jpg] = await Promise.all([
    fontLaden("regular"), fontLaden("semibold"), pngLaden(DATEI.portraet), pngLaden(DATEI.unterschrift),
    bildLaden(RUECK.bilder.handy), bildLaden(RUECK.bilder.desktop), bildLaden(RUECK.bilder.handy2),
  ]);
  const font = await pdf.embedFont(regular, { subset: true });
  const fett = await pdf.embedFont(semibold, { subset: true });
  const bPortraet = portraetPng ? await pdf.embedPng(portraetPng).catch(() => null) : null;
  const bUnterschrift = unterschriftPng ? await pdf.embedPng(unterschriftPng).catch(() => null) : null;
  const [bHandy, bDesk, bHandy2] = await Promise.all([pdf.embedJpg(handyJpg), pdf.embedJpg(deskJpg), pdf.embedJpg(handy2Jpg)]);
  pdf.setTitle("Brief");
  pdf.setAuthor(d.absender.name);
  pdf.setLanguage("de-DE");

  const zeichenSatz = new Set(font.getCharacterSet());
  const sauber = (s: string) => Array.from(s).map(c => (zeichenSatz.has(c.codePointAt(0) ?? -1) ? c : "")).join("");
  const qr = await pdf.embedPng(await QRCode.toDataURL(d.link, { margin: 0, width: 512, errorCorrectionLevel: "M" }));
  const kurz = linkKurz(d.link);
  const a = d.absender;

  let seite: PDFPage = pdf.addPage(PageSizes.A4);
  const basis = (yTop: number, size: number) => A4_H - mm(yTop) - size * 0.78;
  const breiteVon = (t: string, size: number, f: PDFFont = font) => f.widthOfTextAtSize(sauber(t), size);
  // malen = false: nur messen (der Textfluss laeuft je Dichte-Stufe einmal zur Probe).
  let malen = true;
  const text = (t: string, xMm: number, yTop: number, size: number, f: PDFFont = font, farbe = FARBE.text) => {
    if (malen) seite.drawText(sauber(t), { x: mm(xMm), y: basis(yTop, size), size, font: f, color: farbe });
  };
  const textPt = (t: string, xPt: number, yTop: number, size: number, f: PDFFont = font, farbe = FARBE.text) => {
    if (malen) seite.drawText(sauber(t), { x: xPt, y: basis(yTop, size), size, font: f, color: farbe });
  };
  const rechts = (t: string, yTop: number, size: number, f: PDFFont = font, farbe = FARBE.text) =>
    textPt(t, mm(210 - LAYOUT.textRechts) - breiteVon(t, size, f), yTop, size, f, farbe);
  const mitte = (t: string, xMitteMm: number, yTop: number, size: number, f: PDFFont = font, farbe = FARBE.text) =>
    textPt(t, mm(xMitteMm) - breiteVon(t, size, f) / 2, yTop, size, f, farbe);
  const form = (x: number, yTop: number, w: number, h: number, r: number,
                o: { color?: ReturnType<typeof rgb>; rand?: ReturnType<typeof rgb>; randBreite?: number; opacity?: number; nurRechts?: boolean }) => {
    if (malen) seite.drawSvgPath(rund(mm(w), mm(h), mm(r), o.nurRechts), {
      x: mm(x), y: A4_H - mm(yTop), color: o.color, borderColor: o.rand, borderWidth: o.randBreite != null ? mm(o.randBreite) : undefined, opacity: o.opacity,
    });
  };
  const bild = (b: typeof bHandy, x: number, yTop: number, w: number, h: number) => {
    if (malen) seite.drawImage(b, { x: mm(x), y: A4_H - mm(yTop + h), width: mm(w), height: mm(h) });
  };
  // Zeilenumbruch mit der Schrift, in der gesetzt wird; die erste Zeile darf
  // schmaler sein (PS: mit fettem Vorsatz).
  const umbrechen = (t: string, size: number, breite: number, f: PDFFont = font, ersteBreite = breite) => {
    const zeilen: string[] = [];
    let z = "";
    for (const w of t.split(/\s+/).filter(Boolean)) {
      const probe = z ? `${z} ${w}` : w;
      if (!z || breiteVon(probe, size, f) <= (zeilen.length ? breite : ersteBreite)) z = probe;
      else { zeilen.push(z); z = w; }
    }
    if (z) zeilen.push(z);
    return zeilen;
  };
  const schatten = (x: number, yTop: number, w: number, h: number, r: number) => {
    for (const [dx, dy] of RUECK.schatten) form(x + dx, yTop + dy, w, h, r, { color: FARBE.schwarz, opacity: 0.1 });
  };

  // ---- Vorderseite: Kopf
  {
    const skala = mm(LAYOUT.logoH) / LOGO_HOCH;
    for (const pfad of LOGO_PFADE) seite.drawSvgPath(pfad, { x: mm(LAYOUT.logoX) - LOGO_X0 * skala, y: A4_H - mm(LAYOUT.logoY), scale: skala, color: FARBE.akzent });
  }
  // Rechts oben Gesicht und Visitenkarte: Name, Zusatz, Telefon, E-Mail, Web –
  // Strasse und PLZ stehen in der Ruecksendezeile und im Fuss.
  if (bPortraet) bild(bPortraet, LAYOUT.portraet.x, LAYOUT.portraet.y, LAYOUT.portraet.groesse, LAYOUT.portraet.groesse);
  {
    let y = bPortraet ? LAYOUT.absenderYMitPortraet : LAYOUT.absenderY;
    rechts(a.name, y, 10, fett, FARBE.schwarz); y += 5;
    for (const z of [a.zusatz, a.telefon, a.email, a.web].filter(Boolean)) { rechts(z, y, 8.5, font, rgb(0.13, 0.13, 0.13)); y += 4; }
  }
  for (const y of LAYOUT.falz) {
    seite.drawLine({ start: { x: mm(LAYOUT.falzX[0]), y: A4_H - mm(y) }, end: { x: mm(LAYOUT.falzX[1]), y: A4_H - mm(y) }, thickness: 0.4, color: FARBE.klein });
  }
  // Anschriftenfeld: nur Ruecksendezeile und Empfaenger.
  {
    text([a.name, a.strasse, a.plz_ort].filter(Boolean).join(" · "), LAYOUT.fensterX + 2, LAYOUT.fensterY + 1.5, 7, font, rgb(0.2, 0.2, 0.2));
    let y = LAYOUT.fensterY + 8;
    for (const z of d.empfaenger.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 6)) { text(z, LAYOUT.fensterX + 2, y, 11, font, FARBE.schwarz); y += 4.6; }
  }
  rechts(`${a.plz_ort.replace(/^\d{5}\s+/, "")}, ${d.datum}`, LAYOUT.datumY, 10, font, FARBE.schwarz);
  seite.drawRectangle({ x: mm(LAYOUT.textX), y: A4_H - mm(LAYOUT.strich.y + LAYOUT.strich.h), width: mm(LAYOUT.strich.b), height: mm(LAYOUT.strich.h), color: FARBE.akzent });

  // ---- Vorderseite: Textfluss
  const { betreff, absaetze } = briefAufbauen(d.text) as { betreff: string; absaetze: { art: string; zeilen: string[] }[] };
  const breite = mm(210 - LAYOUT.textX - LAYOUT.textRechts);
  // Alte Briefe tragen den Link im Text: dann QR neben dem Absatz, kein fester Block.
  const alt = absaetze.some(x => x.art === "text" && x.zeilen.some(z => z.includes(d.link)));
  // Der Textfluss als Funktion: je Dichte-Stufe einmal messen, dann mit der
  // ersten Stufe zeichnen, die vor dem Handlungsblock endet.
  let hinweise: string[] = [];
  const fluss = (S: typeof STUFEN[number]) => {
    const G = S.g, Z = S.z;
    let y = LAYOUT.textY;
    if (betreff) {
      for (const l of umbrechen(betreff, S.bg, breite, fett)) { text(l, LAYOUT.textX, y, S.bg, fett, FARBE.dunkel); y += S.bz; }
      y += LAYOUT.betreff.abstand;
    }
    hinweise = [];
    let namensblock = false;

    // Befund-Kasten: erst messen, dann zeichnen – der Kasten wird nie geteilt.
    const kasten = (zeilen: string[]) => {
      const K = LAYOUT.kasten;
      const info = zeilen.map(zeile => {
        const b = befundZeile(zeile, d.befunde) as { label?: string; satz: string; google: boolean };
        return { ...b, zeilen: umbrechen(b.satz, S.kg, mm(b.label ? K.satzBreite : K.ohneLabelBreite)) };
      }).sort((p, q) => Number(p.google) - Number(q.google));
      const h = 2 * K.pad + info.reduce((s, i) => s + i.zeilen.length * S.kz, 0) + (info.length - 1) * S.kzw;
      form(LAYOUT.textX, y, 165, h, K.radius, { color: FARBE.akzent });
      form(LAYOUT.textX + K.kante, y, 165 - K.kante, h, K.radius, { color: FARBE.toenung, nurRechts: true });
      let yy = y + K.pad, nr = 1;
      for (const i of info) {
        if (!i.google) text(String(nr++), K.ziffernX, yy, S.kg, fett, FARBE.akzent);
        if (i.label) text(i.label, K.labelX, yy, S.kg, fett, i.google ? FARBE.gruen : FARBE.dunkel);
        for (const l of i.zeilen) { text(l, i.label ? K.satzX : K.labelX, yy, S.kg); yy += S.kz; }
        yy += S.kzw;
      }
      y += h;
      const q = quellenZeile(d.befunde, d.geprueftAm, d.googleStand) as string | null;
      if (q) {
        y += LAYOUT.quelle.abstand;
        for (const l of umbrechen(q, LAYOUT.quelle.groesse, breite).slice(0, LAYOUT.quelle.maxZeilen)) { text(l, LAYOUT.textX, y, LAYOUT.quelle.groesse, font, FARBE.grau2); y += LAYOUT.quelle.zeile; }
      }
      y += S.a;
    };

    for (const abs of absaetze) {
      if (abs.art === "hinweis") { hinweise.push(...abs.zeilen); continue; }
      if (abs.art === "liste") { kasten(abs.zeilen); continue; }
      if (abs.art === "ps") {
        const vorsatz = "PS: ";
        const vb = breiteVon(vorsatz, G, fett);
        text("PS:", LAYOUT.textX, y, G, fett);
        umbrechen(abs.zeilen.join(" ").replace(/^PS:\s*/, ""), G, breite, font, breite - vb)
          .forEach((l, i) => { textPt(l, mm(LAYOUT.textX) + (i === 0 ? vb : 0), y, G); y += Z; });
        y += S.a;
        continue;
      }
      if (namensblock) {
        // Der Absatz nach dem Gruss: Name normal, weitere Zeilen klein und grau.
        namensblock = false;
        abs.zeilen.forEach((l, i) => {
          if (i === 0) { text(l, LAYOUT.textX, y, G); y += Z; }
          else { text(l, LAYOUT.textX, y, LAYOUT.zusatz.groesse, font, FARBE.grau2); y += LAYOUT.zusatz.zeile; }
        });
        y += S.a;
        continue;
      }
      const mitQr = alt && abs.zeilen.some(z => z.includes(d.link));
      const b = mitQr ? breite - mm(LAYOUT.qrAlt + 6) : breite;
      const zeilen = abs.zeilen.flatMap(z => umbrechen(z, G, b));
      const oben = y;
      if (mitQr && malen) seite.drawImage(qr, { x: mm(210 - LAYOUT.textRechts - LAYOUT.qrAlt), y: A4_H - mm(oben + LAYOUT.qrAlt), width: mm(LAYOUT.qrAlt), height: mm(LAYOUT.qrAlt) });
      for (const l of zeilen) { text(l, LAYOUT.textX, y, G); y += Z; }
      if (mitQr) y = Math.max(y, oben + LAYOUT.qrAlt + 3);
      if (/^Mit freundlichen Grüßen/.test(abs.zeilen[0] || "")) {
        namensblock = true;
        if (bUnterschrift) {
          const U = LAYOUT.unterschrift;
          bild(bUnterschrift, LAYOUT.textX, y + U.versatz, U.breite, U.hoehe);
          y += U.raum;
        }
      }
      y += S.a;
    }
    return y - S.a;
  };
  const grenze = alt ? LAYOUT.textEndeAlt : LAYOUT.textEnde;
  malen = false;
  let stufe = STUFEN.findIndex(S => fluss(S) <= grenze);
  if (stufe < 0) stufe = STUFEN.length - 1;
  malen = true;
  const textEnde = fluss(STUFEN[stufe]);
  let ueberlauf = Math.max(0, textEnde - grenze);

  // Handlungsblock im dritten Falzfeld – der einzige Rahmen der Seite, mittig
  // im freien Raum zwischen Textende und Hinweis.
  if (!alt) {
    const C = LAYOUT.cta;
    const cy = ctaOben(textEnde);
    form(LAYOUT.textX, cy, 165, C.hoehe, C.radius, { rand: FARBE.akzent, randBreite: C.linie });
    seite.drawImage(qr, { x: mm(C.qrX), y: A4_H - mm(cy + C.qrVersatz + C.qr), width: mm(C.qr), height: mm(C.qr) });
    text(kurz, C.textX, cy + C.linkVersatz, 12.5, fett, FARBE.dunkel);
    let yy = cy + C.scanVersatz;
    for (const l of umbrechen(scanText(d.text), 9, mm(C.textBreite)).slice(0, 2)) { text(l, C.textX, yy, 9, font, FARBE.sekundaer); yy += C.scanZeile; }
    text(`${CTA.anrufen} ${a.telefon}`, C.textX, cy + C.anrufVersatz, 10, fett, FARBE.dunkel);
  }
  // Hinweis fest unten, hoechstens vier Zeilen – mehr zaehlt als Ueberlauf.
  {
    const H = LAYOUT.hinweis;
    const zeilen = hinweise.flatMap(z => umbrechen(z, H.groesse, breite));
    if (zeilen.length > H.maxZeilen) ueberlauf += (zeilen.length - H.maxZeilen) * H.zeile;
    let yy = H.y;
    for (const l of zeilen.slice(0, H.maxZeilen)) { text(l, LAYOUT.textX, yy, H.groesse, font, FARBE.klein); yy += H.zeile; }
  }
  text([a.name, a.strasse, a.plz_ort, a.web].filter(Boolean).join(" · "), LAYOUT.textX, LAYOUT.fussY, LAYOUT.fussGroesse, font, FARBE.klein);
  rechts(CTA.teaser, LAYOUT.fussY, LAYOUT.fussGroesse, fett, FARBE.akzent);

  // ---- Rueckseite
  seite = pdf.addPage(PageSizes.A4);
  {
    // Feld 1: Titel, Text, drei Haken links – ein grosses Handy auf hellem Sockel rechts.
    const R = RUECK;
    RUECK.titel.forEach((z, i) => text(z, LAYOUT.textX, R.titelY[i], R.titelGroesse, fett, FARBE.dunkel));
    let yy = R.textY;
    for (const l of umbrechen(R.text, R.textGroesse, mm(R.textBreite))) { text(l, LAYOUT.textX, yy, R.textGroesse, font, FARBE.sekundaer); yy += R.textZeile; }
    (rueckChecks(d.befunde) as { label: string; text: string }[]).forEach((c, i) => {
      const cy = R.checksY[i];
      seite.drawCircle({ x: mm(26.8), y: A4_H - mm(cy + 1.8), size: mm(1.8), color: FARBE.gruen });
      seite.drawSvgPath(HAKEN, { x: mm(25), y: A4_H - mm(cy), scale: mm(1), borderColor: FARBE.weiss, borderWidth: 0.4, borderLineCap: LineCapStyle.Round });
      text(c.label, 31.5, cy, 10, fett, FARBE.dunkel);
      textPt(` – ${c.text}`, mm(31.5) + breiteVon(c.label, 10, fett), cy, 10, font, FARBE.sekundaer);
    });
    yy = R.preisY;
    for (const l of umbrechen(R.preis, R.preisGroesse, mm(R.preisBreite)).slice(0, 2)) { text(l, LAYOUT.textX, yy, R.preisGroesse, font, FARBE.grau2); yy += R.preisZeile; }
    form(...R.sockel, { color: FARBE.toenung });
    const [hx, hy, hw, hh, hr] = R.handy.rahmen;
    schatten(hx, hy, hw, hh, hr);
    form(hx, hy, hw, hh, hr, { color: FARBE.rahmen });
    form(...R.handy.ring, { color: FARBE.ring });
    bild(bHandy, ...R.handy.bild);

    // Feld 2: die Fahrzeugliste gross im hellen Browserfenster, davor das Handy.
    const [fx, fy, fw, fh, fr] = R.fenster;
    schatten(fx, fy, fw, fh, fr);
    form(fx, fy, fw, fh, fr, { color: FARBE.chrom, rand: FARBE.chromRand, randBreite: 0.3 });
    for (const px of R.punkte) seite.drawCircle({ x: mm(px), y: A4_H - mm(R.punktY), size: mm(0.9), color: FARBE.punkte });
    form(...R.pille, { color: FARBE.weiss, rand: FARBE.chromRand, randBreite: 0.25 });
    mitte(R.pilleText, R.pille[0] + R.pille[2] / 2, R.pille[1] + 0.95, R.pilleGroesse, fett, FARBE.sekundaer);
    bild(bDesk, ...R.desktop);
    {
      const [kx, ky, kw, kh, kr] = R.handy2.rahmen;
      schatten(kx, ky, kw, kh, kr);
      form(kx, ky, kw, kh, kr, { color: FARBE.rahmen });
      form(...R.handy2.ring, { color: FARBE.ring });
      bild(bHandy2, ...R.handy2.bild);
    }

    // Feld 3: QR, drei Schritte, Telefon.
    form(...R.panel, { color: FARBE.toenung });
    form(...R.qrBox, { color: FARBE.weiss });
    seite.drawImage(qr, { x: mm(R.qr[0]), y: A4_H - mm(R.qr[1] + R.qr[2]), width: mm(R.qr[2]), height: mm(R.qr[2]) });
    text(R.titel3, R.schrittX, R.titel3Y, 13, fett, FARBE.dunkel);
    R.schritte.forEach((s, i) => {
      text(String(i + 1), R.schrittX, R.schrittY[i], 9.5, fett, FARBE.akzent);
      if (i === 2) text(`${s} ${a.telefon}`, R.textX, R.schrittY[i], 10, fett, FARBE.dunkel);
      else text(s, R.textX, R.schrittY[i], 9.5, font, FARBE.sekundaer);
    });
    text(kurz, R.textX, R.linkY, 11, fett, FARBE.akzent);
    text(`${a.name} · ${R.nameZusatz}`, R.textX, R.nameY, 8, font, FARBE.grau2);
    text([a.name, a.strasse, a.plz_ort, a.telefon, a.email, a.web].filter(Boolean).join(" · "), LAYOUT.textX, LAYOUT.fussY, LAYOUT.fussGroesse, font, FARBE.klein);
  }

  // Ohne Objektstroeme: der Server zaehlt die Seiten im PDF (farbig und
  // beidseitig ab zwei Seiten).
  return { bytes: await pdf.save({ useObjectStreams: false }), ueberlauf: Math.round(ueberlauf) };
}

// ------------------------------------------------------------------ Bausteine

function Zahl({ titel, wert, unter, warnung, hervor }: { titel: string; wert: string; unter?: string; warnung?: boolean; hervor?: boolean }) {
  return (
    <div className={`post-zahl${warnung ? " warnung" : ""}${hervor ? " hervor" : ""}`}>
      <p className="post-zahl-titel">{titel}</p>
      <p className="post-zahl-wert">{wert}</p>
      {unter && <p className="post-zahl-unter">{unter}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`post-status ${status}`}>{STATUS_LABEL[status] || status}</span>;
}

// Das Blatt in der Vorschau – dieselbe Blocklogik und dieselben Positionen
// wie im PDF (post.css). Meldet den Ueberlauf des Textflusses in mm.
function Blatt({ text, empfaenger, absender, link, datumText, qr, befunde, geprueftAm, googleStand, onUeberlauf }: {
  text: string; empfaenger: string; absender: Absender; link: string; datumText: string; qr: string;
  befunde: Befund[]; geprueftAm?: string | null; googleStand?: string | null; onUeberlauf?: (mm: number) => void;
}) {
  const huelle = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const hinweisRef = useRef<HTMLParagraphElement>(null);
  const [skala, setSkala] = useState(0.5);
  const [ctaTop, setCtaTop] = useState(LAYOUT.cta.yMax);
  const portraet = usePngVorhanden(DATEI.portraet);
  const unterschrift = usePngVorhanden(DATEI.unterschrift);
  useEffect(() => {
    const el = huelle.current;
    if (!el) return;
    const messen = () => setSkala(Math.max(0.2, (el.clientWidth - 28) / (210 * 96 / 25.4)));
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { betreff, absaetze } = briefAufbauen(text) as { betreff: string; absaetze: { art: string; zeilen: string[] }[] };
  const alt = absaetze.some(x => x.art === "text" && x.zeilen.some(z => z.includes(link)));
  const hinweise = absaetze.filter(x => x.art === "hinweis").flatMap(x => x.zeilen);
  const quelle = quellenZeile(befunde, geprueftAm, googleStand) as string | null;
  const ort = absender.plz_ort.replace(/^\d{5}\s+/, "");

  // Ueberlauf wie im PDF: Ende des Textflusses gegen die Grenze, Hinweis gegen vier Zeilen.
  const zuletzt = useRef(-1);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const messen = () => {
      const px = 96 / 25.4;
      // Dichte-Stufe wie im PDF: die erste, bei der der Text vor dem Block endet.
      // Das Attribut setzt nur dieser Effekt (nicht React), darum bleibt es stehen.
      const blatt = el.parentElement as HTMLElement;
      const grenzePx = ((alt ? LAYOUT.textEndeAlt : LAYOUT.textEnde) - LAYOUT.textY) * px;
      for (let i = 0; i < STUFEN.length; i++) {
        blatt.dataset.stufe = String(i);
        if (el.offsetHeight <= grenzePx) break;
      }
      const ende = LAYOUT.textY + el.offsetHeight / px;
      const hinweisMm = hinweisRef.current ? hinweisRef.current.offsetHeight / px : 0;
      const wert = Math.round(Math.max(0, ende - (alt ? LAYOUT.textEndeAlt : LAYOUT.textEnde)) + Math.max(0, hinweisMm - LAYOUT.hinweis.maxZeilen * LAYOUT.hinweis.zeile));
      setCtaTop(Math.round(ctaOben(ende) * 10) / 10);
      if (onUeberlauf && wert !== zuletzt.current) { zuletzt.current = wert; onUeberlauf(wert); }
    };
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    if (hinweisRef.current) ro.observe(hinweisRef.current);
    return () => ro.disconnect();
  }, [text, alt, onUeberlauf]);

  // Der Textabsatz nach dem Gruss ist der Namensblock (Name, darunter klein der Zusatz).
  const istGruss = (a?: { art: string; zeilen: string[] }) => !!a && a.art === "text" && /^Mit freundlichen Grüßen/.test(a.zeilen[0] || "");
  const namensblockIdx = absaetze.findIndex((a, i) => i > 0 && a.art === "text" && istGruss(absaetze[i - 1]));
  /* eslint-disable @next/next/no-img-element -- Daten-URL und Vorschaubilder im skalierten Blatt, next/image bringt hier nichts */
  return (
    <div ref={huelle} className="post-blatt-huelle" style={{ height: (297 * 2 + 12) * 96 / 25.4 * skala + 28 }}>
      <div className="post-blatt-skala" style={{ transform: `scale(${skala})` }}>
        <div className="post-blatt" aria-label="Vorschau des Briefs">
          <svg className="post-b-logo" viewBox={`${LOGO_X0} 0 ${LOGO_BREIT} ${LOGO_HOCH}`} style={{ height: `${LAYOUT.logoH}mm`, left: `${LAYOUT.logoX}mm`, top: `${LAYOUT.logoY}mm` }}
               fill={LOGO_FARBE} aria-label="AIY Ihsan Yilmaz" role="img">
            {LOGO_PFADE.map((d, i) => <path key={i} d={d} />)}
          </svg>
          {portraet && <img className="post-b-portraet" src={DATEI.portraet} alt="" />}
          <div className={`post-b-absender${portraet ? " mit-portraet" : ""}`}>
            <b>{absender.name}</b>
            {[absender.zusatz, absender.telefon, absender.email, absender.web].filter(Boolean).map((z, i) => <div key={i}>{z}</div>)}
          </div>
          <div className="post-b-fenster">
            <div className="post-b-ruecksende">{[absender.name, absender.strasse, absender.plz_ort].filter(Boolean).join(" · ")}</div>
            <div className="post-b-anschrift">{empfaenger}</div>
          </div>
          {LAYOUT.falz.map(y => <div key={y} className="post-b-falz" style={{ top: `${y}mm` }} />)}
          <div className="post-b-datum">{ort}, {datumText}</div>
          <i className="post-b-strich" aria-hidden="true" />
          <div className="post-b-text" ref={textRef}>
            {betreff && <p className="post-b-betreff">{betreff}</p>}
            {absaetze.map((a, i) => {
              if (a.art === "hinweis") return null;
              if (a.art === "liste") {
                let nr = 0;
                const zeilen = a.zeilen.map(z => befundZeile(z, befunde) as { label?: string; satz: string; google: boolean })
                  .sort((p, q) => Number(p.google) - Number(q.google));
                return (
                  <div key={i}>
                    <div className="post-b-kasten">
                      <i className="kante" aria-hidden="true" />
                      {zeilen.map((z, j) => (
                        <React.Fragment key={j}>
                          <span className="ziffer">{z.google ? "" : ++nr}</span>
                          {z.label ? <span className={`label${z.google ? " gruen" : ""}`}>{z.label}</span> : null}
                          <span className={`satz${z.label ? "" : " breit"}`}>{z.satz}</span>
                        </React.Fragment>
                      ))}
                    </div>
                    {quelle && <p className="post-b-quelle">{quelle}</p>}
                  </div>
                );
              }
              if (a.art === "ps") return <p key={i} className="post-b-ps"><b>PS:</b> {a.zeilen.join(" ").replace(/^PS:\s*/, "")}</p>;
              if (i === namensblockIdx) {
                return <p key={i} className="post-b-name">{a.zeilen[0]}{a.zeilen.slice(1).map((z, j) => <span key={j} className="post-b-zusatz">{z}</span>)}</p>;
              }
              const gruss = istGruss(a);
              const mitQr = alt && a.zeilen.some(z => z.includes(link));
              return (
                <React.Fragment key={i}>
                  <p className={`post-b-absatz${mitQr ? " mit-qr" : ""}`}>
                    {a.zeilen.join(" ")}
                    {mitQr && qr && <span className="post-b-qr"><img src={qr} alt="QR-Code zum Link" /></span>}
                  </p>
                  {gruss && unterschrift && <div className="post-b-unterschrift"><img src={DATEI.unterschrift} alt="Unterschrift" /></div>}
                </React.Fragment>
              );
            })}
          </div>
          {!alt && (
            <div className="post-b-cta" style={{ top: `${ctaTop}mm` }}>
              {qr && <img className="qr" src={qr} alt="QR-Code zum Link" />}
              <div className="text">
                <b className="link">{linkKurz(link)}</b>
                <p className="scan">{scanText(text)}</p>
                <b className="anruf">{CTA.anrufen} {absender.telefon}</b>
              </div>
            </div>
          )}
          {hinweise.length > 0 && <p className="post-b-hinweis" ref={hinweisRef}>{hinweise.join(" ")}</p>}
          <div className="post-b-fuss">
            <span>{[absender.name, absender.strasse, absender.plz_ort, absender.web].filter(Boolean).join(" · ")}</span>
            <span className="post-b-teaser">{CTA.teaser}</span>
          </div>
        </div>
        <Rueckseite link={link} qr={qr} absender={absender} befunde={befunde} />
      </div>
    </div>
  );
  /* eslint-enable @next/next/no-img-element */
}

// Rueckseite in der Vorschau – Positionen wie im PDF (RUECK).
function Rueckseite({ link, qr, absender, befunde }: { link: string; qr: string; absender: Absender; befunde: Befund[] }) {
  const pos = (t: readonly number[]): React.CSSProperties => ({ left: `${t[0]}mm`, top: `${t[1]}mm`, width: `${t[2]}mm`, height: `${t[3]}mm` });
  const checks = rueckChecks(befunde) as { label: string; text: string }[];
  const R = RUECK;
  /* eslint-disable @next/next/no-img-element -- Vorschaubilder im skalierten Blatt */
  return (
    <>
      <p className="post-b-seitenmarke">Rückseite · farbig</p>
      <div className="post-blatt post-rueck" aria-label="Vorschau der Rückseite">
        <p className="post-r-titel">{R.titel[0]}<br />{R.titel[1]}</p>
        <p className="post-r-absatz">{R.text}</p>
        <p className="post-r-preis">{R.preis}</p>
        <ul className="post-r-checks">
          {checks.map(c => (
            <li key={c.label}>
              <i aria-hidden="true"><svg viewBox="0 0 3.6 3.6"><path d={HAKEN} fill="none" stroke="#fff" strokeWidth="0.4" strokeLinecap="round" strokeLinejoin="round" /></svg></i>
              <b>{c.label}</b> – {c.text}
            </li>
          ))}
        </ul>
        <div className="post-r-sockel" style={pos(R.sockel)} />
        <div className="post-r-handy" style={pos(R.handy.rahmen)}><img src={R.bilder.handy} alt="" /></div>
        <div className="post-r-browser" style={pos(R.fenster)}>
          <span className="post-r-leiste"><i /><i /><i /></span>
          <span className="post-r-pille">{R.pilleText}</span>
          <img src={R.bilder.desktop} alt="" />
        </div>
        <div className="post-r-handy klein" style={pos(R.handy2.rahmen)}><img src={R.bilder.handy2} alt="" /></div>
        <div className="post-r-panel" style={pos(R.panel)} />
        <div className="post-r-qrbox" style={pos(R.qrBox)}>{qr && <img src={qr} alt="QR-Code zum Link" />}</div>
        <p className="post-r-titel3">{R.titel3}</p>
        {R.schritte.map((s, i) => (
          <p key={s} className={`post-r-schritt${i === 2 ? " post-r-anruf" : ""}`} style={{ top: `${R.schrittY[i]}mm` }}>
            <span className="ziffer">{i + 1}</span>{i === 2 ? `${s} ${absender.telefon}` : s}
          </p>
        ))}
        <b className="post-r-link">{linkKurz(link)}</b>
        <p className="post-r-name">{absender.name} · {R.nameZusatz}</p>
        <div className="post-b-fuss"><span>{[absender.name, absender.strasse, absender.plz_ort, absender.telefon, absender.email, absender.web].filter(Boolean).join(" · ")}</span></div>
      </div>
    </>
  );
  /* eslint-enable @next/next/no-img-element */
}

// Die Vorschau gross, ueber der Seite – Klick daneben oder Esc schliesst.
function GrossAnsicht({ schau, qr, onZu }: { schau: Schau; qr: string; onZu: () => void }) {
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [onZu]);
  return (
    <div className="post-gross" role="dialog" aria-modal="true" aria-label="Vorschau groß" onClick={onZu}>
      <div className="post-gross-blatt" onClick={e => e.stopPropagation()}>
        <button type="button" className="post-gross-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button>
        <Blatt text={schau.text} empfaenger={schau.empfaenger} absender={schau.absender} link={schau.link} datumText={schau.datumText} qr={qr}
               befunde={schau.befunde} geprueftAm={schau.geprueftAm} googleStand={schau.googleStand} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Seite

export default function PostSeite() {
  const [reiter, setReiter] = useState<Reiter>("briefe");
  // Sammelversand
  const [sammel, setSammel] = useState<SammelBetrieb[]>([]);
  const [sammelKat, setSammelKat] = useState("auswahl");
  const [haken, setHaken] = useState<Set<number>>(new Set());
  const [sammelStand, setSammelStand] = useState<Record<number, SammelStand>>({});
  const [sammelLauf, setSammelLauf] = useState(false);
  const sammelVorwahl = useRef<{ kat: string; alle: boolean } | null>(null);
  const [fehler, setFehler] = useState("");
  const [meldung, setMeldung] = useState("");
  const [briefe, setBriefe] = useState<Brief[]>([]);
  const [zaehler, setZaehler] = useState<Zaehler | null>(null);
  const [stand, setStand] = useState<Stand | null>(null);
  const [einst, setEinst] = useState<Einstellungen | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [beschaeftigt, setBeschaeftigt] = useState<Set<number>>(new Set());

  // Neuer Brief
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<BetriebKurz[]>([]);
  const sucheTippen = (v: string) => { setSuche(v); if (v.trim().length < 2) setTreffer([]); };
  const [gewaehlt, setGewaehlt] = useState<BetriebKurz | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [text, setText] = useState("");
  const [empf, setEmpf] = useState("");
  const [qrStand, setQrStand] = useState<{ link: string; url: string } | null>(null);
  const [pdfLauf, setPdfLauf] = useState(false);
  // Vorschau: Befunde zum gewaehlten Betrieb (noch ohne Entwurf), gewaehlte
  // Zeile der Briefliste, grosse Ansicht.
  const [gewaehltInfo, setGewaehltInfo] = useState<{
    id: number; kandidaten: Kandidat[]; gesperrt: boolean; offenerEntwurf: number | null; verschickt: number; zuletztGesendet: string | null;
  } | null>(null);
  const [vorschauId, setVorschauId] = useState<number | null>(null);
  // Zaehler: nach Anlegen oder Loeschen eines Briefs die Infos zum gewaehlten Betrieb neu holen.
  const [infoRunde, setInfoRunde] = useState(0);
  const [gross, setGross] = useState(false);
  const [heute] = useState(() => datumDeutsch(new Date()) as string);
  const [heuteIso] = useState(() => new Date().toISOString().slice(0, 10));
  // Meldung der Vorschau: Textfluss laeuft ueber die Grenze (mm) – sperrt PDF und Freigabe.
  const [ueberlauf, setUeberlauf] = useState(0);
  // Vorschau links: das Blatt oder die persoenliche Seite (nur mit Token).
  const [schauArt, setSchauArt] = useState<"brief" | "seite">("brief");
  // Rueckweg zur Betriebe-Liste (gesetzt beim Klick auf „Brief vorbereiten“).
  const [rueckweg, setRueckweg] = useState<{ url: string; id: number; name: string } | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => {
      try {
        const r = JSON.parse(sessionStorage.getItem("akquise.rueckweg") || "null");
        if (r && typeof r.url === "string" && r.url.startsWith("/admin/akquise") && Number.isInteger(r.id)) setRueckweg(r);
      } catch { /* kein Rueckweg */ }
    });
  }, []);

  // Vorlage (Absender und Link-Basis kommen aus den Einstellungen, nicht mehr bearbeitbar)
  const [absenderForm, setAbsenderForm] = useState<Absender | null>(null);
  const [vorlageForm, setVorlageForm] = useState("");
  const [nachfassForm, setNachfassForm] = useState("");
  const [referenzForm, setReferenzForm] = useState("");
  const [vorlageArt, setVorlageArt] = useState<"brief" | "nachfass">("brief");
  const [basisForm, setBasisForm] = useState("");


  const zeigeFehler = (e: unknown, sonst = "Ging nicht.") => setFehler(e instanceof Error ? e.message : sonst);

  const ladeBriefe = useCallback(() =>
    api("/api/admin/akquise/briefe").then(d => { setBriefe(d.briefe || []); setZaehler(d.zaehler || null); }).catch(zeigeFehler), []);
  const ladeStand = useCallback(() =>
    api("/api/admin/akquise/briefe?stand=1").then(d => setStand(d as Stand)).catch(() => setStand(null)), []);
  const ladeEinstellungen = useCallback(() =>
    api("/api/admin/akquise/post-einstellungen").then(d => {
      const e = d as Einstellungen;
      setEinst(e); setAbsenderForm(e.absender); setVorlageForm(e.vorlage); setNachfassForm(e.vorlage_nachfass); setReferenzForm(e.referenz || ""); setBasisForm(e.landing_basis);
    }).catch(zeigeFehler), []);

  useEffect(() => {
    // Reiter und vorgewaehlter Betrieb aus der Adresse (?tab=, ?betrieb=) –
    // erst nach dem Laden, nicht synchron im Effekt.
    const p = new URLSearchParams(window.location.search);
    const tab = p.get("tab") as Reiter | null;
    const betriebId = Number(p.get("betrieb"));
    // Von „Betriebe → Briefe an Auswahl“: Gruppe setzen und alles anhaken.
    const kat = p.get("kat");
    if (kat && SAMMEL_KAT.some(([k]) => k === kat)) sammelVorwahl.current = { kat, alle: p.get("alle") === "1" };
    Promise.all([ladeBriefe(), ladeStand(), ladeEinstellungen()]).then(() => {
      if (sammelVorwahl.current) setSammelKat(sammelVorwahl.current.kat);
      if (tab && ["briefe", "brief", "sammel", "zweiter", "vorlage"].includes(tab)) setReiter(tab);
      if (betriebId) setReiter("brief");
    }).finally(() => setLaedt(false));
    if (betriebId) {
      api("/api/admin/akquise/betriebe").then(d => {
        const b = (d.betriebe || []).find((x: BetriebKurz) => x.id === betriebId);
        if (b) setGewaehlt(b);
      }).catch(() => {});
    }
  }, [ladeBriefe, ladeStand, ladeEinstellungen]);

  // Betriebssuche, leicht verzoegert
  useEffect(() => {
    const q = suche.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      api(`/api/admin/akquise/betriebe?suche=${encodeURIComponent(q)}`)
        .then(d => setTreffer(((d.betriebe || []) as BetriebKurz[]).filter(b => !b.geloescht).slice(0, 15)))
        .catch(() => setTreffer([]));
    }, 300);
    return () => clearTimeout(t);
  }, [suche]);

  const link = useMemo(() => (editor && einst ? landingLink(einst.landing_basis, editor.brief.token) : ""), [editor, einst]);

  // Befunde fuer den gewaehlten Betrieb – dieselben, die ein Entwurf bekaeme.
  const gewaehltId = gewaehlt?.id;
  useEffect(() => {
    if (!gewaehltId) return;
    let weg = false;
    api(`/api/admin/akquise/briefe?kandidaten=${gewaehltId}`)
      .then(d => { if (!weg) setGewaehltInfo({
        id: gewaehltId, kandidaten: d.kandidaten || [], gesperrt: !!d.gesperrt,
        offenerEntwurf: d.offener_entwurf ?? null, verschickt: Number(d.verschickt || 0), zuletztGesendet: d.zuletzt_gesendet ?? null,
      }); })
      .catch(() => { if (!weg) setGewaehltInfo({ id: gewaehltId, kandidaten: [], gesperrt: false, offenerEntwurf: null, verschickt: 0, zuletztGesendet: null }); });
    return () => { weg = true; };
  }, [gewaehltId, infoRunde]);
  const infoZuGewaehlt = gewaehltInfo && gewaehltInfo.id === gewaehltId ? gewaehltInfo : null;

  const sichtbar = useMemo(() => briefe.filter(b => statusFilter === "alle" || b.status === statusFilter), [briefe, statusFilter]);
  // 50 je Seite, Zahlen unten (src/components/admin/Seiten.tsx).
  const { aufSeite: briefeAufSeite, leiste: briefeSeiten } = useSeiten(sichtbar, {
    speicher: "post.seitengroesse", filterSchluessel: statusFilter, standard: 50, nachOben: ".post-briefe",
  });

  // Was die Vorschau links zeigt – je nach Reiter: den offenen Entwurf (live),
  // den Entwurf, der fuer den gewaehlten Betrieb entstuende, die Vorlage mit
  // Beispielbetrieb (live), den gewaehlten Brief der Liste oder ein Beispiel.
  const schau = useMemo<Schau | null>(() => {
    if (!einst) return null;
    const beispiel = (vorlage: string, absender: Absender, basis: string, chip: string, referenz = einst.referenz): Schau => {
      const l = landingLink(basis, VORSCHAU_TOKEN);
      return {
        chip, titel: BEISPIEL.name, absender, link: l, datumText: heute, empfaenger: empfaengerBlock(BEISPIEL) as string,
        text: briefFuellen(vorlage, { firma: BEISPIEL.name, ort: BEISPIEL.ort, befunde: BEFUNDE_BEISPIEL, link: l, absender, datum: heute, referenz }) as string,
        befunde: BEFUNDE_BEISPIEL as Befund[], geprueftAm: heuteIso, googleStand: heuteIso,
      };
    };
    if (reiter === "vorlage" && absenderForm) {
      return beispiel(vorlageArt === "nachfass" ? nachfassForm : vorlageForm, absenderForm, basisForm,
        vorlageArt === "nachfass" ? "Vorlage zweiter Brief" : "Vorlage", referenzForm);
    }
    if (reiter === "brief" && editor) {
      return {
        chip: STATUS_LABEL[editor.brief.status] || editor.brief.status,
        titel: editor.brief.art === "test" ? "Testbrief an mich" : editor.betrieb?.name || editor.brief.betrieb_name || "",
        text, empfaenger: empf, absender: einst.absender, link, datumText: heute,
        befunde: editor.brief.befunde, geprueftAm: editor.betrieb?.geprueft_am, googleStand: editor.betrieb?.google_stand,
        token: editor.brief.token,
      };
    }
    if (reiter === "brief" && gewaehlt) {
      const l = landingLink(einst.landing_basis, VORSCHAU_TOKEN);
      const befunde: Befund[] = infoZuGewaehlt ? infoZuGewaehlt.kandidaten.filter(k => k.vorgewaehlt).map(k => ({ code: k.code, text: k.text })) : [];
      return {
        chip: infoZuGewaehlt ? "Noch kein Entwurf" : "Lädt …", titel: gewaehlt.name, absender: einst.absender, link: l, datumText: heute,
        empfaenger: empfaengerBlock(gewaehlt) as string,
        text: briefFuellen(infoZuGewaehlt?.verschickt ? einst.vorlage_nachfass : einst.vorlage,
          { firma: gewaehlt.name, ort: gewaehlt.ort, befunde, link: l, absender: einst.absender, datum: heute, referenz: einst.referenz }) as string,
        befunde, geprueftAm: gewaehlt.geprueft_am, googleStand: gewaehlt.google_stand,
      };
    }
    if (reiter === "briefe") {
      const b = sichtbar.find(x => x.id === vorschauId) || sichtbar[0];
      if (b) {
        return {
          chip: STATUS_LABEL[b.status] || b.status, titel: b.betrieb_name || `Betrieb ${b.betrieb_id}`, briefId: b.id,
          text: b.text || "", empfaenger: b.empfaenger || "", absender: einst.absender,
          link: landingLink(einst.landing_basis, b.token), datumText: datumAus(b.gesendet_am, heute),
          befunde: b.befunde || [], geprueftAm: b.betrieb_geprueft_am, googleStand: b.betrieb_google_stand,
          token: b.token,
        };
      }
    }
    return beispiel(einst.vorlage, einst.absender, einst.landing_basis, "Beispiel");
  }, [einst, reiter, absenderForm, vorlageForm, nachfassForm, referenzForm, vorlageArt, basisForm, editor, text, empf, link, gewaehlt, infoZuGewaehlt, sichtbar, vorschauId, heute, heuteIso]);

  // QR-Code zum Link der Vorschau – gespeichert mit dem Link, zu dem er
  // gehoert, damit nach einem Wechsel nie der alte Code neben dem neuen steht.
  const schauLink = schau?.link || "";
  useEffect(() => {
    if (!schauLink) return;
    let weg = false;
    QRCode.toDataURL(schauLink, { margin: 0, width: 256, errorCorrectionLevel: "M" })
      .then(url => { if (!weg) setQrStand({ link: schauLink, url }); }).catch(() => {});
    return () => { weg = true; };
  }, [schauLink]);
  const qr = qrStand && qrStand.link === schauLink ? qrStand.url : "";
  const grossZu = useCallback(() => setGross(false), []);

  // Vorschau-Spalte: zwei A4-Seiten sind hoeher als das Fenster. Statt sie
  // abzuschneiden, klebt die Spalte mit negativem Abstand – beim Scrollen
  // laeuft sie erst mit, bis ihr Ende sichtbar ist, und bleibt dann stehen.
  // So sind Vorder- und Rueckseite ganz zu sehen.
  const schauRef = useRef<HTMLElement>(null);
  const mitSchau = schau != null;
  useEffect(() => {
    const el = schauRef.current;
    if (!el) return;
    const setzen = () => { el.style.top = `${Math.min(16, window.innerHeight - el.offsetHeight - 16)}px`; };
    setzen();
    const ro = new ResizeObserver(setzen);
    ro.observe(el);
    window.addEventListener("resize", setzen);
    return () => { ro.disconnect(); window.removeEventListener("resize", setzen); };
  }, [mitSchau]);

  const editorSetzen = (e: Editor | null) => {
    setEditor(e);
    setText(e?.brief.text || "");
    setEmpf(e?.brief.empfaenger || "");
  };
  const briefInListe = (b: Brief) => setBriefe(l => {
    const alt = l.find(x => x.id === b.id);
    const neu = { ...alt, ...b };
    return alt ? l.map(x => (x.id === b.id ? neu : x)) : [neu, ...l];
  });
  const briefUebernehmen = (b: Brief) => {
    briefInListe(b);
    setEditor(e => (e && e.brief.id === b.id ? { ...e, brief: { ...e.brief, ...b } } : e));
    ladeBriefe();
  };

  const mitSperre = async (id: number, fn: () => Promise<void>) => {
    setBeschaeftigt(s => new Set(s).add(id));
    setFehler(""); setMeldung("");
    try { await fn(); } catch (e) { zeigeFehler(e); }
    finally { setBeschaeftigt(s => { const n = new Set(s); n.delete(id); return n; }); }
  };

  // ---- Aktionen

  const entwurfAnlegen = async (betrieb: BetriebKurz, art: string) => {
    setFehler("");
    try {
      const d = await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ betrieb_id: betrieb.id, art }) });
      editorSetzen({ brief: d.brief, betrieb: d.betrieb, kandidaten: d.kandidaten || [], vorschau: !!d.vorschau });
      setReiter("brief");
      if (art === "nachfass") ladeVorschauen();
      window.scrollTo({ top: 0 });
      ladeBriefe();
      setInfoRunde(n => n + 1);
    } catch (e) { zeigeFehler(e); }
  };

  // ---- Zweiter Brief: wer auf den ersten Brief reagiert hat (Seite geoeffnet,
  // Demo angesehen oder Kontakt erlaubt) – je Betrieb der erste Brief mit
  // Reaktion und, falls schon vorhanden, der zweite Brief danach.
  const zweite = useMemo(() => {
    const eigene = briefe.filter(b => b.art !== "test");
    const reagiert = eigene.filter(b => ["gesendet", "zugestellt"].includes(b.status)
      && (b.aufrufe > 0 || b.demo_geoeffnet || b.demo_angefordert || b.kontakt_erlaubt));
    const jeBetrieb = new Map<number, Brief>();
    for (const b of reagiert) {
      const alt = jeBetrieb.get(b.betrieb_id);
      if (!alt || (alt.gesendet_am || "") > (b.gesendet_am || "")) jeBetrieb.set(b.betrieb_id, b);
    }
    return [...jeBetrieb.values()].map(erster => {
      const folge = eigene
        .filter(x => x.betrieb_id === erster.betrieb_id && x.id !== erster.id && x.angelegt > (erster.gesendet_am || erster.angelegt) && x.status !== "storniert")
        .sort((a, b) => (b.angelegt > a.angelegt ? 1 : -1))[0] || null;
      const waerme = (erster.kontakt_erlaubt ? 1000 : 0) + (erster.demo_geoeffnet || erster.demo_angefordert ? 100 : 0) + Math.min(erster.aufrufe, 50);
      return { erster, folge, waerme };
    }).sort((a, b) => b.waerme - a.waerme || ((b.erster.zuletzt_aufgerufen || "") > (a.erster.zuletzt_aufgerufen || "") ? 1 : -1));
  }, [briefe]);
  const zweiteOffen = zweite.filter(z => !z.folge && !z.erster.kontakt_erlaubt).length;

  // Website-Vorschauen je Betrieb (gebaut unter „Zweiter Brief“).
  type VorschauKurz = { betrieb_id: number; modell: string | null; erstellt: string; ablauf: string; aufrufe: number; zuletzt_aufgerufen: string | null; gueltig: number };
  const [vorschauen, setVorschauen] = useState<Record<number, VorschauKurz>>({});
  const [steckbrief, setSteckbrief] = useState<{ id: number; name: string; token: string } | null>(null);
  const steckbriefZu = useCallback(() => setSteckbrief(null), [setSteckbrief]);
  const ladeVorschauen = useCallback(() => api("/api/admin/akquise/vorschau")
    .then(d => setVorschauen(Object.fromEntries(((d.vorschauen || []) as VorschauKurz[]).map(v => [v.betrieb_id, v]))))
    .catch(() => {}), []);
  useEffect(() => { if (reiter === "zweiter") ladeVorschauen(); }, [reiter, ladeVorschauen]);

  const briefOeffnen = async (id: number) => {
    setFehler("");
    try {
      const d = await api(`/api/admin/akquise/briefe?id=${id}`);
      editorSetzen({ brief: d.brief, betrieb: d.betrieb, kandidaten: d.kandidaten || [], vorschau: !!d.vorschau });
      setReiter("brief");
      if (d.brief?.art === "nachfass") ladeVorschauen();
      window.scrollTo({ top: 0 });
    } catch (e) { zeigeFehler(e); }
  };

  const patch = async (id: number, aenderung: Record<string, unknown>) => {
    const d = await api("/api/admin/akquise/briefe", { method: "PATCH", body: JSON.stringify({ id, ...aenderung }) });
    briefUebernehmen(d.brief);
    return d.brief as Brief;
  };

  const textAusVorlage = (befunde: Befund[]) => {
    if (!editor || !einst) return "";
    return briefFuellen(editor.brief.art === "nachfass" ? einst.vorlage_nachfass : einst.vorlage, {
      firma: editor.betrieb?.name || editor.brief.betrieb_name || "", ort: editor.betrieb?.ort || "",
      befunde, link, absender: einst.absender, datum: datumDeutsch(new Date()), referenz: einst.referenz, vorschau: !!editor.vorschau,
    }) as string;
  };

  const befundUmschalten = async (code: string) => {
    if (!editor) return;
    const codes = new Set(editor.brief.befunde.map(b => b.code));
    if (codes.has(code)) codes.delete(code); else codes.add(code);
    const befunde = editor.kandidaten.filter(k => codes.has(k.code)).map(k => ({ code: k.code, text: k.text }));
    const neuerText = textAusVorlage(befunde);
    setText(neuerText);
    await mitSperre(editor.brief.id, async () => { await patch(editor.brief.id, { befunde, text: neuerText }); });
  };

  const textSpeichern = async () => {
    if (!editor || text === (editor.brief.text || "")) return;
    await mitSperre(editor.brief.id, async () => { await patch(editor.brief.id, { text }); });
  };
  const empfSpeichern = async () => {
    if (!editor || empf.trim() === (editor.brief.empfaenger || "").trim()) return;
    await mitSperre(editor.brief.id, async () => { await patch(editor.brief.id, { empfaenger: empf }); });
  };

  const pdfBauen = async () => {
    if (!editor || !einst) return;
    setPdfLauf(true); setFehler(""); setMeldung("");
    try {
      // Erst offene Aenderungen sichern: der Server verwirft bei geaendertem
      // Text das alte PDF – kaeme das PATCH nach dem Upload an, waere das
      // frische PDF gleich wieder weg.
      await textSpeichern();
      await empfSpeichern();
      const { bytes, ueberlauf: zuViel } = await pdfErzeugen({
        text, empfaenger: empf, absender: einst.absender, link, datum: datumDeutsch(new Date()),
        befunde: editor.brief.befunde, geprueftAm: editor.betrieb?.geprueft_am, googleStand: editor.betrieb?.google_stand,
      });
      if (zuViel > 0) throw new Error(`Der Text läuft ${zuViel} mm über die Grenze – kürzen oder einen Befund abwählen.`);
      const fd = new FormData();
      fd.append("pdf", new Blob([bytes as BlobPart], { type: "application/pdf" }), `brief-${editor.brief.token}.pdf`);
      fd.append("id", String(editor.brief.id));
      const d = await api("/api/admin/akquise/briefe", { method: "POST", body: fd, headers: {} });
      briefUebernehmen({ ...editor.brief, pdf_schluessel: d.pdf_schluessel });
      setMeldung(`PDF liegt vor (${Math.round((d.groesse || bytes.length) / 1024)} KB).`);
    } catch (e) { zeigeFehler(e, "PDF konnte nicht erzeugt werden."); }
    finally { setPdfLauf(false); }
  };

  const statusSetzen = (b: Brief, status: string) => mitSperre(b.id, async () => { await patch(b.id, { status }); });

  // ---- Sammelversand: anhaken, alle vorbereiten (Entwurf + PDF + Freigabe),
  // dann mit einer Bestaetigung nacheinander senden. Gleiche Schritte wie
  // beim einzelnen Brief; was ueberlaeuft, bleibt als Entwurf zum Kuerzen.
  const ladeSammel = useCallback(() =>
    api("/api/admin/akquise/betriebe")
      .then(d => {
        const liste = ((d.betriebe || []) as SammelBetrieb[]).filter(b => !b.geloescht && !b.brief_gesendet);
        setSammel(liste);
        const v = sammelVorwahl.current;
        if (v?.alle) {
          sammelVorwahl.current = null;
          setHaken(new Set(liste.filter(b => (v.kat === "alle" || (v.kat === "auswahl" ? b.auswahl : b.kategorie === v.kat)) && anschriftOk(b) && !b.brief_entwurf).map(b => b.id)));
        }
      })
      .catch(zeigeFehler), []);
  useEffect(() => { if (reiter === "sammel") ladeSammel(); }, [reiter, ladeSammel]);
  const sammelSichtbar = useMemo(() => sammel
    .filter(b => sammelKat === "alle" || (sammelKat === "auswahl" ? b.auswahl : b.kategorie === sammelKat))
    .sort((a, b) => (b.google_anzahl ?? -1) - (a.google_anzahl ?? -1)), [sammel, sammelKat]);
  const sammelZaehlt = (b: SammelBetrieb) => anschriftOk(b) && !b.brief_entwurf && !sammelStand[b.id];
  const sammelSetzen = (id: number, st: SammelStand) => setSammelStand(v => ({ ...v, [id]: st }));
  const hakenUmschalten = (id: number) => setHaken(h => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sammelAlle = (an: boolean) => setHaken(h => {
    const n = new Set(h);
    for (const b of sammelSichtbar) if (sammelZaehlt(b)) { if (an) n.add(b.id); else n.delete(b.id); }
    return n;
  });
  const sammelZiele = sammelSichtbar.filter(b => haken.has(b.id) && sammelZaehlt(b));
  const sammelBereit = Object.values(sammelStand).filter(x => x.art === "bereit" && x.briefId);

  const sammelVorbereiten = async () => {
    if (!einst || !sammelZiele.length) return;
    setSammelLauf(true); setFehler(""); setMeldung("");
    for (const b of sammelZiele) {
      sammelSetzen(b.id, { art: "laeuft", text: "Brief anlegen …" });
      let briefId: number | undefined;
      try {
        const d = await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ betrieb_id: b.id, art: "brief" }) });
        const brief = d.brief as Brief;
        briefId = brief.id;
        sammelSetzen(b.id, { art: "laeuft", text: "PDF erzeugen …", briefId });
        const { bytes, ueberlauf: zuViel } = await pdfErzeugen({
          text: brief.text || "", empfaenger: brief.empfaenger || "", absender: einst.absender,
          link: landingLink(einst.landing_basis, brief.token) as string, datum: datumDeutsch(new Date()) as string,
          befunde: brief.befunde, geprueftAm: d.betrieb?.geprueft_am, googleStand: d.betrieb?.google_stand,
        });
        if (zuViel > 0) { sammelSetzen(b.id, { art: "fehler", text: `Text ${zuViel} mm zu lang – unter „Briefe“ einzeln kürzen`, briefId }); continue; }
        const fd = new FormData();
        fd.append("pdf", new Blob([bytes as BlobPart], { type: "application/pdf" }), `brief-${brief.token}.pdf`);
        fd.append("id", String(brief.id));
        await api("/api/admin/akquise/briefe", { method: "POST", body: fd, headers: {} });
        await api("/api/admin/akquise/briefe", { method: "PATCH", body: JSON.stringify({ id: brief.id, status: "freigegeben" }) });
        sammelSetzen(b.id, { art: "bereit", text: "bereit", briefId });
      } catch (e) {
        sammelSetzen(b.id, { art: "fehler", text: e instanceof Error ? e.message : "Ging nicht.", briefId });
      }
    }
    setSammelLauf(false);
    ladeBriefe();
  };

  const sammelSenden = async () => {
    const liste = Object.entries(sammelStand).filter(([, x]) => x.art === "bereit" && x.briefId);
    if (!liste.length) return;
    const modus = stand?.modus === "live" ? "Live – wird gedruckt und verschickt" : "Testmodus – landet nur in der Postbox";
    if (!confirm(`${liste.length} Briefe jetzt senden?\n\nKosten je Brief ${preisText}\n${modus}`)) return;
    setSammelLauf(true); setFehler(""); setMeldung("");
    let gut = 0;
    for (const [id, x] of liste) {
      sammelSetzen(Number(id), { ...x, art: "laeuft", text: "sendet …" });
      try {
        await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ aktion: "senden", id: x.briefId }) });
        sammelSetzen(Number(id), { ...x, art: "ok", text: "gesendet ✓" }); gut++;
      } catch (e) {
        sammelSetzen(Number(id), { ...x, art: "fehler", text: e instanceof Error ? e.message : "Senden fehlgeschlagen." });
      }
    }
    setSammelLauf(false);
    setMeldung(`${gut} von ${liste.length} Briefen an LetterXpress übergeben${stand?.modus === "live" ? "." : " – im Testmodus liegen sie in deiner Postbox und gehen erst nach Freigabe dort raus."}`);
    ladeBriefe(); ladeStand();
  };

  // /v3/price liefert den Preis inkl. MwSt. – so geht er auch vom Guthaben ab
  // (je Brief 1,00 € netto + 0,19 € MwSt., siehe kosten_cent der Auftraege).
  const preisText = stand?.preis_cent != null ? `${euro(stand.preis_cent)} inkl. MwSt.` : PREIS_FALLBACK;
  const reichtFuer = stand?.guthaben_cent != null && stand?.preis_cent ? Math.floor(stand.guthaben_cent / stand.preis_cent) : null;
  const monatName = new Date().toLocaleDateString("de-DE", { month: "long" });

  const senden = (b: Brief) => {
    const name = b.betrieb_name || editor?.betrieb?.name || `Betrieb ${b.betrieb_id}`;
    const modus = stand?.modus === "live" ? "Live – wird gedruckt und verschickt" : "Testmodus – landet nur in der Postbox";
    if (!confirm(`${b.art === "test" ? "Testbrief an mich" : `Brief an ${name}`} jetzt senden?\n\nKosten ${preisText}\n${modus}`)) return;
    return mitSperre(b.id, async () => {
      const d = await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ aktion: "senden", id: b.id, test: b.art === "test" }) });
      briefUebernehmen(d.brief);
      setMeldung(`Übergeben (${d.modus}). Anbieter liest die Anschrift als: ${d.anbieter_adresse || "—"}`);
      ladeStand();
    });
  };

  const statusAbfragen = (b: Brief) => mitSperre(b.id, async () => {
    const d = await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ aktion: "status", id: b.id }) });
    briefUebernehmen(d.brief);
    setMeldung(`Anbieter meldet: ${d.anbieter_status || "—"}${d.item_status ? ` / ${d.item_status}` : ""}`);
  });

  const stornieren = (b: Brief) => {
    if (!confirm("Stornieren? Geht nur innerhalb von 15 Minuten nach dem Senden.")) return;
    return mitSperre(b.id, async () => {
      const d = await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ aktion: "stornieren", id: b.id }) });
      briefUebernehmen(d.brief);
    });
  };

  const loeschen = (b: Brief) => {
    const warnung = ["gesendet", "zugestellt"].includes(b.status)
      ? "Dieser Brief ist verschickt. Löschen entfernt auch die persönliche Seite – der Link im Brief geht dann ins Leere. Trotzdem löschen?"
      : "Entwurf löschen?";
    if (!confirm(warnung)) return;
    return mitSperre(b.id, async () => {
      await api("/api/admin/akquise/briefe", { method: "DELETE", body: JSON.stringify({ id: b.id }) });
      setBriefe(l => l.filter(x => x.id !== b.id));
      if (editor?.brief.id === b.id) editorSetzen(null);
      ladeBriefe();
      setInfoRunde(n => n + 1);
    });
  };

  const einstellungenSpeichern = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler(""); setMeldung("");
    try {
      await api("/api/admin/akquise/post-einstellungen", { method: "PUT", body: JSON.stringify({ vorlage: vorlageForm, vorlage_nachfass: nachfassForm, referenz: referenzForm }) });
      await ladeEinstellungen();
      setMeldung("Gespeichert.");
    } catch (err) { zeigeFehler(err); }
  };


  // ---- Anzeige

  const gesendetGesamt = (zaehler?.gesendet || 0) + (zaehler?.zugestellt || 0);
  const gewaehlteCodes = new Set(editor?.brief.befunde.map(b => b.code) || []);
  const imEntwurf = editor?.brief.status === "entwurf";
  const istZweiter = editor?.brief.art === "nachfass";
  // Schritte bis zum Versand – zeigt, wo der Brief gerade steht.
  const schritt = !editor ? 0 : editor.brief.status === "entwurf" ? (editor.brief.pdf_schluessel ? 2 : 1)
    : editor.brief.status === "freigegeben" || editor.brief.status === "fehler" ? 3 : 4;
  const bearbeitbar = imEntwurf && !!einst;

  const aktionen = (b: Brief) => {
    const busy = beschaeftigt.has(b.id);
    const pdfLink = b.pdf_schluessel ? `/api/admin/akquise/briefe?pdf=${b.id}` : null;
    return (
      <span className="post-aktionen">
        <button className="akq-knopf" onClick={() => briefOeffnen(b.id)} disabled={busy}>Öffnen</button>
        {pdfLink && <a className="akq-knopf" href={pdfLink} target="_blank" rel="noopener noreferrer"><FileText size={13} /> PDF</a>}
        {(b.status === "entwurf" || b.status === "fehler") && (
          <button className="akq-knopf" onClick={() => statusSetzen(b, "freigegeben")} disabled={busy || !b.pdf_schluessel}
                  title={b.pdf_schluessel ? "" : "Erst das PDF erzeugen"}>Freigeben</button>
        )}
        {b.status === "freigegeben" && (
          <>
            <button className="akq-knopf" onClick={() => senden(b)} disabled={busy || !stand?.eingerichtet}
                    title={stand?.eingerichtet ? `Kosten ${preisText}` : "Versand nicht eingerichtet"}>{busy ? "Sendet…" : "Senden"}</button>
            <button className="akq-knopf" onClick={() => statusSetzen(b, "entwurf")} disabled={busy}>Zurück in Entwurf</button>
          </>
        )}
        {(b.status === "gesendet" || b.status === "zugestellt") && b.anbieter_id && (
          <button className="akq-knopf" onClick={() => statusAbfragen(b)} disabled={busy}><RefreshCw size={13} /> Status</button>
        )}
        {b.status === "gesendet" && b.anbieter_id && (
          <button className="akq-knopf" onClick={() => stornieren(b)} disabled={busy}>Stornieren</button>
        )}
        <a className="akq-knopf" href={einst ? landingLink(einst.landing_basis, b.token) : `/fuer/${b.token}`} target="_blank" rel="noopener noreferrer"
           title="Persönliche Seite"><ExternalLink size={13} /></a>
        <button className="akq-knopf" onClick={() => loeschen(b)} disabled={busy} aria-label="Löschen"><Trash2 size={13} /></button>
      </span>
    );
  };

  return (
    <AdminShell titel="Post" eyebrow="Vertrieb" lead="Briefe an Betriebe: Vorschau, PDF, Versand.">
      {fehler && <p className="mb-4 text-sm" style={{ color: "#dc2626" }}>{fehler}</p>}
      {meldung && <p className="mb-4 text-sm" style={{ color: "#1d8a52" }}>{meldung}</p>}

      {/* Zwei Bloecke: was der Versand kostet und was zurueckkommt. */}
      <div className="post-zahlen">
        <section className="post-zahlen-block" aria-label="Versand und Kosten">
          <header>
            <h2>Versand &amp; Kosten</h2>
            {stand?.eingerichtet
              ? <span className={`post-modus${stand.modus === "live" ? " live" : ""}`}><i aria-hidden="true" />{stand.modus === "live" ? "Live" : "Testmodus"} · {stand.anbieter}</span>
              : <span className="post-modus aus"><i aria-hidden="true" />nicht eingerichtet</span>}
          </header>
          <div className="post-zahlen-reihe">
            <Zahl titel="Gesendet" wert={zahl(gesendetGesamt)} unter={[zaehler?.zugestellt ? `${zahl(zaehler.zugestellt)} zugestellt` : ""].filter(Boolean).join(" · ") || "Briefe"} />
            <Zahl titel="Guthaben" wert={stand?.guthaben_cent != null ? euro(stand.guthaben_cent) : "—"}
                  unter={reichtFuer != null ? `reicht für ca. ${zahl(reichtFuer)} Briefe` : "bei LetterXpress"} warnung={reichtFuer != null && reichtFuer < 10} />
            <Zahl titel="Ausgegeben" wert={euro(zaehler?.kosten_cent ?? 0)} unter={`${monatName}: ${euro(zaehler?.kosten_monat_cent ?? 0)}`} />
          </div>
          {!stand?.eingerichtet && <footer>LETTERXPRESS_USER und LETTERXPRESS_KEY in Cloudflare hinterlegen.</footer>}
        </section>
        <section className="post-zahlen-block" aria-label="Resonanz">
          <header>
            <h2>Resonanz</h2>
            <span className="post-zahlen-leise">auf {zahl(gesendetGesamt)} Briefe</span>
          </header>
          <div className="post-zahlen-reihe">
            <Zahl titel="QR-Code geöffnet" wert={zahl(zaehler?.aufrufe)} unter="Aufrufe der persönlichen Seiten" />
            <Zahl titel="Demo angesehen" wert={zahl(zaehler?.demo)} unter="geöffnet oder angefordert" />
            <Zahl titel="Kontakt erlaubt" wert={zahl(zaehler?.kontakt)} unter="per Klick – jetzt melden" hervor={!!zaehler?.kontakt} />
          </div>
        </section>
      </div>

      <div className="post-reiter" role="tablist">
        {([["briefe", "Briefe"], ["brief", editor && !istZweiter ? "Brief" : "Neuer Brief"], ["sammel", "Mehrere senden"], ["zweiter", "Zweiter Brief"], ["vorlage", "Vorlage"]] as [Reiter, string][]).map(([k, l]) => {
          // Ein offener zweiter Brief laeuft im Editor („brief“), gehoert aber
          // sichtbar unter „Zweiter Brief“.
          const an = reiter === "brief" && istZweiter ? k === "zweiter" : reiter === k;
          const klick = () => { if (k === "brief" && istZweiter) editorSetzen(null); setReiter(k); };
          return (
          <button key={k} role="tab" aria-selected={an} className={an ? "aktiv" : ""} onClick={klick}>
            {l}{k === "briefe" && briefe.length > 0 && <b>{briefe.length}</b>}{k === "zweiter" && zweiteOffen > 0 && <b>{zweiteOffen}</b>}
          </button>
          );
        })}
      </div>

      {/* Wie bei „Content erstellen“: links die Vorschau, sie bleibt beim
          Scrollen stehen; rechts der Reiter. */}
      {reiter !== "sammel" && reiter !== "zweiter" && (
      <div className={`post-arbeit${schau ? "" : " ohne-schau"}`}>
        {schau && (
          <aside className="post-schau" aria-label="Vorschau" ref={schauRef}>
            <div className="post-schau-kopf">
              {schau.token ? (
                <span className="post-schau-wahl" role="tablist" aria-label="Vorschau">
                  <button type="button" role="tab" aria-selected={schauArt === "brief"} className={schauArt === "brief" ? "an" : ""} onClick={() => setSchauArt("brief")}>Brief</button>
                  <button type="button" role="tab" aria-selected={schauArt === "seite"} className={schauArt === "seite" ? "an" : ""} onClick={() => setSchauArt("seite")}>Persönliche Seite</button>
                </span>
              ) : <span className="post-schau-titel">Vorschau</span>}
              <span className="post-schau-chip">{schau.chip}</span>
              {ueberlauf > 0 && <span className="post-schau-chip warn" title="Text kürzen oder einen Befund abwählen">Läuft {ueberlauf} mm über</span>}
              <span className="post-schau-name" title={schau.titel}>{schau.titel}</span>
              <button type="button" className="akq-knopf akq-symbol" onClick={() => setGross(true)} title="Groß ansehen" aria-label="Vorschau groß ansehen">
                <Maximize2 size={14} />
              </button>
            </div>
            {schauArt === "seite" && schau.token ? (
              /* Dieselbe Seite wie hinter dem QR-Code, relativ geladen – lokal wie
                 live die eigene Function; eigene Aufrufe aus dem Admin zaehlt sie nicht. */
              <div className="post-seite">
                <iframe src={`/fuer/${schau.token}`} title="Persönliche Seite, wie der Empfänger sie sieht" />
              </div>
            ) : (
              <Blatt text={schau.text} empfaenger={schau.empfaenger} absender={schau.absender} link={schau.link} datumText={schau.datumText} qr={qr}
                     befunde={schau.befunde} geprueftAm={schau.geprueftAm} googleStand={schau.googleStand} onUeberlauf={setUeberlauf} />
            )}
            {reiter === "briefe" && schau.briefId != null && (
              <div className="post-schau-fuss">
                <button type="button" className="akq-knopf" onClick={() => briefOeffnen(schau.briefId as number)}>Öffnen</button>
              </div>
            )}
          </aside>
        )}
        <div className="post-inhalt">

      {/* ---------------- Briefe */}
      {reiter === "briefe" && (
        <section className="mon-block post-briefe">
          <div className="akq-steuerung mb-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field px-3 py-2 text-sm" style={{ width: "auto" }}>
              <option value="alle">Alle Status</option>
              {Object.entries(STATUS_LABEL).filter(([k]) => !["storniert", "fehler"].includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <span className="akq-trenner" aria-hidden="true" />
            <span className="akq-hinweis">{zahl(sichtbar.length)} von {zahl(briefe.length)}</span>
            <button className="akq-knopf" onClick={() => { editorSetzen(null); setGewaehlt(null); setReiter("brief"); }}>Neuer Brief</button>
          </div>
          {laedt ? <p className="mon-leer">Wird geladen…</p>
            : briefe.length === 0 ? <p className="mon-leer py-6 text-center">Noch kein Brief. Unter „Neuer Brief“ einen Betrieb wählen.</p>
            : sichtbar.length === 0 ? <p className="mon-leer py-6 text-center">Kein Brief mit diesem Status.</p>
            : (
              <div className="post-huelle">
                <table className="mon-tabelle post-tabelle">
                  <thead>
                    <tr><th>Betrieb</th><th>Status</th><th className="num">Aufrufe</th><th className="num">Kosten</th><th></th></tr>
                  </thead>
                  <tbody>
                    {briefeAufSeite.map(b => {
                      const an = schau?.briefId === b.id;
                      return (
                        <tr key={b.id} className={an ? "gewaehlt" : undefined} onClick={() => setVorschauId(b.id)}>
                          <td className="post-betrieb">
                            <button type="button" className="post-name" onClick={() => setVorschauId(b.id)} aria-pressed={an}
                                    title="In der Vorschau zeigen">{b.betrieb_name || `Betrieb ${b.betrieb_id}`}</button>
                            <span className="post-unter">{[b.betrieb_ort, ART_LABEL[b.art] || b.art].filter(Boolean).join(" · ")}</span>
                            {b.betrieb_status && <span className="post-unter">Betrieb: {BETRIEB_STATUS[b.betrieb_status] || b.betrieb_status}</span>}
                            {b.status === "fehler" && b.fehler && <span className="block post-fehlertext">{b.fehler}</span>}
                          </td>
                          <td>
                            <StatusBadge status={b.status} />
                            <span className="post-unter">{b.gesendet_am ? `gesendet ${datum(b.gesendet_am)}` : `angelegt ${datum(b.angelegt)}`}</span>
                          </td>
                          <td className="num">
                            {zahl(b.aufrufe)}
                            {b.demo_geoeffnet && <span className="post-unter post-demo">Demo geöffnet {datum(b.demo_geoeffnet)}</span>}
                            {b.demo_angefordert && <span className="post-unter post-demo">Zugang angefordert {datum(b.demo_angefordert)}</span>}
                            {b.kontakt_erlaubt && (b.betrieb_telefon
                              ? <a className="post-unter post-kontakt" href={`tel:${b.betrieb_telefon.replace(/[^\d+]/g, "")}`} onClick={e => e.stopPropagation()}>
                                  Kontakt erlaubt {datum(b.kontakt_erlaubt)} · {b.betrieb_telefon}
                                </a>
                              : <span className="post-unter post-kontakt">Kontakt erlaubt {datum(b.kontakt_erlaubt)}</span>)}
                          </td>
                          <td className="num">{b.kosten_cent != null ? euro(b.kosten_cent) : "—"}</td>
                          <td onClick={e => e.stopPropagation()}>{aktionen(b)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          {!laedt && briefeSeiten}
        </section>
      )}

      {/* ---------------- Neuer Brief / Editor */}
      {reiter === "brief" && !editor && (
        <section className="mon-block">
          <h2>Betrieb wählen</h2>
          <div className="post-suche">
            <input value={suche} onChange={e => sucheTippen(e.target.value)} placeholder="Name oder Ort, mindestens 2 Zeichen"
                   className="field px-3 py-2 text-sm" autoFocus />
            {treffer.length > 0 && (
              <ul className="post-treffer">
                {treffer.map(b => (
                  <li key={b.id}>
                    <button type="button" onClick={() => { setGewaehlt(b); setTreffer([]); setSuche(""); }}>
                      {b.name}<span>{[b.ort, b.kategorie ? KATEGORIE_LABEL[b.kategorie] || b.kategorie : null, b.brief_gesendet ? `Brief ${datum(b.brief_gesendet)}` : BETRIEB_STATUS[b.status]].filter(Boolean).join(" · ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {gewaehlt && (
            <div className="post-gewaehlt">
              <div>
                <b>{gewaehlt.name}</b>
                <p>{[gewaehlt.strasse, [gewaehlt.plz, gewaehlt.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Anschrift unbekannt"}</p>
                <p>
                  {gewaehlt.website
                    ? <a href={gewaehlt.website} target="_blank" rel="noopener noreferrer" className="akq-link" title={gewaehlt.website}>{gewaehlt.website.replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "")}</a>
                    : "keine Website"}
                  {" · "}{gewaehlt.geprueft_am ? `geprüft ${datum(gewaehlt.geprueft_am)}` : "noch nicht geprüft"}
                  {" · "}Status {BETRIEB_STATUS[gewaehlt.status] || gewaehlt.status}
                </p>
                {!gewaehlt.geprueft_am && <p className="post-warnung">Ohne Prüfung gibt es keine Befunde. Erst unter Betriebe prüfen.</p>}
                {infoZuGewaehlt?.gesperrt && <p className="post-warnung">Steht auf der Sperrliste – kein Brief möglich.</p>}
                {infoZuGewaehlt?.offenerEntwurf && <p className="post-hinweis">Für diesen Betrieb gibt es schon einen Entwurf.</p>}
                {!infoZuGewaehlt?.offenerEntwurf && !!infoZuGewaehlt?.verschickt && (
                  <p className="post-hinweis">Am {datum(infoZuGewaehlt.zuletztGesendet)} ging schon ein Brief raus – der neue wird als zweiter Brief (Nachfass) geführt.</p>
                )}
              </div>
              {/* Ein Hauptknopf, der selbst weiss, was dran ist: offener Entwurf →
                  oeffnen, schon verschickt → zweiter Brief, sonst erster Brief. */}
              <div className="post-aktionen post-aktionen-senkrecht">
                {infoZuGewaehlt?.offenerEntwurf ? (
                  <button className="btn-primary px-4 py-2 text-sm" onClick={() => briefOeffnen(infoZuGewaehlt.offenerEntwurf as number)}>Entwurf öffnen</button>
                ) : (
                  <button className="btn-primary px-4 py-2 text-sm disabled:opacity-60" disabled={!infoZuGewaehlt || infoZuGewaehlt.gesperrt}
                          onClick={() => entwurfAnlegen(gewaehlt, infoZuGewaehlt?.verschickt ? "nachfass" : "brief")}>
                    {infoZuGewaehlt?.verschickt ? "Zweiten Brief anlegen" : "Brief anlegen"}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {reiter === "brief" && editor && einst && (
        <section className="mon-block">
          <div className="post-editor-kopf">
            <h2>{editor.brief.art === "test" ? "Testbrief an mich" : `${istZweiter ? "Zweiter Brief an " : ""}${editor.betrieb?.name || editor.brief.betrieb_name}`}</h2>
            <StatusBadge status={editor.brief.status} />
            <span className="akq-hinweis">{ART_LABEL[editor.brief.art]} · angelegt {datum(editor.brief.angelegt)}</span>
            {editor.betrieb && <span className="akq-hinweis">Betrieb: {BETRIEB_STATUS[editor.betrieb.status] || editor.betrieb.status}</span>}
            <a href={link} target="_blank" rel="noopener noreferrer" className="akq-link text-sm">{link}</a>
            <span className="akq-trenner" aria-hidden="true" />
            {istZweiter
              ? <button className="akq-knopf" onClick={() => { editorSetzen(null); setReiter("zweiter"); }}><ArrowLeft size={13} /> Zurück zur Liste</button>
              : <button className="akq-knopf" onClick={() => editorSetzen(null)}>Schließen</button>}
          </div>
          <ol className="post-schritte" aria-label="Schritte bis zum Versand">
            {["Text prüfen", "PDF erzeugen", "Freigeben", "Senden"].map((t, i) => (
              <li key={t} className={i + 1 < schritt ? "fertig" : i + 1 === schritt ? "jetzt" : ""}><i>{i + 1 < schritt ? "✓" : i + 1}</i>{t}</li>
            ))}
          </ol>
          {editor.brief.status === "fehler" && editor.brief.fehler && <p className="post-fehlertext mb-3">{editor.brief.fehler}</p>}

          <div className="post-editor">
            <div>
              {istZweiter ? (() => {
                const v = vorschauen[editor.brief.betrieb_id];
                return (
                  <div className="post-abschnitt">
                    <p className="post-abschnitt-titel">Website-Vorschau</p>
                    {v && v.gueltig ? (
                      <div className="post-pdf-stand">
                        <a className="akq-knopf" href={`/fuer/${editor.brief.token}/website`} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Ansehen</a>
                        <button type="button" className="akq-knopf" onClick={() => setSteckbrief({ id: editor.brief.betrieb_id, name: editor.betrieb?.name || editor.brief.betrieb_name || "Betrieb", token: editor.brief.token })}>Aussehen &amp; Fahrzeuge</button>
                        <span className="post-leise">gültig bis {datum(v.ablauf)}{v.aufrufe ? ` · ${v.aufrufe}× geöffnet` : ""}</span>
                      </div>
                    ) : (
                      <>
                        <p className="post-warnung">Noch keine gültige Vorschau – der QR-Code führt dann nur zur persönlichen Seite.</p>
                        <button type="button" className="akq-knopf" onClick={() => setSteckbrief({ id: editor.brief.betrieb_id, name: editor.betrieb?.name || editor.brief.betrieb_name || "Betrieb", token: editor.brief.token })}>Vorschau bauen</button>
                      </>
                    )}
                    <p className="post-hinweis">Der Brief verweist per QR-Code auf diese Vorschau. Nach dem Bauen „Aus Vorlage neu“ drücken, damit der Text dazu passt.</p>
                  </div>
                );
              })() : (
              <div className="post-abschnitt">
                <p className="post-abschnitt-titel">Befunde <small>({editor.brief.befunde.length} im Brief)</small></p>
                {editor.kandidaten.length === 0 ? (
                  <p className="post-hinweis">Keine Befunde aus einer Prüfung. Betrieb erst unter Betriebe prüfen – oder den Text von Hand schreiben.</p>
                ) : (
                  <ul className="post-befunde">
                    {editor.kandidaten.map(k => (
                      <li key={k.code}>
                        <label>
                          <input type="checkbox" checked={gewaehlteCodes.has(k.code)} disabled={!bearbeitbar || beschaeftigt.has(editor.brief.id)}
                                 onChange={() => befundUmschalten(k.code)} />
                          <span>{k.text}</span>
                          <span className="post-punkte">{k.punkte}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {bearbeitbar && <p className="post-hinweis">Ankreuzen setzt den Text aus der Vorlage neu – eigene Änderungen im Text gehen dabei verloren. Bei vielen Befunden wird der Text kleiner gesetzt; passt er gar nicht mehr, warnt die Vorschau.</p>}
              </div>
              )}

              <div className="post-abschnitt">
                <p className="post-abschnitt-titel">Anschrift <small>(nur Firma, kein Personenname)</small></p>
                <textarea className="field px-3 py-2 post-anschrift" value={empf} onChange={e => setEmpf(e.target.value)} onBlur={empfSpeichern}
                          disabled={!bearbeitbar} rows={4} />
                {!anschriftVollstaendig(empf) && <p className="post-warnung">Anschrift unvollständig: Name, Straße und „PLZ Ort“ als letzte Zeile.</p>}
              </div>

              <div className="post-abschnitt">
                <p className="post-abschnitt-titel">
                  Brieftext
                  {bearbeitbar && <button type="button" className="akq-knopf" onClick={() => { const t = textAusVorlage(editor.brief.befunde); setText(t); patch(editor.brief.id, { text: t }).catch(zeigeFehler); }}>Aus Vorlage neu</button>}
                </p>
                <textarea className="field px-3 py-2 post-text" value={text} onChange={e => setText(e.target.value)} onBlur={textSpeichern}
                          disabled={!bearbeitbar} spellCheck />
                <p className="post-hinweis">{istZweiter
                  ? "Erste Zeile ist der Betreff, unter „---“ steht der Hinweis. Link und QR-Code (zur Website-Vorschau) kommen automatisch unten aufs Blatt."
                  : "Erste Zeile ist der Betreff, Zeilen mit „– “ werden zum Befund-Kasten (das Wort vor dem Doppelpunkt ist das Stichwort), ein Absatz mit „PS:“ zum PS, unter „---“ steht der Hinweis (höchstens vier Zeilen). Link und QR-Code kommen automatisch unten aufs Blatt."}</p>
              </div>

              <div className="post-abschnitt">
                <p className="post-abschnitt-titel">PDF und Versand</p>
                <div className="post-pdf-stand">
                  {imEntwurf && (
                    <button className="btn-primary px-4 py-2 text-sm disabled:opacity-60" onClick={pdfBauen} disabled={pdfLauf || !anschriftVollstaendig(empf) || ueberlauf > 0}
                            title={ueberlauf > 0 ? "Der Text läuft über die Grenze" : ""}>
                      {pdfLauf ? "Erzeugt…" : editor.brief.pdf_schluessel ? "PDF neu erzeugen" : "PDF erzeugen"}
                    </button>
                  )}
                  {editor.brief.pdf_schluessel ? (
                    <a className="akq-knopf" href={`/api/admin/akquise/briefe?pdf=${editor.brief.id}`} target="_blank" rel="noopener noreferrer"><FileText size={13} /> PDF liegt vor – öffnen</a>
                  ) : <span className="post-leise">Noch kein PDF.</span>}
                  {imEntwurf && (
                    <button className="akq-knopf" disabled={!editor.brief.pdf_schluessel || beschaeftigt.has(editor.brief.id) || ueberlauf > 0} onClick={() => statusSetzen(editor.brief, "freigegeben")}>Freigeben</button>
                  )}
                  {editor.brief.status === "fehler" && (
                    <button className="akq-knopf" disabled={!editor.brief.pdf_schluessel} onClick={() => statusSetzen(editor.brief, "freigegeben")}>Erneut freigeben</button>
                  )}
                  {editor.brief.status === "freigegeben" && (
                    <>
                      <button className="btn-primary px-4 py-2 text-sm disabled:opacity-60" onClick={() => senden(editor.brief)} disabled={!stand?.eingerichtet || beschaeftigt.has(editor.brief.id)}>
                        {beschaeftigt.has(editor.brief.id) ? "Sendet…" : `Senden (${preisText})`}
                      </button>
                      <button className="akq-knopf" onClick={() => statusSetzen(editor.brief, "entwurf")}>Zurück in Entwurf</button>
                    </>
                  )}
                  {(editor.brief.status === "gesendet" || editor.brief.status === "zugestellt") && editor.brief.anbieter_id && (
                    <>
                      <span className="post-leise">Anbieter-Auftrag {editor.brief.anbieter_id}{editor.brief.kosten_cent != null ? ` · ${euro(editor.brief.kosten_cent)}` : ""}</span>
                      <button className="akq-knopf" onClick={() => statusAbfragen(editor.brief)}><RefreshCw size={13} /> Status</button>
                      {editor.brief.status === "gesendet" && <button className="akq-knopf" onClick={() => stornieren(editor.brief)}>Stornieren</button>}
                    </>
                  )}
                </div>
                {(editor.brief.status === "gesendet" || editor.brief.status === "zugestellt") && (
                  <div className="post-versandt">
                    <p>
                      <b>✓ Brief an LetterXpress übergeben</b>{editor.brief.gesendet_am ? ` · ${datum(editor.brief.gesendet_am)}` : ""}
                      <br />
                      {stand?.modus === "live"
                        ? "Wird gedruckt und verschickt. Stornieren geht noch 15 Minuten."
                        : "Testmodus: Der Brief liegt in deiner LetterXpress-Postbox und geht erst raus, wenn du ihn dort freigibst."}
                    </p>
                    {rueckweg && (
                      <a className="akq-knopf" href={`${rueckweg.url}#betrieb-${rueckweg.id}`}
                         onClick={() => { try { sessionStorage.setItem("akquise.sprung", JSON.stringify({ id: rueckweg.id, t: Date.now() })); } catch { /* dann nur per Hash */ } }}>
                        <ArrowLeft size={14} /> Zurück zu Betriebe
                      </a>
                    )}
                  </div>
                )}
                {!stand?.eingerichtet && <p className="post-hinweis">Briefversand nicht eingerichtet. PDF und Freigabe gehen trotzdem.</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Vorlage */}
      {reiter === "vorlage" && einst && absenderForm && (
        <form onSubmit={einstellungenSpeichern} className="mon-block">
          <h2>Vorlage</h2>
          <div className="post-schau-wahl mb-3" role="tablist" aria-label="Welche Vorlage">
            {([["brief", "Erster Brief"], ["nachfass", "Zweiter Brief"]] as ["brief" | "nachfass", string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={vorlageArt === k} className={vorlageArt === k ? "an" : ""} onClick={() => setVorlageArt(k)}>{l}</button>
            ))}
          </div>
          {vorlageArt === "brief"
            ? <textarea className="field px-3 py-2 post-text" value={vorlageForm} onChange={e => setVorlageForm(e.target.value)} rows={24} spellCheck />
            : <textarea className="field px-3 py-2 post-text" value={nachfassForm} onChange={e => setNachfassForm(e.target.value)} rows={24} spellCheck />}
          {vorlageArt === "nachfass" && <p className="post-hinweis">Gilt für jeden weiteren Brief an einen Betrieb, der schon Post bekommen hat.</p>}
          <div className="mt-4">
            <label htmlFor="referenz" className="post-abschnitt-titel">Referenz (nur mit Erlaubnis des Kunden)</label>
            <input id="referenz" className="field px-3 py-2 text-sm w-full" value={referenzForm} maxLength={300} onChange={e => setReferenzForm(e.target.value)}
                   placeholder="z. B. Ein Beispiel aus der Region: Autohaus … nutzt die Lösung bereits – zu sehen unter …" />
            <p className="post-hinweis">Steht nur auf der persönlichen Seite unter „Bereits im Einsatz“ – eine Adresse wie autohaus-diezmann.de wird dort zum Link. Nicht im Brief.</p>
          </div>
          <p className="post-hinweis">Erste Zeile ist der Betreff, Zeilen mit „– “ werden zum Befund-Kasten, „PS:“ zum PS, „---“ trennt den Hinweis ab (höchstens vier Zeilen). Link und QR-Code stehen automatisch im Handlungsblock unten. Keine Ausrufezeichen, keine Superlative – der Brief soll nachprüfbar bleiben.</p>
          <p className="post-abschnitt-titel mt-4">Platzhalter</p>
          <ul className="post-platzhalter">
            {einst.platzhalter.map(p => <li key={p.name}><code>{p.name}</code><span>{p.erklaerung}</span></li>)}
          </ul>
          <div className="akq-steuerung mt-5">
            <button type="submit" className="btn-primary px-4 py-2 text-sm">Speichern</button>
            <button type="button" className="akq-knopf" onClick={() => { setVorlageForm(einst.standard.vorlage); setNachfassForm(einst.standard.vorlage_nachfass); }}>
              Standard einsetzen
            </button>
            <span className="akq-hinweis">Änderungen gelten für neue Entwürfe; bestehende Briefe behalten ihren Text.</span>
          </div>
        </form>
      )}
        </div>
      </div>
      )}

      {gross && schau && <GrossAnsicht schau={schau} qr={qr} onZu={grossZu} />}

      {steckbrief && (
        <SteckbriefFenster betriebId={steckbrief.id} name={steckbrief.name} token={steckbrief.token} onZu={steckbriefZu}
                           onGebaut={text => { setMeldung(text); ladeVorschauen(); }} />
      )}
      {reiter === "zweiter" && (
        <section className="mon-block">
          <h2>Zweiter Brief</h2>
          {zweite.length === 0 ? <p className="mon-leer">Noch hat niemand reagiert.</p> : (
            <div className="post-huelle">
              <table className="mon-tabelle post-tabelle post-zweiter">
                <thead><tr><th>Betrieb</th><th>Erster Brief</th><th>Reaktion</th><th>Website-Vorschau</th><th>Zweiter Brief</th><th></th></tr></thead>
                <tbody>
                  {zweite.map(({ erster: b, folge }) => (
                    <tr key={b.id}>
                      <td className="post-betrieb">
                        <span className="post-name stark">{b.betrieb_name || `Betrieb ${b.betrieb_id}`}</span>
                        <span className="post-unter">
                          {[b.betrieb_ort, KATEGORIE_LABEL[b.betrieb_kategorie || ""] || null,
                            b.betrieb_google_anzahl != null ? `★ ${String(b.betrieb_google_bewertung ?? "").replace(".", ",")} · ${b.betrieb_google_anzahl}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td>{datum(b.gesendet_am)}</td>
                      <td className="post-reaktion">
                        {b.kontakt_erlaubt && <span className="post-chip kontakt">Kontakt erlaubt {datum(b.kontakt_erlaubt)}</span>}
                        {(b.demo_geoeffnet || b.demo_angefordert) && <span className="post-chip demo">Demo {datum(b.demo_geoeffnet || b.demo_angefordert)}</span>}
                        {b.aufrufe > 0 && <span className="post-chip seite">QR-Code {b.aufrufe}×{b.zuletzt_aufgerufen ? ` · zuletzt ${datum(b.zuletzt_aufgerufen)}` : ""}</span>}
                      </td>
                      <td>
                        {(() => {
                          const v = vorschauen[b.betrieb_id];
                          const oeffnen = () => setSteckbrief({ id: b.betrieb_id, name: b.betrieb_name || "Betrieb", token: b.token });
                          if (v && v.gueltig) return (
                            <span className="post-vorschau">
                              <a className="akq-knopf" href={`/fuer/${b.token}/website`} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Ansehen</a>
                              <span className="post-unter">bis {datum(v.ablauf)} · {v.aufrufe ? `${v.aufrufe}× geöffnet` : "noch nicht geöffnet"}{v.modell === "vorlage" ? " · Standardtexte" : ""}</span>
                              <button type="button" className="post-link-knopf" onClick={oeffnen}>Aussehen &amp; Fahrzeuge</button>
                            </span>
                          );
                          return <button className="akq-knopf" onClick={oeffnen}>{v ? "Abgelaufen – neu bauen" : "Vorschau bauen"}</button>;
                        })()}
                      </td>
                      <td>
                        {folge ? <><StatusBadge status={folge.status} /><span className="post-unter">{folge.gesendet_am ? `gesendet ${datum(folge.gesendet_am)}` : `angelegt ${datum(folge.angelegt)}`}</span></>
                          : <span className="post-leise">—</span>}
                      </td>
                      <td>
                        <span className="post-aktionen">
                          {b.kontakt_erlaubt && b.betrieb_telefon && (
                            <a className="btn-primary px-3 py-1.5 text-xs" href={`tel:${b.betrieb_telefon.replace(/[^\d+]/g, "")}`}>Anrufen</a>
                          )}
                          {folge
                            ? <button className="akq-knopf" onClick={() => briefOeffnen(folge.id)}>{["entwurf", "freigegeben", "fehler"].includes(folge.status) ? "Entwurf öffnen" : "Ansehen"}</button>
                            : !b.kontakt_erlaubt && <button className="akq-knopf" onClick={() => entwurfAnlegen({ id: b.betrieb_id } as BetriebKurz, "nachfass")}>Zweiten Brief anlegen</button>}
                          <a className="akq-knopf" href={einst ? landingLink(einst.landing_basis, b.token) : `/fuer/${b.token}`} target="_blank" rel="noopener noreferrer"
                             title="Persönliche Seite – so hat der Betrieb sie gesehen"><ExternalLink size={13} /></a>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {reiter === "sammel" && (
        <section className="mon-block">
          <h2>Mehrere Briefe auf einmal</h2>
          <p className="post-hinweis mb-4">
            Anhaken, „Vorbereiten“ legt je Betrieb den Brief mit den vorgeschlagenen Befunden an, erzeugt das PDF und gibt es frei.
            Danach mit einem Klick alle senden. Was zu lang wird, bleibt als Entwurf unter „Briefe“ zum Kürzen.
          </p>
          <div className="post-sammel-kat">
            {SAMMEL_KAT.map(([k, l]) => (
              <button key={k} type="button" className={sammelKat === k ? "an" : ""} onClick={() => setSammelKat(k)}>
                {l} <b>{sammel.filter(b => k === "alle" || (k === "auswahl" ? b.auswahl : b.kategorie === k)).length}</b>
              </button>
            ))}
          </div>
          <div className="akq-steuerung my-4">
            <button type="button" className="akq-knopf" onClick={() => sammelAlle(true)} disabled={sammelLauf}>Alle anhaken</button>
            <button type="button" className="akq-knopf" onClick={() => sammelAlle(false)} disabled={sammelLauf}>Keine</button>
            <button type="button" className="btn-primary px-4 py-2 text-sm disabled:opacity-60" onClick={sammelVorbereiten} disabled={sammelLauf || !sammelZiele.length}>
              {sammelZiele.length} {sammelZiele.length === 1 ? "Brief" : "Briefe"} vorbereiten
            </button>
            <button type="button" className="btn-primary px-4 py-2 text-sm disabled:opacity-60" onClick={sammelSenden} disabled={sammelLauf || !sammelBereit.length || !stand?.eingerichtet}
                    title={stand?.eingerichtet ? `Kosten je Brief ${preisText}` : "Versand nicht eingerichtet"}>
              {sammelBereit.length} {sammelBereit.length === 1 ? "Brief" : "Briefe"} senden
            </button>
          </div>
          {sammelSichtbar.length === 0 ? <p className="mon-leer">{sammelKat === "auswahl" ? "Noch keine Betriebe mit Stern – unter „Betriebe“ markieren oder oben eine Kategorie wählen." : "Keine Betriebe ohne Brief in dieser Kategorie."}</p> : (
            <div className="post-huelle">
              <table className="mon-tabelle post-tabelle post-sammel">
                <thead><tr><th></th><th>Betrieb</th><th>Kategorie</th><th className="num">Google</th><th>Stand</th></tr></thead>
                <tbody>
                  {sammelSichtbar.map(b => {
                    const st = sammelStand[b.id];
                    const sperre = !anschriftOk(b) ? "Anschrift unvollständig" : b.brief_entwurf ? "Entwurf offen – unter „Briefe“" : "";
                    return (
                      <tr key={b.id} className={sperre ? "gesperrt" : undefined}>
                        <td><input type="checkbox" checked={haken.has(b.id) && !sperre} disabled={!!sperre || !!st || sammelLauf} onChange={() => hakenUmschalten(b.id)} aria-label={`${b.name} auswählen`} /></td>
                        <td className="stark">{b.name}<span className="post-unter">{[b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span></td>
                        <td>{SAMMEL_KAT.find(([k]) => k === b.kategorie)?.[1] || b.kategorie || "—"}</td>
                        <td className="num">{b.google_anzahl != null ? `★ ${String(b.google_bewertung ?? "").replace(".", ",")} · ${b.google_anzahl}` : "—"}</td>
                        <td>
                          {st ? (
                            <span className={`post-sammel-stand ${st.art}`}>
                              {st.text}
                              {st.briefId && (st.art === "bereit" || st.art === "ok") && <> · <a href={`/api/admin/akquise/briefe?pdf=${st.briefId}`} target="_blank" rel="noopener noreferrer">PDF</a></>}
                            </span>
                          ) : <span className="post-leise">{sperre || "—"}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AdminShell>
  );
}
