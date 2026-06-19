import { ArrowRight } from "lucide-react";

export default function Portfolio() {
  return (
    <section id="projekte" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-16">
          <div>
            <span className="inline-block text-indigo-600 text-sm font-medium tracking-wider uppercase mb-3">Projekte</span>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900">Aktuelle Arbeiten</h2>
          </div>
          <p className="text-slate-500 max-w-xs text-sm leading-relaxed">Erste Referenzprojekte im Aufbau — mit Fokus auf Gastronomie und lokale Betriebe.</p>
        </div>

        <div className="max-w-2xl">
          <div className="group flex flex-col bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500" />
            <div className="flex flex-col flex-1 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Webentwicklung</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">In Arbeit</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 group-hover:text-indigo-700 transition-colors">Gastronomie-Website — Aktuelles Projekt</h3>
              <p className="text-slate-500 text-sm leading-relaxed flex-1 mb-6">Konzeption und Umsetzung eines professionellen Webauftritts für einen lokalen Gastronomiebetrieb. Inklusive digitaler Speisekarte, Kontaktmöglichkeit und mobilem Design.</p>
              <div className="flex flex-wrap gap-1.5">
                {["Next.js", "Tailwind CSS", "Cloudflare Pages"].map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <a href="#kontakt" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
            Ihr Projekt anfragen <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
