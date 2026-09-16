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

// Schreibt einen Text Zeichen fuer Zeichen und bleibt am Ende stehen.
// Bei "weniger Bewegung" steht er sofort.
const TEMPO_FRAGE = 30, TEMPO_ANTWORT = 14, START = 400, HALTEN = 3500;
const extra = (z: string) => (z === "." ? 260 : z === "," ? 120 : 0);

function useTippen(voll: string, aktiv: boolean, tempo: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!aktiv) { setN(0); return; }
    if (bewegungReduziert()) { setN(voll.length); return; }
    let i = 0; let t: ReturnType<typeof setTimeout>;
    const schritt = () => {
      i++; setN(i);
      if (i < voll.length) t = setTimeout(schritt, tempo + extra(voll[i - 1]));
    };
    t = setTimeout(schritt, START);
    return () => clearTimeout(t);
  }, [voll, aktiv, tempo]);
  return { text: voll.slice(0, n), fertig: n >= voll.length };
}

type Beispiel = { frage: string; name: string; antwort: string; quellen: string[] };

const tippDauer = (text: string, tempo: number) =>
  START + [...text].reduce((summe, z) => summe + tempo + extra(z), 0);

// Wie lange ein Beispiel steht: Frage tippen, Antwort tippen, kurz stehen lassen.
export function geoDauer(b: Beispiel) {
  return tippDauer(b.frage, TEMPO_FRAGE) + tippDauer(b.name + b.antwort, TEMPO_ANTWORT) + HALTEN;
}

// Die KI-Antwort: mehrere Beispiele aus verschiedenen Branchen. Welches gerade
// laeuft, steuert der Slider (Hero.tsx) ueber "beispiel".
export function GeoAnsicht({ beispiel = 0, aktiv = true }: { beispiel?: number; aktiv?: boolean }) {
  const { t, sprache } = useSprache();
  const g = t.geo;
  const b = g.beispiele[beispiel % g.beispiele.length];
  return (
    <div className="mock-karte" aria-label={g.aria}>
      <div className="mock-kopf">
        <Sparkles size={14} /> {g.kopf}
        <span className="mock-zaehler" aria-hidden="true">
          {g.beispiele.map((_, n) => <i key={n} className={n === beispiel ? "aktiv" : ""} />)}
        </span>
      </div>
      <GeoBeispiel key={`${sprache}-${beispiel}-${aktiv}`} b={b} aktiv={aktiv} />
    </div>
  );
}

function GeoBeispiel({ b, aktiv }: { b: Beispiel; aktiv: boolean }) {
  // Die Frage erst, die Antwort danach.
  const frage = useTippen(b.frage, aktiv, TEMPO_FRAGE);
  const antwort = useTippen(b.name + b.antwort, aktiv && frage.fertig, TEMPO_ANTWORT);
  return (
    <>
      <p className="mock-suche">
        {frage.text}{!frage.fertig && <span className="mock-cursor" aria-hidden="true" />}
      </p>
      <div className="mock-geo" style={{ minHeight: "5.5rem" }}>
        <p aria-live="off">
          {antwort.text.length <= b.name.length
            ? <b>{antwort.text}</b>
            : <><b>{b.name}</b>{antwort.text.slice(b.name.length)}</>}
          {frage.fertig && !antwort.fertig && <span className="mock-cursor" aria-hidden="true" />}
        </p>
        <div className={`mock-quellen ${antwort.fertig ? "sichtbar" : ""}`}>
          {b.quellen.map(q => <span key={q}>{q}</span>)}
        </div>
      </div>
    </>
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
