"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Circle, CircleCheck } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

type Notiz = {
  id: number;
  titel: string;
  inhalt: string | null;
  kategorie: string | null;
  erledigt: number;
  faellig_am: string | null;
};

const KATEGORIEN = ["Aufgabe", "Idee", "Steuer", "Behörde", "Kunde", "Sonstiges"];
const LEER = { titel: "", inhalt: "", kategorie: "Aufgabe", faellig_am: "" };

export default function BusinessSeite() {
  const [notizen, setNotizen] = useState<Notiz[]>([]);
  const [neu, setNeu] = useState(LEER);
  const [formOffen, setFormOffen] = useState(false);
  const [zeigeErledigte, setZeigeErledigte] = useState(false);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  const laden = () =>
    api("/api/admin/notizen")
      .then(d => setNotizen(d.notizen))
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));

  useEffect(() => { laden(); }, []);

  const anlegen = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/admin/notizen", { method: "POST", body: JSON.stringify(neu) });
      setNeu(LEER);
      setFormOffen(false);
      laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Fehler beim Speichern.");
    }
  };

  const umschalten = async (n: Notiz) => {
    const neuerWert = n.erledigt ? 0 : 1;
    setNotizen(list => list.map(x => (x.id === n.id ? { ...x, erledigt: neuerWert } : x)));
    await api("/api/admin/notizen", {
      method: "PATCH",
      body: JSON.stringify({ id: n.id, erledigt: neuerWert }),
    }).catch(e => setFehler(e.message));
  };

  const loeschen = async (id: number) => {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    setNotizen(list => list.filter(x => x.id !== id));
    await api("/api/admin/notizen", { method: "DELETE", body: JSON.stringify({ id }) })
      .catch(e => setFehler(e.message));
  };

  const offen = notizen.filter(n => !n.erledigt);
  const erledigt = notizen.filter(n => n.erledigt);
  const sichtbar = zeigeErledigte ? erledigt : offen;

  return (
    <AdminShell titel="Selbständigkeit" eyebrow="Verwaltung" lead="Aufgaben, Ideen und Termine.">
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setZeigeErledigte(false)}
          className="chip px-3 py-1.5 text-xs font-medium"
          style={!zeigeErledigte ? { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" } : undefined}
        >
          Offen ({offen.length})
        </button>
        <button
          onClick={() => setZeigeErledigte(true)}
          className="chip px-3 py-1.5 text-xs font-medium"
          style={zeigeErledigte ? { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" } : undefined}
        >
          Erledigt ({erledigt.length})
        </button>
      </div>

      <button onClick={() => setFormOffen(o => !o)} className="btn-primary px-5 py-2.5 text-sm mb-6">
        <Plus size={16} /> Neuer Eintrag
      </button>

      {formOffen && (
        <form onSubmit={anlegen} className="card p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Titel *</label>
            <input
              required value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })}
              placeholder="z. B. Umsatzsteuer-Voranmeldung einreichen"
              className="field px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Notiz</label>
            <textarea
              rows={3} value={neu.inhalt} onChange={e => setNeu({ ...neu, inhalt: e.target.value })}
              placeholder="Details, Links, Ansprechpartner…"
              className="field px-4 py-2.5 text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Kategorie</label>
              <select value={neu.kategorie} onChange={e => setNeu({ ...neu, kategorie: e.target.value })}
                className="field px-4 py-2.5 text-sm">
                {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Fällig am</label>
              <input
                type="date" value={neu.faellig_am}
                onChange={e => setNeu({ ...neu, faellig_am: e.target.value })}
                className="field px-4 py-2.5 text-sm"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary px-5 py-2.5 text-sm">Speichern</button>
        </form>
      )}

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : sichtbar.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--fg-muted)]">
            {zeigeErledigte ? "Noch nichts erledigt." : "Keine offenen Einträge — alles erledigt."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sichtbar.map(n => {
            const ueberfaellig = !n.erledigt && n.faellig_am && n.faellig_am < new Date().toISOString().slice(0, 10);
            return (
              <div key={n.id} className="card p-5 flex items-start gap-4">
                <button
                  onClick={() => umschalten(n)}
                  aria-label={n.erledigt ? "Als offen markieren" : "Als erledigt markieren"}
                  className="mt-0.5 shrink-0 transition-colors"
                  style={{ color: n.erledigt ? "var(--accent)" : "var(--fg-subtle)" }}
                >
                  {n.erledigt ? <CircleCheck size={20} /> : <Circle size={20} />}
                </button>

                <div className="flex-1 min-w-0">
                  <h3 className="display-h font-semibold text-[var(--fg)]"
                    style={n.erledigt ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                    {n.titel}
                  </h3>
                  {n.inhalt && (
                    <p className="text-[var(--fg-muted)] text-sm leading-relaxed whitespace-pre-wrap mt-1">{n.inhalt}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {n.kategorie && <span className="chip px-2.5 py-1 text-xs font-medium">{n.kategorie}</span>}
                    {n.faellig_am && (
                      <span className="chip px-2.5 py-1 text-xs font-medium"
                        style={ueberfaellig ? { color: "#ef4444", borderColor: "#ef4444" } : undefined}>
                        {ueberfaellig ? "überfällig · " : "fällig "}{datum(n.faellig_am)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => loeschen(n.id)} aria-label="Eintrag löschen"
                  className="p-1.5 rounded-[8px] text-[var(--fg-subtle)] hover:text-[#ef4444] transition-colors shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
