import { Globe, Database, Lightbulb } from "lucide-react";

const services = [
  {
    icon: Globe,
    title: "Webentwicklung & E-Commerce",
    description: "Professionelle Websites und Webanwendungen, die Ihr Unternehmen optimal repräsentieren. Von der Landingpage bis zum Online-Shop — modern, schnell und suchmaschinenoptimiert.",
    tags: ["Next.js", "React", "SEO", "Shopify"],
    grad: "from-indigo-500 to-violet-600",
    glow: "group-hover:shadow-indigo-500/20",
  },
  {
    icon: Database,
    title: "Data Engineering & Analytics",
    description: "Daten-Pipelines, Dashboards und Business Intelligence, die aus Ihren Rohdaten klare Entscheidungsgrundlagen machen. Skalierbare Dateninfrastruktur, die mit Ihrem Unternehmen wächst.",
    tags: ["Python", "SQL", "Power BI", "ETL"],
    grad: "from-cyan-500 to-blue-600",
    glow: "group-hover:shadow-cyan-500/20",
  },
  {
    icon: Lightbulb,
    title: "IT-Beratung & Digitalisierung",
    description: "Strategische Begleitung auf dem Weg zur digitalen Transformation. Ich analysiere Ihre Prozesse und erarbeite pragmatische Lösungen — ohne unnötigen Overhead.",
    tags: ["Prozessanalyse", "Cloud", "Digitalisierung", "Strategie"],
    grad: "from-amber-500 to-orange-600",
    glow: "group-hover:shadow-amber-500/20",
  },
];

export default function Services() {
  return (
    <section id="leistungen" className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block text-indigo-400 text-sm font-medium tracking-wider uppercase mb-3">Leistungen</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Was ich für Sie tue</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">Ganzheitliche IT-Lösungen aus einer Hand — von der Idee bis zur fertigen Umsetzung.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map(s => (
            <div key={s.title} className={`group relative rounded-2xl bg-white/[0.03] border border-white/[0.08] p-8 hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-300 hover:shadow-xl ${s.glow}`}>
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${s.grad} mb-5`}>
                <s.icon size={22} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{s.title}</h3>
              <p className="text-slate-400 leading-relaxed mb-6">{s.description}</p>
              <div className="flex flex-wrap gap-2">
                {s.tags.map(t => <span key={t} className="px-2.5 py-1 rounded-md bg-white/5 text-slate-400 text-xs font-medium">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
