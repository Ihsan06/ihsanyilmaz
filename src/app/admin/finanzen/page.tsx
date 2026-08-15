"use client";
import { useEffect, useMemo, useState } from "react";
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

const KATEGORIEN = ["Website-Projekt", "Wartung", "Software / Tools", "Hardware", "Fahrtkosten", "Sonstiges"];

const heute = () => new Date().toISOString().slice(0, 10);
const LEER = { art: "einnahme", betrag: "", beschreibung: "", kategorie: "", datum: heute() };

// "1.234,56" oder "1234.56" → 123456 Cent. Über Cent zu rechnen vermeidet Rundungsfehler.
function inCent(eingabe: string): number | null {
  const norm = eingabe.trim().replace(/\./g, "").replace(",", ".");
  const zahl = Number(norm);
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  return Math.round(zahl * 100);
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
    <AdminShell titel="Einnahmen & Ausgaben">
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
                  <td className="px-5 py-3 text-[var(--fg)]">{t.beschreibung}</td>
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
