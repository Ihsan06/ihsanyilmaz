import { ArrowRight, ExternalLink, Quote } from "lucide-react";

const projects = [
  {
    tag: "Webentwicklung",
    status: "Online",
    title: "Autohaus Diezmann GmbH",
    url: "https://autohaus-diezmann.de",
    description: "Neuer Webauftritt für einen freien Kfz-Händler bei Coburg — mit Fahrzeug-Präsentation, Ankauf-Anfrage und Werkstatt-Kontakt. Schnell, klar strukturiert und auf allen Geräten optimal.",
    tech: ["Next.js", "Cloudflare Pages", "Fahrzeug-Präsentation", "Kontaktformular"],
  },
  {
    tag: "Webentwicklung",
    status: "In Arbeit",
    title: "Gastronomie-Website",
    description: "Konzeption und Umsetzung eines professionellen Webauftritts für einen lokalen Gastronomiebetrieb. Inklusive Kontaktmöglichkeit und mobilem Design.",
    tech: ["Next.js", "Tailwind CSS", "Cloudflare Pages", "Smarte Speisekarte"],
  },
  {
    tag: "Webentwicklung",
    status: "In Arbeit",
    title: "Mietwagen-Buchungstool",
    description: "Online-Buchungstool für einen Autovermieter — Fahrzeug wählen, Zeitraum festlegen und direkt anfragen. Verfügbarkeiten bleiben immer aktuell.",
    tech: ["Next.js", "Buchungskalender", "Verfügbarkeiten", "Online-Anfrage"],
  },
];

export default function Portfolio() {
  return (
    <section id="projekte" className="relative surface-alt py-24 overflow-hidden">
      <div className="projekte-bg" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-16">
          <div>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)]">Projekte</h2>
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
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-5 text-sm font-medium transition-opacity hover:opacity-80"
                    style={{ color: "var(--accent)" }}
                  >
                    Website ansehen <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Kundenstimme */}
        <figure className="card mt-8 p-8 md:p-10">
          <Quote size={28} style={{ color: "var(--accent)" }} className="mb-4" aria-hidden="true" />
          <blockquote className="display-h text-xl md:text-2xl font-medium leading-relaxed text-[var(--fg)]">
            „Ihsan hat unseren kompletten Webauftritt neu umgesetzt — schnell, unkompliziert und genau so, wie wir es uns vorgestellt haben. Die Seite lädt blitzschnell, sieht auf dem Handy top aus und Anfragen kommen jetzt direkt bei uns an. Klare Empfehlung!"
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>FD</span>
            <span>
              <span className="block text-[var(--fg)] font-semibold leading-tight">Flo — Autohaus Diezmann GmbH</span>
              <span className="block text-[var(--fg-subtle)] text-sm">Weidhausen bei Coburg</span>
            </span>
          </figcaption>
        </figure>

        <div className="mt-12">
          <a href="#kontakt" className="inline-flex items-center gap-2 font-medium transition-colors hover:opacity-80" style={{ color: "var(--accent)" }}>
            Ihr Projekt anfragen <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
