"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import AdminShell, { api, euro, datum } from "@/components/admin/AdminShell";

type Transaktion = {
  id: number;
  art: "einnahme" | "ausgabe";
  betrag_cent: number;
  beschreibung: string;
  kategorie: string | null;
  datum: string;
};

const KATEGORIEN = ["Website-Projekt", "Wartung", "KI-Abos (Anthropic & Co.)", "Hosting & Domain", "Software / Tools", "Hardware", "Fahrtkosten", "Sonstiges"];

// Marken-Logos wie beim Banking: Firma aus der Beschreibung erkennen und deren
// echtes Favicon zeigen. Reihenfolge zählt — Apple-Produkte VOR dem Händler,
// damit z. B. "MacBook … Cyberport" das Apple-Logo bekommt.
const MARKEN: [RegExp, string][] = [
  [/macbook|imac|ipad|iphone|airpods|applecare|apple/i, "apple.com"],
  [/anthropic|claude/i, "anthropic.com"],
  [/diezmann/i, "autohaus-diezmann.de"],
  [/cyberport/i, "cyberport.de"],
  [/consors/i, "consorsfinanz.de"],
  [/media\s*markt/i, "mediamarkt.de"],
  [/namecheap|domain/i, "namecheap.com"],
  [/cloudflare/i, "cloudflare.com"],
  [/resend/i, "resend.com"],
  [/telegram/i, "telegram.org"],
  [/instagram|meta\b/i, "instagram.com"],
  [/google/i, "google.com"],
  [/openai|chatgpt/i, "openai.com"],
];

function markenDomain(beschreibung: string): string | null {
  for (const [muster, domain] of MARKEN) {
    if (muster.test(beschreibung)) return domain;
  }
  return null;
}

function Logo({ beschreibung }: { beschreibung: string }) {
  const [kaputt, setKaputt] = useState(false);
  const domain = markenDomain(beschreibung);

  if (domain && !kaputt) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        alt=""
        aria-hidden="true"
        width={22}
        height={22}
        loading="lazy"
        onError={() => setKaputt(true)}
        className="rounded-[5px] shrink-0"
        style={{ background: "var(--surface-2)" }}
      />
    );
  }

  // Rückfall: Kreis mit Anfangsbuchstaben
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center rounded-[5px] text-[0.65rem] font-bold shrink-0"
      style={{ width: 22, height: 22, background: "var(--accent-soft)", color: "var(--accent)" }}
    >
      {(beschreibung.trim()[0] || "•").toUpperCase()}
    </span>
  );
}

const heute = () => new Date().toISOString().slice(0, 10);
const LEER = { art: "einnahme", betrag: "", beschreibung: "", kategorie: "", datum: heute() };

// "1.234,56" oder "1234.56" → 123456 Cent. Über Cent zu rechnen vermeidet Rundungsfehler.
function inCent(eingabe: string): number | null {
  const norm = eingabe.trim().replace(/\./g, "").replace(",", ".");
  const zahl = Number(norm);
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  return Math.round(zahl * 100);
}

// ─── Verlauf: Einnahmen und Ausgaben je Monat, die letzten zwoelf ───
// Dieselbe Machart wie "Besucher im Verlauf" im Monitoring: zwei Linien,
// runde Achsenschritte, Faden mit Blase beim Drueberfahren.
const FARBE_EIN = "#1d8a52";
const FARBE_AUS = "#12557F";

function runderSchritt(roh: number) {
  if (roh <= 1) return 1;
  const zehner = Math.pow(10, Math.floor(Math.log10(roh)));
  const rest = roh / zehner;
  const gewaehlt = rest <= 1 ? 1 : rest <= 2 ? 2 : rest <= 2.5 ? 2.5 : rest <= 5 ? 5 : 10;
  return Math.max(1, Math.round(gewaehlt * zehner));
}

const monatKurz = (ym: string) =>
  new Date(ym + "-15T12:00:00Z").toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
const monatLang = (ym: string) =>
  new Date(ym + "-15T12:00:00Z").toLocaleDateString("de-DE", { month: "long", year: "numeric" });

function Verlauf({ alle }: { alle: Transaktion[] }) {
  const kasten = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(0);
  const [zeiger, setZeiger] = useState<number | null>(null);

  useEffect(() => {
    const el = kasten.current;
    if (!el) return;
    const b = new ResizeObserver(e => setBreite(Math.max(280, Math.floor(e[0].contentRect.width))));
    b.observe(el);
    return () => b.disconnect();
  }, []);

  // Zwoelf Monate bis heute, Monate ohne Buchung als Null – sonst wirken
  // Luecken wie Einbrueche.
  const punkte = useMemo(() => {
    const jetzt = new Date();
    const monate: { ym: string; ein: number; aus: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(jetzt.getFullYear(), jetzt.getMonth() - i, 1));
      monate.push({ ym: d.toISOString().slice(0, 7), ein: 0, aus: 0 });
    }
    const nach = new Map(monate.map(m => [m.ym, m]));
    for (const t of alle) {
      const m = nach.get(t.datum.slice(0, 7));
      if (!m) continue;
      if (t.art === "einnahme") m.ein += t.betrag_cent; else m.aus += t.betrag_cent;
    }
    return monate;
  }, [alle]);

  const hoehe = 250;
  const rand = { oben: 14, rechts: 14, unten: 26, links: 64 };
  const zeichenBreite = breite - rand.links - rand.rechts;
  const zeichenHoehe = hoehe - rand.oben - rand.unten;
  const stufen = 4;
  const hoechstEuro = Math.max(1, ...punkte.map(p => Math.max(p.ein, p.aus))) / 100;
  const schritt = runderSchritt(hoechstEuro / stufen);
  const obergrenze = schritt * stufen * 100;
  const letzter = punkte.length - 1;

  const x = (i: number) => rand.links + (i / letzter) * zeichenBreite;
  const y = (cent: number) => rand.oben + zeichenHoehe - (cent / obergrenze) * zeichenHoehe;
  const linie = (f: "ein" | "aus") =>
    punkte.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[f]).toFixed(1)}`).join(" ");

  const zeigen = (e: React.PointerEvent<SVGRectElement>) => {
    const kiste = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const anteil = (e.clientX - kiste.left - rand.links) / zeichenBreite;
    setZeiger(Math.max(0, Math.min(letzter, Math.round(anteil * letzter))));
  };
  const p = zeiger != null ? punkte[zeiger] : null;

  return (
    <section className="mon-block">
      <h2>Verlauf · letzte 12 Monate</h2>
      <div className="viz-legende">
        <span><i style={{ background: FARBE_EIN }} />Einnahmen</span>
        <span><i style={{ background: FARBE_AUS }} />Ausgaben</span>
      </div>
      <div className="viz" ref={kasten} onPointerLeave={() => setZeiger(null)}>
        {breite > 0 && (
          <svg className="viz-svg" viewBox={`0 0 ${breite} ${hoehe}`} width={breite} height={hoehe} role="img"
               aria-label="Einnahmen und Ausgaben je Monat">
            {Array.from({ length: stufen + 1 }, (_, k) => {
              const yy = y(schritt * k * 100);
              return (
                <g key={k}>
                  <line className="viz-raster" x1={rand.links} y1={yy} x2={breite - rand.rechts} y2={yy} />
                  <text className="viz-achse" x={rand.links - 8} y={yy + 4} textAnchor="end">
                    {(schritt * k).toLocaleString("de-DE")} €
                  </text>
                </g>
              );
            })}
            {punkte.map((pt, i) => (
              <text key={pt.ym} className="viz-achse" x={x(i)} y={hoehe - 8}
                    textAnchor={i === 0 ? "start" : i === letzter ? "end" : "middle"}>
                {monatKurz(pt.ym)}
              </text>
            ))}
            <path className="viz-linie" d={linie("aus")} stroke={FARBE_AUS} />
            <path className="viz-linie" d={linie("ein")} stroke={FARBE_EIN} />
            <circle className="viz-ende" cx={x(letzter)} cy={y(punkte[letzter].aus)} r="4" fill={FARBE_AUS} />
            <circle className="viz-ende" cx={x(letzter)} cy={y(punkte[letzter].ein)} r="4" fill={FARBE_EIN} />
            {p && zeiger != null && (
              <>
                <line className="viz-faden" x1={x(zeiger)} x2={x(zeiger)} y1={rand.oben} y2={rand.oben + zeichenHoehe} />
                <circle className="viz-treffer" cx={x(zeiger)} cy={y(p.aus)} r="5" fill={FARBE_AUS} />
                <circle className="viz-treffer" cx={x(zeiger)} cy={y(p.ein)} r="5" fill={FARBE_EIN} />
              </>
            )}
            <rect x={rand.links} y={rand.oben} width={Math.max(0, zeichenBreite)} height={zeichenHoehe}
                  fill="transparent" onPointerMove={zeigen} onPointerDown={zeigen} />
          </svg>
        )}
        {p && zeiger != null && (
          <div className={`viz-blase ${x(zeiger) / breite > 0.6 ? "links" : ""}`}
               style={{ left: `${(x(zeiger) / breite) * 100}%` }}>
            <p className="viz-blase-tag">{monatLang(p.ym)}</p>
            <p className="viz-blase-zeile"><i style={{ background: FARBE_EIN }} /><b>{euro(p.ein)}</b> Einnahmen</p>
            <p className="viz-blase-zeile"><i style={{ background: FARBE_AUS }} /><b>{euro(p.aus)}</b> Ausgaben</p>
            <p className="viz-blase-zeile" style={{ color: "rgba(255,255,255,.7)" }}>Saldo {euro(p.ein - p.aus)}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function FinanzenSeite() {
  const [alle, setAlle] = useState<Transaktion[]>([]);
  const [neu, setNeu] = useState(LEER);
  const [formOffen, setFormOffen] = useState(false);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  const laden = () =>
    api("/api/admin/finanzen")
      .then(d => setAlle(d.transaktionen))
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));

  useEffect(() => { laden(); }, []);

  const summen = useMemo(() => {
    const jahr = new Date().getFullYear().toString();
    const imJahr = alle.filter(t => t.datum.startsWith(jahr));
    const ein = imJahr.filter(t => t.art === "einnahme").reduce((s, t) => s + t.betrag_cent, 0);
    const aus = imJahr.filter(t => t.art === "ausgabe").reduce((s, t) => s + t.betrag_cent, 0);
    return { ein, aus, saldo: ein - aus, jahr };
  }, [alle]);

  const anlegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler("");
    const cent = inCent(neu.betrag);
    if (cent === null) { setFehler("Bitte einen gültigen Betrag eingeben (z. B. 250,00)."); return; }

    try {
      await api("/api/admin/finanzen", {
        method: "POST",
        body: JSON.stringify({
          art: neu.art,
          betrag_cent: cent,
          beschreibung: neu.beschreibung,
          kategorie: neu.kategorie,
          datum: neu.datum,
        }),
      });
      setNeu({ ...LEER, art: neu.art, datum: neu.datum });
      setFormOffen(false);
      laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Fehler beim Speichern.");
    }
  };

  const loeschen = async (id: number) => {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    setAlle(t => t.filter(x => x.id !== id));
    await api("/api/admin/finanzen", { method: "DELETE", body: JSON.stringify({ id }) })
      .catch(e => setFehler(e.message));
  };

  return (
    <AdminShell titel="Einnahmen & Ausgaben" eyebrow="Verwaltung" lead="Was reinkommt, was rausgeht.">
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="card p-6">
          <div className="icon-tile w-10 h-10 mb-4"><TrendingUp size={18} /></div>
          <div className="text-[var(--fg-subtle)] text-xs mb-1">Einnahmen {summen.jahr}</div>
          <div className="display-h text-2xl font-semibold text-[var(--fg)]">{euro(summen.ein)}</div>
        </div>
        <div className="card p-6">
          <div className="icon-tile w-10 h-10 mb-4"><TrendingDown size={18} /></div>
          <div className="text-[var(--fg-subtle)] text-xs mb-1">Ausgaben {summen.jahr}</div>
          <div className="display-h text-2xl font-semibold text-[var(--fg)]">{euro(summen.aus)}</div>
        </div>
        <div className="card p-6">
          <div className="icon-tile w-10 h-10 mb-4"><Wallet size={18} /></div>
          <div className="text-[var(--fg-subtle)] text-xs mb-1">Saldo {summen.jahr}</div>
          <div className="display-h text-2xl font-semibold"
            style={{ color: summen.saldo < 0 ? "#ef4444" : "var(--fg)" }}>
            {euro(summen.saldo)}
          </div>
        </div>
      </div>

      {!laedt && alle.length > 0 && <Verlauf alle={alle} />}

      <button onClick={() => setFormOffen(o => !o)} className="btn-primary px-5 py-2.5 text-sm mb-6">
        <Plus size={16} /> Neuer Eintrag
      </button>

      {formOffen && (
        <form onSubmit={anlegen} className="card p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Art *</label>
              <select value={neu.art} onChange={e => setNeu({ ...neu, art: e.target.value })}
                className="field px-4 py-2.5 text-sm">
                <option value="einnahme">Einnahme</option>
                <option value="ausgabe">Ausgabe</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Betrag in € *</label>
              <input
                required inputMode="decimal" value={neu.betrag}
                onChange={e => setNeu({ ...neu, betrag: e.target.value })}
                placeholder="250,00" className="field px-4 py-2.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Beschreibung *</label>
            <input
              required value={neu.beschreibung}
              onChange={e => setNeu({ ...neu, beschreibung: e.target.value })}
              placeholder="z. B. Website Autohaus — Schlussrechnung"
              className="field px-4 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Kategorie</label>
              <select value={neu.kategorie} onChange={e => setNeu({ ...neu, kategorie: e.target.value })}
                className="field px-4 py-2.5 text-sm">
                <option value="">— keine —</option>
                {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Datum *</label>
              <input
                required type="date" value={neu.datum}
                onChange={e => setNeu({ ...neu, datum: e.target.value })}
                className="field px-4 py-2.5 text-sm"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary px-5 py-2.5 text-sm">Speichern</button>
        </form>
      )}

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : alle.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--fg-muted)]">Noch keine Einträge erfasst.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Datum", "Beschreibung", "Kategorie", "Betrag", ""].map((h, i) => (
                  <th key={h || i}
                    className={`text-${i === 3 ? "right" : "left"} px-5 py-3 text-xs font-semibold text-[var(--fg-subtle)] whitespace-nowrap`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alle.map(t => (
                <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-5 py-3 text-[var(--fg-muted)] whitespace-nowrap">{datum(t.datum)}</td>
                  <td className="px-5 py-3 text-[var(--fg)]">
                    <span className="inline-flex items-center gap-2.5">
                      <Logo beschreibung={t.beschreibung} />
                      {t.beschreibung}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--fg-subtle)] whitespace-nowrap">{t.kategorie || "—"}</td>
                  <td className="px-5 py-3 text-right font-medium whitespace-nowrap"
                    style={{ color: t.art === "einnahme" ? "var(--accent)" : "#ef4444" }}>
                    {t.art === "einnahme" ? "+" : "−"} {euro(t.betrag_cent)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => loeschen(t.id)} aria-label="Eintrag löschen"
                      className="p-1.5 rounded-[8px] text-[var(--fg-subtle)] hover:text-[#ef4444] transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
