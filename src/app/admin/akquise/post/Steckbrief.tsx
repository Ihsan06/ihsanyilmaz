"use client";
import React, { useEffect, useState } from "react";
import { ExternalLink, Loader2, Shuffle, X } from "lucide-react";
import { api } from "@/components/admin/AdminShell";

// Steckbrief einer Website-Vorschau (functions/_lib/steckbrief.js): Farben,
// Logo-Zeichen, Marken, Beispielfahrzeuge. „Bauen“ laesst Claude die Texte
// neu schreiben, „Aussehen übernehmen“ behaelt sie und aendert nur den Rest.

type Palette = { schluessel: string; name: string; knopf: string; akzent: string };
type Symbol = { schluessel: string; name: string; pfad: string; zusatz?: string };
type Steckbrief = {
  palette: string; farben: { knopf: string; akzent: string }; website_farbe: string | null;
  logo: string; symbol: string; initialen: string; marken: string[]; fahrzeuge: string[]; mischung: number;
};
type Vorschau = { steckbrief: Steckbrief | null; fahrzeuge: { id: string; marke: string; modell: string; bild: string }[]; modell: string | null };
type Optionen = { paletten: Palette[]; symbole: Symbol[]; logo_arten: { schluessel: string; name: string }[] };

function Zeichen({ art, initialen, symbol, farbe }: { art: string; initialen: string; symbol?: Symbol; farbe: string }) {
  if (art === "schrift") return null;
  return (
    <span className="sb-zeichen" style={{ background: farbe }} aria-hidden="true">
      {art === "symbol" && symbol
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={symbol.pfad} />{symbol.zusatz && <path d={symbol.zusatz} />}</svg>
        : initialen}
    </span>
  );
}

export default function SteckbriefFenster({ betriebId, name, token, onZu, onGebaut }: {
  betriebId: number; name: string; token: string; onZu: () => void; onGebaut: (meldung: string) => void;
}) {
  const [optionen, setOptionen] = useState<Optionen | null>(null);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [palette, setPalette] = useState("website");
  const [logo, setLogo] = useState("monogramm");
  const [symbol, setSymbol] = useState("strasse");
  const [marken, setMarken] = useState("");
  const [arbeitet, setArbeitet] = useState<"" | "bauen" | "aussehen" | "mischen">("");
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    let weg = false;
    api(`/api/admin/akquise/vorschau?betrieb_id=${betriebId}`).then(d => {
      if (weg) return;
      setOptionen(d.optionen);
      const v = d.vorschau as Vorschau | null;
      setVorschau(v);
      const sb = v?.steckbrief;
      if (sb) {
        setPalette(sb.palette); setLogo(sb.logo); setSymbol(sb.symbol); setMarken(sb.marken.join(", "));
      } else {
        setMarken(String(d.marken_betrieb || "").split(/[;,]/).map((m: string) => m.trim()).filter(Boolean).join(", "));
      }
    }).catch(e => setFehler(String(e?.message || e)));
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    document.addEventListener("keydown", taste);
    return () => { weg = true; document.removeEventListener("keydown", taste); };
  }, [betriebId, onZu]);

  const sb = vorschau?.steckbrief;
  const vorhanden = !!sb;
  const initialen = sb?.initialen || name.split(/\s+/).filter(w => /^\p{L}/u.test(w)).slice(-2).map(w => w[0].toUpperCase()).join("");
  const paletteWahl = palette === "website" && sb?.website_farbe ? { knopf: sb.farben.knopf, akzent: sb.farben.akzent }
    : optionen?.paletten.find(p => p.schluessel === palette) || { knopf: "#1B6FA8", akzent: "#4DA3E0" };
  const symbolWahl = optionen?.symbole.find(s => s.schluessel === symbol);

  const senden = async (art: "bauen" | "aussehen" | "mischen") => {
    setArbeitet(art); setFehler("");
    try {
      const wunsch: Record<string, unknown> = {
        palette, logo, symbol,
        marken: marken.split(/[;,]/).map(m => m.trim()).filter(Boolean),
      };
      // Andere Marken oder „Andere Fahrzeuge“: neu ziehen, sonst dieselben behalten.
      const markenGleich = sb && sb.marken.join(",") === (wunsch.marken as string[]).join(",");
      if (art === "mischen") wunsch.mischung = (sb?.mischung || 0) + 1;
      else if (sb && markenGleich) wunsch.fahrzeuge = sb.fahrzeuge;
      const d = await api("/api/admin/akquise/vorschau", {
        method: "POST",
        body: JSON.stringify({ betrieb_id: betriebId, wunsch, texte: art === "bauen" ? "neu" : "behalten" }),
      });
      setVorschau(d.vorschau);
      if (d.vorschau?.steckbrief) setPalette(d.vorschau.steckbrief.palette);
      onGebaut(art === "bauen"
        ? (d.hinweis ? `Vorschau für ${name} gebaut. ${d.hinweis}` : `Vorschau für ${name} gebaut – 30 Tage gültig.`)
        : `Aussehen der Vorschau für ${name} gespeichert.`);
    } catch (e) { setFehler(String((e as Error)?.message || e)); }
    finally { setArbeitet(""); }
  };

  return (
    <div className="post-gross" role="dialog" aria-modal="true" aria-label={`Vorschau für ${name}`} onClick={onZu}>
      <div className="sb-fenster" onClick={e => e.stopPropagation()}>
        <button type="button" className="post-gross-zu" onClick={onZu} aria-label="Schließen"><X size={18} /></button>
        <h2>Website-Vorschau · {name}</h2>
        {!optionen ? <p className="mon-leer">{fehler || "Wird geladen…"}</p> : (
          <>
            <div className="sb-kopf" style={{ ["--sb-knopf" as string]: paletteWahl.knopf, ["--sb-akzent" as string]: paletteWahl.akzent }}>
              <Zeichen art={logo} initialen={initialen} symbol={symbolWahl} farbe={paletteWahl.knopf} />
              <span className="sb-name">{name}</span>
              <span className="sb-knopf-muster">Jetzt anrufen</span>
            </div>

            <div className="sb-feld">
              <span className="sb-label">Farben</span>
              <div className="sb-paletten">
                <button type="button" className={`sb-palette${palette === "website" ? " an" : ""}`} onClick={() => setPalette("website")}
                        title={sb?.website_farbe ? `Von der Website: ${sb.website_farbe}` : "Wird beim Bauen von der Website des Betriebs gelesen – ohne eigene Website: Nachtblau"}>
                  <i style={{ background: sb?.website_farbe || "conic-gradient(#B3262E, #1F7A4D, #1B6FA8, #B3262E)" }} />Von der Website
                </button>
                {optionen.paletten.map(p => (
                  <button key={p.schluessel} type="button" className={`sb-palette${palette === p.schluessel ? " an" : ""}`} onClick={() => setPalette(p.schluessel)}>
                    <i style={{ background: p.knopf }} />{p.name}
                  </button>
                ))}
              </div>
              {palette === "website" && sb && !sb.website_farbe && <p className="sb-hinweis">Auf der Website wurde keine eindeutige Farbe gefunden – es gilt Nachtblau.</p>}
            </div>

            <div className="sb-feld">
              <span className="sb-label">Zeichen neben dem Namen</span>
              <div className="sb-reihe">
                {optionen.logo_arten.map(a => (
                  <button key={a.schluessel} type="button" className={`akq-knopf${logo === a.schluessel ? " an" : ""}`} onClick={() => setLogo(a.schluessel)}>{a.name}</button>
                ))}
              </div>
              {logo === "symbol" && (
                <div className="sb-symbole">
                  {optionen.symbole.map(s => (
                    <button key={s.schluessel} type="button" className={`sb-symbol${symbol === s.schluessel ? " an" : ""}`} onClick={() => setSymbol(s.schluessel)} title={s.name}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={s.pfad} />{s.zusatz && <path d={s.zusatz} />}</svg>
                    </button>
                  ))}
                </div>
              )}
              <p className="sb-hinweis">Kein Nachbau des echten Logos – Name als Schriftzug, daneben Initialen oder ein eigenes Symbol.</p>
            </div>

            <label className="sb-feld">
              <span className="sb-label">Marken (für Fahrzeuge und Texte)</span>
              <input className="field px-3 py-2 text-sm" value={marken} onChange={e => setMarken(e.target.value)} placeholder="z. B. Renault, Dacia – leer: gemischter Bestand" />
            </label>

            {vorschau?.fahrzeuge?.length ? (
              <div className="sb-feld">
                <span className="sb-label">Beispielfahrzeuge</span>
                <div className="sb-autos">
                  {vorschau.fahrzeuge.map(f => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <figure key={f.id}><img src={f.bild} alt="" loading="lazy" /><figcaption>{f.marke} {f.modell}</figcaption></figure>
                  ))}
                </div>
              </div>
            ) : null}

            {fehler && <p className="post-fehlertext">{fehler}</p>}
            <div className="sb-knoepfe">
              <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={!!arbeitet} onClick={() => senden("bauen")}>
                {arbeitet === "bauen" ? <><Loader2 size={14} className="animate-spin" /> Claude schreibt … (bis ca. 30 s)</> : vorhanden ? "Neu bauen (neue Texte)" : "Vorschau bauen"}
              </button>
              {vorhanden && (
                <>
                  <button type="button" className="akq-knopf" disabled={!!arbeitet} onClick={() => senden("aussehen")}>
                    {arbeitet === "aussehen" ? <Loader2 size={13} className="animate-spin" /> : null} Aussehen übernehmen
                  </button>
                  <button type="button" className="akq-knopf" disabled={!!arbeitet} onClick={() => senden("mischen")} title="Andere Fahrzeuge derselben Marken ziehen">
                    {arbeitet === "mischen" ? <Loader2 size={13} className="animate-spin" /> : <Shuffle size={13} />} Andere Fahrzeuge
                  </button>
                  <a className="akq-knopf" href={`/fuer/${token}/website`} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Ansehen</a>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
