import { ArrowRight, ChevronDown } from "lucide-react";

const tags = ["Restaurant", "Café", "Bar", "Imbiss", "Hotel"];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0 pointer-events-none" style={{background:`radial-gradient(ellipse at 20% 50%, rgba(79,70,229,.25) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%, rgba(124,58,237,.2) 0%,transparent 55%),radial-gradient(ellipse at 60% 80%, rgba(6,182,212,.1) 0%,transparent 50%)`}} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{backgroundImage:`linear-gradient(rgba(255,255,255,.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.8) 1px,transparent 1px)`,backgroundSize:"60px 60px"}} />

      <div className="relative max-w-5xl mx-auto px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm mb-8 animate-fade-in-up">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          Verfügbar für neue Projekte
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] animate-fade-in-up animation-delay-200">
          Websites für die<br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">Gastronomie</span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up animation-delay-400">
          Ich baue professionelle Websites für Restaurants, Cafés, Bars und Imbisse — damit Ihre Gäste Sie online finden und direkt Kontakt aufnehmen können.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-fade-in-up animation-delay-600">
          <a href="#leistungen" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25">
            Was ich anbiete <ArrowRight size={18} />
          </a>
          <a href="#kontakt" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all hover:scale-105">
            Kostenlos anfragen
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-in-up animation-delay-600">
          {tags.map(t => (
            <span key={t} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-sm">{t}</span>
          ))}
        </div>
      </div>

      <a href="#leistungen" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-500 hover:text-slate-300 transition-colors animate-bounce">
        <ChevronDown size={28} />
      </a>
    </section>
  );
}
