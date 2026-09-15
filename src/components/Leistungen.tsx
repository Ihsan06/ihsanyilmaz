import { Globe, LayoutDashboard, Bot, Sparkles, Check } from "lucide-react";

// Die vier Leistungen, jede mit einem Bild: Screenshots aus der eigenen
// Autohaus-Demo (public/leistungen/*.jpg) fuer Website und Verwaltung,
// gebaute Ansichten fuer Assistent und KI-Antwort – da gibt es nichts zu
// fotografieren, was man versteht.

type Leistung = {
  nummer: string;
  eyebrow: string;
  icon: typeof Globe;
  titel: string;
  text: string;
  punkte: string[];
  bild: React.ReactNode;
  notiz?: string;
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

// Der Assistent: ein kurzer Wechsel, wie er auf einer Werkstatt-Website
// tatsaechlich laufen wuerde. Kein echter Chat, eine Ansicht.
function AssistentAnsicht() {
  return (
    <div className="mock-karte" aria-label="Beispiel: Gespräch mit dem KI-Assistenten">
      <div className="mock-kopf">
        <span className="mock-punkt" /> Assistent · Autohaus Mustermann
      </div>
      <div className="mock-chat">
        <p className="mock-frage">Habt ihr am Samstag auf? Ich bräuchte einen Reifenwechsel.</p>
        <p className="mock-antwort">
          Ja, samstags von 9 bis 13 Uhr. Ein Reifenwechsel dauert etwa 45 Minuten.
          Am Samstag ist um 10:30 Uhr noch etwas frei – soll ich das für Sie eintragen?
        </p>
        <p className="mock-frage">Ja bitte, Golf, Kennzeichen WÜ-AB 123.</p>
        <p className="mock-antwort">
          Eingetragen: Samstag, 10:30 Uhr, Reifenwechsel, VW Golf. Sie bekommen gleich eine
          Bestätigung. Bis Samstag!
        </p>
      </div>
      <div className="mock-fuss">
        <Check size={14} /> Termin an die Werkstatt übergeben · Zusammenfassung per E-Mail
      </div>
    </div>
  );
}

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

const LEISTUNGEN: Leistung[] = [
  {
    nummer: "01",
    eyebrow: "Smart Websites",
    icon: Globe,
    titel: "Eine Website, die arbeitet – nicht nur gut aussieht.",
    text:
      "Schnell, mobil, für Google gebaut. Mit den Funktionen, die Ihr Betrieb wirklich braucht: " +
      "Anfragen, Termine, Buchungen, Öffnungszeiten, Fahrzeug- oder Speisekarte – und WhatsApp mit einem Tipp.",
    punkte: ["Anfragen & Termine direkt auf der Seite", "Online-Buchung, z. B. Mietwagen oder Probefahrt", "Lädt in unter einer Sekunde", "DSGVO-konform, gehostet in der EU-Region"],
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
    titel: "Alles an einer Stelle. Ohne Agentur.",
    text:
      "Zu jeder Website gehört ein eigener Verwaltungsbereich: Anfragen lesen, Belegungen planen, " +
      "Fahrzeuge oder Angebote pflegen, Instagram-Beiträge vorbereiten und einplanen – und sehen, " +
      "wie viele Menschen die Seite besuchen. Sie ändern selbst, wann Sie wollen.",
    punkte: ["Anfragen und Termine im Blick", "Belegungsplan, Bestand, Galerie", "Instagram-Beiträge planen, automatisch posten", "Besucherzahlen ohne Cookie-Banner"],
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
    eyebrow: "KI-Assistenten",
    icon: Bot,
    titel: "Antwortet, wenn Sie gerade keine Hand frei haben.",
    text:
      "Ein Assistent auf Ihrer Website, der Ihre Öffnungszeiten, Leistungen und Preise kennt. " +
      "Er beantwortet Fragen, nimmt Termin- und Rückrufwünsche auf und schickt Ihnen eine saubere " +
      "Zusammenfassung – rund um die Uhr, in Ihrem Ton.",
    punkte: ["Kennt Ihr Angebot, nicht das Internet", "Nimmt Termine und Rückrufe auf", "Übergibt an Sie, sobald es persönlich wird", "Auch per WhatsApp möglich"],
    bild: <AssistentAnsicht />,
  },
  {
    nummer: "04",
    eyebrow: "GEO – Generative Engine Optimization",
    icon: Sparkles,
    titel: "Sichtbar in ChatGPT, Google AI & Co.",
    text:
      "Kunden fragen heute eine KI: „Welche Werkstatt in Würzburg macht samstags Reifenwechsel?“ " +
      "Genannt wird, wer klar strukturierte Fakten liefert. Ich richte Ihre Website und Ihr " +
      "Google-Unternehmensprofil so ein, dass KI-Antworten Ihren Betrieb finden und empfehlen.",
    punkte: ["Strukturierte Daten (schema.org) für Öffnungszeiten, Leistungen, Preise", "Fragen & Antworten, die eine KI zitieren kann", "Google-Unternehmensprofil und Bewertungen im Griff", "Läuft mit klassischem SEO zusammen, nicht dagegen"],
    bild: <GeoAnsicht />,
    notiz:
      "In Deutschland zeigen inzwischen rund drei von vier Google-Suchen eine KI-Antwort – " +
      "und fast die Hälfte aller Unternehmen hat dafür noch keinen Plan.",
  },
];

export default function Leistungen() {
  return (
    <section id="leistungen" className="surface-base py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="max-w-2xl mb-16">
          <span className="eyebrow inline-block mb-3">Leistungen</span>
          <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-4">
            Vier Bausteine. Ein Betrieb, der online läuft.
          </h2>
          <p className="text-[var(--fg-muted)] text-lg">
            Einzeln buchbar, zusammen am stärksten. Alles aus einer Hand, aus Würzburg.
          </p>
        </div>

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
                {l.notiz && (
                  <p className="mt-6 text-sm leading-relaxed pl-4 text-[var(--fg-muted)]"
                     style={{ borderLeft: "2px solid var(--accent)" }}>{l.notiz}</p>
                )}
              </div>
              <div className="lg:col-span-7 pb-8">{l.bild}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
