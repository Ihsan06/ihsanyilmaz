"use client";
import { ArrowUpRight } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// Die Autohaus-Demo zum Selbst-Ausprobieren: vier Einstiege als Kacheln mit
// Bild, jede oeffnet die Demo in einem neuen Tab. Die Bilder sind dieselben
// Screenshots wie im Slider (public/leistungen).

const DEMO = "https://autohaus-demo.pages.dev";
const EINSTIEGE = [
  { href: `${DEMO}/`, bild: "web-start" },
  { href: `${DEMO}/admin/`, bild: "adm-uebersicht" },
  { href: `${DEMO}/admin/content.html`, bild: "ki-content" },
  { href: `${DEMO}/admin/website.html`, bild: "ki-website" },
];

export default function Demo() {
  const { t } = useSprache();
  const d = t.demo;
  return (
    <section id="demo" className="surface-base py-20">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <span className="eyebrow inline-block mb-3">{d.eyebrow}</span>
          <h2 className="display-h text-3xl md:text-4xl text-[var(--fg)] mb-4">{d.titel}</h2>
          <p className="text-[var(--fg-muted)] text-lg leading-relaxed">{d.text}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {d.eintraege.map((e, i) => (
            <a key={e.titel} href={EINSTIEGE[i].href} target="_blank" rel="noopener noreferrer"
               className="card demo-kachel group flex flex-col overflow-hidden">
              <div className="demo-bild">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/leistungen/${EINSTIEGE[i].bild}.jpg?v=3`} alt={e.titel} loading="lazy" />
              </div>
              <div className="flex flex-col flex-1 p-4">
                <h3 className="display-h text-base font-semibold text-[var(--fg)] mb-1">{e.titel}</h3>
                <p className="text-[var(--fg-muted)] text-[0.82rem] leading-relaxed flex-1 mb-3">{e.text}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: "var(--accent)" }}>
                  {d.oeffnen} <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
