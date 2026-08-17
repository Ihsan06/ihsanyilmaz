// Social-Media-Seite: die Instagram-Zahlen, der Stand des Bestands-
// Gedaechtnisses und die Warteschlange der Fahrzeuge ohne Beitrag.
//
// Der Abgleich mit mobile.de haengt an dieser Seite: Cloudflare Pages kennt
// keine Zeitsteuerung, also laeuft er, wenn hier jemand hereinschaut. Der
// Endpunkt begrenzt das selbst auf hoechstens alle 15 Minuten – der Knopf
// "Jetzt abgleichen" umgeht diese Sperre bewusst.
(function () {
  const { zahl, schuetzen, info } = window.admin;
  // Die Beitragsansicht und die Instagram-Nachbildung teilt sich diese Seite
  // mit der Uebersicht – siehe admin/beitrag-schau.js.
  const { vorschau, bildKasten, VORSCHAU_ZEICHEN } = window.beitragSchau;

  // Seit der Aufteilung gibt es zwei Seiten: Statistiken traegt die
  // Instagram-Kachel, Neuer Content den Baukasten. Die Datei bedient beide –
  // was auf der Seite fehlt, wird schlicht uebersprungen.
  const karte  = document.getElementById('gd-inhalt');
  const liste  = document.getElementById('gd-liste');
  // Die Instagram-Zahlen stehen auf der Profilseite auch dann, wenn es dort
  // weder Bestandszeile noch Baukasten gibt – seit die Bestandszeile zu den
  // Stories gewandert ist, war das der Fall, und der Ausstieg hier hat die
  // ganze Seite beim Laden stehenlassen.
  if (!karte && !liste && !document.getElementById('ig-inhalt')) return;

  const tag = iso => new Date(iso).toLocaleDateString('de-DE',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhr = iso => new Date(iso).toLocaleTimeString('de-DE',
    { hour: '2-digit', minute: '2-digit' });
  // Wird nur noch beim Instagram-Stand gebraucht – der Abgleichzeitpunkt des
  // Bestands stand als Hinweis unter der Kachel und ist dort raus.
  const wann = iso => (new Date().toDateString() === new Date(iso).toDateString()
    ? `heute, ${uhr(iso)}` : `${tag(iso)}, ${uhr(iso)}`);

  const tageSeit = iso => Math.floor((Date.now() - new Date(iso)) / 86400000);

  const stehtSeit = iso => {
    const t = tageSeit(iso);
    if (t <= 0) return 'seit heute im Bestand';
    if (t === 1) return 'seit gestern im Bestand';
    return `seit ${t} Tagen im Bestand`;
  };

  // Kein Knopf zum Erzwingen: der Abgleich laeuft beim Oeffnen der Seite,
  // und die 15 Minuten Schonfrist danach fallen neben den Verzoegerungen
  // bei mobile.de selbst nicht ins Gewicht.
  async function laden() {
    // Beide Ziele koennen fehlen: die Kachel gibt es nur auf der Statistik-,
    // die Liste nur auf der Content-Seite. Genau hier ist es vorher
    // gescheitert – und weil laden() ganz am Anfang steht, blieb danach
    // alles stehen, auch der Baukasten.
    if (karte) karte.innerHTML = '<p class="mon-laedt">Wird abgeglichen …</p>';

    try {
      const antwort = await fetch('/api/studio/bestand', { credentials: 'same-origin' });
      if (antwort.status === 401) { location.href = '/admin'; return; }
      const d = await antwort.json();
      if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + antwort.status);
      zeichnen(d);
    } catch (err) {
      // Der Fehler steht hier bewusst im Klartext: diese Seite ist die
      // einzige Stelle, an der man merkt, dass der Abgleich haengt.
      const fehler = `<div class="gd-fehler">
        <b>Der Abgleich hat nicht geklappt.</b>
        <span>${schuetzen(err.message)}</span>
      </div>`;
      if (karte) karte.innerHTML = fehler;
      else if (liste) liste.innerHTML = fehler;
      else return;
      if (karte && liste) liste.innerHTML = '';
    }
  }

  let letzteDaten = null;

  function zeichnen(d) {
    letzteDaten = d;
    // Untergeordnet zu Follower und Beitraegen: kleinere Zahlen, eine Zeile,
    // ein feiner Strich darueber. Der Bestand ist kein Erfolg, sondern der
    // Vorrat – er sagt, wie viel Stoff fuer Beitraege noch da ist.
    // Die Zeile steht bei den Stories: dort sagt sie, wie viele Fahrzeuge noch
    // ins Highlight muessen. Bei den Zahlen des Profils sagte sie nichts.
    const istStory = format === 'story';
    if (karte) karte.hidden = !istStory;
    if (karte && istStory) karte.innerHTML = `<div class="gd-unter">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
        <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11m-14 0h14m-14 0a2 2 0 0 0-2 2v3h2m14-5a2 2 0 0 1 2 2v3h-2M7 16h10"/>
        <circle cx="7.5" cy="16" r="1"/><circle cx="16.5" cy="16" r="1"/>
      </svg>
      <span class="gd-unter-titel">Bestand</span>
      <span class="gd-unter-wert"><b>${zahl(d.imBestand)}</b> im Bestand</span>
      <span class="gd-unter-wert${(istStory ? d.ohneStory : d.ohneBeitrag) ? ' offen' : ''}">
        <b>${zahl(istStory ? d.ohneStory : d.ohneBeitrag)}</b>
        Fahrzeuge ohne ${istStory ? 'Story' : 'Beitrag'}</span>
    </div>

      ${d.fehler ? `<p class="gd-notiz">Hinweis: ${schuetzen(d.fehler)}</p>` : ''}`;

    // Ohne Baukasten auf dieser Seite ist hier Schluss – die Statistikseite
    // traegt nur die Kachel darueber.
    if (!liste) { aufraeumen(d.gepostet || []); return; }


    if (quelle === 'galerie') werkstattZeigen();
    else zeichneListe(d.warteschlange || []);
    aufraeumen(d.gepostet || []);   // steigt selbst aus, wo es die Kachel nicht gibt
  }

  // Ein Fahrzeug, das aus dem Bestand verschwindet, ist verkauft – steht es
  // aber noch in einem Highlight, fuehrt der Beitrag Leute auf ein Auto zu,
  // das es nicht mehr gibt. Highlights kann keine Schnittstelle pflegen
  // (Meta bietet dafuer keinen Endpunkt), also erinnert die Seite daran.
  function aufraeumen(gepostet) {
    const ziel = document.getElementById('gd-aufraeumen');
    if (!ziel) return;
    const weg = gepostet.filter(e => e.verschwunden_am);
    if (!weg.length) { ziel.innerHTML = ''; return; }

    ziel.innerHTML = `<div class="sm-kopf" style="margin-top:20px"><b>Nicht mehr im Bestand</b>
        <span>${zahl(weg.length)} mit Beitrag</span></div>
      <ul class="gd-liste">
        ${weg.slice(0, 8).map(e => `<li>
          <div class="gd-bild">${e.bild
            ? `<img src="${schuetzen(e.bild)}" alt="" loading="lazy" />`
            : '<span>kein Foto</span>'}</div>
          <div class="gd-text">
            <b>${schuetzen(e.titel || 'Fahrzeug')}</b>
            <span>verkauft am ${schuetzen(tag(e.verschwunden_am))}</span>
          </div>
          <span class="gd-marke">verkauft</span>
        </li>`).join('')}
      </ul>
      <p class="gd-notiz">Steht eines davon noch in einem Highlight, dort herausnehmen –
        sonst führt der Beitrag auf ein Auto, das es nicht mehr gibt.</p>`;
  }

  function feld(wert, wort, erklaerung, zusatz) {
    return `<div class="gd-feld">
      ${erklaerung ? `<span class="gd-feld-info">${info(erklaerung)}</span>` : ''}
      <b>${typeof wert === 'number' ? zahl(wert) : schuetzen(wert)}</b>
      <span>${schuetzen(wort)}</span>
      ${zusatz ? `<span class="gd-feld-zusatz">${schuetzen(zusatz)}</span>` : ''}
    </div>`;
  }

  // Zwei Fragen, zwei Achsen – und lange waren sie vermischt. Oben WAS
  // entsteht, darunter WORAUS. Frueher stand "Werkstatt & Team" (eine
  // Bildquelle) neben "Stories" (ein Format), und deshalb liess sich eine
  // Story aus eigenen Fotos gar nicht bauen: die Kombination war im Aufbau
  // nicht vorgesehen.
  // Jedes Format hat genau eine Quelle, deshalb gibt es keine Wahl mehr:
  // Beitraege UND Stories entstehen aus den eigenen Fotos der Galerie.
  // Der fruehere Nebenweg ueber den Fahrzeug-Bestand (samt Wechseln-Knopf)
  // ist raus – hier gibt es keinen Fahrzeugbestand.
  //
  // Reels sind raus. Ohne bewegtes Material ist ein Reel eine Diashow, und die
  // faellt bei Instagram durch; kommt Videomaterial dazu, kommt der Reiter
  // zurueck.
  const FORMATE = ['beitrag', 'story'];
  const QUELLE_JE_FORMAT = { beitrag: 'galerie', story: 'galerie' };
  let format = 'beitrag';
  try {
    const f = localStorage.getItem('sm-format');
    if (FORMATE.includes(f)) format = f;
  } catch { /* egal */ }
  let quelle = QUELLE_JE_FORMAT[format];

  // ?bearbeiten=<Nr>: ein Eintrag aus der Warteschlange (Content planen) als
  // Ausgangslage – Format uebernehmen, Bilder vorwaehlen, Text einsetzen.
  // Wird der ueberarbeitete Beitrag dann eingeplant oder direkt gepostet,
  // raeumt sich der alte Eintrag selbst weg.
  let bearbeitung = null;
  let bearbeitungId = Number(new URLSearchParams(location.search).get('bearbeiten')) || 0;
  // Der urspruengliche Zeitpunkt des Eintrags: das Planen-Fenster schlaegt
  // ihn wieder vor, solange er nicht schon vorbei ist.
  let bearbeitungZeit = null;

  function alteBearbeitungWegraeumen() {
    if (!bearbeitungId) return;
    fetch('/api/studio/warteschlange?id=' + bearbeitungId,
      { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
    bearbeitungId = 0;
  }

  // Die vollen Fahrzeugdaten (Ausstattung, km, Erstzulassung) stehen nicht im
  // Gedaechtnis, sondern nur im Bestand – deshalb einmal nachladen und merken.
  let fahrzeuge = null;
  async function fahrzeugHolen(id) {
    if (!fahrzeuge) {
      try {
        const a = await fetch('/api/studio/vehicles', { credentials: 'same-origin' });
        const d = await a.json();
        fahrzeuge = new Map((d.vehicles || []).map(v => [String(v.id), v]));
      } catch { fahrzeuge = new Map(); }
    }
    return fahrzeuge.get(String(id)) || null;
  }

  // Kacheln statt Zeilen: Es geht um Bildbeitraege, und eine Briefmarke
  // neben einer Zeile sagt nichts darueber, ob ein Foto taugt.
  function zeichneListe(eintraege) {
    if (!eintraege.length) {
      liste.innerHTML = '<p class="mon-leer">Alle Fahrzeuge im Bestand hatten schon einen Beitrag.</p>';
      return;
    }

    // Der Baukasten hat seinen festen Platz ueber der Liste. Vorher klappte
    // er zwischen den Kacheln auf – dann verschob sich alles darunter, und
    // beim naechsten Fahrzeug sprang die Seite erneut.
    liste.innerHTML = `<div class="sm-ausgabe" id="gd-baukasten"><p class="mon-laedt">Wird gebaut …</p></div>
      <div class="sm-kopf gd-weitere"><b>Weitere Fahrzeuge</b>
        <span>${zahl(eintraege.length)} ohne Beitrag</span></div>
      <div class="gd-karten">
      ${eintraege.map(e => `<article class="gd-karte-fz" data-id="${schuetzen(e.fahrzeug_id)}">
        <span class="gd-foto">
          ${e.bild ? `<img src="${schuetzen(e.bild)}" alt="" loading="lazy" />`
                   : '<span class="ig-leer">kein Foto</span>'}
        </span>
        <div class="gd-karte-text">
          <b>${schuetzen(e.titel || e.marke || 'Fahrzeug')}</b>
          <span>${schuetzen(stehtSeit(e.zuerst_gesehen))}</span>
        </div>
        <button type="button" class="btn-klein gd-bauen" data-id="${schuetzen(e.fahrzeug_id)}">
          ${format === 'story' ? 'Story bauen' : 'Beitrag bauen'}
        </button>
      </article>`).join('')}
    </div>`;

    // Die ganze Kachel ist der Knopf. Vorher fuehrte das Bild auf die
    // Fahrzeugseite – ein zweites Ziel in derselben Kachel, und ausgerechnet
    // die groesste Flaeche tat etwas anderes als der Knopf darunter.
    liste.querySelectorAll('.gd-karte-fz').forEach(k =>
      k.addEventListener('click', () => bauenUndZeigen(k.dataset.id, 0)));

    // Das erste Fahrzeug ist beim Oeffnen schon gebaut – so steht nie eine
    // leere Flaeche da, und der haeufigste Fall (der neueste Wagen) ist mit
    // null Klicks erledigt.
    bauenUndZeigen(eintraege[0].fahrzeug_id, 0);
  }

  // ─── Beitrag / Reel bauen ───

  async function bauenUndZeigen(id, variante) {
    const feld = document.getElementById('gd-baukasten');
    if (!feld) return;

    // Welche Kachel gerade oben liegt, soll man unten sehen.
    liste.querySelectorAll('.gd-karte-fz').forEach(k =>
      k.classList.toggle('hier', k.dataset.id === id));

    feld.innerHTML = '<p class="mon-laedt">Wird gebaut …</p>';
    // Steht der Baukasten ausserhalb des Blicks, holt ihn das sanft heran –
    // sonst aendert sich oben etwas, das man unten nicht sieht.
    const oben = feld.getBoundingClientRect().top;
    if (oben < 0) window.scrollTo({ top: feld.offsetTop - 90, behavior: 'smooth' });

    const v = await fahrzeugHolen(id);
    if (!v) {
      feld.innerHTML = `<div class="gd-fehler"><b>Fahrzeugdaten nicht gefunden.</b>
        <span>Das Fahrzeug steht im Gedächtnis, aber nicht mehr im aktuellen Bestand.</span></div>`;
      return;
    }

    feld.dataset.fahrzeug = id;
    feld.innerHTML = format === 'story' ? storyHtml(v, variante) : beitragHtml(v, variante);
    verdrahten(feld, id, variante);
    bilderLaden(feld, id);
  }

  // ─── Bilder ───
  //
  // Die Liste von mobile.de traegt je Fahrzeug nur das Titelbild, die volle
  // Galerie kommt ueber /api/studio/bilder. Vorausgewaehlt sind die ersten fuenf:
  // bei mobile.de steht das Hauptbild vorn, danach folgt der uebliche
  // Rundgang. Wer eine andere Reihenfolge will, tippt sie sich zusammen.
  const BILDER_ZEIGEN = 12;
  const BILDER_WAEHLEN = 5;

  // Was zu einem Fahrzeug dazugeladen wurde, je Fahrzeug gemerkt: die Liste
  // aus dem Inserat kennt es nicht.
  const fzDazu = {};

  async function bilderLaden(feld, id) {
    const ziel = feld.querySelector('.sm-bilder');
    if (!ziel) return;
    try {
      const a = await fetch('/api/studio/bilder?ids=' + encodeURIComponent(id), { credentials: 'same-origin' });
      const d = await a.json();
      const alle = [...(fzDazu[id] || []), ...((d.bilder && d.bilder[id]) || [])];
      if (!alle.length) { ziel.innerHTML = '<p class="mon-leer">Zu diesem Fahrzeug liegen keine Fotos vor.</p>'; return; }

      // Hat das Modell eine Reihenfolge vorgeschlagen, steht sie vorn und ist
      // ausgewaehlt – sonst wie immer die ersten fuenf.
      const e = fzEigen[id];
      const vorn = (e && e.bilder) || [];
      const sortiert = vorn.length
        ? [...vorn.filter(u => alle.includes(u)), ...alle.filter(u => !vorn.includes(u))]
        : alle;
      const gewaehlt = (u, i) => (vorn.length ? vorn.includes(u) : i < BILDER_WAEHLEN);

      const zeigen = sortiert.slice(0, BILDER_ZEIGEN);
      ziel.innerHTML = `<div class="sm-raster">
        ${`<label class="sm-foto sm-foto-neu" title="Fotos hinzufügen">
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-dazu-fz />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 6v12M6 12h12" stroke-linecap="round"/>
      </svg>
      <span>Fotos</span>
    </label>`}
        ${zeigen.map((u, i) => `<button type="button" class="sm-foto${gewaehlt(u, i) ? ' aktiv' : ''}"
            data-u="${schuetzen(u)}" aria-pressed="${gewaehlt(u, i)}">
          <img src="${schuetzen(u)}" alt="" loading="lazy" />
          <span class="sm-haken">✓</span>
        </button>`).join('')}
      </div>
`;

      const fuss = feld.querySelector('.sm-fuss') || ziel;
      fuss.innerHTML = `<div class="sm-knoepfe">
        <button type="button" class="btn-klein" data-posten>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
             stroke-width="2" aria-hidden="true">
          <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2"/>
          <circle cx="12" cy="12" r="4.1"/>
          <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none"/>
        </svg>
          <span>Direkt posten</span></button>
        <button type="button" class="btn-klein sm-teilen" data-teilen>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="1.9" aria-hidden="true">
            <path d="M4 12v7a1.6 1.6 0 0 0 1.6 1.6h12.8A1.6 1.6 0 0 0 20 19v-7"
                  stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 15.5V3.4M12 3.4 7.8 7.6M12 3.4l4.2 4.2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Beitrag teilen</span></button>
        ${planKnopf()}
        <span class="sm-meldung"></span>
      </div>`;

      const dazu = ziel.querySelector('[data-dazu-fz]');
      if (dazu) dazu.addEventListener('change', async () => {
        const dateien = [...(dazu.files || [])];
        if (!dateien.length) return;
        const wort = ziel.querySelector('.sm-foto-neu span');
        const alt = wort ? wort.textContent : '';
        if (wort) wort.textContent = 'Wird geladen …';
        try {
          const formular = new FormData();
          dateien.forEach(f => formular.append('datei', f));
          const a = await fetch('/api/studio/vorrat', {
            method: 'POST', credentials: 'same-origin', body: formular
          });
          const d2 = await a.json();
          if (!d2 || !d2.ok) throw new Error((d2 && d2.fehler) || 'HTTP ' + a.status);
          fzDazu[id] = [...(d2.angelegt || []).map(s => '/bilder/' + s), ...(fzDazu[id] || [])];
          vorrat = null;                 // die Galerie hat jetzt mehr
          await bilderLaden(feld, id);
        } catch (err) {
          if (wort) { wort.textContent = 'Ging nicht'; setTimeout(() => { wort.textContent = alt; }, 4000); }
          console.error('Fotos zum Fahrzeug:', err);
        }
      });

      if (!feld.querySelector('[data-reihe]')) {
        const kasten = document.createElement('div');
        kasten.setAttribute('data-reihe', '');
        ziel.after(kasten);
      }
      reiheZeichnen(feld);

      const zaehlen = () => {
        const n = ziel.querySelectorAll('.sm-foto.aktiv').length;
        const s = feld.querySelector('.sm-stand');
        if (s) s.textContent = `${n} von ${zeigen.length} ausgewählt`;
      };
      // :not(.sm-foto-neu) – die Kachel "Fotos hinzufügen" traegt dieselbe
      // Klasse, aber kein data-u. Ohne die Einschraenkung liess sie sich
      // auswaehlen: der Zaehler stieg, und in der Auswahl lag undefined.
      ziel.querySelectorAll('.sm-foto:not(.sm-foto-neu)').forEach(k => k.addEventListener('click', () => {
        k.classList.toggle('aktiv');
        k.setAttribute('aria-pressed', String(k.classList.contains('aktiv')));
        zaehlen();
        vorschauBild(feld);
        reiheZeichnen(feld);
      }));
      zaehlen();
      vorschauBild(feld);

      const teilenKnopf = fuss.querySelector('[data-teilen]');
      if (teilenKnopf) teilenKnopf.addEventListener('click', () => teilen(feld, ziel, teilenKnopf));
      veroeffentlichenVerdrahten(feld, fuss, ziel);
      planFensterVerdrahten(feld, fuss, ziel);
    } catch (err) {
      ziel.innerHTML = `<div class="gd-fehler"><b>Bilder konnten nicht geladen werden.</b>
        <span>${schuetzen(err.message)}</span></div>`;
    }
  }

  // Am Telefon uebergibt der Browser Text und Bilder direkt an Instagram.
  // Am Rechner gibt es das nicht – dort werden die Bilder heruntergeladen
  // und der Text liegt ohnehin schon zum Kopieren daneben.
  // Der Knopf zeigt nur Zeichen – die Rueckmeldung steht daneben, sonst
  // waechst und schrumpft er bei jedem Schritt.
  function knopfText(knopf, wort) {
    knopf.title = wort;
    const zeile = knopf.parentElement && knopf.parentElement.querySelector('.sm-meldung');
    if (zeile) zeile.textContent = wort;
  }

  async function teilen(feld, ziel, knopf, mitgegeben) {
    const wege = mitgegeben || [...ziel.querySelectorAll('.sm-foto.aktiv')].map(k => k.dataset.u);
    if (!wege.length) { knopfText(knopf, 'Erst Bilder auswählen'); return; }

    const text = (feld.querySelector('[data-kopie]') || {}).textContent || '';
    const fahrzeug = feld.dataset.fahrzeug || '';
    const hoch = !!feld.querySelector('.igv-hoch');
    knopf.disabled = true;
    knopfText(knopf, 'Bilder werden zugeschnitten …');

    try {
      // Der Text geht VOR dem Teilen in die Zwischenablage: Instagram
      // uebernimmt beim Teilen von Bildern die Bildunterschrift nicht, man
      // muss sie einfuegen. Liegt sie schon in der Ablage, ist das ein
      // langer Druck ins Textfeld.
      try { await navigator.clipboard.writeText(text); } catch { /* dann eben nicht */ }

      const dateien = [];
      for (let i = 0; i < wege.length; i++) {
        // Der eigene Vorrat liegt auf derselben Domain; mobile.de-Bilder
        // brauchen den Umweg ueber functions/api/studio/foto.js, sonst darf
        // der Browser sie weder lesen noch auf ein Canvas zeichnen.
        const quelle = wege[i].startsWith('/')
          ? wege[i]
          : '/api/studio/foto?u=' + encodeURIComponent(wege[i]);
        // Die Titelüberschrift gilt fuer beide Formate. Sie war hier auf die
        // Story beschraenkt, aus der Zeit, als es sie nur dort gab – seither
        // steht der Kasten "Titelüberschrift (optional)" auch beim Beitrag,
        // die Vorschau zeigte sie, und im fertigen Bild fehlte sie. Wo es kein
        // Titelfeld gibt (Beitrag aus dem Bestand), liefert zeilenVon() null.
        const b = await zuschneiden(quelle, standVon(wege[i]), hoch,
          i === 0 ? labelVon(feld) : '', logoFuer(feld, wege[i], i),
          zeilenVon(feld), stelleVon(feld), schriftVon(feld), aiyVon(feld));
        dateien.push(new File([b], `bild-${i + 1}.jpg`, { type: 'image/jpeg' }));
      }

      if (navigator.canShare && navigator.canShare({ files: dateien })) {
        await navigator.share({ files: dateien, text });
        knopfText(knopf, 'Gesendet ✓ Text liegt in der Ablage');
      } else {
        dateien.forEach(f => {
          const u = URL.createObjectURL(f);
          const a = document.createElement('a');
          a.href = u; a.download = f.name; a.click();
          setTimeout(() => URL.revokeObjectURL(u), 10000);
        });
        knopfText(knopf, 'Geladen ✓ Text liegt in der Ablage');
      }

      // Erst jetzt abhaken – vorher waere es geraten.
      alsGepostetMerken(fahrzeug, format === 'story' ? 'story' : 'neuzugang');
      alsBenutztMerken(wege);
    } catch (err) {
      const abgebrochen = /abort/i.test(err.name || '');
      knopfText(knopf, abgebrochen ? 'Beitrag teilen' : 'Hat nicht geklappt');
      if (!abgebrochen) console.error('Teilen:', err);
    } finally {
      knopf.disabled = false;
      // Nach einer Weile wieder still: der Knopf heisst ohnehin so, und die
      // Zeile darunter soll nur etwas sagen, wenn es etwas zu sagen gibt.
      setTimeout(() => {
        knopf.title = 'Beitrag teilen';
        const zeile = knopf.parentElement && knopf.parentElement.querySelector('.sm-meldung');
        if (zeile) zeile.textContent = '';
      }, 4000);
    }
  }

  // ─── Veroeffentlichen ───────────────────────────────────────────────
  //
  // Der Weg ueber die Instagram-API. Er unterscheidet sich vom Teilen-Knopf
  // in einem Punkt, der alles aendert: hier geht der Beitrag wirklich raus,
  // ohne dass jemand ihn in der App noch einmal in der Hand hat. Deshalb
  // fragt der Knopf vorher nach – und zwar im Kasten, nicht im Browser.
  //
  // Instagram laedt die Bilder selbst herunter, sie muessen also oeffentlich
  // unter einer Adresse liegen. Der Zuschnitt passiert weiterhin hier im
  // Browser (sonst schneidet Instagram selbst, und meist falsch), das
  // Ergebnis geht kurz nach R2 und wird hinterher wieder geloescht.
  // Was vor jedem Weg nach draussen gilt – Posten wie Einplanen. Stand
  // dreimal fast gleich im Code; beim naechsten Grenzwert waere eine der
  // Stellen liegengeblieben.
  // Der Planen-Knopf stand zweimal im Markup – einmal davon mit fest
  // verdrahtetem "Beitrag planen", auch wenn gerade eine Story gebaut wurde.
  function planKnopf() {
    return `<button type="button" class="btn-klein" data-planen>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
           stroke-width="1.9" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
        <path d="M3 9.5h18M8 2.8v3.4M16 2.8v3.4" stroke-linecap="round"/>
        <path d="M12 12.5v3l2 1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>${format === 'story' ? 'Story planen' : 'Beitrag planen'}</span></button>`;
  }

  function auswahlPruefen(wege, story, knopf) {
    if (!wege.length) { knopfText(knopf, 'Erst Bilder auswählen'); return false; }
    if (story && wege.length > 1) {
      knopfText(knopf, 'Eine Story nimmt genau ein Bild');
      return false;
    }
    // Vor dem Zuschneiden pruefen, nicht danach: sonst wandern zwoelf fertige
    // Bilder nach R2 und der Endpunkt lehnt anschliessend alles ab.
    if (!story && wege.length > 10) {
      knopfText(knopf, `Höchstens 10 Bilder – ausgewählt sind ${wege.length}`);
      return false;
    }
    return true;
  }

  async function veroeffentlichen(feld, ziel, knopf, mitgegeben) {
    const wege = mitgegeben || [...ziel.querySelectorAll('.sm-foto.aktiv')].map(k => k.dataset.u);
    const text = (feld.querySelector('[data-kopie]') || {}).textContent || '';
    const story = format === 'story';
    if (!auswahlPruefen(wege, story, knopf)) return;

    knopf.disabled = true;
    let abgelegt = [];
    try {
      knopfText(knopf, 'Bilder werden zugeschnitten …');
      abgelegt = await zugeschnittenAblegen(feld, knopf, wege, story);

      knopfText(knopf, 'Wird veröffentlicht …');
      const a = await fetch('/api/studio/veroeffentlichen', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bilder: abgelegt.map(p => location.origin + p),
          text, format: story ? 'story' : 'beitrag'
        })
      });
      const d = await a.json();
      if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);

      alsGepostetMerken(feld.dataset.fahrzeug || '', story ? 'story' : 'neuzugang');
      alsBenutztMerken(wege);
      alteBearbeitungWegraeumen();
      knopfText(knopf, story ? 'Story steht ✓' : 'Beitrag steht ✓');
      erfolgZeigen(story ? 'Story' : 'Beitrag', d.weg);
      igLaden();
    } catch (err) {
      console.error('Veroeffentlichen:', err);
      knopfText(knopf, 'Ging nicht: ' + err.message);
    } finally {
      // Die Zwischenkopien haben ihren Zweck erfuellt – Instagram hat sie
      // beim Anlegen des Beitrags heruntergeladen. Liegen bleiben sollen sie
      // nicht, sonst waechst der Speicher mit jedem Beitrag.
      for (const pfad of abgelegt) {
        fetch('/api/studio/bild?pfad=' + encodeURIComponent(pfad),
          { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
      }
      knopf.disabled = false;
    }
  }

  // Zuschneiden und Ablegen, von beiden Wegen benutzt: dem direkten
  // Veroeffentlichen und dem Einplanen. Liefert die abgelegten /bilder/-Pfade.
  async function zugeschnittenAblegen(feld, knopf, wege, story) {
    const hoch = !!feld.querySelector('.igv-hoch');
    const abgelegt = [];
    for (let i = 0; i < wege.length; i++) {
      const quelle = wege[i].startsWith('/')
        ? wege[i]
        : '/api/studio/foto?u=' + encodeURIComponent(wege[i]);
      // Wie beim Teilen: der Titel gehoert in beide Formate.
      const b = await zuschneiden(quelle, standVon(wege[i]), hoch || story,
        i === 0 ? labelVon(feld) : '', logoFuer(feld, wege[i], i),
        zeilenVon(feld), stelleVon(feld), schriftVon(feld), aiyVon(feld));
      const formular = new FormData();
      formular.append('datei', new File([b], `beitrag-${i + 1}.jpg`, { type: 'image/jpeg' }));
      const a = await fetch('/api/studio/bild', {
        method: 'POST', credentials: 'same-origin', body: formular
      });
      const d = await a.json();
      if (!d || !d.ok) throw new Error((d && d.fehler) || 'Bild konnte nicht abgelegt werden.');
      abgelegt.push(d.pfad);
      knopfText(knopf, `Bild ${i + 1} von ${wege.length} abgelegt …`);
    }
    return abgelegt;
  }

  // Einplanen statt sofort posten: derselbe Zuschnitt, aber das Paket geht
  // in die Warteschlange. Die Zwischenkopien BLEIBEN liegen – der
  // Cron-Worker braucht sie zur geplanten Zeit noch. Weggeraeumt wird nach
  // dem Posten (oder beim Loeschen des Eintrags).
  async function einplanen(feld, ziel, knopf, mitgegeben, wann) {
    const wege = mitgegeben || [...ziel.querySelectorAll('.sm-foto.aktiv')].map(k => k.dataset.u);
    const text = (feld.querySelector('[data-kopie]') || {}).textContent || '';
    const story = format === 'story';
    if (!auswahlPruefen(wege, story, knopf)) return;

    knopf.disabled = true;
    let abgelegt = [];
    try {
      knopfText(knopf, 'Bilder werden zugeschnitten …');
      abgelegt = await zugeschnittenAblegen(feld, knopf, wege, story);

      knopfText(knopf, 'Wird eingeplant …');
      const a = await fetch('/api/studio/warteschlange', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zeitpunkt: wann,
          bilder: abgelegt.map(p => location.origin + p),
          text, format: story ? 'story' : 'beitrag'
        })
      });
      const d = await a.json();
      if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);

      alsBenutztMerken(wege);
      alteBearbeitungWegraeumen();
      const schoen = new Date(wann).toLocaleString('de-DE',
        { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      knopfText(knopf, 'Eingeplant ✓');
      const zeile = knopf.parentElement && knopf.parentElement.querySelector('.sm-meldung');
      if (zeile) {
        zeile.innerHTML = `Eingeplant für ${schuetzen(schoen)} Uhr ·
          <a href="/admin/planen">zur Warteschlange ↗</a>`;
      }
    } catch (err) {
      console.error('Einplanen:', err);
      // Ein halb eingeplanter Beitrag hinterlaesst nichts: schon abgelegte
      // Kopien wieder wegwerfen, sonst sammeln sich Waisen im Speicher.
      for (const pfad of abgelegt) {
        fetch('/api/studio/bild?pfad=' + encodeURIComponent(pfad),
          { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
      }
      knopfText(knopf, 'Ging nicht: ' + err.message);
    } finally {
      knopf.disabled = false;
    }
  }

  // Ein Date als Wert fuer datetime-local: oertliche Zeit, ohne Zone,
  // minutengenau. toISOString() waere UTC und damit um Stunden daneben.
  function ortszeit(d) {
    const n = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}T${n(d.getHours())}:${n(d.getMinutes())}`;
  }

  // Die Rueckfrage legt sich ueber die ganze Seite und macht den Hintergrund
  // unscharf. Das ist Absicht: was hier bestaetigt wird, geht oeffentlich
  // raus und laesst sich nicht zurueckholen – dafuer soll man einen Moment
  // aus dem Arbeiten herausgerissen werden.
  function veroeffentlichenVerdrahten(feld, ort, ziel, mitgegeben) {
    const knopf = ort.querySelector('[data-posten]');
    if (!knopf) return;

    knopf.addEventListener('click', () => {
      if (document.querySelector('.vp-schleier')) return;
      // Mit Artikel: "Der Story" stand da, weil nur das Hauptwort wechselte.
      const [was, derDie] = format === 'story' ? ['Story', 'Die'] : ['Beitrag', 'Der'];

      const schleier = document.createElement('div');
      schleier.className = 'vp-schleier';
      schleier.innerHTML = `<div class="vp-kasten" role="dialog" aria-modal="true"
             aria-labelledby="vp-titel">
        <span class="vp-achtung" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3.6 22 20H2L12 3.6z" stroke-linejoin="round"/>
            <path d="M12 10v4.4" stroke-linecap="round"/>
            <circle cx="12" cy="17.4" r="1.05" fill="currentColor" stroke="none"/>
          </svg>
        </span>
        <b id="vp-titel">${was} jetzt direkt veröffentlichen?</b>
        <p>${derDie} ${was} steht danach öffentlich auf
          <strong>@aiy.web</strong> – ohne weitere Nachfrage in der App.</p>
        <div class="vp-knoepfe">
          <button type="button" class="vp-ja">Ja, direkt veröffentlichen</button>
          <button type="button" class="vp-nein">Abbrechen</button>
        </div>
      </div>`;
      document.body.append(schleier);
      document.documentElement.classList.add('vp-offen');

      const zu = () => {
        schleier.remove();
        document.documentElement.classList.remove('vp-offen');
        document.removeEventListener('keydown', taste);
      };
      const taste = e => { if (e.key === 'Escape') zu(); };
      document.addEventListener('keydown', taste);
      // Klick daneben bricht ab – wie das Abbrechen, nur schneller.
      schleier.addEventListener('click', e => { if (e.target === schleier) zu(); });
      schleier.querySelector('.vp-nein').addEventListener('click', zu);
      schleier.querySelector('.vp-ja').addEventListener('click', () => {
        zu();
        veroeffentlichen(feld, ziel, knopf, mitgegeben && mitgegeben());
      });
      schleier.querySelector('.vp-ja').focus();
    });
  }

  // Nach dem Posten dasselbe Fenster wie vor dem Posten, nur andersherum:
  // erst die Rueckfrage, dann die Bestaetigung. Eine Zeile im Fuss war zu
  // leise fuer etwas, das gerade oeffentlich geworden ist – und der Weg zum
  // Beitrag ist der eine Schritt, den man jetzt gehen will.
  function erfolgZeigen(was, weg) {
    const vorhandener = document.querySelector('.vp-schleier');
    if (vorhandener) vorhandener.remove();

    const schleier = document.createElement('div');
    schleier.className = 'vp-schleier';
    schleier.innerHTML = `<div class="vp-kasten" role="dialog" aria-modal="true"
           aria-labelledby="vp-fertig-titel">
      <span class="vp-achtung vp-fertig" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
          <path d="M4.5 12.5l5 5 10-11" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <b id="vp-fertig-titel">${schuetzen(was)} veröffentlicht</b>
      <p>${was === 'Story' ? 'Sie steht' : 'Er steht'} jetzt öffentlich auf
        <strong>@aiy.web</strong>.</p>
      <div class="vp-knoepfe">
        ${weg ? `<a class="vp-ja" href="${schuetzen(weg)}" target="_blank" rel="noopener">
          ${schuetzen(was)} ansehen
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="2" aria-hidden="true">
            <path d="M14 4h6v6M20 4l-8.5 8.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>` : ''}
        <button type="button" class="vp-nein">Schließen</button>
      </div>
    </div>`;
    document.body.append(schleier);
    document.documentElement.classList.add('vp-offen');

    const zu = () => {
      schleier.remove();
      document.documentElement.classList.remove('vp-offen');
      document.removeEventListener('keydown', taste);
    };
    const taste = e => { if (e.key === 'Escape') zu(); };
    document.addEventListener('keydown', taste);
    schleier.addEventListener('click', e => { if (e.target === schleier) zu(); });
    schleier.querySelector('.vp-nein').addEventListener('click', zu);
    // Der Weg zum Beitrag bekommt den Fokus, nicht das Schliessen.
    (schleier.querySelector('.vp-ja') || schleier.querySelector('.vp-nein')).focus();
  }

  // Der dritte Knopf: "Beitrag planen". Ein eigenes Fenster mit Datum und
  // Uhrzeit – was hier eingeplant wird, erscheint unter Content planen
  // (/admin/planen) und laesst sich dort noch bearbeiten, verschieben oder
  // sofort rausschicken.
  function planFensterVerdrahten(feld, ort, ziel, mitgegeben) {
    const knopf = ort.querySelector('[data-planen]');
    if (!knopf) return;

    knopf.addEventListener('click', () => {
      if (document.querySelector('.vp-schleier')) return;
      const was = format === 'story' ? 'Story' : 'Beitrag';

      const schleier = document.createElement('div');
      schleier.className = 'vp-schleier';
      schleier.innerHTML = `<div class="vp-kasten vp-mittel" role="dialog" aria-modal="true"
             aria-labelledby="vp-plan-titel">
        <span class="vp-achtung vp-uhr" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5"/>
            <path d="M3 9.5h18M8 2.8v3.4M16 2.8v3.4" stroke-linecap="round"/>
            <path d="M12 12.5v3l2 1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <b id="vp-plan-titel">${was} planen</b>
        <p>Geht zur gewählten Zeit automatisch auf <strong>@aiy.web</strong> raus.
          Bis dahin steht ${format === 'story' ? 'die' : 'der'} ${was} unter
          <strong>Content planen</strong> und lässt sich dort noch bearbeiten.</p>
        <label class="vp-feld">
          <span>Datum und Uhrzeit</span>
          <input type="datetime-local" class="vp-wann" />
        </label>
        <div class="vp-knoepfe">
          <button type="button" class="vp-ja vp-plan-los">Einplanen</button>
          <button type="button" class="vp-nein">Abbrechen</button>
        </div>
      </div>`;
      document.body.append(schleier);
      document.documentElement.classList.add('vp-offen');

      const zu = () => {
        schleier.remove();
        document.documentElement.classList.remove('vp-offen');
        document.removeEventListener('keydown', taste);
      };
      const taste = e => { if (e.key === 'Escape') zu(); };
      document.addEventListener('keydown', taste);
      schleier.addEventListener('click', e => { if (e.target === schleier) zu(); });
      schleier.querySelector('.vp-nein').addEventListener('click', zu);

      // Vorbelegt mit "morgen um 9" – ein brauchbarer Vorschlag statt eines
      // leeren Felds. Wird gerade ein Warteschlangen-Eintrag ueberarbeitet,
      // steht stattdessen dessen urspruenglicher Zeitpunkt wieder drin
      // (sofern er noch nicht vorbei ist). Datetime-local will die
      // oertliche Zeit ohne Zone.
      const wann = schleier.querySelector('.vp-wann');
      const morgen = new Date();
      morgen.setDate(morgen.getDate() + 1);
      morgen.setHours(9, 0, 0, 0);
      let vorgabe = morgen;
      if (bearbeitungId && bearbeitungZeit) {
        const alt = new Date(bearbeitungZeit);
        if (!isNaN(alt.getTime()) && alt.getTime() > Date.now() + 60 * 1000) vorgabe = alt;
      }
      wann.value = ortszeit(vorgabe);
      wann.min = ortszeit(new Date());

      schleier.querySelector('.vp-plan-los').addEventListener('click', () => {
        const gewaehlt = new Date(wann.value);
        if (isNaN(gewaehlt.getTime())) { wann.focus(); return; }
        if (gewaehlt.getTime() < Date.now() - 60 * 1000) {
          wann.setCustomValidity('Der Zeitpunkt liegt in der Vergangenheit.');
          wann.reportValidity();
          wann.setCustomValidity('');
          return;
        }
        zu();
        einplanen(feld, ziel, knopf, mitgegeben && mitgegeben(), gewaehlt.toISOString());
      });

      wann.focus();
    });
  }

  // Der Labeltext steht im Feld selbst – so ueberlebt er das Neuzeichnen der
  // Vorschau und laesst sich von Hand aendern.
  // Der Kasten unter den Bildern: an/aus und der Text. Steht bei allen drei
  // Formaten an derselben Stelle, damit man ihn nicht suchen muss.
  function labelHtml(vorschlag) {
    // Gemerktes geht vor Vorgabe: die Haken stehen nach jedem Neuzeichnen
    // (Formatwechsel, naechstes Fahrzeug) wieder so, wie man sie gesetzt hat.
    const angabenAn = schalter.angaben === null ? !!vorschlag : schalter.angaben;
    const logoAn = schalter.logo === null ? true : schalter.logo;
    const schriftAn = schalter.schrift === null ? true : schalter.schrift;
    const aiyAn = schalter.aiy === null ? true : schalter.aiy;
    return `<div class="sm-label">
      <div class="sm-logo-zeile">
        <label class="sm-label-an">
          <input type="checkbox" data-label-an ${angabenAn ? 'checked' : ''} />
          <span>Angaben</span>
        </label>
        <button type="button" class="sm-schrift" data-stil-auf="angaben">Gestalten …</button>
        ${stellenWahl('angaben', 'unten-mitte')}
      </div>
      <input type="text" class="sm-label-text" data-label-text
             value="${schuetzen(vorschlag)}" placeholder="Modell · Jahr · km"
             ${angabenAn ? '' : 'disabled'} />

      <div class="sm-logo-zeile sm-trennt">
        <label class="sm-label-an">
          <input type="checkbox" data-logo-an ${logoAn ? 'checked' : ''} />
          <span>Logo</span>
        </label>
        <button type="button" class="sm-schrift" data-aiy-an aria-pressed="${aiyAn}"
                title="Wortmarke AIY neben der Bildmarke">AIY</button>
        <button type="button" class="sm-schrift" data-schrift-an aria-pressed="${schriftAn}">+ Schrift</button>
        ${stellenWahl('logo', 'unten-rechts')}
      </div>
    </div>`;
  }

  // Getrennt vom Text abgefragt: das Zeichen kann auch allein aufs Bild, ohne
  // dass Modell und Laufleistung darunterstehen.
  function zeilenVon(feld) {
    const an = feld.querySelector('[data-zeile-an]');
    if (an && !an.checked) return null;
    const z = feld.querySelector('.igs-zeile');
    if (!z) return null;
    const gross = z.querySelector('b');
    const klein = z.querySelector('i');
    if (!gross || !gross.textContent.trim()) return null;
    return {
      zeile: gross.textContent.trim(),
      unterzeile: klein ? klein.textContent.trim() : '',
      stelle: posVon(z, 'oben-mitte')
    };
  }

  function schriftVon(feld) {
    const k = feld && feld.querySelector('[data-schrift-an]');
    return !!(k && k.getAttribute('aria-pressed') === 'true');
  }

  function aiyVon(feld) {
    const k = feld && feld.querySelector('[data-aiy-an]');
    // Ohne Knopf gilt die Vollform – so verhaelt sich alter Aufruf wie bisher.
    return !k || k.getAttribute('aria-pressed') === 'true';
  }

  // Das Zeichen kommt auf jedes Bild – ausser dort, wo man es in der Bildfolge
  // einzeln abgewaehlt hat. Das erste behaelt es immer: es ist das Titelbild,
  // und genau daran erkennt man den Absender im Feed.
  const ohneLogo = new Set();
  const logoFuer = (feld, weg, i) => logoVon(feld) && (i === 0 || !ohneLogo.has(weg));

  function logoVon(feld) {
    const an = feld && feld.querySelector('[data-logo-an]');
    return !!(an && an.checked);
  }

  // Die Schwungkurve aus dem Logo, dieselbe wie im Kopf der Website. Als Pfad
  // statt als Bilddatei: scharf in jeder Groesse, kein Ladevorgang, und die
  // Hausfarbe stimmt immer.
  // Masse der Marke – die Pfade selbst stehen in marke.js, damit Vorschau
  // und gerechnetes Bild nicht auseinanderlaufen.
  const LOGO_BREIT = window.aiyMarke.BREIT, LOGO_HOCH = window.aiyMarke.HOCH;

  // Was in der Vorschau steht, gilt: die Klasse ist die Wahrheit.
  function posVon(el, ersatz) {
    if (!el) return ersatz;
    const k = [...el.classList].find(x => x.startsWith('pos-'));
    return k ? k.slice(4) : ersatz;
  }

  // Wohin Angaben und Marke ins Bild gerechnet werden. Die Titelzeile steht
  // NICHT hier – die bringt ihre Stelle in zeilenVon() selbst mit.
  //
  // Hier stand einmal die Stelle der '.igs-zeile' und nur ersatzweise die des
  // '.igv-label'. Der Ersatz kam nie zum Zug: beitrag-schau.js legt die
  // versteckte Titelzeile in JEDE Vorschau. Die Angaben wurden dadurch immer
  // dorthin gerechnet, wo der Titel steht – die Knoepfe unter "Angaben"
  // aenderten die Vorschau, aber nicht das fertige Bild.
  function stelleVon(feld) {
    return {
      angaben: posVon(feld.querySelector('.igv-label'), 'unten-mitte'),
      logo: posVon(feld.querySelector('.igv-marke'), 'unten-rechts')
    };
  }

  function labelVon(feld) {
    const eingabe = feld && feld.querySelector('[data-label-text]');
    const an = feld && feld.querySelector('[data-label-an]');
    if (!eingabe || !an || !an.checked) return '';
    return eingabe.value.trim();
  }

  // Aus den Fahrzeugdaten: Modell, Baujahr, Laufleistung. Kein Preis – so
  // mit Flo festgelegt, der steht auf der Fahrzeugseite.
  function labelVorschlag(v) {
    if (!v) return '';
    const teile = [window.beitragText.name(v)];
    const jahr = String(v.firstRegistration || '').match(/(\d{4})/);
    if (jahr) teile.push(jahr[1]);
    return teile.join(' · ');
  }

  // Bilder zuerst: der Beitrag entsteht ueber das Bild, der Text kommt
  // danach. Und das erste gewaehlte Bild bestimmt, was in der Vorschau steht.
  function beitragHtml(v, variante) {
    const roh = { ...window.beitragText.bauen(v, variante) };
    Object.assign(roh, mitFuss(roh.text, roh.hashtags));
    const e = fzEigen[v.id];
    const b = e && e.text ? { ...roh, text: e.text, hashtags: e.hashtags } : roh;
    return rahmen(vorschau(b.text, b.hashtags, 'beitrag'), `
      <div class="sm-kopf"><b>Text</b>
        <span>Variante ${((variante % b.varianten) + b.varianten) % b.varianten + 1} von ${b.varianten}</span></div>
      <pre class="sm-text" data-kopie>${schuetzen(b.text)}\n\n${schuetzen(b.hashtags)}</pre>
      <div class="sm-knoepfe">
        <button type="button" class="btn-klein sm-leise" data-zurueck-var
          title="Vorherigen Vorschlag">←</button>
        <button type="button" class="btn-klein sm-leise" data-wuerfeln title="Neuen Vorschlag">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="2.2" aria-hidden="true">
            <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" stroke-linecap="round"/>
            <polyline points="20.5 3.5 20.5 9 15 9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg></button>
        <button type="button" class="btn-klein sm-leise" data-bearbeiten>Bearbeiten</button>
      </div>

      ${labelHtml(labelVorschlag(v))}
      <p class="gd-notiz plan-notiz" data-plan-notiz hidden></p>
      <div class="sm-kopf" style="margin-top:18px"><b>Bilder</b>
        <span class="sm-stand"></span></div>
      <div class="sm-bilder"><p class="mon-laedt">Bilder werden geladen …</p></div>`, true);
  }

  // Gemeinsamer Rahmen: Vorschau links, Werkzeug rechts, oben rechts zu.
  // Bei Fahrzeugen steht oben die Formatwahl – dasselbe Auto, drei Ausgaben.
  // Ein Knopf fuer beide Welten: bei Galerie-Bildern sucht er sie aus dem
  // Vorrat, bei einem Fahrzeug sieht er sich dessen Fotos an. Was er baut,
  // richtet sich nach dem Reiter oben.
  // Wo Text und Marke im Bild sitzen, entscheidet am Ende das Auge. Das
  // Modell schlaegt eine Stelle vor, hier laesst sie sich umsetzen – die
  // Knoepfe schreiben eine Klasse an die Vorschau, und von dort liest sie das
  // Zuschneiden ab. Kein Neuzeichnen, kein zweiter Zustand.
  const SENKRECHT = ['oben', 'mitte', 'unten'];
  const WAAGRECHT = ['links', 'mitte', 'rechts'];

  // Neun Felder statt dreier Knoepfe – und zweimal, fuer Text und Marke
  // getrennt. Vorher hingen beide an derselben Klasse und sind sich dadurch
  // gegenseitig hinterhergelaufen.
  // Zwei Reihen Knoepfe statt eines Rasters: man liest, was man waehlt.
  // Pfeile statt Woerter: sie sagen dasselbe auf einem Viertel der Breite,
  // und die Richtung liest man schneller als sie.
  const WORT = { oben: '↑', mitte: '•', unten: '↓', links: '←', rechts: '→' };
  const NAME = { oben: 'Oben', mitte: 'Mitte', unten: 'Unten',
                 links: 'Links', rechts: 'Rechts' };

  const gemerkt = { zeile: 'oben-mitte', angaben: 'unten-mitte', logo: 'unten-rechts' };
  // Die Stellungen ueberleben auch das Neuladen – gleiche Ablage wie Format
  // und Quelle, damit sich der Baukasten so oeffnet, wie man ihn verlassen hat.
  try {
    const g = JSON.parse(localStorage.getItem('sm-stellen') || '{}');
    Object.keys(gemerkt).forEach(k => {
      if (typeof g[k] === 'string' && /^[a-z]+-[a-z]+$/.test(g[k])) gemerkt[k] = g[k];
    });
  } catch { /* egal */ }
  function stellenMerken() {
    try { localStorage.setItem('sm-stellen', JSON.stringify(gemerkt)); } catch { /* egal */ }
  }

  // An/aus ueberlebt den Wechsel zwischen Beitrag und Story (und den Neustart):
  // wer das Logo abwaehlt, meint das nicht nur fuer genau dieses eine Bild.
  // null heisst "noch nie angefasst" – dann gilt weiter die Vorgabe.
  const schalter = { angaben: null, logo: null, schrift: null, zeile: null, aiy: null };
  try {
    const s = JSON.parse(localStorage.getItem('sm-schalter') || '{}');
    Object.keys(schalter).forEach(k => {
      if (typeof s[k] === 'boolean') schalter[k] = s[k];
    });
  } catch { /* egal */ }
  function schalterMerken(was, an) {
    schalter[was] = !!an;
    try { localStorage.setItem('sm-schalter', JSON.stringify(schalter)); } catch { /* egal */ }
  }

  function stellenWahl(was, jetzt) {
    const [v0, h0] = zerlegen(gemerkt[was] || jetzt);
    gemerkt[was] = `${v0}-${h0}`;
    const reihe = (achse, liste, gewaehlt) => liste.map(w =>
      `<button type="button" data-achse="${achse}" data-wert="${w}" data-was="${was}"
        class="${w === gewaehlt ? 'hier' : ''}" title="${NAME[w]}"
        aria-label="${NAME[w]}">${WORT[w]}</button>`).join('');
    return `<div class="sm-stellen">
      <span>${({ logo: 'Logo', zeile: 'Text', angaben: 'Angaben' })[was] || 'Text'}</span>
      <span class="sm-stellen-reihe">${reihe('v', SENKRECHT, v0)}</span>
      <b class="sm-stellen-mal">×</b>
      <span class="sm-stellen-reihe">${reihe('h', WAAGRECHT, h0)}</span>
    </div>`;
  }

  function zerlegen(wert) {
    const t = String(wert || 'unten-links').split('-');
    return [SENKRECHT.includes(t[0]) ? t[0] : 'unten',
            WAAGRECHT.includes(t[1]) ? t[1] : 'links'];
  }

  function bauLeiste() {
    return `<div class="bau-leiste">
      <button type="button" class="bau-knopf" data-bauen>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M12 2.6l1.9 5.3 5.3 1.9-5.3 1.9L12 17l-1.9-5.3L4.8 9.8l5.3-1.9z"/>
          <path d="M18.6 15.2l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" opacity=".75"/>
        </svg>
        <span>${format === 'story' ? 'Story generieren' : 'Beitrag generieren'}</span>
      </button>
    </div>`;
  }

  // Was das Modell fuer ein Fahrzeug gebaut hat, je Fahrzeug gemerkt: sonst
  // waere es beim naechsten Zeichnen wieder der Baukastentext.
  const fzEigen = {};

  // Welches Bild die Vorschau gerade zeigt. Steht hier oben, weil es weiter
  // unten gesetzt und noch weiter unten gelesen wird.
  let gezeigt = null;

  function rahmen(links, rechts) {
    // Kein Umschalter mehr im Baukasten: Beitrag, Story und Reel stehen jetzt
    // oben als Reiter. Dieselbe Frage zweimal zu stellen verwirrt nur.
    return `<div class="sm-block sm-zwei">
      <div class="sm-links">${links}</div>
      <div class="sm-rechts">
        ${bauLeiste()}
        <p class="gd-notiz plan-notiz" data-plan-notiz hidden></p>
        ${rechts}
      </div>
      <div class="sm-fuss"></div>
    </div>`;
  }

  // ─── Story ───────────────────────────────────────────────────────────
  //
  // Hochformat, eine kurze Zeile, ein Sticker – und nach 24 Stunden weg,
  // wenn sie nicht in ein Highlight wandert. Der Text wird bewusst nicht
  // ins Bild gerechnet: Instagram hat eigene Schriften und Sticker, alles
  // Eingebrannte saehe daneben nach Fremdkoerper aus.
  function storyHtml(v, variante) {
    const roh = window.beitragText.story(v, variante);
    const e = fzEigen[v.id];
    const st = e && e.zeile
      ? { ...roh, zeile: e.zeile, unterzeile: e.unterzeile, stelle: e.stelle,
          sticker: e.sticker ? { was: stickerWort(e.sticker) } : roh.sticker }
      : roh;
    return rahmen(vorschauStory(st), `

      <div class="sm-kopf"><b>Titelüberschrift</b> <span>(optional)</span></div>
      <div class="sm-label">
        <div class="sm-logo-zeile">
          <label class="sm-label-an">
            <input type="checkbox" data-zeile-an ${schalter.zeile ? 'checked' : ''} />
            <span>Titel</span>
          </label>
          <button type="button" class="sm-schrift" data-stil-auf="titel">Gestalten …</button>
        </div>
        <div class="sm-zeile-reihe">
          <p class="sm-zeile" contenteditable="true" data-zeile-feld
             title="Zum Ändern hineinklicken">${schuetzen(st.zeile)}${st.unterzeile
            ? '\n' + schuetzen(st.unterzeile) : ''}</p>
          ${stellenWahl('zeile', 'oben-mitte')}
        </div>
      </div>

      <div class="sm-kopf sm-kopf-sticker"><b>Sticker: ${schuetzen(st.sticker.was)}</b>
        <span>(Vorschlag)</span></div>
      <p class="sm-ton">${schuetzen(st.sticker.wie)}</p>

      <div class="sm-kopf"><b>Text</b>
        <span>Variante ${((variante % st.varianten) + st.varianten) % st.varianten + 1} von ${st.varianten}</span></div>
      <pre class="sm-text" data-kopie>${schuetzen(st.text)}\n\n${schuetzen(st.hashtags)}</pre>
      <div class="sm-knoepfe">
        <button type="button" class="btn-klein sm-leise" data-zurueck-var title="Vorherigen Vorschlag">←</button>
        <button type="button" class="btn-klein sm-leise" data-wuerfeln title="Neuen Vorschlag">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="2.2" aria-hidden="true">
            <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" stroke-linecap="round"/>
            <polyline points="20.5 3.5 20.5 9 15 9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg></button>
        <button type="button" class="btn-klein sm-leise" data-bearbeiten>Bearbeiten</button>
      </div>

      ${labelHtml(labelVorschlag(v))}
      <div class="sm-kopf" style="margin-top:18px"><b>Bild</b>
        <span class="sm-stand"></span></div>
      <div class="sm-bilder"><p class="mon-laedt">Bilder werden geladen …</p></div>`);
  }

  // Eine Story aus eigenen Fotos: die Zeile kommt aus dem Thema oder – wenn
  // gerade einer generiert wurde – aus dem ersten Satz des Beitrags. Der
  // Sticker wird nicht ins Bild gerechnet, sondern in Instagram gesetzt;
  // eingebrannte Schrift sieht dort immer nach Fremdkoerper aus.
  // Aus dem Vorschlag des Modells wird die Zeile am Bildrand: welche Art
  // Sticker in Instagram gesetzt werden soll und was daraufsteht. Wir rechnen
  // ihn nicht ins Bild – Umfragen und Fragen sind anklickbar, ein gemaltes
  // Abbild waere es nicht.
  function stickerWort(st) {
    if (!st || !st.art) return 'Sticker in Instagram frei wählen';
    const antw = (st.antworten || []).filter(Boolean);
    return `${st.art}: „${st.text}“${antw.length ? ' · ' + antw.join(' / ') : ''}`;
  }

  function storyAusThema(thema, w) {
    if (wkEigen && wkEigen.zeile) {
      return {
        zeile: wkEigen.zeile,
        unterzeile: wkEigen.unterzeile,
        stelle: wkEigen.stelle,
        sticker: { was: stickerWort(wkEigen.sticker) }
      };
    }
    // Ohne Vorschlag: die erste Zeile des Textes, sonst der Themenname.
    const saetze = (w.text || '').split('\n').map(z => z.trim()).filter(Boolean);
    return {
      zeile: (saetze[0] || (thema && thema.titel) || 'AIY | Ihsan Yilmaz')
        .replace(/[?:.]$/, '').slice(0, 42),
      unterzeile: '',
      stelle: 'unten',
      sticker: { was: stickerWort(null) }
    };
  }

  function vorschauStory(st) {
    return `<div class="igv igv-story" data-vorschau data-art="story">
      ${bildKasten('igv-hoch', `
        <span class="igs-balken"><i></i></span>
        <span class="igs-kopf">
          <img src="/admin/icon.svg" alt="" />
          <b>aiy.web</b><span>jetzt</span>
          <span class="igs-punkt">···</span>
        </span>
        <span class="igs-zeile igs-kasten pos-oben-mitte">
          <b>${schuetzen(st.zeile)}</b>
          ${st.unterzeile ? `<i>${schuetzen(st.unterzeile)}</i>` : ''}
        </span>
        <span class="igs-sticker">${schuetzen(st.sticker.was)}</span>
        <span class="igs-antwort"><i>Nachricht senden …</i>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20.8 8.6c0 4.5-8.8 9.4-8.8 9.4s-8.8-4.9-8.8-9.4a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8z"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z"/></svg>
        </span>`)}
      <p class="igv-datum">Vorschau · Zeile und Sticker setzt du in der App</p>
    </div>`;
  }

  // Die Vorschau haengt an der Bildauswahl: das erste gewaehlte Bild steht
  // vorn, durch die uebrigen laesst sich blaettern – wie im Feed auch.
  // Zoom und Ausrichtung je Bild. Beides ist mehr als Optik: beim Senden
  // wird das Bild genau so zugeschnitten, wie es hier steht (siehe
  // zuschneiden()). Ohne das waere die Vorschau eine Behauptung – Instagram
  // wuerde selbst schneiden, und zwar mittig.
  //
  // x und y sind Anteile der Rahmenbreite bzw. -hoehe, keine Pixel. Nur so
  // laesst sich dieselbe Verschiebung auf ein 1080er Bild uebertragen.
  const bildStand = new Map();
  const standVon = u => bildStand.get(u) || { z: 100, x: 0, y: 0 };


  function vorschauBild(feld) {
    const v = feld.querySelector('[data-vorschau]');
    if (!v) return;
    const gewaehlt = feld.id === 'wk-block'
      ? [...wkAuswahl]
      : [...feld.querySelectorAll('.sm-foto.aktiv')].map(k => k.dataset.u);
    const kasten = v.querySelector('.igv-bild');
    const zaehler = v.querySelector('.igv-zaehler');
    const stift = v.querySelector('[data-bild-bearbeiten]');
    const werkzeug = v.querySelector('.igv-werkzeug');
    const regler = v.querySelector('[data-zoom]');

    // Nur das Vorschaufoto wegraeumen, nicht jedes Bild im Kasten: im
    // Story-Kopf steckt auch das Profilbild. Mit dem alten 'img' verschwand es
    // beim ersten Zeichnen und kam nie wieder.
    kasten.querySelectorAll('.igv-foto, .igv-pfeil, .igv-punkte').forEach(e => e.remove());
    if (!gewaehlt.length) {
      zaehler.hidden = true;
      if (stift) stift.hidden = true;
      if (werkzeug) werkzeug.hidden = true;
      return;
    }
    if (stift) stift.hidden = false;

    const bild = document.createElement('img');
    bild.className = 'igv-foto';
    bild.alt = '';
    bild.draggable = false;
    kasten.prepend(bild);

    const punkte = document.createElement('div');
    punkte.className = 'igv-punkte';
    punkte.innerHTML = gewaehlt.map(() => '<span></span>').join('');
    if (gewaehlt.length > 1) kasten.append(punkte);

    // Der Stand dieses Durchlaufs haengt am Kasten, nicht in den Abschluss-
    // koerpern. Grund: der Kasten und die Werkzeugleiste ueberleben jedes
    // Neuzeichnen (oben werden nur Bild, Pfeile und Punkte entfernt). Wer ihre
    // Zuhoerer bei jedem Durchlauf neu anhaengt, hat nach vier Bildklicks vier
    // davon – und jeder haelt sein eigenes, veraltetes 'gewaehlt' und 'i' fest.
    // Ein Druck auf einen Pfeil verschob den Ausschnitt dann um vier Schritte
    // und nebenbei den von Bildern, die gar nicht zu sehen waren.
    // Beim Neuzeichnen dort weitermachen, wo man war. Vorher sprang die
    // Vorschau bei jeder Kleinigkeit – Logo umschalten, Seite blaettern –
    // zurueck auf das erste Bild, obwohl man gerade das dritte ansah.
    const lauf = { gewaehlt, i: Math.max(0, gewaehlt.indexOf(gezeigt)), bild };
    kasten.__lauf = lauf;

    const anwenden = () => {
      const st = standVon(lauf.gewaehlt[lauf.i]);
      lauf.bild.style.transform = `translate(${st.x * 100}%, ${st.y * 100}%) scale(${st.z / 100})`;
      if (regler) regler.value = st.z;
    };

    const zeigen = () => {
      lauf.i = (lauf.i + lauf.gewaehlt.length) % lauf.gewaehlt.length;
      lauf.bild.src = lauf.gewaehlt[lauf.i];
      zaehler.textContent = `${lauf.i + 1}/${lauf.gewaehlt.length}`;
      punkte.querySelectorAll('span').forEach((p, n) => p.classList.toggle('hier', n === lauf.i));
      anwenden();
      markeAbgleichen(feld, lauf.gewaehlt[lauf.i]);
      aktivZeigen(feld, lauf.gewaehlt[lauf.i]);
    };
    lauf.anwenden = anwenden;
    lauf.zeigen = zeigen;

    if (regler) regler.oninput = () => {
      const st = standVon(lauf.gewaehlt[lauf.i]);
      // Beim Herauszoomen kann eine fruehere Verschiebung ploetzlich zu weit
      // sein – dann rutschte leere Flaeche herein. Also mitziehen.
      const z = Math.max(100, Number(regler.value));
      const g = grenze(lauf.bild, z);
      bildStand.set(lauf.gewaehlt[lauf.i], {
        z,
        x: Math.max(-g.x, Math.min(g.x, st.x)),
        y: Math.max(-g.y, Math.min(g.y, st.y))
      });
      anwenden();
    };
    const weg = v.querySelector('[data-zoom-weg]');
    if (weg) weg.onclick = e => {
      e.stopPropagation();
      bildStand.set(lauf.gewaehlt[lauf.i], { z: 100, x: 0, y: 0 });
      anwenden();
    };

    // Bearbeiten: Stift an, dann laesst sich das Bild schieben und der
    // Regler liegt unten im Bild. Aus dem Bearbeiten heraus blaettert man
    // nicht – sonst verschiebt man aus Versehen das falsche Bild.
    if (stift) stift.onclick = () => {
      const an = kasten.classList.toggle('igv-offen');
      stift.classList.toggle('hier', an);
      werkzeug.hidden = !an;
      kasten.querySelectorAll('.igv-pfeil').forEach(p => { p.hidden = an; });
      // Solange der Ausschnitt offen ist, heisst der Knopf 'Speichern' – er
      // ist ja der Weg wieder heraus.
      const wort = stift.querySelector('span');
      if (wort) wort.textContent = an ? 'Speichern' : 'Bearbeiten';
    };

    // Schieben – mit Maus wie mit Finger, ueber Pointer Events.
    //
    // Vorher hingen hier mousedown/mousemove/mouseup am Fenster und daneben
    // touchstart/touchmove am Kasten. Das ist zweimal dieselbe Sache mit zwei
    // Fehlerquellen: das Fenster bekommt die Bewegung nur, solange kein
    // anderes Element sie abfaengt, und der Browser startet beim Ziehen eines
    // <img> zusaetzlich sein eigenes Verschieben.
    //
    // setPointerCapture loest beides: ab dem Druck gehen ALLE weiteren
    // Bewegungen garantiert an dieses Element – auch ausserhalb, auch ueber
    // anderen Elementen, mit Maus wie mit Finger.
    // Kasten und Werkzeugleiste bleiben ueber Neuzeichnen hinweg stehen –
    // ihre Zuhoerer bekommen sie deshalb genau einmal. Den jeweils aktuellen
    // Durchlauf holen sie sich beim Ereignis aus kasten.__lauf.
    if (!kasten.__verdrahtet) {
      kasten.__verdrahtet = true;
      let zeiger = null, startX = 0, startY = 0, startStand = null;

      kasten.addEventListener('pointerdown', e => {
        if (!kasten.classList.contains('igv-offen')) return;
        if (e.target.closest('button, input')) return;   // Regler und Pfeile nicht stoeren
        const l = kasten.__lauf;
        if (!l) return;
        e.preventDefault();
        zeiger = e.pointerId;
        kasten.setPointerCapture(zeiger);
        startX = e.clientX;
        startY = e.clientY;
        startStand = standVon(l.gewaehlt[l.i]);
        kasten.classList.add('igv-zieht');
      });

      kasten.addEventListener('pointermove', e => {
        if (zeiger === null || e.pointerId !== zeiger) return;
        const l = kasten.__lauf;
        if (!l || !startStand) return;
        const r = kasten.getBoundingClientRect();
        // Nicht weiter als der Ueberstand hergibt: sonst schoebe man leere
        // Flaeche ins Bild, ohne es zu merken.
        const g = grenze(l.bild, startStand.z);
        bildStand.set(l.gewaehlt[l.i], {
          ...startStand,
          x: Math.max(-g.x, Math.min(g.x, startStand.x + (e.clientX - startX) / r.width)),
          y: Math.max(-g.y, Math.min(g.y, startStand.y + (e.clientY - startY) / r.height))
        });
        l.anwenden();
      });

      const losLassen = e => {
        if (zeiger === null || (e && e.pointerId !== zeiger)) return;
        if (kasten.hasPointerCapture(zeiger)) kasten.releasePointerCapture(zeiger);
        zeiger = null;
        kasten.classList.remove('igv-zieht');
      };
      kasten.addEventListener('pointerup', losLassen);
      kasten.addEventListener('pointercancel', losLassen);

      // Am Rechner ist Ziehen fummelig – dort verschieben Pfeiltasten in
      // festen Schritten. Am Telefon bleibt das Wischen.
      // Der Pfeil zeigt, wohin der Ausschnitt wandert – nicht, wohin das Bild
      // geschoben wird. Beides ist gegenlaeufig, und wer "nach oben" drueckt,
      // will den oberen Teil des Bildes sehen.
      v.querySelectorAll('[data-schub]').forEach(k => k.addEventListener('click', e => {
        e.stopPropagation();
        const l = kasten.__lauf;
        if (!l) return;
        const [dx, dy] = k.dataset.schub.split(',').map(Number);
        const st = standVon(l.gewaehlt[l.i]);
        const g = grenze(l.bild, st.z);
        bildStand.set(l.gewaehlt[l.i], {
          ...st,
          x: Math.max(-g.x, Math.min(g.x, st.x + dx * 0.04)),
          y: Math.max(-g.y, Math.min(g.y, st.y + dy * 0.04))
        });
        l.anwenden();
      }));

      let wx = 0;
      kasten.addEventListener('touchstart', e => { wx = e.touches[0].clientX; }, { passive: true });
      kasten.addEventListener('touchend', e => {
        if (kasten.classList.contains('igv-offen')) return;
        const l = kasten.__lauf;
        if (!l || l.gewaehlt.length < 2) return;
        const w = e.changedTouches[0].clientX - wx;
        if (Math.abs(w) > 40) { l.i += w < 0 ? 1 : -1; l.zeigen(); }
      }, { passive: true });
    }

    // Die Pfeile werden bei jedem Zeichnen neu gebaut (oben entfernt) – ihre
    // Zuhoerer sammeln sich deshalb nicht an.
    if (gewaehlt.length > 1) {
      [['zurueck', '‹', -1], ['vor', '›', 1]].forEach(([klasse, zeichen, schritt]) => {
        const k = document.createElement('button');
        k.type = 'button';
        k.className = 'igv-pfeil igv-' + klasse;
        k.textContent = zeichen;
        k.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation();
          lauf.i += schritt; zeigen();
        });
        kasten.append(k);
      });
    }

    zaehler.hidden = gewaehlt.length < 2;
    zeigen();
  }

  // Schneidet ein Bild genau so zu, wie es in der Vorschau steht – 4:5 beim
  // Beitrag, 9:16 beim Reel. Damit ist das, was rausgeht, dasselbe, was man
  // gesehen hat; Instagram schneidet an einem fertigen 4:5-Bild nichts mehr.
  // Beim Herauszoomen bleiben Raender: die werden weiss gefuellt, nicht
  // verwaschen – ein Autohaus braucht keinen Weichzeichner.
  // Das Label wird ins Bild gerechnet, nicht darübergelegt: was Instagram
  // bekommt, ist eine fertige Datei. Gezeichnet wird auf derselben Flaeche,
  // auf der ohnehin zugeschnitten wird – ein zusaetzlicher Schritt entsteht
  // nicht.
  //
  // Bewusst KEINE KI am Bild: seit dem 2. August 2026 muss gekennzeichnet
  // werden, wer Fahrzeugbilder mit KI erzeugt oder veraendert (EU AI Act).
  // Wir schreiben nur Text darauf, den der Betrieb selbst kennt.
  function labelZeichnen(g, breite, hoehe, text, logo, stelle, schrift, aiy) {
    if (!text && !logo) return;
    const rand = Math.round(breite * 0.045);
    // Steht die Marke unten rechts, endet der Text davor. Sonst laeuft ein
    // langer Modellname unter die Kurve.
    // Nur bei buendigem Text kuerzen – bei zentriertem verschoebe das Polster
    // die Mitte, statt Platz zu schaffen; der weicht senkrecht aus.
    const gleicheZeile = logo && stelle && stelle.angaben && stelle.logo
      && stelle.angaben.split('-')[0] === stelle.logo.split('-')[0]
      && stelle.angaben.split('-')[1] !== 'mitte';
    const platz = breite - rand * 2 - (gleicheZeile ? Math.round(breite * 0.25) : 0);
    // Lange Modellnamen laufen sonst aus dem Bild. Erst kleiner setzen, und
    // wenn das nicht reicht, hinten kuerzen – abgeschnitten waere schlimmer
    // als klein.
    let groesse = Math.round(breite * 0.032);
    const setzen = () => {
      g.font = `600 ${groesse}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    };
    setzen();
    while (text && g.measureText(text).width > platz && groesse > breite * 0.022) {
      groesse -= 1; setzen();
    }
    while (text && g.measureText(text).width > platz && text.length > 12) {
      text = text.slice(0, -2) + '…';
    }
    g.textBaseline = 'alphabetic';

    // Ein Verlauf statt eines Balkens: er sitzt dort, wo Fahrzeugfotos unten
    // ohnehin dunkel werden, und liest sich als Bildunterschrift statt als
    // aufgeklebtes Schild.
    const [tv, th] = (stelle && stelle.angaben ? stelle.angaben : 'unten-links').split('-');
    const [lv, lh] = (stelle && stelle.logo ? stelle.logo : 'unten-rechts').split('-');

    if (text && window.beitragStil) {
      const px = Math.round(breite * (window.beitragStil.jetzt('angaben').groesse || 32) / 1000);
      // Dieselbe Ecke wie die Marke: dann ruecken die Angaben senkrecht ab,
      // um deren Hoehe plus etwas Luft. Das Logo bleibt, wo es steht.
      // Dieselbe Ebene genuegt, wenn der Text zentriert ist: dort laesst sich
      // seitlich kein Platz schaffen, ohne die Mitte zu verschieben.
      const [lv2, lh2] = (stelle && stelle.logo ? stelle.logo : 'unten-rechts').split('-');
      const zusammen = logo && stelle && stelle.angaben && stelle.logo
        && tv === lv2                                   // dieselbe Ebene
        && (th === lh2                                  // dieselbe Ecke
          || th === 'mitte'                             // zentriert: kein Platz zu kuerzen
          || lh2 === 'mitte');                          // Marke mittig: Text laeuft hinein
      const weicht = zusammen ? Math.round(breite * 0.204 * 64 / 220 + px * 0.9) : 0;
      const y = tv === 'oben' ? rand + px + weicht
        : (tv === 'mitte' ? Math.round(hoehe / 2 + px / 3) + weicht : hoehe - rand - weicht);
      const x = th === 'links' ? rand
        : (th === 'mitte' ? Math.round(breite / 2) : breite - rand);
      window.beitragStil.zeichnen('angaben', g, breite, hoehe, text, x, y,
        th === 'links' ? 'left' : (th === 'mitte' ? 'center' : 'right'));
    } else if (text) {
      const tb = g.measureText(text).width;
      const y = tv === 'oben' ? rand + groesse
        : (tv === 'mitte' ? Math.round(hoehe / 2 + groesse / 3) : hoehe - rand);
      const x = th === 'links' ? rand
        : (th === 'mitte' ? Math.round((breite - tb) / 2) : Math.round(breite - rand - tb));

      // Der Verlauf nur oben oder unten: in der Mitte waere ein Band ueber dem
      // Motiv schlimmer als ein Schatten unter der Schrift.
      // Kein Band mehr, nur ein weicher Schatten unter der Schrift. Der
      // Verlauf legte sich wie ein Balken ueber das untere Bilddrittel und
      // war auf hellen Fotos deutlicher zu sehen als der Text darauf.
      g.shadowColor = 'rgba(0,0,0,.72)';
      g.shadowBlur = Math.round(breite * 0.018);
      g.shadowOffsetY = Math.round(breite * 0.002);
      g.fillStyle = '#ffffff';
      // Zweimal setzen: der erste Zug traegt den Schatten, der zweite die
      // saubere Kante darauf.
      g.fillText(text, x, y);
      g.shadowBlur = 0; g.shadowOffsetY = 0;
      g.fillText(text, x, y);
    }

    // Das Zeichen sitzt auf derselben Grundlinie wie der Text, in einem hellen
    // Kreis: auf einem dunklen Verlauf wuerde ein dunkles Logo verschwinden,
    // und ein Kreis liest sich als Siegel statt als vergessener Ausschnitt.
    if (logo) {
      // Die vier Fassungen haben verschiedene Seitenverhaeltnisse. Bezugs-
      // groesse bleibt die Vollform: eine schmalere Fassung wird deshalb
      // auch schmaler gezeichnet und nicht auf dieselbe Breite gestreckt.
      const f = window.aiyMarke.fassung(!!aiy, !!schrift);
      const w = Math.round(breite * 0.204 * (f.breit / 254.51));
      const h = Math.round(w * f.hoch / f.breit);
      const ly = lv === 'oben' ? rand
        : (lv === 'mitte' ? Math.round((hoehe - h) / 2) : hoehe - rand - h);
      const lx = lh === 'links' ? rand
        : (lh === 'mitte' ? Math.round((breite - w) / 2) : breite - rand - w);
      g.save();
      g.translate(lx, ly);
      g.scale(w / f.breit, h / f.hoch);
      g.fillStyle = '#ffffff';
      // Ein weicher Schatten darunter: auf einem hellen Foto wuerde die
      // Marke sonst mit dem Hintergrund verschwimmen.
      g.shadowColor = 'rgba(0,0,0,.45)';
      g.shadowBlur = 10;
      // Dieselben Teile, aus denen auch die Vorschau gebaut wird – jedes mit
      // seiner Verschiebung, damit die gestapelte Fassung wirklich stapelt.
      f.teile.forEach(t => {
        g.save();
        if (t.dx || t.dy) g.translate(t.dx || 0, t.dy || 0);
        g.fill(new Path2D(t.d));
        g.restore();
      });
      g.restore();

    }
  }

  // Der BEITRAGSTEXT einer Story wird eingebrannt, der eines Beitrags nicht:
  // unter einem Beitrag steht er ohnehin, eine Story hat kein Textfeld.
  // Die Titelüberschrift dagegen gehoert in beide – sie ist kein Fliesstext,
  // sondern die Zeile, die man im Bild lesen soll. Instagram macht es selbst
  // genauso, mit Kaesten hinter jeder Zeile.
  function storyZeichnen(g, breite, hoehe, st) {
    if (!st || !st.zeile) return;

    // Der Titel traegt denselben Stil, den "Gestalten …" einstellt – frueher
    // stand hier fest schwarzer Kasten mit weisser Schrift. Die Vorschau
    // zeigte den eingestellten Stil, das gerechnete Bild nicht: was man sah,
    // war nicht, was gepostet wurde.
    const stil = (window.beitragStil && window.beitragStil.jetzt('titel')) || {};
    const familie = stil.schrift
      || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const dicke = stil.dicke || 800;
    const farbe = stil.farbe || '#ffffff';
    const grund = stil.grund || 'kasten';
    const grundfarbe = (window.beitragStil && window.beitragStil.mitDeckung)
      ? window.beitragStil.mitDeckung(stil.grundfarbe || '#000000',
          stil.deckung == null ? 72 : stil.deckung)
      : 'rgba(0,0,0,.72)';

    const rand = Math.round(breite * 0.075);
    const platz = breite - rand * 2;
    const schrift = (px, dick) => `${dick} ${px}px ${familie}`;

    // Eine Zeile, die nicht passt, wird umbrochen – nicht abgeschnitten und
    // nicht endlos verkleinert.
    const brechen = (text, px, dick) => {
      g.font = schrift(px, dick);
      const worte = String(text).split(/\s+/).filter(Boolean);
      const zeilen = [];
      let jetzt = '';
      worte.forEach(w => {
        const probe = jetzt ? jetzt + ' ' + w : w;
        if (g.measureText(probe).width > platz && jetzt) { zeilen.push(jetzt); jetzt = w; }
        else jetzt = probe;
      });
      if (jetzt) zeilen.push(jetzt);
      return zeilen;
    };

    // Deutlich kleiner als zuvor. Ein Textsticker in Instagram ist etwa so
    // gross wie zwei Zeilen Bildunterschrift – wird er groesser, sieht er
    // aufgeklebt aus statt getippt.
    // Die eingestellte Groesse gilt in Promille der Bildbreite – wie bei den
    // Angaben. Die Unterzeile behaelt ihr Groessenverhaeltnis zur Hauptzeile.
    const grossPx = Math.round(breite * (stil.groesse || 52) / 1000);
    const kleinPx = Math.round(grossPx * 0.62);
    const bloecke = [
      ...brechen(st.zeile, grossPx, dicke).map(t => ({ t, px: grossPx, dick: dicke })),
      ...(st.unterzeile ? brechen(st.unterzeile, kleinPx, Math.max(400, dicke - 200))
        .map(t => ({ t, px: kleinPx, dick: Math.max(400, dicke - 200) })) : [])
    ];

    // Enge Kaesten: sie sollen am Text liegen, nicht um ihn herum stehen.
    const luftY = Math.round(breite * 0.009);
    // Polster nur, wo auch eine Flaeche liegt: bei "Kein Grund" und
    // "Schatten" wuerde der Text sonst gegen nichts einruecken.
    const luftX = (grund === 'kasten' || grund === 'band')
      ? Math.round(breite * 0.016) : 0;
    const abstand = Math.round(breite * 0.008);
    bloecke.forEach(b => {
      g.font = schrift(b.px, b.dick);
      b.breite = Math.ceil(g.measureText(b.t).width) + luftX * 2;
      b.hoehe = Math.round(b.px * 1.16) + luftY * 2;
    });
    const ganz = bloecke.reduce((n, b) => n + b.hoehe, 0) + abstand * (bloecke.length - 1);

    // Oben und unten mit Abstand zu Instagrams eigenen Bedienelementen: der
    // Fortschrittsbalken sitzt oben, das Antwortfeld unten.
    const oben = Math.round(hoehe * 0.14);
    const unten = Math.round(hoehe * 0.82) - ganz;
    const v = (st.stelle || 'unten-links').split('-')[0];
    let y = v === 'oben' ? oben
      : (v === 'mitte' ? Math.round((hoehe - ganz) / 2) : unten);
    y = Math.max(oben, Math.min(y, unten));

    const r = Math.round(breite * 0.009);
    const h = (st.stelle || 'unten-links').split('-')[1] || 'links';
    bloecke.forEach(b => {
      const x = h === 'links' ? rand
        : (h === 'mitte' ? Math.round((breite - b.breite) / 2) : breite - rand - b.breite);
      if (grund === 'kasten') {
        g.beginPath();
        if (g.roundRect) g.roundRect(x, y, b.breite, b.hoehe, r);
        else g.rect(x, y, b.breite, b.hoehe);
        g.fillStyle = grundfarbe;
        g.fill();
      } else if (grund === 'band') {
        // Ueber die ganze Breite, nicht nur unter dem Wort.
        g.fillStyle = grundfarbe;
        g.fillRect(0, y, breite, b.hoehe);
      }

      g.font = schrift(b.px, b.dick);
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      if (grund === 'schatten') {
        g.shadowColor = 'rgba(0,0,0,.72)';
        g.shadowBlur = Math.round(breite * 0.018);
        g.shadowOffsetY = Math.round(breite * 0.002);
      }
      g.fillStyle = farbe;
      g.fillText(b.t, x + luftX, y + b.hoehe / 2 + 1);
      // Zweiter Zug ohne Schatten: sonst wirkt die Kante verwaschen.
      if (grund === 'schatten') {
        g.shadowBlur = 0; g.shadowOffsetY = 0;
        g.fillText(b.t, x + luftX, y + b.hoehe / 2 + 1);
      }
      y += b.hoehe + abstand;
    });
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  async function zuschneiden(quelle, stand, hoch, label, logo, story, stelle, schrift, aiy) {
    return new Promise((fertig, schief) => {
      const bild = new Image();
      bild.crossOrigin = 'anonymous';
      bild.onload = () => {
        const breite = 1440;
        const hoehe = Math.round(hoch ? breite * 16 / 9 : breite * 5 / 4);
        const c = document.createElement('canvas');
        c.width = breite; c.height = hoehe;
        const g = c.getContext('2d');
        // Beste Skalierungsstufe anfordern. Gemessen bringt sie in Chrome
        // fast nichts (0 % beim Verkleinern, ~3 % beim Vergroessern) – dort
        // ist die Vorgabe schon gut. In anderen Browsern kann sie helfen,
        // kosten tut sie nichts.
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, breite, hoehe);

        // Wie im Browser: erst fuellend einpassen (cover), dann Zoom, dann
        // die Verschiebung – x und y sind Anteile der Rahmenmasse.
        const deckend = Math.max(breite / bild.width, hoehe / bild.height);
        const m = deckend * (stand.z / 100);
        const bw = bild.width * m, bh = bild.height * m;
        g.drawImage(bild,
          (breite - bw) / 2 + (stand.x || 0) * breite,
          (hoehe - bh) / 2 + (stand.y || 0) * hoehe,
          bw, bh);

        labelZeichnen(g, breite, hoehe, label, logo, stelle, schrift, aiy);
        storyZeichnen(g, breite, hoehe, story);

        // 0.95 statt 0.92: Instagram rechnet das Bild ohnehin noch einmal
        // durch seine eigene Kompression. Was hier schon Artefakte hat,
        // bekommt dort weitere dazu – die paar hundert KB sind der
        // sichtbar sauberere Verlauf wert.
        c.toBlob(b => (b ? fertig(b) : schief(new Error('Bild ließ sich nicht erzeugen.'))), 'image/jpeg', 0.95);
      };
      bild.onerror = () => schief(new Error('Bild ließ sich nicht laden.'));
      bild.src = quelle;
    });
  }

  function reelHtml(v, variante) {
    const roh = window.beitragText.reel(v, variante);
    const e = fzEigen[v.id];
    const r = e && e.szenen && e.szenen.length ? {
      ...roh,
      plan: e.szenen.map(x => ({ zeit: x.zeit || '', was: x.was || '' })),
      ton: e.musik || roh.ton,
      text: e.text || roh.text,
      hashtags: e.hashtags || roh.hashtags
    } : roh;
    return rahmen(vorschau(r.text, r.hashtags, 'reel'), `
      <div class="sm-kopf"><b>Drehplan · ${schuetzen(r.dauer)}</b>
        <span>Variante ${((variante % r.varianten) + r.varianten) % r.varianten + 1} von ${r.varianten}</span></div>
      <ol class="sm-plan">
        ${r.plan.map(x => `<li><span>${schuetzen(x.zeit)}</span><p>${schuetzen(x.was)}</p></li>`).join('')}
      </ol>
      <p class="sm-ton"><b>Ton:</b> ${schuetzen(r.ton)}</p>

      <div class="sm-kopf"><b>Text zum Reel</b></div>
      <pre class="sm-text" data-kopie>${schuetzen(r.text)}\n\n${schuetzen(r.hashtags)}</pre>
      <div class="sm-knoepfe">
        <button type="button" class="btn-klein sm-leise" data-zurueck-var
          title="Vorherigen Vorschlag">←</button>
        <button type="button" class="btn-klein sm-leise" data-wuerfeln title="Neuen Vorschlag">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="2.2" aria-hidden="true">
            <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" stroke-linecap="round"/>
            <polyline points="20.5 3.5 20.5 9 15 9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg></button>
        <button type="button" class="btn-klein sm-leise" data-bearbeiten>Bearbeiten</button>
      </div>

      <div class="sm-kopf" style="margin-top:18px"><b>Titelbild</b></div>
      ${labelHtml(labelVorschlag(v))}
      <p class="gd-notiz plan-notiz" data-plan-notiz hidden></p>
      <div class="sm-bilder"><p class="mon-laedt">Bilder werden geladen …</p></div>`, true);
  }

  function verdrahten(feld, id, variante) {
    // Wuerfeln heisst: zurueck zum Baukasten. Sonst bliebe der generierte Text
    // stehen und die Variantenzahl daneben waere gelogen.
    const wuerfeln = feld.querySelector('[data-wuerfeln]');
    if (wuerfeln) wuerfeln.addEventListener('click', () => {
      delete fzEigen[id]; bauenUndZeigen(id, variante + 1);
    });

    const bauen = feld.querySelector('[data-bauen]');
    if (bauen) bauen.addEventListener('click', async () => {
      const beschriftung = bauen.querySelector('span');
      const wort = beschriftung.textContent;
      const fotos = [...feld.querySelectorAll('.sm-foto:not(.sm-foto-neu)')].map(k => k.dataset.u);
      if (!fotos.length) {
        // Die Beschriftung muss zurueck: sonst heisst der Knopf "Erst Fotos
        // abwarten", auch wenn die Fotos laengst geladen sind.
        beschriftung.textContent = 'Erst Fotos abwarten';
        setTimeout(() => { beschriftung.textContent = wort; }, 2500);
        return;
      }

      bauen.disabled = true; beschriftung.textContent = 'Wird gebaut …';
      try {
        const v = await fahrzeugHolen(id);
        if (!v) throw new Error('Fahrzeugdaten nicht gefunden.');
        const a = await fetch('/api/studio/zusammenstellen', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fahrzeug: v, bilder: fotos, format })
        });
        const roh = await a.text();
        let e = null;
        try { e = JSON.parse(roh); } catch {
          throw new Error(`Antwort war kein JSON (${a.status}): ${roh.slice(0, 80)}`);
        }
        if (!e.ok) throw new Error(e.fehler || 'HTTP ' + a.status);

        fzEigen[id] = e.beitrag;
        bauenUndZeigen(id, variante);
      } catch (err) {
        const notiz = feld.querySelector('[data-plan-notiz]');
        if (notiz) {
          notiz.classList.add('plan-fehler');
          notiz.innerHTML = `<span><b>Das hat nicht geklappt.</b></span>
            <span>${schuetzen(err.message)}</span>`;
          notiz.hidden = false;
        }
      } finally {
        bauen.disabled = false;
        beschriftung.textContent = wort;
      }
    });

    // Einen Schritt zurueck: die Bausteine rechnen mit negativen Zahlen,
    // deshalb geht das auch vor der ersten Variante.
    const zurueckVar = feld.querySelector('[data-zurueck-var]');
    if (zurueckVar) zurueckVar.addEventListener('click', () => bauenUndZeigen(id, variante - 1));

    bearbeitenVerdrahten(feld);
    mehrVerdrahten(feld);
    labelVerdrahten(feld);
    zeileVerdrahten(feld);
    stilAnlegen(feld);
    stellungAnlegen(feld);
    zeilenGrauen(feld);
    planenVerdrahten(feld, id);
  }

  // ─── Bilder ansehen lassen ──────────────────────────────────────────
  //
  // Ein Modell schaut sich die Fotos an und sagt, welches vorn stehen sollte
  // und in welcher Reihenfolge die anderen kommen. Es VERAENDERT nichts –
  // ausgewaehlt und zugeschnitten wird hier, wie bisher. Der Plan ist ein
  // Vorschlag: angetippt bleibt angetippt, bis man ihn uebernimmt.
  function planenVerdrahten(feld, id) {
    const knopf = feld.querySelector('[data-planen]');
    if (!knopf) return;

    knopf.addEventListener('click', async () => {
      const wort = knopf.textContent;
      knopf.disabled = true;
      knopf.textContent = 'Wird angesehen …';
      try {
        const a = await fetch('/api/studio/planen', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bilder: [...feld.querySelectorAll('.sm-foto:not(.sm-foto-neu)')].map(k => k.dataset.u).slice(0, 12),
            angaben: (feld.querySelector('[data-label-text]') || {}).value || ''
          })
        });
        // Rohtext lesen: kommt HTML statt JSON, soll der Anfang davon in der
        // Meldung stehen – sonst sieht man nur "unexpected token <".
        const roh = await a.text();
        let d = null;
        try { d = JSON.parse(roh); } catch {
          throw new Error(`/api/studio/planen antwortete kein JSON (${a.status}): `
            + roh.slice(0, 90).replace(/\s+/g, ' '));
        }
        if (!d.ok) throw new Error(d.fehler || 'HTTP ' + a.status);
        planAnwenden(feld, d.plan, d.angesehen);
        knopf.textContent = wort;
      } catch (err) {
        knopf.textContent = 'Ging nicht: ' + err.message;
        setTimeout(() => { knopf.textContent = wort; }, 5000);
      } finally {
        knopf.disabled = false;
      }
    });
  }

  function planAnwenden(feld, plan, angesehen) {
    // Ohne :not(.sm-foto-neu) waere kacheln[0] die Hinzufuegen-Kachel, und die
    // Nummern des Modells laegen alle um eins daneben – es kaeme eine andere
    // Reihenfolge heraus als die vorgeschlagene.
    const kacheln = [...feld.querySelectorAll('.sm-foto:not(.sm-foto-neu)')];
    if (!kacheln.length || !plan) return;

    // Die Nummern des Modells sind 1-basiert und beziehen sich auf die
    // Reihenfolge, in der die Bilder geschickt wurden.
    const reihe = (plan.reihenfolge || []).map(n => kacheln[n - 1]).filter(Boolean);
    if (reihe.length) {
      kacheln.forEach(k => { k.classList.remove('aktiv'); k.setAttribute('aria-pressed', 'false'); });
      reihe.forEach(k => { k.classList.add('aktiv'); k.setAttribute('aria-pressed', 'true'); });
      // Die Reihenfolge steckt in der Reihenfolge der Kacheln – also die
      // gewaehlten nach vorn ziehen, damit das Titelbild wirklich vorn steht.
      const raster = reihe[0].parentElement;
      reihe.slice().reverse().forEach(k => raster.prepend(k));
    }

    // Der Zuschnitt gilt nur fuers Titelbild und nur, wenn das Modell etwas
    // zu verschieben sieht.
    const z = plan.zuschnitt;
    if (reihe[0] && z && (z.waagrecht || z.senkrecht)) {
      const u = reihe[0].dataset.u;
      const st = standVon(u);
      bildStand.set(u, { ...st,
        x: Math.max(-.3, Math.min(.3, (Number(z.waagrecht) || 0) / 100)),
        y: Math.max(-.3, Math.min(.3, (Number(z.senkrecht) || 0) / 100)) });
    }

    const zeile = feld.querySelector('[data-plan-notiz]');
    if (zeile) {
      const teile = [plan.begruendung, plan.auffaellig].filter(Boolean);
      zeile.innerHTML = `${schuetzen(teile.join(' '))}
        ${plan.warnung ? `<b class="plan-warnung">${schuetzen(plan.warnung)}</b>` : ''}
        <i>${zahl(angesehen)} Fotos angesehen · Vorschlag, nichts ist verändert</i>`;
      zeile.hidden = false;
    }

    vorschauBild(feld);
    const stand = feld.querySelector('.sm-stand');
    if (stand) stand.textContent = `${reihe.length} ausgewählt`;
  }

  // Ohne Haken kein Text – und die Vorschau zeigt beides sofort, sonst sieht
  // man erst beim Veroeffentlichen, was man gebaut hat.
  // Die Marke in der Vorschau neu setzen: mit Namen (Schrift an) zeigt sie
  // Bildmarke + AIY + Ihsan Yilmaz, ohne nur Bildmarke + AIY. Neu zeichnen
  // statt etwas zu verstecken – die beiden Fassungen setzen "AIY"
  // unterschiedlich hoch, ein blosses Ausblenden liesse eine Luecke.
  function markeZeichnen(wurzel) {
    const w = wurzel || document;
    const mitAIY = aiyVon(w.querySelector ? w : document);
    const mitName = schriftVon(w.querySelector ? w : document);
    w.querySelectorAll('[data-marke-svg]').forEach(ziel => {
      ziel.innerHTML = window.aiyMarke.svg(mitAIY, mitName);
      // Die Fassungen sind unterschiedlich breit im Verhaeltnis zur Hoehe.
      // Ohne Nachziehen sitzt die gestapelte Fassung sonst so breit wie die
      // Vollform und wird dadurch riesig.
      const f = window.aiyMarke.fassung(mitAIY, mitName);
      const marke = ziel.closest('.igv-marke');
      if (marke) marke.style.width = (f.breit / 254.51 * 20.4).toFixed(2) + '%';
    });
  }

  function logoVerdrahten(feld) {
    const an = feld.querySelector('[data-logo-an]');
    const v = feld.querySelector('[data-vorschau] .igv-marke');
    if (!an || !v) return;
    const nachziehen = () => { v.hidden = !an.checked; reiheZeichnen(feld); };
    an.addEventListener('change', () => { schalterMerken('logo', an.checked); nachziehen(); });
    nachziehen();
  }

  // Der gespeicherte Stil auf die Nachbildung – dieselben Werte, mit denen
  // das Canvas hinterher rechnet.
  // Was gewaehlt wurde, gilt auch nach dem Neuzeichnen – sonst zeigen die
  // Knoepfe das eine und das Bild das andere.
  function stellungAnlegen(feld) {
    const paare = [['zeile', '.igs-zeile'], ['angaben', '.igv-label'], ['logo', '.igv-marke']];
    paare.forEach(([was, wahl]) => {
      const el = feld.querySelector(wahl);
      if (!el || !gemerkt[was]) return;
      [...el.classList].forEach(k => { if (k.startsWith('pos-')) el.classList.remove(k); });
      el.classList.add('pos-' + gemerkt[was]);
    });
  }

  // Ist das Haekchen weg, haben die Pfeile daneben keine Wirkung mehr – dann
  // sollen sie auch nicht so aussehen, als haetten sie eine.
  function zeilenGrauen(feld) {
    feld.querySelectorAll('.sm-logo-zeile').forEach(z => {
      const an = z.querySelector('input[type="checkbox"]');
      if (!an) return;
      // Beim Titel stehen die Pfeile eine Zeile tiefer, in der Reihe mit dem
      // Feld – die muss mitgrauen, sonst sehen sie nach Wahl aus.
      const auch = z.parentElement && z.parentElement.querySelector('.sm-zeile-reihe');
      const setzen = () => {
        z.classList.toggle('sm-aus', !an.checked);
        if (auch) auch.classList.toggle('sm-aus', !an.checked);
      };
      if (!an.dataset.grau) {
        an.dataset.grau = '1';
        an.addEventListener('change', setzen);
      }
      setzen();
    });
  }

  function stilAnlegen(feld) {
    if (!window.beitragStil) return;
    const kasten = feld.querySelector('.igv-bild');
    if (!kasten || !kasten.clientWidth) return;
    // Die Art des Grundes als Klasse, nicht als inline-Polster: sonst schluege
    // sie die Regeln fuer Zentrierung und Ausweichen.
    const grundKlasse = (el, was) => {
      if (!el) return;
      const g = window.beitragStil.jetzt(was).grund;
      ['keiner', 'schatten', 'kasten', 'band'].forEach(x =>
        el.classList.toggle('stil-grund-' + x, x === g));
    };

    const l = feld.querySelector('.igv-label');
    if (l) {
      l.setAttribute('style', window.beitragStil.alsCss('angaben', kasten.clientWidth));
      grundKlasse(l, 'angaben');
    }
    // Der Titel traegt seinen Stil an den beiden Zeilen darin, nicht am
    // Behaelter – der ordnet nur an.
    const z = feld.querySelector('.igs-zeile');
    const gross = z && z.querySelector('b');
    if (gross) {
      gross.setAttribute('style', window.beitragStil.alsCss('titel', kasten.clientWidth));
      grundKlasse(gross, 'titel');
    }
  }

  function labelVerdrahten(feld) {
    logoVerdrahten(feld);
    const an = feld.querySelector('[data-label-an]');
    const text = feld.querySelector('[data-label-text]');
    if (!an || !text) return;
    const nachziehen = () => {
      if (an.checked && !text.value.trim()) text.value = text.placeholder;
      text.disabled = !an.checked;
      const v = feld.querySelector('[data-vorschau] .igv-label');
      if (!v) return;
      v.textContent = an.checked ? text.value.trim() : '';
      v.hidden = !an.checked || !text.value.trim();
      // Nur das Aussehen der Zeile selbst nachziehen. Stellung und Ausgrauen
      // haengen nicht am Text – sie bei jedem Tastendruck neu zu setzen hat
      // beim Tippen alles durcheinandergebracht.
      stilAnlegen(feld);
    };
    an.addEventListener('change', () => {
      schalterMerken('angaben', an.checked);
      nachziehen(); zeilenGrauen(feld); stellungAnlegen(feld);
    });
    text.addEventListener('input', nachziehen);
    nachziehen();

    // Auch der Schrift-Knopf kommt gemerkt aus der Vorlage – das Wort in der
    // Vorschau muss nach dem Neuzeichnen einmal nachziehen.
    markeZeichnen(feld);
  }

  // "… mehr" klappt den Rest des Textes auf – wie in der App. Zusammen
  // klappt er nicht wieder, das tut Instagram auch nicht.
  function mehrVerdrahten(feld) {
    const mehr = feld.querySelector('[data-rest]');
    const sichtbar = feld.querySelector('[data-sichtbar]');
    if (!mehr || !sichtbar) return;
    mehr.addEventListener('click', () => {
      sichtbar.textContent = sichtbar.dataset.voll || sichtbar.textContent;
      mehr.hidden = true;
    });
  }

  // Der Text laesst sich direkt im Kasten aendern; die Vorschau zieht bei
  // jedem Tastendruck nach. Kein zweites Eingabefeld, kein Speichern-Knopf –
  // was dasteht, ist das, was rausgeht.
  // Was man hier tippt, steht gleich im Bild – die Zeile ist kein Vorschlag
  // zum Abschreiben, sondern der Text selbst.
  function zeileVerdrahten(feld) {
    const f = feld.querySelector('[data-zeile-feld]');
    const z = feld.querySelector('.igs-zeile');
    if (!f || !z) return;

    // Die Zeile in der Nachbildung kommt leer aus der Vorlage – erst hier
    // bekommt sie ihren Inhalt, sonst bliebe sie unsichtbar, egal was im
    // Feld steht.
    const fuellen = () => {
      const zeilen = f.textContent.split('\n').map(x => x.trim()).filter(Boolean);
      z.innerHTML = `<b>${schuetzen(zeilen[0] || '')}</b>`
        + (zeilen[1] ? `<i>${schuetzen(zeilen[1])}</i>` : '');
    };
    fuellen();

    const an = feld.querySelector('[data-zeile-an]');
    if (an) {
      const nachziehen = () => {
        z.hidden = !an.checked;
        f.parentElement && (f.style.opacity = an.checked ? '' : '.45');
      };
      an.addEventListener('change', () => { schalterMerken('zeile', an.checked); nachziehen(); });
      nachziehen();
    }
    f.addEventListener('input', fuellen);
  }

  // Wie weit sich ein Bild schieben laesst, haengt nicht nur am Zoom, sondern
  // vor allem am Ueberstand: ein Querformat im Hochformat ragt seitlich weit
  // hinaus, auch ohne Zoom – und dieser Teil des Bildes laesst sich hereinholen.
  // Nur der Zoom schafft Spielraum: bei hundert Prozent sitzt das Bild genau
  // im Rahmen und laesst sich nicht bewegen. Der seitliche Ueberstand eines
  // Querformats im Hochformat bleibt bewusst gesperrt – wer dort etwas anderes
  // sehen will, zoomt hinein.
  function grenze(bild, z) {
    const g = Math.max(0, (z / 100 - 1) / 2);
    return { x: g, y: g };
  }


  function bearbeitenVerdrahten(feld) {
    const knopf = feld.querySelector('[data-bearbeiten]');
    const kasten = feld.querySelector('[data-kopie]');
    if (!knopf || !kasten) return;

    // Der zweite Knopf erscheint erst beim Bearbeiten: solange nichts offen
    // ist, gaebe es nichts zu uebernehmen.
    const fuerAlle = document.createElement('button');
    fuerAlle.type = 'button';
    fuerAlle.className = 'btn-klein sm-leise sm-fuer-alle';
    fuerAlle.textContent = 'Für alle speichern';
    fuerAlle.hidden = true;

    // Zurueck zum Stand vor dem Bearbeiten – ohne das ist jede Aenderung
    // endgueltig, sobald man einmal hineingetippt hat.
    const abbrechen = document.createElement('button');
    abbrechen.type = 'button';
    abbrechen.className = 'btn-klein sm-leise';
    abbrechen.textContent = 'Abbrechen';
    abbrechen.hidden = true;
    knopf.after(abbrechen);
    knopf.after(fuerAlle);

    let vorher = '';
    const schliessen = () => {
      kasten.setAttribute('contenteditable', 'false');
      kasten.classList.remove('sm-text-offen');
      knopf.textContent = 'Bearbeiten';
      fuerAlle.hidden = true;
      abbrechen.hidden = true;
      kasten.textContent = kasten.textContent;   // Faerbung wieder heraus
    };

    abbrechen.addEventListener('click', () => {
      kasten.textContent = vorher;
      vorschauText(feld, vorher);
      schliessen();
    });

    knopf.addEventListener('click', () => {
      if (kasten.getAttribute('contenteditable') === 'true') { schliessen(); return; }
      vorher = kasten.textContent;
      kasten.setAttribute('contenteditable', 'true');
      kasten.classList.add('sm-text-offen');
      knopf.textContent = 'Speichern';
      fuerAlle.hidden = false;
      abbrechen.hidden = false;
      fussFaerben(kasten);
      kasten.focus();
    });

    fuerAlle.addEventListener('click', async () => {
      const fuss = fussAus(kasten.textContent);
      fuerAlle.disabled = true;
      const wort = fuerAlle.textContent;
      fuerAlle.textContent = 'Wird gespeichert …';
      try {
        const a = await fetch('/api/studio/fuss', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fuss)
        });
        const d = await a.json();
        if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
        eigenerFuss = { nummer: d.nummer, hashtags: d.hashtags };
        // Speichern heisst fertig: der Text bleibt stehen, die Bearbeitung
        // geht zu. Vorher blieb sie offen und man wusste nicht, ob etwas
        // passiert ist.
        fuerAlle.textContent = 'Gilt jetzt überall';
        setTimeout(() => {
          fuerAlle.textContent = wort;
          fuerAlle.disabled = false;
          schliessen();
        }, 1200);
      } catch (err) {
        fuerAlle.textContent = 'Ging nicht';
        setTimeout(() => { fuerAlle.textContent = wort; fuerAlle.disabled = false; }, 4000);
      }
    });

    kasten.addEventListener('input', () => vorschauText(feld, kasten.textContent));
  }

  // Der Schluss eines Beitrags: die letzte Zeile vor den Hashtags ist die
  // Telefonnummer, der Block mit Rauten sind die Hashtags.
  let eigenerFuss = null;

  // Der gemeinsame Schluss wird eingefaerbt, damit man sieht, was der zweite
  // Knopf mitnimmt – dieselbe blasse Farbe wie er selbst.
  // Ueber Zeilenpositionen statt Textsuche: die Suche nach der zusammen-
  // gesetzten Zeichenkette scheiterte an Kleinigkeiten im Abstand, die man im
  // Quelltext nicht sieht. Hier wird nur gezaehlt – das kann nicht danebengehen.
  function fussFaerben(kasten) {
    if (!kasten) return;
    const alles = kasten.textContent;
    const zeilen = alles.split('\n');

    // Von hinten: die Hashtags ueberspringen, dann die naechsten beiden
    // nicht leeren Zeilen faerben – Nummer und Verweis auf die Seite.
    let i = zeilen.length - 1;
    while (i >= 0 && (!zeilen[i].trim() || zeilen[i].trim().startsWith('#'))) i--;
    let bis = i, zahl = 0;
    while (i >= 0 && zahl < 3) {
      if (zeilen[i].trim()) zahl++;
      if (zahl < 3) i--;
    }
    if (zahl < 3 || i < 0) return;

    // Bis zum Ende faerben: die Hashtags gehoeren genauso zum gemeinsamen
    // Schluss wie Nummer und Verweis – sie stehen unter jedem Beitrag gleich.
    kasten.innerHTML = schuetzen(zeilen.slice(0, i).join('\n') + (i ? '\n' : ''))
      + `<span class="sm-fuss-teil">${schuetzen(zeilen.slice(i).join('\n'))}</span>`;
  }

  function fussAus(alles) {
    const teile = String(alles).split(/\n\s*\n(?=#)/);
    const hashtags = teile.length > 1 ? teile.pop().trim() : '';
    // Die letzten drei Zeilen sind Einladung, Nummer und Seite – zusammen der
    // gemeinsame Schluss.
    const zeilen = teile.join('\n\n').split('\n')
      .map(z => z.trim()).filter(z => z && !z.startsWith('#'));
    const raus = String(alles).split('\n').map(z => z.trim())
      .filter(z => z.startsWith('#')).join(' ');
    return { nummer: zeilen.slice(-3).join('\n'), hashtags: hashtags || raus };
  }

  // Beim Zeichnen anwenden: was einmal fuer alle gespeichert wurde, ersetzt
  // Nummer und Hashtags des Baukastens.
  function mitFuss(text, hashtags) {
    if (!eigenerFuss || !eigenerFuss.nummer) return { text, hashtags };
    // Ein Schluss mit Rauten darin ist kaputt gespeichert – dann lieber der
    // Baukasten als ein Beitrag mit halben Hashtags mittendrin.
    if (eigenerFuss.nummer.includes('#')) return { text, hashtags };
    // Hier stand eine Pruefung auf halbe Adressen am Zeilenende. Sie war der
    // Grund, warum "Für alle speichern" nie gewirkt hat: der richtige Schluss
    // endet auf "autohaus-diezmann.de" und wurde von ihr genauso verworfen wie
    // ein abgeschnittener. Gegen das Abschneiden hilft ohnehin nur die Stelle,
    // an der es passierte – die Laengengrenze in functions/api/studio/fuss.js.
    // Die letzten drei nicht leeren Zeilen ersetzen – Einladung, Nummer, Seite.
    const zeilen = String(text).split('\n');
    const voll = zeilen.map((z, i) => [z.trim(), i]).filter(([z]) => z).slice(-3).map(([, i]) => i);
    if (voll.length && eigenerFuss.nummer) {
      zeilen.splice(voll[0], voll.length, ...eigenerFuss.nummer.split('\n'));
    }
    return { text: zeilen.join('\n'), hashtags: eigenerFuss.hashtags || hashtags };
  }

  (async () => {
    try {
      const a = await fetch('/api/studio/fuss', { credentials: 'same-origin' });
      const d = await a.json();
      if (d && d.ok && (d.nummer || d.hashtags)) {
        eigenerFuss = { nummer: d.nummer, hashtags: d.hashtags };
      }
    } catch { /* dann eben der Baukasten */ }
  })();

  // Trennt Text und Hashtags am letzten Absatz, der mit # beginnt, und
  // schreibt beides in die Vorschau – samt der Kuerzung nach 125 Zeichen.
  function vorschauText(feld, alles) {
    const v = feld.querySelector('[data-vorschau]');
    if (!v) return;
    const teile = alles.split(/\n\s*\n(?=#)/);
    const tags = teile.length > 1 ? teile.pop().trim() : '';
    const text = teile.join('\n\n');

    const sichtbar = v.querySelector('[data-sichtbar]');
    const mehr = v.querySelector('[data-rest]');
    const tagZeile = v.querySelector('[data-tags]');
    if (sichtbar) {
      sichtbar.dataset.voll = text;
      sichtbar.textContent = text.slice(0, VORSCHAU_ZEICHEN);
    }
    if (mehr) mehr.hidden = text.length <= VORSCHAU_ZEICHEN;
    if (tagZeile) tagZeile.textContent = tags;

    // Die Titelzeile im Bild wird hier bewusst NICHT angefasst. Frueher stand
    // dort die erste Zeile des Beitragstextes; seit es das eigene Feld
    // "Titelüberschrift" gibt, fuehrt zeileVerdrahten() die Zeile. Sie von hier
    // aus zu ueberschreiben hat ihren Aufbau '<b>…</b><i>…</i>' durch nackten
    // Text ersetzt – und weil zeilenVon() genau dieses <b> verlangt, fiel der
    // Titel danach still aus dem fertigen Bild heraus, obwohl der Haken stand.
  }

  // Haelt fest, dass ein Fahrzeug einen Beitrag hatte. Passiert beim Teilen
  // von selbst – ein eigener Knopf dafuer waere ein Arbeitsschritt, den man
  // vergisst, und dann steht dasselbe Auto morgen wieder in der Schlange.
  // thema trennt die beiden Spuren: 'neuzugang' ist der Beitrag im Feed,
  // 'story' die Story im Highlight "Aktuelle Fahrzeuge". Ein Fahrzeug kann
  // im Feed dran gewesen sein und im Highlight trotzdem fehlen.
  // Welche Bilder aus dem eigenen Vorrat gerade dran waren. Fahrzeugbilder
  // von mobile.de faellt der Endpunkt selbst heraus – die stehen nicht im
  // Vorrat.
  async function alsBenutztMerken(wege) {
    const eigene = (wege || []).filter(u => String(u).startsWith('/bilder/'));
    if (!eigene.length) return;
    try {
      await fetch('/api/studio/benutzt', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schluessel: eigene })
      });
      vorrat = null;   // beim naechsten Zeichnen steht das frische Datum drin
    } catch (err) { console.error('Als benutzt merken:', err); }
  }

  async function alsGepostetMerken(id, thema) {
    if (!id) return;
    try {
      const a = await fetch('/api/studio/bestand', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fahrzeug_id: id, thema: thema || 'neuzugang' })
      });
      const d = await a.json();
      if (d && d.ok) zeichnen(d);
    } catch (err) { console.error('Als gepostet merken:', err); }
  }

  // Umschalten zwischen Beitrag und Reel. Die Liste bleibt dieselbe – nur
  // was beim Antippen herauskommt, aendert sich.
  function reiterZeichnen() {
    document.querySelectorAll('[data-art]').forEach(b =>
      b.setAttribute('aria-selected', String(b.dataset.art === format)));
  }

  function neuZeigen() {
    reiterZeichnen();
    // Neu laden statt nur umzuzeichnen: die Kachel oben haengt an den Zahlen,
    // und die sind je nach Reiter andere.
    if (window.beitragStil) window.beitragStil.holen();

  laden();
  }

  document.querySelectorAll('[data-art]').forEach(k => k.addEventListener('click', () => {
    format = k.dataset.art;
    // Ein Ausschnitt, der im Beitrag passt, passt im Hochformat nicht – und
    // umgekehrt. Beim Wechsel faengt jedes Bild wieder ganz aussen an, also
    // mit dem groesstmoeglichen Ausschnitt.
    bildStand.clear();
    quelle = QUELLE_JE_FORMAT[format];
    try { localStorage.setItem('sm-format', format); } catch { /* egal */ }
    neuZeigen();
  }));

  document.addEventListener('click', ev => {
    const auf = ev.target.closest('[data-stil-auf]');
    if (auf && window.beitragStil) {
      const feld = auf.closest('.sm-block') || document;
      const bild = feld.querySelector('[data-vorschau] .igv-bild img');
      const was = auf.dataset.stilAuf === 'titel' ? 'titel' : 'angaben';
      const probe = was === 'titel'
        ? ((feld.querySelector('[data-zeile-feld]') || {}).textContent || 'Titel')
        : (labelVon(feld) || 'Modell · Baujahr');
      window.beitragStil.oeffnen(was, bild ? bild.src : '', probe.split('\n')[0],
        () => stilAnlegen(feld));
      return;
    }

    const wm = ev.target.closest('[data-aiy-an]');
    if (wm) {
      const an = wm.getAttribute('aria-pressed') !== 'true';
      wm.setAttribute('aria-pressed', String(an));
      schalterMerken('aiy', an);
      markeZeichnen(wm.closest('.sm-block') || document);
      return;
    }

    const sch = ev.target.closest('[data-schrift-an]');
    if (sch) {
      const an = sch.getAttribute('aria-pressed') !== 'true';
      sch.setAttribute('aria-pressed', String(an));
      schalterMerken('schrift', an);
      const block = sch.closest('.sm-block') || document;
      markeZeichnen(block);
      return;
    }

    const st = ev.target.closest('[data-achse]');
    if (!st) return;
    const block = st.closest('.sm-block') || document;
    st.parentElement.querySelectorAll('[data-achse]').forEach(b =>
      b.classList.toggle('hier', b === st));

    // Die Klasse an der Vorschau ist die einzige Quelle: von dort liest auch
    // das Zuschneiden ab, deshalb kann beides nicht auseinanderlaufen. Es
    // aendert sich nur die angeklickte Achse, die andere bleibt stehen.
    const ziele = [block.querySelector({
      logo: '.igv-marke', zeile: '.igs-zeile', angaben: '.igv-label'
    }[st.dataset.was] || '.igv-label')];
    ziele.filter(Boolean).forEach(el => {
      const vorgabe = { logo: 'unten-rechts', zeile: 'oben-mitte', angaben: 'unten-mitte' };
      const [v, h] = zerlegen(posVon(el, vorgabe[st.dataset.was] || 'unten-links'));
      const neu = st.dataset.achse === 'v' ? `${st.dataset.wert}-${h}` : `${v}-${st.dataset.wert}`;
      [...el.classList].forEach(k => { if (k.startsWith('pos-')) el.classList.remove(k); });
      el.classList.add('pos-' + neu);
      gemerkt[st.dataset.was] = neu;
    });
    stellenMerken();
  });

  reiterZeichnen();

  // Erst nachsehen, ob ein Warteschlangen-Eintrag zum Bearbeiten ansteht –
  // sein Format entscheidet, welcher Reiter aufgeht. Dann normal laden.
  (async () => {
    // Der gespeicherte Stil zuerst: er lag bisher nur nach einem Reiter-
    // Wechsel vor. Beim ersten Aufruf zeichneten Vorschau UND fertiges Bild
    // deshalb mit der Vorgabe – die Einstellung aus "Gestalten …" wirkte
    // erst nach einem Klick auf Beiträge/Stories.
    if (window.beitragStil) {
      try { await window.beitragStil.holen(); } catch { /* dann die Vorgabe */ }
    }

    if (bearbeitungId) {
      try {
        const a = await fetch('/api/studio/warteschlange', { credentials: 'same-origin' });
        const d = await a.json();
        const z = (d && d.ok ? d.geplant.concat(d.erledigt) : [])
          .find(e => e.id === bearbeitungId);
        if (z && Array.isArray(z.bilder) && z.bilder.length) {
          bearbeitung = z;
          bearbeitungZeit = z.zeitpunkt || null;
          format = z.format === 'story' ? 'story' : 'beitrag';
          quelle = 'galerie';
          // Logo, Angaben und Titel sind in diesen Bildern schon eingebrannt –
          // die Schalter starten aus, sonst laege alles doppelt im Bild.
          // Nur fuer diese Sitzung, gemerkt wird nichts.
          schalter.logo = false;
          schalter.angaben = false;
          schalter.schrift = false;
          schalter.zeile = false;
          reiterZeichnen();
        } else {
          bearbeitungId = 0;
        }
      } catch { bearbeitungId = 0; }
    }
    laden();
  })();

  // ─── Werkstatt, Team, Alltag ────────────────────────────────────────
  //
  // Anders als bei Fahrzeugen gibt es hier keine Warteschlange, die etwas
  // vorschlaegt – es gibt einen Vorrat von 266 Reportagefotos und eine
  // Handvoll Themen. Deshalb ist das hier ein einziger, stehender Bau-
  // kasten: Thema oben, Bilder darunter, Vorschau daneben. Was man
  // anfasst, aendert sofort die Vorschau.

  let vorrat = null;
  let wkThema = null;
  let wkVariante = 0;
  // Ein zusammengestellter Beitrag: Text und Bilder gehoeren zusammen, weil
  // beides in einem Zug entstanden ist. Solange er steht, hat er Vorrang vor
  // dem Baukastentext – beim Themenwechsel oder Wuerfeln ist er wieder weg.
  let wkEigen = null;
  async function vorratHolen() {
    if (vorrat) return vorrat;
    const a = await fetch('/api/studio/vorrat', { credentials: 'same-origin' });
    if (a.status === 401) { location.href = '/admin'; return null; }
    vorrat = await a.json();
    return vorrat;
  }

  // Die Beschriftung der Kacheln kommt aus der Datenbank, nicht aus einer
  // Liste hier: sonst stehen auf den Bildern andere Woerter als in der
  // Galerie und in der Themenzeile darueber.
  const motivWort = id => {
    const k = ((vorrat && vorrat.kategorien) || []).find(x => x.id === id);
    return k ? k.titel : (id || '');
  };

  // Seiten statt endlosem Nachladen: 266 Kacheln untereinander sind keine
  // Auswahl, sondern eine Wand. Die getroffene Auswahl haengt deshalb nicht
  // mehr am DOM, sondern in einem Satz von Adressen – sonst waere sie beim
  // Blaettern weg.
  const VORRAT_PRO_SEITE = 23;
  let wkSeite = 0;
  const wkAuswahl = new Set();

  async function werkstattZeigen() {
    liste.innerHTML = '<p class="mon-laedt">Bildvorrat wird geladen …</p>';
    const d = await vorratHolen();
    if (!d || !d.ok) { liste.innerHTML = '<p class="mon-leer">Der Bildvorrat ist nicht erreichbar.</p>'; return; }

    // Die Themen des Baukastens, dahinter die in der Galerie angelegten
    // Kategorien. Fuer die gibt es keine fertigen Texte – dafuer gibt es den
    // Knopf, der einen schreiben laesst.
    const fest = window.beitragText.werkstattThemen();
    const bekannt = new Set(fest.map(t => t.id));
    const themen = [...fest, ...(d.kategorien || [])
      .filter(k => !k.fest && !bekannt.has(k.id))
      .map(k => ({ id: k.id, titel: k.titel, saison: false, motive: [k.id] }))];

    if (!wkThema || !themen.some(t => t.id === wkThema)) wkThema = themen[0].id;

    // Ein Reel aus eigenen Fotos ist ein Drehbuch, kein Beitrag mit anderem
    // Rahmen – das kommt als eigener Schritt. Lieber ehrlich sagen, dass es
    // fehlt, als etwas zeigen, das nicht dafuer gebaut ist.
    const istStory = format === 'story';
    const bau = { ...window.beitragText.werkstatt(wkThema, wkVariante) };
    Object.assign(bau, mitFuss(bau.text, bau.hashtags));
    const ohneText = !wkEigen && !bau.varianten;
    const w = wkEigen ? { ...bau, text: wkEigen.text, hashtags: wkEigen.hashtags } : bau;
    const st = istStory ? storyAusThema(themen.find(t => t.id === wkThema), w) : null;
    if (istStory) {
      const rest = String(w.text).split('\n');
      while (rest.length && !rest[0].trim()) rest.shift();
      if (rest.length && rest[0].trim() === st.zeile) rest.shift();
      while (rest.length && !rest[0].trim()) rest.shift();
      w.text = rest.join('\n');
    }
    const nr = ((wkVariante % bau.varianten) + bau.varianten) % bau.varianten + 1;

    liste.innerHTML = `<div class="sm-block sm-zwei" id="wk-block">
      <div class="sm-links">${istStory
        ? vorschauStory(st)
        : vorschau(w.text, w.hashtags, 'beitrag')}</div>
      <div class="sm-rechts">
        ${bauLeiste()}
        <div class="sm-kopf"><b>Thema</b></div>
        <div class="wk-chips">
          ${themen.map(t => `<button type="button" class="wk-chip${t.id === wkThema ? ' hier' : ''}"
              data-thema="${schuetzen(t.id)}">${schuetzen(t.titel)}</button>`).join('')}
          <a class="wk-chip wk-chip-mehr" href="/admin/galerie"
             title="Neues Thema in der Galerie anlegen">+ Thema</a>
        </div>

        <p class="gd-notiz plan-notiz" data-plan-notiz hidden></p>

        <div class="sm-kopf"><b>Titelüberschrift</b> <span>(optional)</span></div>
        <div class="sm-label">
          <div class="sm-logo-zeile">
            <label class="sm-label-an">
              <!-- Der Haken kommt gemerkt zurueck, wie im Fahrzeug-Baukasten
                   auch. Ohne das sprang er bei jedem Neuzeichnen des Blocks
                   (Themenwechsel, neue Bildseite) wieder aus. -->
              <input type="checkbox" data-zeile-an ${schalter.zeile ? 'checked' : ''} />
              <span>Titel</span>
            </label>
            <button type="button" class="sm-schrift" data-stil-auf="titel">Gestalten …</button>
          </div>
          <div class="sm-zeile-reihe">
            <p class="sm-zeile" contenteditable="true" data-zeile-feld
               title="Zum Ändern hineinklicken">${schuetzen(
                 istStory ? st.zeile : (themen.find(t => t.id === wkThema) || {}).titel || '')}</p>
            ${stellenWahl('zeile', 'oben-mitte')}
          </div>
        </div>

        <div class="sm-kopf" style="margin-top:18px"><b>Text</b>
          <span>${wkEigen ? 'zu den Bildern geschrieben'
            : (ohneText ? 'noch keiner' : `Variante ${nr} von ${bau.varianten}`)}</span></div>
        ${ohneText
          ? `<p class="mon-leer">Für diese Kategorie gibt es keine fertigen Texte.
              Der Knopf oben schreibt einen, der zu den Bildern passt.</p>`
          : `<pre class="sm-text" data-kopie>${schuetzen(w.text)}\n\n${schuetzen(w.hashtags)}</pre>`}
        <div class="sm-knoepfe">
          <button type="button" class="btn-klein sm-leise" data-zurueck-var title="Vorherigen Vorschlag"
                  ${ohneText ? 'hidden' : ''}>←</button>
          <button type="button" class="btn-klein sm-leise" data-wuerfeln title="Neuen Vorschlag"
                  ${ohneText ? 'hidden' : ''}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="2.2" aria-hidden="true">
            <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" stroke-linecap="round"/>
            <polyline points="20.5 3.5 20.5 9 15 9" stroke-linecap="round" stroke-linejoin="round"/>
          </svg></button>
          <button type="button" class="btn-klein sm-leise" data-bearbeiten>Bearbeiten</button>
        </div>

        <div class="sm-logo-zeile">
          <label class="sm-label-an">
            <input type="checkbox" data-logo-an checked />
            <span>Logo</span>
          </label>
          <button type="button" class="sm-schrift" data-aiy-an
                  aria-pressed="${schalter.aiy === null ? true : schalter.aiy}"
                  title="Wortmarke AIY neben der Bildmarke">AIY</button>
          <button type="button" class="sm-schrift" data-schrift-an
                  aria-pressed="${schalter.schrift === null ? true : schalter.schrift}">+ Schrift</button>
          ${stellenWahl('logo', 'unten-rechts')}
        </div>
        <div class="sm-kopf" style="margin-top:18px"><b>Bilder</b>
          <span><span class="sm-stand">0 ausgewählt</span> ·
            <span class="wk-gesamt">${zahl(d.gesamt)}</span> im Vorrat</span>
        </div>
        <div class="sm-bilder">
          <div class="sm-raster wk-raster"></div>
          <div class="wk-blatt"></div>
        </div>
        <div data-reihe></div>
      </div>
      <div class="sm-fuss">
          <div class="sm-knoepfe">
            <button type="button" class="btn-klein" data-posten>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                 stroke-width="2" aria-hidden="true">
              <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2"/>
              <circle cx="12" cy="12" r="4.1"/>
              <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none"/>
            </svg>
              <span>Direkt posten</span></button>
            <button type="button" class="btn-klein sm-teilen" data-teilen>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                   stroke-width="1.9" aria-hidden="true">
                <path d="M4 12v7a1.6 1.6 0 0 0 1.6 1.6h12.8A1.6 1.6 0 0 0 20 19v-7"
                      stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 15.5V3.4M12 3.4 7.8 7.6M12 3.4l4.2 4.2"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span>Beitrag teilen</span></button>
            ${planKnopf()}
            <span class="sm-meldung"></span>
          </div>
        </div>
      </div>
    </div>`;

    seiteZeichnen(d);
    verdrahtenWerkstatt(d);
  }

  function seiteZeichnen(d) {
    const feld = document.getElementById('wk-block');
    if (!feld) return;
    const raster = feld.querySelector('.wk-raster');
    const blatt = feld.querySelector('.wk-blatt');

    const seiten = Math.max(1, Math.ceil(d.bilder.length / VORRAT_PRO_SEITE));
    wkSeite = Math.max(0, Math.min(wkSeite, seiten - 1));
    const teil = d.bilder.slice(wkSeite * VORRAT_PRO_SEITE, (wkSeite + 1) * VORRAT_PRO_SEITE);

    raster.innerHTML = `<label class="sm-foto sm-foto-neu" title="Fotos hinzufügen">
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-dazu />
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M12 6v12M6 12h12" stroke-linecap="round"/>
      </svg>
      <span>Fotos</span>
    </label>` + teil.map(b => bildKachel(b)).join('');
    raster.querySelectorAll('.sm-foto:not(.sm-foto-neu)').forEach(k => kachelVerdrahten(k, feld));
    reiheZeichnen(feld);

    blatt.innerHTML = seiten > 1 ? `<nav class="blatt blatt-kurz">
      <button type="button" class="blatt-pfeil" data-vor-zurueck ${wkSeite === 0 ? 'disabled' : ''} aria-label="Vorherige">‹</button>
      <span class="blatt-stand"><b>${wkSeite + 1}</b> / ${seiten}</span>
      <button type="button" class="blatt-pfeil" data-vor-weiter ${wkSeite === seiten - 1 ? 'disabled' : ''} aria-label="Weitere">›</button>
    </nav>` : '';

    const z = blatt.querySelector('[data-vor-zurueck]');
    const v = blatt.querySelector('[data-vor-weiter]');
    if (z) z.addEventListener('click', () => { wkSeite -= 1; seiteZeichnen(d); });
    if (v) v.addEventListener('click', () => { wkSeite += 1; seiteZeichnen(d); });

    standZaehlen(feld);
    vorschauBild(feld);
  }

  // Wie viele weitere Themen ein Bild bedient. Steht als "+2" neben dem
  // fuehrenden – sonst liest sich die Kachel, als taugte das Bild nur fuer
  // dieses eine Thema, und man sucht Bilder doppelt.
  function weitereThemen(b) {
    if (!b.beschreibung) return 0;
    try {
      const d = JSON.parse(b.beschreibung);
      const taugt = Array.isArray(d.taugt_fuer) ? d.taugt_fuer : [];
      return taugt.filter(t => t && t !== b.motiv).length;
    } catch { return 0; }
  }

  // Die Reihenfolge der ausgewaehlten Bilder – das erste ist das Titelbild.
  // Mit Pfeilen statt Ziehen: Ziehen hat beim Bildausschnitt schon nicht
  // zuverlaessig funktioniert, und hier zaehlt jeder Klick.
  // Welches Bild gerade in der Vorschau steht, wird nicht aus der Bildadresse
  // erraten, sondern beim Umblaettern mitgegeben. Der Weg ueber die Adresse
  // ist dreimal gescheitert: die Vorschau baut ihr Bild bei jedem Zeichnen
  // neu auf, und je nach Quelle steht dort mal ein Vorratsweg, mal eine
  // fremde Adresse.
  // Welches Bild gerade in der Vorschau steht, soll man unten wiederfinden:
  // die Kachel im Waehler und der Eintrag in der Bildfolge bekommen eine
  // Markierung – und liegt die Kachel auf einer anderen Seite, blaettert der
  // Waehler dorthin. Sonst sucht man bei vielen Bildern auf mehreren Seiten.
  function aktivZeigen(feld, weg) {
    feld.querySelectorAll('.sm-foto').forEach(k =>
      k.classList.toggle('gezeigt', !!weg && k.dataset.u === weg));
    feld.querySelectorAll('.sm-reihe-liste li').forEach(li =>
      li.classList.toggle('gezeigt', !!weg && li.dataset.u === weg));
    seiteFuerBild(feld, weg);
  }

  // Blaettert den Vorrat auf die Seite, auf der das gezeigte Bild liegt.
  //
  // Nur wenn sich das gezeigte Bild WIRKLICH geaendert hat. Ohne diese
  // Bedingung wuerde jedes Neuzeichnen die Seite zurueckziehen – wer von Hand
  // weiterblaettert, um ein anderes Foto zu suchen, landete sofort wieder bei
  // dem, das gerade in der Vorschau steht. Das Blaettern waere unbenutzbar.
  let zuletztGesprungen = null;
  function seiteFuerBild(feld, weg) {
    if (weg === zuletztGesprungen) return;
    zuletztGesprungen = weg;
    if (!weg || !feld.querySelector('.wk-raster') || !vorrat) return;
    const stelle = (vorrat.bilder || []).findIndex(b => '/bilder/' + b.schluessel === weg);
    if (stelle < 0) return;
    const seite = Math.floor(stelle / VORRAT_PRO_SEITE);
    if (seite === wkSeite) return;
    wkSeite = seite;
    seiteZeichnen(vorrat);
  }

  function markeAbgleichen(feld, weg) {
    const marke = feld.querySelector('.igv-marke');
    if (!marke) return;
    if (weg !== undefined) gezeigt = weg;
    const wege = auswahlVon(feld);
    const jetzt = gezeigt !== null && wege.includes(gezeigt) ? gezeigt : wege[0];
    const i = wege.indexOf(jetzt);
    marke.hidden = !logoVon(feld) || (i > 0 && ohneLogo.has(jetzt));
  }

  function reiheZeichnen(feld) {
    const ziel = feld.querySelector('[data-reihe]');
    if (!ziel) return;
    const wege = auswahlVon(feld);
    if (wege.length < 2) { ziel.innerHTML = ''; return; }
    const logoAn = logoVon(feld);

    ziel.innerHTML = `<div class="sm-kopf" style="margin-top:14px"><b>Bildfolge</b></div>
      <ol class="sm-reihe-liste">
        ${wege.map((u, i) => `<li data-u="${schuetzen(u)}"${u === gezeigt ? ' class="gezeigt"' : ''}>
          <button type="button" class="sm-reihe-bild" data-zeigen="${schuetzen(u)}"
                  title="In der Vorschau anzeigen" aria-label="Bild ${i + 1} in der Vorschau anzeigen">
            <img src="${schuetzen(u)}" alt="" loading="lazy" />
          </button>
          <b>${i + 1}</b>
          <button type="button" class="sm-reihe-logo${
            logoAn && (i === 0 || !ohneLogo.has(u)) ? ' hier' : ''}${logoAn ? '' : ' aus'}"
            ${i === 0 || !logoAn
              ? `disabled title="${logoAn ? 'Das Titelbild trägt es immer' : 'Das Logo ist oben abgeschaltet'}"`
              : `data-logo-weg="${schuetzen(u)}" title="${
                  ohneLogo.has(u) ? 'Zeichen aufs Bild' : 'Zeichen weglassen'}"`}>◠</button>
          <span>
            <button type="button" data-schieb="${i}" data-hin="-1" ${i === 0 ? 'disabled' : ''}
                    aria-label="nach vorn">‹</button>
            <button type="button" class="sm-reihe-raus" data-raus="${schuetzen(u)}"
                    title="Aus dem Beitrag nehmen" aria-label="Aus dem Beitrag nehmen">×</button>
            <button type="button" data-schieb="${i}" data-hin="1"
                    ${i === wege.length - 1 ? 'disabled' : ''} aria-label="nach hinten">›</button>
          </span>
        </li>`).join('')}
      </ol>`;

    ziel.querySelectorAll('[data-logo-weg]').forEach(k => k.addEventListener('click', () => {
      const u = k.dataset.logoWeg;
      if (ohneLogo.has(u)) ohneLogo.delete(u); else ohneLogo.add(u);
      // Die Vorschau bleibt, wo sie ist: das Umschalten betrifft ein Bild in
      // der Folge, nicht das, was man gerade ansieht.
      reiheZeichnen(feld);
      markeAbgleichen(feld);
    }));

    ziel.querySelectorAll('[data-schieb]').forEach(k => k.addEventListener('click', () => {
      const von = Number(k.dataset.schieb);
      const nach = von + Number(k.dataset.hin);
      const neu = [...wege];
      [neu[von], neu[nach]] = [neu[nach], neu[von]];
      auswahlSetzen(feld, neu);
    }));

    // Klick aufs Bild in der Folge: die Vorschau springt dorthin – und zwar
    // in beide Richtungen. Gerade bei acht Bildern ist das schneller, als
    // sich mit den Pfeilen durchzuklicken.
    ziel.querySelectorAll('[data-zeigen]').forEach(k => k.addEventListener('click', () => {
      const kasten = feld.querySelector('.igv-bild');
      const lauf = kasten && kasten.__lauf;
      if (!lauf) return;
      const stelle = lauf.gewaehlt.indexOf(k.dataset.zeigen);
      if (stelle < 0) return;
      lauf.i = stelle;
      lauf.zeigen();
    }));

    // Das Kreuz zwischen den Pfeilen: Bild aus dem Beitrag nehmen. Bisher
    // ging das nur ueber die Kachel im Waehler – und die liegt bei einem
    // grossen Vorrat oft auf einer ganz anderen Seite.
    ziel.querySelectorAll('[data-raus]').forEach(k => k.addEventListener('click', () => {
      const u = k.dataset.raus;
      // Was man gerade ansieht, verschwindet gleich – dann zeigt die Vorschau
      // wieder das Titelbild statt ins Leere.
      if (gezeigt === u) gezeigt = null;
      auswahlSetzen(feld, wege.filter(x => x !== u));
    }));
  }

  // Woher die Auswahl kommt, ist in beiden Welten verschieden: bei eigenen
  // Fotos ist es der Satz wkAuswahl, bei Fahrzeugen die Reihenfolge im Raster.
  function auswahlVon(feld) {
    if (feld.querySelector('.wk-raster')) return [...wkAuswahl];
    return [...feld.querySelectorAll('.sm-foto.aktiv')].map(k => k.dataset.u);
  }

  function auswahlSetzen(feld, wege) {
    if (feld.querySelector('.wk-raster')) {
      wkAuswahl.clear();
      wege.forEach(u => wkAuswahl.add(u));
      if (vorrat) seiteZeichnen(vorrat);
    } else {
      const raster = feld.querySelector('.sm-raster');
      const kacheln = [...raster.querySelectorAll('.sm-foto:not(.sm-foto-neu)')];
      // Erst den Stand setzen, dann sortieren. Frueher wurde hier NUR
      // umsortiert – wer ein Bild aus der Folge nahm, hatte es hinterher
      // trotzdem noch ausgewaehlt, weil die Kachel 'aktiv' blieb.
      kacheln.forEach(k => {
        const an = wege.includes(k.dataset.u);
        k.classList.toggle('aktiv', an);
        k.setAttribute('aria-pressed', String(an));
      });
      // Die Kacheln selbst umsortieren: von dort liest das Zuschneiden ab.
      wege.slice().reverse().forEach(u => {
        const k = kacheln.find(x => x.dataset.u === u);
        if (k) raster.insertBefore(k, raster.firstChild);
      });
      const stand = feld.querySelector('.sm-stand');
      if (stand) stand.textContent = `${wege.length} von ${kacheln.length} ausgewählt`;
    }
    reiheZeichnen(feld);
    vorschauBild(feld);
    markeAbgleichen(feld);
  }

  function bildKachel(b) {
    const weg = '/bilder/' + b.schluessel;
    const marke = motivWort(b.motiv);
    return `<button type="button" class="sm-foto${wkAuswahl.has(weg) ? ' aktiv' : ''}"
        data-u="${schuetzen(weg)}" data-schluessel="${schuetzen(b.schluessel)}"
        data-motiv="${schuetzen(b.motiv || 'unsortiert')}"
        aria-pressed="${wkAuswahl.has(weg)}">
      <img src="${schuetzen(weg)}" alt="" loading="lazy" />
      <span class="sm-haken">✓</span>
      ${marke ? `<span class="sm-motiv">${schuetzen(marke)}${
        weitereThemen(b) ? `<i>+${weitereThemen(b)}</i>` : ''}</span>` : ''}
    </button>`;
  }

  function kachelVerdrahten(k, feld) {
    k.addEventListener('click', () => {
      const drin = wkAuswahl.has(k.dataset.u);
      if (drin) wkAuswahl.delete(k.dataset.u); else wkAuswahl.add(k.dataset.u);
      k.classList.toggle('aktiv', !drin);
      k.setAttribute('aria-pressed', String(!drin));
      standZaehlen(feld); vorschauBild(feld); reiheZeichnen(feld);
    });
  }

  function standZaehlen(feld) {
    feld.querySelectorAll('.sm-stand').forEach(st => {
      st.textContent = `${wkAuswahl.size} ausgewählt`;
    });
  }

  // Der Vorschlag greift auf den GANZEN Vorrat zu, nicht nur auf die Seite,
  // die gerade zu sehen ist – und blaettert danach dorthin, wo das erste
  // Bild liegt. Ist noch nichts einsortiert, entscheidet der Zufall; ein
  // zufaelliges Bild ist besser als eine leere Auswahl.
  function vorschlagen(d, wieviele) {
    const themen = window.beitragText.werkstattThemen();
    const thema = themen.find(t => t.id === wkThema);
    const alle = d.bilder || [];
    if (!alle.length) return;

    // Erst ein Motiv des Themas waehlen, dann daraus ziehen: fuenf Bilder
    // aus derselben Ecke des Betriebs erzaehlen eine Geschichte, fuenf
    // zusammengewuerfelte sind eine Sammlung.
    const moegliche = (thema?.motive || []).filter(m => alle.some(b => b.motiv === m));
    const motiv = moegliche.length ? moegliche[Math.floor(Math.random() * moegliche.length)] : null;
    const passend = motiv ? alle.filter(b => b.motiv === motiv) : [];
    const topf = passend.length ? passend : alle;
    const gemischt = topf.slice().sort(() => Math.random() - 0.5).slice(0, wieviele);

    wkAuswahl.clear();
    gemischt.forEach(b => wkAuswahl.add('/bilder/' + b.schluessel));

    const ersteStelle = alle.findIndex(b => b.schluessel === gemischt[0].schluessel);
    wkSeite = Math.floor(Math.max(0, ersteStelle) / VORRAT_PRO_SEITE);
    seiteZeichnen(d);
  }

  function verdrahtenWerkstatt(d) {
    const feld = document.getElementById('wk-block');
    if (!feld) return;
    const ziel = feld.querySelector('.sm-bilder');

    feld.querySelectorAll('.wk-chip').forEach(k => k.addEventListener('click', () => {
      wkThema = k.dataset.thema; wkVariante = 0; wkEigen = null; werkstattZeigen();
    }));

    const wuerfeln = feld.querySelector('[data-wuerfeln]');
    if (wuerfeln) wuerfeln.addEventListener('click', () => { wkVariante += 1; wkEigen = null; werkstattZeigen(); });
    const zurueckVar = feld.querySelector('[data-zurueck-var]');
    if (zurueckVar) zurueckVar.addEventListener('click', () => { wkVariante -= 1; wkEigen = null; werkstattZeigen(); });
    // Fotos direkt aus dem Beitrag heraus hinzufuegen: sie landen im Vorrat
    // wie ueber die Galerie – samt Beschreibung im Hintergrund – und sind
    // gleich ausgewaehlt. Wer beim Bauen merkt, dass ein Bild fehlt, soll
    // nicht die Seite wechseln muessen.
    const dazu = feld.querySelector('[data-dazu]');
    if (dazu) dazu.addEventListener('change', async () => {
      const dateien = [...(dazu.files || [])];
      if (!dateien.length) return;
      const wort = feld.querySelector('.sm-foto-neu span');
      const alt = wort ? wort.textContent : '';
      if (wort) wort.textContent = 'Wird geladen …';
      try {
        const formular = new FormData();
        dateien.forEach(f => formular.append('datei', f));
        const a = await fetch('/api/studio/vorrat', {
          method: 'POST', credentials: 'same-origin', body: formular
        });
        const d = await a.json();
        if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);

        vorrat = d;
        (d.angelegt || []).forEach(s => wkAuswahl.add('/bilder/' + s));
        wkSeite = 0;
        await werkstattZeigen();
      } catch (err) {
        if (wort) {
          wort.textContent = 'Ging nicht';
          setTimeout(() => { wort.textContent = alt; }, 4000);
        }
        console.error('Fotos hinzufügen:', err);
      }
    });

    bearbeitenVerdrahten(feld);
    mehrVerdrahten(feld);
    logoVerdrahten(feld);
    zeileVerdrahten(feld);
    stellungAnlegen(feld);
    zeilenGrauen(feld);
    stilAnlegen(feld);
    // Die Marke in die gemerkte Fassung bringen. Ohne das stand hier nach
    // dem Laden die Vollform aus der Vorlage, waehrend die Knoepfe AIY und
    // Schrift schon den gemerkten Stand zeigten – man musste erst zweimal
    // klicken, bis Bild und Knopf wieder dasselbe sagten.
    markeZeichnen(feld);

    // Aus dem Nichts einen ganzen Beitrag: welche Bilder, wie viele, in
    // welcher Reihenfolge – und der Text dazu, geschrieben zu genau diesen
    // Bildern. Es geht kein Foto an die KI: alle 266 sind einmal angesehen
    // worden und liegen als Saetze in der Datenbank. Deshalb dauert das
    // Sekunden und nicht Minuten.
    const bauen = feld.querySelector('[data-bauen]');
    if (bauen) bauen.addEventListener('click', async () => {
      const beschriftung = bauen.querySelector('span');
      const wort = beschriftung.textContent;
      bauen.disabled = true; beschriftung.textContent = 'Wird gebaut …';
      try {
        const a = await fetch('/api/studio/zusammenstellen', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thema: wkThema })
        });
        const roh = await a.text();
        let e = null;
        try { e = JSON.parse(roh); } catch {
          throw new Error(`Antwort war kein JSON (${a.status}): ${roh.slice(0, 80)}`);
        }
        if (!e.ok) throw new Error(e.fehler || 'HTTP ' + a.status);

        wkEigen = { ...e.beitrag, gelesen: e.gelesen, cent: e.cent };
        wkAuswahl.clear();
        e.beitrag.bilder.forEach(s => wkAuswahl.add('/bilder/' + s));

        // Zur Seite des Titelbilds springen, sonst steht die Auswahl im
        // Raster irgendwo, wo man sie nicht sieht.
        const alle = (vorrat && vorrat.bilder) || [];
        const stelle = alle.findIndex(b => b.schluessel === e.beitrag.bilder[0]);
        if (stelle >= 0) wkSeite = Math.floor(stelle / VORRAT_PRO_SEITE);

        await werkstattZeigen();
      } catch (err) {
        const notiz = liste.querySelector('[data-plan-notiz]');
        if (notiz) {
          notiz.classList.add('plan-fehler');
          notiz.innerHTML = `<span><b>Das hat nicht geklappt.</b></span>
            <span>${schuetzen(err.message)}</span>
            <i>Noch einmal versuchen – meistens geht es beim zweiten Mal.</i>`;
          notiz.hidden = false;
        }
      } finally {
        bauen.disabled = false;
        beschriftung.textContent = wort;
      }
    });

    const fuss = feld.querySelector('.sm-fuss') || ziel;
    const t = fuss.querySelector('[data-teilen]');
    if (t) t.addEventListener('click', () => teilen(feld, ziel, t, [...wkAuswahl]));
    veroeffentlichenVerdrahten(feld, fuss, ziel, () => [...wkAuswahl]);
    planFensterVerdrahten(feld, fuss, ziel, () => [...wkAuswahl]);

    feld.dataset.fahrzeug = '';
    // Ein Eintrag aus der Warteschlange als Ausgangslage: seine Bilder als
    // Auswahl, sein Text im Kasten. Einmalig – danach arbeitet der Baukasten
    // ganz normal weiter.
    if (bearbeitung) {
      auswahlSetzen(feld, bearbeitung.bilder);
      const kopie = feld.querySelector('[data-kopie]');
      if (kopie) kopie.textContent = bearbeitung.text || '';
      bearbeitung = null;
    }
    // Zum Anfang ein Bild, damit die Vorschau nicht leer bleibt.
    if (!wkAuswahl.size) vorschlagen(d, 1);
  }

  // ─── Instagram ───────────────────────────────────────────────────────
  //
  // Die Zahlen kommen von Hand: Instagram liefert einem Server-Abruf nur die
  // leere App-Huelle. Kommt spaeter die Graph-API dazu, fuellt sie dieselbe
  // Liste – hier aendert sich dann nichts ausser der Herkunft.

  const igInhalt = document.getElementById('ig-inhalt');
  if (!igInhalt) return;

  async function igLaden() {
    if (!document.getElementById('ig-inhalt')) return;
    try {
      const a = await fetch('/api/studio/instagram', { credentials: 'same-origin' });
      if (a.status === 401) { location.href = '/admin'; return; }
      const d = await a.json();
      if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
      igZeichnen(d);
    } catch (err) {
      igInhalt.innerHTML = `<div class="gd-fehler">
        <b>Die Zahlen konnten nicht geladen werden.</b>
        <span>${schuetzen(err.message)}</span></div>`;
    }
  }

  function igZeichnen(d) {
    zeichneBeitraege(d);
    if (!d.jetzt) {
      igInhalt.innerHTML = `<p class="mon-leer">Noch kein Stand erfasst.</p>${igNotiz(d)}`;
      return;
    }

    const felder = [
      feld(d.jetzt.follower, 'Follower' + igTrend(d)),
      feld(d.jetzt.beitraege, 'Beiträge auf dem Profil')
    ];

    igInhalt.innerHTML = `<div class="gd-felder">${felder.join('')}</div>
      ${d.fehler ? igNotiz(d) : ''}`;
  }

  // Die Veraenderung gehoert an die Zahl, nicht in eine eigene Kachel: sie
  // ist eine Eigenschaft der Followerzahl, keine zweite Kennzahl.
  function igTrend(d) {
    if (!d.davor || d.davor.follower == null || d.jetzt.follower == null) return '';
    const diff = d.jetzt.follower - d.davor.follower;
    if (!diff) return ` · unverändert seit ${tag(d.davor.zeitpunkt)}`;
    return ` · ${diff > 0 ? '+' : '−'}${Math.abs(diff)} seit ${tag(d.davor.zeitpunkt)}`;
  }

  // Balken mit abgeschnittener Skala: von 302 auf 305 waere bei einer Skala
  // ab null kein Unterschied zu sehen. Der gezeigte Ausschnitt steht deshalb
  // unter dem Diagramm – sonst waeren die Balken eine optische Luege.
  function igNotiz(d) {
    if (d.fehler) {
      return `<div class="gd-fehler"><b>Die Zahlen kommen gerade nicht von Instagram.</b>
        <span>${schuetzen(d.fehler)} Angezeigt wird der zuletzt gespeicherte Stand.</span></div>`;
    }
    const stand = d.jetzt ? `Stand von ${wann(d.jetzt.zeitpunkt)}. ` : '';
    return `<p class="gd-notiz">${stand}Ohne Reichweite und Profilaufrufe – die gibt dieser
      Zugang nicht heraus.</p>`;
  }

  const kurz = iso => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  // Die Beitraege, die tatsaechlich auf dem Profil stehen – mit Likes und
  // Kommentaren. Vorher stand hier die interne Abhakliste; die sagt nur, was
  // der Baukasten erledigt hat, nicht was draussen ist.
  const ART = { IMAGE: 'Bild', VIDEO: 'Reel', CAROUSEL_ALBUM: 'Galerie' };

  const sorteWort = m => (m.sorte === 'REELS' || m.art === 'VIDEO' ? 'Reel'
    : (m.art === 'CAROUSEL_ALBUM' ? 'Galerie' : ''));

  let igSeite = 0;
  const IG_PRO_SEITE = 10;

  function zeichneBeitraege(d) {
    const ziel = document.getElementById('gd-gepostet');
    if (!ziel) return;

    const alle = d.medien || [];
    if (!alle.length) {
      ziel.innerHTML = d.fehler ? '' : '<p class="mon-leer">Auf dem Profil steht noch kein Beitrag.</p>';
      return;
    }

    const seiten = Math.ceil(alle.length / IG_PRO_SEITE);
    igSeite = Math.max(0, Math.min(igSeite, seiten - 1));
    const zeigen = alle.slice(igSeite * IG_PRO_SEITE, (igSeite + 1) * IG_PRO_SEITE);
    // Die letzte Seite ist meist nicht voll. Ohne Platzhalter schrumpft das
    // Raster beim Wechsel, alles darunter rutscht hoch und die Seite springt
    // einem unter dem Finger weg. Die leeren Zellen halten die Hoehe.

    ziel.innerHTML = `<div class="sm-kopf" style="margin-top:18px"><b>Posts &amp; Reels</b>
        <span>${zahl(alle.length)}</span>
      </div>
      <div class="ig-raster">
        ${zeigen.map(m => `<figure class="ig-zelle">
          <button type="button" class="ig-kachel" data-schau="${schuetzen(m.id)}"
             title="${schuetzen((m.text || '').slice(0, 140))}">
            ${m.bild ? `<img src="${schuetzen(m.bild)}" alt="" loading="lazy" />`
                     : '<span class="ig-leer">kein Foto</span>'}
            ${sorteWort(m) ? `<span class="ig-marke">${sorteWort(m)}</span>` : ''}
            <span class="ig-zahlen"><b>♥ ${zahl(m.likes)}</b><b>💬 ${zahl(m.kommentare)}</b></span>
          </button>
          <figcaption>${schuetzen(tag(m.zeitpunkt))}</figcaption>
        </figure>`).join('')}
        ${''.padEnd(IG_PRO_SEITE - zeigen.length, '.').split('').map(() =>
          `<figure class="ig-zelle ig-platz" aria-hidden="true">
            <span class="ig-kachel"></span>
            <figcaption>&nbsp;</figcaption>
          </figure>`).join('')}
      </div>
      ${seiten > 1 ? `<nav class="blatt blatt-kurz ig-blatt">
        <button type="button" class="blatt-pfeil" data-zurueck ${igSeite === 0 ? 'disabled' : ''} aria-label="Vorherige">‹</button>
        <span class="blatt-stand"><b>${igSeite + 1}</b> / ${seiten}</span>
        <button type="button" class="blatt-pfeil" data-vor ${igSeite === seiten - 1 ? 'disabled' : ''} aria-label="Weitere">›</button>
      </nav>` : ''}`;

    const z = ziel.querySelector('[data-zurueck]');
    const v = ziel.querySelector('[data-vor]');
    if (z) z.addEventListener('click', () => { igSeite -= 1; zeichneBeitraege(d); });
    if (v) v.addEventListener('click', () => { igSeite += 1; zeichneBeitraege(d); });

    ziel.querySelectorAll('[data-schau]').forEach(k =>
      k.addEventListener('click', () => oeffnen(d, k.dataset.schau)));
    // Von der Uebersicht kommend steht der gewuenschte Beitrag in der
    // Adresse – aber nur beim ersten Zeichnen. Ohne den Merker oeffnete sich
    // die Ansicht bei jedem Blaettern erneut, weil der Hash stehen bleibt.
    if (!hashGeprueft) {
      hashGeprueft = true;
      const m = location.hash.match(/beitrag=([^&]+)/);
      if (m) {
        const id = decodeURIComponent(m[1]);
        const wo = alle.findIndex(x => x.id === id);
        history.replaceState(null, '', location.pathname + location.search);
        if (wo >= 0) {
          if (Math.floor(wo / IG_PRO_SEITE) !== igSeite) {
            igSeite = Math.floor(wo / IG_PRO_SEITE);
            zeichneBeitraege(d);
            return;
          }
          oeffnen(d, id);
        }
      }
    }
  }

  let hashGeprueft = false;

  // Beim Blaettern in der Ansicht soll die Kachelreihe darunter mitwandern.
  // Liegt der naechste Beitrag auf einer anderen Seite, zeichnet sie neu und
  // oeffnet den Beitrag dabei selbst – deshalb dann false zurueckgeben.
  function oeffnen(d, id) {
    window.beitragSchau.zeigen(d, id, false, {
      beiWechsel: (neueId, index) => {
        const seite = Math.floor(index / IG_PRO_SEITE);
        if (seite === igSeite) return true;
        igSeite = seite;
        zeichneBeitraege(d);
        window.beitragSchau.zeigen(d, neueId, true);
        return false;
      }
    });
  }

  igLaden();
})();
