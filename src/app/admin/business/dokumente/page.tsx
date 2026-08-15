"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, FileText, Download, Eye, X, ExternalLink } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

type Dokument = {
  schluessel: string;
  dateiname: string | null;
  kategorie: string | null;
  notiz: string | null;
  groesse: number;
  typ: string | null;
  erstellt_am: string;
};

const KATEGORIEN = ["Rechnung", "Beleg", "Vertrag", "Behörde", "Sonstiges"];

// Im Fenster anzeigen können Browser nur PDFs und Bilder — Word/Excel/CSV
// werden stattdessen heruntergeladen.
function vorschaubar(typ: string | null) {
  return typ === "application/pdf" || (typ ?? "").startsWith("image/");
}

function dokUrl(schluessel: string) {
  return `/api/admin/dokument?schluessel=${encodeURIComponent(schluessel)}`;
}

function mb(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DokumenteSeite() {
  const [dokumente, setDokumente] = useState<Dokument[]>([]);
  const [filter, setFilter] = useState("alle");
  const [kategorie, setKategorie] = useState("Rechnung");
  const [speicherDa, setSpeicherDa] = useState(true);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);
  const [vorschau, setVorschau] = useState<Dokument | null>(null);
  const dateiFeld = useRef<HTMLInputElement>(null);

  // Vorschau mit Escape schließen
  useEffect(() => {
    if (!vorschau) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setVorschau(null); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [vorschau]);

  const laden = () =>
    api("/api/admin/dokument")
      .then(d => {
        setDokumente(d.dokumente);
        setSpeicherDa(d.speicherVerbunden);
      })
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));

  useEffect(() => { laden(); }, []);

  const hochladen = async (dateien: FileList | null) => {
    if (!dateien?.length) return;
    setFehler("");
    setLaedtHoch(true);
    try {
      for (const datei of Array.from(dateien)) {
        const form = new FormData();
        form.append("datei", datei);
        form.append("kategorie", kategorie);
        const res = await fetch("/api/admin/dokument", { method: "POST", body: form });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d?.error || "Upload fehlgeschlagen.");
      }
      laden();
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setLaedtHoch(false);
      if (dateiFeld.current) dateiFeld.current.value = "";
    }
  };

  const loeschen = async (schluessel: string) => {
    if (!confirm("Dieses Dokument wirklich dauerhaft löschen?")) return;
    setDokumente(l => l.filter(x => x.schluessel !== schluessel));
    await api("/api/admin/dokument", { method: "DELETE", body: JSON.stringify({ schluessel }) })
      .catch(e => setFehler(e.message));
  };

  const sichtbar = filter === "alle" ? dokumente : dokumente.filter(d => d.kategorie === filter);

  return (
    <AdminShell
      titel="Dokumente"
      eyebrow="Selbständigkeit"
      lead="Rechnungen, Belege, Verträge und Behördenpost — sicher archiviert und jederzeit abrufbar."
    >
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      {!speicherDa && (
        <div className="card p-5 mb-6">
          <p className="text-[var(--fg)] font-medium mb-1">Dateispeicher noch nicht verbunden</p>
          <p className="text-[var(--fg-muted)] text-sm">
            Das Archiv nutzt denselben R2-Speicher wie die Galerie (Binding <code>BILDER</code>).
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={kategorie} onChange={e => setKategorie(e.target.value)}
          className="field px-3 py-2 text-sm" style={{ width: "auto" }}
          aria-label="Kategorie für den Upload">
          {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <button
          onClick={() => dateiFeld.current?.click()}
          disabled={laedtHoch || !speicherDa}
          className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
        >
          <Upload size={16} /> {laedtHoch ? "Wird hochgeladen…" : "Dokument hochladen"}
        </button>
        <input
          ref={dateiFeld} type="file" multiple hidden
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.odt,.xlsx,.csv"
          onChange={e => hochladen(e.target.files)}
        />
        <span className="text-[var(--fg-subtle)] text-sm">PDF, Bilder, Word/ODT, Excel, CSV — bis 15 MB</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {["alle", ...KATEGORIEN].map(k => (
          <button key={k} onClick={() => setFilter(k)}
            className="chip px-3 py-1.5 text-xs font-medium"
            style={filter === k
              ? { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" }
              : undefined}>
            {k === "alle" ? "Alle" : k}
          </button>
        ))}
      </div>

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : sichtbar.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--fg-muted)]">Keine Dokumente in dieser Ansicht.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sichtbar.map(d => (
            <div key={d.schluessel} className="card p-5 flex items-center gap-4">
              <div className="icon-tile w-10 h-10 shrink-0"><FileText size={18} /></div>

              <div
                className={`flex-1 min-w-0 ${vorschaubar(d.typ) ? "cursor-pointer" : ""}`}
                onClick={() => vorschaubar(d.typ) && setVorschau(d)}
              >
                <div className="text-[var(--fg)] font-medium truncate" title={d.dateiname || ""}>
                  {d.dateiname || "Dokument"}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {d.kategorie && <span className="chip px-2.5 py-0.5 text-xs font-medium">{d.kategorie}</span>}
                  <span className="text-[var(--fg-subtle)] text-xs">{mb(d.groesse)} · {datum(d.erstellt_am)}</span>
                </div>
                {d.notiz && <p className="text-[var(--fg-muted)] text-sm mt-1.5">{d.notiz}</p>}
              </div>

              {vorschaubar(d.typ) && (
                <button
                  onClick={() => setVorschau(d)}
                  aria-label="Vorschau öffnen"
                  className="p-2 rounded-[8px] transition-colors hover:opacity-80 shrink-0"
                  style={{ color: "var(--accent)" }}
                >
                  <Eye size={17} />
                </button>
              )}
              <a
                href={dokUrl(d.schluessel)}
                target="_blank" rel="noopener noreferrer"
                aria-label="Dokument öffnen / herunterladen"
                className="p-2 rounded-[8px] transition-colors hover:opacity-80 shrink-0"
                style={{ color: "var(--accent)" }}
              >
                <Download size={17} />
              </a>
              <button
                onClick={() => loeschen(d.schluessel)} aria-label="Dokument löschen"
                className="p-2 rounded-[8px] text-[var(--fg-subtle)] hover:text-[#ef4444] transition-colors shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Vorschau-Fenster */}
      {vorschau && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          style={{ background: "rgba(7,26,43,0.72)" }}
          onClick={() => setVorschau(null)}
          role="dialog" aria-modal="true" aria-label={`Vorschau: ${vorschau.dateiname || "Dokument"}`}
        >
          <div
            className="card w-full max-w-4xl h-full max-h-[88vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <FileText size={17} style={{ color: "var(--accent)" }} className="shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm font-medium text-[var(--fg)]"
                title={vorschau.dateiname || ""}>
                {vorschau.dateiname || "Dokument"}
              </span>
              <a
                href={dokUrl(vorschau.schluessel)}
                target="_blank" rel="noopener noreferrer"
                aria-label="In neuem Tab öffnen"
                className="p-1.5 rounded-[8px] hover:opacity-80 transition-opacity shrink-0"
                style={{ color: "var(--accent)" }}
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={() => setVorschau(null)}
                aria-label="Vorschau schließen"
                className="p-1.5 rounded-[8px] text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 min-h-0" style={{ background: "var(--surface-2)" }}>
              {vorschau.typ === "application/pdf" ? (
                <iframe
                  title={`Vorschau: ${vorschau.dateiname || "Dokument"}`}
                  src={dokUrl(vorschau.schluessel)}
                  className="w-full h-full block"
                  style={{ border: 0 }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dokUrl(vorschau.schluessel)}
                    alt={vorschau.dateiname || "Dokument"}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
