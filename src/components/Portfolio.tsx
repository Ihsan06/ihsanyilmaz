import { ArrowRight } from "lucide-react";

const projects = [
  {
    tag: "Webentwicklung",
    status: "Online",
    title: "Autohaus-Website",
    description: "Webauftritt für ein Autohaus mit Fahrzeug-Präsentation und Kontaktformular, über das Anfragen direkt per E-Mail ankommen.",
    tech: ["Next.js", "Cloudflare Pages", "Kontaktformular", "Webshop-Anbindung"],
  },
  {
    tag: "Webentwicklung",
    status: "In Arbeit",
    title: "Gastronomie-Website",
    description: "Konzeption und Umsetzung eines professionellen Webauftritts für einen lokalen Gastronomiebetrieb. Inklusive Kontaktmöglichkeit und mobilem Design.",
    tech: ["Next.js", "Tailwind CSS", "Cloudflare Pages", "Smarte Speisekarte"],
  },
];

export default function Portfolio() {
  return (
    <section id="projekte" className="surface-alt py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-16">
          <div>
            <span className="eyebrow inline-block mb-3">Projekte</span>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)]">Aktuelle Arbeiten</h2>
          </div>
          <p className="text-[var(--fg-muted)] max-w-xs text-sm leading-relaxed">Erste Referenzprojekte im Aufbau — für lokale Betriebe und kleine Unternehmen.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map(p => (
            <div key={p.title} className="card group flex flex-col overflow-hidden">
              <div className="h-1.5" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} />
              <div className="flex flex-col flex-1 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="chip px-2.5 py-1 text-xs font-medium" style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>{p.tag}</span>
                  <span className="chip px-2.5 py-1 text-xs font-medium">{p.status}</span>
                </div>
                <h3 className="display-h text-lg font-semibold text-[var(--fg)] mb-3">{p.title}</h3>
                <p className="text-[var(--fg-muted)] text-sm leading-relaxed flex-1 mb-6">{p.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.tech.map(t => (
                    <span key={t} className="chip px-2 py-0.5 text-xs font-medium">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <a href="#kontakt" className="inline-flex items-center gap-2 font-medium transition-colors hover:opacity-80" style={{ color: "var(--accent)" }}>
            Ihr Projekt anfragen <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
