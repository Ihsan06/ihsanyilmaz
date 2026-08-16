// Bausteine, die alle Adminseiten brauchen.
//
// Kein Modulsystem im Spiel – die Datei haengt ihre Helfer an window.admin.
// Wichtig: muss VOR den Seitenskripten eingebunden werden.

window.admin = (function () {

  const zahl = n => (n ?? 0).toLocaleString('de-DE');

  // Alles, was aus den Daten in HTML wandert, geht hier durch. Pfade und
  // Verweis-Hosts kommen aus dem Browser des Besuchers, sind also nichts,
  // dem man trauen darf.
  function schuetzen(text) {
    const d = document.createElement('div');
    d.textContent = text == null ? '' : String(text);
    return d.innerHTML;
  }

  // ─── Kopfzeile ───

  // Jeder Punkt traegt sein Zeichen: in einer senkrechten Leiste liest sich
  // eine reine Woerterliste wie ein Inhaltsverzeichnis, nicht wie ein Menue.
  // AIY-Anpassung: Die Leiste zeigt die Bereiche des AIY-Adminbereichs.
  // Dieselben Bereiche wie die React-Leiste (AdminShell.tsx) — die Studio-
  // Seiten sollen sich nicht wie ein anderes Programm anfuehlen. Alles ausser
  // "Content erstellen" und "Content planen" fuehrt zurueck in den React-Admin.
  const SEITEN = [
    { pfad: '/admin', titel: 'Übersicht',
      symbol: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>' },
    { pfad: '/admin/finanzen', titel: 'Finanzen',
      symbol: '<path d="M4 10h11M4 14h8" stroke-linecap="round"/><path d="M18.6 7.2A7.3 7.3 0 0 0 13.5 5 7.2 7.2 0 0 0 6.3 12a7.2 7.2 0 0 0 7.2 7c2 0 3.7-.7 5.1-2.2" stroke-linecap="round"/>',
      unter: [
        { pfad: '/admin/finanzen', titel: 'Einnahmen & Ausgaben' },
        { pfad: '/admin/finanzen/api', titel: 'API & Verbrauch' },
        { pfad: '/admin/finanzen/steuer', titel: 'Steuer' }
      ] },
    { pfad: '/admin/instagram', titel: 'Instagram',
      symbol: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
      unter: [
        { pfad: '/admin/instagram', titel: 'Profil' },
        { pfad: '/admin/content', titel: 'Content erstellen' },
        { pfad: '/admin/planen', titel: 'Content planen' },
        { pfad: '/admin/instagram/galerie', titel: 'Galerie' }
      ] },
    { pfad: '/admin/business', titel: 'Selbständigkeit',
      symbol: '<rect x="3" y="7.5" width="18" height="13" rx="2.2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18" stroke-linecap="round"/>',
      unter: [
        { pfad: '/admin/business', titel: 'Aufgaben & Notizen' },
        { pfad: '/admin/business/dokumente', titel: 'Dokumente' }
      ] },
    { pfad: '/admin/anfragen', titel: 'Anfragen',
      symbol: '<path d="M3 13.5h4.6l1.7 2.8h5.4l1.7-2.8H21" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.2 5.6 3 13.5V18a1.8 1.8 0 0 0 1.8 1.8h14.4A1.8 1.8 0 0 0 21 18v-4.5l-2.2-7.9A1.8 1.8 0 0 0 17.1 4H6.9a1.8 1.8 0 0 0-1.7 1.6z" stroke-linejoin="round"/>' }
  ];

  // Die Bildmarke: das Delta-Monogramm des AIY-Logos, als Pfad eingebettet
  // (viewBox 0 0 100 100). Loest den frueheren Schwung ab.
  const BILDMARKE = 'M90.45,89 L90.55,89 L90.95,88.96 L91.16,88.93 L91.5,88.85 L91.7,88.78 L92.02,88.64 L92.2,88.55 L92.5,88.36 L92.67,88.24 L92.93,88.01 L93.08,87.86 L93.3,87.59 L93.42,87.42 L93.6,87.11 L93.69,86.93 L93.82,86.6 L93.87,86.4 L93.95,86.06 L93.98,85.85 L93.99,85.5 L93.99,85.29 L93.95,84.94 L93.91,84.74 L93.82,84.4 L93.75,84.21 L93.58,83.84 L93.53,83.75 L70.47,42.47 L70.33,42.26 L70.15,42.09 L69.93,41.95 L69.7,41.86 L69.45,41.81 L69.2,41.81 L68.95,41.86 L68.72,41.96 L68.51,42.1 L68.33,42.28 L55.19,58.39 L55.03,58.64 L54.93,58.91 L54.9,59.21 L54.9,87.7 L54.92,87.95 L55,88.2 L55.12,88.42 L55.28,88.62 L55.48,88.78 L55.7,88.9 L55.95,88.98 L56.2,89 Z M36.03,30.83 L35.93,31.06 L35.88,31.32 L35.87,31.57 L35.92,31.83 L36.02,32.07 L36.16,32.28 L48.99,48.01 L49.17,48.19 L49.39,48.34 L49.62,48.44 L49.87,48.49 L50.13,48.49 L50.38,48.44 L50.61,48.34 L50.83,48.19 L51.01,48.01 L63.84,32.28 L63.98,32.07 L64.08,31.83 L64.13,31.57 L64.12,31.32 L64.07,31.06 L63.97,30.83 L53.08,11.34 L53.03,11.25 L52.82,10.93 L52.7,10.78 L52.47,10.53 L52.33,10.4 L52.07,10.19 L51.91,10.07 L51.62,9.91 L51.45,9.82 L51.14,9.7 L50.95,9.64 L50.62,9.56 L50.43,9.53 L50.1,9.51 L49.9,9.51 L49.57,9.53 L49.38,9.56 L49.05,9.64 L48.86,9.7 L48.55,9.82 L48.38,9.91 L48.09,10.07 L47.93,10.19 L47.67,10.4 L47.53,10.53 L47.3,10.78 L47.18,10.93 L46.97,11.25 L46.92,11.34 Z M6.47,83.75 L6.42,83.84 L6.25,84.21 L6.18,84.4 L6.09,84.74 L6.05,84.94 L6.01,85.29 L6.01,85.5 L6.02,85.85 L6.05,86.06 L6.13,86.4 L6.18,86.6 L6.31,86.93 L6.4,87.11 L6.58,87.42 L6.7,87.59 L6.92,87.86 L7.07,88.01 L7.33,88.24 L7.5,88.36 L7.8,88.55 L7.98,88.64 L8.3,88.78 L8.5,88.85 L8.84,88.93 L9.05,88.96 L9.45,89 L9.55,89 L43.8,89 L44.05,88.98 L44.3,88.9 L44.52,88.78 L44.72,88.62 L44.88,88.42 L45,88.2 L45.08,87.95 L45.1,87.7 L45.1,59.21 L45.07,58.91 L44.97,58.64 L44.81,58.39 L31.67,42.28 L31.49,42.1 L31.28,41.96 L31.05,41.86 L30.8,41.81 L30.55,41.81 L30.3,41.86 L30.07,41.95 L29.85,42.09 L29.67,42.26 L29.53,42.47 Z';

  // Die Seitenleiste wird hier gebaut statt in jeder Seite kopiert – sonst
  // laufen vier Dateien auseinander, sobald ein Menuepunkt dazukommt.
  // Unten in der Leiste steht, was frueher die Fusszeile trug: der Weg zur
  // Website, die Pflichtseiten, das Abmelden und der Hinweis auf den Ablauf
  // der Anmeldung. Eine eigene Fusszeile braucht ein Dashboard nicht.
  function kopf() {
    const ziel = document.getElementById('admin-kopf');
    if (!ziel) return;

    // Trailing Slash und .html ignorieren: /admin/, /admin/index.html und
    // /admin sind dieselbe Seite – sonst fehlt die Markierung, sobald die
    // Seite unter ihrem Dateinamen laeuft.
    const hier = (location.pathname
      .replace(/\/index\.html$/, '')
      .replace(/\.html$/, '')
      .replace(/\/+$/, '')) || '/admin';

    ziel.innerHTML = `
      <a class="admin-marke" href="/admin">
        <svg class="logo-mark" viewBox="0 0 100 100" width="30" height="30" aria-hidden="true">
          <path d="${BILDMARKE}" fill="#fff"/>
        </svg>
        <span class="admin-marke-wort">
          <b>AIY</b>
          <i>Verwaltung</i>
        </span>
      </a>
      <nav class="admin-nav" aria-label="Bereiche">
        ${SEITEN.map(s => {
          // Ein Bereich gilt als offen, wenn man auf ihm oder auf einer
          // seiner Unterseiten steht. Nur dann klappen die Unterpunkte aus –
          // sonst waere die Leiste eine Liste von zehn Eintraegen.
          const unter = s.unter || [];
          const drin = s.pfad === hier || unter.some(u => u.pfad === hier);
          return `<a href="${s.pfad}" title="${s.titel}"${drin ? ' class="active" aria-current="page"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${s.symbol}</svg>
            <span>${s.titel}</span>
          </a>${drin && unter.length ? `<span class="admin-unter">
            ${unter.map(u => `<a href="${u.pfad}"${u.pfad === hier ? ' class="hier"' : ''}>${u.titel}</a>`).join('')}
          </span>` : ''}`;
        }).join('')}
      </nav>
      <div class="admin-rand">
        <form method="POST" action="/admin/abmelden">
          <button type="submit" class="admin-abmelden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="16 17 21 12 16 7" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" stroke-linecap="round"/>
            </svg>
            <span>Abmelden</span>
          </button>
        </form>
        <span class="admin-rand-hinweis">Die Anmeldung läuft nach 12 Stunden ab.</span>
      </div>
      <!-- Nur der Pfeil, kein Wort: was er tut, zeigt die Leiste selbst im
           naechsten Moment. -->
      <button type="button" class="admin-klapp" aria-label="Leiste einklappen" title="Leiste einklappen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="14 6 8 12 14 18" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>`;

    klappen(ziel.querySelector('.admin-klapp'));
    wischen(ziel.querySelector('.admin-nav'));
  }

  // ─── Die Leiste als Zeile zum Wischen ───
  //
  // Auf schmalen Schirmen liegen die Punkte in einer Zeile, die man seitwaerts
  // schiebt. Der weiche rechte Rand (Maske im CSS) sagt, dass es weitergeht –
  // hier wird nur gemerkt, wann man am Ende ist, damit er dort verschwindet.
  // Ausserdem rueckt die aktuelle Seite ins Bild: sonst faengt die Zeile immer
  // bei "Uebersicht" an, auch wenn man auf der letzten Seite steht.
  function wischen(nav) {
    if (!nav) return;
    const pruefen = () => nav.classList.toggle('am-ende',
      nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2);
    nav.addEventListener('scroll', pruefen, { passive: true });
    window.addEventListener('resize', pruefen);

    const hier = nav.querySelector('a.active');
    if (hier && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = Math.max(0, hier.offsetLeft - 16);
    }
    pruefen();
  }

  // ─── Leiste einklappen ───
  //
  // Der Zustand liegt in localStorage, nicht in sessionStorage: er ist eine
  // Vorliebe, kein Datum – er darf das Abmelden ueberleben und wird beim
  // Aufraeumen des Zwischenspeichers nicht mitgeleert.
  function klappen(knopf) {
    if (!knopf) return;
    const setzen = zu => {
      // Am <html>, nicht am <body>: dieselbe Stelle, an der das
      // Kopf-Skript der Seiten die Klasse vor dem ersten Zeichnen setzt.
      document.documentElement.classList.toggle('leiste-zu', zu);
      knopf.setAttribute('aria-label', zu ? 'Leiste ausklappen' : 'Leiste einklappen');
      knopf.title = zu ? 'Leiste ausklappen' : 'Leiste einklappen';
    };
    let zu = false;
    try { zu = localStorage.getItem('adm-leiste') === 'zu'; } catch { /* egal */ }
    setzen(zu);
    knopf.addEventListener('click', () => {
      zu = !zu;
      setzen(zu);
      try { localStorage.setItem('adm-leiste', zu ? 'zu' : 'auf'); } catch { /* egal */ }
    });
  }

  // Fusszeile im Stil des Dashboards: eine leise Zeile unter dem Inhalt,
  // nicht die dunkle Leiste der Website. Traegt die Wege, die aus der
  // Seitenleiste herausgenommen wurden – dort steht nur noch das Abmelden.
  function fuss() {
    if (document.querySelector('.admin-fuss')) return;
    const f = document.createElement('footer');
    f.className = 'admin-fuss';
    f.innerHTML = `<div class="container">
      <span>© ${new Date().getFullYear()} AIY · Ihsan Yilmaz · Verwaltung</span>
      <nav class="admin-fuss-wege">
        <a href="/" target="_blank" rel="noopener">Website ansehen ↗</a>
      </nav>
    </div>`;
    document.body.appendChild(f);
  }

  // Das Datum ueber dem Seitentitel der Uebersicht. Steht im Markup als
  // "Verwaltung", damit ohne JavaScript keine leere Zeile bleibt.
  function datumszeile() {
    const el = document.getElementById('admin-datum');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('de-DE',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ─── Info-Punkte ───

  // Kleines "i" neben einer Ueberschrift. Reines CSS beim Aufklappen, damit
  // es auch per Tastatur funktioniert – deshalb tabindex und role.
  function info(text) {
    return `<span class="info" tabindex="0" role="note" aria-label="${schuetzen(text)}">
      <span class="info-zeichen" aria-hidden="true">i</span>
      <span class="info-blase" aria-hidden="true">${schuetzen(text)}</span>
    </span>`;
  }

  // ─── Kennzahl-Kacheln ───

  function trend(jetzt, davor) {
    if (davor == null || jetzt == null || davor === 0) return '';
    const diff = ((jetzt - davor) / davor) * 100;
    if (Math.abs(diff) < 1) return `<span class="mon-trend gleich">unverändert</span>`;
    const hoch = diff > 0;
    const wort = Math.abs(diff) >= 999 ? '999+' : Math.abs(diff).toFixed(0);
    return `<span class="mon-trend ${hoch ? 'hoch' : 'runter'}">${hoch ? '▲' : '▼'} ${wort} %</span>`;
  }

  function kachel(titel, wert, unter, hinweis, vergleich) {
    return `<div class="mon-kachel">
      <p class="mon-kachel-titel">${schuetzen(titel)}${hinweis ? info(hinweis) : ''}</p>
      <p class="mon-kachel-wert">${wert}</p>
      <p class="mon-kachel-unter">${vergleich || ''}${schuetzen(unter)}</p>
    </div>`;
  }

  const ERKLAERUNG = {
    besuche: 'Ein Besuch ist eine Sitzung, nicht ein Klick: Wer sich fünf Fahrzeuge ansieht, zählt einmal. Erkannte Bots sind herausgerechnet.',
    aufrufe: 'Jede einzeln aufgerufene Seite. Deshalb liegt diese Zahl immer über den Besuchen – sie zeigt, wie gründlich geschaut wird.',
    anfragen: 'Nur Formulare, die tatsächlich rausgegangen sind. Abgebrochene Versuche und Bots sind nicht mitgezählt.',
    quote: 'Anfragen geteilt durch Besuche. Bewusst ein grober Richtwert: Wer heute schaut, ruft oft erst nächste Woche an – dann fällt der Besuch in den einen Zeitraum und die Anfrage in den nächsten.'
  };

  // Liefert '' wenn beide Quellen ausgefallen sind – dann soll die Seite
  // lieber nichts zeigen als vier Nullen, die nach "nichts los" aussehen.
  function kennzahlen(daten, zeitraumText) {
    const f = daten.formulare || {};
    const b = daten.besucher || {};
    const d = daten.davor || {};

    const anfragen = f.ok
      ? Object.values(f.nachFormular).reduce((s, e) => s + (e.ok || 0), 0)
      : null;

    const kacheln = [];
    if (b.ok) {
      kacheln.push(kachel('Besuche', zahl(b.besuche), zeitraumText, ERKLAERUNG.besuche, trend(b.besuche, d.besuche)));
      kacheln.push(kachel('Seitenaufrufe', zahl(b.aufrufe), 'wie gründlich geschaut wird', ERKLAERUNG.aufrufe, trend(b.aufrufe, d.aufrufe)));
    }
    if (anfragen !== null) {
      kacheln.push(kachel('Anfragen', zahl(anfragen), 'erfolgreich abgeschickt', ERKLAERUNG.anfragen, trend(anfragen, d.anfragen)));
      // Nur sinnvoll, wenn beide Quellen Zahlen liefern.
      if (b.ok && b.besuche > 0) {
        const quote = (anfragen / b.besuche) * 100;
        kacheln.push(kachel('Anfrage je Besuch', quote.toFixed(1).replace('.', ',') + ' %', 'grober Richtwert', ERKLAERUNG.quote));
      }
    }

    return kacheln.length ? `<div class="mon-kennzahlen">${kacheln.join('')}</div>` : '';
  }

  // Eine Kennzahl als Pille. Wird von der Uebersicht und der Mietwagenseite
  // benutzt – dieselbe Optik an beiden Stellen, nur einmal beschrieben.
  function kpiFeld(wert, wort, art) {
    return `<div class="mf-kpi-feld">
      <b>${zahl(wert)}</b>
      <span>${art ? `<i class="mf-punkt ${art}"></i>` : ''}${schuetzen(wort)}</span>
    </div>`;
  }

  // ─── Betriebskachel (Mietwagen) ───

  // Was heute laeuft und was als Naechstes ansteht. Steht auf der
  // Mietwagenseite und auf der Uebersicht – deshalb hier und nicht dort.
  // Bekommt die Daten uebergeben, holt selbst nichts: die Seiten laden
  // Belegungen und Flotte ohnehin.
  const MON_SYMBOL = {
    unterwegs: '<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3h2m14-5a2 2 0 0 1 2 2v3h-2M7 16h10"/><circle cx="7.5" cy="16" r="1"/><circle cx="16.5" cy="16" r="1"/>',
    offen: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3v.5" stroke-linecap="round"/>'
  };
  const MON_BLOCKT = ['angefragt', 'bestaetigt'];
  const MON_STAENDE = {
    angefragt: 'Angefragt', bestaetigt: 'Bestätigt',
    abgesagt: 'Abgesagt', erledigt: 'Erledigt'
  };

  const monIso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monAusIso = t => { const [j, m, tg] = String(t).split('-').map(Number); return new Date(j, m - 1, tg); };
  const monDatum = t => monAusIso(t).toLocaleDateString('de-DE',
    { day: '2-digit', month: '2-digit', year: '2-digit' });

  const monFeld = (wert, wort, art) => `<span class="mf-mon-feld">
    ${MON_SYMBOL[art] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${MON_SYMBOL[art]}</svg>` : ''}
    <b>${zahl(wert)}</b><i>${wort}</i>
  </span>`;

  function monitorHtml(belegungen, flotte, verweis) {
    const heute = monIso(new Date());
    const datumText = new Date().toLocaleDateString('de-DE',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const fahrzeuge = new Map();
    (flotte || []).forEach(f => fahrzeuge.set(f.id, f));
    const online = (flotte || []).filter(f => f.aktiv).length;

    const laufend = (belegungen || []).filter(b => MON_BLOCKT.includes(b.status));
    const draussen = new Set(laufend.filter(b => b.von <= heute && b.bis > heute).map(b => b.fahrzeug_id)).size;
    const abholung = laufend.filter(b => b.von === heute).length;
    const rueckgabe = laufend.filter(b => b.bis === heute).length;
    const offen = (belegungen || []).filter(b => b.status === 'angefragt').length;

    // Der naechste Termin: die frueheste Abholung ab heute.
    const kommend = laufend
      .filter(b => b.von >= heute)
      .sort((x, y) => x.von.localeCompare(y.von) || (x.von_zeit || '').localeCompare(y.von_zeit || ''))[0];

    let naechst;
    if (kommend) {
      const f = fahrzeuge.get(kommend.fahrzeug_id);
      const name = kommend.fahrzeug || (f && f.name) || 'Fahrzeug';
      const bild = (f && f.bild) || '';

      // Wie lange und was es ungefaehr bringt: Tage mal Tagespreis. Bewusst
      // "ca." – Wochen- und Wochenendtarife sind hier nicht eingerechnet.
      const tage = Math.max(1, Math.round((monAusIso(kommend.bis) - monAusIso(kommend.von)) / 86400000));
      const tagespreis = f && f.preis_tag ? Number(f.preis_tag) : 0;
      const summe = tagespreis ? tage * tagespreis : 0;

      // "in 2 Tagen" sagt mehr als ein Datum, das man erst einordnen muss.
      const hin = Math.round((monAusIso(kommend.von) - monAusIso(heute)) / 86400000);
      const wann = hin === 0 ? 'heute' : hin === 1 ? 'morgen' : `in ${hin} Tagen`;

      naechst = `<div class="mf-mon-naechst">
        <span class="mf-mon-bild">${bild
          ? `<img src="${schuetzen(bild)}" alt="" loading="lazy" />`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${MON_SYMBOL.unterwegs}</svg>`}</span>
        <span class="mf-mon-naechst-text">
          <i>Als Nächstes · Abholung ${wann}</i>
          <b>${schuetzen(name)}</b>
          <span>${monDatum(kommend.von)}${kommend.von_zeit ? ' um ' + schuetzen(kommend.von_zeit) + ' Uhr' : ''}
            bis ${monDatum(kommend.bis)}${kommend.bis_zeit ? ' ' + schuetzen(kommend.bis_zeit) + ' Uhr' : ''}</span>
        </span>
        <span class="mf-mon-werte">
          <span><b>${tage}</b><i>${tage === 1 ? 'Tag' : 'Tage'}</i></span>
          ${summe ? `<span title="${tage} × ${zahl(tagespreis)} € Tagespreis"><b>ca. ${zahl(summe)} €</b><i>Tarif</i></span>` : ''}
          ${kommend.notiz ? `<span class="mf-mon-notiz">${schuetzen(kommend.notiz)}</span>` : ''}
        </span>
        <span class="mf-bel-stand ${schuetzen(kommend.status)}">${MON_STAENDE[kommend.status] || kommend.status}</span>
      </div>`;
    } else {
      naechst = '<div class="mf-mon-naechst leer">Als Nächstes steht nichts an.</div>';
    }

    const ziel = verweis || { pfad: '#mf-bel', wort: 'Zur Belegung ↓' };

    return `<div class="mf-mon-kopf">
        <span class="mf-mon-datum">${datumText}</span>
        <a class="mf-mon-link" href="${ziel.pfad}">${schuetzen(ziel.wort)}</a>
      </div>
      <div class="mf-mon-felder">
        ${monFeld(offen, offen === 1 ? 'offene Anfrage' : 'offene Anfragen', 'offen')}
        ${monFeld(draussen, online ? `von ${zahl(online)} unterwegs` : 'unterwegs', 'unterwegs')}
        ${monFeld(abholung, abholung === 1 ? 'Abholung heute' : 'Abholungen heute')}
        ${monFeld(rueckgabe, rueckgabe === 1 ? 'Rückgabe heute' : 'Rückgaben heute')}
      </div>
      ${naechst}`;
  }

  // ─── Seitenwahl ───

  // Blaettern statt Aufklappen: bei dreissig Eintraegen ist "alle zeigen"
  // keine Hilfe, man sucht ja einen bestimmten. Liefert das Markup; die
  // Knoepfe verdrahtet blaetternVerdrahten() mit einer Rueckmeldung.
  //
  // Bei mehr als sieben Seiten stehen nicht alle Nummern da, sondern Anfang,
  // Ende und die Umgebung der aktuellen Seite – sonst wird die Leiste selbst
  // zum laengsten Teil der Liste.
  function blaettern(gesamt, seite, proSeite, kennung) {
    const seiten = Math.ceil(gesamt / proSeite);
    if (seiten < 2) return '';

    const zeigen = new Set([1, seiten, seite, seite - 1, seite + 1]);
    if (seite <= 3) { zeigen.add(2); zeigen.add(3); }
    if (seite >= seiten - 2) { zeigen.add(seiten - 1); zeigen.add(seiten - 2); }

    let inhalt = '', letzte = 0;
    for (let i = 1; i <= seiten; i++) {
      if (!zeigen.has(i)) continue;
      if (letzte && i - letzte > 1) inhalt += '<span class="blatt-luecke">…</span>';
      inhalt += `<button type="button" class="blatt-zahl${i === seite ? ' hier' : ''}"
        data-blatt="${kennung}" data-seite="${i}"${i === seite ? ' aria-current="page"' : ''}>${i}</button>`;
      letzte = i;
    }

    return `<nav class="blatt" aria-label="Seiten">
      <button type="button" class="blatt-pfeil" data-blatt="${kennung}" data-seite="${seite - 1}"
        ${seite === 1 ? 'disabled' : ''} aria-label="Vorherige Seite">‹</button>
      ${inhalt}
      <button type="button" class="blatt-pfeil" data-blatt="${kennung}" data-seite="${seite + 1}"
        ${seite === seiten ? 'disabled' : ''} aria-label="Nächste Seite">›</button>
    </nav>`;
  }

  function blaetternVerdrahten(wurzel, kennung, weiter) {
    wurzel.querySelectorAll(`[data-blatt="${kennung}"]`).forEach(k =>
      k.addEventListener('click', () => weiter(Number(k.dataset.seite))));
  }

  // ─── Rueckfrage ───

  // Eigene Maske statt window.confirm: das Browserfenster sieht auf jedem
  // System anders aus, laesst sich nicht gestalten und wirkt neben der
  // uebrigen Oberflaeche wie ein Fremdkoerper. Liefert ein Versprechen,
  // damit der Aufrufer wie bei confirm() weiterarbeiten kann.
  function frage(einstellung) {
    const { titel, text, knopf = 'Löschen', abbruch = 'Abbrechen' } = einstellung || {};

    return new Promise(fertig => {
      const schicht = document.createElement('div');
      schicht.className = 'frage-schicht';
      schicht.innerHTML = `<div class="frage-tafel" role="alertdialog" aria-modal="true"
             aria-labelledby="frage-titel" aria-describedby="frage-text">
        <h2 id="frage-titel">${schuetzen(titel || 'Sind Sie sicher?')}</h2>
        <p id="frage-text">${schuetzen(text || '')}</p>
        <div class="frage-knoepfe">
          <button type="button" class="frage-nein">${schuetzen(abbruch)}</button>
          <button type="button" class="frage-ja">${schuetzen(knopf)}</button>
        </div>
      </div>`;
      document.body.appendChild(schicht);
      document.body.style.overflow = 'hidden';

      const vorher = document.activeElement;
      const nein = schicht.querySelector('.frage-nein');
      const ja = schicht.querySelector('.frage-ja');
      // Der harmlose Knopf hat den Fokus: ein versehentliches Enter soll
      // nichts loeschen.
      nein.focus();

      function schliessen(antwort) {
        document.removeEventListener('keydown', taste, true);
        schicht.remove();
        document.body.style.overflow = '';
        if (vorher && vorher.focus) vorher.focus();
        fertig(antwort);
      }

      function taste(e) {
        if (e.key === 'Escape') { e.preventDefault(); schliessen(false); return; }
        // Fokus im Fenster halten, solange es offen ist.
        if (e.key !== 'Tab') return;
        const felder = [nein, ja];
        const i = felder.indexOf(document.activeElement);
        e.preventDefault();
        felder[(i + (e.shiftKey ? -1 : 1) + felder.length) % felder.length].focus();
      }

      nein.addEventListener('click', () => schliessen(false));
      ja.addEventListener('click', () => schliessen(true));
      schicht.addEventListener('click', e => { if (e.target === schicht) schliessen(false); });
      document.addEventListener('keydown', taste, true);
    });
  }

  // ─── Letzter Stand ───
  //
  // Die Zahlen im Monitoring kommen aus zwei fremden Quellen und brauchen je
  // nach Tageszeit eine Sekunde oder drei. Beim Wechsel zwischen den
  // Adminseiten stand deshalb jedes Mal "wird geladen" da – obwohl dieselben
  // Zahlen eben noch auf dem Schirm waren. Das fuehlt sich langsamer an, als
  // es ist.
  //
  // Also: den letzten Stand sofort zeichnen, den Abruf daneben laufen lassen
  // und danach ersetzen. Waehrenddessen laeuft oben ein duenner Strich – wer
  // hinschaut, sieht, dass die Zahlen noch nicht die frischesten sind.
  //
  // sessionStorage und nicht localStorage: in den Notizen an Belegungen
  // koennen Namen stehen, und der Zwischenspeicher soll den Tab nicht
  // ueberleben. Beim Abmelden wird er zusaetzlich geleert.
  const HALTBAR = 6 * 3600 * 1000;

  function merken(schluessel, daten) {
    try {
      sessionStorage.setItem('adm:' + schluessel,
        JSON.stringify({ t: Date.now(), d: daten }));
    } catch { /* voller oder gesperrter Speicher ist kein Grund zu scheitern */ }
  }

  // nurHeute: fuer alles, was sich auf "heute" bezieht – ueber Mitternacht
  // hinweg waere der alte Stand nicht nur alt, sondern falsch.
  function erinnern(schluessel, nurHeute) {
    try {
      const roh = sessionStorage.getItem('adm:' + schluessel);
      if (!roh) return null;
      const e = JSON.parse(roh);
      if (!e || Date.now() - e.t > HALTBAR) return null;
      if (nurHeute && new Date(e.t).toDateString() !== new Date().toDateString()) return null;
      return e.d;
    } catch {
      return null;
    }
  }

  function vergessen() {
    try {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith('adm:'))
        .forEach(k => sessionStorage.removeItem(k));
    } catch { /* siehe oben */ }
  }

  // Zeigt an, dass gerade nachgeladen wird, ohne den Inhalt anzufassen.
  const frischen = (el, an) => el && el.classList.toggle('wird-frisch', !!an);

  // ─── Daten holen ───

  async function holen(suchteil) {
    const antwort = await fetch('/api/studio/monitoring?' + suchteil, { credentials: 'same-origin' });
    if (antwort.status === 401) { location.href = '/admin'; throw new Error('nicht angemeldet'); }
    const daten = await antwort.json().catch(() => null);
    if (!antwort.ok) throw new Error(daten?.fehler || 'HTTP ' + antwort.status);
    return daten;
  }

  kopf();
  fuss();
  datumszeile();

  // Abmelden raeumt auf: der naechste Nutzer an diesem Rechner soll keine
  // Zahlen mehr vorfinden, auch nicht aus dem Zwischenspeicher.
  document.querySelector('form[action="/admin/abmelden"]')
    ?.addEventListener('submit', vergessen);

  return { zahl, schuetzen, kachel, kennzahlen, holen, info, kpiFeld,
           blaettern, blaetternVerdrahten, frage, monitorHtml,
           merken, erinnern, frischen };
})();
