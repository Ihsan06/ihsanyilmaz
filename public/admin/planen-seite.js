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

    ziel.innerHTML =
      kachel('Geplant', zahl(geplant.length),
        naechster ? 'nächster am ' + schoen(new Date(naechster.zeitpunkt)) : 'nichts eingeplant') +
      kachel('Nächste 7 Tage', zahl(inSieben), 'gehen automatisch raus') +
      kachel('Versendet', zahl(gepostet.length),
        letzter ? 'zuletzt am ' + schoen(letzter) : 'noch keiner draußen') +
      kachel('Fehlgeschlagen', zahl(fehler.length),
        fehler.length ? 'warten auf neuen Versuch' : 'alles glatt gelaufen');
  }

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
    const heute = document.getElementById('plan-heute');
    if (heute) {
      heute.textContent = new Date().toLocaleDateString('de-DE',
        { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    if (sortierFeld) sortierFeld.hidden = d.geplant.length < 2;

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
      <div class="plan-bilder">
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
