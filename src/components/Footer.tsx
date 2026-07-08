export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="surface-alt border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <div className="text-xl font-display text-[var(--fg)] mb-2">
              <span className="font-bold tracking-tight">AIY</span>
              <span className="font-light mx-2" style={{ color: "var(--accent)" }}>|</span>
              <span className="font-medium text-[var(--fg-muted)]">Ihsan Yilmaz</span>
            </div>
            <p className="text-[var(--fg-muted)] text-sm max-w-xs">Websites für lokale Betriebe und kleine Unternehmen.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm">
            {[["#leistungen","Leistungen"],["#ueber-mich","Über mich"],["#projekte","Projekte"],["#kontakt","Kontakt"],["/impressum","Impressum"],["/datenschutz","Datenschutz"]].map(([h,l]) => (
              <a key={h} href={h} className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">{l}</a>
            ))}
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[var(--border)] text-center text-xs text-[var(--fg-subtle)]">
          © {year} AIY · Ihsan Yilmaz. Alle Rechte vorbehalten.
        </div>
      </div>
    </footer>
  );
}
