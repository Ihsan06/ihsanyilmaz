"use client";
import { useEffect, useState, type ReactNode } from "react";
// Hinweis: lucide-react hat in dieser Version keine Marken-Icons (kein "Instagram") — daher Camera.
import { LayoutDashboard, Inbox, Camera, Euro, Briefcase, LogOut, Lock } from "lucide-react";

const nav = [
  { href: "/admin", label: "Übersicht", icon: LayoutDashboard },
  { href: "/admin/anfragen", label: "Anfragen", icon: Inbox },
  { href: "/admin/instagram", label: "Instagram", icon: Camera },
  { href: "/admin/finanzen", label: "Finanzen", icon: Euro },
  { href: "/admin/business", label: "Selbständigkeit", icon: Briefcase },
];

export async function api(pfad: string, options: RequestInit = {}) {
  const res = await fetch(pfad, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const daten = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(daten?.error || "Es ist ein Fehler aufgetreten.");
  return daten;
}

export function euro(cent: number) {
  return (cent / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function datum(wert?: string | null) {
  if (!wert) return "—";
  const d = new Date(wert.includes("T") || wert.includes(" ") ? wert.replace(" ", "T") + "Z" : wert);
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
    <div className="surface-base min-h-screen flex items-center justify-center px-6">
      <form onSubmit={absenden} className="card w-full max-w-sm p-8">
        <div className="icon-tile w-11 h-11 mb-5"><Lock size={20} /></div>
        <h1 className="display-h text-2xl font-semibold text-[var(--fg)] mb-1">Adminbereich</h1>
        <p className="text-[var(--fg-muted)] text-sm mb-6">AIY · Ihsan Yilmaz</p>

        <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Passwort</label>
        <input
          type="password"
          value={passwort}
          onChange={e => setPasswort(e.target.value)}
          autoFocus
          required
          className="field px-4 py-3 text-sm"
        />

        {fehler && <p className="mt-3 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

        <button type="submit" disabled={laedt} className="btn-primary w-full mt-5 px-5 py-2.5 text-sm disabled:opacity-60">
          {laedt ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}

export default function AdminShell({ titel, children }: { titel: string; children: ReactNode }) {
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
      <div className="surface-base min-h-screen flex items-center justify-center">
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      </div>
    );
  }

  if (status === "aus") return <Login onErfolg={() => setStatus("an")} />;

  return (
    <div className="surface-base min-h-screen">
      <header className="border-b border-[var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/admin" className="flex items-center gap-2 font-display text-[var(--fg)]">
              <span className="text-lg font-bold tracking-tight">AIY</span>
              <span className="text-base font-light" style={{ color: "var(--accent)" }}>|</span>
              <span className="text-sm font-medium text-[var(--fg-muted)]">Adminbereich</span>
            </a>
            <button
              onClick={abmelden}
              className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              <LogOut size={16} /> Abmelden
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {nav.map(n => {
              const aktiv = pfad === n.href;
              return (
                <a
                  key={n.href}
                  href={n.href}
                  className="inline-flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors"
                  style={{
                    borderColor: aktiv ? "var(--accent)" : "transparent",
                    color: aktiv ? "var(--accent)" : "var(--fg-muted)",
                    fontWeight: aktiv ? 600 : 400,
                  }}
                >
                  <n.icon size={16} /> {n.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
        <h1 className="display-h text-3xl font-semibold text-[var(--fg)] mb-8">{titel}</h1>
        {children}
      </main>
    </div>
  );
}
