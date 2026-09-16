"use client";
import { Globe, LayoutDashboard, Zap, Check } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// Die drei Leistungen mit Bild: Screenshots aus der eigenen Autohaus-Demo
// (public/leistungen/*.jpg). GEO steht in einem eigenen Abschnitt (Geo.tsx).
// Texte kommen aus lib/texte.ts – kurz: Ueberschrift, zwei Saetze, drei Punkte.

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

const ICONS = [Globe, LayoutDashboard, Zap];

const BILDER = [
  (alt: string[]) => (
    <div className="relative">
      <Browser src="/leistungen/website.jpg" alt={alt[0]} />
      <Handy src="/leistungen/handy.jpg" alt={alt[1]} className="absolute -bottom-6 -right-3 md:-right-8 w-[28%]" />
    </div>
  ),
  (alt: string[]) => (
    <div className="relative">
      <Browser src="/leistungen/verwaltung.jpg" alt={alt[0]} />
      <Browser src="/leistungen/belegung.jpg" alt={alt[1]} className="absolute -bottom-8 -left-3 md:-left-10 w-[62%] shadow-2xl" />
    </div>
  ),
  (alt: string[]) => <Browser src="/leistungen/instagram.jpg" alt={alt[0]} />,
];

// Eine Leistung: Text und Bild nebeneinander, bei ungerader Nummer gespiegelt.
export function LeistungZeile({ i, h1 = false }: { i: number; h1?: boolean }) {
  const { t } = useSprache();
  const l = t.leistungen.eintraege[i];
  const Icon = ICONS[i];
  const Titel = h1 ? "h1" : "h3";
  return (
    <article className={`grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div className="lg:col-span-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="icon-tile w-10 h-10"><Icon size={18} /></span>
          <span className="eyebrow">{l.eyebrow}</span>
        </div>
        <Titel className={`display-h ${h1 ? "text-3xl md:text-5xl" : "text-2xl md:text-3xl"} text-[var(--fg)] mb-4`}>{l.titel}</Titel>
        <p className="text-[var(--fg-muted)] leading-relaxed mb-6">{l.text}</p>
        <ul className="space-y-2.5">
          {l.punkte.map(p => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-[var(--fg)]">
              <Check size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-7 pb-8">{BILDER[i](l.alt)}</div>
    </article>
  );
}

// Die drei Leistungen mit Bild.
export default function Leistungen() {
  const { t } = useSprache();
  return (
    <section id="leistungen" className="surface-base pt-20 pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <h2 className="sr-only">{t.leistungen.titel}</h2>
        <div className="flex flex-col gap-24 md:gap-32">
          {t.leistungen.eintraege.map((l, i) => <LeistungZeile key={l.eyebrow} i={i} />)}
        </div>
      </div>
    </section>
  );
}
