import { ArrowRight, ChevronDown } from "lucide-react";

const tags = ["Gastronomie", "Café", "Friseur", "Autohaus", "Einzelhandel", "Handwerk"];

export default function Hero() {
  return (
    <section className="hero-bg surface-base relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="relative max-w-5xl mx-auto px-6 lg:px-8 text-center">
        <div className="badge px-3 py-1.5 text-sm mb-8 animate-fade-in-up">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
          Verfügbar für neue Projekte
        </div>

        <h1 className="display-h text-5xl md:text-7xl lg:text-[5.5rem] text-[var(--fg)] mb-6 leading-[1.05] animate-fade-in-up animation-delay-200">
          Websites für<br />
          <span className="accent-text">lokale Betriebe</span>
        </h1>

        <p className="text-lg md:text-xl text-[var(--fg-muted)] max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up animation-delay-400">
          Professionelle Webauftritte für Gastronomie, Einzelhandel, Dienstleister und Gewerbe — damit Ihre Kunden Sie online finden und unkompliziert Kontakt aufnehmen können.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-fade-in-up animation-delay-600">
          <a href="#leistungen" className="btn-primary px-6 py-3">
            Was ich anbiete <ArrowRight size={18} />
          </a>
          <a href="#kontakt" className="btn-ghost px-6 py-3">
            Kostenlos anfragen
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in-up animation-delay-600">
          {tags.map(t => (
            <span key={t} className="chip px-3 py-1 text-sm">{t}</span>
          ))}
        </div>
      </div>

      <a href="#leistungen" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors animate-bounce">
        <ChevronDown size={28} />
      </a>
    </section>
  );
}
