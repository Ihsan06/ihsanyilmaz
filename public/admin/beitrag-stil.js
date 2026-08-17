// Wie die Angaben im Bild aussehen – Schrift, Größe, Farbe, Fläche.
//
// Eigenes Fenster, weil im Baukasten kein Platz mehr ist und weil man
// Schriftgroessen an einer Briefmarke nicht beurteilen kann. Links das Bild
// gross, rechts die Regler, und jede Aenderung ist sofort zu sehen.
//
// Die Einstellung gilt fuer ALLE Beitraege, nicht fuer einen: ein Kanal, der
// bei jedem Bild anders aussieht, hat keinen Wiedererkennungswert. Deshalb
// wird sie in der Datenbank abgelegt und nicht am Beitrag.
//
// Schriften bewusst nur eine Handvoll. Freie Auswahl fuehrt dazu, dass jeder
// Beitrag anders aussieht – und die fuenf hier decken den Bereich zwischen
// nuechtern und werbend ab, ohne dass etwas davon nach Textverarbeitung
// aussieht.

(function () {
  const { schuetzen } = window.admin;

  // Nur Schriften, die auf jedem Rechner vorhanden sind: eine nachgeladene
  // faellt beim Rechnen im Canvas auf eine Ersatzschrift zurueck, und dann
  // sieht das fertige Bild anders aus als die Vorschau.
  const SCHRIFTEN = [
    ['-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 'Serifenlos'],
    ['"Helvetica Neue", Helvetica, Arial, sans-serif', 'Helvetica'],
    ['"Arial Black", "Arial Bold", Gadget, sans-serif', 'Arial Black'],
    ['Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif', 'Impact'],
    ['"Playfair Display", Georgia, serif', 'Playfair'],
    ['Georgia, "Times New Roman", serif', 'Georgia'],
    ['"Times New Roman", Times, serif', 'Times'],
    ['"Trebuchet MS", "Lucida Grande", sans-serif', 'Trebuchet'],
    ['Verdana, Geneva, sans-serif', 'Verdana'],
    ['"Courier New", Courier, monospace', 'Schreibmaschine'],
    ['ui-monospace, "SF Mono", Menlo, monospace', 'Technisch']
  ];

  // Erst die Farben des Hauses, dahinter eine knappe Ergaenzung. Die Reihen-
  // folge ist die Empfehlung: was vorn steht, passt immer – was hinten steht,
  // braucht einen Grund.
  const FARBEN = [
    ['#ffffff', 'Weiß'], ['#071A2B', 'Schwarz'], ['#3D7EA6', 'Ozeanblau'],
    ['#12557F', 'Dunkelrot'], ['#f2e9d8', 'Creme'],
    ['#6b7280', 'Grau'], ['#ffd84d', 'Gelb'], ['#2f6b4f', 'Grün']
  ];

  const GRUENDE = [
    ['keiner', 'Kein Grund'], ['schatten', 'Schatten'],
    ['kasten', 'Kasten'], ['band', 'Band über die Breite']
  ];

  const VORGABE = {
    schrift: SCHRIFTEN[0][0],
    groesse: 32,          // Promille der Bildbreite
    dicke: 700,
    farbe: '#ffffff',
    grund: 'schatten',
    grundfarbe: '#000000',
    deckung: 62,
    drehung: 0,        // Grad, -180 bis 180
    buendig: 'mitte',  // innerhalb des Kastens: links | mitte | rechts
    kursiv: false,
    unterstrichen: false,
    durchgestrichen: false
  };

  // Zwei getrennte Saetze: der Titel steht gross im Bild, die Angaben sind
  // eine dezente Fusszeile. Ein gemeinsamer Stil wuerde eines von beiden
  // verderben – und genau das ist passiert, solange sie sich einen teilten.
  const stile = {
    angaben: { ...VORGABE },
    titel: { ...VORGABE, groesse: 52, dicke: 800, grund: 'kasten', deckung: 72 }
  };
  let welcher = 'angaben';
  const stil = () => stile[welcher];
  let geladen = false;

  // ─── Nach aussen ───

  async function holen() {
    if (geladen) return stil;
    try {
      const a = await fetch('/api/studio/stil', { credentials: 'same-origin' });
      const d = await a.json();
      if (d && d.ok && d.stil) {
        if (d.stil.angaben || d.stil.titel) {
          if (d.stil.angaben) stile.angaben = { ...stile.angaben, ...d.stil.angaben };
          if (d.stil.titel) stile.titel = { ...stile.titel, ...d.stil.titel };
        } else {
          stile.angaben = { ...VORGABE, ...d.stil };   // alter Stand, ein Satz
        }
      }
    } catch { /* dann eben die Vorgabe */ }
    geladen = true;
    return stile;
  }

  const jetzt = (was) => stile[was] || stile.angaben;

  // Als CSS fuer die Nachbildung – dieselben Werte, die das Canvas rechnet.
  function alsCss(was, breitePx) {
    const st = stile[was] || stile.angaben;
    const px = Math.round(breitePx * st.groesse / 1000);
    // KEIN padding hier: inline gesetzt schlaegt es jede Klassenregel – und mit
    // padding-left/right arbeiten Zentrierung und Ausweichen. Genau daran sind
    // links/mitte/rechts gescheitert, sobald ein Grund gewaehlt war. Das
    // Polster kommt jetzt aus der Klasse stil-grund-*.
    const grund = st.grund === 'kasten' || st.grund === 'band'
      ? `background:${mitDeckung(st.grundfarbe, st.deckung)};` : 'background:none;';
    // Immer setzen, auch wenn keiner gewollt ist: die Nachbildung bringt einen
    // eigenen Schatten mit, und ohne ausdrueckliches 'none' bliebe der stehen –
    // 'Kein Grund' saehe dann aus wie 'Schatten'.
    const schatten = st.grund === 'schatten'
      ? 'text-shadow:0 2px 8px rgba(0,0,0,.85),0 0 3px rgba(0,0,0,.7);'
      : 'text-shadow:none;';
    // Die Drehung dreht um die Mitte des Textes; ohne transform-origin
    // wandert er beim Drehen aus seiner Ecke heraus.
    const dreh = st.drehung
      ? `transform:rotate(${st.drehung}deg);transform-origin:center center;` : '';
    const strich = [st.unterstrichen ? 'underline' : '', st.durchgestrichen ? 'line-through' : '']
      .filter(Boolean).join(' ');
    const schnitt = (st.kursiv ? 'font-style:italic;' : 'font-style:normal;')
      + `text-decoration:${strich || 'none'};`;
    // Buendigkeit gilt INNERHALB des Kastens – wo der Kasten sitzt, sagt die
    // Stellenwahl im Baukasten.
    const buendig = `text-align:${st.buendig || 'mitte'};`
      .replace('mitte', 'center').replace('links', 'left').replace('rechts', 'right');
    return `font-family:${st.schrift};font-size:${px}px;font-weight:${st.dicke};`
      + `color:${st.farbe};${grund}${schatten}${dreh}${schnitt}${buendig}`;
  }

  function mitDeckung(hex, prozent) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${prozent / 100})`;
  }

  // Zeichnet die Angaben ins Canvas – von zuschneiden() aufgerufen.
  function zeichnen(was, g, breite, hoehe, text, x, y, ausrichtung) {
    if (!text) return;
    const st = stile[was] || stile.angaben;
    const px = Math.round(breite * st.groesse / 1000);
    // Kursiv steckt in der Schriftangabe; Unter- und Durchstreichung kennt
    // Canvas nicht – die Linien zieht der Zug unten selbst.
    g.font = `${st.kursiv ? 'italic ' : ''}${st.dicke} ${px}px ${st.schrift}`;
    g.textAlign = ausrichtung || 'left';
    g.textBaseline = 'alphabetic';

    // Gedreht wird um die Mitte des Textes – wie in der Vorschau. Alles
    // Folgende rechnet danach in einem gedrehten Koordinatensystem, deshalb
    // steht der Zug hier ganz vorn und wird am Ende zurueckgenommen.
    const gedreht = !!st.drehung;
    if (gedreht) {
      const bw = g.measureText(text).width;
      const mx = ausrichtung === 'center' ? x : (ausrichtung === 'right' ? x - bw / 2 : x + bw / 2);
      const my = y - px / 2;
      g.save();
      g.translate(mx, my);
      g.rotate(st.drehung * Math.PI / 180);
      g.translate(-mx, -my);
    }

    const w = g.measureText(text).width;
    const luftX = Math.round(px * 0.42);
    const luftY = Math.round(px * 0.3);
    const links = ausrichtung === 'center' ? x - w / 2 : (ausrichtung === 'right' ? x - w : x);

    if (st.grund === 'band') {
      g.fillStyle = mitDeckung(st.grundfarbe, st.deckung);
      g.fillRect(0, y - px - luftY, breite, px + luftY * 2);
    } else if (st.grund === 'kasten') {
      const kx = links - luftX, ky = y - px - luftY;
      const kb = w + luftX * 2, kh = px + luftY * 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(kx, ky, kb, kh, Math.round(px * 0.22));
      else g.rect(kx, ky, kb, kh);
      g.fillStyle = mitDeckung(st.grundfarbe, st.deckung);
      g.fill();
    } else if (st.grund === 'schatten') {
      g.shadowColor = 'rgba(0,0,0,.72)';
      g.shadowBlur = Math.round(breite * 0.018);
      g.shadowOffsetY = Math.round(breite * 0.002);
    }

    g.fillStyle = st.farbe;
    g.fillText(text, x, y);
    // Zweiter Zug ohne Schatten: sonst wirkt die Kante verwaschen.
    if (st.grund === 'schatten') {
      g.shadowBlur = 0; g.shadowOffsetY = 0;
      g.fillText(text, x, y);
    }

    // Die Striche in Textfarbe, Staerke an der Schriftgroesse bemessen.
    if (st.unterstrichen || st.durchgestrichen) {
      g.shadowBlur = 0; g.shadowOffsetY = 0;
      g.strokeStyle = st.farbe;
      g.lineWidth = Math.max(1, Math.round(px * 0.06));
      g.lineCap = 'butt';
      const ziehen = hoeheY => {
        g.beginPath();
        g.moveTo(links, hoeheY);
        g.lineTo(links + w, hoeheY);
        g.stroke();
      };
      if (st.unterstrichen) ziehen(y + Math.round(px * 0.16));
      if (st.durchgestrichen) ziehen(y - Math.round(px * 0.30));
    }

    if (gedreht) g.restore();
    g.textAlign = 'left';
  }

  // ─── Das Fenster ───

  function oeffnen(was, bildWeg, text, beiAenderung) {
    welcher = stile[was] ? was : 'angaben';
    const alt = { ...stil() };
    const k = document.createElement('div');
    k.className = 'stil-schleier';
    k.innerHTML = `<div class="stil-fenster" role="dialog" aria-label="Angaben gestalten">
      <div class="stil-bild">
        <img src="${schuetzen(bildWeg)}" alt="" />
        <span class="stil-probe ${welcher === 'titel' ? 'stil-oben' : 'stil-unten'}"></span>
      </div>
      <div class="stil-regler">
        <div class="ueb-kopf"><h2>${welcher === 'titel' ? 'Titel' : 'Angaben'} gestalten</h2></div>

        <label class="stil-zeile"><span>Schrift</span>
          <select data-schrift>${SCHRIFTEN.map(([w, n], i) =>
            `<option value="${i}">${schuetzen(n)}</option>`).join('')}</select></label>

        <label class="stil-zeile"><span>Größe</span>
          <input type="range" min="18" max="60" data-groesse /><i data-groesse-wert></i></label>

        <div class="stil-zeile"><span>Bündig</span>
          <div class="stil-zeichen">
            <button type="button" data-buendig="links" title="Linksbündig" aria-label="Linksbündig">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h13"/></svg></button>
            <button type="button" data-buendig="mitte" title="Zentriert" aria-label="Zentriert">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M6 18h12"/></svg></button>
            <button type="button" data-buendig="rechts" title="Rechtsbündig" aria-label="Rechtsbündig">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round"><path d="M4 6h16M10 12h10M7 18h13"/></svg></button>
          </div>
        </div>

        <div class="stil-zeile"><span>Schnitt</span>
          <div class="stil-zeichen">
            <button type="button" data-schnitt="kursiv" title="Kursiv" aria-label="Kursiv">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round"><path d="M15 4h-5M14 20H9M14.5 4 9.5 20"/></svg></button>
            <button type="button" data-schnitt="unterstrichen" title="Unterstrichen" aria-label="Unterstrichen">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round"><path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/></svg></button>
            <button type="button" data-schnitt="durchgestrichen" title="Durchgestrichen" aria-label="Durchgestrichen">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round"><path d="M4 12h16M7 6.5V6a4 4 0 0 1 8 0M9 17.5a4 4 0 0 0 7-2.5"/></svg></button>
          </div>
        </div>

        <label class="stil-zeile"><span>Stärke</span>
          <select data-dicke>
            <option value="400">Normal</option>
            <option value="600">Halbfett</option>
            <option value="700">Fett</option>
            <option value="800">Sehr fett</option>
          </select></label>

        <div class="stil-zeile"><span>Farbe</span>
          <div class="stil-farben">${FARBEN.map(([w, n]) =>
            `<button type="button" data-farbe="${w}" title="${schuetzen(n)}"
              style="background:${w}"></button>`).join('')}</div></div>

        <label class="stil-zeile"><span>Fläche</span>
          <select data-grund>${GRUENDE.map(([w, n]) =>
            `<option value="${w}">${schuetzen(n)}</option>`).join('')}</select></label>

        <div class="stil-zeile" data-nur-flaeche><span>Flächenfarbe</span>
          <div class="stil-farben">${['#071A2B', '#000000', '#ffffff', '#3D7EA6',
            '#12557F', '#f2e9d8'].map(w =>
            `<button type="button" data-grundfarbe="${w}" style="background:${w}"></button>`).join('')}</div></div>

        <label class="stil-zeile" data-nur-flaeche><span>Deckkraft</span>
          <input type="range" min="10" max="100" data-deckung /><i data-deckung-wert></i></label>

        <div class="stil-zeile"><span>Drehung</span>
          <div class="stil-dreh">
            <!-- Zifferblatt mit Zeiger: ziehen dreht den Text. Ein Regler
                 sagt nicht, wo oben ist – ein Zeiger schon. Der Doppelklick
                 stellt ihn wieder gerade. -->
            <div class="stil-uhr" data-uhr tabindex="0" role="slider"
                 aria-label="Drehung" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="0"
                 title="Ziehen zum Drehen · Doppelklick stellt gerade">
              <span class="stil-uhr-strich"></span>
              <span class="stil-uhr-zeiger" data-uhr-zeiger></span>
              <span class="stil-uhr-mitte"></span>
            </div>
            <i data-drehung-wert></i>
          </div>
        </div>
        <input type="hidden" data-drehung value="0" />


        <div class="sm-knoepfe">
          <button type="button" class="btn-klein" data-sichern>Übernehmen</button>
          <button type="button" class="btn-klein sm-leise" data-zurueck>Abbrechen</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(k);

    const probe = k.querySelector('.stil-probe');
    const f = n => k.querySelector(`[data-${n}]`);

    const nachziehen = () => {
      probe.textContent = text || 'Modell · Baujahr';
      probe.setAttribute('style', alsCss(welcher, k.querySelector('.stil-bild').clientWidth));
      f('groesse-wert').textContent = stil().groesse;
      f('deckung-wert').textContent = stil().deckung + ' %';
      const grad = stil().drehung || 0;
      f('drehung-wert').textContent = grad + '°';
      const z = k.querySelector('[data-uhr-zeiger]');
      if (z) z.style.transform = `rotate(${grad}deg)`;
      k.querySelectorAll('[data-buendig]').forEach(b =>
        b.classList.toggle('hier', b.dataset.buendig === (stil().buendig || 'mitte')));
      k.querySelectorAll('[data-schnitt]').forEach(b =>
        b.classList.toggle('hier', !!stil()[b.dataset.schnitt]));
      k.querySelectorAll('[data-nur-flaeche]').forEach(z => {
        z.hidden = stil().grund === 'keiner' || stil().grund === 'schatten';
      });
      if (beiAenderung) beiAenderung();
    };

    const nr = SCHRIFTEN.findIndex(([w]) => w === stil().schrift);
    f('schrift').value = String(nr < 0 ? 0 : nr);
    f('groesse').value = stil().groesse;
    f('dicke').value = String(stil().dicke);
    f('grund').value = stil().grund;
    f('deckung').value = stil().deckung;
    f('drehung').value = stil().drehung || 0;
    nachziehen();

    f('schrift').addEventListener('change', e => {
      const s = SCHRIFTEN[Number(e.target.value)];
      if (s) stil().schrift = s[0];
      nachziehen();
    });
    f('groesse').addEventListener('input', e => { stil().groesse = Number(e.target.value); nachziehen(); });
    f('dicke').addEventListener('change', e => { stil().dicke = Number(e.target.value); nachziehen(); });
    f('grund').addEventListener('change', e => { stil().grund = e.target.value; nachziehen(); });
    f('deckung').addEventListener('input', e => { stil().deckung = Number(e.target.value); nachziehen(); });
    // ─── Zifferblatt ───
    const uhr = k.querySelector('[data-uhr]');
    const zeiger = k.querySelector('[data-uhr-zeiger]');
    const uhrSetzen = grad => {
      // Auf ganze Grad, und bei knapp daneben auf die Viertel einrasten:
      // von Hand trifft man 90 sonst nie genau.
      let g = Math.round(grad);
      for (const fest of [-180, -135, -90, -45, 0, 45, 90, 135, 180]) {
        if (Math.abs(g - fest) <= 4) { g = fest; break; }
      }
      if (g > 180) g -= 360;
      if (g < -180) g += 360;
      stil().drehung = g;
      f('drehung').value = String(g);
      uhr.setAttribute('aria-valuenow', String(g));
      nachziehen();
    };
    const ausZeiger = e => {
      const r = uhr.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - (r.left + r.width / 2);
      const dy = p.clientY - (r.top + r.height / 2);
      // 0 Grad zeigt nach oben, im Uhrzeigersinn positiv – wie beim Text.
      uhrSetzen(Math.atan2(dx, -dy) * 180 / Math.PI);
    };
    const ziehen = e => { e.preventDefault(); ausZeiger(e); };
    const loslassen = () => {
      document.removeEventListener('mousemove', ziehen);
      document.removeEventListener('mouseup', loslassen);
      document.removeEventListener('touchmove', ziehen);
      document.removeEventListener('touchend', loslassen);
    };
    const greifen = e => {
      e.preventDefault();
      ausZeiger(e);
      document.addEventListener('mousemove', ziehen);
      document.addEventListener('mouseup', loslassen);
      document.addEventListener('touchmove', ziehen, { passive: false });
      document.addEventListener('touchend', loslassen);
    };
    uhr.addEventListener('mousedown', greifen);
    uhr.addEventListener('touchstart', greifen, { passive: false });
    uhr.addEventListener('dblclick', () => uhrSetzen(0));
    uhr.addEventListener('keydown', e => {
      const schritt = e.shiftKey ? 15 : 1;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); uhrSetzen(stil().drehung - schritt); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); uhrSetzen(stil().drehung + schritt); }
      if (e.key === '0') { e.preventDefault(); uhrSetzen(0); }
    });

    // Buendigkeit und Schnitte
    k.querySelectorAll('[data-buendig]').forEach(b => b.addEventListener('click', () => {
      stil().buendig = b.dataset.buendig; nachziehen();
    }));
    k.querySelectorAll('[data-schnitt]').forEach(b => b.addEventListener('click', () => {
      const was = b.dataset.schnitt;
      stil()[was] = !stil()[was];
      nachziehen();
    }));
    k.querySelectorAll('[data-farbe]').forEach(b => b.addEventListener('click', () => {
      stil().farbe = b.dataset.farbe; nachziehen();
    }));
    k.querySelectorAll('[data-grundfarbe]').forEach(b => b.addEventListener('click', () => {
      stil().grundfarbe = b.dataset.grundfarbe; nachziehen();
    }));

    const zu = () => k.remove();
    k.querySelector('[data-zurueck]').addEventListener('click', () => {
      stile[welcher] = alt;
      if (beiAenderung) beiAenderung();
      zu();
    });
    // Erst wenn wirklich gespeichert ist, geht das Fenster zu. Vorher lief es
    // auch bei 401 oder 500 zu, ohne ein Wort – der Stil galt dann nur bis zum
    // naechsten Neuladen, und niemand konnte wissen, warum.
    const sichern = k.querySelector('[data-sichern]');
    sichern.addEventListener('click', async () => {
      const wort = sichern.textContent;
      sichern.disabled = true;
      try {
        const a = await fetch('/api/studio/stil', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stil: stile })
        });
        const d = await a.json().catch(() => null);
        if (!a.ok || !d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
        zu();
      } catch (err) {
        sichern.textContent = 'Ging nicht';
        sichern.title = String(err.message || err);
        setTimeout(() => { sichern.textContent = wort; sichern.disabled = false; }, 3000);
      }
    });
    // Klick auf den Schleier verwirft – dann muss die Vorschau das auch zeigen,
    // genau wie beim Abbrechen-Knopf. Sonst steht auf dem Bildschirm der
    // verworfene Stand, und das fertige Bild kaeme mit dem alten heraus.
    k.addEventListener('click', e => {
      if (e.target !== k) return;
      stile[welcher] = alt;
      if (beiAenderung) beiAenderung();
      zu();
    });
  }

  window.beitragStil = { holen, jetzt, alsCss, zeichnen, oeffnen, mitDeckung };
})();
