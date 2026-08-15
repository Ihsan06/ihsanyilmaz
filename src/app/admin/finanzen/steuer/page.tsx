"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Circle, CircleCheck, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import AdminShell, { api, euro, datum } from "@/components/admin/AdminShell";

type Transaktion = {
  id: number;
  art: "einnahme" | "ausgabe";
  betrag_cent: number;
  beschreibung: string;
  kategorie: string | null;
  datum: string;
};

type Notiz = {
  id: number;
  titel: string;
  inhalt: string | null;
  kategorie: string | null;
  erledigt: number;
  faellig_am: string | null;
};

// Typische Unterlagen für die Steuererklärung eines Gewerbetreibenden im
// Nebenerwerb. Reine Gedankenstütze — keine Steuerberatung.
const VORSCHLAEGE = [
  "Alle Rechnungen (Einnahmen) als PDF sammeln",
  "Belege für Ausgaben sammeln (Hardware, Software, Fahrtkosten)",
  "EÜR — Einnahmenüberschussrechnung vorbereiten",
  "Anlage G (Gewerbebetrieb) für die Einkommensteuer",
  "Kleinunternehmerregelung prüfen (§ 19 UStG)",
  "Gewerbesteuer: Freibetrag 24.500 € im Blick behalten",
  "Home-Office / Arbeitszimmer-Anteil klären",
];

export default function SteuerSeite() {
  const [transaktionen, setTransaktionen] = useState<Transaktion[]>([]);
  const [notizen, setNotizen] = useState<Notiz[]>([]);
  const [jahr, setJahr] = useState(new Date().getFullYear().toString());
  const [neuTitel, setNeuTitel] = useState("");
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  const laden = () =>
    Promise.all([api("/api/admin/finanzen"), api("/api/admin/notizen")])
      .then(([f, n]) => {
        setTransaktionen(f.transaktionen);
        setNotizen(n.notizen.filter((x: Notiz) => x.kategorie === "Steuer"));
      })
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));

  useEffect(() => { laden(); }, []);

  const jahre = useMemo(() => {
    const s = new Set(transaktionen.map(t => t.datum.slice(0, 4)));
    s.add(new Date().getFullYear().toString());
    return [...s].sort().reverse();
  }, [transaktionen]);

  const imJahr = useMemo(
    () => transaktionen.filter(t => t.datum.startsWith(jahr)),
    [transaktionen, jahr],
  );

  const summen = useMemo(() => {
    const ein = imJahr.filter(t => t.art === "einnahme").reduce((s, t) => s + t.betrag_cent, 0);
    const aus = imJahr.filter(t => t.art === "ausgabe").reduce((s, t) => s + t.betrag_cent, 0);
    return { ein, aus, gewinn: ein - aus };
  }, [imJahr]);

  const nachKategorie = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of imJahr.filter(x => x.art === "ausgabe")) {
      const k = t.kategorie || "Ohne Kategorie";
      m.set(k, (m.get(k) ?? 0) + t.betrag_cent);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [imJahr]);

  // CSV fürs Steuerprogramm / den Steuerberater — Semikolon & Komma-Dezimal,
  // damit deutsches Excel die Datei direkt richtig öffnet.
  const csvExport = () => {
    const zeilen = [
      ["Datum", "Art", "Beschreibung", "Kategorie", "Betrag EUR"],
      ...imJahr.map(t => [
        t.datum,
        t.art === "einnahme" ? "Einnahme" : "Ausgabe",
        t.beschreibung.replace(/;/g, ","),
        t.kategorie || "",
        ((t.art === "einnahme" ? 1 : -1) * t.betrag_cent / 100).toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = "﻿" + zeilen.map(z => z.join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `steuer-${jahr}-einnahmen-ausgaben.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const anlegen = async (titel: string) => {
    setFehler("");
    try {
      await api("/api/admin/notizen", {
        method: "POST",
        body: JSON.stringify({ titel, kategorie: "Steuer" }),
      });
      setNeuTitel("");
      laden();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler beim Speichern.");
    }
  };

  const umschalten = async (n: Notiz) => {
    const wert = n.erledigt ? 0 : 1;
    setNotizen(l => l.map(x => (x.id === n.id ? { ...x, erledigt: wert } : x)));
    await api("/api/admin/notizen", {
      method: "PATCH",
      body: JSON.stringify({ id: n.id, erledigt: wert }),
    }).catch(e => setFehler(e.message));
  };

  const loeschen = async (id: number) => {
    if (!confirm("Diesen Punkt wirklich löschen?")) return;
    setNotizen(l => l.filter(x => x.id !== id));
    await api("/api/admin/notizen", { method: "DELETE", body: JSON.stringify({ id }) })
      .catch(e => setFehler(e.message));
  };

  const offeneVorschlaege = VORSCHLAEGE.filter(
    v => !notizen.some(n => n.titel === v),
  );

  return (
    <AdminShell
      titel="Steuer"
      eyebrow="Finanzen"
      lead="Alles für die Steuererklärung an einem Ort — Zahlen, Belege-Checkliste und Export."
    >
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={jahr} onChange={e => setJahr(e.target.value)}
          className="field px-4 py-2 text-sm" style={{ width: "auto" }}>
          {jahre.map(j => <option key={j} value={j}>Steuerjahr {j}</option>)}
        </select>
        <button onClick={csvExport} disabled={imJahr.length === 0}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          <Download size={15} /> CSV für Steuerberater
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <Kachel icon={<TrendingUp size={18} />} label={`Betriebseinnahmen ${jahr}`} wert={euro(summen.ein)} />
        <Kachel icon={<TrendingDown size={18} />} label={`Betriebsausgaben ${jahr}`} wert={euro(summen.aus)} />
        <Kachel icon={<Wallet size={18} />} label={`Gewinn ${jahr}`} wert={euro(summen.gewinn)}
          farbe={summen.gewinn < 0 ? "#ef4444" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="display-h text-lg font-semibold text-[var(--fg)] mb-4">
            Ausgaben nach Kategorie
          </h2>
          {nachKategorie.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-[var(--fg-muted)] text-sm">
                Noch keine Ausgaben in {jahr} erfasst.{" "}
                <a href="/admin/finanzen" className="font-medium hover:opacity-80" style={{ color: "var(--accent)" }}>
                  Jetzt eintragen →
                </a>
              </p>
            </div>
          ) : (
            <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
              {nachKategorie.map(([k, cent]) => (
                <div key={k} className="flex items-center justify-between px-5 py-3.5 text-sm"
                  style={{ borderColor: "var(--border)" }}>
                  <span className="text-[var(--fg)]">{k}</span>
                  <span className="font-medium text-[var(--fg)]">{euro(cent)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[var(--fg-subtle)] text-xs mt-3 leading-relaxed">
            Zahlen kommen automatisch aus „Einnahmen &amp; Ausgaben". Hinweis: Das ist eine
            Zusammenstellung deiner eigenen Daten, keine Steuerberatung.
          </p>
        </section>

        <section>
          <h2 className="display-h text-lg font-semibold text-[var(--fg)] mb-4">
            Checkliste Steuererklärung
          </h2>

          <div className="flex gap-2 mb-4">
            <input
              value={neuTitel} onChange={e => setNeuTitel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && neuTitel.trim()) anlegen(neuTitel.trim()); }}
              placeholder="Eigenen Punkt hinzufügen…"
              className="field px-4 py-2.5 text-sm flex-1"
            />
            <button onClick={() => neuTitel.trim() && anlegen(neuTitel.trim())}
              className="btn-primary px-4 py-2.5 text-sm shrink-0">
              <Plus size={15} />
            </button>
          </div>

          {laedt ? (
            <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
          ) : (
            <div className="space-y-2">
              {notizen.map(n => (
                <div key={n.id} className="card px-4 py-3 flex items-center gap-3">
                  <button onClick={() => umschalten(n)}
                    aria-label={n.erledigt ? "Als offen markieren" : "Als erledigt markieren"}
                    className="shrink-0"
                    style={{ color: n.erledigt ? "var(--accent)" : "var(--fg-subtle)" }}>
                    {n.erledigt ? <CircleCheck size={19} /> : <Circle size={19} />}
                  </button>
                  <span className="flex-1 text-sm text-[var(--fg)]"
                    style={n.erledigt ? { textDecoration: "line-through", opacity: 0.55 } : undefined}>
                    {n.titel}
                    {n.faellig_am && (
                      <span className="text-[var(--fg-subtle)] text-xs ml-2">fällig {datum(n.faellig_am)}</span>
                    )}
                  </span>
                  <button onClick={() => loeschen(n.id)} aria-label="Punkt löschen"
                    className="p-1 rounded text-[var(--fg-subtle)] hover:text-[#ef4444] transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {offeneVorschlaege.length > 0 && (
                <div className="pt-3">
                  <p className="text-[var(--fg-subtle)] text-xs mb-2">Vorschläge — antippen zum Übernehmen:</p>
                  <div className="flex flex-wrap gap-2">
                    {offeneVorschlaege.map(v => (
                      <button key={v} onClick={() => anlegen(v)}
                        className="chip px-3 py-1.5 text-xs text-left hover:opacity-80 transition-opacity">
                        + {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="text-[var(--fg-subtle)] text-xs mt-3">
            Die Punkte sind dieselben wie unter „Selbständigkeit" mit Kategorie <em>Steuer</em> — beide Ansichten bleiben synchron.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}

function Kachel({ icon, label, wert, farbe }: { icon: React.ReactNode; label: string; wert: string; farbe?: string }) {
  return (
    <div className="card p-6">
      <div className="icon-tile w-10 h-10 mb-4">{icon}</div>
      <div className="text-[var(--fg-subtle)] text-xs mb-1">{label}</div>
      <div className="display-h text-2xl font-semibold" style={{ color: farbe || "var(--fg)" }}>{wert}</div>
    </div>
  );
}
