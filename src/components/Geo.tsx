import { Sparkles, Check } from "lucide-react";

// GEO als eigener Abschnitt: Text links, die gebaute KI-Antwort rechts.
// Absichtlich nicht in der Bilderreihe der Leistungen – dort stehen
// Screenshots, hier eine Ansicht.

// Die KI-Antwort: so sieht es aus, wenn ChatGPT oder Google den Betrieb
// nennt. Genau das ist das Ziel von GEO.
function GeoAnsicht() {
  return (
    <div className="mock-karte" aria-label="Beispiel: KI-Antwort, die den Betrieb empfiehlt">
      <div className="mock-kopf">
        <Sparkles size={14} /> KI-Antwort
      </div>
      <p className="mock-suche">Welche Werkstatt in Würzburg macht samstags Reifenwechsel?</p>
      <div className="mock-geo">
        <p>
          <b>Autohaus Mustermann</b> in Würzburg bietet samstags von 9 bis 13 Uhr Reifenwechsel
          an, Termine lassen sich online buchen. Kunden bewerten den Betrieb mit 4,8 von 5 Sternen.
        </p>
        <div className="mock-quellen">
          <span>autohaus-mustermann.de</span>
          <span>Google Unternehmensprofil</span>
          <span>Bewertungen · 4,8 ★</span>
        </div>
      </div>
    </div>
  );
}

const PUNKTE = ["Strukturierte Daten", "Fragen & Antworten", "Google-Unternehmensprofil"];

export default function Geo() {
  return (
    <section id="geo" className="surface-alt py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <span className="eyebrow inline-block mb-3">GEO – Generative Engine Optimization</span>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-4">
              Auch von ChatGPT &amp; Google AI empfohlen.
            </h2>
            <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-6">
              Kunden fragen heute eine KI. Genannt wird, wer klare Fakten liefert – dafür richte
              ich Website und Google-Profil ein.
            </p>
            <ul className="space-y-2.5">
              {PUNKTE.map(p => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-[var(--fg)]">
                  <Check size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7"><GeoAnsicht /></div>
        </div>
      </div>
    </section>
  );
}
