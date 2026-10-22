export default function Datenschutz() {
  return (
    <main className="surface-base min-h-screen pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <h1 className="display-h text-3xl font-bold text-[var(--fg)] mb-10">Datenschutzerklärung</h1>

        <div className="space-y-8 text-[var(--fg-muted)] text-sm leading-relaxed">
          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">1. Verantwortlicher</h2>
            <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
            <p className="mt-2">Ihsan Yilmaz<br />
            Oberer Mainkai 9<br />
            97070 Würzburg<br />
            Telefon: <a href="tel:+4917663657207" className="hover:opacity-80" style={{ color: "var(--accent)" }}>+49 176 63657207</a><br />
            E-Mail: <a href="mailto:kontakt@ihsan-yilmaz.de" className="hover:opacity-80" style={{ color: "var(--accent)" }}>kontakt@ihsan-yilmaz.de</a></p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">2. Hosting</h2>
            <p>Diese Website wird bei Cloudflare gehostet (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA). Cloudflare verarbeitet dabei in unserem Auftrag technisch notwendige Daten, die Ihr Browser beim Aufruf der Seite übermittelt (insbesondere die IP-Adresse). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer sicheren und effizienten Bereitstellung der Website). Mit Cloudflare besteht ein Auftragsverarbeitungsvertrag. Eine Übermittlung in die USA erfolgt auf Grundlage der EU-Standardvertragsklauseln.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">3. Server-Logfiles</h2>
            <p>Beim Aufruf der Website werden automatisch Informationen erfasst, die Ihr Browser übermittelt: aufgerufene Seite, Datum und Uhrzeit des Zugriffs, übertragene Datenmenge, verwendeter Browsertyp und Betriebssystem sowie die IP-Adresse. Diese Daten dienen ausschließlich dem sicheren und stabilen Betrieb der Website und werden nicht mit anderen Datenquellen zusammengeführt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">4. Kontaktformular und E-Mail-Kontakt</h2>
            <p>Wenn Sie mir über das Kontaktformular oder per E-Mail eine Anfrage senden, verarbeite ich die von Ihnen angegebenen Daten — insbesondere Name, E-Mail-Adresse, optional die Bezeichnung Ihres Betriebs sowie den Inhalt Ihrer Nachricht — zur Bearbeitung Ihrer Anfrage.</p>
            <p className="mt-2">Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung bzw. Erfüllung eines Vertrags), sofern Ihre Anfrage auf einen Vertragsabschluss abzielt, andernfalls Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Beantwortung Ihrer Anfrage).</p>
            <p className="mt-2">Für den technischen Versand der über das Kontaktformular eingegangenen Nachrichten als E-Mail nutze ich den Dienst Resend (Resend, Inc., USA). Dabei werden die von Ihnen eingegebenen Daten an Resend übermittelt und an meine E-Mail-Adresse zugestellt. Die Übermittlung in die USA erfolgt auf Grundlage der EU-Standardvertragsklauseln.</p>
            <p className="mt-2">Ihre Daten werden gelöscht, sobald sie für die Bearbeitung Ihrer Anfrage nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">5. Demo-Links per E-Mail</h2>
            <p>Wenn Sie über das Formular „Demo ansehen“ Ihre E-Mail-Adresse angeben, verarbeite ich diese, um Ihnen die Links zu den Demo-Websites zuzusenden. Gespeichert werden E-Mail-Adresse, Zeitpunkt und gewählte Sprache; die Anfrage erscheint zudem in meiner Anfragenübersicht, damit ich Ihnen auf Wunsch den Verwaltungsbereich persönlich zeigen kann. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahme auf Ihre Anfrage). Der Versand erfolgt über Resend (siehe Abschnitt 4). Einen Newsletter gibt es nicht. Die Daten lösche ich spätestens sechs Monate nach der Anfrage, sofern kein Auftrag zustande kommt.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">6. Empfänger und Auftragsverarbeiter</h2>
            <p>Eine Weitergabe Ihrer Daten an Dritte erfolgt nur, soweit dies zur Bereitstellung der Website und zur Bearbeitung Ihrer Anfrage erforderlich ist. Eingesetzte Dienstleister:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Cloudflare, Inc. (USA) — Hosting und Auslieferung der Website</li>
              <li>Resend, Inc. (USA) — Versand der Kontaktanfragen per E-Mail</li>
              <li>A&amp;O Fischer GmbH &amp; Co. KG (LetterXpress, Winsen/Luhe) — Druck und Postversand der Anschreiben an Betriebe (Abschnitt 13)</li>
              <li>OpenStreetMap Foundation (Vereinigtes Königreich) — Anzeige der Standort-Karte im Footer</li>
            </ul>
            <p className="mt-2">Mit diesen Dienstleistern bestehen die datenschutzrechtlich erforderlichen Vereinbarungen. Soweit eine Verarbeitung außerhalb der EU/des EWR stattfindet, erfolgt diese auf Grundlage geeigneter Garantien (EU-Standardvertragsklauseln).</p>
            <p className="mt-2">Im Footer dieser Website ist eine Karte des Dienstes OpenStreetMap eingebunden (OpenStreetMap Foundation, Cambridge, Vereinigtes Königreich). Beim Laden der Karte wird Ihre IP-Adresse an OpenStreetMap übermittelt, damit die Karteninhalte in Ihrem Browser dargestellt werden können. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Darstellung unseres Standorts). Für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der EU-Kommission, sodass ein angemessenes Datenschutzniveau gewährleistet ist.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">7. Schriftarten</h2>
            <p>Diese Website verwendet Schriftarten, die lokal auf dem Server gehostet und direkt von dieser Website ausgeliefert werden. Es findet dabei kein Verbindungsaufbau zu Servern Dritter (z.&nbsp;B. Google Fonts) und keine Übermittlung Ihrer IP-Adresse an Dritte statt.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">8. Cookies und Tracking</h2>
            <p>Diese Website verwendet keine Cookies zu Analyse- oder Marketingzwecken und setzt keine Tracking- oder Webanalyse-Dienste ein. Es werden keine Nutzungsprofile erstellt.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">9. SSL-/TLS-Verschlüsselung</h2>
            <p>Diese Website nutzt aus Sicherheitsgründen eine TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie am „https://" und am Schloss-Symbol in Ihrer Browserzeile.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">10. Ihre Rechte</h2>
            <p>Sie haben im Rahmen der gesetzlichen Vorgaben jederzeit das Recht auf:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Auskunft über Ihre verarbeiteten Daten (Art. 15 DSGVO)</li>
              <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
              <li>Löschung Ihrer Daten (Art. 17 DSGVO)</li>
              <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
            </ul>
            <p className="mt-2">Zur Ausübung Ihrer Rechte genügt eine formlose Mitteilung an die oben genannten Kontaktdaten.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">11. Beschwerderecht bei der Aufsichtsbehörde</h2>
            <p>Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Die für mich zuständige Behörde ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">12. Aktualität dieser Datenschutzerklärung</h2>
            <p>Diese Datenschutzerklärung wird angepasst, sobald Änderungen der Website oder der rechtlichen Vorgaben dies erforderlich machen.</p>
          </section>

          <section>
            <h2 className="text-[var(--fg)] font-semibold text-base mb-3">13. Persönliche Seiten unter /fuer/ (Anschreiben an Betriebe)</h2>
            <p>Ich schreibe gelegentlich Autohäuser und Werkstätten in der Region per Brief an, wenn deren Internetauftritt erkennbar Nachholbedarf hat. Der Brief enthält einen Link und einen QR-Code zu einer persönlichen Seite unter ihsan-yilmaz.de/fuer/…, die nur über diesen Link erreichbar ist und nicht von Suchmaschinen erfasst wird.</p>
            <p className="mt-2"><strong className="text-[var(--fg)]">Woher die Daten stammen:</strong> Firmenname, Anschrift und Website-Adresse des Betriebs stammen aus OpenStreetMap, aus dem öffentlichen Google-Karteneintrag und von der öffentlich erreichbaren Website des Betriebs. Personennamen werden nicht erhoben; der Brief richtet sich an die Geschäftsleitung. Die auf der persönlichen Seite genannten Punkte beruhen auf einer automatischen technischen Prüfung der öffentlichen Website (z.&nbsp;B. Verschlüsselung, Darstellung auf dem Smartphone, Jahresangabe im Fuß).</p>
            <p className="mt-2"><strong className="text-[var(--fg)]">Zweck und Rechtsgrundlage:</strong> Direktwerbung gegenüber Unternehmen zur Anbahnung eines Auftrags, Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse). Für den Druck und den Postversand nutze ich den Dienst LetterXpress (A&amp;O Fischer GmbH &amp; Co. KG, Winsen/Luhe), mit dem ein Auftragsverarbeitungsvertrag besteht; die übermittelten Adress- und Inhaltsdaten werden dort nach 60 Tagen gelöscht.</p>
            <p className="mt-2"><strong className="text-[var(--fg)]">Aufrufzähler:</strong> Beim Aufruf der persönlichen Seite wird lediglich gezählt, dass und wann sie aufgerufen und ob die Demo geöffnet wurde; darüber werde ich per E-Mail benachrichtigt. Es werden keine Cookies gesetzt, keine IP-Adresse gespeichert und keine Nutzungsprofile erstellt. Wird über die Seite ein Demo-Zugang angefordert, gilt Abschnitt 5.</p>
            <p className="mt-2"><strong className="text-[var(--fg)]">Website-Vorschau:</strong> Für einzelne Betriebe erstelle ich eine Vorschau, wie eine neue Website aussehen könnte (ihsan-yilmaz.de/fuer/…/website). Sie enthält nur Firmendaten (Name, Anschrift, Telefon, Öffnungszeiten, Marken) sowie Beispielfahrzeuge und frei nutzbare Bilder – keine Inhalte der bestehenden Website. Die Texte formuliert ein KI-Dienst (Anthropic, USA, auf Grundlage der EU-Standardvertragsklauseln) allein aus diesen Firmendaten. Die Vorschau ist nicht öffentlich auffindbar und wird nach 30 Tagen gelöscht; gezählt wird nur, dass und wann sie aufgerufen wurde.</p>
            <p className="mt-2"><strong className="text-[var(--fg)]">Kontakt erlauben:</strong> Klicken Sie auf der persönlichen Seite auf „Ja, bitte melden Sie sich“, speichere ich den Zeitpunkt dieses Klicks zusammen mit dem Anschreiben und melde mich anschließend zu diesem Angebot über die öffentlich bekannten Kontaktdaten Ihres Betriebs per Telefon oder E-Mail (Einwilligung, Art. 6 Abs. 1 lit. a DSGVO). Eingegeben werden dabei keine Daten. Die Benachrichtigung darüber erhalte ich per E-Mail über Resend (Abschnitt 4). Sie können die Erlaubnis jederzeit formlos widerrufen; den Eintrag lösche ich spätestens nach zwölf Monaten, sofern kein Auftrag zustande kommt.</p>
            <p className="mt-2"><strong className="text-[var(--fg)]">Widerspruch (Art. 21 DSGVO) und Information (Art. 14 DSGVO):</strong> Sie können der Nutzung Ihrer Firmenanschrift für Anschreiben jederzeit widersprechen – über die im Brief genannte Adresse (ihsan-yilmaz.de/fuer/…/nein) oder formlos an die oben genannten Kontaktdaten. Der Betrieb wird dann in eine Sperrliste eingetragen und nicht mehr angeschrieben. Die übrigen Daten zum Betrieb lösche ich spätestens zwölf Monate nach dem Anschreiben, sofern kein Kontakt zustande kommt.</p>
          </section>
        </div>

        <div className="mt-12">
          <a href="/" className="text-sm transition-colors hover:opacity-80" style={{ color: "var(--accent)" }}>← Zurück zur Startseite</a>
        </div>
      </div>
    </main>
  );
}
