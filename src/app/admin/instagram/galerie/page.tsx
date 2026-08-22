"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, ImageOff, Plus, Sparkles, FolderTree, X, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

type Bild = {
  schluessel: string;
  quelle: string | null;
  motiv: string | null;
  beschreibung: string | null;
  favorit?: number;
  angelegt: string;
};

type Kategorie = { id: string; titel: string; hinweis: string | null; fest: number };

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
  const [kategorien, setKategorien] = useState<Kategorie[]>([]);
  const [filter, setFilter] = useState("");
  const [neuOffen, setNeuOffen] = useState(false);
  const [neuTitel, setNeuTitel] = useState("");
  const [neuHinweis, setNeuHinweis] = useState("");
  const [laeuft, setLaeuft] = useState("");
  const [meldung, setMeldung] = useState("");
  // Welches Bild gross zu sehen ist. null = keins.
  const [gross, setGross] = useState<Bild | null>(null);
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

  // Esc schliesst die Grossansicht. Ohne das bleibt nur der Klick daneben,
  // und wer die Tastatur benutzt, sitzt fest.
  useEffect(() => {
    if (!gross) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGross(null);
      if (e.key === "ArrowLeft") blaettern(-1);
      if (e.key === "ArrowRight") blaettern(1);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  });

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

  // ─── Themen ───
  //
  // Ein Thema wirkt an drei Stellen: das Modell bekommt es beim Ansehen neuer
  // Bilder mit in die Auswahl, hier wird es zum Filter, und unter "Content
  // erstellen" steht es als Baukasten-Thema.
  const themaAnlegen = async () => {
    if (!neuTitel.trim()) { setFehler("Das Thema braucht einen Namen."); return; }
    setFehler("");
    try {
      const d = await api("/api/studio/kategorien", {
        method: "POST",
        body: JSON.stringify({ titel: neuTitel, hinweis: neuHinweis }),
      });
      setKategorien(d.kategorien || []);
      setNeuOffen(false); setNeuTitel(""); setNeuHinweis("");
      setMeldung(`„${neuTitel.trim()}" angelegt. Ab dem nächsten Ansehen sortiert das Modell danach ein.`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Ging nicht.");
    }
  };

  const themaLoeschen = async (id: string, titel: string) => {
    if (!confirm(`Thema „${titel}" entfernen? Die Bilder bleiben, sie sind dann unsortiert.`)) return;
    try {
      const d = await api("/api/studio/kategorien?id=" + encodeURIComponent(id), { method: "DELETE" });
      setKategorien(d.kategorien || []);
      if (filter === id) setFilter("");
      laden();
      setMeldung(`„${titel}" entfernt. Die Bilder sind jetzt unsortiert.`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Ging nicht.");
    }
  };

  // ─── Das Modell ───
  //
  // In Schüben, weil ein Worker nicht ewig laufen darf: der Knopf hängt die
  // Runden aneinander und zeigt, wie weit er ist.
  const ansehenLassen = async () => {
    setLaeuft("ansehen"); setFehler("");
    try {
      for (let runde = 1; ; runde++) {
        setMeldung(`Runde ${runde} – das Modell sieht sich die nächsten Bilder an …`);
        const d = await api("/api/studio/beschreiben", {
          method: "POST", body: JSON.stringify({ offene: 6 }),
        });
        const geschafft = d.fertig || 0;
        setMeldung(`${geschafft} angesehen · noch ${d.offen} offen`);
        if (!d.offen) { setMeldung("Alle Bilder sind angesehen."); break; }
        // Nichts geschafft und trotzdem offen: Weitermachen bringt nichts.
        if (!geschafft) throw new Error(d.schief?.[0]?.fehler || "Es ging nicht weiter.");
      }
      await laden();
    } catch (e) {
      // Ohne das Leeren bliebe "Runde 1 …" unter der Fehlermeldung stehen und
      // sähe aus, als liefe noch etwas.
      setMeldung("");
      setFehler(e instanceof Error ? e.message : "Ging nicht.");
    } finally {
      setLaeuft("");
    }
  };

  const einsortieren = async () => {
    setLaeuft("sortieren"); setFehler("");
    try {
      const d = await api("/api/studio/zuordnen", {
        method: "POST", body: JSON.stringify({ wieviele: 60 }),
      });
      setMeldung(`${d.zugeordnet ?? 0} Bilder einsortiert.`);
      await laden();
    } catch (e) {
      setMeldung("");
      setFehler(e instanceof Error ? e.message : "Ging nicht.");
    } finally {
      setLaeuft("");
    }
  };

  // Erst die Anzeige umstellen, dann speichern: ein Herz, das eine halbe
  // Sekunde ueberlegt, fuehlt sich kaputt an. Geht es schief, springt es
  // zurueck und sagt warum.
  const herz = async (b: Bild) => {
    const neu = b.favorit ? 0 : 1;
    setBilder(liste => liste.map(x =>
      x.schluessel === b.schluessel ? { ...x, favorit: neu } : x));
    setGross(g => (g && g.schluessel === b.schluessel ? { ...g, favorit: neu } : g));
    try {
      await api("/api/studio/vorrat", {
        method: "POST",
        body: JSON.stringify({ schluessel: b.schluessel, favorit: neu }),
      });
    } catch (e) {
      setBilder(liste => liste.map(x =>
        x.schluessel === b.schluessel ? { ...x, favorit: b.favorit } : x));
      setGross(g => (g && g.schluessel === b.schluessel ? { ...g, favorit: b.favorit } : g));
      setFehler(e instanceof Error ? e.message : "Ging nicht.");
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

  // Was das Modell noch nicht gesehen hat, und was es gesehen hat, aber
  // keinem der angelegten Themen zugeordnet ist.
  const ohneBeschreibung = bilder.filter(b => !b.beschreibung).length;
  const ids = new Set(kategorien.map(k => k.id));
  const ohneThema = bilder.filter(b => b.beschreibung && !ids.has(b.motiv || "")).length;
  const unsortiert = bilder.filter(b => !b.motiv || b.motiv === "unsortiert").length;
  const favoriten = bilder.filter(b => b.favorit).length;
  const gezeigt = filter
    ? bilder.filter(b =>
        filter === "favorit" ? !!b.favorit
        : filter === "unsortiert" ? (!b.motiv || b.motiv === "unsortiert")
        : b.motiv === filter)
    : bilder;

  // Geblättert wird durch das, was gerade zu sehen ist – ist ein Thema
  // gefiltert, bleibt man darin. Alles andere wäre eine Überraschung.
  const stelle = gross ? gezeigt.findIndex(b => b.schluessel === gross.schluessel) : -1;

  // Als Funktionsdeklaration, damit der Tasten-Effekt weiter oben sie schon
  // kennt. Aufgerufen wird sie erst nach dem Rendern, dann steht "gezeigt".
  function blaettern(richtung: number) {
    if (stelle < 0) return;
    const ziel = stelle + richtung;
    if (ziel < 0 || ziel >= gezeigt.length) return;
    setGross(gezeigt[ziel]);
  }

  return (
    <AdminShell
      titel="Galerie"
      eyebrow="Instagram"
      lead="Deine Fotos — hinzufügen, ansehen, herausnehmen."
    >
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}


      {meldung && (
        <p className="mb-5 text-sm" style={{ color: "var(--accent)" }}>{meldung}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
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

        <button onClick={() => setNeuOffen(o => !o)} className="chip px-3 py-2 text-sm">
          <Plus size={14} /> Thema hinzufügen
        </button>

        {/* Ohne Beschreibung taucht ein Bild in keinem Vorschlag auf –
            deshalb steht die Zahl hier oben und nicht in einer Ecke. */}
        {ohneBeschreibung > 0 && (
          <button onClick={ansehenLassen} disabled={!!laeuft}
            className="chip px-3 py-2 text-sm disabled:opacity-60">
            <Sparkles size={14} />
            {laeuft === "ansehen" ? "Läuft…" : `${ohneBeschreibung} ansehen lassen`}
          </button>
        )}
        {ohneThema > 0 && (
          <button onClick={einsortieren} disabled={!!laeuft}
            className="chip px-3 py-2 text-sm disabled:opacity-60">
            <FolderTree size={14} />
            {laeuft === "sortieren" ? "Läuft…" : `${ohneThema} einsortieren`}
          </button>
        )}

        <span className="text-[var(--fg-subtle)] text-sm ml-auto">
          {bilder.length} {bilder.length === 1 ? "Bild" : "Bilder"} im Vorrat
        </span>
      </div>

      {neuOffen && (
        <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
          <input
            type="text" value={neuTitel} onChange={e => setNeuTitel(e.target.value)}
            maxLength={40} placeholder="Name, z. B. Kundenstimmen" autoFocus
            className="field px-3 py-2 text-sm" style={{ width: "14rem" }}
          />
          <input
            type="text" value={neuHinweis} onChange={e => setNeuHinweis(e.target.value)}
            maxLength={200}
            placeholder="Was gehört hinein? Ein Satz – daran erkennt es das Modell."
            className="field px-3 py-2 text-sm flex-1" style={{ minWidth: "18rem" }}
          />
          <button onClick={themaAnlegen} className="btn-primary px-4 py-2 text-sm">Anlegen</button>
          <button onClick={() => setNeuOffen(false)} className="chip px-3 py-2 text-sm">Abbrechen</button>
        </div>
      )}

      {/* Filterzeile: nebenbei sieht man, wovon zu wenig da ist. */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilter("")}
          className={`chip px-3 py-1.5 text-sm ${filter ? "" : "chip-aktiv"}`}
          style={filter ? undefined : { background: "var(--accent)", color: "#fff", borderColor: "transparent" }}>
          Alle <span className="opacity-70 ml-1">{bilder.length}</span>
        </button>
        {kategorien.map(k => {
          const n = bilder.filter(b => b.motiv === k.id).length;
          const an = filter === k.id;
          return (
            <span key={k.id} className="inline-flex items-center">
              <button onClick={() => setFilter(an ? "" : k.id)}
                className="chip px-3 py-1.5 text-sm"
                style={an ? { background: "var(--accent)", color: "#fff", borderColor: "transparent" } : undefined}>
                {k.titel} <span className="opacity-70 ml-1">{n}</span>
              </button>
              {!k.fest && (
                <button onClick={() => themaLoeschen(k.id, k.titel)}
                  aria-label={`Thema ${k.titel} entfernen`} title="Thema entfernen"
                  className="ml-1 opacity-50 hover:opacity-100">
                  <X size={13} />
                </button>
              )}
            </span>
          );
        })}
        {favoriten > 0 && (
          <button onClick={() => setFilter(filter === "favorit" ? "" : "favorit")}
            className="chip px-3 py-1.5 text-sm"
            style={filter === "favorit"
              ? { background: "#f2617a", color: "#fff", borderColor: "transparent" } : undefined}>
            <Heart size={13} fill="currentColor" style={{ color: filter === "favorit" ? "#fff" : "#f2617a" }} />
            <span className="opacity-70 ml-1">{favoriten}</span>
          </button>
        )}
        {unsortiert > 0 && (
          <button onClick={() => setFilter(filter === "unsortiert" ? "" : "unsortiert")}
            className="chip px-3 py-1.5 text-sm"
            style={filter === "unsortiert"
              ? { background: "var(--accent)", color: "#fff", borderColor: "transparent" } : undefined}>
            unsortiert <span className="opacity-70 ml-1">{unsortiert}</span>
          </button>
        )}
      </div>

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : gezeigt.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="inline-flex items-center justify-center mb-3" style={{ color: "var(--fg-subtle)" }}>
            <ImageOff size={28} />
          </div>
          <p className="text-[var(--fg-muted)]">
            {filter ? "Für dieses Thema liegt kein Bild vor." : "Noch keine Bilder in der Galerie."}
          </p>
          <p className="text-[var(--fg-subtle)] text-sm mt-1">
            JPG, PNG, WebP oder AVIF — bis 8 MB pro Bild.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {gezeigt.map(b => (
            <figure key={b.schluessel} className="card overflow-hidden flex flex-col">
              <div className="relative" style={{ aspectRatio: "1 / 1", background: "var(--surface-2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/bilder/${b.schluessel}`}
                  alt={b.quelle || "Galeriebild"}
                  loading="lazy"
                  onClick={() => setGross(b)}
                  className="w-full h-full object-cover block cursor-zoom-in"
                />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={() => herz(b)}
                    aria-label={b.favorit ? "Herz entfernen" : "Herz setzen"}
                    aria-pressed={!!b.favorit}
                    className="p-2 rounded-[8px] transition-colors"
                    style={{ background: "rgba(7,26,43,0.72)", color: b.favorit ? "#f2617a" : "#fff" }}
                  >
                    <Heart size={14} fill={b.favorit ? "#f2617a" : "none"} />
                  </button>
                  <button
                    onClick={() => loeschen(b.schluessel)}
                    aria-label="Bild löschen"
                    className="p-2 rounded-[8px] transition-colors"
                    style={{ background: "rgba(7,26,43,0.72)", color: "#fff" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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

      {/* Grossansicht. Die Kachel schneidet quadratisch zu – erst hier sieht
          man, was tatsaechlich auf dem Bild ist. Klick daneben oder Esc
          schliesst; das erwartet jeder, und ein Knopf allein reicht nicht. */}
      {gross && (
        <div
          onClick={() => setGross(null)}
          role="dialog"
          aria-modal="true"
          aria-label={gross.quelle || "Bild"}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-8"
          style={{ background: "rgba(7,26,43,0.88)" }}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={e => { e.stopPropagation(); herz(gross); }}
              aria-label={gross.favorit ? "Herz entfernen" : "Herz setzen"}
              aria-pressed={!!gross.favorit}
              className="p-2 rounded-[8px]"
              style={{ background: "rgba(255,255,255,0.12)", color: gross.favorit ? "#f2617a" : "#fff" }}
            >
              <Heart size={18} fill={gross.favorit ? "#f2617a" : "none"} />
            </button>
            <button
              onClick={() => setGross(null)}
              aria-label="Schließen"
              className="p-2 rounded-[8px]"
              style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
            >
              <X size={18} />
            </button>
          </div>

          <button
            onClick={e => { e.stopPropagation(); blaettern(-1); }}
            disabled={stelle <= 0}
            aria-label="Vorheriges Bild"
            className="absolute left-2 sm:left-4 p-3 rounded-full disabled:opacity-25"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            <ChevronLeft size={22} />
          </button>

          <button
            onClick={e => { e.stopPropagation(); blaettern(1); }}
            disabled={stelle < 0 || stelle >= gezeigt.length - 1}
            aria-label="Nächstes Bild"
            className="absolute right-2 sm:right-4 p-3 rounded-full disabled:opacity-25"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
          >
            <ChevronRight size={22} />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/bilder/${gross.schluessel}`}
            alt={gross.quelle || "Bild"}
            onClick={e => e.stopPropagation()}
            className="max-w-[calc(100%-6rem)] rounded-[10px]"
            style={{ maxHeight: "calc(100vh - 9rem)", objectFit: "contain", cursor: "default" }}
          />

          <div
            onClick={e => e.stopPropagation()}
            className="mt-3 text-center text-sm max-w-full px-2"
            style={{ color: "rgba(255,255,255,0.82)" }}
          >
            <div className="truncate">{gross.quelle || "Bild"}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
              {kategorien.find(k => k.id === gross.motiv)?.titel || "unsortiert"} · {datum(gross.angelegt)}
              {stelle >= 0 && ` · ${stelle + 1} von ${gezeigt.length}`}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
