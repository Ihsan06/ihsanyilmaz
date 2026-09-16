"use client";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// Die Autohaus-Demo zum Ausprobieren. Die Website ist offen verlinkt. Den
// Verwaltungsbereich gibt es nur auf Anfrage: er hat in der Demo kein Passwort,
// Fremde koennten dort Daten aendern und KI-Aufrufe ausloesen. Deshalb fuehrt
// diese Kachel zum Kontaktformular und der Link geht persoenlich raus.

const EINSTIEGE = [
  { href: "https://autohaus-demo.pages.dev/", bild: "web-start", extern: true },
  { href: "#kontakt", bild: "adm-uebersicht", extern: false },
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {d.eintraege.map((e, i) => {
            const x = EINSTIEGE[i];
            const Pfeil = x.extern ? ArrowUpRight : ArrowRight;
            return (
              <a key={e.titel} href={x.href}
                 {...(x.extern ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                 className="card demo-kachel group flex flex-col overflow-hidden">
                <div className="demo-bild">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/leistungen/${x.bild}.jpg?v=3`} alt={e.titel} loading="lazy" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 p-5">
                  <div>
                    <h3 className="display-h text-lg font-semibold text-[var(--fg)] mb-1">{e.titel}</h3>
                    <p className="text-[var(--fg-muted)] text-sm leading-relaxed">{e.text}</p>
                  </div>
                  <span className={`${x.extern ? "btn-primary" : "demo-knopf-zweit"} self-start sm:self-auto shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-4 py-2 text-sm`}>
                    {e.knopf} <Pfeil size={15} />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
