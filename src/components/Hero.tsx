"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { GeoAnsicht, geoDauer } from "./Geo";
import { LeistungZeile, ANZAHL_ANSICHTEN } from "./Leistungen";
import { useSprache } from "@/lib/sprache";

// Der Einstieg als Slider ueber vier Kapitel: GEO und die drei Leistungen,
// jeweils mit Bild. Alle Folien liegen uebereinander in derselben
// Rasterzelle – so bestimmt die hoechste die Hoehe und nichts springt beim
// Wechsel. Bei GEO laufen mehrere KI-Antworten nacheinander (jede so lange,
// wie sie zum Tippen braucht); bei den Leistungen wechselt alle 6 Sekunden
// die Ansicht. Nach dem letzten Schritt folgt das naechste Kapitel. Haelt beim
// Drueberfahren an. Pfeile oben mittig, die Kapitelreiter unten mittig.

const ANSICHT_DAUER = 6000;

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
  // Anzahl Schritte je Kapitel: GEO je Beispiel einer, Leistungen je Ansicht einer.
  const SCHRITTE = [t.geo.beispiele.length, ...ANZAHL_ANSICHTEN];
  const schritte = SCHRITTE[aktiv];
  const dauer = aktiv === 0 ? geoDauer(t.geo.beispiele[bild % t.geo.beispiele.length]) : ANSICHT_DAUER;

  useEffect(() => {
    if (pause) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const z = setTimeout(() => {
      if (bild + 1 < schritte) setBild(bild + 1);
      else { setAktiv((aktiv + 1) % anzahl); setBild(0); }
    }, dauer);
    return () => clearTimeout(z);
  }, [aktiv, bild, pause, anzahl, dauer, schritte]);

  const geheZu = (k: number) => { setAktiv((k + anzahl) % anzahl); setBild(0); };
  // Fortschrittsbalken fuellt pro Schritt den passenden Teil des Kapitels.
  const von = bild / SCHRITTE[aktiv], bis = (bild + 1) / SCHRITTE[aktiv];

  const folien = [
    <div key="geo" className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
      <div className="lg:col-span-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="icon-tile w-10 h-10"><Sparkles size={18} /></span>
          <span className="eyebrow">{t.geo.eyebrow}</span>
        </div>
        <h1 className="display-h slider-titel text-[var(--fg)] mb-4">{t.geo.titel}</h1>
        <p className="text-[var(--fg-muted)] leading-relaxed">{t.hero.unter}</p>
      </div>
      <div className="lg:col-span-7"><GeoAnsicht beispiel={aktiv === 0 ? bild : 0} aktiv={aktiv === 0} /></div>
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
