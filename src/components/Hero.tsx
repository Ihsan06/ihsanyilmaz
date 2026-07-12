import { ChevronDown } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero-bg surface-base relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="hero-photo" aria-hidden="true" />

      <div className="relative text-center px-6 mt-[12vh] animate-fade-in-up">
        <div
          className="display-h text-7xl md:text-8xl lg:text-[9rem] leading-none tracking-tight"
          style={{ fontWeight: 700, color: "var(--fg)" }}
        >
          AIY
        </div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <span className="h-px w-10" style={{ background: "var(--accent)" }} />
          <span className="text-lg md:text-2xl tracking-wide font-medium text-[var(--fg-muted)]">
            Ihsan Yilmaz
          </span>
          <span className="h-px w-10" style={{ background: "var(--accent)" }} />
        </div>
      </div>

      <a
        href="#leistungen"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors animate-bounce"
        aria-label="Weiter nach unten"
      >
        <ChevronDown size={28} />
      </a>
    </section>
  );
}
