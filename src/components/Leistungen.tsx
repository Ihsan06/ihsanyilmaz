"use client";
import { Globe, LayoutDashboard, Zap, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// Die drei Leistungen fuer den Einstiegs-Slider (Hero.tsx). Jede Leistung hat
// mehrere Ansichten – Screenshots aus der Autohaus-Demo und der Gastro-Demo
// (public/leistungen/*.jpg), bei Websites jeweils mit Handy daneben.
// Die Namen der Ansichten stehen in lib/texte.ts (ansichten), gleiche Reihenfolge.

function Browser({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rahmen-browser ${className}`}>
      <div className="rahmen-browser-leiste"><i /><i /><i /></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} decoding="async" />
    </div>
  );
}

function Handy({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rahmen-handy ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} decoding="async" />
    </div>
  );
}

const ICONS = [Globe, LayoutDashboard, Zap];

// Bei neuen Screenshots hochzaehlen, sonst zeigt der Browser noch die alten.
const BILD_STAND = 4;

type Ansicht = { bild: string; handy?: string };

const ANSICHTEN: Ansicht[][] = [
  [
    { bild: "web-start", handy: "handy-start" },
    { bild: "web-fahrzeuge", handy: "handy-fahrzeuge" },
    { bild: "web-mietwagen", handy: "handy-mietwagen" },
    { bild: "web-finanzierung", handy: "handy-finanzierung" },
    { bild: "web-cafe", handy: "handy-cafe" },
    { bild: "web-speisekarte", handy: "handy-speisekarte" },
  ],
  [
    { bild: "adm-uebersicht" },
    { bild: "adm-belegung" },
    { bild: "adm-monitoring" },
    { bild: "adm-speisekarte" },
    { bild: "adm-blog" },
  ],
  [
    { bild: "ki-website" },
    { bild: "ki-content" },
    { bild: "ki-messenger" },
  ],
];

export const ANZAHL_ANSICHTEN = ANSICHTEN.map(a => a.length);

// Eine Leistung: Text und Bilder nebeneinander, bei ungerader Nummer gespiegelt.
// Unter dem Bild die Ansichten zum Umschalten.
export function LeistungZeile({ i, bild, onBild }: { i: number; bild: number; onBild: (n: number) => void }) {
  const { t } = useSprache();
  const l = t.leistungen.eintraege[i];
  const Icon = ICONS[i];
  return (
    <article className={`grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div className="lg:col-span-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="icon-tile w-10 h-10"><Icon size={18} /></span>
          <span className="eyebrow">{l.eyebrow}</span>
        </div>
        <h3 className="display-h slider-titel text-[var(--fg)] mb-4">{l.titel}</h3>
        <p className="text-[var(--fg-muted)] leading-relaxed mb-6">{l.text}</p>
        <ul className="space-y-2.5">
          {l.punkte.map(p => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-[var(--fg)]">
              <Check size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} /> {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-7">
        <div className={`ansicht-buehne ${ANSICHTEN[i][bild]?.handy ? "mit-handy" : ""}`}>
          {ANSICHTEN[i].map((a, n) => (
            <div key={a.bild} className={`ansicht ${bild === n ? "aktiv" : ""}`} aria-hidden={bild !== n}>
              <Browser src={`/leistungen/${a.bild}.jpg?v=${BILD_STAND}`} alt={l.ansichten[n]} />
              {a.handy && (
                <Handy src={`/leistungen/${a.handy}.jpg?v=${BILD_STAND}`} alt={l.ansichten[n]}
                       className="absolute -bottom-6 -right-3 md:-right-8 w-[24%]" />
              )}
            </div>
          ))}
          {/* Schlichte Pfeile links und rechts auf dem Bild */}
          <button type="button" className="ansicht-pfeil links" aria-label="Vorherige Ansicht"
                  onClick={() => onBild((bild - 1 + ANSICHTEN[i].length) % ANSICHTEN[i].length)}><ChevronLeft size={20} /></button>
          <button type="button" className="ansicht-pfeil rechts" aria-label="Nächste Ansicht"
                  onClick={() => onBild((bild + 1) % ANSICHTEN[i].length)}><ChevronRight size={20} /></button>
        </div>
        <div className="ansicht-wahl" role="tablist">
          {l.ansichten.map((name, n) => (
            <button key={name} type="button" role="tab" aria-selected={bild === n}
                    className={bild === n ? "aktiv" : ""} onClick={() => onBild(n)}>
              {name}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
