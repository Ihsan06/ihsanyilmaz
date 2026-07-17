import { Smile, Clock, Euro, CheckCircle } from "lucide-react";

const highlights = [
  { icon: Smile, title: "Persönlich & unkompliziert", text: "Kein Agentur-Overhead, keine langen Wartezeiten. Sie haben eine Ansprechperson — mich." },
  { icon: Clock, title: "Schnelle Umsetzung", text: "Ihre Website ist in der Regel innerhalb weniger Wochen fertig und online." },
  { icon: Euro, title: "Faire Preise", text: "Keine versteckten Kosten. Festpreise, die für kleine Betriebe passen." },
];

const values = [
  "Keine langen Vertragslaufzeiten",
  "Änderungen und Updates unkompliziert möglich",
  "Auch nach dem Launch erreichbar",
];

export default function About() {
  return (
    <section id="ueber-mich" className="surface-base py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <span className="eyebrow inline-block mb-3">Über mich</span>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-8 leading-tight">
              Ihr Ansprechpartner<br />
              <span className="accent-text">aus Würzburg</span>
            </h2>

            <div className="flex flex-col sm:flex-row gap-6 mb-8">
              {/* Bild mit Bildunterschrift */}
              <figure className="flex-shrink-0 w-48">
                <img
                  src="/ihsan.jpg?v=2"
                  alt="Ihsan Yilmaz — IT & Websites aus Würzburg"
                  className="rounded-[12px] object-cover"
                  style={{ width: 192, height: 192, border: "1px solid var(--border)" }}
                />
                <figcaption className="mt-3">
                  <div className="text-[var(--fg)] font-semibold leading-tight">Ihsan Yilmaz</div>
                  <div className="text-[var(--fg-subtle)] text-sm">IT &amp; Websites · Würzburg</div>
                  <a
                    href="https://www.linkedin.com/in/ihsan-yilmaz-3a634713a/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn-Profil von Ihsan Yilmaz"
                    className="inline-flex items-center gap-1.5 mt-2 text-sm hover:opacity-80 transition-opacity"
                    style={{ color: "var(--accent)" }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </a>
                </figcaption>
              </figure>

              {/* Text daneben */}
              <div>
                <p className="text-[var(--fg-muted)] text-lg leading-relaxed">
                  Ich bin Ihsan — IT-Fachmann aus Würzburg, mit einem B.Sc. in Wirtschaftswissenschaften und einem M.Sc. in Wirtschaftsinformatik (Julius-Maximilians-Universität Würzburg). Ich helfe lokalen Betrieben, online sichtbar zu werden und Zeit zu sparen: mit modernen Websites und smarten Funktionen, die dank KI-Tools heute bezahlbar sind.
                </p>
              </div>
            </div>

            <ul className="space-y-3">
              {values.map(v => (
                <li key={v} className="flex items-start gap-3">
                  <CheckCircle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                  <span className="text-[var(--fg)] text-sm">{v}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Vorteile */}
          <div className="space-y-6">
            {highlights.map(h => (
              <div key={h.title} className="card flex gap-4 p-6">
                <div className="icon-tile flex-shrink-0 w-10 h-10">
                  <h.icon size={20} />
                </div>
                <div>
                  <h4 className="display-h font-semibold text-[var(--fg)] mb-1">{h.title}</h4>
                  <p className="text-[var(--fg-muted)] text-sm leading-relaxed">{h.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
