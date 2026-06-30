import { Smile, Clock, Euro, CheckCircle } from "lucide-react";

const highlights = [
  { icon: Smile, title: "Persönlich & unkompliziert", text: "Kein Agentur-Overhead, keine langen Wartezeiten. Sie haben eine Ansprechperson — mich." },
  { icon: Clock, title: "Schnelle Umsetzung", text: "Ihre Website ist in der Regel innerhalb weniger Wochen fertig und online." },
  { icon: Euro, title: "Faire Preise", text: "Keine versteckten Kosten. Festpreise, die für kleine Betriebe passen." },
];

const values = [
  "Ich melde mich innerhalb von 24 Stunden",
  "Keine langen Vertragslaufzeiten",
  "Änderungen und Updates unkompliziert möglich",
  "Auch nach dem Launch erreichbar",
];

export default function About() {
  return (
    <section id="ueber-mich" className="surface-base py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="eyebrow inline-block mb-3">Über mich</span>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-6 leading-tight">
              Ihr Ansprechpartner<br />
              <span className="accent-text">für Ihre Website</span>
            </h2>
            <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-6">
              Ich bin Ihsan, Webentwickler aus Leidenschaft. Ich helfe lokalen Betrieben dabei, online sichtbar zu werden — mit einer Website, die zu Ihrem Geschäft passt und bei der Ihre Kunden alles finden, was sie brauchen.
            </p>
            <p className="text-[var(--fg-muted)] leading-relaxed mb-10">
              Mein Ziel ist es, den Prozess so einfach wie möglich zu machen: Sie kümmern sich um Ihr Geschäft, ich kümmere mich um Ihre Website.
            </p>
            <ul className="space-y-3">
              {values.map(v => (
                <li key={v} className="flex items-start gap-3">
                  <CheckCircle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                  <span className="text-[var(--fg)] text-sm">{v}</span>
                </li>
              ))}
            </ul>
          </div>

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
