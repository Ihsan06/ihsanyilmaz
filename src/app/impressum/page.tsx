export default function Impressum() {
  return (
    <main className="surface-base min-h-screen pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <h1 className="display-h text-3xl font-bold text-[var(--fg)] mb-10">Impressum</h1>

        <div className="space-y-8 text-[var(--fg-muted)] text-sm leading-relaxed">
          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">Angaben gemäß § 5 TMG</h2>
            <p>Ihsan Yilmaz<br />
            Oberer Mainkai 9<br />
            97070 Würzburg</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">Kontakt</h2>
            <p>E-Mail: <a href="mailto:kontakt@ihsan-yilmaz.de" className="hover:opacity-80" style={{ color: "var(--accent)" }}>kontakt@ihsan-yilmaz.de</a></p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">Steuerliche Angaben</h2>
            <p>Steuernummer: 257/291/52520</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">Berufsbezeichnung</h2>
            <p>Webentwicklung</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">Haftungsausschluss</h2>
            <h3 className="text-[var(--fg)] font-medium mb-2">Haftung für Inhalte</h3>
            <p>Die Inhalte dieser Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann ich jedoch keine Gewähr übernehmen.</p>
            <h3 className="text-[var(--fg)] font-medium mt-4 mb-2">Haftung für Links</h3>
            <p>Mein Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte ich keinen Einfluss habe. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">Urheberrecht</h2>
            <p>Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors.</p>
          </section>
        </div>

        <div className="mt-12">
          <a href="/" className="text-sm transition-colors hover:opacity-80" style={{ color: "var(--accent)" }}>← Zurück zur Startseite</a>
        </div>
      </div>
    </main>
  );
}
