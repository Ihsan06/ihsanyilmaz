"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpToLine, Check, ChevronDown, ChevronUp, CircleAlert, Download, Loader2, Mail, Plus, RefreshCw, RotateCcw, Search, Star, Trash2, Undo2 } from "lucide-react";
import { useSeiten } from "@/components/admin/Seiten";
import AdminShell, { api, datum, InfoTipp } from "@/components/admin/AdminShell";
import Karte from "./Karte";

// Akquise-Cockpit: Autohaeuser aus OpenStreetMap holen, ihre Websites vom
// Server pruefen lassen und die Liste sortier- und filterbar zeigen.
// Die Bewertung selbst passiert in functions/_lib/akquise.js – hier wird
// nur gesteuert, gefiltert und angezeigt.
//
// Drei Dinge holt der BROWSER, weil die Function dafuer zu wenig CPU hat
// oder die Dienste zu langsam sind, und reicht nur das Ergebnis weiter:
//   Overpass  (Betriebe suchen)      → POST /suche { region, bbox, elements }
//   Wayback   (archive.org/available) → PATCH /pruefen { wayback }
// Google Places laeuft serverseitig (kleine Antwort, Schluessel bleibt geheim).

type Signal = { code: string; text: string; punkte: number; seite: "website" | "betrieb" };

type LetztePruefung = {
  zeitpunkt: string;
  erreichbar: number | null; https: number | null; viewport: number | null;
  cms: string | null; baukasten: string | null; copyright_jahr: number | null;
  psi_leistung: number | null;
  psi_fehler?: string | null;
  wayback_erster: string | null; wayback_letzter: string | null; wayback_anzahl: number | null;
  fehler: string | null;
};

// Volle Pruefung aus GET /pruefen?id= – mehr Spalten als in der Liste.
type PruefungVoll = LetztePruefung & {
  id: number;
  psi_lcp: number | null; psi_cls: number | null;
  titel: string | null; generator: string | null;
  antwort_ms: number | null; groesse_kb: number | null;
  impressum: number | null; datenschutz: number | null; schema_org: number | null;
  signale: Signal[] | string | null;
  roh?: { verifiziert_durch?: string[] } | null;
};

type Betrieb = {
  id: number;
  brief_gesendet?: string | null; brief_entwurf?: number; kontakt_erlaubt?: string | null; brief_zurueck?: string | null; anschrift_stand?: string | null;
  quelle: string; quelle_id: string | null;
  name: string; art: string | null; marken: string | null;
  strasse: string | null; plz: string | null; ort: string | null;
  lat: number | null; lng: number | null;
  telefon: string | null; email: string | null;
  website: string | null; website_quelle: string | null;
  oeffnungszeiten: string | null; region: string | null;
  status: string; notiz: string | null;
  score_website: number | null; score_betrieb: number | null; prioritaet: number | null;
  kategorie: string | null; auswahl: number; geloescht: string | null;
  google_place_id: string | null; google_bewertung: number | null; google_anzahl: number | null; google_stand: string | null;
  fahrzeuge: number | null; gruendungsjahr: number | null;
  geprueft_am: string | null; angelegt: string; geaendert: string;
  signale: Signal[] | null;
  letzte_pruefung: LetztePruefung | null;
};

type Lauf = { id: number; art: string; region: string | null; gefunden: number | null; neu: number | null; fehler: string | null; zeitpunkt: string };
type Stand = {
  betriebe: number; mitWebsite: number; ohneWebsite: number; nurBoerse: number; geprueft: number;
  prioHoch: number; auswahl: number; papierkorb: number; nachStatus: Record<string, number>; nachKategorie?: Record<string, number>; laeufe: Lauf[];
  google?: { eingerichtet: boolean; monat?: string; genutzt?: number; grenze?: number; frei?: number };
};

// Der Suchlauf in Schritten – jeder zeigt Zustand und Zahlen.
type SchrittKey = "osm" | "google" | "abgleich" | "doppelte" | "anschrift" | "pruefen";
type SchrittStand = { status: "wartet" | "laeuft" | "fertig" | "fehler" | "aus"; text: string; fertig?: number; gesamt?: number };
const SCHRITTE: { key: SchrittKey; titel: string }[] = [
  { key: "osm", titel: "OpenStreetMap" },
  { key: "google", titel: "Google Maps" },
  { key: "abgleich", titel: "Abgleich" },
  { key: "doppelte", titel: "Zusammenführen" },
  { key: "anschrift", titel: "Anschriften" },
  { key: "pruefen", titel: "Websites prüfen" },
];

type GoogleInfo = { google_place_id: string | null; google_bewertung: number | null; google_anzahl: number | null; google_stand: string | null };

// Antwort von POST/PATCH /pruefen und POST /google – alles optional, die
// Zeile uebernimmt, was da ist.
type PruefAntwort = {
  pruefung?: Partial<PruefungVoll>;
  score_website?: number; score_betrieb?: number; prioritaet?: number;
  signale?: Signal[];
  kategorie?: string | null;
  website?: string | null; website_quelle?: string | null;
  gefunden?: boolean; hinweis?: string;
  geraten?: { website: string; gruende: string[] };
  google?: GoogleInfo & { name?: string | null; adresse?: string | null };
  google_stand?: string;
  website_uebernommen?: boolean;
};

const STATUS: { wert: string; label: string }[] = [
  { wert: "neu", label: "Neu" },
  { wert: "beobachten", label: "Beobachten" },
  { wert: "brief", label: "Brief" },
  { wert: "kontakt", label: "Kontakt" },
  { wert: "kunde", label: "Kunde" },
  { wert: "aus", label: "Aus" },
];

const KATEGORIEN: { wert: string; label: string }[] = [
  { wert: "ohne_website", label: "Ohne Website" },
  { wert: "nur_boerse", label: "Nur Börse" },
  { wert: "baukasten", label: "Baukasten" },
  { wert: "veraltet", label: "Veraltet" },
  { wert: "mittel", label: "Mittel" },
  { wert: "gepflegt", label: "Gepflegt" },
];
// Ohne Kategorie: noch nicht geprueft oder Website nicht erreichbar.
const KAT_OFFEN = "offen";
const kategorieLabel = (k: string | null) => KATEGORIEN.find(x => x.wert === k)?.label || "—";

const QUELLE_LABEL: Record<string, string> = { osm: "OSM", manuell: "manuell", vermutet: "vermutet", bestaetigt: "bestätigt", google: "Google" };

// Lesbare Namen fuer die Signal-Codes im Filter – die Texte selbst tragen
// Zahlen ("© 2015 im Fuß") und taugen nicht als Auswahl.
const SIGNAL_LABEL: Record<string, string> = {
  keine_website: "Keine Website", nur_boerse: "Nur Börsen-Seite", website_vermutet: "Website geraten",
  website_google: "Website von Google", website_google_offen: "Google, nicht verifiziert",
  lange_still: "Lange keine Änderung", nicht_erreichbar: "Nicht erreichbar", kein_https: "Kein HTTPS",
  kein_viewport: "Kein Viewport", psi_schwach: "PageSpeed schwach", copyright_alt: "© alt", baukasten: "Baukasten",
  technik_alt: "Alte Technik", kein_impressum: "Kein Impressum", kein_datenschutz: "Kein Datenschutz",
  kein_schema: "Kein schema.org", bestand_nur_boerse: "Bestand nur Börse", kein_bestand: "Kein Bestand",
  langsam: "Langsam", kein_titel: "Kein Titel",
  vertragshaendler: "Vertragshändler", google_bewertungen: "Viele Google-Bewertungen", google_note: "Gute Google-Note",
  praesenz_alt: "Lange im Netz", rechtsform: "Eingetragene Gesellschaft", telefon: "Telefon bekannt",
  oeffnungszeiten: "Öffnungszeiten", mehrere_standorte: "Mehrere Standorte", werkstatt_und_handel: "Werkstatt und Handel",
  zusatzangebote: "Zusatzangebote", eigene_domain: "Eigene Domain",
  fahrzeuge: "Fahrzeuge im Bestand", gruendung: "Gründungsjahr",
};

// Kurz erklaert, was hinter den Zahlen steht (Info-Symbol im Spaltenkopf).
const ERKLAERUNG = {
  prio: "Priorität = 60 % Website-Schwäche + 40 % Betriebs-Stärke. Ab 60 lohnt ein Brief: schwache Website bei gesundem Betrieb.",
  kat: "Kategorie aus der Prüfung: Ohne Website · Nur Börse (nur mobile.de/AutoScout24-Seite) · Baukasten (Jimdo, Wix …) · Veraltet (Schwäche ≥ 50) · Mittel (25–49) · Gepflegt (< 25). Offen = noch nicht geprüft oder Seite nicht erreichbar.",
  schwaeche: "Website-Schwäche 0–100: Punkte aus den grauen Signalen, z. B. kein HTTPS, nicht fürs Handy gebaut, © alt, Baukasten, alte Technik, lange keine Änderung. Keine Website oder nur Börse = 100.",
  staerke: "Betriebs-Stärke 0–100: Punkte aus den grünen Signalen, z. B. Vertragshändler, viele Google-Bewertungen, lange im Netz, Fahrzeuge im Bestand, Gründungsjahr, Rechtsform.",
};

const REGIONEN = [
  { wert: "wuerzburg", label: "Würzburg, 25 km" },
  { wert: "unterfranken", label: "Unterfranken" },
  { wert: "oberfranken", label: "Oberfranken" },
  { wert: "ort", label: "Ort eingeben" },
];

// Reihenfolge = Reihenfolge der Versuche. overpass-api.de antwortet bei
// Last mit 504, kumi.systems haengt dann oft ebenfalls – der Spiegel von
// maps.mail.ru lieferte in dem Fall in 10 s (sendet ebenfalls ACAO *).
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 120_000;
const WAYBACK_TIMEOUT_MS = 15_000;
const PRUEF_ALTER_TAGE = 30;

// Haendlername – Spiegel von HAENDLER_RE in functions/_lib/akquise.js.
const HAENDLER_RE = /auto[\s-]?haus|automobil|auto[\s-]?handel|gebrauchtwagen|cars\b|autopark|autohalle|fahrzeughandel|autoverkauf|kfz\.?[\s-]?handel/i;

// Boersen und soziale Netze – Spiegel der Liste in functions/_lib/akquise.js,
// nur fuer die Anzeige ("Börsen-Seite") und den Website-Filter.
const BOERSEN_RE = /(?:^|\.)(?:mobile\.de|autoscout24\.[a-z]+|(?:ebay-)?kleinanzeigen\.de|ebay\.[a-z]+|facebook\.com|fb\.com|fb\.me|instagram\.com|google\.[a-z]+|g\.page|business\.site|goo\.gl|youtube\.com|youtu\.be|tiktok\.com|whatsapp\.com|wa\.me|linkedin\.com|xing\.com|gelbeseiten\.de|11880\.com|yelp\.[a-z]+|autohaus24\.de|pkw\.de|12gebrauchtwagen\.de|heycar\.[a-z]+|auto\.de|gebrauchtwagen\.de)$/i;

const zahl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("de-DE"));
const note = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(1).replace(".", ","));

function host(url: string | null) {
  if (!url) return "";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
const istBoerse = (url: string | null) => !!url && BOERSEN_RE.test(host(url));

// Websites von Google gelten ohne Rueckfrage – die frueheren Hinweise
// "von Google (nicht verifiziert)" stehen noch in alten Pruefungen und
// werden hier ausgeblendet.
const AUSGEBLENDET = new Set(["website_google", "website_google_offen"]);
function signaleLesen(roh: Signal[] | string | null | undefined): Signal[] {
  let liste: Signal[] = [];
  if (Array.isArray(roh)) liste = roh;
  else if (typeof roh === "string") { try { const p = JSON.parse(roh); liste = Array.isArray(p) ? p : []; } catch { liste = []; } }
  return liste.filter(x => !AUSGEBLENDET.has(x.code));
}

type DublettenBetrieb = { id: number; name: string; ort: string | null; plz: string | null; art: string | null; website: string | null };
type DublettenGruppe = { ids: number[]; haupt: number; sicher: boolean; grund: string; betriebe: DublettenBetrieb[] };

function zeitAlt(wert: string | null, tage: number) {
  if (!wert) return true;
  const t = new Date(wert.replace(" ", "T") + (wert.includes("Z") ? "" : "Z")).getTime();
  return isNaN(t) || Date.now() - t > tage * 86400000;
}
const brauchtPruefung = (b: Betrieb) => zeitAlt(b.geprueft_am, PRUEF_ALTER_TAGE);
// Nur wer noch nie bei Google abgefragt wurde. Frueher zaehlte auch jeder
// Betrieb ohne Website – Google kennt fuer ihn aber keine, und der Knopf
// stand nach jedem Lauf wieder mit derselben Zahl da.
const brauchtGoogle = (b: Betrieb) => !b.google_stand;
// Anschrift unvollstaendig: ohne Strasse, PLZ oder Ort kann kein Brief raus.
const ohneAnschrift = (b: Betrieb) => !b.strasse || !b.plz || !b.ort;
// Strasse ohne Hausnummer (OSM kennt sie manchmal nicht) – Brief kommt evtl. nicht an.
const ohneHausnummer = (b: Betrieb) => !!b.strasse && !/\d/.test(b.strasse);
// Automatisch ergaenzen nur einmal – danach bleibt es beim Eintrag von Hand.
const brauchtAnschrift = (b: Betrieb) => ohneAnschrift(b) && b.lat != null && !b.anschrift_stand;
const warte = (ms: number) => new Promise(r => setTimeout(r, ms));

// Wayback im Browser: archive.org/wayback/available erlaubt CORS, der
// CDX-Dienst nicht. Ohne timestamp kommt der juengste Snapshot, mit
// timestamp=1996 der aelteste. Der Dienst antwortet je nach Schreibweise
// verschieden – "auto-kilian.de" liefert nichts, "www.auto-kilian.de" den
// Snapshot von letzter Woche –, deshalb bei leerer Antwort die andere
// Schreibweise. Fehlt der juengste, bleibt "letzter" leer (sonst saehe die
// Seite seit dem ersten Snapshot unveraendert aus). Eine Anzahl gibt es
// auf diesem Weg nicht.
//
// archive.org bremst schnell (429 ohne CORS-Header, im Browser sichtbar
// als "blocked by CORS policy"): deshalb laufen alle Anfragen nacheinander
// mit Abstand, so wenige wie moeglich, ein Fehlschlag wird einmal
// wiederholt.
const WAYBACK_ABSTAND_MS = 800;
let waybackReihe: Promise<unknown> = Promise.resolve();
function waybackNacheinander<T>(fn: () => Promise<T>): Promise<T> {
  const p = waybackReihe.then(fn, fn);
  const pause = () => new Promise<void>(f => setTimeout(f, WAYBACK_ABSTAND_MS));
  waybackReihe = p.then(pause, pause);
  return p;
}

async function waybackAnfrage(ziel: string, zusatz: string, versuch = 1): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), WAYBACK_TIMEOUT_MS);
  try {
    const r = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(ziel)}${zusatz}`, { signal: ac.signal });
    if (!r.ok) return null;
    const d = await r.json();
    const ts = d?.archived_snapshots?.closest?.timestamp;
    return typeof ts === "string" && /^\d{8}/.test(ts) ? ts : null;
  } catch (e) {
    if (versuch < 2 && !(e instanceof DOMException && e.name === "AbortError")) {
      await new Promise(f => setTimeout(f, 3000));
      return waybackAnfrage(ziel, zusatz, versuch + 1);
    }
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function waybackHolen(website: string): Promise<{ erster: string | null; letzter: string | null; anzahl: null } | null> {
  const h = host(website);
  if (!h) return null;
  const hole = (ziel: string, zusatz: string) => waybackNacheinander(() => waybackAnfrage(ziel, zusatz));
  const letzter = (await hole(`www.${h}`, "")) || (await hole(h, ""));
  const erster = (await hole(h, "&timestamp=19960101")) || (await hole(`www.${h}`, "&timestamp=19960101"));
  if (!letzter && !erster) return null;
  // Der aelteste Treffer zaehlt als erster, auch wenn er aus der Abfrage
  // nach dem juengsten stammt.
  const fruehester = [erster, letzter].filter((x): x is string => !!x).sort()[0] || null;
  return { erster: fruehester, letzter: letzter || null, anzahl: null };
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
const OSM_TAGS = ["name", "shop", "brand", "addr:street", "addr:housenumber", "addr:postcode", "addr:city", "contact:phone", "phone", "contact:email", "email", "contact:website", "website", "opening_hours"];

// Nur die Tags mitschicken, die der Server liest – Unterfranken hat sonst
// schnell mehrere Megabyte.
function elementSchlank(e: OsmElement): OsmElement | null {
  if (!e || typeof e.id !== "number" || !e.tags?.name) return null;
  const tags: Record<string, string> = {};
  for (const k of OSM_TAGS) if (typeof e.tags[k] === "string") tags[k] = e.tags[k];
  const aus: OsmElement = { type: e.type, id: e.id, tags };
  if (typeof e.lat === "number" && typeof e.lon === "number") { aus.lat = e.lat; aus.lon = e.lon; }
  if (e.center && typeof e.center.lat === "number" && typeof e.center.lon === "number") aus.center = { lat: e.center.lat, lon: e.center.lon };
  return aus;
}

// Overpass im Browser: erst overpass-api.de, bei Fehler kumi.systems.
// Der Ticker zeigt, dass noch etwas passiert – 40 s sind normal.
async function overpassHolen(query: string, fortschritt: (text: string) => void): Promise<OsmElement[]> {
  let letzter: Error | null = null;
  for (const url of OVERPASS) {
    const start = Date.now();
    const kurz = url.includes("overpass-api.de") ? "Overpass" : `Overpass (Ersatz ${OVERPASS.indexOf(url)})`;
    fortschritt(`${kurz} läuft …`);
    const ticker = setInterval(() => fortschritt(`${kurz} läuft … ${Math.round((Date.now() - start) / 1000)} s`), 1000);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        method: "POST", signal: ac.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
      });
      if (!r.ok) throw new Error(`Overpass ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d?.elements)) throw new Error("Overpass: keine Elemente");
      return d.elements.map(elementSchlank).filter(Boolean) as OsmElement[];
    } catch (e) {
      letzter = e instanceof Error && e.name === "AbortError" ? new Error("Overpass: Zeitüberschreitung") : (e as Error);
    } finally {
      clearInterval(ticker);
      clearTimeout(t);
    }
  }
  throw letzter || new Error("Overpass nicht erreichbar");
}

function csvFeld(wert: unknown) {
  const s = wert == null ? "" : String(wert);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
}

// ---------------------------------------------------------------- Filter

type SortSchluessel = "auswahl" | "prioritaet" | "name" | "website" | "kategorie" | "score_website" | "score_betrieb" | "google" | "geprueft";
type Sortierung = { schluessel: SortSchluessel; ab: boolean };
type Filter = {
  q: string; kat: string[]; art: string; web: string; gep: string; sig: string[];
  prio: string; region: string; auswahl: boolean; papierkorb: boolean; ohneBrief: boolean; sort: Sortierung[];
};
const FILTER_LEER: Filter = {
  q: "", kat: [], art: "alle", web: "alle", gep: "alle", sig: [], prio: "", region: "alle",
  auswahl: false, papierkorb: false, ohneBrief: false, sort: [{ schluessel: "prioritaet", ab: true }],
};
const SORT_LABEL: Record<SortSchluessel, string> = {
  auswahl: "Auswahl", prioritaet: "Priorität", name: "Name", website: "Website", kategorie: "Kategorie",
  score_website: "Schwäche", score_betrieb: "Stärke", google: "Google-Bewertungen", geprueft: "Zuletzt geprüft",
};
const SORT_SCHLUESSEL: SortSchluessel[] = ["auswahl", "prioritaet", "name", "website", "kategorie", "score_website", "score_betrieb", "google", "geprueft"];
// Text-Spalten steigen beim ersten Klick, Zahlen fallen – so, wie man es
// jeweils lesen will.
const SORT_TEXT = new Set<SortSchluessel>(["name", "website", "kategorie"]);

// Rueckweg von „Post“: Filter-URL und Zeile merken, die Post-Seite zeigt dann
// „Zurück zu Betriebe“ und springt per #betrieb-<id> wieder an dieselbe Stelle.
const RUECKWEG = "akquise.rueckweg";
const SPRUNG = "akquise.sprung";
function rueckwegMerken(b: { id: number; name: string }) {
  try {
    sessionStorage.setItem(RUECKWEG, JSON.stringify({ url: window.location.pathname + window.location.search, id: b.id, name: b.name }));
  } catch { /* privat oder gesperrt – dann eben ohne Rueckweg */ }
}

// Zustand in der URL: ?q=…&kat=a,b&sort=prioritaet:ab,name:auf – Reload und
// Teilen behalten Filter und Sortierung.
function filterAusUrl(search: string): Filter {
  const p = new URLSearchParams(search);
  const liste = (k: string) => (p.get(k) || "").split(",").map(s => s.trim()).filter(Boolean);
  const sort: Sortierung[] = liste("sort").map(s => {
    const [k, r] = s.split(":");
    return SORT_SCHLUESSEL.includes(k as SortSchluessel) ? { schluessel: k as SortSchluessel, ab: r !== "auf" } : null;
  }).filter((s): s is Sortierung => !!s);
  return {
    q: p.get("q") || "", kat: liste("kat"), art: p.get("art") || "alle", web: p.get("web") || "alle",
    gep: p.get("gep") || "alle", sig: liste("sig"), prio: p.get("prio") || "", region: p.get("region") || "alle",
    auswahl: p.get("auswahl") === "1", papierkorb: p.get("papierkorb") === "1", ohneBrief: p.get("ohneBrief") === "1",
    sort: sort.length ? sort : FILTER_LEER.sort,
  };
}

function filterInUrl(f: Filter) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.kat.length) p.set("kat", f.kat.join(","));
  if (f.art !== "alle") p.set("art", f.art);
  if (f.web !== "alle") p.set("web", f.web);
  if (f.gep !== "alle") p.set("gep", f.gep);
  if (f.sig.length) p.set("sig", f.sig.join(","));
  if (f.prio) p.set("prio", f.prio);
  if (f.region !== "alle") p.set("region", f.region);
  if (f.auswahl) p.set("auswahl", "1");
  if (f.papierkorb) p.set("papierkorb", "1");
  if (f.ohneBrief) p.set("ohneBrief", "1");
  const sortStd = f.sort.length === 1 && f.sort[0].schluessel === "prioritaet" && f.sort[0].ab;
  if (!sortStd) p.set("sort", f.sort.map(s => `${s.schluessel}:${s.ab ? "ab" : "auf"}`).join(","));
  const s = p.toString();
  return `${window.location.pathname}${s ? `?${s}` : ""}`;
}

const filterAktiv = (f: Filter) =>
  !!f.q || f.kat.length > 0 || f.art !== "alle" || f.web !== "alle" || f.gep !== "alle" || f.sig.length > 0 || !!f.prio || f.region !== "alle" || f.auswahl || f.ohneBrief;

function sortWert(b: Betrieb, k: SortSchluessel): number | string | null {
  switch (k) {
    case "auswahl": return b.auswahl ? 1 : 0;
    case "prioritaet": return b.prioritaet;
    case "name": return b.name;
    case "website": return b.website ? host(b.website) : null;
    case "kategorie": { const i = KATEGORIEN.findIndex(x => x.wert === b.kategorie); return i < 0 ? null : i; }
    case "score_website": return b.score_website;
    case "score_betrieb": return b.score_betrieb;
    case "google": return b.google_anzahl;
    case "geprueft": return b.geprueft_am;
  }
}

// Leere Werte stehen immer unten, egal in welche Richtung sortiert wird.
function vergleichen(x: Betrieb, y: Betrieb, sort: Sortierung[]) {
  for (const s of sort) {
    const a = sortWert(x, s.schluessel), b = sortWert(y, s.schluessel);
    if (a === b) continue;
    if (a == null) return 1;
    if (b == null) return -1;
    const c = typeof a === "string" ? a.localeCompare(String(b), "de") : Number(a) - Number(b);
    if (c) return s.ab ? -c : c;
  }
  return x.name.localeCompare(y.name, "de");
}

function filterAnwenden(betriebe: Betrieb[], f: Filter) {
  const q = f.q.trim().toLowerCase();
  const prio = f.prio === "" ? null : Number(f.prio);
  return betriebe
    .filter(b => !q || b.name.toLowerCase().includes(q) || (b.ort || "").toLowerCase().includes(q) || host(b.website).toLowerCase().includes(q))
    .filter(b => !f.kat.length || f.kat.includes(b.kategorie || KAT_OFFEN))
    .filter(b => f.art === "alle" || b.art === f.art)
    .filter(b => {
      switch (f.web) {
        case "mit": return !!b.website;
        case "ohne": return !b.website;
        case "vermutet": return b.website_quelle === "vermutet";
        case "boerse": return istBoerse(b.website) || b.kategorie === "nur_boerse";
        default: return true;
      }
    })
    .filter(b => {
      switch (f.gep) {
        case "ja": return !!b.geprueft_am;
        case "nein": return !b.geprueft_am;
        case "alt": return !!b.geprueft_am && brauchtPruefung(b);
        default: return true;
      }
    })
    .filter(b => !f.sig.length || f.sig.every(code => (b.signale || []).some(s => s.code === code)))
    .filter(b => prio === null || isNaN(prio) || (b.prioritaet ?? -1) >= prio)
    .filter(b => f.region === "alle" || b.region === f.region)
    .filter(b => !f.auswahl || !!b.auswahl)
    .filter(b => !f.ohneBrief || !b.brief_gesendet)
    .sort((x, y) => vergleichen(x, y, f.sort));
}

// ---------------------------------------------------------------- Bausteine

// Kennzahl als Knopf: ein Klick setzt den passenden Filter, ein zweiter hebt
// ihn auf. Der farbige Streifen zeigt die Kategorie wie auf der Karte.
function KpiKachel({ titel, wert, aktiv, onClick, farbe, akzent }: {
  titel: string; wert: string; aktiv?: boolean; onClick: () => void; farbe?: string; akzent?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!aktiv}
            className={`akq-kpi${aktiv ? " an" : ""}${akzent ? " akzent" : ""}${farbe ? ` kat-${farbe}` : ""}`}>
      <span className="akq-kpi-titel">{titel}</span>
      <span className="akq-kpi-wert">{wert}</span>
    </button>
  );
}

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const monatName = (m?: string) => (m && /^\d{4}-\d{2}$/.test(m) ? MONATE[Number(m.slice(5, 7)) - 1] : "Monat");

function Prio({ wert }: { wert: number | null }) {
  if (wert == null) return <span className="text-[var(--fg-subtle)]">—</span>;
  return (
    <span className="akq-prio">
      <b className={wert >= 60 ? "hoch" : ""}>{wert}</b>
      <span className="akq-prio-balken" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, wert))}%` }} /></span>
    </span>
  );
}

function KategorieChip({ wert }: { wert: string | null }) {
  if (!wert) return <span className="text-[var(--fg-subtle)]">—</span>;
  return <span className={`akq-kat ${wert}`}>{kategorieLabel(wert)}</span>;
}

// Mehrfachauswahl als Knopf mit Liste – fuer die Signale.
function MehrfachWahl({ label, optionen, wert, onChange }: {
  label: string; optionen: { wert: string; label: string }[]; wert: string[]; onChange: (v: string[]) => void;
}) {
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOffen(false); };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);
  return (
    <div className="akq-wahl" ref={ref}>
      <button type="button" className={`akq-knopf${wert.length ? " aktiv" : ""}`} onClick={() => setOffen(o => !o)} aria-expanded={offen}>
        {label}{wert.length ? ` (${wert.length})` : ""} <ChevronDown size={12} />
      </button>
      {offen && (
        <div className="akq-wahl-liste">
          {optionen.length === 0 && <span className="mon-leer">Nichts vorhanden</span>}
          {optionen.map(o => (
            <label key={o.wert}>
              <input type="checkbox" checked={wert.includes(o.wert)}
                     onChange={e => onChange(e.target.checked ? [...wert, o.wert] : wert.filter(x => x !== o.wert))} />
              {o.label}
            </label>
          ))}
          {wert.length > 0 && <button type="button" className="akq-wahl-leeren" onClick={() => onChange([])}>Auswahl leeren</button>}
        </div>
      )}
    </div>
  );
}

function QuelleBadge({ b, bestaetigen, verwerfen }: { b: Betrieb; bestaetigen: (b: Betrieb) => void; verwerfen: (b: Betrieb) => void }) {
  const q = b.website_quelle;
  if (!b.website || !q) return null;
  // Nur geratene Websites brauchen eine Bestaetigung; Google gilt.
  const offen = q === "vermutet";
  return (
    <span className={`akq-quelle ${q}`}>
      {QUELLE_LABEL[q] || q}
      {offen && (
        <>
          <button type="button" onClick={() => bestaetigen(b)} title="Website bestätigen" aria-label="Website bestätigen">✓</button>
          <button type="button" onClick={() => verwerfen(b)} title="Website verwerfen" aria-label="Website verwerfen">✕</button>
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- Seite

// useSearchParams braucht bei statischem Export eine Suspense-Grenze –
// die sitzt in AkquiseSeite ganz unten.
function AkquiseCockpit() {
  const suchparameter = useSearchParams();
  // null = noch nicht geladen; beim Wechsel Papierkorb/aktiv wieder null.
  const [betriebe, setBetriebe] = useState<Betrieb[] | null>(null);
  const [stand, setStand] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState("");
  // Kurze Meldung unten in der Mitte – nach dem Papierkorb mit "Rueckgaengig".
  const [meldung, setMeldung] = useState<{ text: string; zurueck?: Betrieb; sterne?: { ids: number[]; an: boolean } } | null>(null);
  const meldungTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter und Sortierung stehen in der URL, damit Reload und Teilen sie behalten.
  const [filter, setFilter] = useState<Filter>(() => filterAusUrl(suchparameter.toString()));

  // Suche
  const [region, setRegion] = useState("wuerzburg");
  const [ort, setOrt] = useState("");
  const [radius, setRadius] = useState("25");
  // Suchlauf: ein Klick fuer alles – OSM, Google, Abgleich, Zusammenfuehren,
  // Pruefen. "laeuft" sperrt die Knoepfe, "ablauf" zeigt die Schritte.
  const [laeuft, setLaeuft] = useState(false);
  const [ablauf, setAblauf] = useState<Record<SchrittKey, SchrittStand> | null>(null);

  // Zeilenzustand
  const [inArbeit, setInArbeit] = useState<Set<number>>(new Set());
  const [hinweise, setHinweise] = useState<Record<number, { text: string; fehler: boolean }>>({});
  const abbruch = useRef(false);
  const hinweisTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // Zeile auf/zu und die vollen Pruefdaten dazu
  const [offen, setOffen] = useState<Set<number>>(new Set());
  const [verlauf, setVerlauf] = useState<Record<number, PruefungVoll[]>>({});

  // Anlegen
  const [formOffen, setFormOffen] = useState(false);
  const [neu, setNeu] = useState({ name: "", website: "", ort: "" });

  const ladeStand = useCallback(() =>
    api("/api/admin/akquise/stand").then(d => setStand(d as Stand)).catch(() => setStand(null)), []);

  const [dubletten, setDubletten] = useState<DublettenGruppe[] | null>(null);
  const [dublettenOffen, setDublettenOffen] = useState(false);
  const [fuehrtZusammen, setFuehrtZusammen] = useState(false);
  const ladeDubletten = useCallback(() =>
    api("/api/admin/akquise/dubletten").then(d => setDubletten((d.gruppen || []) as DublettenGruppe[])).catch(() => setDubletten(null)), []);

  // Aktive Betriebe frisch vom Server – der Suchlauf braucht nach jedem
  // Schritt den echten Stand, nicht den der letzten Anzeige.
  const holeAktive = useCallback(async (): Promise<Betrieb[]> => {
    const d = await api("/api/admin/akquise/betriebe");
    return (d.betriebe || []).map((b: Betrieb) => ({ ...b, signale: signaleLesen(b.signale) }));
  }, []);
  const ladeListe = useCallback((papierkorb: boolean) =>
    api(`/api/admin/akquise/betriebe${papierkorb ? "?papierkorb=1" : ""}`)
      .then(d => setBetriebe((d.betriebe || []).map((b: Betrieb) => ({ ...b, signale: signaleLesen(b.signale) }))))
      .catch(e => { setBetriebe([]); setFehler(e instanceof Error ? e.message : "Ging nicht."); }), []);
  const googleEingerichtet = stand?.google ? stand.google.eingerichtet : null;

  // Zurueck von „Post“: #betrieb-<id> lesen, bevor der Filter-Effekt die URL
  // ohne Hash neu schreibt, und die Zeile anspringen, sobald sie gezeichnet
  // ist (die Liste kommt erst nach dem Laden; hoechstens 8 s warten).
  // Das Ziel kommt ueber sessionStorage (gesetzt vom Knopf auf der Post-Seite);
  // der Hash allein ueberlebt den Start der Seite nicht zuverlaessig.
  useEffect(() => {
    let id = /^#betrieb-\d+$/.test(window.location.hash) ? window.location.hash.slice(1) : "";
    // Nicht sofort loeschen: die Seite kann beim Start einmal neu eingehaengt
    // werden (Anmeldepruefung) – geloescht wird erst, wenn die Zeile gefunden
    // ist; aelter als 20 s gilt nicht mehr.
    try {
      const gemerkt = JSON.parse(sessionStorage.getItem(SPRUNG) || "null");
      if (gemerkt && Date.now() - gemerkt.t < 20000) id = `betrieb-${gemerkt.id}`;
    } catch { /* ohne Speicher nur per Hash */ }
    if (!id) return;
    // Der Browser stellt beim Laden gern die alte Position (oben) wieder her,
    // und Karte/Kacheln verschieben die Liste noch – deshalb bis zu 6 s lang
    // nachrichten, solange die Zeile nicht im Bild ist. Sobald der Nutzer
    // selbst scrollt oder tippt, ist Schluss.
    const vorher = history.scrollRestoration;
    history.scrollRestoration = "manual";
    let schluss = false, markiert = false;
    const stopp = () => { schluss = true; };
    const ereignisse = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    ereignisse.forEach(e => window.addEventListener(e, stopp, { passive: true }));
    const start = Date.now();
    const t = setInterval(() => {
      const ziel = document.getElementById(id);
      // Erst am Ende (oder wenn der Nutzer uebernimmt) den Merker loeschen –
      // haengt sich die Seite zwischendurch neu ein, springt sie erneut.
      if (schluss || Date.now() - start > 6000) {
        if (markiert) { try { sessionStorage.removeItem(SPRUNG); } catch { /* egal */ } }
        aufraeumen(); return;
      }
      if (!ziel) return;
      const r = ziel.getBoundingClientRect();
      // Sofort, nicht weich: die Seite scrollt sonst ueber Sekunden hinterher.
      if (r.top < 80 || r.bottom > window.innerHeight - 40) ziel.scrollIntoView({ block: "center", behavior: "instant" });
      if (!markiert) { markiert = true; ziel.classList.add("blitz"); setTimeout(() => ziel.classList.remove("blitz"), 2200); }
    }, 150);
    function aufraeumen() {
      clearInterval(t);
      ereignisse.forEach(e => window.removeEventListener(e, stopp));
      history.scrollRestoration = vorher;
    }
    return aufraeumen;
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", filterInUrl(filter));
  }, [filter]);

  // Die Liste kommt je nach Ansicht (aktiv / Papierkorb) neu vom Server.
  useEffect(() => {
    ladeListe(filter.papierkorb);
    ladeStand();
  }, [filter.papierkorb, ladeListe, ladeStand]);
  useEffect(() => { ladeDubletten(); }, [ladeDubletten]);

  // gruppen: bestimmte Gruppen; ohne: alle sicheren.
  const zusammenfuehren = async (gruppen?: number[][]) => {
    setFuehrtZusammen(true); setFehler("");
    try {
      await api("/api/admin/akquise/dubletten", { method: "POST", body: JSON.stringify(gruppen ? { gruppen } : {}) });
      await Promise.all([ladeListe(filter.papierkorb), ladeStand(), ladeDubletten()]);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Zusammenführen ging nicht.");
    } finally {
      setFuehrtZusammen(false);
    }
  };

  const setzeFilter = (aenderung: Partial<Filter>) => setFilter(f => ({ ...f, ...aenderung }));
  const papierkorbSchalten = (an: boolean) => { setBetriebe(null); setzeFilter({ papierkorb: an }); };

  const zeileAendern = (id: number, aenderung: Partial<Betrieb>) =>
    setBetriebe(liste => (liste ? liste.map(b => (b.id === id ? { ...b, ...aenderung } : b)) : liste));

  // Kurzer Text in der Zeile ("Prüft …", "Geprüft", Fehler). Ohne Dauer
  // bleibt er stehen, bis der naechste kommt.
  const hinweisSetzen = (id: number, text: string, istFehler = false, dauerMs = 0) => {
    clearTimeout(hinweisTimer.current[id]);
    setHinweise(h => ({ ...h, [id]: { text, fehler: istFehler } }));
    if (dauerMs) hinweisTimer.current[id] = setTimeout(() => setHinweise(h => { const k = { ...h }; delete k[id]; return k; }), dauerMs);
  };

  // Antwort von /pruefen oder /google in die Zeile uebernehmen.
  const pruefungUebernehmen = (id: number, a: PruefAntwort) => {
    const aenderung: Partial<Betrieb> = {};
    if (typeof a.score_website === "number") aenderung.score_website = a.score_website;
    if (typeof a.score_betrieb === "number") aenderung.score_betrieb = a.score_betrieb;
    if (typeof a.prioritaet === "number") aenderung.prioritaet = a.prioritaet;
    if (a.signale) aenderung.signale = signaleLesen(a.signale);
    if (a.kategorie !== undefined) aenderung.kategorie = a.kategorie;
    if (a.website !== undefined) aenderung.website = a.website;
    if (a.website_quelle !== undefined) aenderung.website_quelle = a.website_quelle;
    if (a.google) {
      aenderung.google_place_id = a.google.google_place_id;
      aenderung.google_bewertung = a.google.google_bewertung;
      aenderung.google_anzahl = a.google.google_anzahl;
      aenderung.google_stand = a.google.google_stand;
    }
    if (a.pruefung) {
      const p = a.pruefung;
      aenderung.letzte_pruefung = {
        zeitpunkt: p.zeitpunkt || new Date().toISOString(),
        erreichbar: p.erreichbar ?? null, https: p.https ?? null, viewport: p.viewport ?? null,
        cms: p.cms ?? null, baukasten: p.baukasten ?? null, copyright_jahr: p.copyright_jahr ?? null,
        psi_leistung: p.psi_leistung ?? null,
        wayback_erster: p.wayback_erster ?? null, wayback_letzter: p.wayback_letzter ?? null, wayback_anzahl: p.wayback_anzahl ?? null,
        fehler: p.fehler ?? null,
      };
      aenderung.geprueft_am = aenderung.letzte_pruefung.zeitpunkt;
    }
    zeileAendern(id, aenderung);
    // Die vollen Pruefdaten sind jetzt veraltet – beim naechsten Aufklappen neu holen.
    setVerlauf(v => { const kopie = { ...v }; delete kopie[id]; return kopie; });
  };

  // Volle Pruefdaten einmal je Betrieb holen; nach einer neuen Pruefung
  // wird der Eintrag geloescht und beim naechsten Aufklappen neu geladen.
  const aufklappen = useCallback((id: number, nurOeffnen = false) => {
    setOffen(s => { const n = new Set(s); if (n.has(id) && !nurOeffnen) n.delete(id); else n.add(id); return n; });
    if (verlauf[id]) return;
    api(`/api/admin/akquise/pruefen?id=${id}`)
      .then(d => setVerlauf(x => ({ ...x, [id]: (d.pruefungen || []) as PruefungVoll[] })))
      .catch(() => setVerlauf(x => ({ ...x, [id]: [] })));
  }, [verlauf]);

  // Wayback nach einer erreichbaren Pruefung nachziehen (Browser, siehe oben).
  const nachziehen = async (id: number, website: string | null, a: PruefAntwort) => {
    if (!website || !a.pruefung?.erreichbar || istBoerse(website)) return;
    const wb = await waybackHolen(website);
    if (wb) {
      const a2 = (await api("/api/admin/akquise/pruefen", { method: "PATCH", body: JSON.stringify({ id, wayback: wb }) })) as PruefAntwort;
      pruefungUebernehmen(id, a2);
    }
  };

  // Gibt eine Fehlermeldung zurueck (oder nichts) – der Suchlauf zaehlt mit.
  const pruefen = async (b: Betrieb, { oeffnen = false } = {}): Promise<string | void> => {
    setInArbeit(s => new Set(s).add(b.id));
    hinweisSetzen(b.id, "Prüft …");
    try {
      const a = (await api("/api/admin/akquise/pruefen", { method: "POST", body: JSON.stringify({ id: b.id }) })) as PruefAntwort;
      pruefungUebernehmen(b.id, a);
      let text = "Geprüft";
      if (a.gefunden === false) text = "Keine Website gefunden";
      else if (a.geraten) text = `Website geraten: ${host(a.geraten.website)} – bitte bestätigen`;
      else if (a.pruefung?.fehler) text = `Geprüft – ${a.pruefung.fehler}`;
      hinweisSetzen(b.id, text, false, a.geraten ? 0 : 5000);
      if (oeffnen) aufklappen(b.id, true);
      await nachziehen(b.id, a.website ?? b.website, a);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Prüfung fehlgeschlagen.";
      hinweisSetzen(b.id, msg, true, 12000);
      return msg;
    } finally {
      setInArbeit(s => { const n = new Set(s); n.delete(b.id); return n; });
    }
  };

  // Einzelabgleich bei Google (fuer Betriebe, die die Flaechensuche nicht
  // zugeordnet hat).
  const googleSuchen = async (b: Betrieb): Promise<string | void> => {
    setInArbeit(s => new Set(s).add(b.id));
    hinweisSetzen(b.id, "Google …");
    try {
      const a = (await api("/api/admin/akquise/google", { method: "POST", body: JSON.stringify({ id: b.id }) })) as PruefAntwort;
      if (a.gefunden === false) {
        zeileAendern(b.id, { google_stand: a.google_stand || new Date().toISOString() });
        hinweisSetzen(b.id, "Bei Google Maps nicht gefunden", false, 6000);
        return;
      }
      pruefungUebernehmen(b.id, a);
      const g = a.google;
      let text = g ? `Google: ${note(g.google_bewertung)} · ${zahl(g.google_anzahl)} Bewertungen` : "Google abgefragt";
      if (a.website_uebernommen && a.website) text = `Website von Google: ${host(a.website)}`;
      hinweisSetzen(b.id, text, false, 6000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Google fehlgeschlagen.";
      hinweisSetzen(b.id, msg, true, 12000);
      return msg;
    } finally {
      setInArbeit(s => { const n = new Set(s); n.delete(b.id); return n; });
    }
  };

  // Fehlende Anschrift aus OpenStreetMap ergaenzen (Nominatim, 1 Anfrage/s –
  // der Aufrufer haelt den Takt).
  const anschriftErgaenzen = async (b: Betrieb): Promise<string | void> => {
    try {
      const a = await api("/api/admin/akquise/anschrift", { method: "POST", body: JSON.stringify({ id: b.id }) });
      if (a.betrieb) zeileAendern(b.id, { strasse: a.betrieb.strasse, plz: a.betrieb.plz, ort: a.betrieb.ort, anschrift_stand: a.betrieb.anschrift_stand });
      const n = Object.keys(a.ergaenzt || {}).length;
      if (n) hinweisSetzen(b.id, "Anschrift aus OpenStreetMap ergänzt", false, 6000);
    } catch (e) {
      return e instanceof Error ? e.message : "Anschrift nicht ergänzt.";
    }
  };

  // Mehrere zugleich abarbeiten. Liefert ein Schritt dreimal hintereinander
  // denselben Fehler, liegt es an der Einrichtung, nicht am Betrieb – dann
  // steht der Grund oben statt hundertfach in den Zeilen. Ein Wurf haelt
  // sofort an.
  const nebenher = async <T,>(ziele: T[], parallel: number, fn: (z: T) => Promise<string | void>, fortschritt: (n: number) => void): Promise<string | null> => {
    let i = 0, fertig = 0, letzter = "", gleich = 0;
    let grund: string | null = null;
    const arbeiter = async () => {
      while (!abbruch.current && !grund) {
        const z = ziele[i++];
        if (z === undefined) return;
        try {
          const msg = await fn(z);
          if (msg) { gleich = msg === letzter ? gleich + 1 : 1; letzter = msg; if (gleich >= 3) grund = msg; } else gleich = 0;
        } catch (e) {
          grund = e instanceof Error ? e.message : String(e);
        }
        fortschritt(++fertig);
      }
    };
    await Promise.all(Array.from({ length: parallel }, arbeiter));
    return grund;
  };

  const schritt = (k: SchrittKey, s: Partial<SchrittStand>) =>
    setAblauf(a => (a ? { ...a, [k]: { ...a[k], ...s } } : a));

  // Google-Flaechensuche: das Suchgebiet in Felder von ~20 km teilen, je
  // Feld Autohaeuser abfragen (Werkstaetten seit Oktober 2026 nicht mehr). Meldet Google ein Feld als
  // voll (mehr als 60 Treffer), wird es geviertelt und neu gefragt.
  const googleFlaeche = async (bbox: number[], regionName: string) => {
    const [s0, w0, n0, o0] = bbox;
    const zeilen = Math.max(1, Math.round((n0 - s0) / 0.18));
    const spalten = Math.max(1, Math.round((o0 - w0) / 0.27));
    const felder: { b: number[]; typ: "car" | "car_repair" }[] = [];
    for (const typ of ["car"] as const) {
      for (let r = 0; r < zeilen; r++) for (let c = 0; c < spalten; c++) {
        const h = (n0 - s0) / zeilen, br = (o0 - w0) / spalten;
        felder.push({ typ, b: [s0 + r * h, w0 + c * br, s0 + (r + 1) * h, w0 + (c + 1) * br] });
      }
    }
    const summe = { neu: 0, verknuepft: 0, aktualisiert: 0 };
    let i = 0, fertig = 0, aktiv = 0;
    let grund: string | null = null;
    const text = () => `${zahl(fertig)} von ${zahl(felder.length)} Feldern · ${zahl(summe.neu)} neu · ${zahl(summe.verknuepft + summe.aktualisiert)} abgeglichen`;
    const arbeiter = async () => {
      while (!abbruch.current && !grund) {
        const f = felder[i];
        if (!f) { if (!aktiv) return; await warte(150); continue; }
        i++; aktiv++;
        try {
          const d = await api("/api/admin/akquise/google-suche", { method: "POST", body: JSON.stringify({ bbox: f.b, typ: f.typ, region: regionName }) });
          summe.neu += d.neu || 0; summe.verknuepft += d.verknuepft || 0; summe.aktualisiert += d.aktualisiert || 0;
          const [s, w, n, o] = f.b;
          if (d.voll && n - s > 0.02) {
            const ms = (s + n) / 2, mw = (w + o) / 2;
            felder.push({ typ: f.typ, b: [s, w, ms, mw] }, { typ: f.typ, b: [s, mw, ms, o] }, { typ: f.typ, b: [ms, w, n, mw] }, { typ: f.typ, b: [ms, mw, n, o] });
          }
          if (d.kontingent) setStand(st => (st ? { ...st, google: { eingerichtet: true, ...d.kontingent } } : st));
        } catch (e) {
          grund = e instanceof Error ? e.message : "Google fehlgeschlagen.";
        } finally {
          aktiv--; fertig++;
          schritt("google", { text: text(), fertig, gesamt: felder.length });
        }
      }
    };
    await Promise.all([arbeiter(), arbeiter()]);
    if (grund) schritt("google", { status: "fehler", text: `${text()} – ${grund}` });
    else schritt("google", { status: abbruch.current ? "aus" : "fertig", text: text() });
    return !grund;
  };

  // Ein Klick fuer alles. mitSuche=false: nur abgleichen, pruefen, messen –
  // ohne neue Suche in OSM und Google.
  const suchlauf = async (mitSuche: boolean) => {
    abbruch.current = false;
    setLaeuft(true); setFehler("");
    const start = {} as Record<SchrittKey, SchrittStand>;
    for (const s of SCHRITTE) start[s.key] = { status: !mitSuche && (s.key === "osm" || s.key === "google") ? "aus" : "wartet", text: "" };
    setAblauf(start);
    let aktuell: SchrittKey = "osm";
    try {
      if (mitSuche) {
        // 1 OpenStreetMap
        aktuell = "osm";
        schritt("osm", { status: "laeuft", text: "Bereich wird bestimmt …" });
        const params = new URLSearchParams({ region });
        if (region === "ort") {
          if (!ort.trim()) throw new Error("Bitte einen Ort angeben.");
          params.set("ort", ort.trim());
          params.set("radiusKm", String(Math.max(1, Math.min(80, Number(radius) || 25))));
        }
        const v = await api(`/api/admin/akquise/suche?${params.toString()}`);
        const elements = await overpassHolen(String(v.query || ""), t => schritt("osm", { text: t }));
        schritt("osm", { text: `${zahl(elements.length)} Einträge werden gespeichert …` });
        const d = await api("/api/admin/akquise/suche", { method: "POST", body: JSON.stringify({ region: v.region, bbox: v.bbox, elements }) });
        schritt("osm", { status: "fertig", text: `${zahl(d.gefunden)} gefunden · ${zahl(d.neu)} neu` });
        if (abbruch.current) return;

        // 2 Google-Flaechensuche
        aktuell = "google";
        if (!googleEingerichtet) schritt("google", { status: "aus", text: "PLACES_KEY fehlt in Cloudflare" });
        else {
          schritt("google", { status: "laeuft", text: "Felder werden abgefragt …" });
          await googleFlaeche(v.bbox as number[], String(v.region || ""));
        }
        await ladeListe(filter.papierkorb);
        if (abbruch.current) return;
      }

      // 3 Abgleich: Betriebe, die noch nie bei Google nachgeschlagen wurden
      aktuell = "abgleich";
      let aktive = await holeAktive();
      const ohneGoogle = googleEingerichtet ? aktive.filter(brauchtGoogle) : [];
      if (!googleEingerichtet) schritt("abgleich", { status: "aus", text: "ohne Google" });
      else if (!ohneGoogle.length) schritt("abgleich", { status: "fertig", text: "alle abgeglichen" });
      else {
        schritt("abgleich", { status: "laeuft", text: `0 von ${zahl(ohneGoogle.length)}`, fertig: 0, gesamt: ohneGoogle.length });
        const grund = await nebenher(ohneGoogle, 2, googleSuchen, n => schritt("abgleich", { text: `${zahl(n)} von ${zahl(ohneGoogle.length)}`, fertig: n }));
        schritt("abgleich", grund ? { status: "fehler", text: grund } : { status: "fertig", text: `${zahl(ohneGoogle.length)} nachgeschlagen` });
      }
      if (abbruch.current) return;

      // 4 Zusammenfuehren (nur sichere Gruppen; unsichere bleiben zum Pruefen)
      aktuell = "doppelte";
      schritt("doppelte", { status: "laeuft", text: "Doppelte werden gesucht …" });
      const z = await api("/api/admin/akquise/dubletten", { method: "POST", body: JSON.stringify({}) });
      await ladeDubletten();
      schritt("doppelte", { status: "fertig", text: z.zusammengefuehrt ? `${zahl(z.zusammengefuehrt)} zusammengeführt` : "keine sicheren Doppelten" });
      if (abbruch.current) return;

      // 5 Fehlende Anschriften aus OpenStreetMap (eine je Sekunde)
      aktuell = "anschrift";
      aktive = await holeAktive();
      const ohne = aktive.filter(brauchtAnschrift);
      if (!ohne.length) schritt("anschrift", { status: "fertig", text: "alle vollständig" });
      else {
        schritt("anschrift", { status: "laeuft", text: `0 von ${zahl(ohne.length)}`, fertig: 0, gesamt: ohne.length });
        const grund = await nebenher(ohne, 1, async b => { const m = await anschriftErgaenzen(b); await warte(1100); return m; },
          n => schritt("anschrift", { text: `${zahl(n)} von ${zahl(ohne.length)}`, fertig: n }));
        const rest = (await holeAktive()).filter(ohneAnschrift).length;
        schritt("anschrift", grund ? { status: "fehler", text: grund } : { status: "fertig", text: rest ? `${zahl(ohne.length - Math.min(rest, ohne.length))} ergänzt · ${zahl(rest)} von Hand` : "alle ergänzt" });
      }
      if (abbruch.current) return;

      // 5 Websites pruefen (neu oder aelter als 30 Tage)
      aktuell = "pruefen";
      aktive = await holeAktive();
      await ladeListe(filter.papierkorb);
      const faelligP = aktive.filter(brauchtPruefung);
      if (!faelligP.length) schritt("pruefen", { status: "fertig", text: "alle aktuell" });
      else {
        schritt("pruefen", { status: "laeuft", text: `0 von ${zahl(faelligP.length)}`, fertig: 0, gesamt: faelligP.length });
        const grund = await nebenher(faelligP, 2, b => pruefen(b), n => schritt("pruefen", { text: `${zahl(n)} von ${zahl(faelligP.length)}`, fertig: n }));
        schritt("pruefen", grund ? { status: "fehler", text: grund } : { status: "fertig", text: `${zahl(faelligP.length)} geprüft` });
      }
      if (abbruch.current) return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Suchlauf fehlgeschlagen.";
      schritt(aktuell, { status: "fehler", text: msg });
      setFehler(msg);
    } finally {
      if (abbruch.current) setAblauf(a => {
        if (!a) return a;
        const n = { ...a };
        for (const k of Object.keys(n) as SchrittKey[]) if (n[k].status === "wartet" || n[k].status === "laeuft") n[k] = { ...n[k], status: "aus", text: "abgebrochen" };
        return n;
      });
      setLaeuft(false);
      await Promise.all([ladeListe(filter.papierkorb), ladeStand(), ladeDubletten()]);
    }
  };

  // Eine Zeile komplett auffrischen: Google, Anschrift, pruefen.
  // Ausdruecklich „neu pruefen“: Google immer frisch abfragen (eine Abfrage
  // vom Monatskontingent), nicht nur, wenn noch nie gefragt wurde – sonst
  // bleiben Bewertung und Anzahl auf dem alten Stand.
  const zeileAuffrischen = async (b: Betrieb) => {
    if (googleEingerichtet) await googleSuchen(b);
    if (ohneAnschrift(b)) await anschriftErgaenzen(b);
    await pruefen(b, { oeffnen: true });
    ladeStand();
  };

  const patch = (body: Record<string, unknown>) =>
    api("/api/admin/akquise/betriebe", { method: "PATCH", body: JSON.stringify(body) });

  const auswahlSchalten = (b: Betrieb) => {
    const auswahl = b.auswahl ? 0 : 1;
    zeileAendern(b.id, { auswahl });
    patch({ id: b.id, auswahl }).then(() => ladeStand()).catch(e => setFehler(e.message));
  };

  // Stern fuer viele auf einmal: alle sichtbaren auswaehlen oder alle abwaehlen.
  // Immer mit „Rückgängig“ (stellt genau diese Betriebe wieder her); Aufheben
  // und grosse Mengen fragen vorher nach.
  const auswahlMehrere = (ids: number[], an: boolean, ohneRueckfrage = false) => {
    if (!ids.length) return;
    if (!ohneRueckfrage) {
      const frage = an
        ? (ids.length > 30 ? `${ids.length} Betriebe auswählen (Stern)?` : "")
        : `Bei allen ${ids.length} ausgewählten Betrieben den Stern entfernen?`;
      if (frage && !confirm(frage)) return;
    }
    setBetriebe(bs => bs && bs.map(b => (ids.includes(b.id) ? { ...b, auswahl: an ? 1 : 0 } : b)));
    patch({ ids, auswahl: an ? 1 : 0 })
      .then(() => {
        ladeStand();
        if (!ohneRueckfrage) melden(an ? `${ids.length} Betriebe ausgewählt.` : `Auswahl von ${ids.length} Betrieben aufgehoben.`, undefined, { ids, an: !an });
      })
      .catch(e => setFehler(e.message));
  };

  const statusSetzen = (id: number, status: string) => {
    zeileAendern(id, { status });
    patch({ id, status }).then(() => ladeStand()).catch(e => setFehler(e.message));
  };

  const anschriftSpeichern = (b: Betrieb, feld: "strasse" | "plz" | "ort", roh: string) => {
    const wert = roh.replace(/\s+/g, " ").trim() || null;
    if ((b[feld] ?? null) === wert) return;
    if (feld === "plz" && wert && !/^\d{5}$/.test(wert)) { hinweisSetzen(b.id, "PLZ muss fünfstellig sein", true, 6000); return; }
    zeileAendern(b.id, { [feld]: wert });
    patch({ id: b.id, [feld]: wert }).catch(e => setFehler(e.message));
  };

  const notizSpeichern = (b: Betrieb, notiz: string) => {
    if ((b.notiz || "") === notiz) return;
    zeileAendern(b.id, { notiz });
    patch({ id: b.id, notiz }).catch(e => setFehler(e.message));
  };

  // Fahrzeuge und Gruendungsjahr: leer = unbekannt. Der Server rechnet die
  // Staerke gleich neu, die Zeile uebernimmt Signale und Zahlen.
  const zahlFeldSpeichern = async (b: Betrieb, feld: "fahrzeuge" | "gruendungsjahr", roh: string) => {
    const wert = roh.trim() === "" ? null : Number(roh.trim());
    if ((b[feld] ?? null) === wert) return;
    if (wert !== null && !Number.isInteger(wert)) { hinweisSetzen(b.id, "Bitte eine ganze Zahl.", true, 6000); return; }
    try {
      const d = await patch({ id: b.id, [feld]: wert });
      zeileAendern(b.id, { [feld]: wert } as Partial<Betrieb>);
      patchUebernehmen(b.id, d);
    } catch (e) {
      hinweisSetzen(b.id, e instanceof Error ? e.message : "Speichern ging nicht.", true, 8000);
    }
  };

  // Antwort von PATCH /betriebe: Website-Felder und, wenn der Server neu
  // gerechnet hat, auch Signale und Scores.
  const patchUebernehmen = (id: number, d: Record<string, unknown>) => {
    const a: Partial<Betrieb> = {};
    if ("website" in d) a.website = (d.website as string | null) ?? null;
    if ("website_quelle" in d) a.website_quelle = (d.website_quelle as string | null) ?? null;
    if ("kategorie" in d) a.kategorie = (d.kategorie as string | null) ?? null;
    if (Array.isArray(d.signale)) a.signale = d.signale as Signal[];
    if (typeof d.score_website === "number") a.score_website = d.score_website;
    if (typeof d.score_betrieb === "number") a.score_betrieb = d.score_betrieb;
    if (typeof d.prioritaet === "number") a.prioritaet = d.prioritaet;
    zeileAendern(id, a);
  };

  // Neue Adresse von Hand → gleich pruefen, sonst staende die Zeile mit
  // alten Signalen und ohne Scores da.
  const websiteSpeichern = async (b: Betrieb, website: string) => {
    if ((b.website || "") === website.trim()) return;
    try {
      const d = await patch({ id: b.id, website: website.trim() });
      patchUebernehmen(b.id, d);
      if (d.website) {
        zeileAendern(b.id, { score_website: null, score_betrieb: null, prioritaet: null, signale: [] });
        const neu = { ...b, website: d.website as string, website_quelle: "manuell" };
        await pruefen(neu);
      }
      ladeStand();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  };

  const websiteBestaetigen = (b: Betrieb) => {
    zeileAendern(b.id, { website_quelle: "bestaetigt", signale: (b.signale || []).filter(s => !s.code.startsWith("website_")) });
    patch({ id: b.id, website_quelle: "bestaetigt" }).then(d => patchUebernehmen(b.id, d)).catch(e => setFehler(e.message));
  };

  const websiteVerwerfen = (b: Betrieb) => {
    if (!confirm(`Website „${host(b.website)}“ bei „${b.name}“ verwerfen?`)) return;
    zeileAendern(b.id, { website: null, website_quelle: null, kategorie: "ohne_website" });
    patch({ id: b.id, website: null }).then(d => { patchUebernehmen(b.id, d); ladeStand(); }).catch(e => setFehler(e.message));
  };

  const melden = (text: string, zurueck?: Betrieb, sterne?: { ids: number[]; an: boolean }) => {
    if (meldungTimer.current) clearTimeout(meldungTimer.current);
    setMeldung({ text, zurueck, sterne });
    meldungTimer.current = setTimeout(() => setMeldung(null), zurueck || sterne ? 12000 : 5000);
  };
  useEffect(() => () => { if (meldungTimer.current) clearTimeout(meldungTimer.current); }, []);

  // In den Papierkorb: sofort aus der Liste, unten erscheint "Rueckgaengig".
  const inPapierkorb = (b: Betrieb) => {
    setBetriebe(liste => (liste ? liste.filter(x => x.id !== b.id) : liste));
    melden(`„${b.name}“ liegt im Papierkorb.`, b);
    api("/api/admin/akquise/betriebe", { method: "DELETE", body: JSON.stringify({ id: b.id }) })
      .then(() => ladeStand())
      .catch(e => setFehler(e.message));
  };

  const rueckgaengig = async () => {
    const st = meldung?.sterne;
    if (st) { setMeldung(null); auswahlMehrere(st.ids, st.an, true); return; }
    const b = meldung?.zurueck;
    if (!b) return;
    setMeldung(null);
    try {
      await api("/api/admin/akquise/betriebe", { method: "POST", body: JSON.stringify({ id: b.id, aktion: "wiederherstellen" }) });
      await Promise.all([ladeListe(filter.papierkorb), ladeStand()]);
    } catch (e) { setFehler(e instanceof Error ? e.message : "Wiederherstellen ging nicht."); }
  };

  const wiederherstellen = (b: Betrieb) => {
    setBetriebe(liste => (liste ? liste.filter(x => x.id !== b.id) : liste));
    api("/api/admin/akquise/betriebe", { method: "POST", body: JSON.stringify({ id: b.id, aktion: "wiederherstellen" }) })
      .then(() => { ladeStand(); melden(`„${b.name}“ ist wieder in der Liste.`); })
      .catch(e => { setFehler(e.message); ladeListe(true); });
  };

  const endgueltigLoeschen = (b: Betrieb) => {
    if (!confirm(`„${b.name}“ endgültig löschen? Das lässt sich nicht rückgängig machen – Suchläufe legen den Betrieb auch nicht neu an.`)) return;
    setBetriebe(liste => (liste ? liste.filter(x => x.id !== b.id) : liste));
    api("/api/admin/akquise/betriebe", { method: "DELETE", body: JSON.stringify({ id: b.id, endgueltig: true }) })
      .then(() => ladeStand())
      .catch(e => { setFehler(e.message); ladeListe(true); });
  };

  const alleWiederherstellen = async () => {
    const n = betriebe?.length || 0;
    if (!n || !confirm(`Alle ${n} Betriebe aus dem Papierkorb zurück in die Liste?`)) return;
    try {
      const d = await api("/api/admin/akquise/betriebe", { method: "POST", body: JSON.stringify({ aktion: "alle_wiederherstellen" }) });
      melden(`${zahl(d.wiederhergestellt)} Betriebe sind wieder in der Liste.`);
      await Promise.all([ladeListe(true), ladeStand()]);
    } catch (e) { setFehler(e instanceof Error ? e.message : "Ging nicht."); }
  };

  const korbLeeren = async () => {
    const n = betriebe?.length || 0;
    if (!n || !confirm(`Papierkorb leeren? ${n} Betriebe werden endgültig gelöscht, samt Prüfungen. Suchläufe legen sie auch danach nicht neu an.`)) return;
    try {
      const d = await api("/api/admin/akquise/betriebe", { method: "DELETE", body: JSON.stringify({ alle: true, endgueltig: true }) });
      melden(`${zahl(d.geloescht)} endgültig gelöscht${d.behalten ? ` · ${zahl(d.behalten)} bleiben, weil es verschickte Briefe gibt` : ""}.`);
      await Promise.all([ladeListe(true), ladeStand()]);
    } catch (e) { setFehler(e instanceof Error ? e.message : "Ging nicht."); }
  };

  const anlegen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!neu.name.trim()) return;
    try {
      await api("/api/admin/akquise/betriebe", {
        method: "POST",
        body: JSON.stringify({ name: neu.name.trim(), website: neu.website.trim() || undefined, ort: neu.ort.trim() || undefined }),
      });
      setNeu({ name: "", website: "", ort: "" });
      setFormOffen(false);
      await Promise.all([ladeListe(filter.papierkorb), ladeStand()]);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Anlegen fehlgeschlagen.");
    }
  };

  // Spaltenkopf: Klick sortiert, nochmal dreht um, Shift-Klick haengt eine
  // Zweitsortierung an.
  const sortieren = (schluessel: SortSchluessel, shift: boolean) => {
    setFilter(f => {
      const std = !SORT_TEXT.has(schluessel);
      const vorhanden = f.sort.find(s => s.schluessel === schluessel);
      if (!shift) {
        if (f.sort[0]?.schluessel === schluessel) return { ...f, sort: [{ schluessel, ab: !f.sort[0].ab }, ...f.sort.slice(1)] };
        return { ...f, sort: [{ schluessel, ab: std }] };
      }
      if (vorhanden) return { ...f, sort: f.sort.map(s => (s.schluessel === schluessel ? { ...s, ab: !s.ab } : s)) };
      return { ...f, sort: [...f.sort, { schluessel, ab: std }].slice(0, 3) };
    });
  };

  const laedt = betriebe === null;
  const liste = useMemo(() => betriebe || [], [betriebe]);
  const sichtbar = useMemo(() => filterAnwenden(liste, filter), [liste, filter]);
  // Wie viele der Haken „Ohne Brief“ ausblendet – Zahl daneben wie beim Papierkorb.
  const mitBrief = useMemo(() => liste.filter(b => b.brief_gesendet).length, [liste]);

  // Seitenweise anzeigen (src/components/admin/Seiten.tsx).
  const { aufSeite, leiste: seitenLeiste, start: seitenStart } = useSeiten(sichtbar, {
    speicher: "akquise.seitengroesse", filterSchluessel: JSON.stringify(filter), nachOben: ".akq-leiste",
  });

  const signalOptionen = useMemo(() => {
    const codes = new Set<string>();
    for (const b of liste) for (const s of b.signale || []) codes.add(s.code);
    return [...codes].sort().map(c => ({ wert: c, label: SIGNAL_LABEL[c] || c }));
  }, [liste]);
  const regionOptionen = useMemo(() => [...new Set(liste.map(b => b.region).filter((r): r is string => !!r))].sort(), [liste]);
  const katZahlen = useMemo(() => {
    const z: Record<string, number> = {};
    for (const b of liste) { const k = b.kategorie || KAT_OFFEN; z[k] = (z[k] || 0) + 1; }
    return z;
  }, [liste]);
  const katSchalten = (k: string) => setzeFilter({ kat: filter.kat.includes(k) ? filter.kat.filter(x => x !== k) : [...filter.kat, k] });

  // Aus dem Karten-Popup: Zeile in der Liste oeffnen und hinscrollen.
  // Das Ziel steht in einem Ref: gescrollt wird erst, wenn die Zeile nach dem
  // Aufklappen gezeichnet ist (Effekt nach dem Rendern).
  const springeZu = useRef<number | null>(null);
  const detailsAusKarte = useCallback((id: number) => {
    springeZu.current = id;
    aufklappen(id, true);
  }, [aufklappen]);
  useEffect(() => {
    const id = springeZu.current;
    if (id == null) return;
    const el = document.getElementById(`betrieb-${id}`);
    if (!el) return;
    springeZu.current = null;
    const leiste = document.querySelector(".akq-leiste")?.getBoundingClientRect().height || 0;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - leiste - 12, behavior: "smooth" });
  }, [offen]);

  // "Nach oben" erscheint, sobald die Liste weiter gescrollt ist.
  const [weitUnten, setWeitUnten] = useState(false);
  const [klebt, setKlebt] = useState(false);
  const leisteRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pruefen = () => {
      setWeitUnten(window.scrollY > 900);
      const r = leisteRef.current?.getBoundingClientRect();
      setKlebt(!!r && r.top <= 0.5 && window.scrollY > 0);
    };
    window.addEventListener("scroll", pruefen, { passive: true });
    return () => window.removeEventListener("scroll", pruefen);
  }, []);

  const csvExport = () => {
    const kopf = ["Auswahl", "Priorität", "Betrieb", "Straße", "PLZ", "Ort", "Marken", "Website", "Website-Quelle", "Kategorie", "Website-Schwäche", "Betrieb-Stärke", "Google-Bewertung", "Google-Anzahl", "Status", "Signale", "Telefon", "Geprüft", "Notiz"];
    const zeilen = sichtbar.map(b => [
      b.auswahl ? "x" : "", b.prioritaet, b.name, b.strasse, b.plz, b.ort, b.marken, b.website, b.website_quelle, kategorieLabel(b.kategorie),
      b.score_website, b.score_betrieb, b.google_bewertung, b.google_anzahl,
      STATUS.find(s => s.wert === b.status)?.label || b.status,
      (b.signale || []).map(s => s.text).join(", "), b.telefon, b.geprueft_am ? datum(b.geprueft_am) : "", b.notiz,
    ].map(csvFeld).join(";"));
    // ﻿ = BOM, damit Excel die Umlaute als UTF-8 liest.
    const blob = new Blob(["﻿" + [kopf.join(";"), ...zeilen].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `akquise-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const korbLeer = filter.papierkorb && !laedt && liste.length === 0;
  const faellig = filter.papierkorb ? 0 : liste.filter(b => brauchtPruefung(b) || brauchtAnschrift(b) || (googleEingerichtet && brauchtGoogle(b))).length;
  const letzterLauf = stand?.laeufe?.[0];
  const unsichereDoppelte = (dubletten || []).filter(g => !g.sicher).length;

  // Kennzahlen oben filtern per Klick – ein zweiter Klick hebt den Filter auf.
  // Die Kacheln zaehlen immer die aktive Liste. Im Papierkorb fuehrt ein
  // Klick darauf zurueck in die Liste, gleich mit dem Filter.
  const kachelKat = filter.papierkorb ? stand?.nachKategorie || {} : katZahlen;
  const nurKat = (k: string[]) => !filter.papierkorb && filter.kat.length === k.length && k.every(x => filter.kat.includes(x));
  const ausKorb = (aenderung: Partial<Filter>) => { setBetriebe(null); setFilter(f => ({ ...FILTER_LEER, sort: f.sort, ...aenderung })); };
  const katKachel = (k: string[]) => (filter.papierkorb ? ausKorb({ kat: k }) : setzeFilter({ kat: nurKat(k) ? [] : k }));

  // Sortierbarer Spaltenkopf – Pfeil zeigt die Richtung, die kleine Zahl
  // die Stelle bei Zweit- und Drittsortierung.
  const kopf = (schluessel: SortSchluessel, inhalt: React.ReactNode, className?: string, info?: string) => {
    const pos = filter.sort.findIndex(s => s.schluessel === schluessel);
    const s = pos >= 0 ? filter.sort[pos] : null;
    return (
      <div role="columnheader" className={`akq-sortierbar${className ? ` ${className}` : ""}${s ? " aktiv" : ""}`}
           aria-sort={s ? (s.ab ? "descending" : "ascending") : "none"}>
        <button type="button" onClick={e => sortieren(schluessel, e.shiftKey)} title="Klick sortiert, Shift-Klick sortiert zusätzlich">
          {inhalt}{s && (s.ab ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}{s && pos > 0 && <i>{pos + 1}</i>}
        </button>
        {info && <InfoTipp breite={300}>{info}</InfoTipp>}
      </div>
    );
  };

  return (
    <>
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      {/* Oben das Lagebild: links die Karte im Hochformat – Deutschland und die
          meisten Landkreise sind hoeher als breit –, rechts Suchlauf und
          Kennzahlen (Reihenfolge per CSS, schmal steht der Suchlauf oben).
          Kennzahlen und Legende filtern per Klick. */}
      <div className="akq-oben">
        <div className="akq-oben-links">
          <section className="mon-block akq-lauf">
            <div className="akq-lauf-kopf">
              <p className="akq-eyebrow">Suchlauf</p>
              <InfoTipp breite={340}>
                <span className="flex flex-col gap-1.5">
                  <b className="text-[var(--fg)]">OpenStreetMap und Google Maps, automatisch zusammengeführt und geprüft.</b>
                  <span>
                    Ein Klick erledigt alles: Betriebe aus OpenStreetMap holen, dieselbe Gegend bei Google Maps absuchen,
                    beides abgleichen, Doppelte zusammenführen, Anschriften ergänzen und jede Website prüfen.
                  </span>
                  <span>Bestehende Einträge behalten Stern, Notiz und Papierkorb.</span>
                </span>
              </InfoTipp>
            </div>

            <div className="akq-lauf-steuerung">
              <select value={region} onChange={e => setRegion(e.target.value)} className="field px-3 py-2 text-sm" style={{ width: "auto" }} disabled={laeuft} aria-label="Region">
                {REGIONEN.map(r => <option key={r.wert} value={r.wert}>{r.label}</option>)}
              </select>
              {region === "ort" && (
                <>
                  <input value={ort} onChange={e => setOrt(e.target.value)} placeholder="Ort" className="field px-3 py-2 text-sm" style={{ width: 160 }} disabled={laeuft} />
                  <label className="akq-inline">
                    <input type="number" min={1} max={80} value={radius} onChange={e => setRadius(e.target.value)}
                           className="field px-3 py-2 text-sm" style={{ width: 72 }} disabled={laeuft} /> km
                  </label>
                </>
              )}
              {laeuft ? (
                <button onClick={() => { abbruch.current = true; }} className="btn-ghost px-4 py-2 text-sm">Abbrechen</button>
              ) : (
                <>
                  <button onClick={() => suchlauf(true)} className="btn-primary px-5 py-2 text-sm akq-start">
                    <Search size={15} /> Suchlauf starten
                  </button>
                  {faellig > 0 && (
                    <button onClick={() => suchlauf(false)} className="akq-knopf" title="Ohne neue Suche: offene Abgleiche, Anschriften und fällige Prüfungen nachholen">
                      <RefreshCw size={13} /> Nur prüfen ({zahl(faellig)})
                    </button>
                  )}
                </>
              )}
            </div>

            {ablauf ? (
              <ol className="akq-schritte">
                {SCHRITTE.map((sc, i) => {
                  const st = ablauf[sc.key];
                  const anteil = st.gesamt ? Math.min(100, Math.round(((st.fertig || 0) / st.gesamt) * 100)) : st.status === "fertig" ? 100 : 0;
                  return (
                    <li key={sc.key} className={`akq-schritt ${st.status}`}>
                      <span className="akq-schritt-marke" aria-hidden="true">
                        {st.status === "fertig" ? <Check size={13} /> : st.status === "laeuft" ? <Loader2 size={13} className="akq-dreht" />
                          : st.status === "fehler" ? <CircleAlert size={13} /> : i + 1}
                      </span>
                      <span className="akq-schritt-text">
                        <b>{sc.titel}</b>
                        <small>{st.text || (st.status === "wartet" ? "wartet" : st.status === "aus" ? "übersprungen" : "")}</small>
                        {st.status === "laeuft" && st.gesamt ? <i className="akq-schritt-balken"><i style={{ width: `${anteil}%` }} /></i> : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="akq-lauf-letzter">
                {letzterLauf
                  ? <>Letzter Suchlauf: {letzterLauf.region || "—"} · {zahl(letzterLauf.gefunden)} aus OpenStreetMap · {datum(letzterLauf.zeitpunkt)}</>
                  : "Noch kein Suchlauf. Region wählen und starten."}
              </p>
            )}

            <div className="akq-lauf-fuss">
              {stand?.google?.eingerichtet ? (
                <span title="Google berechnet Abfragen mit Website und Bewertungen ab 1.000 im Monat. Die Akquise hält unterhalb der Grenze an.">
                  Google im {monatName(stand.google.monat)}: <b>{zahl(stand.google.genutzt ?? 0)}</b> von {zahl(stand.google.frei ?? 1000)} frei
                  {stand.google.grenze ? <> · Stopp bei {zahl(stand.google.grenze)}</> : null}
                </span>
              ) : googleEingerichtet === false ? (
                <span className="akq-warn">Google Maps nicht eingerichtet – PLACES_KEY in Cloudflare hinterlegen.</span>
              ) : null}
              {unsichereDoppelte > 0 && (
                <button onClick={() => setDublettenOffen(o => !o)} className="akq-textknopf">
                  {zahl(unsichereDoppelte)} mögliche Doppelte prüfen {dublettenOffen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>

            {dublettenOffen && dubletten && dubletten.length > 0 && (
              <div className="akq-dubletten">
                <div className="akq-dubletten-kopf">
                  <span>
                    Sichere Doppelte führt der Suchlauf selbst zusammen. Diese hier passen nicht eindeutig – andere PLZ
                    oder fremder Name. „Bleibt“ ist der Eintrag, in den die anderen übergehen; Notiz, Stern und Briefe gehen mit.
                  </span>
                </div>
                <ul>
                  {dubletten.map(g => (
                    <li key={g.ids.join("-")} className={g.sicher ? "" : "pruefen"}>
                      <div className="akq-dubletten-namen">
                        {g.betriebe.map(b => (
                          <span key={b.id}>
                            <b>{b.name}</b>{b.id === g.haupt && <em>bleibt</em>}
                            <small>{[b.art === "car" ? "Autohaus" : "Werkstatt", b.ort, host(b.website)].filter(Boolean).join(" · ")}</small>
                          </span>
                        ))}
                      </div>
                      <span className="akq-hinweis">{g.grund}</span>
                      <button onClick={() => zusammenfuehren([g.ids])} disabled={fuehrtZusammen} className="akq-knopf">Zusammenführen</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="akq-kennzahlen">
            <KpiKachel titel="Betriebe" wert={zahl(stand?.betriebe)} aktiv={!filterAktiv(filter) && !filter.papierkorb}
                       onClick={() => { if (filter.papierkorb) setBetriebe(null); setFilter(f => ({ ...FILTER_LEER, sort: f.sort })); }} />
            <KpiKachel titel="Priorität ≥ 60" wert={zahl(stand?.prioHoch)} akzent aktiv={!filter.papierkorb && filter.prio === "60"}
                       onClick={() => (filter.papierkorb ? ausKorb({ prio: "60" }) : setzeFilter({ prio: filter.prio === "60" ? "" : "60" }))} />
            <KpiKachel titel="Nur Börse" wert={zahl(kachelKat.nur_boerse || 0)} farbe="nur_boerse" aktiv={nurKat(["nur_boerse"])}
                       onClick={() => katKachel(["nur_boerse"])} />
            <KpiKachel titel="Ohne Website" wert={zahl(kachelKat.ohne_website || 0)} farbe="ohne_website" aktiv={nurKat(["ohne_website"])}
                       onClick={() => katKachel(["ohne_website"])} />
            <KpiKachel titel="Veraltet & Baukasten" wert={zahl((kachelKat.veraltet || 0) + (kachelKat.baukasten || 0))} farbe="veraltet"
                       aktiv={nurKat(["veraltet", "baukasten"])} onClick={() => katKachel(["veraltet", "baukasten"])} />
            <KpiKachel titel="Auswahl" wert={zahl(stand?.auswahl)} aktiv={!filter.papierkorb && filter.auswahl}
                       onClick={() => (filter.papierkorb ? ausKorb({ auswahl: true }) : setzeFilter({ auswahl: !filter.auswahl }))} />
          </div>
        </div>

        <section className="mon-block akq-karten-block">
          {laedt
            ? <p className="mon-leer">Karte wird geladen …</p>
            : <Karte betriebe={sichtbar} onDetails={detailsAusKarte} hinweis={filter.papierkorb ? "Papierkorb" : undefined}
                     kategorien={katZahlen} aktiv={filter.kat} onKategorie={katSchalten} />}
        </section>
      </div>

      {/* Filter und Liste. Die Leiste mit Filtern und Spaltenkoepfen bleibt
          beim Scrollen oben stehen; die Liste selbst scrollt mit der Seite,
          nicht in einem eigenen Kasten – das war am Trackpad fummelig. */}
      <section className={`mon-block akq-listenblock${filter.papierkorb ? " im-korb" : ""}`}>
        {filter.papierkorb && (
          <div className="akq-korb-kopf">
            <span className="akq-korb-symbol" aria-hidden="true"><Trash2 size={18} /></span>
            <div className="akq-korb-text">
              <p className="akq-korb-titel">Papierkorb{!laedt && liste.length > 0 && <b>{zahl(liste.length)}</b>}</p>
              <p>Suchläufe legen diese Betriebe nicht neu an.</p>
            </div>
            <div className="akq-korb-aktionen">
              <button type="button" onClick={() => papierkorbSchalten(false)} className="akq-knopf"><ArrowLeft size={13} /> Zur Liste</button>
              {liste.length > 0 && (
                <>
                  <button type="button" onClick={alleWiederherstellen} className="akq-knopf"><RotateCcw size={13} /> Alle wiederherstellen</button>
                  <button type="button" onClick={korbLeeren} className="akq-knopf gefahr"><Trash2 size={13} /> Papierkorb leeren</button>
                </>
              )}
            </div>
          </div>
        )}
        {!korbLeer && (<>
        <div className="akq-steuerung akq-filter">
            <select value={filter.art} onChange={e => setzeFilter({ art: e.target.value })} className="field px-3 py-2 text-sm" style={{ width: "auto" }} aria-label="Art">
              <option value="alle">Alle Arten</option>
              <option value="car">Autohaus</option>
              <option value="car_repair">Werkstatt</option>
            </select>
            <select value={filter.web} onChange={e => setzeFilter({ web: e.target.value })} className="field px-3 py-2 text-sm" style={{ width: "auto" }} aria-label="Website">
              <option value="alle">Website: alle</option>
              <option value="mit">mit Website</option>
              <option value="ohne">ohne Website</option>
              <option value="vermutet">vermutet</option>
              <option value="boerse">nur Börse</option>
            </select>
            <select value={filter.gep} onChange={e => setzeFilter({ gep: e.target.value })} className="field px-3 py-2 text-sm" style={{ width: "auto" }} aria-label="Geprüft">
              <option value="alle">Geprüft: alle</option>
              <option value="ja">geprüft</option>
              <option value="nein">nicht geprüft</option>
              <option value="alt">älter als {PRUEF_ALTER_TAGE} Tage</option>
            </select>
            <MehrfachWahl label="Signal" optionen={signalOptionen} wert={filter.sig} onChange={sig => setzeFilter({ sig })} />
            {regionOptionen.length > 1 && (
              <select value={filter.region} onChange={e => setzeFilter({ region: e.target.value })} className="field px-3 py-2 text-sm" style={{ width: "auto" }} aria-label="Region">
                <option value="alle">Alle Regionen</option>
                {regionOptionen.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <label className={`akq-haken${filter.ohneBrief ? " an" : ""}`} title="Betriebe ausblenden, die schon einen Brief bekommen haben">
              <input type="checkbox" checked={filter.ohneBrief} onChange={e => setzeFilter({ ohneBrief: e.target.checked })} />
              Ohne Brief{mitBrief > 0 && <b>{zahl(mitBrief)}</b>}
            </label>
            <button type="button" onClick={() => papierkorbSchalten(!filter.papierkorb)} aria-pressed={filter.papierkorb}
                    className={`akq-knopf akq-korb-knopf${filter.papierkorb ? " an" : ""}`}>
              <Trash2 size={13} /> Papierkorb{stand?.papierkorb ? <b>{zahl(stand.papierkorb)}</b> : null}
            </button>
            <span className="akq-trenner" aria-hidden="true" />
            <button onClick={csvExport} disabled={!sichtbar.length} className="akq-knopf" title="Gefilterte Liste als CSV">
              <Download size={13} /> CSV
            </button>
            {!filter.papierkorb && (
              <button onClick={() => setFormOffen(o => !o)} className="akq-knopf">
                <Plus size={13} /> Betrieb anlegen
              </button>
            )}
        </div>

        {formOffen && !filter.papierkorb && (
          <form onSubmit={anlegen} className="akq-steuerung akq-anlegen">
            <input required value={neu.name} onChange={e => setNeu({ ...neu, name: e.target.value })} placeholder="Name"
                   className="field px-3 py-2 text-sm" style={{ width: 220 }} />
            <input value={neu.website} onChange={e => setNeu({ ...neu, website: e.target.value })} placeholder="Website"
                   className="field px-3 py-2 text-sm" style={{ width: 220 }} />
            <input value={neu.ort} onChange={e => setNeu({ ...neu, ort: e.target.value })} placeholder="Ort"
                   className="field px-3 py-2 text-sm" style={{ width: 160 }} />
            <button type="submit" className="btn-primary px-4 py-2 text-sm">Anlegen</button>
            <button type="button" onClick={() => setFormOffen(false)} className="akq-knopf">Abbrechen</button>
          </form>
        )}

        {/* Beim Scrollen bleiben nur Suche, Kategorie und Spaltenkoepfe oben.
            Sobald die Leiste klebt, bekommt sie Schatten und Unschaerfe. */}
        <div className={`akq-leiste${klebt ? " klebt" : ""}`} ref={leisteRef}>
          <div className="akq-leiste-zeile">
            <label className="akq-suche">
              <Search size={15} aria-hidden="true" />
              <input value={filter.q} onChange={e => setzeFilter({ q: e.target.value })} placeholder="Name, Ort oder Domain" aria-label="Suche" />
            </label>
            <div className="akq-kat-band" role="group" aria-label="Kategorie">
              <button type="button" className={`akq-kat-knopf${filter.kat.length ? "" : " an"}`} onClick={() => setzeFilter({ kat: [] })}>
                Alle <b>{zahl(liste.length)}</b>
              </button>
              {/* Auswahl (Stern) als eigener Knopf neben „Alle“ – wirkt zusaetzlich zur Kategorie */}
              <button type="button" className={`akq-kat-knopf auswahl${filter.auswahl ? " an" : ""}`} aria-pressed={filter.auswahl}
                      onClick={() => setzeFilter({ auswahl: !filter.auswahl })} disabled={!filter.auswahl && !liste.some(b => b.auswahl)}>
                <Star size={11} aria-hidden="true" />Auswahl <b>{zahl(liste.filter(b => b.auswahl).length)}</b>
              </button>
              {[...KATEGORIEN, { wert: KAT_OFFEN, label: "Offen" }].map(k => (
                <button key={k.wert} type="button" onClick={() => katSchalten(k.wert)} disabled={!katZahlen[k.wert]}
                        className={`akq-kat-knopf ${k.wert}${filter.kat.includes(k.wert) ? " an" : ""}`} aria-pressed={filter.kat.includes(k.wert)}>
                  <i aria-hidden="true" />{k.label} <b>{zahl(katZahlen[k.wert] || 0)}</b>
                </button>
              ))}
            </div>
            <span className="akq-anzahl" title={`${zahl(sichtbar.length)} von ${zahl(liste.length)} sichtbar`}>
              <b>{zahl(sichtbar.length)}</b>{sichtbar.length !== liste.length && <> / {zahl(liste.length)}</>}
            </span>
            {filterAktiv(filter) && (
              <button onClick={() => setFilter(f => ({ ...FILTER_LEER, papierkorb: f.papierkorb, sort: f.sort }))} className="akq-zuruecksetzen"
                      title="Filter zurücksetzen" aria-label="Filter zurücksetzen"><RotateCcw size={13} /></button>
            )}
            {!filter.papierkorb && sichtbar.some(b => !b.auswahl) && (
              <button onClick={() => auswahlMehrere(sichtbar.filter(b => !b.auswahl).map(b => b.id), true)} className="akq-alle-waehlen"
                      title={`Alle ${zahl(sichtbar.length)} sichtbaren Betriebe auswählen (Stern)`}><Star size={12} aria-hidden="true" /> Alle wählen</button>
            )}
            <InfoTipp breite={340}>
              <span className="flex flex-col gap-1.5">
                <span>{ERKLAERUNG.prio}</span>
                <span>{ERKLAERUNG.schwaeche}</span>
                <span>{ERKLAERUNG.staerke}</span>
                <span>{ERKLAERUNG.kat}</span>
              </span>
            </InfoTipp>
          </div>

          {sichtbar.length > 0 && (
            <>
              <div className="akq-raster akq-kopfzeile" role="row">
                <div className="akq-nr">#</div>
                {kopf("auswahl", <Star size={12} />, "akq-stern-kopf")}
                {kopf("prioritaet", "Priorität")}
                {kopf("name", "Betrieb")}
                {kopf("website", "Website")}
                {kopf("kategorie", "Kategorie")}
                {kopf("score_website", "Schwäche", "num")}
                {kopf("score_betrieb", "Stärke", "num")}
                {kopf("google", "Google")}
                <div />
              </div>
              {/* Schmal: statt Spaltenkoepfen eine Sortierwahl */}
              <div className="akq-sortwahl">
                <label>
                  Sortieren
                  <select value={filter.sort[0]?.schluessel || "prioritaet"} onChange={e => sortieren(e.target.value as SortSchluessel, false)} className="field px-2 py-1 text-sm">
                    {SORT_SCHLUESSEL.map(k => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
                  </select>
                </label>
                <button type="button" className="akq-knopf akq-symbol" onClick={() => sortieren(filter.sort[0]?.schluessel || "prioritaet", false)}
                        aria-label={filter.sort[0]?.ab ? "Absteigend – umdrehen" : "Aufsteigend – umdrehen"}>
                  {filter.sort[0]?.ab ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                </button>
              </div>
            </>
          )}
        </div>
        </>)}

        {laedt ? (
          <p className="mon-leer py-6">Wird geladen …</p>
        ) : liste.length === 0 && filter.papierkorb ? (
          <div className="akq-korb-leer">
            <span className="akq-korb-symbol" aria-hidden="true"><Trash2 size={22} /></span>
            <p>Der Papierkorb ist leer.</p>
          </div>
        ) : liste.length === 0 ? (
          <p className="mon-leer py-6 text-center">Noch keine Betriebe. Region wählen und suchen.</p>
        ) : sichtbar.length === 0 ? (
          <p className="mon-leer py-6 text-center">Kein Betrieb passt zu den Filtern.</p>
        ) : (
          <div className="akq-liste" role="table" aria-label="Betriebe">
            {aufSeite.map((b, i) => {
              const nr = seitenStart + i;
              const istOffen = offen.has(b.id);
              const arbeitet = inArbeit.has(b.id);
              const hinweis = hinweise[b.id];
              const voll = verlauf[b.id]?.[0];
              const lp = b.letzte_pruefung;
              const signale = b.signale || [];
              const boerse = istBoerse(b.website);
              const schwaechen = signale.filter(x => x.seite === "website");
              const staerken = signale.filter(x => x.seite === "betrieb");
              return (
                <div key={b.id} id={`betrieb-${b.id}`} role="rowgroup" className={`akq-eintrag${istOffen ? " offen" : ""}${b.auswahl ? " gewaehlt" : ""}${b.geloescht ? " im-korb" : ""}${b.brief_gesendet ? " versendet" : ""}`}>
                  <div className="akq-raster" role="row">
                    <div className="akq-nr" title={`ID ${b.id}`}>
                      <b>{nr + 1}</b>
                      <small>ID {b.id}</small>
                    </div>
                    <div className="akq-stern">
                      <button type="button" onClick={() => auswahlSchalten(b)} className={b.auswahl ? "an" : ""} disabled={!!b.geloescht}
                              aria-pressed={!!b.auswahl} aria-label={b.auswahl ? "Aus der Auswahl nehmen" : "In die Auswahl"}>
                        <Star size={16} />
                      </button>
                    </div>
                    <div className="akq-c-prio"><Prio wert={b.prioritaet} /></div>
                    <div className="akq-betrieb">
                      <button type="button" className="akq-name" onClick={() => aufklappen(b.id)}>{b.name}</button>
                      <span className="akq-unter">
                        {b.geloescht && <span className="akq-geloescht-am">Gelöscht {datum(b.geloescht)}</span>}
                        {b.brief_gesendet
                          ? <a className="akq-brief-marke" href="/admin/akquise/post" onClick={() => rueckwegMerken(b)} title="Brief verschickt – unter Post ansehen"><Mail size={10} aria-hidden="true" />Brief {datum(b.brief_gesendet)}</a>
                          : b.brief_entwurf ? <span className="akq-brief-marke entwurf" title="Entwurf unter Post">Entwurf</span> : null}
                        {b.brief_zurueck && !b.brief_gesendet && (
                          <button type="button" className="akq-brief-marke zurueck" onClick={() => aufklappen(b.id)}
                                  title={`Brief kam am ${datum(b.brief_zurueck)} zurück – Anschrift prüfen`}>Rückläufer</button>
                        )}
                        {b.kontakt_erlaubt && (b.telefon
                          ? <a className="akq-brief-marke kontakt" href={`tel:${b.telefon.replace(/[^\d+]/g, "")}`} title={`Kontakt erlaubt am ${datum(b.kontakt_erlaubt)} – anrufen`}>
                              Kontakt erlaubt · {b.telefon}
                            </a>
                          : <span className="akq-brief-marke kontakt" title={`Kontakt erlaubt am ${datum(b.kontakt_erlaubt)} – Nummer im Internet nachsehen`}>Kontakt erlaubt</span>)}
                        {ohneAnschrift(b) && !b.geloescht && (
                          <button type="button" className="akq-brief-marke fehlt" onClick={() => aufklappen(b.id)}
                                  title={b.anschrift_stand ? "In OpenStreetMap nicht gefunden – bitte von Hand eintragen" : "Wird beim nächsten Suchlauf aus OpenStreetMap ergänzt"}>
                            Anschrift fehlt
                          </button>
                        )}
                        {!ohneAnschrift(b) && ohneHausnummer(b) && !b.geloescht && (
                          <button type="button" className="akq-brief-marke fehlt" onClick={() => aufklappen(b.id)} title="Straße ohne Hausnummer – bitte prüfen und ergänzen">
                            Hausnummer fehlt
                          </button>
                        )}
                        {[b.art === "car_repair" && !HAENDLER_RE.test(b.name) ? "Werkstatt" : "Autohaus", b.ort, b.marken].filter(Boolean).join(" · ")}
                      </span>
                      {hinweis && <span className={`akq-zeilenhinweis${hinweis.fehler ? " fehler" : ""}`}>{hinweis.text}</span>}
                    </div>
                    <div className="akq-website">
                      {b.website ? (
                        <>
                          <a href={b.website} target="_blank" rel="noopener noreferrer" className="akq-link" title={b.website}>
                            {boerse ? `Börse: ${host(b.website)}` : host(b.website)}
                          </a>
                          <QuelleBadge b={b} bestaetigen={websiteBestaetigen} verwerfen={websiteVerwerfen} />
                        </>
                      ) : <span className="text-[var(--fg-subtle)]">keine</span>}
                    </div>
                    <div className="akq-c-kat"><KategorieChip wert={b.kategorie} /></div>
                    <div className="num akq-zahl akq-c-sw" data-l="Schwäche">{zahl(b.score_website)}</div>
                    <div className="num akq-zahl stark akq-c-sb" data-l="Stärke">{zahl(b.score_betrieb)}</div>
                    <div className="akq-google">
                      {b.google_anzahl != null || b.google_bewertung != null
                        ? <span title={b.google_stand ? `Stand ${datum(b.google_stand)}` : undefined}>★ {note(b.google_bewertung)} · {zahl(b.google_anzahl)}</span>
                        : <span className="text-[var(--fg-subtle)]">–</span>}
                    </div>
                    <div className="akq-aktionen">
                      {filter.papierkorb ? (
                        <>
                          <button onClick={() => wiederherstellen(b)} className="akq-knopf akq-zurueck" title="Zurück in die Liste">
                            <RotateCcw size={13} /> Wiederherstellen
                          </button>
                          <button onClick={() => endgueltigLoeschen(b)} className="akq-knopf akq-symbol gefahr" title="Endgültig löschen" aria-label={`${b.name} endgültig löschen`}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => zeileAuffrischen(b)} disabled={arbeitet || laeuft} className="akq-knopf akq-symbol"
                                  title="Neu prüfen: Google, Anschrift, Website" aria-label={`${b.name} neu prüfen`}>
                            <RefreshCw size={14} className={arbeitet ? "akq-dreht" : undefined} />
                          </button>
                          <a href={`/admin/akquise/post?betrieb=${b.id}`} onClick={() => rueckwegMerken(b)} className="akq-knopf akq-symbol" title="Brief vorbereiten" aria-label="Brief vorbereiten"><Mail size={14} /></a>
                        </>
                      )}
                      <button onClick={() => aufklappen(b.id)} className="akq-knopf akq-symbol" aria-expanded={istOffen} aria-label="Details" title="Details">
                        {istOffen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {!filter.papierkorb && (
                        <button onClick={() => inPapierkorb(b)} className="akq-knopf akq-symbol" aria-label={`${b.name} in den Papierkorb`} title="In den Papierkorb">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Alle Signale in eigener Zeile: links die Schwaechen der
                      Website, rechts die Staerken des Betriebs, jeweils mit Punkten. */}
                  {signale.length > 0 && (
                    <div className="akq-signalzeile">
                      {schwaechen.map(x => (
                        <span key={x.code} className="akq-signal website">{x.text}{x.punkte ? <b>{x.punkte}</b> : null}</span>
                      ))}
                      {staerken.map(x => (
                        <span key={x.code} className="akq-signal betrieb">{x.text}<b>+{x.punkte}</b></span>
                      ))}
                    </div>
                  )}

                  {istOffen && (
                    <div className="akq-details">
                      <div className="akq-details-raster">
                        <div>
                          <p className="akq-dt">Prüfung</p>
                          {boerse ? (
                            <p className="mon-leer text-sm">Nur eine Börsen-Seite – dort gibt es nichts zu prüfen. Bewertet wird, dass eine eigene Website fehlt.</p>
                          ) : !b.website ? (
                            <p className="mon-leer text-sm">Keine Website – nichts zu prüfen.</p>
                          ) : (
                          <dl className="akq-dl">
                            <dt>Zeitpunkt</dt><dd>{lp ? datum(lp.zeitpunkt) : "—"}</dd>
                            <dt>Erreichbar</dt><dd>{lp ? (lp.erreichbar ? "ja" : "nein") : "—"}</dd>
                            <dt>HTTPS</dt><dd>{lp ? (lp.https ? "ja" : "nein") : "—"}</dd>
                            <dt>Viewport</dt><dd>{lp ? (lp.viewport ? "ja" : "nein") : "—"}</dd>
                            <dt>System</dt><dd>{lp?.baukasten || lp?.cms || voll?.generator || "—"}</dd>
                            <dt>© im Fuß</dt><dd>{lp?.copyright_jahr ?? "—"}</dd>
                            {voll?.titel && <><dt>Titel</dt><dd className="akq-lang">{voll.titel}</dd></>}
                            {voll?.antwort_ms != null && <><dt>Antwort</dt><dd>{zahl(voll.antwort_ms)} ms · {zahl(voll.groesse_kb)} KB</dd></>}
                            {lp?.fehler && <><dt>Fehler</dt><dd className="akq-lang">{lp.fehler}</dd></>}
                          </dl>
                          )}
                        </div>

                        <div>
                          <p className="akq-dt">Wayback</p>
                          <dl className="akq-dl">
                            <dt>Erster Snapshot</dt><dd>{datum(lp?.wayback_erster)}</dd>
                            <dt>Letzter Snapshot</dt><dd>{datum(lp?.wayback_letzter)}</dd>
                          </dl>
                        </div>

                        <div>
                          <p className="akq-dt">Betrieb</p>
                          <dl className="akq-dl">
                            <dt>Anschrift</dt>
                            <dd className="akq-anschrift-feld">
                              {(["strasse", "plz", "ort"] as const).map(feld => (
                                <input key={`${feld}-${b[feld] ?? ""}`} defaultValue={b[feld] ?? ""}
                                       placeholder={feld === "strasse" ? "Straße Nr." : feld === "plz" ? "PLZ" : "Ort"}
                                       inputMode={feld === "plz" ? "numeric" : undefined}
                                       onBlur={e => anschriftSpeichern(b, feld, e.target.value)}
                                       onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                                       className={`field px-2 py-1 text-xs ${feld}`} aria-label={feld === "strasse" ? "Straße und Hausnummer" : feld === "plz" ? "PLZ" : "Ort"} />
                              ))}
                            </dd>
                            <dt>Telefon</dt>
                            <dd>{b.telefon ? <a href={`tel:${b.telefon.replace(/\s/g, "")}`} className="akq-link">{b.telefon}</a> : "—"}</dd>
                            {b.email && <><dt>E-Mail</dt><dd className="akq-lang">{b.email}</dd></>}
                            {b.oeffnungszeiten && <><dt>Öffnungszeiten</dt><dd className="akq-lang">{b.oeffnungszeiten}</dd></>}
                            <dt>Quelle</dt><dd>{b.quelle === "osm" ? `OSM${b.region ? ` · ${b.region}` : ""}` : "manuell"}</dd>
                            <dt>Status</dt>
                            <dd>
                              <select value={b.status} onChange={e => statusSetzen(b.id, e.target.value)}
                                      className="field px-2 py-1 text-xs" style={{ width: "auto", display: "inline-block" }} aria-label={`Status von ${b.name}`}>
                                {STATUS.map(x => <option key={x.wert} value={x.wert}>{x.label}</option>)}
                              </select>
                            </dd>
                            <dt>Website</dt>
                            <dd className="akq-website-feld">
                              <input key={b.website || ""} defaultValue={b.website || ""} placeholder="https://…"
                                     onBlur={e => websiteSpeichern(b, e.target.value)}
                                     onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                                     className="field px-2 py-1 text-xs" />
                              <QuelleBadge b={b} bestaetigen={websiteBestaetigen} verwerfen={websiteVerwerfen} />
                            </dd>
                            <dt>Google</dt>
                            <dd className="akq-lang">
                              {b.google_stand ? (
                                <>
                                  {b.google_place_id ? <>{note(b.google_bewertung)} Sterne · {zahl(b.google_anzahl)} Bewertungen</> : "nicht gefunden"}
                                  <span className="text-[var(--fg-subtle)]"> · Stand {datum(b.google_stand)}</span>
                                  {b.google_place_id && (
                                    <> · <a href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(b.google_place_id)}`}
                                            target="_blank" rel="noopener noreferrer" className="akq-link">Maps ↗</a></>
                                  )}
                                </>
                              ) : "—"}
                            </dd>
                          </dl>
                        </div>

                        {/* Von Hand: Bestand und Gruendungsjahr. Automatisch
                            auslesen verbieten die AGB von mobile.de; die Links
                            fuehren zu den Stellen, wo man es nachsieht. */}
                        <div>
                          <p className="akq-dt">Größe &amp; Alter <span className="normal-case tracking-normal font-normal">(von Hand)</span></p>
                          <dl className="akq-dl akq-eingabe">
                            <dt>Fahrzeuge</dt>
                            <dd>
                              <input key={`f-${b.fahrzeuge ?? ""}`} defaultValue={b.fahrzeuge ?? ""} inputMode="numeric" placeholder="z. B. 45"
                                     onBlur={e => zahlFeldSpeichern(b, "fahrzeuge", e.target.value)}
                                     onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                                     className="field px-2 py-1 text-xs" aria-label="Fahrzeuge im Bestand" />
                            </dd>
                            <dt>Gegründet</dt>
                            <dd>
                              <input key={`g-${b.gruendungsjahr ?? ""}`} defaultValue={b.gruendungsjahr ?? ""} inputMode="numeric" placeholder="z. B. 1987"
                                     onBlur={e => zahlFeldSpeichern(b, "gruendungsjahr", e.target.value)}
                                     onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                                     className="field px-2 py-1 text-xs" aria-label="Gründungsjahr" />
                            </dd>
                          </dl>
                          <p className="akq-links">
                            <a href={boerse && b.website ? b.website : `https://www.google.com/search?q=${encodeURIComponent(`site:home.mobile.de ${b.name} ${b.ort || ""}`)}`}
                               target="_blank" rel="noopener noreferrer" className="akq-link">Bestand bei mobile.de ↗</a>
                            <a href={`https://www.northdata.de/${encodeURIComponent([b.name, b.ort].filter(Boolean).join(", "))}`}
                               target="_blank" rel="noopener noreferrer" className="akq-link">Gründung bei North Data ↗</a>
                            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, b.plz, b.ort].filter(Boolean).join(" "))}`}
                               target="_blank" rel="noopener noreferrer" className="akq-link">Google Maps ↗</a>
                          </p>
                        </div>

                        <div className="akq-notiz">
                          <p className="akq-dt">Notiz</p>
                          <textarea defaultValue={b.notiz || ""} rows={3}
                                    onBlur={e => notizSpeichern(b, e.target.value)}
                                    className="field px-3 py-2 text-sm" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!laedt && seitenLeiste}
      </section>

      {meldung && (
        <div className="akq-toast" role="status">
          <span>{meldung.text}</span>
          {(meldung.zurueck || meldung.sterne) && (
            <button type="button" onClick={rueckgaengig} className="akq-toast-knopf"><Undo2 size={14} /> Rückgängig</button>
          )}
          <button type="button" onClick={() => setMeldung(null)} className="akq-toast-zu" aria-label="Meldung schließen">×</button>
        </div>
      )}

      {!filter.papierkorb && liste.some(b => b.auswahl) && (
        <div className="akq-auswahl-leiste" role="region" aria-label="Auswahl">
          <span><Star size={13} aria-hidden="true" /> <b>{zahl(liste.filter(b => b.auswahl).length)}</b> ausgewählt</span>
          <button type="button" className="akq-textknopf" onClick={() => setzeFilter({ auswahl: !filter.auswahl })}>
            {filter.auswahl ? "Alle zeigen" : "Nur Auswahl zeigen"}
          </button>
          <button type="button" className="akq-textknopf" onClick={() => auswahlMehrere(liste.filter(b => b.auswahl).map(b => b.id), false)}>Aufheben</button>
          <a className="btn-primary px-4 py-2 text-sm" href="/admin/akquise/post?tab=sammel&kat=auswahl&alle=1"
             onClick={() => { const b = liste.find(x => x.auswahl); if (b) rueckwegMerken(b); }}>
            <Mail size={13} aria-hidden="true" /> Briefe an Auswahl
          </a>
        </div>
      )}
      {weitUnten && (
        <button type="button" className="akq-nach-oben" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Nach oben">
          <ArrowUpToLine size={18} />
        </button>
      )}
    </>
  );
}

export default function AkquiseSeite() {
  return (
    <AdminShell titel="Betriebe" eyebrow="Vertrieb" lead="Autohäuser finden, Websites prüfen, die richtigen ansprechen.">
      <Suspense fallback={<p className="mon-leer">Wird geladen …</p>}>
        <AkquiseCockpit />
      </Suspense>
    </AdminShell>
  );
}
