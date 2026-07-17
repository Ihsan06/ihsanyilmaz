import { Smile, Clock, Euro, CheckCircle } from "lucide-react";

const highlights = [
  { icon: Smile, title: "Persönlich & unkompliziert", text: "Kein Agentur-Overhead, keine langen Wartezeiten. Sie haben eine Ansprechperson — mich." },
  { icon: Clock, title: "Schnelle Umsetzung", text: "Ihre Website ist in der Regel innerhalb weniger Wochen fertig und online." },
  { icon: Euro, title: "Faire Preise", text: "Keine versteckten Kosten. Festpreise, die für kleine Betriebe passen." },
];

const values = [
  "Keine langen Vertragslaufzeiten",
  "Änderungen und Updates unkompliziert möglich",
  "Auch nach dem Launch erreichbar",
];

export default function About() {
  return (
    <section id="ueber-mich" className="surface-base py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Text */}
          <div>
            <span className="eyebrow inline-block mb-3">Über mich</span>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-8 leading-tight">
              Ihr Ansprechpartner<br />
              <span className="accent-text">aus Würzburg</span>
            </h2>

            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              {/* Bild mit Bildunterschrift */}
              <figure className="flex-shrink-0 w-48">
                <img
                  src="/ihsan.jpg?v=2"
                  alt="Ihsan Yilmaz — IT & Websites aus Würzburg"
                  className="rounded-[12px] object-cover"
                  style={{ width: 192, height: 192, border: "1px solid var(--border)" }}
                />
                <figcaption className="mt-3">
                  <div className="text-[var(--fg)] font-semibold leading-tight">Ihsan Yilmaz</div>
                  <div className="text-[var(--fg-subtle)] text-sm">IT &amp; Websites · Würzburg</div>
                </figcaption>
              </figure>

              {/* Text daneben */}
              <div>
                <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-4">
                  Ich bin Ihsan — IT-Fachmann aus Würzburg. Ich helfe lokalen Betrieben, online sichtbar zu werden und Zeit zu sparen: mit modernen Websites und smarten Funktionen, die dank KI-Tools heute bezahlbar sind.
                </p>
                <p className="text-[var(--fg-muted)] leading-relaxed">
                  Bei mir gibt es keinen Agentur-Overhead — nur eine Ansprechperson, die zuhört und pragmatisch umsetzt, was Ihrem Geschäft wirklich weiterhilft.
                </p>
              </div>
            </div>

            <ul className="space-y-3">
              {values.map(v => (
                <li key={v} className="flex items-start gap-3">
                  <CheckCircle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                  <span className="text-[var(--fg)] text-sm">{v}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Vorteile */}
          <div className="space-y-6">
            {highlights.map(h => (
              <div key={h.title} className="card flex gap-4 p-6">
                <div className="icon-tile flex-shrink-0 w-10 h-10">
                  <h.icon size={20} />
                </div>
                <div>
                  <h4 className="display-h font-semibold text-[var(--fg)] mb-1">{h.title}</h4>
                  <p className="text-[var(--fg-muted)] text-sm leading-relaxed">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
