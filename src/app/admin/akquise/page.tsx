"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Download, Plus, Trash2 } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

// Akquise-Cockpit: Autohaeuser aus OpenStreetMap holen, ihre Websites vom
// Server pruefen lassen und die Liste nach Prioritaet sortiert zeigen.
// Die Bewertung selbst passiert in functions/_lib/akquise.js – hier wird
// nur gesteuert, gefiltert und angezeigt. Ausnahme PageSpeed: die Antwort
// von Google ist gross, deshalb holt sie der Browser und reicht nur die
// drei Zahlen weiter (PATCH /pruefen).

type Signal = { code: string; text: string; punkte: number; seite: "website" | "betrieb" };

type LetztePruefung = {
  zeitpunkt: string;
  erreichbar: number | null; https: number | null; viewport: number | null;
  cms: string | null; baukasten: string | null; copyright_jahr: number | null;
  psi_leistung: number | null;
  wayback_erster: string | null; wayback_letzter: string | null;
  fehler: string | null;
};

// Volle Pruefung aus GET /pruefen?id= – mehr Spalten als in der Liste.
type PruefungVoll = LetztePruefung & {
  id: number;
  psi_lcp: number | null; psi_cls: number | null;
  wayback_anzahl: number | null;
  titel: string | null; generator: string | null;
  antwort_ms: number | null; groesse_kb: number | null;
  impressum: number | null; datenschutz: number | null; schema_org: number | null;
  signale: Signal[] | string | null;
};

type Betrieb = {
  id: number;
  quelle: string; quelle_id: string | null;
  name: string; art: string | null; marken: string | null;
  strasse: string | null; plz: string | null; ort: string | null;
  lat: number | null; lng: number | null;
  telefon: string | null; email: string | null; website: string | null;
  oeffnungszeiten: string | null; region: string | null;
  status: string; notiz: string | null;
  score_website: number | null; score_betrieb: number | null; prioritaet: number | null;
  geprueft_am: string | null; angelegt: string; geaendert: string;
  signale: Signal[] | null;
  letzte_pruefung: LetztePruefung | null;
};

type Lauf = { id: number; art: string; region: string | null; gefunden: number | null; neu: number | null; fehler: string | null; zeitpunkt: string };
type Stand = { betriebe: number; mitWebsite: number; geprueft: number; prioHoch: number; nachStatus: Record<string, number>; laeufe: Lauf[] };

type PruefAntwort = {
  pruefung?: Partial<PruefungVoll>;
  score_website?: number; score_betrieb?: number; prioritaet?: number;
  signale?: Signal[];
};

const STATUS: { wert: string; label: string }[] = [
  { wert: "neu", label: "Neu" },
  { wert: "beobachten", label: "Beobachten" },
  { wert: "brief", label: "Brief" },
  { wert: "kontakt", label: "Kontakt" },
  { wert: "kunde", label: "Kunde" },
  { wert: "aus", label: "Aus" },
];

const REGIONEN = [
  { wert: "wuerzburg", label: "Würzburg, 25 km" },
  { wert: "unterfranken", label: "Unterfranken" },
  { wert: "ort", label: "Ort eingeben" },
];

const REGION_WORT: Record<string, string> = { wuerzburg: "Würzburg", unterfranken: "Unterfranken" };

const PRUEF_ALTER_TAGE = 30;

const zahl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("de-DE"));

// Wayback liefert Zeitstempel wie "20150312101512"; die Datenbank sonst ISO.
function waybackDatum(wert: string | null | undefined) {
  if (!wert) return "—";
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(wert);
  return datum(m ? `${m[1]}-${m[2]}-${m[3]}` : wert);
}

function host(url: string | null) {
  if (!url) return "";
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; }
}

function signaleLesen(roh: Signal[] | string | null | undefined): Signal[] {
  if (Array.isArray(roh)) return roh;
  if (typeof roh === "string") { try { const p = JSON.parse(roh); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

function brauchtPruefung(b: Betrieb) {
  if (!b.geprueft_am) return true;
  const t = new Date(b.geprueft_am.replace(" ", "T") + (b.geprueft_am.includes("Z") ? "" : "Z")).getTime();
  return isNaN(t) || Date.now() - t > PRUEF_ALTER_TAGE * 86400000;
}

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

function csvFeld(wert: unknown) {
  const s = wert == null ? "" : String(wert);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s;
}

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

function SignalChips({ signale }: { signale: Signal[] }) {
  if (!signale.length) return <span className="text-[var(--fg-subtle)]">—</span>;
  const sichtbar = signale.slice(0, 3);
  const rest = signale.slice(3);
  return (
    <span className="akq-signale">
      {sichtbar.map(s => <span key={s.code} className={`akq-signal ${s.seite}`} title={`${s.punkte} Punkte`}>{s.text}</span>)}
      {rest.length > 0 && (
        <span className="akq-signal" title={rest.map(s => s.text).join("\n")}>+{rest.length}</span>
      )}
    </span>
  );
}

export default function AkquiseSeite() {
  const [betriebe, setBetriebe] = useState<Betrieb[]>([]);
  const [stand, setStand] = useState<Stand | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState("");

  // Suche
  const [region, setRegion] = useState("wuerzburg");
  const [ort, setOrt] = useState("");
  const [radius, setRadius] = useState("25");
  const [sucht, setSucht] = useState(false);
  const [suchErgebnis, setSuchErgebnis] = useState<{ gefunden: number; neu: number } | null>(null);

  // Pruefen
  const [mitPsi, setMitPsi] = useState(false);
  const [lauf, setLauf] = useState<{ gesamt: number; fertig: number } | null>(null);
  const [inArbeit, setInArbeit] = useState<Set<number>>(new Set());
  const abbruch = useRef(false);

  // Filter
  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState("alle");
  const [nurWebsite, setNurWebsite] = useState(false);
  const [minPrio, setMinPrio] = useState("");
  const [sortierung, setSortierung] = useState<"prioritaet" | "name" | "geprueft">("prioritaet");

  // Zeile auf/zu und die vollen Pruefdaten dazu
  const [offen, setOffen] = useState<Set<number>>(new Set());
  const [verlauf, setVerlauf] = useState<Record<number, PruefungVoll[]>>({});

  // Anlegen
  const [formOffen, setFormOffen] = useState(false);
  const [neu, setNeu] = useState({ name: "", website: "", ort: "" });

  const ladeStand = useCallback(() =>
    api("/api/admin/akquise/stand").then(d => setStand(d as Stand)).catch(() => setStand(null)), []);

  const ladeListe = useCallback(() =>
    api("/api/admin/akquise/betriebe?sortierung=prioritaet")
      .then(d => setBetriebe((d.betriebe || []).map((b: Betrieb) => ({ ...b, signale: signaleLesen(b.signale) }))))
      .catch(e => setFehler(e instanceof Error ? e.message : "Ging nicht.")), []);

  useEffect(() => {
    Promise.all([ladeListe(), ladeStand()]).finally(() => setLaedt(false));
  }, [ladeListe, ladeStand]);

  const zeileAendern = (id: number, aenderung: Partial<Betrieb>) =>
    setBetriebe(liste => liste.map(b => (b.id === id ? { ...b, ...aenderung } : b)));

  // Antwort von POST/PATCH /pruefen in die Zeile uebernehmen.
  const pruefungUebernehmen = (id: number, a: PruefAntwort) => {
    const aenderung: Partial<Betrieb> = {};
    if (typeof a.score_website === "number") aenderung.score_website = a.score_website;
    if (typeof a.score_betrieb === "number") aenderung.score_betrieb = a.score_betrieb;
    if (typeof a.prioritaet === "number") aenderung.prioritaet = a.prioritaet;
    if (a.signale) aenderung.signale = signaleLesen(a.signale);
    if (a.pruefung) {
      const p = a.pruefung;
      aenderung.letzte_pruefung = {
        zeitpunkt: p.zeitpunkt || new Date().toISOString(),
        erreichbar: p.erreichbar ?? null, https: p.https ?? null, viewport: p.viewport ?? null,
        cms: p.cms ?? null, baukasten: p.baukasten ?? null, copyright_jahr: p.copyright_jahr ?? null,
        psi_leistung: p.psi_leistung ?? null,
        wayback_erster: p.wayback_erster ?? null, wayback_letzter: p.wayback_letzter ?? null,
        fehler: p.fehler ?? null,
      };
      aenderung.geprueft_am = aenderung.letzte_pruefung.zeitpunkt;
    } else {
      aenderung.geprueft_am = new Date().toISOString();
    }
    zeileAendern(id, aenderung);
    // Die vollen Pruefdaten sind jetzt veraltet – beim naechsten Aufklappen neu holen.
    setVerlauf(v => { const kopie = { ...v }; delete kopie[id]; return kopie; });
  };

  const pruefen = async (b: Betrieb, psi: boolean) => {
    setInArbeit(s => new Set(s).add(b.id));
    try {
      const a = (await api("/api/admin/akquise/pruefen", { method: "POST", body: JSON.stringify({ id: b.id }) })) as PruefAntwort;
      pruefungUebernehmen(b.id, a);
      if (psi && b.website && a.pruefung?.erreichbar) {
        const werte = await psiHolen(b.website);
        if (werte) {
          const a2 = (await api("/api/admin/akquise/pruefen", { method: "PATCH", body: JSON.stringify({ id: b.id, psi: werte }) })) as PruefAntwort;
          pruefungUebernehmen(b.id, { ...a2, pruefung: a2.pruefung ?? { ...a.pruefung, psi_leistung: werte.leistung } });
        }
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Prüfung fehlgeschlagen.");
    } finally {
      setInArbeit(s => { const n = new Set(s); n.delete(b.id); return n; });
    }
  };

  // Alle faelligen Betriebe, zwei gleichzeitig. Abbrechen laesst die beiden
  // laufenden fertig werden und startet nur keine neuen.
  const allePruefen = async () => {
    const ziele = betriebe.filter(brauchtPruefung);
    if (!ziele.length) return;
    abbruch.current = false;
    setLauf({ gesamt: ziele.length, fertig: 0 });
    let i = 0;
    const arbeiter = async () => {
      while (!abbruch.current) {
        const b = ziele[i++];
        if (!b) return;
        await pruefen(b, mitPsi);
        setLauf(l => (l ? { ...l, fertig: l.fertig + 1 } : l));
      }
    };
    await Promise.all([arbeiter(), arbeiter()]);
    setLauf(null);
    ladeStand();
  };

  const suchen = async () => {
    setSucht(true); setFehler(""); setSuchErgebnis(null);
    try {
      const body: Record<string, unknown> = { region };
      if (region === "ort") {
        if (!ort.trim()) { setFehler("Bitte einen Ort angeben."); setSucht(false); return; }
        body.ort = ort.trim();
        body.radiusKm = Math.max(1, Math.min(80, Number(radius) || 25));
      }
      const d = await api("/api/admin/akquise/suche", { method: "POST", body: JSON.stringify(body) });
      setSuchErgebnis({ gefunden: d.gefunden ?? 0, neu: d.neu ?? 0 });
      await Promise.all([ladeListe(), ladeStand()]);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Suche fehlgeschlagen.");
    } finally {
      setSucht(false);
    }
  };

  const statusSetzen = async (id: number, status: string) => {
    zeileAendern(id, { status });
    await api("/api/admin/akquise/betriebe", { method: "PATCH", body: JSON.stringify({ id, status }) })
      .then(() => ladeStand())
      .catch(e => setFehler(e.message));
  };

  const notizSpeichern = async (b: Betrieb, notiz: string) => {
    if ((b.notiz || "") === notiz) return;
    zeileAendern(b.id, { notiz });
    await api("/api/admin/akquise/betriebe", { method: "PATCH", body: JSON.stringify({ id: b.id, notiz }) })
      .catch(e => setFehler(e.message));
  };

  const websiteSpeichern = async (b: Betrieb, website: string) => {
    if ((b.website || "") === website.trim()) return;
    await api("/api/admin/akquise/betriebe", { method: "PATCH", body: JSON.stringify({ id: b.id, website: website.trim() }) })
      .then(() => ladeListe())
      .catch(e => setFehler(e.message));
  };

  const loeschen = async (b: Betrieb) => {
    if (!confirm(`„${b.name}“ samt Prüfungen löschen?`)) return;
    setBetriebe(liste => liste.filter(x => x.id !== b.id));
    await api("/api/admin/akquise/betriebe", { method: "DELETE", body: JSON.stringify({ id: b.id }) })
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
      await Promise.all([ladeListe(), ladeStand()]);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Anlegen fehlgeschlagen.");
    }
  };

  const aufklappen = (id: number) => {
    setOffen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    if (!verlauf[id]) {
      api(`/api/admin/akquise/pruefen?id=${id}`)
        .then(d => setVerlauf(v => ({ ...v, [id]: (d.pruefungen || []) as PruefungVoll[] })))
        .catch(() => setVerlauf(v => ({ ...v, [id]: [] })));
    }
  };

  // Filter und Sortierung im Browser – die Liste ist klein genug.
  const sichtbar = betriebe
    .filter(b => statusFilter === "alle" || b.status === statusFilter)
    .filter(b => !nurWebsite || !!b.website)
    .filter(b => minPrio === "" || (b.prioritaet ?? -1) >= Number(minPrio))
    .filter(b => {
      const q = suche.trim().toLowerCase();
      return !q || b.name.toLowerCase().includes(q) || (b.ort || "").toLowerCase().includes(q);
    })
    .sort((x, y) => {
      if (sortierung === "name") return x.name.localeCompare(y.name, "de");
      if (sortierung === "geprueft") return (y.geprueft_am || "").localeCompare(x.geprueft_am || "");
      return (y.prioritaet ?? -1) - (x.prioritaet ?? -1) || x.name.localeCompare(y.name, "de");
    });

  const csvExport = () => {
    const kopf = ["Priorität", "Betrieb", "Straße", "PLZ", "Ort", "Marken", "Website", "Website-Schwäche", "Betrieb-Stärke", "Status", "Signale", "Telefon", "Geprüft", "Notiz"];
    const zeilen = sichtbar.map(b => [
      b.prioritaet, b.name, b.strasse, b.plz, b.ort, b.marken, b.website, b.score_website, b.score_betrieb,
      STATUS.find(s => s.wert === b.status)?.label || b.status,
      (b.signale || []).map(s => s.text).join(", "), b.telefon, b.geprueft_am ? datum(b.geprueft_am) : "", b.notiz,
    ].map(csvFeld).join(";"));
    // \uFEFF = BOM, damit Excel die Umlaute als UTF-8 liest.
    const blob = new Blob(["\uFEFF" + [kopf.join(";"), ...zeilen].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `akquise-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const faellig = betriebe.filter(brauchtPruefung).length;
  const letzterLauf = stand?.laeufe?.[0];
  const inKontakt = (stand?.nachStatus?.kontakt || 0) + (stand?.nachStatus?.kunde || 0);

  return (
    <AdminShell titel="Akquise" eyebrow="Vertrieb" lead="Autohäuser finden, Websites prüfen, die richtigen ansprechen.">
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      <div className="mon-kennzahlen">
        <Kachel titel="Betriebe" wert={zahl(stand?.betriebe ?? betriebe.length)} />
        <Kachel titel="Mit Website" wert={zahl(stand?.mitWebsite ?? betriebe.filter(b => b.website).length)} />
        <Kachel titel="Geprüft" wert={zahl(stand?.geprueft ?? betriebe.filter(b => b.geprueft_am).length)}
                unter={faellig ? `${zahl(faellig)} fällig` : undefined} />
        <Kachel titel="Priorität ≥ 60" wert={zahl(stand?.prioHoch ?? betriebe.filter(b => (b.prioritaet ?? 0) >= 60).length)} />
        <Kachel titel="Kontakt / Kunden" wert={zahl(stand ? inKontakt : betriebe.filter(b => b.status === "kontakt" || b.status === "kunde").length)} />
      </div>

      {/* Steuerung: Suche links, Pruefung rechts */}
      <section className="mon-block">
        <div className="akq-steuerung">
          <select value={region} onChange={e => setRegion(e.target.value)} className="field px-3 py-2 text-sm" style={{ width: "auto" }}>
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
            {sucht ? "Sucht…" : "Betriebe suchen"}
          </button>
          {suchErgebnis && (
            <span className="akq-hinweis">{zahl(suchErgebnis.gefunden)} gefunden · {zahl(suchErgebnis.neu)} neu</span>
          )}
          {!suchErgebnis && letzterLauf && (
            <span className="akq-hinweis">
              Letzter Lauf: {REGION_WORT[letzterLauf.region || ""] || letzterLauf.region || "—"} · {zahl(letzterLauf.gefunden)} gefunden · {zahl(letzterLauf.neu)} neu · {datum(letzterLauf.zeitpunkt)}
            </span>
          )}

          <span className="akq-trenner" aria-hidden="true" />

          {lauf ? (
            <>
              <span className="akq-fortschritt">{lauf.fertig} / {lauf.gesamt}</span>
              <button onClick={() => { abbruch.current = true; }} className="btn-ghost px-4 py-2 text-sm">Abbrechen</button>
            </>
          ) : (
            <button onClick={allePruefen} disabled={!faellig || sucht} className="btn-ghost px-4 py-2 text-sm disabled:opacity-60"
                    title={faellig ? `${faellig} ohne Prüfung oder älter als ${PRUEF_ALTER_TAGE} Tage` : "Alle Prüfungen sind aktuell"}>
              Websites prüfen{faellig ? ` (${faellig})` : ""}
            </button>
          )}
          <label className="akq-inline">
            <input type="checkbox" checked={mitPsi} onChange={e => setMitPsi(e.target.checked)} disabled={!!lauf} />
            mit PageSpeed (langsamer)
          </label>
        </div>
      </section>

      {/* Filter und Tabelle */}
      <section className="mon-block">
        <div className="akq-steuerung mb-4">
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Name oder Ort"
                 className="field px-3 py-2 text-sm" style={{ width: 200 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field px-3 py-2 text-sm" style={{ width: "auto" }}>
            <option value="alle">Alle Status</option>
            {STATUS.map(s => <option key={s.wert} value={s.wert}>{s.label}</option>)}
          </select>
          <label className="akq-inline">
            <input type="checkbox" checked={nurWebsite} onChange={e => setNurWebsite(e.target.checked)} /> nur mit Website
          </label>
          <label className="akq-inline">
            min. Priorität
            <input type="number" min={0} max={100} value={minPrio} onChange={e => setMinPrio(e.target.value)}
                   className="field px-3 py-2 text-sm" style={{ width: 72 }} />
          </label>
          <select value={sortierung} onChange={e => setSortierung(e.target.value as typeof sortierung)}
                  className="field px-3 py-2 text-sm" style={{ width: "auto" }} aria-label="Sortierung">
            <option value="prioritaet">Nach Priorität</option>
            <option value="name">Nach Name</option>
            <option value="geprueft">Zuletzt geprüft</option>
          </select>
          <span className="akq-trenner" aria-hidden="true" />
          <span className="akq-hinweis">{zahl(sichtbar.length)} von {zahl(betriebe.length)}</span>
          <button onClick={csvExport} disabled={!sichtbar.length} className="akq-knopf" title="Gefilterte Liste als CSV">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => setFormOffen(o => !o)} className="akq-knopf">
            <Plus size={13} /> Betrieb anlegen
          </button>
        </div>

        {formOffen && (
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
          <p className="mon-leer">Wird geladen…</p>
        ) : betriebe.length === 0 ? (
          <p className="mon-leer py-6 text-center">Noch keine Betriebe. Region wählen und suchen.</p>
        ) : sichtbar.length === 0 ? (
          <p className="mon-leer py-6 text-center">Kein Betrieb passt zu den Filtern.</p>
        ) : (
          <div className="akq-huelle">
            <table className="mon-tabelle akq-tabelle">
              <thead>
                <tr>
                  <th>Priorität</th>
                  <th>Betrieb</th>
                  <th>Website</th>
                  <th className="num">Schwäche</th>
                  <th className="num">Stärke</th>
                  <th>Signale</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map(b => {
                  const istOffen = offen.has(b.id);
                  const arbeitet = inArbeit.has(b.id);
                  const voll = verlauf[b.id]?.[0];
                  const lp = b.letzte_pruefung;
                  const signale = b.signale || [];
                  return (
                    <Fragment key={b.id}>
                      <tr className={istOffen ? "akq-offen" : ""}>
                        <td><Prio wert={b.prioritaet} /></td>
                        <td className="akq-betrieb">
                          <b className="text-[var(--fg)] font-semibold">{b.name}</b>
                          <span className="block text-[0.76rem] text-[var(--fg-subtle)]">
                            {[b.ort, b.marken].filter(Boolean).join(" · ") || (b.art === "car_repair" ? "Werkstatt" : "")}
                          </span>
                        </td>
                        <td>
                          {b.website
                            ? <a href={b.website} target="_blank" rel="noopener noreferrer" className="akq-link">{host(b.website)}</a>
                            : <span className="text-[var(--fg-subtle)]">keine</span>}
                        </td>
                        <td className="num">{zahl(b.score_website)}</td>
                        <td className="num">{zahl(b.score_betrieb)}</td>
                        <td><SignalChips signale={signale} /></td>
                        <td>
                          <select value={b.status} onChange={e => statusSetzen(b.id, e.target.value)}
                                  className="field px-2 py-1 text-xs" style={{ width: "auto" }} aria-label={`Status von ${b.name}`}>
                            {STATUS.map(s => <option key={s.wert} value={s.wert}>{s.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <span className="akq-aktionen">
                            <button onClick={() => pruefen(b, mitPsi).then(ladeStand)} disabled={arbeitet || !!lauf} className="akq-knopf">
                              {arbeitet ? "Prüft…" : "Prüfen"}
                            </button>
                            <button onClick={() => aufklappen(b.id)} className="akq-knopf" aria-expanded={istOffen} aria-label="Details">
                              {istOffen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button onClick={() => loeschen(b)} className="akq-knopf" aria-label={`${b.name} löschen`}>
                              <Trash2 size={14} />
                            </button>
                          </span>
                        </td>
                      </tr>
                      {istOffen && (
                        <tr className="akq-details">
                          <td colSpan={8}>
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
                                  {lp?.fehler && <><dt>Fehler</dt><dd className="akq-lang">{lp.fehler}</dd></>}
                                </dl>
                              </div>

                              <div>
                                <p className="akq-dt">PageSpeed &amp; Wayback</p>
                                <dl className="akq-dl">
                                  <dt>Leistung</dt><dd>{lp?.psi_leistung ?? voll?.psi_leistung ?? "—"}</dd>
                                  <dt>LCP</dt><dd>{voll?.psi_lcp != null ? `${voll.psi_lcp.toFixed(1).replace(".", ",")} s` : "—"}</dd>
                                  <dt>CLS</dt><dd>{voll?.psi_cls != null ? voll.psi_cls.toFixed(2).replace(".", ",") : "—"}</dd>
                                  <dt>Erster Snapshot</dt><dd>{waybackDatum(lp?.wayback_erster)}</dd>
                                  <dt>Letzter Snapshot</dt><dd>{waybackDatum(lp?.wayback_letzter)}</dd>
                                  <dt>Snapshots</dt><dd>{zahl(voll?.wayback_anzahl)}</dd>
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
                                  <dt>Quelle</dt><dd>{b.quelle === "osm" ? `OSM${b.region ? ` · ${REGION_WORT[b.region] || b.region}` : ""}` : "manuell"}</dd>
                                  <dt>Website</dt>
                                  <dd>
                                    <input defaultValue={b.website || ""} placeholder="https://…"
                                           onBlur={e => websiteSpeichern(b, e.target.value)}
                                           className="field px-2 py-1 text-xs" />
                                  </dd>
                                </dl>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, b.plz, b.ort].filter(Boolean).join(" "))}`}
                                   target="_blank" rel="noopener noreferrer" className="akq-link text-sm inline-block mt-2">
                                  Auf Google Maps ↗
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
    </AdminShell>
  );
}
