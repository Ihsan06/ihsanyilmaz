"use client";
import { useEffect, useState } from "react";
import { Inbox, Camera, FolderOpen, TrendingUp, TrendingDown, Wallet, Users, MousePointerClick, HardDrive } from "lucide-react";
import AdminShell, { api, euro } from "@/components/admin/AdminShell";

type Stats = {
  neueAnfragen: number;
  anfragenGesamt: number;
  einnahmenCent: number;
  ausgabenCent: number;
  saldoCent: number;
  geplantePosts: number;
  offeneAufgaben: number;
  dokumente: number;
};

// Nur die Kennzahlen, die auf der Uebersicht Platz haben. Der Rest steht
// unter /admin/monitoring – hier geht es um "steht alles gut", nicht um die
// Auswertung.
type Kurz = {
  besucher?: { ok?: boolean; besuche: number; aufrufe: number; fehler?: string };
  anfragen?: { ok?: boolean; gesamt: number };
  speicher?: { ok?: boolean; bytes: number; anteil: number };
  davor?: { besuche: number | null; aufrufe: number | null } | null;
};

function groesse(bytes: number) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2).replace(".", ",") + " GB";
  return (bytes / 1024 ** 2).toFixed(1).replace(".", ",") + " MB";
}

// Gleiche Regel wie im Monitoring: unter einem Prozent ist Rauschen, dafuer
// gibt es keinen Pfeil.
function Trend({ jetzt, davor }: { jetzt?: number | null; davor?: number | null }) {
  if (jetzt == null || davor == null || davor === 0) return null;
  const diff = ((jetzt - davor) / davor) * 100;
  if (Math.abs(diff) < 1) return null;
  const hoch = diff > 0;
  return (
    <span className="text-xs ml-1.5" style={{ color: hoch ? "#16a34a" : "#dc2626" }}>
      {hoch ? "▲" : "▼"} {Math.abs(diff) >= 999 ? "999+" : Math.abs(diff).toFixed(0)} %
    </span>
  );
}

export default function AdminUebersicht() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [kurz, setKurz] = useState<Kurz | null>(null);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    api("/api/admin/stats")
      .then(d => setStats(d.stats))
      .catch(e => setFehler(e.message));
    // Eigener Aufruf, eigener Fehlerpfad: geht das Monitoring nicht, soll
    // die Uebersicht trotzdem stehen.
    api("/api/studio/monitoring?tage=30")
      .then(d => setKurz(d as Kurz))
      .catch(() => setKurz(null));
  }, []);

  const monat = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <AdminShell titel="Übersicht" eyebrow="Verwaltung" lead="Alles Wichtige auf einen Blick.">
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
          icon={<FolderOpen size={20} />}
          label="Dokumente"
          wert={stats ? String(stats.dokumente) : "—"}
          zusatz="Rechnungen & Belege"
          href="/admin/dokumente"
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

      {/* Die Zahlen zur Website – dieselben wie im Monitoring, nur die
          wichtigsten und fest auf 30 Tage. Wer mehr will, klickt weiter. */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="display-h text-lg font-semibold text-[var(--fg)]">Website · 30 Tage</h2>
        <a href="/admin/monitoring" className="text-sm text-[var(--accent)] no-underline">
          Zum Monitoring →
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Kachel
          icon={<Users size={20} />}
          label="Besuche"
          wert={kurz?.besucher?.ok ? kurz.besucher.besuche.toLocaleString("de-DE") : "—"}
          zusatz={kurz?.besucher?.ok ? "letzte 30 Tage" : "Web Analytics noch nicht eingerichtet"}
          href="/admin/monitoring"
          neben={kurz?.besucher?.ok
            ? <Trend jetzt={kurz.besucher.besuche} davor={kurz.davor?.besuche} /> : undefined}
        />
        <Kachel
          icon={<MousePointerClick size={20} />}
          label="Seitenaufrufe"
          wert={kurz?.besucher?.ok ? kurz.besucher.aufrufe.toLocaleString("de-DE") : "—"}
          zusatz="wie gründlich geschaut wird"
          href="/admin/monitoring"
          neben={kurz?.besucher?.ok
            ? <Trend jetzt={kurz.besucher.aufrufe} davor={kurz.davor?.aufrufe} /> : undefined}
        />
        <Kachel
          icon={<Inbox size={20} />}
          label="Anfragen"
          wert={kurz?.anfragen?.ok ? String(kurz.anfragen.gesamt) : "—"}
          zusatz="letzte 30 Tage"
          href="/admin/anfragen"
        />
        <Kachel
          icon={<HardDrive size={20} />}
          label="Bildspeicher"
          wert={kurz?.speicher?.ok ? groesse(kurz.speicher.bytes) : "—"}
          zusatz={kurz?.speicher?.ok
            ? `${String(kurz.speicher.anteil).replace(".", ",")} % von 9,5 GB` : ""}
          href="/admin/instagram/galerie"
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
  icon, label, wert, zusatz, href, farbe, neben,
}: {
  icon: React.ReactNode; label: string; wert: string; zusatz?: string; href: string;
  farbe?: string; neben?: React.ReactNode;
}) {
  return (
    <a href={href} className="card p-6 block">
      <div className="icon-tile w-10 h-10 mb-4">{icon}</div>
      <div className="text-[var(--fg-subtle)] text-xs mb-1">{label}</div>
      <div className="display-h text-2xl font-semibold" style={{ color: farbe || "var(--fg)" }}>
        {wert}{neben}
      </div>
      {zusatz && <div className="text-[var(--fg-subtle)] text-xs mt-1">{zusatz}</div>}
    </a>
  );
}
