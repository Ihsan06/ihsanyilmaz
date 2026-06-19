import { Globe, UtensilsCrossed, MapPin, Smartphone } from "lucide-react";

const services = [
  {
    icon: Globe,
    title: "Website & Landingpage",
    description: "Eine saubere, moderne Website für Ihren Gastrobetrieb — mit Speisekarte, Öffnungszeiten, Fotos und allem was Ihre Gäste brauchen.",
    tags: ["Design", "Speisekarte", "Öffnungszeiten", "Fotos"],
    grad: "from-indigo-500 to-violet-600",
    glow: "group-hover:shadow-indigo-500/20",
  },
  {
    icon: UtensilsCrossed,
    title: "Online-Speisekarte",
    description: "Eine digitale Speisekarte, die Sie jederzeit selbst aktualisieren können — kein Drucken mehr, immer aktuell.",
    tags: ["Aktualisierbar", "QR-Code", "Mehrsprachig", "Allergene"],
    grad: "from-cyan-500 to-blue-600",
    glow: "group-hover:shadow-cyan-500/20",
  },
  {
    icon: MapPin,
    title: "Google & Local SEO",
    description: "Damit Ihr Lokal bei Google Maps und in der Suche gefunden wird — mehr Sichtbarkeit für mehr Laufkundschaft.",
    tags: ["Google Maps", "SEO", "Bewertungen", "Local Search"],
    grad: "from-green-500 to-emerald-600",
    glow: "group-hover:shadow-green-500/20",
  },
  {
    icon: Smartphone,
    title: "Mobil & Schnell",
    description: "Alle Websites sind vollständig für Smartphones optimiert — denn die meisten Gäste suchen unterwegs vom Handy aus.",
    tags: ["Responsive", "Schnell", "Handy-freundlich", "Modern"],
    grad: "from-violet-500 to-purple-600",
    glow: "group-hover:shadow-violet-500/20",
  },
];

export default function Services() {
  return (
    <section id="leistungen" className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-block text-indigo-400 text-sm font-medium tracking-wider uppercase mb-3">Leistungen</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Meine Leistungen</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">Alles was Ihr Gastronomiebetrieb online braucht — professionell umgesetzt, zu fairen Preisen.</p>
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
