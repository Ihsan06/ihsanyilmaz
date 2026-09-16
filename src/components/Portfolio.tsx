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
    <section id="projekte" className="surface-tief py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-12">{p.titel}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {p.eintraege.map((e, i) => (
            <div key={e.titel} className="card group flex flex-col overflow-hidden">
              <div className="h-1.5" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
              <div className="flex flex-col flex-1 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="chip px-2.5 py-1 text-xs font-medium" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>{p.tags[META[i].tag]}</span>
                  <span className="chip px-2.5 py-1 text-xs font-medium">{p.status[META[i].status]}</span>
                </div>
                <h3 className="display-h text-lg font-semibold text-[var(--fg)] mb-3">{e.titel}</h3>
                <p className="text-[var(--fg-muted)] text-sm leading-relaxed flex-1 mb-6">{e.text}</p>
                <div className="flex flex-wrap gap-1.5">
                  {e.tech.map(x => <span key={x} className="chip px-2 py-0.5 text-xs font-medium">{x}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <a href="#kontakt" className="inline-flex items-center gap-2 font-medium transition-colors hover:opacity-80" style={{ color: "var(--accent)" }}>
            {p.anfragen} <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
