"use client";
import { useEffect, useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// GEO als eigener Abschnitt: Text links, die KI-Antwort rechts. Der
// Hintergrund ist ruhig (Raster, das zum Horizont verlaeuft, zwei langsam
// treibende Lichtflaechen). Die Bewegung steckt in der Antwort selbst: sie
// schreibt sich Zeichen fuer Zeichen, wie bei ChatGPT.

function bewegungReduziert() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Schreibt einen Text Zeichen fuer Zeichen; nach dem Ende bleibt er stehen,
// wird geleert und faengt von vorn an. Bei "weniger Bewegung" steht er sofort.
function useTippen(voll: string, aktiv: boolean, tempo = 22, pause = 7000) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!aktiv) { setN(0); return; }
    if (bewegungReduziert()) { setN(voll.length); return; }
    let i = 0; let t: ReturnType<typeof setTimeout>;
    const schritt = () => {
      i++; setN(i);
      if (i < voll.length) t = setTimeout(schritt, tempo + (voll[i - 1] === "." ? 260 : voll[i - 1] === "," ? 120 : 0));
      else t = setTimeout(() => { i = 0; setN(0); t = setTimeout(schritt, 600); }, pause);
    };
    t = setTimeout(schritt, 400);
    return () => clearTimeout(t);
  }, [voll, aktiv, tempo, pause]);
  return { text: voll.slice(0, n), fertig: n >= voll.length, laeuft: n > 0 && n < voll.length };
}

function GeoAnsicht() {
  const { t, sprache } = useSprache();
  const g = t.geo;
  // Die Frage erst, die Antwort danach – bei Sprachwechsel von vorn.
  const frage = useTippen(g.frage, true, 34, 999999);
  const antwort = useTippen(g.antwortName + g.antwort, frage.fertig, 18, 7000);
  const quellenSichtbar = antwort.fertig;

  return (
    <div className="mock-karte" aria-label={g.aria} key={sprache}>
      <div className="mock-kopf">
        <Sparkles size={14} /> {g.kopf}
      </div>
      <p className="mock-suche">
        {frage.text}{!frage.fertig && <span className="mock-cursor" aria-hidden="true" />}
      </p>
      <div className="mock-geo" style={{ minHeight: "5.5rem" }}>
        <p aria-live="off">
          {antwort.text.length <= g.antwortName.length
            ? <b>{antwort.text}</b>
            : <><b>{g.antwortName}</b>{antwort.text.slice(g.antwortName.length)}</>}
          {frage.fertig && !antwort.fertig && <span className="mock-cursor" aria-hidden="true" />}
        </p>
        <div className={`mock-quellen ${quellenSichtbar ? "sichtbar" : ""}`}>
          {g.quellen.map(q => <span key={q}>{q}</span>)}
        </div>
      </div>
    </div>
  );
}

export default function Geo() {
  const { t } = useSprache();
  return (
    <section id="geo" className="relative surface-alt py-24 overflow-hidden">
      <div className="geo-raster" aria-hidden="true" />
      <div className="geo-licht geo-licht-a" aria-hidden="true" />
      <div className="geo-licht geo-licht-b" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <span className="eyebrow inline-block mb-3">{t.geo.eyebrow}</span>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-4">{t.geo.titel}</h2>
            <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-6">{t.geo.text}</p>
            <ul className="space-y-2.5">
              {t.geo.punkte.map(p => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-[var(--fg)]">
                  <Check size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7"><GeoAnsicht /></div>
        </div>
      </div>
    </section>
  );
}
