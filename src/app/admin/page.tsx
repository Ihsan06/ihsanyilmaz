"use client";
import { useEffect, useState } from "react";
import { Inbox, Camera, Briefcase, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import AdminShell, { api, euro } from "@/components/admin/AdminShell";

type Stats = {
  neueAnfragen: number;
  anfragenGesamt: number;
  einnahmenCent: number;
  ausgabenCent: number;
  saldoCent: number;
  geplantePosts: number;
  offeneAufgaben: number;
};

export default function AdminUebersicht() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    api("/api/admin/stats")
      .then(d => setStats(d.stats))
      .catch(e => setFehler(e.message));
  }, []);

  const monat = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <AdminShell titel="Übersicht">
      {fehler && (
        <div className="card p-5 mb-6" style={{ borderColor: "#ef4444" }}>
          <p className="text-sm" style={{ color: "#ef4444" }}>{fehler}</p>
          <p className="text-[var(--fg-muted)] text-sm mt-2">
            Falls die Datenbank noch nicht verbunden ist: In Cloudflare unter <em>Settings → Bindings</em>{" "}
            eine D1-Datenbank als <code>DB</code> hinterlegen und <code>schema.sql</code> einspielen.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Kachel
          icon={<Inbox size={20} />}
          label="Neue Anfragen"
          wert={stats ? String(stats.neueAnfragen) : "—"}
          zusatz={stats ? `${stats.anfragenGesamt} insgesamt` : ""}
          href="/admin/anfragen"
        />
        <Kachel
          icon={<Camera size={20} />}
          label="Posts in Planung"
          wert={stats ? String(stats.geplantePosts) : "—"}
          zusatz="Entwürfe & geplant"
          href="/admin/instagram"
        />
        <Kachel
          icon={<Briefcase size={20} />}
          label="Offene Aufgaben"
          wert={stats ? String(stats.offeneAufgaben) : "—"}
          zusatz="Selbständigkeit"
          href="/admin/business"
        />
        <Kachel
          icon={<Wallet size={20} />}
          label={`Saldo ${monat}`}
          wert={stats ? euro(stats.saldoCent) : "—"}
          zusatz="Einnahmen minus Ausgaben"
          href="/admin/finanzen"
          farbe={stats && stats.saldoCent < 0 ? "#ef4444" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="icon-tile w-10 h-10"><TrendingUp size={18} /></div>
            <h2 className="display-h text-lg font-semibold text-[var(--fg)]">Einnahmen {monat}</h2>
          </div>
          <p className="display-h text-3xl font-semibold text-[var(--fg)]">
            {stats ? euro(stats.einnahmenCent) : "—"}
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="icon-tile w-10 h-10"><TrendingDown size={18} /></div>
            <h2 className="display-h text-lg font-semibold text-[var(--fg)]">Ausgaben {monat}</h2>
          </div>
          <p className="display-h text-3xl font-semibold text-[var(--fg)]">
            {stats ? euro(stats.ausgabenCent) : "—"}
          </p>
        </div>
      </div>
    </AdminShell>
  );
}

function Kachel({
  icon, label, wert, zusatz, href, farbe,
}: {
  icon: React.ReactNode; label: string; wert: string; zusatz?: string; href: string; farbe?: string;
}) {
  return (
    <a href={href} className="card p-6 block">
      <div className="icon-tile w-10 h-10 mb-4">{icon}</div>
      <div className="text-[var(--fg-subtle)] text-xs mb-1">{label}</div>
      <div className="display-h text-2xl font-semibold" style={{ color: farbe || "var(--fg)" }}>{wert}</div>
      {zusatz && <div className="text-[var(--fg-subtle)] text-xs mt-1">{zusatz}</div>}
    </a>
  );
}
