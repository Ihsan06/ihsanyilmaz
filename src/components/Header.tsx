"use client";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import { useSprache } from "@/lib/sprache";
import { SPRACHEN } from "@/lib/texte";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { t, sprache, setSprache } = useSprache();

  const navLinks = [
    { href: "#leistungen", label: t.nav.leistungen },
    { href: "#ueber-mich", label: t.nav.ueberMich },
    { href: "#projekte", label: t.nav.projekte },
    { href: "#kontakt", label: t.nav.kontakt },
  ];

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // DE · EN · ES – die gewaehlte Sprache steht weiss, die anderen gedaempft.
  const sprachwahl = (
    <span className="sprachwahl" role="group" aria-label="Sprache">
      {SPRACHEN.map((s, i) => (
        <span key={s.kennung} className="inline-flex items-center">
          {i > 0 && <span className="sprachwahl-trenner" aria-hidden="true">·</span>}
          <button type="button" onClick={() => setSprache(s.kennung)} lang={s.kennung}
                  aria-pressed={sprache === s.kennung} title={s.name}
                  className={sprache === s.kennung ? "aktiv" : ""}>
            {s.kurz}
          </button>
        </span>
      ))}
    </span>
  );

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "backdrop-blur-md border-b border-[var(--border)] shadow-lg" : ""}`}
      style={{ background: scrolled ? "var(--bg)" : "transparent" }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Die Marke links, das Menue in der Mitte der Zeile: absolut
            gesetzt, damit es unabhaengig von der Logobreite zentriert steht.
            Rechts die Sprachwahl. */}
        <div className="relative flex items-center justify-between h-16">
          <a href="#" className="text-[var(--fg)]" aria-label="AIY · Ihsan Yilmaz — zum Seitenanfang">
            <Logo size={30} />
          </a>
          <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="text-sm font-semibold text-[var(--fg)] hover:text-[var(--accent)] transition-colors">{l.label}</a>
            ))}
          </nav>
          <div className="hidden md:flex">{sprachwahl}</div>
          <button className="md:hidden text-[var(--fg)]" onClick={() => setOpen(!open)} aria-label="Menü">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-b border-[var(--border)] px-6 py-4 flex flex-col gap-4" style={{ background: "var(--bg)" }}>
          {navLinks.map(l => (
            <a key={l.href} href={l.href} className="font-semibold text-[var(--fg)] hover:text-[var(--accent)] transition-colors" onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          {sprachwahl}
          <a href="#kontakt" className="btn-primary px-4 py-2 text-sm" onClick={() => setOpen(false)}>{t.nav.anfragen}</a>
        </div>
      )}
    </header>
  );
}
