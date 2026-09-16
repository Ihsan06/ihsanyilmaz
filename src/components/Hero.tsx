"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GeoAnsicht } from "./Geo";
import { LeistungZeile } from "./Leistungen";
import { useSprache } from "@/lib/sprache";

// Der Einstieg als Slider ueber vier Kapitel: GEO und die drei Leistungen,
// jeweils mit Bild. Alle Folien liegen uebereinander in derselben
// Rasterzelle – so bestimmt die hoechste die Hoehe und nichts springt beim
// Wechsel. Laeuft alle 8 Sekunden weiter, haelt beim Drueberfahren an.
// Pfeile oben mittig, die Kapitelreiter unten mittig.

const DAUER = 8000;

export default function Hero() {
  const { t } = useSprache();
  const [aktiv, setAktiv] = useState(0);
  const [pause, setPause] = useState(false);

  const titel = [
    "GEO",
    ...t.leistungen.eintraege.map(l => l.eyebrow),
  ];
  const anzahl = titel.length;

  useEffect(() => {
    if (pause) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const z = setTimeout(() => setAktiv(a => (a + 1) % anzahl), DAUER);
    return () => clearTimeout(z);
  }, [aktiv, pause, anzahl]);

  const folien = [
    <div key="geo" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      <div className="lg:col-span-6">
        <span className="eyebrow inline-block mb-4">{t.geo.eyebrow}</span>
        <h1 className="display-h text-4xl md:text-6xl text-[var(--fg)] mb-6">{t.geo.titel}</h1>
        <p className="hero-sub text-[var(--fg-muted)] text-lg">{t.hero.unter}</p>
      </div>
      <div className="lg:col-span-6"><GeoAnsicht /></div>
    </div>,
    ...t.leistungen.eintraege.map((l, i) => <LeistungZeile key={l.eyebrow} i={i} />),
  ];

  return (
    <section
      id="leistungen"
      className="hero-bg surface-alt relative min-h-screen flex flex-col justify-center overflow-hidden pt-28 pb-12"
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
    >
      <div className="hero-photo" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">
        <div className="flex items-center justify-center gap-3 mb-8">
          <button type="button" className="slider-pfeil" aria-label="Zurück"
                  onClick={() => setAktiv(a => (a - 1 + anzahl) % anzahl)}><ChevronLeft size={18} /></button>
          <button type="button" className="slider-pfeil" aria-label="Weiter"
                  onClick={() => setAktiv(a => (a + 1) % anzahl)}><ChevronRight size={18} /></button>
        </div>

        {/* Folien uebereinander */}
        <div className="slider-buehne">
          {folien.map((f, i) => (
            <div key={i} className={`slider-folie ${aktiv === i ? "aktiv" : ""}`} aria-hidden={aktiv !== i}>
              {f}
            </div>
          ))}
        </div>

        {/* Kapitelreiter unten, mittig */}
        <div className="slider-reiter" role="tablist" aria-label={t.leistungen.titel}>
          {titel.map((name, i) => (
            <button key={name} type="button" role="tab" aria-selected={aktiv === i}
                    className={aktiv === i ? "aktiv" : ""} onClick={() => setAktiv(i)}>
              {name}
              <span className="slider-reiter-balken" aria-hidden="true">
                {aktiv === i && <i key={`${aktiv}-${pause}`} style={{ animationDuration: `${DAUER}ms`, animationPlayState: pause ? "paused" : "running" }} />}
              </span>
            </button>
          ))}
        </div>

      </div>
    </section>
  );
}
