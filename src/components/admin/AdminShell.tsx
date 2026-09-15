"use client";
import { useEffect, useState, type ReactNode } from "react";
// Hinweis: lucide-react hat in dieser Version keine Marken-Icons (kein "Instagram") — daher Camera.
import { LayoutDashboard, Inbox, Camera, Euro, FolderOpen, LogOut, Lock, ChartNoAxesColumn, Images } from "lucide-react";
import { Bildmarke } from "../Logo";

type Seite = {
  pfad: string;
  titel: string;
  icon: typeof LayoutDashboard;
  unter?: { pfad: string; titel: string }[];
};

// Jeder Punkt trägt sein Zeichen: in einer senkrechten Leiste liest sich eine
// reine Wörterliste wie ein Inhaltsverzeichnis, nicht wie ein Menü.
const SEITEN: Seite[] = [
  { pfad: "/admin", titel: "Übersicht", icon: LayoutDashboard },
  { pfad: "/admin/monitoring", titel: "Monitoring", icon: ChartNoAxesColumn },
  {
    pfad: "/admin/content",
    titel: "Instagram",
    icon: Camera,
    unter: [
      { pfad: "/admin/content", titel: "Content erstellen" },
      { pfad: "/admin/planen", titel: "Content planen" },
    ],
  },
  {
    pfad: "/admin/finanzen",
    titel: "Finanzen",
    icon: Euro,
    unter: [
      { pfad: "/admin/finanzen", titel: "Einnahmen & Ausgaben" },
      { pfad: "/admin/finanzen/api", titel: "API & Verbrauch" },
      { pfad: "/admin/finanzen/steuer", titel: "Steuer" },
    ],
  },
  { pfad: "/admin/galerie", titel: "Galerie", icon: Images },
  { pfad: "/admin/dokumente", titel: "Dokumente", icon: FolderOpen },
  { pfad: "/admin/anfragen", titel: "Anfragen", icon: Inbox },
];

// Kleines "i" mit Erklaerung beim Drueberfahren – oder beim Antippen am
// Telefon (tabIndex macht es fokussierbar, focus-within haelt es offen).
// Mehr als ein title-Text: die Erklaerung darf Zeilen und Hervorhebungen haben.
export function InfoTipp({ children, breite = 330 }: { children: ReactNode; breite?: number }) {
  return (
    <span className="group relative inline-flex align-middle ml-1.5">
      <span
        tabIndex={0}
        aria-label="Erklärung"
        className="inline-flex items-center justify-center cursor-help"
        style={{
          width: 16, height: 16, borderRadius: "50%", fontSize: 10, fontWeight: 700,
          border: "1px solid var(--border)", color: "var(--fg-subtle)", background: "var(--card, #fff)",
        }}
      >
        i
      </span>
      <span
        role="tooltip"
        className="hidden group-hover:block group-focus-within:block absolute left-0 top-full z-40 mt-2 card p-3.5 text-[0.8rem] leading-relaxed text-[var(--fg-muted)]"
        style={{ width: breite, maxWidth: "calc(100vw - 2rem)", boxShadow: "0 10px 30px rgba(7,26,43,0.18)" }}
      >
        {children}
      </span>
    </span>
  );
}

export async function api(pfad: string, options: RequestInit = {}) {
  const res = await fetch(pfad, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const daten = await res.json().catch(() => ({}));
  // Die Studio-Endpunkte melden auf Deutsch ("fehler"), die aelteren auf
  // Englisch ("error"). Wer nur einen der beiden liest, zeigt dem Nutzer
  // statt "Kein Zugang zum Modell hinterlegt." nur "Es ist ein Fehler
  // aufgetreten." – und der Grund geht verloren.
  if (!res.ok || daten?.ok === false) {
    throw new Error(daten?.fehler || daten?.error || "Es ist ein Fehler aufgetreten.");
  }
  return daten;
}

export function euro(cent: number) {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function datum(wert?: string | null) {
  if (!wert) return "—";
  // Drei Formate kommen aus der Datenbank: "2026-08-18" (nur Tag),
  // "2026-08-18 01:15:45" (SQLite datetime, Leerzeichen, ohne Zone) und
  // "2026-08-18T01:15:45.768Z" (ISO aus JavaScript, mit Z).
  //
  // Frueher wurde an alles mit T oder Leerzeichen ein "Z" angehaengt – bei
  // der dritten Form entstand dadurch "…768ZZ", ein ungueltiges Datum, und
  // die Funktion gab den rohen Zeitstempel zurueck. Zu sehen war das in der
  // Galerie und im Monitoring.
  const roh = wert.trim();
  const hatZone = /(Z|[+-]\d{2}:?\d{2})$/.test(roh);
  const text = roh.includes(" ") ? roh.replace(" ", "T") : roh;
  const d = new Date(hatZone || !text.includes("T") ? text : text + "Z");
  if (isNaN(d.getTime())) return wert;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Login({ onErfolg }: { onErfolg: () => void }) {
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(false);

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaedt(true);
    setFehler("");
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ passwort }) });
      onErfolg();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen.");
    } finally {
      setLaedt(false);
    }
  };

  return (
    <div className="admin-theme min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--tief)" }}>
      <form onSubmit={absenden} className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-5">
          <Bildmarke size={34} className="shrink-0 text-[var(--accent)]" />
          <div className="icon-tile w-9 h-9 ml-auto"><Lock size={17} /></div>
        </div>
        <h1 className="display-h text-2xl font-semibold text-[var(--fg)] mb-1">Adminbereich</h1>
        <p className="text-[var(--fg-muted)] text-sm mb-6">AIY · Ihsan Yilmaz</p>

        <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Passwort</label>
        <input
          type="password" value={passwort} onChange={e => setPasswort(e.target.value)}
          autoFocus required className="field px-4 py-3 text-sm"
        />

        {fehler && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

        <button type="submit" disabled={laedt} className="btn-primary w-full mt-5 px-5 py-2.5 text-sm disabled:opacity-60">
          {laedt ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}

export default function AdminShell({
  titel, eyebrow, lead, children,
}: {
  titel: string; eyebrow?: string; lead?: ReactNode; children: ReactNode;
}) {
  const [status, setStatus] = useState<"pruefe" | "aus" | "an">("pruefe");
  const [pfad, setPfad] = useState("");

  useEffect(() => {
    setPfad(window.location.pathname.replace(/\/$/, "") || "/admin");
    api("/api/admin/me")
      .then(d => setStatus(d.angemeldet ? "an" : "aus"))
      .catch(() => setStatus("aus"));
  }, []);

  const abmelden = async () => {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    setStatus("aus");
  };

  if (status === "pruefe") {
    return (
      <div className="admin-theme min-h-screen flex items-center justify-center">
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      </div>
    );
  }

  if (status === "aus") return <Login onErfolg={() => setStatus("an")} />;

  // Ein Punkt gilt auch als aktiv, wenn eine seiner Unterseiten offen ist.
  const istAktiv = (s: Seite) =>
    pfad === s.pfad || (s.pfad !== "/admin" && pfad.startsWith(s.pfad + "/"));

  // Für die Handy-Ansicht: die Unterpunkte des gerade offenen Bereichs
  const aktiveUnter = SEITEN.find(s => istAktiv(s) && s.unter)?.unter;

  const jahr = new Date().getFullYear();

  return (
    <div className="admin-theme min-h-screen flex flex-col">
      <aside className="admin-leiste">
        <div className="flex items-center">
        <a href="/admin" className="flex items-center gap-2.5 px-6 py-5 no-underline" style={{ color: "#fff" }}>
          <Bildmarke size={30} className="shrink-0" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-xl font-bold tracking-tight">AIY</span>
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] mt-1"
              style={{ color: "rgba(255,255,255,0.6)" }}>
              Verwaltung
            </span>
          </span>
        </a>
        {/* Am Handy ist die Leiste ein Kopfblock – Abmelden steht dort neben der Marke */}
        <button
          onClick={abmelden}
          className="lg:hidden ml-auto mr-4 inline-flex items-center gap-2 px-3 py-2 rounded-[9px] text-sm"
        >
          <LogOut size={16} /> Abmelden
        </button>
        </div>

        <nav className="flex lg:flex-col gap-1 px-3 pb-4 overflow-x-auto lg:overflow-x-visible"
          aria-label="Bereiche">
          {SEITEN.map(s => {
            const aktiv = istAktiv(s);
            return (
              <div key={s.pfad} className="lg:contents">
                <a
                  href={s.pfad}
                  aria-current={aktiv ? "page" : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-sm font-medium whitespace-nowrap no-underline transition-colors ${aktiv ? "aktiv" : ""}`}
                >
                  <s.icon size={18} className="shrink-0" />
                  <span>{s.titel}</span>
                </a>

                {/* Unterpunkte sind immer ausgeklappt */}
                {s.unter && (
                  <div className="hidden lg:flex flex-col gap-0.5 mt-0.5 mb-1 ml-[30px] pl-3.5"
                    style={{ borderLeft: "1px solid rgba(255,255,255,0.14)" }}>
                    {s.unter.map(u => (
                      <a
                        key={u.pfad}
                        href={u.pfad}
                        className={`px-2.5 py-1.5 rounded-[7px] text-[0.83rem] no-underline transition-colors ${pfad === u.pfad ? "unter-aktiv" : ""}`}
                        style={pfad === u.pfad ? { background: "rgba(255,255,255,0.10)" } : undefined}
                      >
                        {u.titel}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Handy: Unterpunkte des offenen Bereichs als zweite Zeile */}
        {aktiveUnter && (
          <div className="flex lg:hidden gap-1.5 px-3 pb-3 pt-2.5 overflow-x-auto"
            style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}>
            {aktiveUnter.map(u => (
              <a
                key={u.pfad}
                href={u.pfad}
                className="px-3 py-1.5 rounded-full text-[0.8rem] whitespace-nowrap no-underline transition-colors"
                style={pfad === u.pfad
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}
              >
                {u.titel}
              </a>
            ))}
          </div>
        )}

        {/* Rechner: Abmelden ganz unten in der Leiste, wie auf den Studio-Seiten */}
        <div className="hidden lg:flex mt-auto flex-col px-3 pt-4 pb-5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}>
          <button
            onClick={abmelden}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-[9px] text-sm font-medium"
          >
            <LogOut size={18} className="shrink-0" /> Abmelden
          </button>
        </div>
      </aside>

      <div className="admin-inhalt flex-1 flex flex-col">
        <main className="flex-1 px-6 lg:px-8 pt-7 lg:pt-10 pb-12 max-w-[1340px] w-full">
          <div className="mb-8">
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            <h1 className="display-h text-3xl font-semibold text-[var(--fg)]">{titel}</h1>
            {lead && <p className="text-[var(--fg-muted)] mt-2">{lead}</p>}
          </div>
          {children}
        </main>

        <footer className="border-t border-[var(--border)] px-6 lg:px-8 py-4">
          <div className="max-w-[1340px] flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-[var(--fg-subtle)]">
            <span>© {jahr} AIY · Ihsan Yilmaz — Verwaltung</span>
            <nav className="flex flex-wrap gap-5">
              <a href="/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">Website ansehen ↗</a>
              <a href="/impressum" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">Impressum</a>
              <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors">Datenschutz</a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
