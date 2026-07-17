export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="surface-alt border-t border-[var(--border)]">
      <div className="relative border-b border-[var(--border)]">
        <iframe
          title="Standort – Oberer Mainkai 9, 97070 Würzburg (OpenStreetMap)"
          src="https://www.openstreetmap.org/export/embed.html?bbox=9.9239%2C49.7879%2C9.9309%2C49.7915&layer=mapnik&marker=49.7897%2C9.9274"
          className="w-full h-64 md:h-72 block"
          style={{ border: 0, filter: "grayscale(1)" }}
          loading="lazy"
        />
        <a
          href="https://www.google.com/maps/search/?api=1&query=Oberer+Mainkai+9%2C+97070+W%C3%BCrzburg"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary absolute bottom-4 right-4 px-4 py-2 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
          </svg>
          In Google Maps öffnen
        </a>
      </div>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <div className="text-xl font-display text-[var(--fg)] mb-2">
              <span className="font-bold tracking-tight">AIY</span>
              <span className="font-light mx-2" style={{ color: "var(--accent)" }}>|</span>
              <span className="font-medium text-[var(--fg-muted)]">Ihsan Yilmaz</span>
            </div>
            <p className="text-[var(--fg-muted)] text-sm max-w-xs">Websites für lokale Betriebe und kleine Unternehmen.</p>
            <a
              href="https://www.linkedin.com/in/ihsan-yilmaz-3a634713a/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn-Profil von Ihsan Yilmaz"
              className="inline-flex items-center gap-2 mt-4 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
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
