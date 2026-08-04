import { Globe, Sparkles, MapPin, Smartphone, Handshake } from "lucide-react";

const services = [
  {
    icon: Globe,
    title: "Website & Landingpage",
    description: "Eine saubere, moderne Website für Ihren Betrieb — Leistungen, Öffnungszeiten, Kontakt und Fotos an einem Ort.",
    tags: ["Design", "Öffnungszeiten", "Kontakt", "Fotos"],
  },
  {
    icon: Sparkles,
    title: "Smarte KI-Funktionen",
    description: "Praktische KI-Helfer auf Ihrer Website: Anfragen automatisch beantworten, Termine annehmen und häufige Fragen rund um die Uhr klären.",
    tags: ["KI-Assistent", "Termine", "24/7", "Zeitersparnis"],
  },
  {
    icon: MapPin,
    title: "Google & Local SEO",
    description: "Damit Kunden Sie bei Google und in Google Maps finden, wenn sie in der Nähe suchen — mit eingerichtetem Profil und Grundoptimierung.",
    tags: ["Google Maps", "SEO", "Bewertungen"],
  },
  {
    icon: Smartphone,
    title: "Mobil & Schnell",
    description: "Vollständig fürs Smartphone optimiert und blitzschnell — denn die meisten Kunden suchen unterwegs vom Handy aus.",
    tags: ["Responsive", "Schnell", "Handy-freundlich"],
  },
  {
    icon: Handshake,
    title: "Beratung & Service",
    description: "Persönliche Beratung von der ersten Idee bis zum Launch — und auch danach. Änderungen, Updates und Fragen klären wir direkt und unkompliziert.",
    tags: ["Persönlich", "Updates", "Wartung", "Direkt erreichbar"],
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
        <div className="text-center mb-10">
          <span className="eyebrow inline-block mb-3">Leistungen</span>
          <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-4">Meine Leistungen</h2>
          <p className="text-[var(--fg-muted)] text-lg max-w-2xl mx-auto">
            Alles was Ihr Betrieb online braucht — professionell umgesetzt, zu fairen Preisen.
          </p>
        </div>

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
