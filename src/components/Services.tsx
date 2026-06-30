import { Globe, Sparkles, MapPin, Smartphone } from "lucide-react";

const services = [
  {
    icon: Globe,
    title: "Website & Landingpage",
    description: "Eine saubere, moderne Website für Ihren Betrieb — mit allem, was Ihre Kunden brauchen: Leistungen, Öffnungszeiten, Kontakt und Fotos.",
    tags: ["Design", "Leistungen", "Öffnungszeiten", "Kontakt"],
  },
  {
    icon: Sparkles,
    title: "Clevere Funktionen",
    description: "Kleine, praktische Helfer direkt auf Ihrer Website — z.B. Anfragen automatisch beantworten, Termine entgegennehmen oder häufige Fragen rund um die Uhr klären. Großer Nutzen, wenig Aufwand.",
    tags: ["Anfragen-Assistent", "Termin-Anfragen", "Rund um die Uhr", "Zeitersparnis"],
  },
  {
    icon: MapPin,
    title: "Bei Google gefunden werden",
    description: "Damit Kunden Sie bei Google und in Google Maps finden, wenn sie in der Nähe suchen — mit eingerichtetem Google-Profil und sauberer Grundoptimierung.",
    tags: ["Google Maps", "Google-Profil", "Lokale Suche", "Bewertungen"],
  },
  {
    icon: Smartphone,
    title: "Mobil & Schnell",
    description: "Alle Websites sind vollständig für Smartphones optimiert — denn die meisten Kunden suchen unterwegs vom Handy aus.",
    tags: ["Responsive", "Schnell", "Handy-freundlich", "Modern"],
  },
];

export default function Services() {
  return (
    <section id="leistungen" className="surface-alt py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="eyebrow inline-block mb-3">Leistungen</span>
          <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-4">Meine Leistungen</h2>
          <p className="text-[var(--fg-muted)] text-lg max-w-2xl mx-auto">Alles was Ihr Betrieb online braucht — professionell umgesetzt, zu fairen Preisen.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map(s => (
            <div key={s.title} className="card p-8">
              <div className="icon-tile p-3 mb-5">
                <s.icon size={22} />
              </div>
              <h3 className="display-h text-xl font-semibold text-[var(--fg)] mb-3">{s.title}</h3>
              <p className="text-[var(--fg-muted)] leading-relaxed mb-6">{s.description}</p>
              <div className="flex flex-wrap gap-2">
                {s.tags.map(t => <span key={t} className="chip px-2.5 py-1 text-xs font-medium">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
