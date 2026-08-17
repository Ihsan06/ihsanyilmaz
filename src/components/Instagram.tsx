"use client";
import { useEffect, useState } from "react";

// Der Instagram-Abschnitt der Startseite: Profilzeile, ein Raster der
// letzten Beitraege und der Weg zum Profil.
//
// Die Beitraege kommen live von /api/instagram-feed — dort holt der Server
// sie bei Meta und legt sie eine Stunde in den Zwischenspeicher. Der
// Zugriffstoken bleibt dabei auf dem Server.
//
// Kommt nichts zurueck (kein Token, Meta gestoert, noch keine Beitraege),
// blendet sich der ganze Abschnitt aus. Eine leere Reihe grauer Kaesten
// waere schlechter als gar kein Abschnitt.

type Beitrag = { id: string; bild: string; text: string; weg: string; zeitpunkt: string };

const PROFIL = "https://www.instagram.com/aiy.web/";

export default function Instagram() {
  const [beitraege, setBeitraege] = useState<Beitrag[] | null>(null);

  useEffect(() => {
    fetch("/api/instagram-feed")
      .then(r => r.json())
      .then(d => setBeitraege(Array.isArray(d.beitraege) ? d.beitraege : []))
      .catch(() => setBeitraege([]));
  }, []);

  // null = wird noch geladen, [] = nichts da. In beiden Faellen nichts zeigen.
  if (!beitraege || beitraege.length === 0) return null;

  return (
    <section id="instagram" className="surface-alt py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Ohne Ueberschrift: die Kacheln sagen selbst, was sie sind. Profil
            und Bilder stehen deshalb buendig an derselben linken Kante. */}
        <div className="mb-8">
          <a
            href={PROFIL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-3 no-underline group"
          >
            <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--accent)" }}>
              <InstaZeichen groesse={22} farbe="#fff" />
            </span>
            <span className="flex flex-col leading-tight">
              <strong className="text-[var(--fg)] text-sm">@aiy.web</strong>
              <span className="text-[var(--fg-muted)] text-xs">Websites für lokale Betriebe</span>
            </span>
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {beitraege.slice(0, 10).map(b => (
            <a
              key={b.id}
              href={b.weg} target="_blank" rel="noopener noreferrer"
              className="relative block overflow-hidden rounded-[10px] group"
              style={{ aspectRatio: "1 / 1", background: "var(--border)" }}
              title={b.text || "Beitrag auf Instagram ansehen"}
            >
              {/* Die Adressen kommen von Instagrams eigenem Auslieferdienst. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.bild} alt={b.text || ""} loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <span className="absolute inset-0 flex items-center justify-center opacity-0
                group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(10,37,64,.55)" }}>
                <InstaZeichen groesse={26} farbe="#fff" />
              </span>
            </a>
          ))}
        </div>

        <div className="mt-8">
          <a href={PROFIL} target="_blank" rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm no-underline">
            <InstaZeichen groesse={18} farbe="currentColor" />
            @aiy.web folgen
          </a>
        </div>
      </div>
    </section>
  );
}

export function InstaZeichen({ groesse = 20, farbe = "currentColor" }: { groesse?: number; farbe?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={groesse} height={groesse} fill="none"
      stroke={farbe} strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.4" cy="6.6" r="1.2" fill={farbe} stroke="none" />
    </svg>
  );
}
