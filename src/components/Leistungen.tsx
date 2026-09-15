import { Globe, LayoutDashboard, Zap, Check } from "lucide-react";

// Die drei Leistungen mit Bild: Screenshots aus der eigenen Autohaus-Demo
// (public/leistungen/*.jpg). GEO steht in einem eigenen Abschnitt (Geo.tsx),
// weil es kein Bild hat, das in diese Reihe passt.
// Texte bewusst kurz: Ueberschrift, zwei Saetze, drei Punkte.

type Leistung = {
  nummer: string;
  eyebrow: string;
  icon: typeof Globe;
  titel: string;
  text: string;
  punkte: string[];
  bild: React.ReactNode;
};

// Ein Bildschirm-Rahmen um einen Screenshot: dunkle Leiste mit drei Punkten,
// damit das Bild als Website gelesen wird und nicht als Foto.
function Browser({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rahmen-browser ${className}`}>
      <div className="rahmen-browser-leiste"><i /><i /><i /></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

function Handy({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rahmen-handy ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

const LEISTUNGEN: Leistung[] = [
  {
    nummer: "01",
    eyebrow: "Smart Websites",
    icon: Globe,
    titel: "Eine Website, die arbeitet.",
    text: "Schnell, mobil, für Google gebaut – mit Anfragen, Terminen und Buchungen direkt auf der Seite.",
    punkte: ["Anfragen & Termine", "Online-Buchung", "Lädt in unter einer Sekunde"],
    bild: (
      <div className="relative">
        <Browser src="/leistungen/website.jpg" alt="Startseite der Autohaus-Demo" />
        <Handy src="/leistungen/handy.jpg" alt="Dieselbe Seite auf dem Handy"
               className="absolute -bottom-6 -right-3 md:-right-8 w-[28%]" />
      </div>
    ),
  },
  {
    nummer: "02",
    eyebrow: "Verwaltungsbereich",
    icon: LayoutDashboard,
    titel: "Alles an einer Stelle.",
    text: "Anfragen, Belegungen, Bestand, Besucherzahlen – Sie ändern selbst, ohne Agentur.",
    punkte: ["Anfragen & Termine", "Belegungsplan & Bestand", "Besucherzahlen"],
    bild: (
      <div className="relative">
        <Browser src="/leistungen/verwaltung.jpg" alt="Übersicht im Verwaltungsbereich der Autohaus-Demo" />
        <Browser src="/leistungen/belegung.jpg" alt="Belegungsplan für Mietwagen"
                 className="absolute -bottom-8 -left-3 md:-left-10 w-[62%] shadow-2xl" />
      </div>
    ),
  },
  {
    nummer: "03",
    eyebrow: "KI als Beschleuniger",
    icon: Zap,
    titel: "Gute Idee heute. Online morgen.",
    text: "KI ersetzt keine Idee – sie macht die Umsetzung schnell. Beispiel Instagram: Foto wählen, Text kommt von der KI, Beitrag einplanen. Fertig.",
    punkte: ["Instagram-Beiträge in Minuten", "Änderungen an der Website in Tagen", "Texte und Bilder in Ihrem Ton"],
    bild: <Browser src="/leistungen/instagram.jpg" alt="Instagram-Beitrag im Verwaltungsbereich erstellen" />,
  },
];

export default function Leistungen() {
  return (
    <section id="leistungen" className="surface-base pt-16 pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Keine Ueberschrift: die drei Bloecke sprechen fuer sich. Fuer
            Vorleser bleibt sie unsichtbar stehen. */}
        <h2 className="sr-only">Leistungen</h2>

        <div className="flex flex-col gap-24 md:gap-32">
          {LEISTUNGEN.map((l, i) => (
            <article key={l.nummer}
                     className={`grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
              <div className="lg:col-span-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="icon-tile w-10 h-10"><l.icon size={18} /></span>
                  <span className="eyebrow">{l.nummer} · {l.eyebrow}</span>
                </div>
                <h3 className="display-h text-2xl md:text-3xl text-[var(--fg)] mb-4">{l.titel}</h3>
                <p className="text-[var(--fg-muted)] leading-relaxed mb-6">{l.text}</p>
                <ul className="space-y-2.5">
                  {l.punkte.map(p => (
                    <li key={p} className="flex items-start gap-2.5 text-sm text-[var(--fg)]">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-7 pb-8">{l.bild}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
