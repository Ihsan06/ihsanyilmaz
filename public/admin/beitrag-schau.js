// Ein einzelner Instagram-Beitrag als Fenster ueber der Seite.
//
// Ausgelagert, weil zwei Seiten dasselbe zeigen: die Instagram-Seite unter
// "Posts & Reels" und die Uebersicht unter dem Beitragsstreifen. Zweimal
// gebaut waeren es zweimal Aenderungen und frueher oder spaeter zwei
// verschiedene Ansichten.
//
// Nach aussen:
//   beitragSchau.vorschau(text, hashtags, art)  – die Instagram-Nachbildung
//   beitragSchau.bildKasten(klassen, innen)     – nur der Bildrahmen daraus
//   beitragSchau.zeigen(daten, id)              – das Fenster oeffnen
//   beitragSchau.schliessen()
//   beitragSchau.VORSCHAU_ZEICHEN
//
// "daten" ist die Antwort von /api/studio/instagram – gebraucht werden
// daten.medien und daten.jetzt.follower (fuer die Reaktionsquote).

window.beitragSchau = (function () {
  const { zahl, schuetzen, info } = window.admin;

  const tag = iso => new Date(iso).toLocaleDateString('de-DE',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
  const uhr = iso => new Date(iso).toLocaleTimeString('de-DE',
    { hour: '2-digit', minute: '2-digit' });
  const wann = iso => (new Date().toDateString() === new Date(iso).toDateString()
    ? `heute, ${uhr(iso)}` : `${tag(iso)}, ${uhr(iso)}`);
  const tageSeit = iso => Math.floor((Date.now() - new Date(iso)) / 86400000);

  // Dieselbe Kachelform wie sonst auf den Adminseiten.
  function feld(wert, wort, erklaerung, zusatz) {
    return `<div class="gd-feld">
      ${erklaerung ? `<span class="gd-feld-info">${info(erklaerung)}</span>` : ''}
      <b>${typeof wert === 'number' ? zahl(wert) : schuetzen(wert)}</b>
      <span>${schuetzen(wort)}</span>
      ${zusatz ? `<span class="gd-feld-zusatz">${schuetzen(zusatz)}</span>` : ''}
    </div>`;
  }

  // ─── Vorschau ───
  //
  // Ein Textkasten sagt nicht, wie ein Beitrag wirkt. Deshalb hier die
  // Nachbildung: dasselbe Seitenverhaeltnis, dieselbe Reihenfolge, dieselbe
  // Kuerzung. Vor allem die Kuerzung ist der Punkt – Instagram zeigt vom Text
  // nur den Anfang und blendet den Rest hinter "mehr" aus. Was danach kommt,
  // liest fast niemand.
  const VORSCHAU_ZEICHEN = 125;

  function vorschau(text, hashtags, art) {
    const sichtbar = text.slice(0, VORSCHAU_ZEICHEN);
    const rest = text.slice(VORSCHAU_ZEICHEN);

    return `<div class="igv" data-vorschau data-art="${art}">
      <div class="igv-kopf">
        <img class="igv-logo" src="/admin/icon.svg" alt="" />
        <div class="igv-wer">
          <b>aiy.web</b>
          <span>Würzburg</span>
        </div>
        <span class="igv-punkt">···</span>
      </div>

      ${bildKasten(art === 'reel' ? 'igv-hoch' : '', art === 'reel' ? '<span class="igv-play">▶</span>' : '')}

      <div class="igv-leiste">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20.8 8.6c0 4.5-8.8 9.4-8.8 9.4s-8.8-4.9-8.8-9.4a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8z"/></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.5-.7L3 21l1.9-5.1A8.2 8.2 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z"/></svg>
        <svg class="igv-merken" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 21l-6-4.4L6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21z"/></svg>
      </div>

      <p class="igv-text">
        <b>aiy.web</b>
        <span data-sichtbar data-voll="${schuetzen(text)}">${schuetzen(sichtbar)}</span><span class="igv-mehr" data-rest${rest ? '' : ' hidden'}>… mehr</span>
      </p>
      <p class="igv-tags" data-tags>${schuetzen(hashtags)}</p>
      <p class="igv-datum">Vorschau</p>
    </div>`;
  }

  // Der Bildkasten ist in Beitrag, Reel und Story derselbe – samt Stift,
  // Kreuz und Zoom. Nur der Rahmen drumherum unterscheidet sich.
  function bildKasten(klassen, innen) {
    return `
      <div class="igv-bild ${klassen}">
        <span class="igv-leer">Bild wählen</span>
        ${innen || ''}
        <span class="igv-zaehler" hidden></span>
        <!-- Was spaeter ins Bild gerechnet wird, steht hier schon drin –
             gleiche Stelle, gleiche Groesse. -->
        <span class="igs-zeile igs-kasten pos-oben-mitte" hidden></span>
        <span class="igv-label" hidden></span>
        <span class="igv-marke" hidden aria-hidden="true">
          <svg viewBox="0 0 220 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.0,41.1 C7.5,40.8 11.9,40.2 14.9,39.2 C17.8,38.3 20.8,36.8 23.7,35.6 C26.6,34.2 29.6,32.9 32.6,31.7 C35.5,30.4 38.5,29.3 41.4,28.1 C44.3,26.9 47.3,25.7 50.3,24.7 C53.2,23.7 56.2,22.7 59.1,21.8 C62.0,21.0 65.0,20.2 68.0,19.4 C70.9,18.7 73.9,17.9 76.8,17.2 C79.7,16.7 82.7,16.2 85.7,15.9 C88.6,15.7 91.6,15.7 94.5,15.7 C97.4,15.7 100.4,15.6 103.4,15.9 C106.3,16.3 109.3,16.9 112.2,17.7 C115.1,18.6 118.1,19.6 121.1,21.0 C124.0,22.2 127.0,23.8 129.9,25.6 C132.8,27.3 135.8,29.5 138.8,31.4 C141.7,33.4 144.7,35.5 147.6,37.0 C150.5,38.4 153.5,39.4 156.5,40.0 C159.4,40.5 162.4,40.4 165.3,40.5 C168.2,40.6 171.2,40.5 174.2,40.7 C177.1,40.9 180.1,41.1 183.0,41.6 C185.9,41.9 189.0,42.4 191.9,43.0 C194.8,43.6 197.8,44.5 200.7,45.4 C203.6,46.3 207.4,47.7 209.6,48.4 C211.8,49.1 213.3,49.6 214.0,49.7" stroke="#3D7EA6" stroke-width="5.8" stroke-linecap="round"/>
          </svg>
          <i class="igv-wort">AIY · Ihsan Yilmaz</i>
        </span>

        <button type="button" class="igv-stift" data-bild-bearbeiten
                title="Ausschnitt und Zoom anpassen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" stroke-linejoin="round"/>
          </svg>
          <span>Bearbeiten</span>
        </button>

        <div class="igv-werkzeug" hidden>
          <span class="igv-kreuz">
            <button type="button" data-schub="0,1" aria-label="nach oben">▲</button>
            <button type="button" data-schub="-1,0" aria-label="nach links">◀</button>
            <button type="button" data-schub="1,0" aria-label="nach rechts">▶</button>
            <button type="button" data-schub="0,-1" aria-label="nach unten">▼</button>
          </span>
          <input type="range" min="100" max="260" value="100" step="1" data-zoom aria-label="Zoom" />
          <button type="button" class="igv-mitte" data-zoom-weg title="Zurücksetzen" aria-label="Zurücksetzen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <path d="M3 10a9 9 0 1 1 2.6 6.4" stroke-linecap="round"/>
              <polyline points="3 4 3 10 9 10" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>`;
  }

  // Eine Story ist kein Beitrag im Hochformat: kein Herz, keine
  // Bildunterschrift, kein Datum. Sie ist bildfuellend, oben laufen die
  // Balken, Name und Zeile liegen IM Bild, unten steht das Antwortfeld –
  // und nach 24 Stunden ist sie weg. Genau das soll die Vorschau zeigen,
  // sonst baut man sie wie einen Beitrag und wundert sich hinterher.
  // ─── Ein einzelner Beitrag ───
  //
  // Ein Klick fuehrte bisher direkt zu Instagram. Das ist der eine Fall, den
  // man am seltensten braucht: meistens will man wissen, was in dem Beitrag
  // stand und wie er gelaufen ist. Beides steht jetzt hier, der Absprung
  // bleibt als Knopf.
  let igOffen = null;
  let schauTaste = null;

  const sorteWort = m => (m.sorte === 'REELS' || m.art === 'VIDEO' ? 'Reel'
    : (m.art === 'CAROUSEL_ALBUM' ? 'Galerie' : ''));

  // Der Schleier liegt am <body>, nicht in der Kachelreihe: sonst wuerde er
  // beim Blaettern der Kacheln mit neu gezeichnet und schloesse sich selbst.
  function schauKasten() {
    let ziel = document.getElementById('ig-schau');
    if (!ziel) {
      ziel = document.createElement('div');
      ziel.id = 'ig-schau';
      ziel.className = 'ig-schleier';
      ziel.setAttribute('aria-live', 'polite');
      document.body.append(ziel);
      ziel.addEventListener('click', e => { if (e.target === ziel) schauSchliessen(); });
    }
    return ziel;
  }

  function schauSchliessen() {
    beiWechsel = null;
    const ziel = document.getElementById('ig-schau');
    if (ziel) { ziel.innerHTML = ''; ziel.hidden = true; }
    document.documentElement.classList.remove('ig-offen');
    igOffen = null;
    document.querySelectorAll('[data-schau].hier').forEach(k => k.classList.remove('hier'));
  }

  // beiWechsel: die aufrufende Seite erfaehrt, welcher Beitrag jetzt dran
  // ist – auf der Instagram-Seite blaettert daraufhin die Kachelreihe mit,
  // auf der Uebersicht der Streifen.
  let beiWechsel = null;

  function schauZeigen(d, id, still, opt) {
    if (opt && typeof opt.beiWechsel === 'function') beiWechsel = opt.beiWechsel;
    const ziel = schauKasten();
    const m = (d.medien || []).find(x => x.id === id);
    if (!m) { schauSchliessen(); return; }
    igOffen = id;
    ziel.hidden = false;
    document.documentElement.classList.add('ig-offen');

    const bilder = m.bilder && m.bilder.length ? m.bilder : (m.bild ? [m.bild] : []);
    const tags = (m.text.match(/#[\wäöüßÄÖÜ]+/g) || []);
    const ohneTags = m.text.replace(/#[\wäöüßÄÖÜ]+/g, '').replace(/\n{3,}/g, '\n\n').trim();
    const reaktionen = (m.likes || 0) + (m.kommentare || 0);

    const alle = d.medien || [];
    const wo = alle.findIndex(x => x.id === id);

    ziel.innerHTML = `<div class="sm-block sm-zwei ig-schau">
      <div class="ig-schau-blaettern">
        <button type="button" class="ig-schau-pfeil" data-schau-zurueck
                ${wo <= 0 ? 'disabled' : ''} aria-label="Vorheriger Beitrag">‹</button>
        <span>${wo + 1} von ${zahl(alle.length)}</span>
        <button type="button" class="ig-schau-pfeil" data-schau-vor
                ${wo < 0 || wo >= alle.length - 1 ? 'disabled' : ''} aria-label="Nächster Beitrag">›</button>
      </div>
      <button type="button" class="sm-zu" data-schau-zu aria-label="Schließen">×</button>
      <div class="sm-links">${vorschau(ohneTags, tags.join(' '),
        sorteWort(m) === 'Reel' ? 'reel' : 'beitrag')}</div>
      <div class="sm-rechts">
        <div class="sm-kopf"><b>${sorteWort(m) || 'Beitrag'}</b>
          <span>${schuetzen(wann(m.zeitpunkt))} · ${schuetzen(herWort(m.zeitpunkt))}</span></div>

        <div class="gd-felder ig-schau-zahlen">
          ${feld(m.likes, 'Likes')}
          ${feld(m.kommentare, 'Kommentare')}
          ${feld(quote(d, reaktionen), 'Reaktionsquote',
            'Likes und Kommentare geteilt durch die Followerzahl.',
            vergleich(d, reaktionen))}
        </div>

        ${bilder.length > 1 ? `<div class="sm-kopf" style="margin-top:18px"><b>Bilder</b>
            <span>${zahl(bilder.length)} in der Galerie</span></div>
          <div class="sm-raster ig-schau-raster">
            ${bilder.map((u, i) => `<button type="button" class="sm-foto${i ? '' : ' aktiv'}"
                data-galerie="${i}" aria-label="Bild ${i + 1} zeigen">
              <img src="${schuetzen(u)}" alt="" loading="lazy" /></button>`).join('')}
          </div>` : ''}

        <div class="sm-kopf" style="margin-top:18px"><b>Text</b>
          <span>${zahl(m.text.length)} Zeichen · ${zahl(tags.length)} Hashtags</span></div>
        <pre class="sm-text">${verlinken(m.text) || '<i>ohne Text</i>'}</pre>

        <div class="sm-kopf" style="margin-top:18px"><b>Kommentare</b>
          <span>${zahl(m.kommentare)}</span></div>
        <div class="ig-gespraech" data-gespraech>
          <p class="mon-laedt">Kommentare werden geladen …</p></div>

        <div class="sm-knoepfe">
          <a class="btn-klein" href="${schuetzen(m.weg)}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                 stroke-width="2" aria-hidden="true">
              <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2"/>
              <circle cx="12" cy="12" r="4.1"/>
              <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none"/>
            </svg>
            <span>Zu Instagram</span>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                 stroke-width="2.2" aria-hidden="true">
              <line x1="4" y1="12" x2="19" y2="12" stroke-linecap="round"/>
              <polyline points="13 6 19 12 13 18" stroke-linecap="round" stroke-linejoin="round"/>
            </svg></a>
        </div>
      </div>
    </div>`;

    // Das echte Bild in die Nachbildung setzen – vorschau() liefert nur den
    // leeren Rahmen samt Werkzeug, das hier niemand braucht.
    const kasten = ziel.querySelector('.igv-bild');
    if (kasten && (bilder.length || m.video)) {
      kasten.querySelectorAll('.igv-leer, .igv-stift, .igv-werkzeug, .igv-play').forEach(e => e.remove());
      // Ein Reel, das man nicht anschauen kann, ist nur eine Kachel. In der
      // Einzelansicht steht deshalb das Video statt des Standbilds.
      let bild;
      if (m.video) {
        bild = document.createElement('video');
        bild.src = m.video;
        bild.controls = true;
        bild.playsInline = true;
        bild.preload = 'metadata';
        if (bilder[0]) bild.poster = bilder[0];
      } else {
        bild = document.createElement('img');
        bild.src = bilder[0];
        bild.alt = '';
      }
      kasten.prepend(bild);
      if (bilder.length > 1) {
        const z = kasten.querySelector('.igv-zaehler');
        if (z) { z.hidden = false; z.textContent = `1/${bilder.length}`; }
      }
    }
    const datum = ziel.querySelector('.igv-datum');
    if (datum) datum.textContent = `Veröffentlicht ${wann(m.zeitpunkt)}`;

    // Bei einer Galerie laesst sich jedes Bild gross ansehen – ueber die
    // Streifen darunter und ueber Pfeile im Bild selbst.
    if (kasten && bilder.length > 1 && !m.video) {
      let i = 0;
      const gross = kasten.querySelector('img');
      const zaehler = kasten.querySelector('.igv-zaehler');
      const streifen = [...ziel.querySelectorAll('[data-galerie]')];

      const zeigen = n => {
        i = (n + bilder.length) % bilder.length;
        gross.src = bilder[i];
        if (zaehler) { zaehler.hidden = false; zaehler.textContent = `${i + 1}/${bilder.length}`; }
        streifen.forEach((k, x) => k.classList.toggle('aktiv', x === i));
      };

      streifen.forEach((k, x) => k.addEventListener('click', () => zeigen(x)));

      kasten.insertAdjacentHTML('beforeend',
        `<button type="button" class="igv-pfeil igv-zurueck" data-bild-zurueck aria-label="Vorheriges Bild">‹</button>
         <button type="button" class="igv-pfeil igv-vor" data-bild-vor aria-label="Nächstes Bild">›</button>`);
      kasten.querySelector('[data-bild-zurueck]').addEventListener('click', () => zeigen(i - 1));
      kasten.querySelector('[data-bild-vor]').addEventListener('click', () => zeigen(i + 1));
      zeigen(0);
    }

    mehrVerdrahten(ziel);
    kommentareLaden(ziel, m.id, m.kommentare);
    const zu = ziel.querySelector('[data-schau-zu]');
    if (zu) zu.addEventListener('click', schauSchliessen);
    if (!schauTaste) {
      schauTaste = e => { if (e.key === 'Escape') schauSchliessen(); };
      document.addEventListener('keydown', schauTaste);
    }

    // Ein Beitrag weiter: liegt der naechste auf einer anderen Seite, blaettert
    // die Kachelreihe mit – sonst zeigt sie auf nichts.
    const springen = schritt => {
      const neu = alle[wo + schritt];
      if (!neu) return;
      igOffen = neu.id;
      // Erst die Seite unterrichten – sie zeichnet gegebenenfalls ihr Raster
      // neu und ruft dabei selbst wieder auf. Deshalb danach abbrechen.
      if (beiWechsel && beiWechsel(neu.id, wo + schritt) === false) return;
      schauZeigen(d, neu.id, true);
    };
    const zurueck = ziel.querySelector('[data-schau-zurueck]');
    const vor = ziel.querySelector('[data-schau-vor]');
    if (zurueck) zurueck.addEventListener('click', () => springen(-1));
    if (vor) vor.addEventListener('click', () => springen(1));

    // Welche Kachel gerade offen ist.
    document.querySelectorAll('[data-schau]').forEach(k =>
      k.classList.toggle('hier', k.dataset.schau === id));
  }

  // ─── Kommentare ─────────────────────────────────────────────────────
  //
  // Lesen und beantworten, ohne die Seite zu verlassen. Wer auf einen
  // Kommentar antwortet, tut das oeffentlich unter dem Namen des Kontos –
  // deshalb fragt der Knopf noch einmal nach, bevor etwas rausgeht.
  async function kommentareLaden(ziel, media, erwartet) {
    const kasten = ziel.querySelector('[data-gespraech]');
    if (!kasten) return;
    try {
      const a = await fetch('/api/studio/kommentare?media=' + encodeURIComponent(media),
        { credentials: 'same-origin' });
      const d = await a.json();
      if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
      kommentareZeichnen(kasten, d.kommentare || [], media, erwartet);
    } catch (err) {
      kasten.innerHTML = `<p class="mon-leer">Kommentare nicht abrufbar
        (${schuetzen(err.message)}).</p>`;
    }
  }

  function kommentareZeichnen(kasten, liste, media, erwartet) {
    if (!liste.length) {
      // Der Zaehler am Beitrag und der Abruf koennen auseinandergehen: geloeschte
      // oder ausgeblendete Kommentare zaehlen mit, kommen aber nicht mit. Wenn
      // beides nicht zusammenpasst, soll das dastehen statt "kein Kommentar".
      kasten.innerHTML = erwartet
        ? `<p class="mon-leer">Instagram meldet ${zahl(erwartet)}
             ${erwartet === 1 ? 'Kommentar' : 'Kommentare'}, gibt sie über die
             Schnittstelle aber nicht heraus – meist sind es gelöschte oder
             ausgeblendete.</p>`
        : '<p class="mon-leer">Noch kein Kommentar.</p>';
      return;
    }

    kasten.innerHTML = liste.map(k => `<article class="ig-komm${k.verborgen ? ' verborgen' : ''}"
        data-komm="${schuetzen(k.id)}">
      <div class="ig-komm-kopf">
        <b>${schuetzen(k.wer || 'jemand')}</b>
        <span>${schuetzen(kurzZeit(k.zeitpunkt))}</span>
        ${k.likes ? `<span class="ig-komm-likes">♥ ${zahl(k.likes)}</span>` : ''}
        ${k.verborgen ? '<span class="ig-komm-marke">ausgeblendet</span>' : ''}
      </div>
      <p>${verlinken(k.text)}</p>
      ${(k.antworten || []).map(r => `<article class="ig-komm ig-komm-antwort">
        <div class="ig-komm-kopf"><b>${schuetzen(r.wer || '')}</b>
          <span>${schuetzen(kurzZeit(r.zeitpunkt))}</span></div>
        <p>${verlinken(r.text)}</p>
      </article>`).join('')}
      <div class="ig-komm-werkzeug">
        <button type="button" class="ig-komm-knopf" data-antworten>Antworten</button>
        <button type="button" class="ig-komm-knopf" data-verbergen>
          ${k.verborgen ? 'Wieder einblenden' : 'Ausblenden'}</button>
      </div>
    </article>`).join('');

    kasten.querySelectorAll('.ig-komm[data-komm]').forEach(el => {
      const id = el.dataset.komm;
      el.querySelector('[data-antworten]').addEventListener('click', () => antwortFeld(el, id, media));
      el.querySelector('[data-verbergen]').addEventListener('click', async e => {
        const verborgen = el.classList.contains('verborgen');
        e.target.disabled = true;
        try {
          const a = await fetch('/api/studio/kommentare', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kommentar: id, verbergen: !verborgen })
          });
          const d = await a.json();
          if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
          kommentareLaden(kasten.closest('.ig-schau') || document, media);
        } catch (err) {
          e.target.disabled = false;
          e.target.textContent = 'Ging nicht';
          console.error('Kommentar ausblenden:', err);
        }
      });
    });
  }

  // Das Feld erscheint unter dem Kommentar, auf den es antwortet – so sieht
  // man beim Tippen, worauf man antwortet.
  function antwortFeld(el, id, media) {
    if (el.querySelector('.ig-komm-feld')) return;
    const feld = document.createElement('div');
    feld.className = 'ig-komm-feld';
    feld.innerHTML = `<textarea rows="2" placeholder="Antwort schreiben …"></textarea>
      <div class="ig-komm-feld-knoepfe">
        <button type="button" class="ig-komm-senden">Öffentlich antworten</button>
        <button type="button" class="ig-komm-knopf" data-weg>Abbrechen</button>
        <span class="ig-komm-stand"></span>
      </div>`;
    el.append(feld);
    const eingabe = feld.querySelector('textarea');
    eingabe.focus();

    feld.querySelector('[data-weg]').addEventListener('click', () => feld.remove());
    feld.querySelector('.ig-komm-senden').addEventListener('click', async e => {
      const text = eingabe.value.trim();
      const stand = feld.querySelector('.ig-komm-stand');
      if (!text) { stand.textContent = 'Erst etwas schreiben.'; return; }
      e.target.disabled = true;
      stand.textContent = 'Wird gesendet …';
      try {
        const a = await fetch('/api/studio/kommentare', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kommentar: id, text })
        });
        const d = await a.json();
        if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
        feld.remove();
        kommentareLaden(el.closest('.ig-schau') || document, media);
      } catch (err) {
        e.target.disabled = false;
        stand.textContent = 'Ging nicht: ' + err.message;
      }
    });
  }

  const kurzZeit = iso => {
    const t = tageSeit(iso);
    if (t <= 0) return 'heute';
    if (t === 1) return 'gestern';
    if (t < 31) return `vor ${t} Tagen`;
    return tag(iso);
  };

  // Reaktionen im Verhaeltnis zur Followerzahl. Die absolute Zahl sagt wenig –
  // 40 Likes sind bei 300 Followern viel und bei 30.000 nichts.
  function quote(d, reaktionen) {
    const f = d.jetzt && d.jetzt.follower;
    if (!f) return '–';
    return (reaktionen / f * 100).toFixed(1).replace('.', ',') + ' %';
  }

  // Und der Vergleich mit den eigenen Beitraegen – das ist der Massstab, der
  // hier zaehlt, nicht irgendein Branchenwert.
  function vergleich(d, reaktionen) {
    const alle = (d.medien || []).map(x => (x.likes || 0) + (x.kommentare || 0)).filter(n => n > 0);
    if (alle.length < 3) return '';
    const schnitt = alle.reduce((a, b) => a + b, 0) / alle.length;
    if (!schnitt) return '';
    const ab = Math.round((reaktionen / schnitt - 1) * 100);
    if (Math.abs(ab) < 10) return 'im Schnitt';
    return `${ab > 0 ? '+' : '−'}${Math.abs(ab)}\u00a0% zum Schnitt`;
  }

  const herWort = iso => {
    const t = tageSeit(iso);
    if (t <= 0) return 'heute';
    if (t === 1) return 'gestern';
    if (t < 31) return `vor ${t} Tagen`;
    const mo = Math.round(t / 30);
    return mo <= 1 ? 'vor einem Monat' : `vor ${mo} Monaten`;
  };

  // Nur Hashtags werden anklickbar. Adressen hatten wir auch verlinkt, aber
  // die Erkennung griff zu oft daneben – Satzzeichen am Ende, geschuetzte
  // Zeichen, Woerter mit Punkt darin. Ein Link, der ins Leere fuehrt, ist
  // schlechter als gar keiner; die Adresse steht ja lesbar da.
  // Erst schuetzen, dann verlinken: sonst waere jeder Beitragstext eine
  // offene Tuer fuer fremdes HTML.
  function verlinken(text) {
    return schuetzen(text).replace(/#([\wäöüßÄÖÜ]+)/g,
      (_, t) => `<a class="sm-tag" href="https://www.instagram.com/explore/tags/${t.toLowerCase()}/" target="_blank" rel="noopener">#${t}</a>`);
  }

  // "… mehr" klappt den Rest des Textes auf – wie in der App.
  function mehrVerdrahten(feld) {
    const mehr = feld.querySelector('[data-rest]');
    const sichtbar = feld.querySelector('[data-sichtbar]');
    if (!mehr || !sichtbar) return;
    mehr.addEventListener('click', () => {
      sichtbar.textContent = sichtbar.dataset.voll || sichtbar.textContent;
      mehr.hidden = true;
    });
  }

  return { vorschau, bildKasten, zeigen: schauZeigen, schliessen: schauSchliessen,
           VORSCHAU_ZEICHEN };
})();
