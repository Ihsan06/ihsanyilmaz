// Content planen – die Warteschlange fuers zeitversetzte Posten.
//
// Oben das Geplante (verschieben, umtexten, sofort rausschicken, loeschen),
// darunter der Verlauf: was schon draussen ist und was gescheitert ist.
// Gepostet wird nicht von dieser Seite, sondern vom Cron-Worker
// (worker/planer) – hier wird nur verwaltet.

(function () {
  'use strict';

  const { schuetzen, kachel, zahl } = window.admin;
  const liste = document.getElementById('plan-liste');
  const verlauf = document.getElementById('plan-verlauf');
  if (!liste || !verlauf) return;

  // ─── Sortierung der Warteschlange ───
  //
  // Standard ist "Nächste zuerst" – das ist die Reihenfolge, in der die
  // Beitraege wirklich rausgehen. Die Wahl bleibt gemerkt.
  const SORTIERUNGEN = {
    'zeit-auf': (a, b) => String(a.zeitpunkt).localeCompare(String(b.zeitpunkt)),
    'zeit-ab':  (a, b) => String(b.zeitpunkt).localeCompare(String(a.zeitpunkt)),
    'neu':      (a, b) => String(b.angelegt || '').localeCompare(String(a.angelegt || ''))
  };
  const sortierFeld = document.getElementById('plan-sortierung');
  let sortierung = 'zeit-auf';
  try {
    const s = localStorage.getItem('plan-sortierung');
    if (SORTIERUNGEN[s]) sortierung = s;
  } catch { /* egal */ }
  if (sortierFeld) {
    sortierFeld.value = sortierung;
    sortierFeld.addEventListener('change', () => {
      sortierung = SORTIERUNGEN[sortierFeld.value] ? sortierFeld.value : 'zeit-auf';
      try { localStorage.setItem('plan-sortierung', sortierung); } catch { /* egal */ }
      laden();
    });
  }

  // ─── Kennzahl-Kacheln ───

  function zahlenZeichnen(d) {
    const ziel = document.getElementById('plan-zahlen');
    if (!ziel) return;

    const geplant = d.geplant;
    const gepostet = d.erledigt.filter(z => z.status === 'gepostet');
    const fehler = d.erledigt.filter(z => z.status === 'fehler');

    const naechster = [...geplant].sort(SORTIERUNGEN['zeit-auf'])[0];
    const inSieben = geplant.filter(z =>
      new Date(z.zeitpunkt).getTime() - Date.now() < 7 * 86400000).length;
    const letzter = gepostet
      .map(z => alsDatum(z.gepostet_am))
      .filter(Boolean)
      .sort((a, b) => b - a)[0];

    // Unterzeilen nur, wenn sie etwas sagen – keine Fuellwoerter.
    ziel.innerHTML =
      kachel('Geplant', zahl(geplant.length),
        naechster ? 'nächster am ' + schoen(new Date(naechster.zeitpunkt)) : '') +
      kachel('Nächste 7 Tage', zahl(inSieben), '') +
      kachel('Versendet', zahl(gepostet.length),
        letzter ? 'zuletzt am ' + schoen(letzter) : '') +
      kachel('Fehlgeschlagen', zahl(fehler.length),
        fehler.length ? 'warten auf neuen Versuch' : '');
  }

  // Datum UND Uhrzeit rechts im Kopf, ohne Sekunden – und jede Minute
  // nachgefuehrt, damit die Zeile nicht luegt.
  function heuteZeigen() {
    const heute = document.getElementById('plan-heute');
    if (!heute) return;
    const jetzt = new Date();
    heute.textContent = jetzt.toLocaleDateString('de-DE',
      { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
      + ', ' + jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      + ' Uhr';
  }
  setInterval(heuteZeigen, 60000);

  // Die Eintraege des letzten Ladens, nach Kennung: die Bild-Vorschau
  // braucht Text und Bilder, ohne sie erneut vom Server zu holen.
  const eintraege = new Map();

  // ─── Delta zum Jetzt ───
  //
  // Neben jedem Zeitfeld steht klein, wie weit der Zeitpunkt von jetzt
  // entfernt ist – mit Dreieck: ▲ liegt vorn, ▼ ist schon vorbei.
  function deltaWort(ms) {
    const min = Math.round(Math.abs(ms) / 60000);
    if (min < 1) return 'jetzt';
    if (min < 60) return `${min} Min.`;
    const std = Math.floor(min / 60);
    if (std < 48) {
      const rest = min % 60;
      return rest && std < 10 ? `${std} Std. ${rest} Min.` : `${std} Std.`;
    }
    return `${Math.round(std / 24)} Tagen`;
  }

  function deltaChip(datum) {
    const diff = datum.getTime() - Date.now();
    if (Math.abs(diff) < 60000) return `<span class="plan-delta gleich">jetzt</span>`;
    return diff > 0
      ? `<span class="plan-delta vorn">▲ in ${deltaWort(diff)}</span>`
      : `<span class="plan-delta vorbei">▼ vor ${deltaWort(diff)}</span>`;
  }

  // ─── Laden ───

  async function laden() {
    let d = null;
    try {
      const a = await fetch('/api/studio/warteschlange', { credentials: 'same-origin' });
      if (a.status === 401) { location.href = '/admin'; return; }
      d = await a.json();
    } catch { /* faellt unten in die Fehlermeldung */ }

    if (!d || !d.ok) {
      liste.innerHTML = '<p class="mon-leer">Die Warteschlange ist nicht erreichbar.</p>';
      verlauf.innerHTML = '';
      return;
    }

    zahlenZeichnen(d);

    // Zaehler in der Ueberschrift, aktuelles Datum rechts daneben – und der
    // Sortierer zeigt sich erst, wenn es etwas zu sortieren gibt.
    const anzahl = document.getElementById('plan-anzahl');
    if (anzahl) anzahl.textContent = d.geplant.length ? `(${d.geplant.length})` : '';
    heuteZeigen();
    if (sortierFeld) sortierFeld.hidden = d.geplant.length < 2;

    eintraege.clear();
    d.geplant.concat(d.erledigt).forEach(z => eintraege.set(z.id, z));

    const geplantSortiert = [...d.geplant].sort(SORTIERUNGEN[sortierung]);

    liste.innerHTML = geplantSortiert.length
      ? geplantSortiert.map(karte).join('')
      : `<p class="mon-leer">Nichts eingeplant. Im
           <a href="/admin/content">Content-Studio</a> einen Beitrag bauen und
           „Beitrag planen“ wählen.</p>`;

    verlauf.innerHTML = d.erledigt.length
      ? d.erledigt.slice(0, 30).map(karte).join('')
      : '<p class="mon-leer">Noch nichts rausgegangen.</p>';

    verdrahten(liste);
    verdrahten(verlauf);
  }

  // ─── Insta-Vorschau ───
  //
  // Klick auf die Bildkachel: der Beitrag so, wie er auf Instagram aussehen
  // wird – dieselbe Nachbildung wie im Content-Studio (gleiche igv-Stile),
  // nur aus den fertig zugeschnittenen Bildern der Warteschlange gebaut.
  const VORSCHAU_ZEICHEN = 125;

  function instaVorschau(z, stelle) {
    const story = z.format === 'story';
    const text = String(z.text || '');
    const sichtbar = text.slice(0, VORSCHAU_ZEICHEN);
    const rest = text.slice(VORSCHAU_ZEICHEN);
    const bild = schuetzen(z.bilder[stelle] || z.bilder[0] || '');
    const zaehler = z.bilder.length > 1
      ? `<span class="igv-zaehler">${stelle + 1}/${z.bilder.length}</span>` : '';

    if (story) {
      return `<div class="igv igv-story">
        <div class="igv-bild igv-hoch">
          <span class="igs-balken"><i></i></span>
          <img src="${bild}" alt="" data-schau-bild />
          ${zaehler}
        </div>
        <p class="igv-datum">Vorschau · Sticker setzt du in der App</p>
      </div>`;
    }

    return `<div class="igv">
      <div class="igv-kopf">
        <img class="igv-logo" src="/admin/icon.svg" alt="" />
        <div class="igv-wer">
          <b>aiy.web</b>
          <span>Würzburg</span>
        </div>
        <span class="igv-punkt">···</span>
      </div>
      <div class="igv-bild">
        <img src="${bild}" alt="" data-schau-bild />
        ${zaehler}
      </div>
      <div class="igv-leiste">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20.8 8.6c0 4.5-8.8 9.4-8.8 9.4s-8.8-4.9-8.8-9.4a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8z"/></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.5-.7L3 21l1.9-5.1A8.2 8.2 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z"/></svg>
        <svg class="igv-merken" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 21l-6-4.4L6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21z"/></svg>
      </div>
      <p class="igv-text">
        <b>aiy.web</b>
        <span>${schuetzen(sichtbar)}</span><span class="igv-mehr"${rest ? '' : ' hidden'}>… mehr</span>
      </p>
      <p class="igv-datum">Vorschau</p>
    </div>`;
  }

  function schauOeffnen(z) {
    if (document.querySelector('.vp-schleier')) return;
    let stelle = 0;
    const postbar = z.status === 'geplant' || z.status === 'fehler';

    const schleier = document.createElement('div');
    schleier.className = 'vp-schleier';
    schleier.innerHTML = `<div class="plan-schau" role="dialog" aria-modal="true" aria-label="Vorschau">
      <div data-schau-igv>${instaVorschau(z, stelle)}</div>
      <div class="vp-knoepfe plan-schau-knoepfe">
        ${postbar ? '<button type="button" class="vp-ja" data-schau-posten>Jetzt posten</button>' : ''}
        ${postbar ? '<button type="button" class="vp-nein" data-schau-bearbeiten>Bearbeiten</button>' : ''}
        <button type="button" class="vp-nein" data-schau-zu>Schließen</button>
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
    schleier.querySelector('[data-schau-zu]').addEventListener('click', zu);

    // Bei einer Galerie blaettert ein Klick aufs Bild zum naechsten.
    if (z.bilder.length > 1) {
      schleier.querySelector('[data-schau-igv]').addEventListener('click', e => {
        if (!e.target.closest('[data-schau-bild]')) return;
        stelle = (stelle + 1) % z.bilder.length;
        schleier.querySelector('[data-schau-igv]').innerHTML = instaVorschau(z, stelle);
      });
    }

    schleier.querySelector('[data-schau-posten]')?.addEventListener('click', async e => {
      const knopf = e.currentTarget;
      if (!confirm('Jetzt sofort auf @aiy.web veröffentlichen?')) return;
      knopf.disabled = true;
      knopf.textContent = 'Geht raus …';
      await senden('POST', { id: z.id, aktion: 'sofort' });
      zu();
      laden();
    });

    schleier.querySelector('[data-schau-bearbeiten]')?.addEventListener('click', () => {
      location.href = '/admin/content?bearbeiten=' + z.id;
    });
  }

  // ─── Eine Karte ───

  function karte(z) {
    const story = z.format === 'story';
    const wann = new Date(z.zeitpunkt);
    const geplant = z.status === 'geplant';

    const stand = {
      geplant:  ['wartet', 'gelb'],
      laeuft:   ['geht gerade raus …', 'gelb'],
      gepostet: ['gepostet', 'gruen'],
      fehler:   ['gescheitert', 'rot']
    }[z.status] || [z.status, ''];

    return `<article class="plan-karte" data-id="${z.id}">
      <div class="plan-bilder" title="Vorschau ansehen">
        ${z.bilder.slice(0, 3).map((p, i) =>
          `<img src="${schuetzen(p)}" alt="" loading="lazy" style="z-index:${3 - i}" />`).join('')}
        ${z.bilder.length > 3 ? `<span class="plan-mehr">+${z.bilder.length - 3}</span>` : ''}
      </div>
      <div class="plan-mitte">
        <p class="plan-kopfzeile">
          <span class="mf-punkt ${stand[1]}"></span>
          <b>${story ? 'Story' : 'Beitrag'}</b>
          <span class="plan-stand">${schuetzen(stand[0])}</span>
          ${geplant
            ? `<label class="plan-wann-zeile" title="Geht raus am">
                 <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                      stroke-width="1.9" aria-hidden="true">
                   <circle cx="12" cy="12" r="8.5"/>
                   <path d="M12 7.5V12l3 2" stroke-linecap="round" stroke-linejoin="round"/>
                 </svg>
                 <input type="datetime-local" class="plan-wann" aria-label="Geht raus am"
                        value="${ortszeit(wann)}" min="${ortszeit(new Date())}" />
               </label>
               <span data-delta>${deltaChip(wann)}</span>`
            : `<span class="plan-wann-fest">· ${z.status === 'gepostet'
                ? 'Gepostet am ' + schoen(alsDatum(z.gepostet_am) || wann)
                : 'War geplant für ' + schoen(wann)}</span>`}
          ${z.weg ? ` · <a href="${schuetzen(z.weg)}" target="_blank" rel="noopener">ansehen ↗</a>` : ''}
        </p>
        ${z.fehler ? `<p class="plan-fehler">${schuetzen(z.fehler)}</p>` : ''}
        ${geplant || !story
          ? `<textarea class="plan-text" rows="3" ${geplant ? '' : 'readonly'}
               placeholder="Ohne Bildunterschrift">${schuetzen(z.text || '')}</textarea>`
          : ''}
        <div class="plan-knoepfe">
          ${geplant ? `<button type="button" class="plan-speichern" hidden>Änderung speichern</button>` : ''}
          ${geplant ? `<button type="button" class="plan-sofort">Jetzt posten</button>` : ''}
          ${z.status === 'fehler' ? `<button type="button" class="plan-nochmal">Noch einmal versuchen</button>` : ''}
          ${geplant || z.status === 'fehler'
            ? `<button type="button" class="plan-bearbeiten">Bearbeiten</button>` : ''}
          ${z.status !== 'laeuft' ? `<button type="button" class="plan-weg">Löschen</button>` : ''}
        </div>
      </div>
    </article>`;
  }

  // ─── Verdrahten ───

  // Die Bildunterschrift soll ganz lesbar sein, nicht in einem Guckloch
  // stecken: das Feld waechst mit dem Text.
  function textfeldWachsen(t) {
    // Solange das Layout der Karte noch keine echte Breite hat (beim ersten
    // Aufbau kurz der Fall), waere die Messung Unsinn: ein Zeichen je Zeile,
    // 4000 Pixel Hoehe. Dann lieber warten – der Beobachter unten kommt
    // wieder, sobald die Breite steht.
    if (t.offsetWidth < 80) return;
    t.style.height = 'auto';
    t.style.height = (t.scrollHeight + 2) + 'px';
  }

  // Misst nach, sobald sich die BREITE eines Feldes aendert – erster Aufbau,
  // Seitenleiste auf/zu, Fenstergroesse. Nur Breite: die Hoehe aendern wir
  // selbst, darauf zu reagieren waere eine Endlosschleife.
  const feldBeobachter = new ResizeObserver(eintraege => {
    for (const e of eintraege) {
      const t = e.target;
      if (t.dataset.breite !== String(t.offsetWidth)) {
        t.dataset.breite = String(t.offsetWidth);
        textfeldWachsen(t);
      }
    }
  });

  // Nach dem Laden der Schriften einmal nachmessen: mit der endgueltigen
  // Schrift brechen die Zeilen anders um als beim ersten Zeichnen.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() =>
      document.querySelectorAll('.plan-text').forEach(textfeldWachsen));
  }

  function verdrahten(wurzel) {
    wurzel.querySelectorAll('.plan-text').forEach(t => {
      textfeldWachsen(t);
      feldBeobachter.observe(t);
      t.addEventListener('input', () => textfeldWachsen(t));
    });

    wurzel.querySelectorAll('.plan-karte').forEach(k => {
      const id = Number(k.dataset.id);
      const speichern = k.querySelector('.plan-speichern');

      // Aenderungen machen den Speichern-Knopf sichtbar – still speichern
      // waere schneller, aber ein verrutschtes Datum ginge dann unbemerkt raus.
      const geaendert = () => { if (speichern) speichern.hidden = false; };
      k.querySelector('.plan-wann')?.addEventListener('input', geaendert);
      k.querySelector('.plan-text')?.addEventListener('input', geaendert);

      // Das Delta neben dem Zeitfeld zieht beim Umstellen sofort mit –
      // so sieht man schon vor dem Speichern, wie weit weg der Termin liegt.
      const wannFeld = k.querySelector('.plan-wann');
      const deltaZiel = k.querySelector('[data-delta]');
      if (wannFeld && deltaZiel) {
        wannFeld.addEventListener('input', () => {
          const d = new Date(wannFeld.value);
          deltaZiel.innerHTML = isNaN(d.getTime()) ? '' : deltaChip(d);
        });
      }

      speichern?.addEventListener('click', async () => {
        const wann = k.querySelector('.plan-wann');
        const text = k.querySelector('.plan-text');
        const neu = new Date(wann.value);
        if (isNaN(neu.getTime())) { wann.focus(); return; }
        speichern.disabled = true;
        const ok = await senden('PUT', {
          id, zeitpunkt: neu.toISOString(), text: text ? text.value : undefined
        });
        speichern.disabled = false;
        if (ok) laden();
      });

      k.querySelector('.plan-sofort')?.addEventListener('click', async e => {
        const knopf = e.currentTarget;
        if (!confirm('Jetzt sofort auf @aiy.web veröffentlichen?')) return;
        knopf.disabled = true;
        knopf.textContent = 'Geht raus …';
        const ok = await senden('POST', { id, aktion: 'sofort' });
        if (!ok) { knopf.disabled = false; knopf.textContent = 'Jetzt posten'; }
        laden();
      });

      k.querySelector('.plan-nochmal')?.addEventListener('click', async () => {
        if (await senden('POST', { id, aktion: 'nochmal' })) laden();
      });

      // Bild angeklickt: die Insta-Vorschau. Bearbeiten fuehrt ins Studio,
      // das den Eintrag als Ausgangslage laedt (?bearbeiten=…).
      k.querySelector('.plan-bilder')?.addEventListener('click', () => {
        const z = eintraege.get(id);
        if (z) schauOeffnen(z);
      });
      k.querySelector('.plan-bearbeiten')?.addEventListener('click', () => {
        location.href = '/admin/content?bearbeiten=' + id;
      });

      k.querySelector('.plan-weg')?.addEventListener('click', async () => {
        if (!confirm('Diesen Eintrag löschen?')) return;
        try {
          const a = await fetch('/api/studio/warteschlange?id=' + id,
            { method: 'DELETE', credentials: 'same-origin' });
          const d = await a.json();
          if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
        } catch (err) { alert('Ging nicht: ' + err.message); }
        laden();
      });
    });
  }

  async function senden(methode, daten) {
    try {
      const a = await fetch('/api/studio/warteschlange', {
        method: methode, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten)
      });
      const d = await a.json();
      if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
      return true;
    } catch (err) {
      alert('Ging nicht: ' + err.message);
      return false;
    }
  }

  // ─── Kleinkram ───

  function ortszeit(d) {
    const n = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}T${n(d.getHours())}:${n(d.getMinutes())}`;
  }

  // D1 liefert zwei Schreibweisen: ISO mit Z (zeitpunkt) und
  // "JJJJ-MM-TT hh:mm:ss" in UTC (datetime('now')). Beide zu einem Date.
  function alsDatum(wert) {
    if (!wert) return null;
    const d = new Date(wert.includes('T') ? wert : wert.replace(' ', 'T') + 'Z');
    return isNaN(d.getTime()) ? null : d;
  }

  function schoen(d) {
    return d.toLocaleString('de-DE',
      { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit' }) + ' Uhr';
  }

  laden();
  // Waehrend etwas "laeuft" alle 20 Sekunden nachsehen – der Cron-Worker
  // schreibt das Ergebnis in die Tabelle, nicht in diese Seite.
  setInterval(() => {
    if (document.querySelector('.plan-karte .mf-punkt.gelb')) laden();
  }, 20000);
})();
