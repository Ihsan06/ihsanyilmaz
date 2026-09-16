"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GeoAnsicht } from "./Geo";
import { LeistungZeile, ANZAHL_ANSICHTEN } from "./Leistungen";
import { useSprache } from "@/lib/sprache";

// Der Einstieg als Slider ueber vier Kapitel: GEO und die drei Leistungen,
// jeweils mit Bild. Alle Folien liegen uebereinander in derselben
// Rasterzelle – so bestimmt die hoechste die Hoehe und nichts springt beim
// Wechsel. GEO steht 12 Sekunden; bei den Leistungen wechselt alle 6 Sekunden
// die Ansicht, nach der letzten folgt das naechste Kapitel. Haelt beim
// Drueberfahren an. Pfeile oben mittig, die Kapitelreiter unten mittig.

const GEO_DAUER = 12000;
const ANSICHT_DAUER = 6000;
// Anzahl Schritte je Kapitel: GEO einer, Leistungen je Ansicht einer.
const SCHRITTE = [1, ...ANZAHL_ANSICHTEN];

export default function Hero() {
  const { t } = useSprache();
  const [aktiv, setAktiv] = useState(0);
  const [bild, setBild] = useState(0);
  const [pause, setPause] = useState(false);

  const titel = [
    "GEO",
    ...t.leistungen.eintraege.map(l => l.eyebrow),
  ];
  const anzahl = titel.length;

  useEffect(() => {
    if (pause) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const z = setTimeout(() => {
      if (bild + 1 < SCHRITTE[aktiv]) setBild(bild + 1);
      else { setAktiv((aktiv + 1) % anzahl); setBild(0); }
    }, aktiv === 0 ? GEO_DAUER : ANSICHT_DAUER);
    return () => clearTimeout(z);
  }, [aktiv, bild, pause, anzahl]);

  const geheZu = (k: number) => { setAktiv((k + anzahl) % anzahl); setBild(0); };
  const dauer = aktiv === 0 ? GEO_DAUER : ANSICHT_DAUER;
  // Fortschrittsbalken fuellt pro Schritt den passenden Teil des Kapitels.
  const von = bild / SCHRITTE[aktiv], bis = (bild + 1) / SCHRITTE[aktiv];

  const folien = [
    <div key="geo" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      <div className="lg:col-span-6">
        <span className="eyebrow inline-block mb-4">{t.geo.eyebrow}</span>
        <h1 className="display-h text-4xl md:text-6xl text-[var(--fg)] mb-6">{t.geo.titel}</h1>
        <p className="hero-sub text-[var(--fg-muted)] text-lg">{t.hero.unter}</p>
      </div>
      <div className="lg:col-span-6"><GeoAnsicht /></div>
    </div>,
    ...t.leistungen.eintraege.map((l, i) => <LeistungZeile key={l.eyebrow} i={i} bild={aktiv === i + 1 ? bild : 0} onBild={setBild} />),
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
                  onClick={() => geheZu(aktiv - 1)}><ChevronLeft size={18} /></button>
          <button type="button" className="slider-pfeil" aria-label="Weiter"
                  onClick={() => geheZu(aktiv + 1)}><ChevronRight size={18} /></button>
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
                    className={aktiv === i ? "aktiv" : ""} onClick={() => geheZu(i)}>
              {name}
              <span className="slider-reiter-balken" aria-hidden="true">
                {aktiv === i && <i key={`${aktiv}-${bild}-${pause}`} style={{ animationDuration: `${dauer}ms`, animationPlayState: pause ? "paused" : "running", ["--von" as string]: von, ["--bis" as string]: bis }} />}
              </span>
            </button>
          ))}
        </div>

      </div>
    </section>
  );
}
