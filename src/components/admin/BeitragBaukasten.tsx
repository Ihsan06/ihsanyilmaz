"use client";
// Gestalten-Baukasten nach dem Vorbild des Diezmann-Adminbereichs — inklusive
// der Instagram-Nachbildung: Kopfzeile mit Profil, Bild, Aktions-Leiste,
// Caption mit „… mehr". Ein Textkasten sagt nicht, wie ein Beitrag wirkt —
// deshalb dieselbe Reihenfolge, dasselbe Seitenverhältnis, dieselbe Kürzung
// wie in der echten App.
//
// Das Bild wird auf ein Canvas gebacken (Text-Pille + AIY-Logo) und landet
// als fertiges JPG in der Galerie — von dort direkt postbar.
// Schalter und Stellungen überleben Formatwechsel und Neuladen (localStorage).
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImageIcon, Save, Send } from "lucide-react";
import { api } from "@/components/admin/AdminShell";

type Bild = { schluessel: string; dateiname: string | null; typ: string | null };

const FORMATE = [
  { wert: "beitrag", label: "Beitrag", b: 1080, h: 1350 },   // 4:5 — größte Feed-Fläche
  { wert: "story", label: "Story", b: 1080, h: 1920 },       // 9:16
] as const;

const SENKRECHT = ["oben", "mitte", "unten"] as const;
const WAAGRECHT = ["links", "mitte", "rechts"] as const;
const GROESSEN = [
  { wert: "s", label: "S", px: 40 },
  { wert: "m", label: "M", px: 54 },
  { wert: "l", label: "L", px: 72 },
] as const;

// Instagram zeigt vom Text nur den Anfang — was hinter „mehr" liegt,
// liest fast niemand. Die Kürzung gehört deshalb in die Vorschau.
const VORSCHAU_ZEICHEN = 125;

type Einstellungen = {
  format: "beitrag" | "story";
  textAn: boolean;
  text: string;
  textPos: string;
  groesse: "s" | "m" | "l";
  logoAn: boolean;
  logoPos: string;
};

const VORGABE: Einstellungen = {
  format: "beitrag", textAn: true, text: "", textPos: "unten-mitte",
  groesse: "m", logoAn: true, logoPos: "unten-rechts",
};

function gemerktLaden(): Einstellungen {
  try {
    const s = JSON.parse(localStorage.getItem("baukasten") || "{}");
    return { ...VORGABE, ...s };
  } catch { return VORGABE; }
}

export default function BeitragBaukasten({ onGespeichert }: { onGespeichert?: () => void }) {
  const [bilder, setBilder] = useState<Bild[]>([]);
  const [bildKey, setBildKey] = useState<string | null>(null);
  const [e, setE] = useState<Einstellungen>(VORGABE);
  const [caption, setCaption] = useState("");
  const [mehrOffen, setMehrOffen] = useState(false);
  const [laeuft, setLaeuft] = useState<"" | "speichern" | "posten" | "texten">("");
  const [meldung, setMeldung] = useState("");
  const [fehler, setFehler] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setE(gemerktLaden());
    api("/api/admin/bild").then(d => setBilder(d.bilder)).catch(err => setFehler(err.message));
  }, []);

  const setzen = (teil: Partial<Einstellungen>) => {
    setE(alt => {
      const neu = { ...alt, ...teil };
      try { localStorage.setItem("baukasten", JSON.stringify({ ...neu, text: undefined })); } catch { /* egal */ }
      return neu;
    });
  };

  // ─── Zeichnen ───

  const zeichnen = useCallback(() => {
    const c = canvasRef.current;
    const img = imgRef.current;
    if (!c) return;
    const f = FORMATE.find(x => x.wert === e.format)!;
    c.width = f.b; c.height = f.h;
    const g = c.getContext("2d")!;

    g.fillStyle = "#071A2B";
    g.fillRect(0, 0, f.b, f.h);
    if (img) {
      const skal = Math.max(f.b / img.width, f.h / img.height);
      const bw = img.width * skal, bh = img.height * skal;
      g.drawImage(img, (f.b - bw) / 2, (f.h - bh) / 2, bw, bh);
    }

    const rand = Math.round(f.b * 0.055);
    const posXY = (pos: string, elemB: number, elemH: number) => {
      const [v, h] = pos.split("-");
      const x = h === "links" ? rand : h === "rechts" ? f.b - rand - elemB : (f.b - elemB) / 2;
      const y = v === "oben" ? rand : v === "unten" ? f.h - rand - elemH : (f.h - elemH) / 2;
      return { x, y };
    };

    let pille: { x: number; y: number; b: number; h: number } | null = null;
    if (e.textAn && e.text.trim()) {
      const px = GROESSEN.find(x => x.wert === e.groesse)!.px;
      g.font = `600 ${px}px system-ui, -apple-system, sans-serif`;
      const breite = g.measureText(e.text.trim()).width;
      const pillB = breite + px * 1.2, pillH = px * 1.9;
      const { x, y } = posXY(e.textPos, pillB, pillH);
      g.fillStyle = "rgba(7,26,43,0.66)";
      g.beginPath();
      g.roundRect(x, y, pillB, pillH, pillH / 2);
      g.fill();
      g.fillStyle = "#FFFFFF";
      g.textBaseline = "middle";
      g.fillText(e.text.trim(), x + px * 0.6, y + pillH / 2 + px * 0.05);
      pille = { x, y, b: pillB, h: pillH };
    }

    if (e.logoAn) {
      const lB = Math.round(f.b * 0.16), lH = Math.round(lB * 0.52);
      let { x, y } = posXY(e.logoPos, lB, lH);
      // Kollidiert das Logo mit der Text-Pille, weicht es aus.
      if (pille && x < pille.x + pille.b && x + lB > pille.x && y < pille.y + pille.h && y + lH > pille.y) {
        const platz = Math.round(f.b * 0.02);
        y = e.logoPos.startsWith("oben") ? pille.y + pille.h + platz : pille.y - lH - platz;
      }
      g.font = `800 ${Math.round(lB * 0.42)}px system-ui, -apple-system, sans-serif`;
      g.textBaseline = "top";
      g.lineWidth = Math.max(2, lB * 0.02);
      g.strokeStyle = "rgba(7,26,43,0.5)";
      g.strokeText("AIY", x, y);
      g.fillStyle = "#FFFFFF";
      g.fillText("AIY", x, y);
      const tb = g.measureText("AIY").width;
      g.strokeStyle = "#3D7EA6";
      g.lineWidth = Math.max(3, lB * 0.035);
      g.beginPath();
      g.arc(x + tb / 2, y + lB * 0.30, tb * 0.55, 0.25 * Math.PI, 0.75 * Math.PI);
      g.stroke();
    }
  }, [e]);

  useEffect(() => {
    if (!bildKey) { imgRef.current = null; zeichnen(); return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; zeichnen(); };
    img.src = `/api/admin/bild?schluessel=${encodeURIComponent(bildKey)}`;
  }, [bildKey, zeichnen]);

  useEffect(() => { zeichnen(); }, [zeichnen]);

  // ─── Texten / Speichern / Posten ───

  const generieren = async () => {
    const thema = caption.trim() || e.text.trim();
    if (!thema) { setFehler("Erst kurz ein Thema in Caption oder Text eintippen."); return; }
    setFehler(""); setMeldung(""); setLaeuft("texten");
    try {
      const d = await api("/api/admin/texten", { method: "POST", body: JSON.stringify({ thema }) });
      setCaption(`${d.caption}\n\n${d.hashtags}`);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Vorschlag fehlgeschlagen.");
    } finally { setLaeuft(""); }
  };

  const alsJpg = (): Promise<File> =>
    new Promise((res, rej) => {
      canvasRef.current!.toBlob(b => {
        if (!b) return rej(new Error("Bild konnte nicht erzeugt werden."));
        const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        res(new File([b], `aiy-${e.format}-${stempel}.jpg`, { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    });

  const speichern = async (danachPosten: boolean) => {
    if (!bildKey) { setFehler("Bitte zuerst ein Bild wählen."); return; }
    setFehler(""); setMeldung("");
    setLaeuft(danachPosten ? "posten" : "speichern");
    try {
      const datei = await alsJpg();
      const form = new FormData();
      form.append("datei", datei);
      const res = await fetch("/api/admin/bild", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Speichern fehlgeschlagen.");

      if (danachPosten) {
        await api("/api/admin/instagram", {
          method: "POST",
          body: JSON.stringify({ schluessel: d.schluessel, caption }),
        });
        setMeldung("✓ Veröffentlicht auf @aiy.web!");
      } else {
        setMeldung(e.format === "story"
          ? "✓ In der Galerie gespeichert — Stories postest du daraus in der Instagram-App."
          : "✓ In der Galerie gespeichert.");
      }
      onGespeichert?.();
      await api("/api/admin/bild").then(x => setBilder(x.bilder)).catch(() => {});
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Fehlgeschlagen.");
    } finally {
      setLaeuft("");
    }
  };

  // ─── Oberfläche ───

  const stellenWahl = (wert: string, aufWert: (p: string) => void, name: string) => {
    const [v0, h0] = wert.split("-");
    const reihe = (liste: readonly string[], achse: "v" | "h", aktiv: string) =>
      liste.map(w => (
        <button key={w} type="button"
          onClick={() => aufWert(achse === "v" ? `${w}-${h0}` : `${v0}-${w}`)}
          className="px-2 py-1 rounded-[6px] text-xs transition-colors"
          style={w === aktiv
            ? { background: "var(--accent)", color: "#fff" }
            : { background: "var(--surface-2)", color: "var(--fg-muted)" }}
          aria-label={`${name}: ${w}`}
        >
          {{ oben: "↑", mitte: "•", unten: "↓", links: "←", rechts: "→" }[w]}
        </button>
      ));
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-flex gap-0.5">{reihe(SENKRECHT, "v", v0)}</span>
        <b className="text-[var(--fg-subtle)] text-xs">×</b>
        <span className="inline-flex gap-0.5">{reihe(WAAGRECHT, "h", h0)}</span>
      </span>
    );
  };

  const f = FORMATE.find(x => x.wert === e.format)!;
  const sichtbar = caption.slice(0, VORSCHAU_ZEICHEN);
  const rest = caption.slice(VORSCHAU_ZEICHEN);

  return (
    <div className="mb-8">
      {/* Reiter wie bei Diezmann: Beitrag | Story */}
      <div className="flex gap-2 mb-5">
        {FORMATE.map(x => (
          <button key={x.wert} onClick={() => setzen({ format: x.wert })}
            className="chip px-4 py-1.5 text-sm font-medium"
            style={e.format === x.wert
              ? { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" }
              : undefined}>
            {x.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* ─── Linke Spalte: Werkzeuge ─── */}
        <div className="space-y-5">
          {/* Bildwahl */}
          <div>
            <div className="text-sm text-[var(--fg-muted)] mb-2 flex items-center gap-2">
              <ImageIcon size={15} /> Bild aus der Galerie
            </div>
            {bilder.length === 0 ? (
              <p className="text-[var(--fg-subtle)] text-sm">Galerie ist leer — erst unter Galerie Bilder hochladen.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-52 overflow-y-auto pr-1">
                {bilder.filter(b => b.typ === "image/jpeg").map(b => (
                  <button key={b.schluessel} onClick={() => setBildKey(b.schluessel)}
                    className="relative rounded-[6px] overflow-hidden border-2"
                    style={{ aspectRatio: "1/1", borderColor: bildKey === b.schluessel ? "var(--accent)" : "transparent" }}
                    title={b.dateiname || ""}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/admin/bild?schluessel=${encodeURIComponent(b.schluessel)}`}
                      alt="" loading="lazy" className="w-full h-full object-cover block" />
                    {bildKey === b.schluessel && (
                      <span className="absolute top-1 right-1 rounded-full p-0.5"
                        style={{ background: "var(--accent)", color: "#fff" }}><Check size={10} /></span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text aufs Bild */}
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--fg)]">
                <input type="checkbox" checked={e.textAn}
                  onChange={ev => setzen({ textAn: ev.target.checked })} />
                Text im Bild
              </label>
              <span className="inline-flex gap-0.5">
                {GROESSEN.map(gr => (
                  <button key={gr.wert} onClick={() => setzen({ groesse: gr.wert })}
                    className="px-2 py-1 rounded-[6px] text-xs"
                    style={e.groesse === gr.wert
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--surface-2)", color: "var(--fg-muted)" }}>
                    {gr.label}
                  </button>
                ))}
              </span>
              {stellenWahl(e.textPos, p => setzen({ textPos: p }), "Text")}
            </div>
            <input value={e.text} onChange={ev => setzen({ text: ev.target.value })}
              disabled={!e.textAn}
              placeholder="z. B. Websites für lokale Betriebe"
              className="field px-4 py-2.5 text-sm disabled:opacity-50" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--fg)]">
                <input type="checkbox" checked={e.logoAn}
                  onChange={ev => setzen({ logoAn: ev.target.checked })} />
                AIY-Logo
              </label>
              {stellenWahl(e.logoPos, p => setzen({ logoPos: p }), "Logo")}
            </div>
          </div>

          {/* Caption */}
          {e.format === "beitrag" && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--fg-muted)]">Caption</label>
                <button type="button" onClick={generieren} disabled={laeuft !== ""}
                  className="btn-primary px-3.5 py-1.5 text-xs disabled:opacity-50">
                  ✨ {laeuft === "texten" ? "Schreibt…" : "Beitrag generieren"}
                </button>
              </div>
              <textarea rows={5} value={caption} onChange={ev => setCaption(ev.target.value)}
                placeholder="Text + #hashtags — oder Thema eintippen und ✨ Beitrag generieren drücken"
                className="field px-4 py-2.5 text-sm resize-none" />
            </div>
          )}

          {fehler && <p className="text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}
          {meldung && <p className="text-sm" style={{ color: "var(--accent)" }}>{meldung}</p>}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => speichern(false)} disabled={!bildKey || laeuft !== ""}
              className="btn-ghost px-4 py-2 text-sm disabled:opacity-50">
              <Save size={15} /> {laeuft === "speichern" ? "Speichert…" : "In Galerie speichern"}
            </button>
            {e.format === "beitrag" && (
              <button onClick={() => speichern(true)} disabled={!bildKey || laeuft !== ""}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                <Send size={15} /> {laeuft === "posten" ? "Wird veröffentlicht…" : "Jetzt auf Instagram posten"}
              </button>
            )}
          </div>
        </div>

        {/* ─── Rechte Spalte: Instagram-Nachbildung ─── */}
        <div className="w-full max-w-[380px] mx-auto lg:mx-0 rounded-[12px] overflow-hidden border"
          style={{
            background: "var(--surface)", borderColor: "var(--border)",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}>
          {/* Kopf */}
          <div className="flex items-center gap-[9px] px-3 py-2.5">
            <span className="flex items-center justify-center rounded-full shrink-0 font-bold"
              style={{ width: 30, height: 30, background: "#071A2B", color: "#fff", fontSize: "0.55rem" }}>
              AIY
            </span>
            <span className="flex flex-col leading-tight mr-auto min-w-0">
              <b className="text-[0.8rem] text-[var(--fg)]">aiy.web</b>
              <span className="text-[0.7rem] text-[var(--fg-subtle)]">Würzburg</span>
            </span>
            <span className="text-[var(--fg-subtle)] tracking-widest">···</span>
          </div>

          {/* Bild = Canvas */}
          <div className="relative overflow-hidden"
            style={{ aspectRatio: `${f.b} / ${f.h}`, background: "var(--surface-2)" }}>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block"
              aria-label="Vorschau des Beitrags" />
            {!bildKey && (
              <span className="absolute inset-0 flex items-center justify-center text-[0.78rem] text-[var(--fg-subtle)]">
                Bild wählen
              </span>
            )}
          </div>

          {e.format === "beitrag" ? (
            <>
              {/* Aktions-Leiste */}
              <div className="flex items-center gap-3.5 px-3 pt-3 pb-1.5 text-[var(--fg)]">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20.8 8.6c0 4.5-8.8 9.4-8.8 9.4s-8.8-4.9-8.8-9.4a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8z" /></svg>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.5-.7L3 21l1.9-5.1A8.2 8.2 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" /></svg>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z" /></svg>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" className="ml-auto"><path d="M18 21l-6-4.4L6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21z" /></svg>
              </div>

              {/* Caption mit „… mehr" — dieselbe Kürzung wie in der App */}
              <p className="m-0 px-3 pt-0.5 text-[0.82rem] leading-[1.45] text-[var(--fg)]">
                <b className="mr-1.5">aiy.web</b>
                <span className="whitespace-pre-wrap">{mehrOffen ? caption : sichtbar}</span>
                {rest && !mehrOffen && (
                  <span className="text-[var(--fg-subtle)] cursor-pointer"
                    onClick={() => setMehrOffen(true)}>… mehr</span>
                )}
              </p>
              <p className="m-0 px-3 pt-2 pb-3 text-[0.7rem] text-[var(--fg-subtle)] uppercase tracking-wide">
                Vorschau
              </p>
            </>
          ) : (
            <p className="m-0 px-3 py-2.5 text-[0.75rem] text-[var(--fg-subtle)]">
              Story-Vorschau — speichern und in der Instagram-App posten.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
