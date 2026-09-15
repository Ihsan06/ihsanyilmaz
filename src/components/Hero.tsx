import { ArrowRight } from "lucide-react";

// Der Einstieg: eine klare Aussage ueber dem KI-Motiv, zwei Wege weiter,
// darunter vier Zahlen, die den Nutzen greifbar machen. Die eigentlichen
// Leistungen stehen im Abschnitt darunter (Leistungen.tsx).
const ZAHLEN = [
  { wert: "3 von 4", text: "Google-Suchen in Deutschland zeigen heute eine KI-Antwort" },
  { wert: "24/7", text: "Ihr KI-Assistent beantwortet Anfragen – auch nachts" },
  { wert: "Wochen", text: "statt Monate, bis Ihre Website online ist" },
  { wert: "Festpreis", text: "vorab vereinbart, ohne Überraschungen" },
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
          <span className="eyebrow inline-block mb-4">Websites · KI-Assistenten · GEO — für lokale Betriebe</span>
          <h1 className="display-h text-4xl md:text-6xl text-[var(--fg)] mb-6">
            Gefunden werden.<br />
            <span className="accent-text">Auch von der KI.</span>
          </h1>
          <p className="hero-sub text-[var(--fg-muted)] text-lg md:text-xl leading-relaxed max-w-2xl mb-8">
            Ich baue smarte Websites mit eigenem Verwaltungsbereich, KI-Assistenten, die Anfragen
            rund um die Uhr beantworten – und sorge dafür, dass Ihr Betrieb dort auftaucht, wo heute
            gesucht wird: bei Google, ChatGPT &amp; Co.
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
