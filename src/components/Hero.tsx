"use client";
import { ArrowRight } from "lucide-react";
import { GeoAnsicht } from "./Geo";
import { useSprache } from "@/lib/sprache";

// Der Einstieg: die GEO-Aussage als Titel, daneben die KI-Antwort, die sich
// selbst schreibt. Darunter ein Satz, dass alles mit der Website beginnt.

export default function Hero() {
  const { t } = useSprache();
  return (
    <section
      id="start"
      className="hero-bg surface-alt relative min-h-screen flex flex-col justify-center overflow-hidden pt-28 pb-16"
    >
      <div className="hero-photo" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full animate-fade-in-up">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-6">
            <span className="eyebrow inline-block mb-4">{t.hero.eyebrow}</span>
            <h1 className="display-h text-4xl md:text-6xl text-[var(--fg)] mb-6">{t.geo.titel}</h1>
            <p className="hero-sub text-[var(--fg-muted)] text-lg mb-8">{t.hero.unter}</p>
            <a href="#leistungen" className="btn-ghost px-6 py-3 text-sm">
              {t.hero.knopf} <ArrowRight size={16} />
            </a>
          </div>
          <div className="lg:col-span-6"><GeoAnsicht /></div>
        </div>
      </div>
    </section>
  );
}
