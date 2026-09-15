import { ArrowRight } from "lucide-react";

// Der Einstieg: nur eine Aussage ueber dem KI-Motiv und ein Weg weiter.
// Kein Absatz, keine Kacheln – lange Erklaerungen liest hier keiner. Die eigentlichen
// Leistungen stehen im Abschnitt darunter (Leistungen.tsx).

export default function Hero() {
  return (
    <section
      id="start"
      className="hero-bg surface-alt relative min-h-screen flex flex-col justify-center overflow-hidden pt-28 pb-16"
    >
      <div className="hero-photo" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full animate-fade-in-up">
        <div className="max-w-3xl">
          <span className="eyebrow inline-block mb-4">Websites für lokale Betriebe</span>
          <h1 className="display-h text-4xl md:text-6xl text-[var(--fg)] mb-6">
            Ihre Website.<br />
            <span className="accent-text">Von der Idee bis online – in Tagen.</span>
          </h1>
          <a href="#leistungen" className="btn-ghost px-6 py-3 text-sm">
            Leistungen ansehen <ArrowRight size={16} />
          </a>
        </div>

      </div>
    </section>
  );
}
