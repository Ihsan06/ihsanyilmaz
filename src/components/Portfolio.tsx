"use client";
import { ArrowRight } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// Tag und Status je Projekt – die Texte dazu kommen aus lib/texte.ts.
const META: { tag: "web" | "automatisierung"; status: "online" | "inArbeit" }[] = [
  { tag: "web", status: "online" },
  { tag: "web", status: "inArbeit" },
  { tag: "automatisierung", status: "online" },
  { tag: "web", status: "inArbeit" },
];

export default function Portfolio() {
  const { t } = useSprache();
  const p = t.projekte;
  return (
    <section id="projekte" className="surface-tief py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h2 className="display-h text-3xl md:text-4xl text-[var(--fg)] mb-8">{p.titel}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {p.eintraege.map((e, i) => (
            <div key={e.titel} className="card group flex flex-col overflow-hidden">
              <div className="h-1" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
              <div className="flex flex-col flex-1 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="chip px-2 py-0.5 text-[0.7rem] font-medium" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>{p.tags[META[i].tag]}</span>
                  <span className="chip px-2 py-0.5 text-[0.7rem] font-medium">{p.status[META[i].status]}</span>
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
