"use client";
import { useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// Projekte als eine Zeile zum Wischen/Scrollen: Kacheln rasten ein, die
// Pfeile schieben um eine Kachel weiter. Tag und Status je Projekt stehen
// hier, die Texte in lib/texte.ts (gleiche Reihenfolge).
const META: { tag: "web" | "automatisierung"; status: "online" | "inArbeit" }[] = [
  { tag: "web", status: "online" },            // Autohaus
  { tag: "web", status: "inArbeit" },          // Café
  { tag: "web", status: "inArbeit" },          // Planungsbuero
  { tag: "automatisierung", status: "online" },// Instagram
  { tag: "web", status: "inArbeit" },          // Mietwagen
];

export default function Portfolio() {
  const { t } = useSprache();
  const p = t.projekte;
  const leiste = useRef<HTMLDivElement>(null);

  const schieben = (richtung: 1 | -1) => {
    const el = leiste.current; if (!el) return;
    const kachel = el.querySelector<HTMLElement>(".projekt-kachel");
    el.scrollBy({ left: richtung * ((kachel?.offsetWidth ?? 300) + 16), behavior: "smooth" });
  };

  return (
    <section id="projekte" className="surface-tief py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="relative flex items-end justify-between gap-4 mb-8">
          <h2 className="display-h text-3xl md:text-4xl text-[var(--fg)]">{p.titel}</h2>
          <div className="flex gap-2 md:absolute md:left-1/2 md:-translate-x-1/2 md:bottom-0">
            <button type="button" className="slider-pfeil" aria-label="Zurück" onClick={() => schieben(-1)}><ChevronLeft size={18} /></button>
            <button type="button" className="slider-pfeil" aria-label="Weiter" onClick={() => schieben(1)}><ChevronRight size={18} /></button>
          </div>
        </div>

        <div ref={leiste} className="projekt-leiste">
          {p.eintraege.map((e, i) => (
            <div key={e.titel} className="projekt-kachel card group flex flex-col overflow-hidden">
              <div className="h-1" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
              <div className="flex flex-col flex-1 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="chip px-2 py-0.5 text-[0.7rem] font-medium" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>{p.tags[META[i]?.tag ?? "web"]}</span>
                  <span className="chip px-2 py-0.5 text-[0.7rem] font-medium">{p.status[META[i]?.status ?? "inArbeit"]}</span>
                </div>
                <h3 className="display-h text-base font-semibold text-[var(--fg)] mb-2">{e.titel}</h3>
                <p className="text-[var(--fg-muted)] text-[0.82rem] leading-relaxed flex-1 mb-3">{e.text}</p>
                <div className="flex flex-wrap gap-1">
                  {e.tech.slice(0, 3).map(x => <span key={x} className="chip px-2 py-0.5 text-[0.68rem] font-medium">{x}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <a href="#kontakt" className="inline-flex items-center gap-2 font-medium transition-colors hover:opacity-80" style={{ color: "var(--accent)" }}>
            {p.anfragen} <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
