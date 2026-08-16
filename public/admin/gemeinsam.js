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
  // Übersicht/Profil/Galerie führen zurück in den React-Admin, "Content
  // erstellen" ist dieses portierte Studio.
  const SEITEN = [
    { pfad: '/admin', titel: 'Übersicht',
      symbol: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>' },
    { pfad: '/admin/instagram', titel: 'Instagram',
      symbol: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
      unter: [
        { pfad: '/admin/instagram', titel: 'Profil' },
        { pfad: '/admin/content', titel: 'Content erstellen' },
        { pfad: '/admin/instagram/galerie', titel: 'Galerie' }
      ] }
  ];

  const SCHWUNG = 'M6.0,41.1 C7.5,40.8 11.9,40.2 14.9,39.2 C17.8,38.3 20.8,36.8 23.7,35.6 C26.6,34.2 29.6,32.9 32.6,31.7 C35.5,30.4 38.5,29.3 41.4,28.1 C44.3,26.9 47.3,25.7 50.3,24.7 C53.2,23.7 56.2,22.7 59.1,21.8 C62.0,21.0 65.0,20.2 68.0,19.4 C70.9,18.7 73.9,17.9 76.8,17.2 C79.7,16.7 82.7,16.2 85.7,15.9 C88.6,15.7 91.6,15.7 94.5,15.7 C97.4,15.7 100.4,15.6 103.4,15.9 C106.3,16.3 109.3,16.9 112.2,17.7 C115.1,18.6 118.1,19.6 121.1,21.0 C124.0,22.2 127.0,23.8 129.9,25.6 C132.8,27.3 135.8,29.5 138.8,31.4 C141.7,33.4 144.7,35.5 147.6,37.0 C150.5,38.4 153.5,39.4 156.5,40.0 C159.4,40.5 162.4,40.4 165.3,40.5 C168.2,40.6 171.2,40.5 174.2,40.7 C177.1,40.9 180.1,41.1 183.0,41.6 C185.9,41.9 189.0,42.4 191.9,43.0 C194.8,43.6 197.8,44.5 200.7,45.4 C203.6,46.3 207.4,47.7 209.6,48.4 C211.8,49.1 213.3,49.6 214.0,49.7';

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
        <svg class="logo-mark" viewBox="0 0 220 64" fill="none" aria-hidden="true">
          <text x="0" y="46" fill="#fff" font-family="system-ui, sans-serif" font-size="44" font-weight="800" letter-spacing="1">AIY</text>
          <path d="${SCHWUNG}" transform="translate(96,-8) scale(0.55)" stroke="#3D7EA6" stroke-width="7" stroke-linecap="round"/>
        </svg>
        <span>Verwaltung</span>
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
