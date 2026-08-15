"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

type Post = {
  id: number;
  titel: string;
  caption: string | null;
  hashtags: string | null;
  geplant_am: string | null;
  status: string;
};

const STATUS = [
  { wert: "idee", label: "Idee" },
  { wert: "entwurf", label: "Entwurf" },
  { wert: "geplant", label: "Geplant" },
  { wert: "veroeffentlicht", label: "Veröffentlicht" },
];

const LEER = { titel: "", caption: "", hashtags: "", geplant_am: "", status: "idee" };

export default function InstagramSeite() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [neu, setNeu] = useState(LEER);
  const [formOffen, setFormOffen] = useState(false);
  const [kopiert, setKopiert] = useState<number | null>(null);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  const laden = () =>
    api("/api/admin/posts")
      .then(d => setPosts(d.posts))
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));

  useEffect(() => { laden(); }, []);

  const anlegen = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/admin/posts", { method: "POST", body: JSON.stringify(neu) });
      setNeu(LEER);
      setFormOffen(false);
      laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Fehler beim Speichern.");
    }
  };

  const statusSetzen = async (id: number, status: string) => {
    setPosts(p => p.map(x => (x.id === id ? { ...x, status } : x)));
    await api("/api/admin/posts", { method: "PATCH", body: JSON.stringify({ id, status }) })
      .catch(e => setFehler(e.message));
  };

  const loeschen = async (id: number) => {
    if (!confirm("Diesen Beitrag wirklich löschen?")) return;
    setPosts(p => p.filter(x => x.id !== id));
    await api("/api/admin/posts", { method: "DELETE", body: JSON.stringify({ id }) })
      .catch(e => setFehler(e.message));
  };

  const kopieren = async (p: Post) => {
    const text = [p.caption, p.hashtags].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setKopiert(p.id);
      setTimeout(() => setKopiert(null), 2000);
    } catch {
      setFehler("Kopieren nicht möglich — bitte Text manuell markieren.");
    }
  };

  return (
    <AdminShell titel="Content erstellen" eyebrow="Instagram" lead="Beiträge vorbereiten, planen und abhaken.">
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      <div className="card p-5 mb-6">
        <p className="text-[var(--fg-muted)] text-sm leading-relaxed">
          Beiträge hier vorbereiten, planen und abhaken. Zum Veröffentlichen die Caption kopieren
          und in der Instagram-App einfügen — automatisches Posten braucht einen Business-Account
          mit Meta-App-Freigabe und lässt sich später ergänzen.
        </p>
      </div>

      <button onClick={() => setFormOffen(o => !o)} className="btn-primary px-5 py-2.5 text-sm mb-6">
        <Plus size={16} /> Neuer Beitrag
      </button>

      {formOffen && (
        <form onSubmit={anlegen} className="card p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Titel / Thema *</label>
            <input
              required value={neu.titel} onChange={e => setNeu({ ...neu, titel: e.target.value })}
              placeholder="z. B. Vorher-Nachher: Autohaus-Website"
              className="field px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Caption</label>
            <textarea
              rows={4} value={neu.caption} onChange={e => setNeu({ ...neu, caption: e.target.value })}
              placeholder="Text für den Beitrag…"
              className="field px-4 py-2.5 text-sm resize-none"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Hashtags</label>
            <input
              value={neu.hashtags} onChange={e => setNeu({ ...neu, hashtags: e.target.value })}
              placeholder="#würzburg #webdesign #handwerk"
              className="field px-4 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Geplant für</label>
              <input
                type="date" value={neu.geplant_am}
                onChange={e => setNeu({ ...neu, geplant_am: e.target.value })}
                className="field px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Status</label>
              <select
                value={neu.status} onChange={e => setNeu({ ...neu, status: e.target.value })}
                className="field px-4 py-2.5 text-sm"
              >
                {STATUS.map(s => <option key={s.wert} value={s.wert}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary px-5 py-2.5 text-sm">Speichern</button>
        </form>
      )}

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : posts.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--fg-muted)]">Noch keine Beiträge geplant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {posts.map(p => (
            <div key={p.id} className="card p-6 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="display-h text-base font-semibold text-[var(--fg)]">{p.titel}</h3>
                <button
                  onClick={() => loeschen(p.id)} aria-label="Beitrag löschen"
                  className="p-1.5 rounded-[8px] text-[var(--fg-subtle)] hover:text-[#ef4444] transition-colors shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {p.caption && (
                <p className="text-[var(--fg-muted)] text-sm leading-relaxed whitespace-pre-wrap mb-3">
                  {p.caption}
                </p>
              )}
              {p.hashtags && (
                <p className="text-sm mb-4" style={{ color: "var(--accent)" }}>{p.hashtags}</p>
              )}

              <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
                <select
                  value={p.status} onChange={e => statusSetzen(p.id, e.target.value)}
                  className="field px-3 py-1.5 text-xs" style={{ width: "auto" }}
                >
                  {STATUS.map(s => <option key={s.wert} value={s.wert}>{s.label}</option>)}
                </select>
                {p.geplant_am && (
                  <span className="chip px-2.5 py-1 text-xs font-medium">{datum(p.geplant_am)}</span>
                )}
                {(p.caption || p.hashtags) && (
                  <button
                    onClick={() => kopieren(p)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium ml-auto hover:opacity-80 transition-opacity"
                    style={{ color: "var(--accent)" }}
                  >
                    {kopiert === p.id ? <><Check size={14} /> Kopiert</> : <><Copy size={14} /> Text kopieren</>}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
