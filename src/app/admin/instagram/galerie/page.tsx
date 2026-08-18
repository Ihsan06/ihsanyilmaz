"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, ImageOff } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

type Bild = {
  schluessel: string;
  quelle: string | null;
  motiv: string | null;
  angelegt: string;
};

function mb(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Instagram nimmt über die API nur JPG an — deshalb wandelt die Galerie
// alles beim Hochladen um (und verkleinert nebenbei auf max. 2048 px).
// Klappt das Dekodieren nicht (z. B. HEIC in älteren Browsern), geht das
// Original durch — besser ein Bild im falschen Format als gar keins.
async function zuJpeg(datei: File): Promise<File> {
  if (!datei.type.startsWith("image/") || datei.type === "image/jpeg") return datei;
  try {
    const bmp = await createImageBitmap(datei);
    const max = 2048;
    const f = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * f);
    c.height = Math.round(bmp.height * f);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return datei;
    return new File([blob], datei.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return datei;
  }
}

export default function GalerieSeite() {
  const [bilder, setBilder] = useState<Bild[]>([]);
  const [kategorien, setKategorien] = useState<{ id: string; titel: string }[]>([]);
  const [laedtHoch, setLaedtHoch] = useState(false);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);
  const dateiFeld = useRef<HTMLInputElement>(null);

  // Eine Quelle für alle Bilder: derselbe Vorrat, aus dem auch der
  // Baukasten unter "Content erstellen" wählt. Vorher lag hier eine zweite
  // Sammlung, und beide Seiten zeigten verschiedene Bilder.
  const laden = () =>
    api("/api/studio/vorrat")
      .then(d => {
        setBilder(Array.isArray(d.bilder) ? d.bilder : []);
        setKategorien(Array.isArray(d.kategorien) ? d.kategorien : []);
      })
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));

  useEffect(() => { laden(); }, []);

  const hochladen = async (dateien: FileList | null) => {
    if (!dateien?.length) return;
    setFehler("");
    setLaedtHoch(true);
    try {
      for (const roh of Array.from(dateien)) {
        const datei = await zuJpeg(roh);
        const form = new FormData();
        form.append("datei", datei);
        // Kein Content-Type setzen — der Browser ergänzt die multipart-Grenze selbst.
        const res = await fetch("/api/studio/vorrat", { method: "POST", body: form });
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
    if (!confirm("Dieses Bild in den Papierkorb legen?")) return;
    setBilder(b => b.filter(x => x.schluessel !== schluessel));
    await api("/api/studio/vorrat?schluessel=" + encodeURIComponent(schluessel),
      { method: "DELETE" })
      .then(laden)
      .catch(e => setFehler(e.message));
  };

  return (
    <AdminShell
      titel="Galerie"
      eyebrow="Instagram"
      lead="Deine Fotos — hinzufügen, ansehen, herausnehmen."
    >
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}


      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button
          onClick={() => dateiFeld.current?.click()}
          disabled={laedtHoch}
          className="btn-primary px-5 py-2.5 text-sm disabled:opacity-60"
        >
          <Upload size={16} /> {laedtHoch ? "Wird hochgeladen…" : "Bilder hinzufügen"}
        </button>
        <input
          ref={dateiFeld} type="file" accept="image/*,.heic,.heif"
          multiple hidden onChange={e => hochladen(e.target.files)}
        />
        <span className="text-[var(--fg-subtle)] text-sm">
          {bilder.length} {bilder.length === 1 ? "Bild" : "Bilder"} im Vorrat
        </span>
      </div>

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : bilder.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="inline-flex items-center justify-center mb-3" style={{ color: "var(--fg-subtle)" }}>
            <ImageOff size={28} />
          </div>
          <p className="text-[var(--fg-muted)]">Noch keine Bilder in der Galerie.</p>
          <p className="text-[var(--fg-subtle)] text-sm mt-1">
            JPG, PNG, WebP oder AVIF — bis 8 MB pro Bild.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {bilder.map(b => (
            <figure key={b.schluessel} className="card overflow-hidden flex flex-col">
              <div className="relative" style={{ aspectRatio: "1 / 1", background: "var(--surface-2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/bilder/${b.schluessel}`}
                  alt={b.quelle || "Galeriebild"}
                  loading="lazy"
                  className="w-full h-full object-cover block"
                />
                <button
                  onClick={() => loeschen(b.schluessel)}
                  aria-label="Bild löschen"
                  className="absolute top-2 right-2 p-2 rounded-[8px] transition-colors"
                  style={{ background: "rgba(7,26,43,0.72)", color: "#fff" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <figcaption className="p-3">
                <div className="text-[var(--fg)] text-xs font-medium truncate" title={b.quelle || ""}>
                  {b.quelle || "Bild"}
                </div>
                <div className="text-[var(--fg-subtle)] text-xs mt-0.5">
                  {kategorien.find(k => k.id === b.motiv)?.titel || "unsortiert"} · {datum(b.angelegt)}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
