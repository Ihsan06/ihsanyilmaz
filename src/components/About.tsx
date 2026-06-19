import { GraduationCap, Briefcase, Zap, CheckCircle } from "lucide-react";

const highlights = [
  { icon: GraduationCap, title: "Wirtschaftsinformatik", text: "Fundiertes Verständnis für Technologie und Business — ich spreche beide Sprachen." },
  { icon: Briefcase, title: "Branchenübergreifende Erfahrung", text: "Webprojekte für verschiedenste Branchen — von kleinen Unternehmen bis zu mittelständischen Betrieben." },
  { icon: Zap, title: "Hands-on & pragmatisch", text: "Kein Overhead, keine unnötige Komplexität. Ich liefere Lösungen, die wirklich funktionieren." },
];

const skills = ["TypeScript","React / Next.js","HTML & CSS","REST APIs","WordPress","Shopify","SEO","Docker","Cloud (AWS / GCP)","Node.js"];

const values = [
  "Direkte Kommunikation ohne Agentur-Overhead",
  "Festpreise oder transparente Stundensätze",
  "Kurze Reaktionszeiten und zuverlässige Lieferung",
  "Mittelstandsgerechte Lösungen statt Enterprise-Overkill",
];

export default function About() {
  return (
    <section id="ueber-mich" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block text-indigo-600 text-sm font-medium tracking-wider uppercase mb-3">Über mich</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
              Technologie, die<br />
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Ihr Business voranbringt</span>
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed mb-6">
              Ich bin Webentwickler mit einem Abschluss in Wirtschaftsinformatik und mehrjähriger Erfahrung im Aufbau moderner Websites und Webanwendungen. Meine Stärke liegt darin, dass ich sowohl die technische als auch die unternehmerische Seite verstehe.
            </p>
            <p className="text-slate-600 leading-relaxed mb-10">
              Für kleine und mittelständische Unternehmen biete ich persönliche Betreuung, direkte Kommunikation und Lösungen, die zum Budget und den Zielen Ihres Unternehmens passen.
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
            <div className="p-6 rounded-xl bg-slate-50 border border-slate-100">
              <h4 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Technologien & Tools</h4>
              <div className="flex flex-wrap gap-2">
                {skills.map(s => <span key={s} className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium">{s}</span>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
