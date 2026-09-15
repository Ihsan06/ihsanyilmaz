import { ArrowRight } from "lucide-react";

// Der Einstieg: eine Aussage ueber dem KI-Motiv, zwei Wege weiter, darunter
// vier kurze Versprechen. Kurz gehalten – lange Erklaerungen liest hier keiner. Die eigentlichen
// Leistungen stehen im Abschnitt darunter (Leistungen.tsx).
const ZAHLEN = [
  { wert: "Tage", text: "statt Monate – für Änderungen und neue Ideen" },
  { wert: "Idee zuerst", text: "KI ist der Beschleuniger, nicht der Ersatz" },
  { wert: "Instagram", text: "Beiträge aus Ihren Fotos, in Minuten geplant" },
  { wert: "Festpreis", text: "vorab, ohne Überraschungen" },
];

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
            <span className="accent-text">Ideen schneller online.</span>
          </h1>
          <p className="hero-sub text-[var(--fg-muted)] text-lg md:text-xl leading-relaxed max-w-xl mb-8">
            Ich baue Websites für lokale Betriebe – und setze Änderungen und neue Ideen mit KI
            in Tagen um. Die Idee muss gut sein. Das Tempo liefere ich.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#kontakt" className="btn-primary px-6 py-3 text-sm">
              Projekt anfragen <ArrowRight size={16} />
            </a>
            <a href="#leistungen" className="btn-ghost px-6 py-3 text-sm">
              Leistungen ansehen
            </a>
          </div>
        </div>

        <dl className="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-px rounded-[14px] overflow-hidden"
            style={{ background: "var(--border)" }}>
          {ZAHLEN.map(z => (
            <div key={z.wert} className="px-5 py-5" style={{ background: "rgba(10,15,20,0.72)", backdropFilter: "blur(6px)" }}>
              <dt className="display-h text-2xl md:text-3xl text-[var(--fg)]">{z.wert}</dt>
              <dd className="text-[var(--fg-muted)] text-sm mt-1.5 leading-snug">{z.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
