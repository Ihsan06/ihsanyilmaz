"use client";
import { ArrowRight } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// Der Einstieg: nur eine Aussage ueber dem KI-Motiv und ein Weg weiter.
// Kein Absatz, keine Kacheln – lange Erklaerungen liest hier keiner.

export default function Hero() {
  const { t } = useSprache();
  return (
    <section
      id="start"
      className="hero-bg surface-alt relative min-h-screen flex flex-col justify-center overflow-hidden pt-28 pb-16"
    >
      <div className="hero-photo" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full animate-fade-in-up">
        <div className="max-w-3xl">
          <span className="eyebrow inline-block mb-4">{t.hero.eyebrow}</span>
          <h1 className="display-h text-4xl md:text-6xl text-[var(--fg)] mb-6">
            {t.hero.titel1}<br />
            <span className="accent-text">{t.hero.titel2}</span>
          </h1>
          <a href="#leistungen" className="btn-ghost px-6 py-3 text-sm">
            {t.hero.knopf} <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
