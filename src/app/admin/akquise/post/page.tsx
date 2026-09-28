"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { ExternalLink, FileText, Mail, Maximize2, RefreshCw, Trash2, X } from "lucide-react";
import AdminShell, { api, datum, euro } from "@/components/admin/AdminShell";
import { BEFUNDE_BEISPIEL, briefAufbauen, briefFuellen, datumDeutsch, empfaengerBlock, landingLink } from "../../../../../functions/_lib/brief.js";
import "./post.css";

// Akquise → Post: Briefe an Betriebe. Der Server (functions/api/admin/akquise/
// briefe.js) haelt Entwurf, Befunde, Text und Status; das PDF entsteht hier
// im Browser mit pdf-lib – die Function haette dafuer zu wenig CPU – und
// wird hochgeladen. Versand und Statusabfrage laufen dann ueber den Server.
//
// Layout des Blatts (mm) nach DIN 5008 Form B und den LetterXpress-Vorgaben:
// Anschriftenfeld 20/45 mm, 85 × 45 mm (nur Ruecksendezeile + Empfaenger),
// Text ab 98,5 mm, Raender 25/20 mm, Falzmarken 105/210 mm. Die Vorschau
// (post.css) nutzt dieselben Zahlen.

type Befund = { code: string; text: string };
type Kandidat = Befund & { punkte: number; vorgewaehlt: boolean };
type Brief = {
  id: number; betrieb_id: number; token: string; status: string; art: string;
  empfaenger: string | null; befunde: Befund[]; text: string | null; pdf_schluessel: string | null;
  anbieter: string | null; anbieter_id: string | null; kosten_cent: number | null; fehler: string | null;
  aufrufe: number; zuletzt_aufgerufen: string | null; demo_angefordert: string | null;
  angelegt: string; gesendet_am: string | null; zugestellt_am: string | null;
  betrieb_name?: string | null; betrieb_ort?: string | null; betrieb_status?: string | null;
};
type BetriebKurz = {
  id: number; name: string; strasse: string | null; plz: string | null; ort: string | null;
  website: string | null; status: string; kategorie?: string | null; geprueft_am: string | null; geloescht?: string | null;
};
type Absender = { name: string; zusatz: string; strasse: string; plz_ort: string; telefon: string; email: string; web: string };
type Einstellungen = {
  absender: Absender; vorlage: string; landing_basis: string;
  platzhalter: { name: string; erklaerung: string }[];
  standard: { absender: Absender; vorlage: string; landing_basis: string };
};
type Zaehler = { entwurf: number; freigegeben: number; gesendet: number; zugestellt: number; fehler: number; storniert: number; aufrufe: number; demo: number };
type Stand = { eingerichtet: boolean; modus: string; anbieter: string; guthaben_cent?: number; preis_cent?: number };
type Sperre = { id: number; betrieb_id: number | null; name: string | null; ort: string | null; grund: string | null; angelegt: string };
type Editor = { brief: Brief; betrieb: BetriebKurz | null; kandidaten: Kandidat[] };
type Reiter = "briefe" | "brief" | "vorlage" | "sperrliste";
// Was links in der Vorschau steht: chip sagt, woher (Entwurf, Beispiel …).
type Schau = { chip: string; titel: string; text: string; empfaenger: string; absender: Absender; link: string; datumText: string; briefId?: number };

const STATUS_LABEL: Record<string, string> = {
  entwurf: "Entwurf", freigegeben: "Freigegeben", gesendet: "Gesendet", zugestellt: "Zugestellt", fehler: "Fehler", storniert: "Storniert",
};
const ART_LABEL: Record<string, string> = { brief: "Brief", nachfass: "Nachfass", test: "Test an mich" };
const BETRIEB_STATUS: Record<string, string> = { neu: "Neu", beobachten: "Beobachten", brief: "Brief", kontakt: "Kontakt", kunde: "Kunde", aus: "Aus" };
const KATEGORIE_LABEL: Record<string, string> = {
  ohne_website: "ohne Website", nur_boerse: "nur Börse", baukasten: "Baukasten", veraltet: "veraltet", mittel: "mittel", gepflegt: "gepflegt",
};
const PREIS_FALLBACK = "≈ 0,90 €";
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

const LAYOUT = {
  fensterX: 20, fensterY: 45, fensterB: 85,
  textX: 25, textRechts: 20, textY: 98.5,
  falz: [105, 210], qr: 25, fussY: 283, absenderX: 120, absenderY: 18, datumY: 90,
  zeile: 5.2, absatz: 4, hinweisZeile: 3.6, seitenEnde: 276,
};
const A4_H = PageSizes.A4[1];
const mm = (v: number) => (v * 72) / 25.4;

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

type PdfDaten = { text: string; empfaenger: string; absender: Absender; link: string; datum: string };

async function pdfErzeugen(d: PdfDaten): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // LetterXpress verlangt eingebettete Schriften – pdf-lib bettet die TTF
  // als Untermenge der benutzten Zeichen ein.
  const [regular, semibold] = await Promise.all([fontLaden("regular"), fontLaden("semibold")]);
  const font = await pdf.embedFont(regular, { subset: true });
  const fett = await pdf.embedFont(semibold, { subset: true });
  pdf.setTitle("Brief");
  pdf.setAuthor(d.absender.name);
  pdf.setLanguage("de-DE");

  const zeichenSatz = new Set(font.getCharacterSet());
  const sauber = (s: string) => Array.from(s).map(c => (zeichenSatz.has(c.codePointAt(0) ?? -1) ? c : "")).join("");

  const qr = await pdf.embedPng(await QRCode.toDataURL(d.link, { margin: 0, width: 512, errorCorrectionLevel: "M" }));
  const schwarz = rgb(0, 0, 0);
  const grau = rgb(0.33, 0.33, 0.33);

  let seite: PDFPage = pdf.addPage(PageSizes.A4);
  const basis = (yTop: number, size: number) => A4_H - mm(yTop) - size * 0.78;
  const text = (t: string, xMm: number, yTop: number, size: number, f: PDFFont = font, farbe = schwarz) =>
    seite.drawText(sauber(t), { x: mm(xMm), y: basis(yTop, size), size, font: f, color: farbe });
  const breiteVon = (t: string, size: number) => font.widthOfTextAtSize(sauber(t), size);

  const umbrechen = (t: string, size: number, breite: number) => {
    const zeilen: string[] = [];
    let z = "";
    for (const w of t.split(/\s+/).filter(Boolean)) {
      const probe = z ? `${z} ${w}` : w;
      if (!z || breiteVon(probe, size) <= breite) z = probe;
      else { zeilen.push(z); z = w; }
    }
    if (z) zeilen.push(z);
    return zeilen;
  };

  const rahmen = () => {
    for (const y of LAYOUT.falz) {
      seite.drawLine({ start: { x: mm(3), y: A4_H - mm(y) }, end: { x: mm(8), y: A4_H - mm(y) }, thickness: 0.4, color: grau });
    }
    const a = d.absender;
    const fuss = [a.name, a.strasse, a.plz_ort, a.telefon, a.email, a.web].filter(Boolean).join(" · ");
    text(fuss, LAYOUT.textX, LAYOUT.fussY, 7.5, font, grau);
  };
  rahmen();

  // Absender oben rechts – ausserhalb des Anschriftenfelds.
  {
    const a = d.absender;
    let y = LAYOUT.absenderY;
    text(a.name, LAYOUT.absenderX, y, 10); y += 5;
    for (const z of [a.zusatz, a.strasse, a.plz_ort, a.telefon, a.email, a.web].filter(Boolean)) {
      text(z, LAYOUT.absenderX, y, 8.5, font, rgb(0.13, 0.13, 0.13)); y += 4;
    }
  }

  // Anschriftenfeld: nur Ruecksendezeile und Empfaenger.
  {
    const a = d.absender;
    text([a.name, a.strasse, a.plz_ort].filter(Boolean).join(" · "), LAYOUT.fensterX + 2, LAYOUT.fensterY + 1.5, 7, font, rgb(0.2, 0.2, 0.2));
    let y = LAYOUT.fensterY + 8;
    for (const z of d.empfaenger.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 6)) {
      text(z, LAYOUT.fensterX + 2, y, 11); y += 4.6;
    }
  }

  // Datum rechtsbuendig
  {
    const t = `${d.absender.plz_ort.replace(/^\d{5}\s+/, "")}, ${d.datum}`;
    seite.drawText(sauber(t), { x: mm(210 - LAYOUT.textRechts) - breiteVon(t, 10), y: basis(LAYOUT.datumY, 10), size: 10, font, color: schwarz });
  }

  // Betreff und Absaetze
  const { betreff, absaetze } = briefAufbauen(d.text) as { betreff: string; absaetze: { art: string; zeilen: string[] }[] };
  const breite = mm(210 - LAYOUT.textX - LAYOUT.textRechts);
  let y = LAYOUT.textY;
  const neueSeiteWennNoetig = (bedarf: number) => {
    if (y + bedarf > LAYOUT.seitenEnde) {
      seite = pdf.addPage(PageSizes.A4);
      rahmen();
      y = 25;
    }
  };
  if (betreff) { text(betreff, LAYOUT.textX, y, 11, fett); y += LAYOUT.zeile * 2; }

  let hinweisBegonnen = false;
  for (const abs of absaetze) {
    if (abs.art === "hinweis") {
      if (!hinweisBegonnen) { y += 2; hinweisBegonnen = true; }
      for (const z of abs.zeilen) {
        for (const l of umbrechen(z, 7.5, breite)) { neueSeiteWennNoetig(LAYOUT.hinweisZeile); text(l, LAYOUT.textX, y, 7.5, font, grau); y += LAYOUT.hinweisZeile; }
      }
      y += 2;
      continue;
    }
    if (abs.art === "liste") {
      for (const z of abs.zeilen) {
        const zeilen = umbrechen(z, 11, breite - mm(5));
        neueSeiteWennNoetig(LAYOUT.zeile * Math.min(zeilen.length, 2));
        text("–", LAYOUT.textX, y, 11);
        for (const l of zeilen) { neueSeiteWennNoetig(LAYOUT.zeile); text(l, LAYOUT.textX + 5, y, 11); y += LAYOUT.zeile; }
      }
      y += LAYOUT.absatz;
      continue;
    }
    // Textabsatz – der mit dem Link bekommt rechts den QR-Code.
    const mitQr = abs.zeilen.some(z => z.includes(d.link));
    const b = mitQr ? breite - mm(LAYOUT.qr + 6) : breite;
    const zeilen = abs.zeilen.flatMap(z => umbrechen(z, 11, b));
    neueSeiteWennNoetig(mitQr ? LAYOUT.qr + 3 : LAYOUT.zeile * Math.min(zeilen.length, 2));
    const oben = y;
    if (mitQr) {
      seite.drawImage(qr, { x: mm(210 - LAYOUT.textRechts - LAYOUT.qr), y: A4_H - mm(oben + LAYOUT.qr), width: mm(LAYOUT.qr), height: mm(LAYOUT.qr) });
    }
    for (const l of zeilen) { neueSeiteWennNoetig(LAYOUT.zeile); text(l, LAYOUT.textX, y, 11); y += LAYOUT.zeile; }
    if (mitQr) y = Math.max(y, oben + LAYOUT.qr + 3);
    y += LAYOUT.absatz;
  }

  return pdf.save();
}

// ------------------------------------------------------------------ Bausteine

function Kachel({ titel, wert, unter }: { titel: string; wert: string; unter?: string }) {
  return (
    <div className="mon-kachel">
      <p className="mon-kachel-titel">{titel}</p>
      <p className="mon-kachel-wert">{wert}</p>
      {unter && <p className="mon-kachel-unter">{unter}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`post-status ${status}`}>{STATUS_LABEL[status] || status}</span>;
}

// Das Blatt in der Vorschau – Positionen wie im PDF (post.css).
function Blatt({ text, empfaenger, absender, link, datumText, qr }: {
  text: string; empfaenger: string; absender: Absender; link: string; datumText: string; qr: string;
}) {
  const huelle = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(0.5);
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
  const ort = absender.plz_ort.replace(/^\d{5}\s+/, "");
  return (
    <div ref={huelle} className="post-blatt-huelle" style={{ height: 297 * 96 / 25.4 * skala + 28 }}>
      <div className="post-blatt-skala" style={{ transform: `scale(${skala})` }}>
        <div className="post-blatt" aria-label="Vorschau des Briefs">
          <div className="post-b-absender">
            <b>{absender.name}</b>
            {[absender.zusatz, absender.strasse, absender.plz_ort, absender.telefon, absender.email, absender.web].filter(Boolean).map((z, i) => <div key={i}>{z}</div>)}
          </div>
          <div className="post-b-fenster">
            <div className="post-b-ruecksende">{[absender.name, absender.strasse, absender.plz_ort].filter(Boolean).join(" · ")}</div>
            <div className="post-b-anschrift">{empfaenger}</div>
          </div>
          {LAYOUT.falz.map(y => <div key={y} className="post-b-falz" style={{ top: `${y}mm` }} />)}
          <div className="post-b-datum">{ort}, {datumText}</div>
          <div className="post-b-text">
            {betreff && <p className="post-b-betreff">{betreff}</p>}
            {absaetze.map((a, i) => {
              if (a.art === "liste") return <ul key={i} className="post-b-liste">{a.zeilen.map((z, j) => <li key={j}>{z}</li>)}</ul>;
              if (a.art === "hinweis") return <p key={i} className="post-b-hinweis">{a.zeilen.join(" ")}</p>;
              const mitQr = a.zeilen.some(z => z.includes(link));
              return (
                <p key={i} className={`post-b-absatz${mitQr ? " mit-qr" : ""}`} style={{ position: "relative" }}>
                  {a.zeilen.join(" ")}
                  {/* Daten-URL im skalierten Blatt – next/image bringt hier nichts */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {mitQr && qr && <span className="post-b-qr" style={{ top: 0 }}><img src={qr} alt="QR-Code zum Link" /></span>}
                </p>
              );
            })}
          </div>
          <div className="post-b-fuss">{[absender.name, absender.strasse, absender.plz_ort, absender.telefon, absender.email, absender.web].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
    </div>
  );
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
        <Blatt text={schau.text} empfaenger={schau.empfaenger} absender={schau.absender} link={schau.link} datumText={schau.datumText} qr={qr} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Seite

export default function PostSeite() {
  const [reiter, setReiter] = useState<Reiter>("briefe");
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
  const [gewaehltInfo, setGewaehltInfo] = useState<{ id: number; kandidaten: Kandidat[]; gesperrt: boolean } | null>(null);
  const [vorschauId, setVorschauId] = useState<number | null>(null);
  const [gross, setGross] = useState(false);
  const [heute] = useState(() => datumDeutsch(new Date()) as string);

  // Vorlage & Absender
  const [absenderForm, setAbsenderForm] = useState<Absender | null>(null);
  const [vorlageForm, setVorlageForm] = useState("");
  const [basisForm, setBasisForm] = useState("");

  // Sperrliste
  const [sperrliste, setSperrliste] = useState<Sperre[]>([]);
  const [sperrGrund, setSperrGrund] = useState("");

  const zeigeFehler = (e: unknown, sonst = "Ging nicht.") => setFehler(e instanceof Error ? e.message : sonst);

  const ladeBriefe = useCallback(() =>
    api("/api/admin/akquise/briefe").then(d => { setBriefe(d.briefe || []); setZaehler(d.zaehler || null); }).catch(zeigeFehler), []);
  const ladeStand = useCallback(() =>
    api("/api/admin/akquise/briefe?stand=1").then(d => setStand(d as Stand)).catch(() => setStand(null)), []);
  const ladeEinstellungen = useCallback(() =>
    api("/api/admin/akquise/post-einstellungen").then(d => {
      const e = d as Einstellungen;
      setEinst(e); setAbsenderForm(e.absender); setVorlageForm(e.vorlage); setBasisForm(e.landing_basis);
    }).catch(zeigeFehler), []);
  const ladeSperrliste = useCallback(() =>
    api("/api/admin/akquise/briefe?sperrliste=1").then(d => setSperrliste(d.sperrliste || [])).catch(zeigeFehler), []);

  useEffect(() => {
    // Reiter und vorgewaehlter Betrieb aus der Adresse (?tab=, ?betrieb=) –
    // erst nach dem Laden, nicht synchron im Effekt.
    const p = new URLSearchParams(window.location.search);
    const tab = p.get("tab") as Reiter | null;
    const betriebId = Number(p.get("betrieb"));
    Promise.all([ladeBriefe(), ladeStand(), ladeEinstellungen(), ladeSperrliste()]).then(() => {
      if (tab && ["briefe", "brief", "vorlage", "sperrliste"].includes(tab)) setReiter(tab);
      if (betriebId) setReiter("brief");
    }).finally(() => setLaedt(false));
    if (betriebId) {
      api("/api/admin/akquise/betriebe").then(d => {
        const b = (d.betriebe || []).find((x: BetriebKurz) => x.id === betriebId);
        if (b) setGewaehlt(b);
      }).catch(() => {});
    }
  }, [ladeBriefe, ladeStand, ladeEinstellungen, ladeSperrliste]);

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
      .then(d => { if (!weg) setGewaehltInfo({ id: gewaehltId, kandidaten: d.kandidaten || [], gesperrt: !!d.gesperrt }); })
      .catch(() => { if (!weg) setGewaehltInfo({ id: gewaehltId, kandidaten: [], gesperrt: false }); });
    return () => { weg = true; };
  }, [gewaehltId]);
  const infoZuGewaehlt = gewaehltInfo && gewaehltInfo.id === gewaehltId ? gewaehltInfo : null;

  const sichtbar = useMemo(() => briefe.filter(b => statusFilter === "alle" || b.status === statusFilter), [briefe, statusFilter]);

  // Was die Vorschau links zeigt – je nach Reiter: den offenen Entwurf (live),
  // den Entwurf, der fuer den gewaehlten Betrieb entstuende, die Vorlage mit
  // Beispielbetrieb (live), den gewaehlten Brief der Liste oder ein Beispiel.
  const schau = useMemo<Schau | null>(() => {
    if (!einst) return null;
    const beispiel = (vorlage: string, absender: Absender, basis: string, chip: string): Schau => {
      const l = landingLink(basis, VORSCHAU_TOKEN);
      return {
        chip, titel: BEISPIEL.name, absender, link: l, datumText: heute, empfaenger: empfaengerBlock(BEISPIEL) as string,
        text: briefFuellen(vorlage, { firma: BEISPIEL.name, ort: BEISPIEL.ort, befunde: BEFUNDE_BEISPIEL, link: l, absender, datum: heute }) as string,
      };
    };
    if (reiter === "vorlage" && absenderForm) return beispiel(vorlageForm, absenderForm, basisForm, "Vorlage");
    if (reiter === "brief" && editor) {
      return {
        chip: STATUS_LABEL[editor.brief.status] || editor.brief.status,
        titel: editor.brief.art === "test" ? "Testbrief an mich" : editor.betrieb?.name || editor.brief.betrieb_name || "",
        text, empfaenger: empf, absender: einst.absender, link, datumText: heute,
      };
    }
    if (reiter === "brief" && gewaehlt) {
      const l = landingLink(einst.landing_basis, VORSCHAU_TOKEN);
      const befunde = infoZuGewaehlt ? infoZuGewaehlt.kandidaten.filter(k => k.vorgewaehlt) : [];
      return {
        chip: infoZuGewaehlt ? "Noch kein Entwurf" : "Lädt …", titel: gewaehlt.name, absender: einst.absender, link: l, datumText: heute,
        empfaenger: empfaengerBlock(gewaehlt) as string,
        text: briefFuellen(einst.vorlage, { firma: gewaehlt.name, ort: gewaehlt.ort, befunde, link: l, absender: einst.absender, datum: heute }) as string,
      };
    }
    if (reiter === "briefe") {
      const b = sichtbar.find(x => x.id === vorschauId) || sichtbar[0];
      if (b) {
        return {
          chip: STATUS_LABEL[b.status] || b.status, titel: b.betrieb_name || `Betrieb ${b.betrieb_id}`, briefId: b.id,
          text: b.text || "", empfaenger: b.empfaenger || "", absender: einst.absender,
          link: landingLink(einst.landing_basis, b.token), datumText: datumAus(b.gesendet_am, heute),
        };
      }
    }
    return beispiel(einst.vorlage, einst.absender, einst.landing_basis, "Beispiel");
  }, [einst, reiter, absenderForm, vorlageForm, basisForm, editor, text, empf, link, gewaehlt, infoZuGewaehlt, sichtbar, vorschauId, heute]);

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
      editorSetzen({ brief: d.brief, betrieb: d.betrieb, kandidaten: d.kandidaten || [] });
      setReiter("brief");
      ladeBriefe();
    } catch (e) { zeigeFehler(e); }
  };

  const briefOeffnen = async (id: number) => {
    setFehler("");
    try {
      const d = await api(`/api/admin/akquise/briefe?id=${id}`);
      editorSetzen({ brief: d.brief, betrieb: d.betrieb, kandidaten: d.kandidaten || [] });
      setReiter("brief");
    } catch (e) { zeigeFehler(e); }
  };

  const patch = async (id: number, aenderung: Record<string, unknown>) => {
    const d = await api("/api/admin/akquise/briefe", { method: "PATCH", body: JSON.stringify({ id, ...aenderung }) });
    briefUebernehmen(d.brief);
    return d.brief as Brief;
  };

  const textAusVorlage = (befunde: Befund[]) => {
    if (!editor || !einst) return "";
    return briefFuellen(einst.vorlage, {
      firma: editor.betrieb?.name || editor.brief.betrieb_name || "", ort: editor.betrieb?.ort || "",
      befunde, link, absender: einst.absender, datum: datumDeutsch(new Date()),
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
      const bytes = await pdfErzeugen({ text, empfaenger: empf, absender: einst.absender, link, datum: datumDeutsch(new Date()) });
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

  const preisText = stand?.preis_cent != null ? `${euro(stand.preis_cent)} netto` : PREIS_FALLBACK;

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

  // Test ohne Post: das PDF als E-Mail ans eigene Postfach.
  const mailTest = (b: Brief) => mitSperre(b.id, async () => {
    const d = await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ aktion: "mailtest", id: b.id }) });
    setMeldung(`Test-E-Mail mit PDF an ${d.an} geschickt.`);
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
    });
  };

  const einstellungenSpeichern = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler(""); setMeldung("");
    try {
      await api("/api/admin/akquise/post-einstellungen", { method: "PUT", body: JSON.stringify({ absender: absenderForm, vorlage: vorlageForm, landing_basis: basisForm }) });
      await ladeEinstellungen();
      setMeldung("Gespeichert.");
    } catch (err) { zeigeFehler(err); }
  };

  const sperren = async (betrieb: BetriebKurz) => {
    setFehler("");
    try {
      await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ aktion: "sperren", betrieb_id: betrieb.id, grund: sperrGrund.trim() || "manuell" }) });
      setSperrGrund(""); setGewaehlt(null); setSuche("");
      await ladeSperrliste();
    } catch (e) { zeigeFehler(e); }
  };
  const entsperren = async (s: Sperre) => {
    if (!confirm(`„${s.name || s.betrieb_id}“ von der Sperrliste nehmen?`)) return;
    try {
      await api("/api/admin/akquise/briefe", { method: "POST", body: JSON.stringify({ aktion: "entsperren", id: s.id }) });
      await ladeSperrliste();
    } catch (e) { zeigeFehler(e); }
  };

  // ---- Anzeige

  const gesendetGesamt = (zaehler?.gesendet || 0) + (zaehler?.zugestellt || 0);
  const gewaehlteCodes = new Set(editor?.brief.befunde.map(b => b.code) || []);
  const imEntwurf = editor?.brief.status === "entwurf";
  const bearbeitbar = imEntwurf && !!einst;

  const aktionen = (b: Brief) => {
    const busy = beschaeftigt.has(b.id);
    const pdfLink = b.pdf_schluessel ? `/api/admin/akquise/briefe?pdf=${b.id}` : null;
    return (
      <span className="post-aktionen">
        <button className="akq-knopf" onClick={() => briefOeffnen(b.id)} disabled={busy}>Öffnen</button>
        {pdfLink && <a className="akq-knopf" href={pdfLink} target="_blank" rel="noopener noreferrer"><FileText size={13} /> PDF</a>}
        {pdfLink && <button className="akq-knopf" onClick={() => mailTest(b)} disabled={busy} title="PDF als E-Mail an mich – nichts wird gedruckt"><Mail size={13} /> Test-Mail</button>}
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
    <AdminShell titel="Post" eyebrow="Akquise" lead="Briefe an Betriebe: Vorschau, PDF, Versand.">
      {fehler && <p className="mb-4 text-sm" style={{ color: "#dc2626" }}>{fehler}</p>}
      {meldung && <p className="mb-4 text-sm" style={{ color: "#1d8a52" }}>{meldung}</p>}

      <div className="mon-kennzahlen">
        <Kachel titel="Entwürfe" wert={zahl(zaehler?.entwurf)} unter={zaehler?.fehler ? `${zaehler.fehler} mit Fehler` : undefined} />
        <Kachel titel="Freigegeben" wert={zahl(zaehler?.freigegeben)} />
        <Kachel titel="Gesendet" wert={zahl(gesendetGesamt)} unter={zaehler?.zugestellt ? `${zaehler.zugestellt} zugestellt` : undefined} />
        <Kachel titel="Aufrufe" wert={zahl(zaehler?.aufrufe)} unter="persönliche Seiten" />
        <Kachel titel="Demo angefordert" wert={zahl(zaehler?.demo)} />
      </div>

      <p className="post-versand">
        <i className={stand?.eingerichtet ? "" : "aus"} aria-hidden="true" />
        {stand?.eingerichtet ? (
          <>
            <span>Versand eingerichtet · {stand.anbieter} · {stand.modus === "live" ? "Live" : "Testmodus (Postbox, kein Druck)"}</span>
            {stand.guthaben_cent != null && <span>Guthaben {euro(stand.guthaben_cent)}</span>}
            <span>Brief s/w einseitig: {preisText}</span>
          </>
        ) : (
          <span>Versand nicht eingerichtet – LETTERXPRESS_USER und LETTERXPRESS_KEY in Cloudflare hinterlegen.</span>
        )}
      </p>

      <div className="post-reiter" role="tablist">
        {([["briefe", "Briefe"], ["brief", editor ? "Brief" : "Neuer Brief"], ["vorlage", "Vorlage & Absender"], ["sperrliste", "Sperrliste"]] as [Reiter, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={reiter === k} className={reiter === k ? "aktiv" : ""} onClick={() => setReiter(k)}>
            {l}{k === "briefe" && briefe.length > 0 && <b>{briefe.length}</b>}{k === "sperrliste" && sperrliste.length > 0 && <b>{sperrliste.length}</b>}
          </button>
        ))}
      </div>

      {/* Wie bei „Content erstellen“: links die Vorschau, sie bleibt beim
          Scrollen stehen; rechts der Reiter. Nur die Sperrliste braucht keine. */}
      {reiter !== "sperrliste" && (
      <div className={`post-arbeit${schau ? "" : " ohne-schau"}`}>
        {schau && (
          <aside className="post-schau" aria-label="Vorschau">
            <div className="post-schau-kopf">
              <span className="post-schau-titel">Vorschau</span>
              <span className="post-schau-chip">{schau.chip}</span>
              <span className="post-schau-name" title={schau.titel}>{schau.titel}</span>
              <button type="button" className="akq-knopf akq-symbol" onClick={() => setGross(true)} title="Groß ansehen" aria-label="Vorschau groß ansehen">
                <Maximize2 size={14} />
              </button>
            </div>
            <Blatt text={schau.text} empfaenger={schau.empfaenger} absender={schau.absender} link={schau.link} datumText={schau.datumText} qr={qr} />
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
        <section className="mon-block">
          <div className="akq-steuerung mb-4">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field px-3 py-2 text-sm" style={{ width: "auto" }}>
              <option value="alle">Alle Status</option>
              {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
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
                    {sichtbar.map(b => {
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
                            {b.demo_angefordert && <span className="post-unter post-demo">Demo {datum(b.demo_angefordert)}</span>}
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
                      {b.name}<span>{[b.ort, b.kategorie ? KATEGORIE_LABEL[b.kategorie] || b.kategorie : null, BETRIEB_STATUS[b.status]].filter(Boolean).join(" · ")}</span>
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
                  {gewaehlt.website ? <a href={gewaehlt.website} target="_blank" rel="noopener noreferrer" className="akq-link">{gewaehlt.website}</a> : "keine Website"}
                  {" · "}{gewaehlt.geprueft_am ? `geprüft ${datum(gewaehlt.geprueft_am)}` : "noch nicht geprüft"}
                  {" · "}Status {BETRIEB_STATUS[gewaehlt.status] || gewaehlt.status}
                </p>
                {!gewaehlt.geprueft_am && <p className="post-warnung">Ohne Prüfung gibt es keine Befunde. Erst unter Betriebe prüfen.</p>}
                {infoZuGewaehlt?.gesperrt && <p className="post-warnung">Steht auf der Sperrliste – nur der Testbrief an mich geht.</p>}
              </div>
              <div className="post-aktionen">
                <button className="btn-primary px-4 py-2 text-sm disabled:opacity-60" onClick={() => entwurfAnlegen(gewaehlt, "brief")} disabled={!!infoZuGewaehlt?.gesperrt}>Entwurf anlegen</button>
                <button className="akq-knopf" onClick={() => entwurfAnlegen(gewaehlt, "nachfass")} disabled={!!infoZuGewaehlt?.gesperrt}>Nachfass</button>
                <button className="akq-knopf" onClick={() => entwurfAnlegen(gewaehlt, "test")} title="Gleicher Brief, aber an meine Anschrift">Testbrief an mich</button>
              </div>
            </div>
          )}
          <p className="post-hinweis">Ein Entwurf bekommt Anschrift, die drei stärksten Befunde der letzten Prüfung und den Text aus der Vorlage – so, wie links in der Vorschau. Danach lässt sich alles ändern.</p>
        </section>
      )}

      {reiter === "brief" && editor && einst && (
        <section className="mon-block">
          <div className="post-editor-kopf">
            <h2>{editor.brief.art === "test" ? "Testbrief an mich" : editor.betrieb?.name || editor.brief.betrieb_name}</h2>
            <StatusBadge status={editor.brief.status} />
            <span className="akq-hinweis">{ART_LABEL[editor.brief.art]} · angelegt {datum(editor.brief.angelegt)}</span>
            {editor.betrieb && <span className="akq-hinweis">Betrieb: {BETRIEB_STATUS[editor.betrieb.status] || editor.betrieb.status}</span>}
            <a href={link} target="_blank" rel="noopener noreferrer" className="akq-link text-sm">{link}</a>
            <span className="akq-trenner" aria-hidden="true" />
            <button className="akq-knopf" onClick={() => editorSetzen(null)}>Schließen</button>
          </div>
          {editor.brief.status === "fehler" && editor.brief.fehler && <p className="post-fehlertext mb-3">{editor.brief.fehler}</p>}

          <div className="post-editor">
            <div>
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
                {bearbeitbar && <p className="post-hinweis">Ankreuzen setzt den Text aus der Vorlage neu – eigene Änderungen im Text gehen dabei verloren.</p>}
              </div>

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
                <p className="post-hinweis">Erste Zeile ist der Betreff, „– “ am Zeilenanfang ergibt einen Aufzählungspunkt, unter „---“ steht der Hinweis in kleiner Schrift.</p>
              </div>

              <div className="post-abschnitt">
                <p className="post-abschnitt-titel">PDF und Versand</p>
                <div className="post-pdf-stand">
                  {imEntwurf && (
                    <button className="btn-primary px-4 py-2 text-sm disabled:opacity-60" onClick={pdfBauen} disabled={pdfLauf || !anschriftVollstaendig(empf)}>
                      {pdfLauf ? "Erzeugt…" : editor.brief.pdf_schluessel ? "PDF neu erzeugen" : "PDF erzeugen"}
                    </button>
                  )}
                  {editor.brief.pdf_schluessel ? (
                    <a className="akq-knopf" href={`/api/admin/akquise/briefe?pdf=${editor.brief.id}`} target="_blank" rel="noopener noreferrer"><FileText size={13} /> PDF liegt vor – öffnen</a>
                  ) : <span className="post-leise">Noch kein PDF.</span>}
                  {editor.brief.pdf_schluessel && (
                    <button className="akq-knopf" onClick={() => mailTest(editor.brief)} disabled={beschaeftigt.has(editor.brief.id)}
                            title="PDF als E-Mail an mich – nichts wird gedruckt"><Mail size={13} /> Test per E-Mail</button>
                  )}
                  {imEntwurf && (
                    <button className="akq-knopf" disabled={!editor.brief.pdf_schluessel || beschaeftigt.has(editor.brief.id)} onClick={() => statusSetzen(editor.brief, "freigegeben")}>Freigeben</button>
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
                {!stand?.eingerichtet && <p className="post-hinweis">Briefversand nicht eingerichtet. PDF, Freigabe und „Test per E-Mail“ gehen trotzdem.</p>}
                {editor.brief.art !== "test" && editor.betrieb && imEntwurf && (
                  <p className="post-hinweis">
                    <button type="button" className="akq-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }}
                            onClick={() => { if (confirm(`„${editor.betrieb?.name}“ auf die Sperrliste – keine Post mehr?`)) sperren(editor.betrieb as BetriebKurz).then(() => editorSetzen(null)); }}>
                      Betrieb sperren
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Vorlage & Absender */}
      {reiter === "vorlage" && einst && absenderForm && (
        <form onSubmit={einstellungenSpeichern} className="mon-block">
          <h2>Absender</h2>
          <div className="post-form">
            {([["name", "Name"], ["zusatz", "Zusatz"], ["strasse", "Straße"], ["plz_ort", "PLZ Ort"], ["telefon", "Telefon"], ["email", "E-Mail"], ["web", "Web"]] as [keyof Absender, string][]).map(([k, l]) => (
              <div key={k}>
                <label htmlFor={`abs-${k}`}>{l}</label>
                <input id={`abs-${k}`} className="field px-3 py-2 text-sm" value={absenderForm[k] || ""}
                       onChange={e => setAbsenderForm({ ...absenderForm, [k]: e.target.value })} />
              </div>
            ))}
            <div>
              <label htmlFor="basis">Link-Basis der persönlichen Seiten</label>
              <input id="basis" className="field px-3 py-2 text-sm" value={basisForm} onChange={e => setBasisForm(e.target.value)} />
            </div>
          </div>

          <h2 className="mt-6">Vorlage</h2>
          <textarea className="field px-3 py-2 post-text" value={vorlageForm} onChange={e => setVorlageForm(e.target.value)} rows={24} spellCheck />
          <p className="post-hinweis">Erste Zeile ist der Betreff. „---“ trennt den Hinweis in kleiner Schrift ab. Keine Ausrufezeichen, keine Superlative – der Brief soll nachprüfbar bleiben.</p>
          <p className="post-abschnitt-titel mt-4">Platzhalter</p>
          <ul className="post-platzhalter">
            {einst.platzhalter.map(p => <li key={p.name}><code>{p.name}</code><span>{p.erklaerung}</span></li>)}
          </ul>
          <div className="akq-steuerung mt-5">
            <button type="submit" className="btn-primary px-4 py-2 text-sm">Speichern</button>
            <button type="button" className="akq-knopf" onClick={() => { setAbsenderForm(einst.standard.absender); setVorlageForm(einst.standard.vorlage); setBasisForm(einst.standard.landing_basis); }}>
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

      {/* ---------------- Sperrliste */}
      {reiter === "sperrliste" && (
        <section className="mon-block">
          <h2>Sperrliste</h2>
          <p className="post-hinweis mb-4">Wer hier steht, bekommt keinen Brief – der Abgleich läuft vor jedem Entwurf und vor jedem Versand. Einträge kommen von der persönlichen Seite („Keine weitere Post“) oder von Hand.</p>
          <div className="post-suche mb-4">
            <div className="akq-steuerung">
              <input value={suche} onChange={e => sucheTippen(e.target.value)} placeholder="Betrieb suchen" className="field px-3 py-2 text-sm" style={{ width: 240 }} />
              <input value={sperrGrund} onChange={e => setSperrGrund(e.target.value)} placeholder="Grund (optional)" className="field px-3 py-2 text-sm" style={{ width: 220 }} />
              {gewaehlt && <button className="btn-primary px-4 py-2 text-sm" onClick={() => sperren(gewaehlt)}>„{gewaehlt.name}“ sperren</button>}
            </div>
            {treffer.length > 0 && (
              <ul className="post-treffer">
                {treffer.map(b => (
                  <li key={b.id}><button type="button" onClick={() => { setGewaehlt(b); setTreffer([]); setSuche(""); }}>{b.name}<span>{b.ort || ""}</span></button></li>
                ))}
              </ul>
            )}
          </div>
          {sperrliste.length === 0 ? <p className="mon-leer">Niemand gesperrt.</p> : (
            <div className="post-huelle">
              <table className="mon-tabelle post-tabelle">
                <thead><tr><th>Betrieb</th><th>Ort</th><th>Grund</th><th>Seit</th><th></th></tr></thead>
                <tbody>
                  {sperrliste.map(s => (
                    <tr key={s.id}>
                      <td className="stark">{s.name || `Betrieb ${s.betrieb_id}`}</td>
                      <td>{s.ort || "—"}</td>
                      <td>{s.grund || "—"}</td>
                      <td>{datum(s.angelegt)}</td>
                      <td><button className="akq-knopf" onClick={() => entsperren(s)}>Entsperren</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AdminShell>
  );
}
