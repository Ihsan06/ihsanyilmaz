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
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-slate-950/95 backdrop-blur-md border-b border-white/10 shadow-lg" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#" className="text-xl font-bold text-white">Ihsan<span className="text-indigo-400">.</span></a>
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="text-sm text-slate-300 hover:text-white transition-colors">{l.label}</a>
            ))}
          </nav>
          <a href="#kontakt" className="hidden md:inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">Projekt anfragen</a>
          <button className="md:hidden text-slate-300 hover:text-white" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-slate-950/98 border-b border-white/10 px-6 py-4 flex flex-col gap-4">
          {navLinks.map(l => (
            <a key={l.href} href={l.href} className="text-slate-300 hover:text-white transition-colors" onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <a href="#kontakt" className="inline-flex justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium" onClick={() => setOpen(false)}>Projekt anfragen</a>
        </div>
      )}
    </header>
  );
}
