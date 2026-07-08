"use client";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "#leistungen", label: "Leistungen" },
  { href: "#ueber-mich", label: "Über mich" },
  { href: "#projekte", label: "Projekte" },
  { href: "#kontakt", label: "Kontakt" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "backdrop-blur-md border-b border-[var(--border)] shadow-lg" : ""}`}
      style={{ background: scrolled ? "var(--bg)" : "transparent" }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#" className="flex items-center gap-2 font-display text-[var(--fg)]">
            <span className="text-xl font-bold tracking-tight">AIY</span>
            <span className="text-lg font-light" style={{ color: "var(--accent)" }}>|</span>
            <span className="text-sm font-medium text-[var(--fg-muted)]">Ihsan Yilmaz</span>
          </a>
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">{l.label}</a>
            ))}
          </nav>
          <a href="#kontakt" className="btn-primary hidden md:inline-flex px-4 py-2 text-sm">Projekt anfragen</a>
          <button className="md:hidden text-[var(--fg)]" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-b border-[var(--border)] px-6 py-4 flex flex-col gap-4" style={{ background: "var(--bg)" }}>
          {navLinks.map(l => (
            <a key={l.href} href={l.href} className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors" onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <a href="#kontakt" className="btn-primary px-4 py-2 text-sm" onClick={() => setOpen(false)}>Projekt anfragen</a>
        </div>
      )}
    </header>
  );
}
