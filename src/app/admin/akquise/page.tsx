"use client";
import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Download, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

// Akquise-Cockpit: Autohaeuser aus OpenStreetMap holen, ihre Websites vom
// Server pruefen lassen und die Liste sortier- und filterbar zeigen.
// Die Bewertung selbst passiert in functions/_lib/akquise.js – hier wird
// nur gesteuert, gefiltert und angezeigt.
//
// Drei Dinge holt der BROWSER, weil die Function dafuer zu wenig CPU hat
// oder die Dienste zu langsam sind, und reicht nur das Ergebnis weiter:
//   Overpass  (Betriebe suchen)      → POST /suche { region, bbox, elements }
//   Wayback   (archive.org/available) → PATCH /pruefen { wayback }
//   PageSpeed (Google, optional)      → PATCH /pruefen { psi }
// Google Places laeuft serverseitig (kleine Antwort, Schluessel bleibt geheim).

type Signal = { code: string; text: string; punkte: number; seite: "website" | "betrieb" };

type LetztePruefung = {
  zeitpunkt: string;
  erreichbar: number | null; https: number | null; viewport: number | null;
  cms: string | null; baukasten: string | null; copyright_jahr: number | null;
  psi_leistung: number | null;
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
  geprueft_am: string | null; angelegt: string; geaendert: string;
  signale: Signal[] | null;
  letzte_pruefung: LetztePruefung | null;
};

type Lauf = { id: number; art: string; region: string | null; gefunden: number | null; neu: number | null; fehler: string | null; zeitpunkt: string };
type Stand = {
  betriebe: number; mitWebsite: number; ohneWebsite: number; nurBoerse: number; geprueft: number;
  prioHoch: number; auswahl: number; papierkorb: number; nachStatus: Record<string, number>; laeufe: Lauf[];
};

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
};

const REGIONEN = [
  { wert: "wuerzburg", label: "Würzburg, 25 km" },
  { wert: "unterfranken", label: "Unterfranken" },
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

function signaleLesen(roh: Signal[] | string | null | undefined): Signal[] {
  if (Array.isArray(roh)) return roh;
  if (typeof roh === "string") { try { const p = JSON.parse(roh); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function zeitAlt(wert: string | null, tage: number) {
  if (!wert) return true;
  const t = new Date(wert.replace(" ", "T") + (wert.includes("Z") ? "" : "Z")).getTime();
  return isNaN(t) || Date.now() - t > tage * 86400000;
}
const brauchtPruefung = (b: Betrieb) => zeitAlt(b.geprueft_am, PRUEF_ALTER_TAGE);
const brauchtGoogle = (b: Betrieb) => !b.website || !b.google_stand;

// PageSpeed direkt bei Google, ohne Schluessel. 429 und alles andere wird
// geschluckt – dann bleibt die Pruefung einfach ohne PSI-Wert.
async function psiHolen(url: string): Promise<{ leistung: number; lcp: number; cls: number } | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`,
    );
    if (!res.ok) return null;
    const d = await res.json();
    const lr = d?.lighthouseResult;
    const score = lr?.categories?.performance?.score;
    if (typeof score !== "number") return null;
    return {
      leistung: Math.round(score * 100),
      lcp: (lr.audits?.["largest-contentful-paint"]?.numericValue ?? 0) / 1000,
      cls: lr.audits?.["cumulative-layout-shift"]?.numericValue ?? 0,
    };
  } catch {
    return null;
  }
}

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
  prio: string; region: string; auswahl: boolean; papierkorb: boolean; sort: Sortierung[];
};
const FILTER_LEER: Filter = {
  q: "", kat: [], art: "alle", web: "alle", gep: "alle", sig: [], prio: "", region: "alle",
  auswahl: false, papierkorb: false, sort: [{ schluessel: "prioritaet", ab: true }],
};
const SORT_SCHLUESSEL: SortSchluessel[] = ["auswahl", "prioritaet", "name", "website", "kategorie", "score_website", "score_betrieb", "google", "geprueft"];
// Text-Spalten steigen beim ersten Klick, Zahlen fallen – so, wie man es
// jeweils lesen will.
const SORT_TEXT = new Set<SortSchluessel>(["name", "website", "kategorie"]);

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
    auswahl: p.get("auswahl") === "1", papierkorb: p.get("papierkorb") === "1",
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
  const sortStd = f.sort.length === 1 && f.sort[0].schluessel === "prioritaet" && f.sort[0].ab;
  if (!sortStd) p.set("sort", f.sort.map(s => `${s.schluessel}:${s.ab ? "ab" : "auf"}`).join(","));
  const s = p.toString();
  return `${window.location.pathname}${s ? `?${s}` : ""}`;
}

const filterAktiv = (f: Filter) =>
  !!f.q || f.kat.length > 0 || f.art !== "alle" || f.web !== "alle" || f.gep !== "alle" || f.sig.length > 0 || !!f.prio || f.region !== "alle" || f.auswahl;

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
    .filter(b => !f.kat.length || f.kat.includes(b.kategorie || ""))
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
    .sort((x, y) => vergleichen(x, y, f.sort));
}

// ---------------------------------------------------------------- Bausteine

function Kachel({ titel, wert, unter }: { titel: string; wert: string; unter?: string }) {
  return (
    <div className="mon-kachel">
      <p className="mon-kachel-titel">{titel}</p>
      <p className="mon-kachel-wert">{wert}</p>
      {unter && <p className="mon-kachel-unter">{unter}</p>}
    </div>
  );
}

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

// Drei Chips, der Rest hinter "+n": das Popover oeffnet beim Ueberfahren
// und bei Fokus (Tab oder Tipp am Handy) – rein per CSS, damit Tipp und
// Fokus sich nicht gegenseitig aufheben.
// Das Popover liegt "fixed" im Sichtfenster, nicht im Scrollkasten der
// Tabelle – dort wuerde es rechts oder oben abgeschnitten. Lage beim
// Ueberfahren/Fokus aus dem Chip berechnen: mittig darunter, am Rand nach
// innen geschoben, unten im Fenster nach oben geklappt.
const POPOVER_BREITE = 320;
function popoverLage(e: React.SyntheticEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const breite = Math.min(POPOVER_BREITE, window.innerWidth - 32);
  const x = Math.max(16, Math.min(r.left + r.width / 2 - breite / 2, window.innerWidth - 16 - breite));
  const nachOben = r.bottom + 6 + 220 > window.innerHeight && r.top > window.innerHeight / 2;
  el.style.setProperty("--pop-x", `${Math.round(x)}px`);
  el.style.setProperty("--pop-y", `${Math.round(nachOben ? window.innerHeight - r.top + 6 : r.bottom + 6)}px`);
  el.dataset.lage = nachOben ? "oben" : "unten";
}

function SignalChips({ signale }: { signale: Signal[] }) {
  if (!signale.length) return <span className="text-[var(--fg-subtle)]">—</span>;
  const sichtbar = signale.slice(0, 3);
  const rest = signale.slice(3);
  return (
    <span className="akq-signale">
      {sichtbar.map(s => <span key={s.code} className={`akq-signal ${s.seite}`} title={`${s.punkte} Punkte`}>{s.text}</span>)}
      {rest.length > 0 && (
        <span className="akq-mehr" tabIndex={0} role="button" aria-label={`${rest.length} weitere Signale`}
              onMouseEnter={popoverLage} onFocus={popoverLage}
              onKeyDown={e => { if (e.key === "Escape") (e.currentTarget as HTMLElement).blur(); }}>
          <span className="akq-signal">+{rest.length}</span>
          <span className="akq-popover" role="tooltip">
            <ul>
              {rest.map(s => (
                <li key={s.code}>
                  <span>{s.text}</span>
                  <b className={s.seite}>{s.seite === "betrieb" ? "+" : ""}{s.punkte}</b>
                </li>
              ))}
            </ul>
          </span>
        </span>
      )}
    </span>
  );
}

// Mehrfachauswahl als Knopf mit Liste – fuer Kategorie und Signal.
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
  const offen = q === "vermutet" || q === "google";
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

  // Filter und Sortierung stehen in der URL, damit Reload und Teilen sie behalten.
  const [filter, setFilter] = useState<Filter>(() => filterAusUrl(suchparameter.toString()));

  // Suche
  const [region, setRegion] = useState("wuerzburg");
  const [ort, setOrt] = useState("");
  const [radius, setRadius] = useState("25");
  const [sucht, setSucht] = useState(false);
  const [suchFortschritt, setSuchFortschritt] = useState("");
  const [suchErgebnis, setSuchErgebnis] = useState<{ gefunden: number; neu: number } | null>(null);

  // Sammellaeufe (Pruefen, Google), Zeilenzustand
  const [mitPsi, setMitPsi] = useState(false);
  const [lauf, setLauf] = useState<{ art: "pruefen" | "google"; gesamt: number; fertig: number } | null>(null);
  const [inArbeit, setInArbeit] = useState<Set<number>>(new Set());
  const [hinweise, setHinweise] = useState<Record<number, { text: string; fehler: boolean }>>({});
  const abbruch = useRef(false);
  const hinweisTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [googleEingerichtet, setGoogleEingerichtet] = useState<boolean | null>(null);
  const [googleTest, setGoogleTest] = useState<{ laeuft?: boolean; ok?: boolean; text: string } | null>(null);

  // Zeile auf/zu und die vollen Pruefdaten dazu
  const [offen, setOffen] = useState<Set<number>>(new Set());
  const [verlauf, setVerlauf] = useState<Record<number, PruefungVoll[]>>({});

  // Anlegen
  const [formOffen, setFormOffen] = useState(false);
  const [neu, setNeu] = useState({ name: "", website: "", ort: "" });

  const ladeStand = useCallback(() =>
    api("/api/admin/akquise/stand").then(d => setStand(d as Stand)).catch(() => setStand(null)), []);

  const ladeListe = useCallback((papierkorb: boolean) =>
    api(`/api/admin/akquise/betriebe${papierkorb ? "?papierkorb=1" : ""}`)
      .then(d => setBetriebe((d.betriebe || []).map((b: Betrieb) => ({ ...b, signale: signaleLesen(b.signale) }))))
      .catch(e => { setBetriebe([]); setFehler(e instanceof Error ? e.message : "Ging nicht."); }), []);

  useEffect(() => {
    api("/api/admin/akquise/google").then(d => setGoogleEingerichtet(!!d.eingerichtet)).catch(() => setGoogleEingerichtet(null));
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", filterInUrl(filter));
  }, [filter]);

  // Die Liste kommt je nach Ansicht (aktiv / Papierkorb) neu vom Server.
  useEffect(() => {
    ladeListe(filter.papierkorb);
    ladeStand();
  }, [filter.papierkorb, ladeListe, ladeStand]);

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

  // Wayback und PageSpeed nach einer erreichbaren Pruefung nachziehen.
  const nachziehen = async (id: number, website: string | null, a: PruefAntwort, psi: boolean) => {
    if (!website || !a.pruefung?.erreichbar || istBoerse(website)) return;
    const wb = await waybackHolen(website);
    if (wb) {
      const a2 = (await api("/api/admin/akquise/pruefen", { method: "PATCH", body: JSON.stringify({ id, wayback: wb }) })) as PruefAntwort;
      pruefungUebernehmen(id, a2);
    }
    if (psi) {
      const werte = await psiHolen(website);
      if (werte) {
        const a3 = (await api("/api/admin/akquise/pruefen", { method: "PATCH", body: JSON.stringify({ id, psi: werte }) })) as PruefAntwort;
        pruefungUebernehmen(id, a3);
      }
    }
  };

  const pruefen = async (b: Betrieb, psi: boolean, { oeffnen = false } = {}) => {
    setInArbeit(s => new Set(s).add(b.id));
    hinweisSetzen(b.id, "Prüft …");
    try {
      const a = (await api("/api/admin/akquise/pruefen", { method: "POST", body: JSON.stringify({ id: b.id }) })) as PruefAntwort;
      pruefungUebernehmen(b.id, a);
      let text = "Geprüft";
      if (a.gefunden === false) text = a.hinweis || "Keine Website gefunden";
      else if (a.geraten) text = `Website geraten: ${host(a.geraten.website)} – bitte bestätigen`;
      else if (a.pruefung?.fehler) text = `Geprüft – ${a.pruefung.fehler}`;
      hinweisSetzen(b.id, text, a.gefunden === false, a.gefunden === false || a.geraten ? 0 : 6000);
      if (oeffnen) aufklappen(b.id, true);
      await nachziehen(b.id, a.website ?? b.website, a, psi);
    } catch (e) {
      hinweisSetzen(b.id, e instanceof Error ? e.message : "Prüfung fehlgeschlagen.", true, 12000);
    } finally {
      setInArbeit(s => { const n = new Set(s); n.delete(b.id); return n; });
    }
  };

  // Gibt die Fehlermeldung zurueck, damit der Sammellauf merkt, wenn Google
  // jede Anfrage aus demselben Grund abweist.
  const googleSuchen = async (b: Betrieb): Promise<string | void> => {
    setInArbeit(s => new Set(s).add(b.id));
    hinweisSetzen(b.id, "Google …");
    try {
      const a = (await api("/api/admin/akquise/google", { method: "POST", body: JSON.stringify({ id: b.id }) })) as PruefAntwort;
      if (a.gefunden === false) {
        zeileAendern(b.id, { google_stand: a.google_stand || new Date().toISOString() });
        hinweisSetzen(b.id, "Bei Google Maps nicht gefunden", false, 8000);
        return;
      }
      pruefungUebernehmen(b.id, a);
      const g = a.google;
      let text = g ? `Google: ${note(g.google_bewertung)} · ${zahl(g.google_anzahl)} Bewertungen` : "Google abgefragt";
      if (a.website_uebernommen && a.website) text = `Website von Google: ${host(a.website)}`;
      hinweisSetzen(b.id, text, false, 8000);
      await nachziehen(b.id, a.website ?? b.website, a, false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Google fehlgeschlagen.";
      if (/nicht eingerichtet/i.test(msg)) setGoogleEingerichtet(false);
      hinweisSetzen(b.id, msg, true, 12000);
      return msg;
    } finally {
      setInArbeit(s => { const n = new Set(s); n.delete(b.id); return n; });
    }
  };

  // Sammellauf: zwei gleichzeitig. Abbrechen laesst die beiden laufenden
  // fertig werden und startet nur keine neuen.
  // Liefert ein Schritt dreimal hintereinander denselben Fehler, liegt es
  // nicht am Betrieb, sondern an der Einrichtung – dann haelt der Lauf an und
  // der Grund steht oben, statt 175-mal in den Zeilen.
  const sammellauf = async (art: "pruefen" | "google", ziele: Betrieb[], schritt: (b: Betrieb) => Promise<string | void>) => {
    if (!ziele.length) return;
    abbruch.current = false;
    setFehler("");
    setLauf({ art, gesamt: ziele.length, fertig: 0 });
    let i = 0;
    let letzter = "", gleich = 0;
    const arbeiter = async () => {
      while (!abbruch.current) {
        const b = ziele[i++];
        if (!b) return;
        const msg = await schritt(b);
        if (msg) {
          gleich = msg === letzter ? gleich + 1 : 1;
          letzter = msg;
          if (gleich >= 3) {
            abbruch.current = true;
            setFehler(`Lauf angehalten: ${msg}`);
          }
        } else gleich = 0;
        setLauf(l => (l ? { ...l, fertig: l.fertig + 1 } : l));
      }
    };
    await Promise.all([arbeiter(), arbeiter()]);
    setLauf(null);
    ladeStand();
  };
  const allePruefen = () => sammellauf("pruefen", (betriebe || []).filter(brauchtPruefung), b => pruefen(b, mitPsi));
  const alleGoogle = () => sammellauf("google", (betriebe || []).filter(brauchtGoogle), googleSuchen);
  const googleTesten = async () => {
    setGoogleTest({ laeuft: true, text: "Verbindung wird geprüft …" });
    try {
      const d = await api("/api/admin/akquise/google?test=1");
      if (!d.eingerichtet) setGoogleTest({ ok: false, text: "Kein PLACES_KEY in Cloudflare." });
      else if (d.test?.ok) setGoogleTest({ ok: true, text: `Verbindung steht – Testtreffer: ${d.test.name || "ohne Namen"}${d.test.website ? ` · ${host(d.test.website)}` : ""}` });
      else setGoogleTest({ ok: false, text: d.test?.fehler || "Unbekannter Fehler." });
    } catch (e) {
      setGoogleTest({ ok: false, text: e instanceof Error ? e.message : "Test fehlgeschlagen." });
    }
  };

  // Suche: Bereich vom Server, Overpass im Browser, Elemente zurueck.
  const suchen = async () => {
    setSucht(true); setFehler(""); setSuchErgebnis(null); setSuchFortschritt("Bereich wird bestimmt …");
    try {
      const params = new URLSearchParams({ region });
      if (region === "ort") {
        if (!ort.trim()) { setFehler("Bitte einen Ort angeben."); return; }
        params.set("ort", ort.trim());
        params.set("radiusKm", String(Math.max(1, Math.min(80, Number(radius) || 25))));
      }
      const v = await api(`/api/admin/akquise/suche?${params.toString()}`);
      const elements = await overpassHolen(String(v.query || ""), setSuchFortschritt);
      setSuchFortschritt(`${zahl(elements.length)} Elemente – werden gespeichert …`);
      const d = await api("/api/admin/akquise/suche", { method: "POST", body: JSON.stringify({ region: v.region, bbox: v.bbox, elements }) });
      setSuchErgebnis({ gefunden: d.gefunden ?? 0, neu: d.neu ?? 0 });
      await Promise.all([ladeListe(filter.papierkorb), ladeStand()]);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Suche fehlgeschlagen.");
    } finally {
      setSucht(false);
      setSuchFortschritt("");
    }
  };

  const patch = (body: Record<string, unknown>) =>
    api("/api/admin/akquise/betriebe", { method: "PATCH", body: JSON.stringify(body) });

  const auswahlSchalten = (b: Betrieb) => {
    const auswahl = b.auswahl ? 0 : 1;
    zeileAendern(b.id, { auswahl });
    patch({ id: b.id, auswahl }).then(() => ladeStand()).catch(e => setFehler(e.message));
  };

  const statusSetzen = (id: number, status: string) => {
    zeileAendern(id, { status });
    patch({ id, status }).then(() => ladeStand()).catch(e => setFehler(e.message));
  };

  const notizSpeichern = (b: Betrieb, notiz: string) => {
    if ((b.notiz || "") === notiz) return;
    zeileAendern(b.id, { notiz });
    patch({ id: b.id, notiz }).catch(e => setFehler(e.message));
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
        await pruefen({ ...b, website: d.website as string, website_quelle: "manuell" }, false);
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

  const inPapierkorb = (b: Betrieb) => {
    setBetriebe(liste => (liste ? liste.filter(x => x.id !== b.id) : liste));
    api("/api/admin/akquise/betriebe", { method: "DELETE", body: JSON.stringify({ id: b.id }) })
      .then(() => ladeStand())
      .catch(e => setFehler(e.message));
  };

  const wiederherstellen = (b: Betrieb) => {
    setBetriebe(liste => (liste ? liste.filter(x => x.id !== b.id) : liste));
    api("/api/admin/akquise/betriebe", { method: "POST", body: JSON.stringify({ id: b.id, aktion: "wiederherstellen" }) })
      .then(() => ladeStand())
      .catch(e => setFehler(e.message));
  };

  const endgueltigLoeschen = (b: Betrieb) => {
    if (!confirm(`„${b.name}“ endgültig löschen? Das lässt sich nicht rückgängig machen.`)) return;
    setBetriebe(liste => (liste ? liste.filter(x => x.id !== b.id) : liste));
    api("/api/admin/akquise/betriebe", { method: "DELETE", body: JSON.stringify({ id: b.id, endgueltig: true }) })
      .then(() => ladeStand())
      .catch(e => setFehler(e.message));
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

  const signalOptionen = useMemo(() => {
    const codes = new Set<string>();
    for (const b of liste) for (const s of b.signale || []) codes.add(s.code);
    return [...codes].sort().map(c => ({ wert: c, label: SIGNAL_LABEL[c] || c }));
  }, [liste]);
  const regionOptionen = useMemo(() => [...new Set(liste.map(b => b.region).filter((r): r is string => !!r))].sort(), [liste]);

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

  const faellig = filter.papierkorb ? 0 : liste.filter(brauchtPruefung).length;
  const googleFaellig = filter.papierkorb ? 0 : liste.filter(brauchtGoogle).length;
  const letzterLauf = stand?.laeufe?.[0];

  // Sortierbarer Spaltenkopf – Pfeil zeigt die Richtung, die kleine Zahl
  // die Stelle bei Zweit- und Drittsortierung.
  const kopf = (schluessel: SortSchluessel, inhalt: React.ReactNode, className?: string) => {
    const pos = filter.sort.findIndex(s => s.schluessel === schluessel);
    const s = pos >= 0 ? filter.sort[pos] : null;
    return (
      <th className={`akq-sortierbar${className ? ` ${className}` : ""}${s ? " aktiv" : ""}`}
          aria-sort={s ? (s.ab ? "descending" : "ascending") : "none"}
          onClick={e => sortieren(schluessel, e.shiftKey)} title="Klick sortiert, Shift-Klick sortiert zusätzlich">
        <span>{inhalt}{s && (s.ab ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}{s && pos > 0 && <i>{pos + 1}</i>}</span>
      </th>
    );
  };

  return (
    <>
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      <div className="mon-kennzahlen akq-kennzahlen">
        <Kachel titel="Betriebe" wert={zahl(stand?.betriebe)} />
        <Kachel titel="Mit Website" wert={zahl(stand?.mitWebsite)} />
        <Kachel titel="Ohne Website" wert={zahl(stand?.ohneWebsite)} />
        <Kachel titel="Nur Börse" wert={zahl(stand?.nurBoerse)} />
        <Kachel titel="Geprüft" wert={zahl(stand?.geprueft)} unter={faellig ? `${zahl(faellig)} fällig` : undefined} />
        <Kachel titel="Priorität ≥ 60" wert={zahl(stand?.prioHoch)} />
        <Kachel titel="Auswahl" wert={zahl(stand?.auswahl)} />
        <Kachel titel="Papierkorb" wert={zahl(stand?.papierkorb)} />
      </div>

      {/* Steuerung: Suche links, Sammellaeufe rechts */}
      <section className="mon-block">
        <div className="akq-steuerung">
          <select value={region} onChange={e => setRegion(e.target.value)} className="field px-3 py-2 text-sm" style={{ width: "auto" }} disabled={sucht}>
            {REGIONEN.map(r => <option key={r.wert} value={r.wert}>{r.label}</option>)}
          </select>
          {region === "ort" && (
            <>
              <input value={ort} onChange={e => setOrt(e.target.value)} placeholder="Ort" className="field px-3 py-2 text-sm" style={{ width: 180 }} />
              <label className="akq-inline">
                <input type="number" min={1} max={80} value={radius} onChange={e => setRadius(e.target.value)}
                       className="field px-3 py-2 text-sm" style={{ width: 80 }} /> km
              </label>
            </>
          )}
          <button onClick={suchen} disabled={sucht || !!lauf} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
            {sucht ? "Sucht …" : "Betriebe suchen"}
          </button>
          {sucht && suchFortschritt && <span className="akq-hinweis">{suchFortschritt}</span>}
          {!sucht && suchErgebnis && (
            <span className="akq-hinweis">{zahl(suchErgebnis.gefunden)} gefunden · {zahl(suchErgebnis.neu)} neu</span>
          )}
          {!sucht && !suchErgebnis && letzterLauf && (
            <span className="akq-hinweis">
              Letzter Lauf: {letzterLauf.region || "—"} · {zahl(letzterLauf.gefunden)} gefunden · {zahl(letzterLauf.neu)} neu · {datum(letzterLauf.zeitpunkt)}
            </span>
          )}

          <span className="akq-trenner" aria-hidden="true" />

          {lauf ? (
            <>
              <span className="akq-fortschritt">{lauf.art === "google" ? "Google" : "Prüfung"} {lauf.fertig} / {lauf.gesamt}</span>
              <button onClick={() => { abbruch.current = true; }} className="btn-ghost px-4 py-2 text-sm">Abbrechen</button>
            </>
          ) : (
            <>
              <button onClick={allePruefen} disabled={!faellig || sucht} className="btn-ghost px-4 py-2 text-sm disabled:opacity-60"
                      title={faellig ? `${faellig} ohne Prüfung oder älter als ${PRUEF_ALTER_TAGE} Tage` : "Alle Prüfungen sind aktuell"}>
                Websites prüfen{faellig ? ` (${faellig})` : ""}
              </button>
              <label className="akq-inline">
                <input type="checkbox" checked={mitPsi} onChange={e => setMitPsi(e.target.checked)} />
                mit PageSpeed (langsamer)
              </label>
              <button onClick={alleGoogle} disabled={!googleFaellig || sucht || googleEingerichtet === false}
                      className="btn-ghost px-4 py-2 text-sm disabled:opacity-60"
                      title={googleFaellig ? `${googleFaellig} ohne Website oder ohne Google-Abfrage` : "Alle bei Google abgefragt"}>
                Websites bei Google suchen{googleFaellig ? ` (${googleFaellig})` : ""}
              </button>
              <button onClick={googleTesten} disabled={googleEingerichtet === false || !!googleTest?.laeuft}
                      className="akq-knopf" title="Eine Testabfrage bei Google Places">
                Verbindung testen
              </button>
            </>
          )}
        </div>
        {googleTest && (
          <p className={googleTest.ok === false ? "akq-google-hinweis" : "akq-hinweis mt-2"}>{googleTest.text}</p>
        )}
        {googleEingerichtet === false && (
          <p className="akq-google-hinweis">
            Google Places nicht eingerichtet – PLACES_KEY in Cloudflare hinterlegen (Google Cloud Console → Places API (New) → API-Schlüssel, nur auf diese API beschränken).
          </p>
        )}
      </section>

      {/* Filter und Tabelle */}
      <section className="mon-block">
        <div className="akq-steuerung mb-4">
          <input value={filter.q} onChange={e => setzeFilter({ q: e.target.value })} placeholder="Name, Ort oder Domain"
                 className="field px-3 py-2 text-sm" style={{ width: 200 }} />
          <MehrfachWahl label="Kategorie" optionen={KATEGORIEN} wert={filter.kat} onChange={kat => setzeFilter({ kat })} />
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
          <label className="akq-inline">
            min. Priorität
            <input type="number" min={0} max={100} value={filter.prio} onChange={e => setzeFilter({ prio: e.target.value })}
                   className="field px-3 py-2 text-sm" style={{ width: 72 }} />
          </label>
          {regionOptionen.length > 1 && (
            <select value={filter.region} onChange={e => setzeFilter({ region: e.target.value })} className="field px-3 py-2 text-sm" style={{ width: "auto" }} aria-label="Region">
              <option value="alle">Alle Regionen</option>
              {regionOptionen.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <label className="akq-inline">
            <input type="checkbox" checked={filter.auswahl} onChange={e => setzeFilter({ auswahl: e.target.checked })} /> nur Auswahl
          </label>
          <label className="akq-inline">
            <input type="checkbox" checked={filter.papierkorb} onChange={e => papierkorbSchalten(e.target.checked)} /> Papierkorb
          </label>
          <span className="akq-trenner" aria-hidden="true" />
          <span className="akq-hinweis">{zahl(sichtbar.length)} von {zahl(liste.length)}</span>
          {filterAktiv(filter) && (
            <button onClick={() => setFilter(f => ({ ...FILTER_LEER, papierkorb: f.papierkorb, sort: f.sort }))} className="akq-knopf">Filter zurücksetzen</button>
          )}
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
          <form onSubmit={anlegen} className="akq-steuerung mb-5">
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

        {laedt ? (
          <p className="mon-leer">Wird geladen …</p>
        ) : liste.length === 0 ? (
          <p className="mon-leer py-6 text-center">{filter.papierkorb ? "Der Papierkorb ist leer." : "Noch keine Betriebe. Region wählen und suchen."}</p>
        ) : sichtbar.length === 0 ? (
          <p className="mon-leer py-6 text-center">Kein Betrieb passt zu den Filtern.</p>
        ) : (
          <div className="akq-huelle">
            <table className="mon-tabelle akq-tabelle">
              <thead>
                <tr>
                  {kopf("auswahl", <Star size={12} />, "akq-stern-kopf")}
                  {kopf("prioritaet", "Priorität")}
                  {kopf("name", "Betrieb")}
                  {kopf("website", "Website")}
                  {kopf("kategorie", "Kategorie")}
                  {kopf("score_website", "Schwäche", "num")}
                  {kopf("score_betrieb", "Stärke", "num")}
                  {kopf("google", "Google")}
                  <th>Signale</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map(b => {
                  const istOffen = offen.has(b.id);
                  const arbeitet = inArbeit.has(b.id);
                  const hinweis = hinweise[b.id];
                  const voll = verlauf[b.id]?.[0];
                  const lp = b.letzte_pruefung;
                  const signale = b.signale || [];
                  const boerse = istBoerse(b.website);
                  return (
                    <Fragment key={b.id}>
                      <tr className={`${istOffen ? "akq-offen" : ""}${b.auswahl ? " akq-gewaehlt" : ""}`}>
                        <td className="akq-stern">
                          <button type="button" onClick={() => auswahlSchalten(b)} className={b.auswahl ? "an" : ""}
                                  aria-pressed={!!b.auswahl} aria-label={b.auswahl ? "Aus der Auswahl nehmen" : "In die Auswahl"}>
                            <Star size={15} />
                          </button>
                        </td>
                        <td><Prio wert={b.prioritaet} /></td>
                        <td className="akq-betrieb">
                          <b className="text-[var(--fg)] font-semibold">{b.name}</b>
                          <span className="block text-[0.76rem] text-[var(--fg-subtle)]">
                            {[b.ort, b.marken].filter(Boolean).join(" · ") || (b.art === "car_repair" ? "Werkstatt" : "")}
                          </span>
                          {hinweis && <span className={`akq-zeilenhinweis${hinweis.fehler ? " fehler" : ""}`}>{hinweis.text}</span>}
                        </td>
                        <td className="akq-website">
                          {b.website ? (
                            <>
                              <a href={b.website} target="_blank" rel="noopener noreferrer" className="akq-link" title={b.website}>
                                {boerse ? `Börsen-Seite (${host(b.website)})` : host(b.website)}
                              </a>
                              <QuelleBadge b={b} bestaetigen={websiteBestaetigen} verwerfen={websiteVerwerfen} />
                            </>
                          ) : <span className="text-[var(--fg-subtle)]">keine</span>}
                        </td>
                        <td><KategorieChip wert={b.kategorie} /></td>
                        <td className="num">{zahl(b.score_website)}</td>
                        <td className="num">{zahl(b.score_betrieb)}</td>
                        <td className="akq-google">
                          {b.google_anzahl != null || b.google_bewertung != null
                            ? <span title={b.google_stand ? `Stand ${datum(b.google_stand)}` : undefined}>{note(b.google_bewertung)} · {zahl(b.google_anzahl)}</span>
                            : <span className="text-[var(--fg-subtle)]">–</span>}
                        </td>
                        <td><SignalChips signale={signale} /></td>
                        <td>
                          <span className="akq-aktionen">
                            {filter.papierkorb ? (
                              <>
                                <button onClick={() => wiederherstellen(b)} className="akq-knopf" title="Wiederherstellen"><RotateCcw size={13} /> Zurück</button>
                                <button onClick={() => endgueltigLoeschen(b)} className="akq-knopf" title="Endgültig löschen"><Trash2 size={14} /> Endgültig</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => pruefen(b, mitPsi, { oeffnen: true }).then(ladeStand)} disabled={arbeitet || !!lauf} className="akq-knopf">
                                  {arbeitet && hinweis?.text === "Prüft …" ? "Prüft …" : "Prüfen"}
                                </button>
                                <button onClick={() => googleSuchen(b).then(ladeStand)} disabled={arbeitet || !!lauf || googleEingerichtet === false} className="akq-knopf"
                                        title={googleEingerichtet === false ? "Google Places nicht eingerichtet" : "Bei Google Maps nachschlagen"}>
                                  Google
                                </button>
                                <a href={`/admin/akquise/post?betrieb=${b.id}`} className="akq-knopf" title="Brief vorbereiten">Brief</a>
                              </>
                            )}
                            <button onClick={() => aufklappen(b.id)} className="akq-knopf" aria-expanded={istOffen} aria-label="Details">
                              {istOffen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {!filter.papierkorb && (
                              <button onClick={() => inPapierkorb(b)} className="akq-knopf" aria-label={`${b.name} in den Papierkorb`} title="In den Papierkorb">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                      {istOffen && (
                        <tr className="akq-details">
                          <td colSpan={10}>
                            <div className="akq-details-raster">
                              <div>
                                <p className="akq-dt">Signale</p>
                                {signale.length ? (
                                  <ul className="akq-signalliste">
                                    {signale.map(s => (
                                      <li key={s.code}>
                                        <span>{s.text}</span>
                                        <span className={`akq-punkte ${s.seite}`}>{s.seite === "betrieb" ? "+" : ""}{s.punkte}</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : <p className="mon-leer">Noch nicht geprüft.</p>}
                              </div>

                              <div>
                                <p className="akq-dt">Prüfung</p>
                                <dl className="akq-dl">
                                  <dt>Zeitpunkt</dt><dd>{lp ? datum(lp.zeitpunkt) : "—"}</dd>
                                  <dt>Erreichbar</dt><dd>{lp ? (lp.erreichbar ? "ja" : "nein") : "—"}</dd>
                                  <dt>HTTPS</dt><dd>{lp ? (lp.https ? "ja" : "nein") : "—"}</dd>
                                  <dt>Viewport</dt><dd>{lp ? (lp.viewport ? "ja" : "nein") : "—"}</dd>
                                  <dt>System</dt><dd>{lp?.baukasten || lp?.cms || voll?.generator || "—"}</dd>
                                  <dt>© im Fuß</dt><dd>{lp?.copyright_jahr ?? "—"}</dd>
                                  {voll?.titel && <><dt>Titel</dt><dd className="akq-lang">{voll.titel}</dd></>}
                                  {voll?.antwort_ms != null && <><dt>Antwort</dt><dd>{zahl(voll.antwort_ms)} ms · {zahl(voll.groesse_kb)} KB</dd></>}
                                  {voll?.roh?.verifiziert_durch?.length ? <><dt>Bezug</dt><dd>{voll.roh.verifiziert_durch.join(", ")} im HTML</dd></> : null}
                                  {lp?.fehler && <><dt>Fehler</dt><dd className="akq-lang">{lp.fehler}</dd></>}
                                </dl>
                              </div>

                              <div>
                                <p className="akq-dt">PageSpeed &amp; Wayback</p>
                                <dl className="akq-dl">
                                  <dt>Leistung</dt><dd>{lp?.psi_leistung ?? voll?.psi_leistung ?? "—"}</dd>
                                  <dt>LCP</dt><dd>{voll?.psi_lcp != null ? `${voll.psi_lcp.toFixed(1).replace(".", ",")} s` : "—"}</dd>
                                  <dt>CLS</dt><dd>{voll?.psi_cls != null ? voll.psi_cls.toFixed(2).replace(".", ",") : "—"}</dd>
                                  <dt>Erster Snapshot</dt><dd>{datum(lp?.wayback_erster)}</dd>
                                  <dt>Letzter Snapshot</dt><dd>{datum(lp?.wayback_letzter)}</dd>
                                  <dt>Snapshots</dt><dd>{zahl(lp?.wayback_anzahl ?? voll?.wayback_anzahl)}</dd>
                                </dl>
                              </div>

                              <div>
                                <p className="akq-dt">Betrieb</p>
                                <dl className="akq-dl">
                                  <dt>Adresse</dt>
                                  <dd className="akq-lang">{[b.strasse, [b.plz, b.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"}</dd>
                                  <dt>Telefon</dt>
                                  <dd>{b.telefon ? <a href={`tel:${b.telefon.replace(/\s/g, "")}`} className="akq-link">{b.telefon}</a> : "—"}</dd>
                                  {b.email && <><dt>E-Mail</dt><dd className="akq-lang">{b.email}</dd></>}
                                  {b.oeffnungszeiten && <><dt>Öffnungszeiten</dt><dd className="akq-lang">{b.oeffnungszeiten}</dd></>}
                                  <dt>Quelle</dt><dd>{b.quelle === "osm" ? `OSM${b.region ? ` · ${b.region}` : ""}` : "manuell"}</dd>
                                  <dt>Status</dt>
                                  <dd>
                                    <span className={`akq-status ${b.status}`}>{STATUS.find(s => s.wert === b.status)?.label || b.status}</span>
                                    <select value={b.status} onChange={e => statusSetzen(b.id, e.target.value)}
                                            className="field px-2 py-1 text-xs ml-2" style={{ width: "auto", display: "inline-block" }} aria-label={`Status von ${b.name}`}>
                                      {STATUS.map(s => <option key={s.wert} value={s.wert}>{s.label}</option>)}
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
                                        {b.google_place_id
                                          ? <>{note(b.google_bewertung)} Sterne · {zahl(b.google_anzahl)} Bewertungen</>
                                          : "nicht gefunden"}
                                        <span className="text-[var(--fg-subtle)]"> · Stand {datum(b.google_stand)}</span>
                                        {b.google_place_id && (
                                          <> · <a href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(b.google_place_id)}`}
                                                  target="_blank" rel="noopener noreferrer" className="akq-link">bei Google Maps ↗</a></>
                                        )}
                                      </>
                                    ) : "—"}
                                  </dd>
                                </dl>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, b.plz, b.ort].filter(Boolean).join(" "))}`}
                                   target="_blank" rel="noopener noreferrer" className="akq-link text-sm inline-block mt-2">
                                  Auf Google Maps suchen ↗
                                </a>
                              </div>

                              <div className="akq-notiz">
                                <p className="akq-dt">Notiz</p>
                                <textarea defaultValue={b.notiz || ""} rows={4}
                                          onBlur={e => notizSpeichern(b, e.target.value)}
                                          className="field px-3 py-2 text-sm" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function AkquiseSeite() {
  return (
    <AdminShell titel="Akquise" eyebrow="Vertrieb" lead="Autohäuser finden, Websites prüfen, die richtigen ansprechen.">
      <Suspense fallback={<p className="mon-leer">Wird geladen …</p>}>
        <AkquiseCockpit />
      </Suspense>
    </AdminShell>
  );
}
