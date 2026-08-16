"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Copy, Check, Send, X } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";
import BeitragBaukasten from "@/components/admin/BeitragBaukasten";

type Post = {
  id: number;
  titel: string;
  caption: string | null;
  hashtags: string | null;
  geplant_am: string | null;
  status: string;
};

type Bild = { schluessel: string; dateiname: string | null; typ: string | null };

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

  // Instagram-Direktveröffentlichung
  const [verbunden, setVerbunden] = useState<boolean | null>(null);
  const [posten, setPosten] = useState<Post | null>(null);      // für welchen Beitrag ist der Bildwähler offen
  const [bilder, setBilder] = useState<Bild[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  const laden = () =>
    api("/api/admin/posts")
      .then(d => setPosts(d.posts))
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));

  useEffect(() => {
    laden();
    api("/api/admin/instagram").then(d => setVerbunden(!!d.verbunden)).catch(() => setVerbunden(false));
  }, []);

  const posterOeffnen = async (p: Post) => {
    setGewaehlt(null);
    setPosten(p);
    if (!bilder.length) {
      await api("/api/admin/bild")
        .then(d => setBilder(d.bilder))
        .catch(e => setFehler(e.message));
    }
  };

  const veroeffentlichen = async () => {
    if (!posten || !gewaehlt) return;
    setSendet(true);
    setFehler("");
    try {
      const caption = [posten.caption, posten.hashtags].filter(Boolean).join("\n\n");
      await api("/api/admin/instagram", {
        method: "POST",
        body: JSON.stringify({ schluessel: gewaehlt, caption, postId: posten.id }),
      });
      setPosten(null);
      laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Veröffentlichen fehlgeschlagen.");
    } finally {
      setSendet(false);
    }
  };

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
        {verbunden === true ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--accent)" }}>
            ✓ Mit Instagram verbunden — Beiträge lassen sich direkt von hier veröffentlichen
            (Bild aus der Galerie wählen, Caption geht automatisch mit).
          </p>
        ) : (
          <p className="text-[var(--fg-muted)] text-sm leading-relaxed">
            Beiträge vorbereiten, planen und abhaken — zum Posten „Text kopieren" und in der
            Instagram-App einfügen. {verbunden === false && (
              <>Für das <strong className="text-[var(--fg)]">direkte Veröffentlichen von hier</strong> fehlt
              noch der Meta-Zugang (Phase 2): App auf developers.facebook.com anlegen, Token erzeugen
              und in Cloudflare als Secret <code>INSTAGRAM_TOKEN</code> hinterlegen.</>
            )}
          </p>
        )}
      </div>

      <BeitragBaukasten onGespeichert={laden} />

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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-[var(--fg-muted)]">Caption</label>
              <button
                type="button"
                onClick={async () => {
                  const thema = neu.caption.trim() || neu.titel.trim();
                  if (!thema) { setFehler("Erst Titel oder Caption-Stichwort eintippen."); return; }
                  setFehler("");
                  setSendet(true);
                  try {
                    const d = await api("/api/admin/texten", {
                      method: "POST", body: JSON.stringify({ thema }),
                    });
                    setNeu(n => ({ ...n, caption: d.caption, hashtags: d.hashtags }));
                  } catch (err) {
                    setFehler(err instanceof Error ? err.message : "Vorschlag fehlgeschlagen.");
                  } finally { setSendet(false); }
                }}
                disabled={sendet}
                className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 disabled:opacity-50"
                style={{ color: "var(--accent)" }}
              >
                ✨ {sendet ? "Schreibt…" : "Vorschlagen"}
              </button>
            </div>
            <textarea
              rows={4} value={neu.caption} onChange={e => setNeu({ ...neu, caption: e.target.value })}
              placeholder="Text für den Beitrag — oder Titel eintippen und ✨ Vorschlagen drücken"
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
                {verbunden && p.status !== "veroeffentlicht" && (
                  <button
                    onClick={() => posterOeffnen(p)}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    <Send size={13} /> Posten
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bildwähler fürs Direkt-Veröffentlichen */}
      {posten && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(7,26,43,0.72)" }}
          onClick={() => !sendet && setPosten(null)}
          role="dialog" aria-modal="true" aria-label="Bild für den Beitrag wählen"
        >
          <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="flex-1 min-w-0 truncate text-sm font-medium text-[var(--fg)]">
                Bild wählen für: {posten.titel}
              </span>
              <button onClick={() => setPosten(null)} disabled={sendet} aria-label="Schließen"
                className="p-1.5 rounded-[8px] text-[var(--fg-muted)] hover:text-[var(--fg)]">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {bilder.length === 0 ? (
                <p className="text-[var(--fg-subtle)] text-sm">
                  Keine Bilder in der Galerie — erst unter Instagram → Galerie hochladen.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {bilder.map(b => {
                    const jpg = b.typ === "image/jpeg";
                    return (
                      <button
                        key={b.schluessel}
                        onClick={() => jpg && setGewaehlt(b.schluessel)}
                        disabled={!jpg}
                        title={jpg ? (b.dateiname || "") : "Kein JPG — Instagram nimmt per API nur JPG an"}
                        className="relative rounded-[8px] overflow-hidden border-2 transition-all"
                        style={{
                          aspectRatio: "1 / 1",
                          borderColor: gewaehlt === b.schluessel ? "var(--accent)" : "transparent",
                          opacity: jpg ? 1 : 0.35,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/admin/bild?schluessel=${encodeURIComponent(b.schluessel)}`}
                          alt={b.dateiname || ""} loading="lazy"
                          className="w-full h-full object-cover block"
                        />
                        {gewaehlt === b.schluessel && (
                          <span className="absolute top-1.5 right-1.5 rounded-full p-1"
                            style={{ background: "var(--accent)", color: "#fff" }}>
                            <Check size={12} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t"
              style={{ borderColor: "var(--border)" }}>
              <span className="text-[var(--fg-subtle)] text-xs">
                Caption + Hashtags gehen automatisch mit.
              </span>
              <button
                onClick={veroeffentlichen}
                disabled={!gewaehlt || sendet}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-60"
              >
                <Send size={14} /> {sendet ? "Wird veröffentlicht…" : "Jetzt auf Instagram posten"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
