import { Smile, Clock, Euro, CheckCircle } from "lucide-react";

const highlights = [
  { icon: Smile, title: "Persönlich & unkompliziert", text: "Kein Agentur-Overhead, keine langen Wartezeiten. Sie haben eine Ansprechperson — mich." },
  { icon: Clock, title: "Schnelle Umsetzung", text: "Ihre Website ist in der Regel innerhalb weniger Wochen fertig und online." },
  { icon: Euro, title: "Faire Preise", text: "Keine versteckten Kosten. Festpreise, die für kleine Gastrobetriebe passen." },
];

const values = [
  "Ich melde mich innerhalb von 24 Stunden",
  "Keine langen Vertragslaufzeiten",
  "Änderungen und Updates unkompliziert möglich",
  "Auch nach dem Launch erreichbar",
];

export default function About() {
  return (
    <section id="ueber-mich" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block text-indigo-600 text-sm font-medium tracking-wider uppercase mb-3">Über mich</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Ihr Ansprechpartner<br />
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">für Ihre Website</span>
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed mb-6">
              Ich bin Ihsan, Webentwickler aus Leidenschaft. Ich helfe Gastronomiebetrieben dabei, online sichtbar zu werden — mit einer Website, die zu Ihrem Lokal passt und bei der Ihre Gäste alles finden was sie brauchen.
            </p>
            <p className="text-slate-600 leading-relaxed mb-10">
              Mein Ziel ist es, den Prozess so einfach wie möglich zu machen: Sie kümmern sich um Ihr Lokal, ich kümmere mich um Ihre Website.
            </p>
            <ul className="space-y-3">
              {values.map(v => (
                <li key={v} className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                  <span className="text-slate-700 text-sm">{v}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            {highlights.map(h => (
              <div key={h.title} className="flex gap-4 p-6 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <h.icon size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">{h.title}</h4>
                  <p className="text-slate-600 text-sm leading-relaxed">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
