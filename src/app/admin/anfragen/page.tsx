"use client";
import { useEffect, useState } from "react";
import { Mail, Trash2 } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

type Anfrage = {
  id: number;
  name: string;
  email: string;
  betrieb: string | null;
  nachricht: string;
  status: string;
  notiz: string | null;
  erstellt_am: string;
};

const STATUS: { wert: string; label: string }[] = [
  { wert: "neu", label: "Neu" },
  { wert: "in_bearbeitung", label: "In Bearbeitung" },
  { wert: "beantwortet", label: "Beantwortet" },
  { wert: "archiviert", label: "Archiviert" },
];

export default function AnfragenSeite() {
  const [anfragen, setAnfragen] = useState<Anfrage[]>([]);
  const [filter, setFilter] = useState("alle");
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  const laden = () =>
    api("/api/admin/anfragen")
      .then(d => setAnfragen(d.anfragen))
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));

  useEffect(() => { laden(); }, []);

  const statusSetzen = async (id: number, status: string) => {
    setAnfragen(a => a.map(x => (x.id === id ? { ...x, status } : x)));
    await api("/api/admin/anfragen", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    }).catch(e => setFehler(e.message));
  };

  const loeschen = async (id: number) => {
    if (!confirm("Diese Anfrage wirklich dauerhaft löschen?")) return;
    setAnfragen(a => a.filter(x => x.id !== id));
    await api("/api/admin/anfragen", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }).catch(e => setFehler(e.message));
  };

  const sichtbar = filter === "alle" ? anfragen : anfragen.filter(a => a.status === filter);

  return (
    <AdminShell titel="Anfragen" eyebrow="Verwaltung" lead="Nachrichten aus dem Kontaktformular.">
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      <div className="flex flex-wrap gap-2 mb-6">
        {[{ wert: "alle", label: "Alle" }, ...STATUS].map(s => (
          <button
            key={s.wert}
            onClick={() => setFilter(s.wert)}
            className="chip px-3 py-1.5 text-xs font-medium transition-colors"
            style={filter === s.wert
              ? { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" }
              : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : sichtbar.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--fg-muted)]">Noch keine Anfragen in dieser Ansicht.</p>
          <p className="text-[var(--fg-subtle)] text-sm mt-1">
            Neue Anfragen über das Kontaktformular erscheinen hier automatisch.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sichtbar.map(a => (
            <div key={a.id} className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="display-h text-lg font-semibold text-[var(--fg)]">{a.name}</h3>
                  <p className="text-[var(--fg-subtle)] text-sm">
                    {a.betrieb ? `${a.betrieb} · ` : ""}{datum(a.erstellt_am)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={a.status}
                    onChange={e => statusSetzen(a.id, e.target.value)}
                    className="field px-3 py-1.5 text-xs"
                    style={{ width: "auto" }}
                  >
                    {STATUS.map(s => <option key={s.wert} value={s.wert}>{s.label}</option>)}
                  </select>
                  <button
                    onClick={() => loeschen(a.id)}
                    aria-label="Anfrage löschen"
                    className="p-2 rounded-[8px] text-[var(--fg-subtle)] hover:text-[#ef4444] transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <p className="text-[var(--fg-muted)] text-sm leading-relaxed whitespace-pre-wrap mb-4">
                {a.nachricht}
              </p>

              <a
                href={`mailto:${a.email}?subject=${encodeURIComponent("Ihre Anfrage bei AIY | Ihsan Yilmaz")}`}
                className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ color: "var(--accent)" }}
              >
                <Mail size={15} /> {a.email}
              </a>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
