"use client";
import Logo from "./Logo";
import { InstaZeichen } from "./Instagram";
import { useSprache } from "@/lib/sprache";

export default function Footer() {
  const { t } = useSprache();
  const year = new Date().getFullYear();
  const links = [
    ["#leistungen", t.nav.leistungen], ["#ueber-mich", t.nav.ueberMich], ["#projekte", t.nav.projekte],
    ["#kontakt", t.nav.kontakt], ["/impressum", t.fuss.impressum], ["/datenschutz", t.fuss.datenschutz],
  ];
  return (
    <footer className="surface-alt border-t border-[var(--border)]">
      {/* Eine Zeile: Marke · Links · Symbole · Copyright. Am Handy bricht sie um. */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <div className="text-[var(--fg)]"><Logo size={26} /></div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          {links.map(([h, l]) => (
            <a key={h} href={h} className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">{l}</a>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <a href="https://www.linkedin.com/in/ihsan-yilmaz-3a634713a/" target="_blank" rel="noopener noreferrer"
             aria-label={t.ueber.linkedinAria} title="LinkedIn"
             className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </a>
          <a href="https://www.instagram.com/aiy.web/" target="_blank" rel="noopener noreferrer"
             aria-label="Instagram: @aiy.web" title="Instagram"
             className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
            <InstaZeichen groesse={18} />
          </a>
          <span className="text-xs text-[var(--fg-subtle)] ml-2">© {year} AIY · Ihsan Yilmaz</span>
        </div>
      </div>
    </footer>
  );
}
