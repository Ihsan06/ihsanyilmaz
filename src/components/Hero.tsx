import { Globe, Sparkles, MapPin } from "lucide-react";

const services = [
  {
    icon: Globe,
    title: "Website & Landingpage",
    description: "Leistungen, Öffnungszeiten, Kontakt und Fotos an einem Ort.",
    tags: ["Design", "Öffnungszeiten", "Kontakt", "Fotos"],
  },
  {
    icon: Sparkles,
    title: "Smarte KI-Funktionen",
    description: "Anfragen beantworten, Termine annehmen — rund um die Uhr.",
    tags: ["KI-Assistent", "Termine", "24/7", "Zeitersparnis"],
  },
  {
    icon: MapPin,
    title: "Google & Local SEO",
    description: "Gefunden werden, wenn Kunden in der Nähe suchen.",
    tags: ["Google Maps", "SEO", "Bewertungen"],
  },
];

export default function Hero() {
  return (
    <section
      id="leistungen"
      className="hero-bg surface-alt relative min-h-screen flex flex-col justify-center overflow-hidden pt-28 pb-16"
    >
      <div className="hero-photo" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full animate-fade-in-up">
        {/* Ohne Ueberschrift: die drei Karten sagen selbst, was angeboten wird.
            Die Ueberschrift bleibt fuer Vorleser da, sichtbar ist sie nicht. */}
        <h2 className="sr-only">Leistungen</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map(s => (
            <div key={s.title} className="card p-6">
              <div className="icon-tile w-11 h-11 mb-4">
                <s.icon size={20} />
              </div>
              <h3 className="display-h text-lg font-semibold text-[var(--fg)] mb-2">{s.title}</h3>
              <p className="text-[var(--fg-muted)] text-sm leading-relaxed mb-4">{s.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {s.tags.map(t => <span key={t} className="chip px-2.5 py-1 text-xs font-medium">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
