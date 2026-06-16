import { ArrowRight } from "lucide-react";

const projects = [
  {
    tag: "Webentwicklung", tagColor: "bg-indigo-100 text-indigo-700",
    title: "Unternehmenswebsite — Aktuelles Projekt",
    description: "Entwicklung einer modernen, performanten Website für ein lokales Unternehmen. Inklusive SEO-Optimierung, responsivem Design und Kontaktformular.",
    tech: ["Next.js", "Tailwind CSS", "Vercel"],
    status: "In Arbeit", statusColor: "bg-amber-100 text-amber-700",
  },
  {
    tag: "KI & Automatisierung", tagColor: "bg-violet-100 text-violet-700",
    title: "KI-gestützter Dokumenten-Assistent",
    description: "RAG-System zur automatischen Auswertung und Zusammenfassung von Geschäftsdokumenten. Reduziert manuellen Aufwand im Büroalltag signifikant.",
    tech: ["Python", "LangChain", "OpenAI", "PostgreSQL"],
    status: "Konzept", statusColor: "bg-slate-100 text-slate-600",
  },
  {
    tag: "Data Engineering", tagColor: "bg-cyan-100 text-cyan-700",
    title: "Sales Analytics Dashboard",
    description: "Automatisierte Datenpipeline und interaktives Dashboard zur Analyse von Verkaufsdaten — von der Datenquelle bis zum Live-Report.",
    tech: ["Python", "dbt", "Power BI", "SQL Server"],
    status: "Konzept", statusColor: "bg-slate-100 text-slate-600",
  },
];

export default function Portfolio() {
  return (
    <section id="projekte" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-16">
          <div>
            <span className="inline-block text-indigo-600 text-sm font-medium tracking-wider uppercase mb-3">Projekte</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900">Aktuelle Arbeiten</h2>
          </div>
          <p className="text-slate-500 max-w-xs text-sm leading-relaxed">Ein wachsendes Portfolio — vom ersten Kundenprojekt bis zu eigenen Lösungskonzepten.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {projects.map(p => (
            <div key={p.title} className="group flex flex-col bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500" />
              <div className="flex flex-col flex-1 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${p.tagColor}`}>{p.tag}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${p.statusColor}`}>{p.status}</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3 group-hover:text-indigo-700 transition-colors">{p.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-6">{p.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.tech.map(t => <span key={t} className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">{t}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a href="#kontakt" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
            Eigenes Projekt besprechen <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
