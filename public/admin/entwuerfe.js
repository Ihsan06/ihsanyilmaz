// Entwuerfe – Beitraege und Stories, die im Baukasten angefangen und
// gespeichert wurden.
//
// Die Seite verwaltet nur: umbenennen, verdoppeln, loeschen. Weitergebaut
// wird im Baukasten selbst (/admin/content?entwurf=…), der den Entwurf mit
// allem wiederherstellt, was eingestellt war. Posten geht bewusst nicht von
// hier aus: ein Entwurf ist nicht fertig, und zugeschnitten wird erst im
// Baukasten – genau so, wie es die Vorschau dort zeigt.

(function () {
  'use strict';

  const { schuetzen, kachel, zahl, frage } = window.admin;
  const liste = document.getElementById('ew-liste');
  if (!liste) return;

  let alle = [];

  // ─── Filter und Sortierung ───
  // Beides bleibt gemerkt – wer nur Stories vorbereitet, soll nicht jedes Mal
  // neu umschalten muessen.
  const SORTIERUNGEN = {
    geaendert: (a, b) => String(b.geaendert).localeCompare(String(a.geaendert)),
    angelegt:  (a, b) => String(b.angelegt).localeCompare(String(a.angelegt)),
    alt:       (a, b) => String(a.angelegt).localeCompare(String(b.angelegt)),
    name:      (a, b) => String(a.titel || '').localeCompare(String(b.titel || ''), 'de')
  };
  let filter = '';
  let sortierung = 'geaendert';
  try {
    const f = localStorage.getItem('ew-filter');
    if (f === 'beitrag' || f === 'story') filter = f;
    const s = localStorage.getItem('ew-sortierung');
    if (SORTIERUNGEN[s]) sortierung = s;
  } catch { /* egal */ }

  const reiter = [...document.querySelectorAll('[data-filter]')];
  const reiterZeichnen = () => reiter.forEach(k =>
    k.setAttribute('aria-selected', String(k.dataset.filter === filter)));
  reiter.forEach(k => k.addEventListener('click', () => {
    filter = k.dataset.filter;
    try { localStorage.setItem('ew-filter', filter); } catch { /* egal */ }
    reiterZeichnen();
    zeichnen();
  }));
  reiterZeichnen();

  const sortierFeld = document.getElementById('ew-sortierung');
  if (sortierFeld) {
    sortierFeld.value = sortierung;
    sortierFeld.addEventListener('change', () => {
      sortierung = SORTIERUNGEN[sortierFeld.value] ? sortierFeld.value : 'geaendert';
      try { localStorage.setItem('ew-sortierung', sortierung); } catch { /* egal */ }
      zeichnen();
    });
  }

  // ─── Laden ───

  async function laden() {
    let d = null;
    try {
      const a = await fetch('/api/studio/entwuerfe', { credentials: 'same-origin' });
      if (a.status === 401) { location.href = '/admin'; return; }
      d = await a.json();
    } catch { /* faellt unten in die Fehlermeldung */ }

    if (!d || !d.ok) {
      liste.innerHTML = `<div class="gd-fehler"><b>Die Entwürfe ließen sich nicht laden.</b>
        <span>${schuetzen((d && d.fehler) || 'Bitte die Seite neu laden.')}</span></div>`;
      return;
    }
    alle = d.entwuerfe || [];
    zahlenZeichnen();
    zeichnen();
  }

  function zahlenZeichnen() {
    const ziel = document.getElementById('ew-zahlen');
    if (!ziel) return;
    const beitraege = alle.filter(e => e.format !== 'story').length;
    const stories = alle.length - beitraege;
    const verwendet = alle.filter(e => e.verwendet).length;
    const juengster = alle.map(e => alsDatum(e.geaendert)).filter(Boolean).sort((a, b) => b - a)[0];
    ziel.innerHTML =
      kachel('Entwürfe', zahl(alle.length), juengster ? 'zuletzt ' + wannKurz(juengster) : '') +
      kachel('Beiträge', zahl(beitraege), '') +
      kachel('Stories', zahl(stories), '') +
      kachel('Schon verwendet', zahl(verwendet), verwendet ? 'gepostet oder eingeplant' : '');
  }

  // ─── Liste ───

  function zeichnen() {
    const sichtbar = alle.filter(e => !filter || e.format === filter)
      .sort(SORTIERUNGEN[sortierung]);
    const anzahl = document.getElementById('ew-anzahl');
    if (anzahl) anzahl.textContent = sichtbar.length ? String(sichtbar.length) : '';

    if (!alle.length) {
      liste.innerHTML = `<div class="ew-leer">
        <b>Noch keine Entwürfe.</b>
        <span>Im Baukasten unter Content erstellen auf „Entwurf“ (Diskette) drücken –
          dann steht der Beitrag hier und lässt sich später weiterbauen.</span>
        <a class="btn-klein" href="/admin/content">Zu Content erstellen</a>
      </div>`;
      return;
    }
    if (!sichtbar.length) {
      liste.innerHTML = `<p class="mon-leer">Keine ${filter === 'story' ? 'Stories' : 'Beiträge'}
        unter den Entwürfen.</p>`;
      return;
    }

    liste.innerHTML = sichtbar.map(karte).join('');
    verdrahten();
  }

  function karte(e) {
    const story = e.format === 'story';
    const z = e.zustand || {};
    const bilder = Array.isArray(e.bilder) ? e.bilder : [];
    // Herkunft: aus Content planen uebernommen, sonst das Thema der Galerie.
    const woher = z.ausPlan ? 'Aus Content planen'
      : (z.themaTitel ? `Galerie · ${z.themaTitel}` : 'Aus der Galerie');
    const text = String(e.text || '').split(/\n\s*\n(?=#)/)[0].trim();
    const titelZeile = String(z.zeile || '').split('\n').map(x => x.trim()).find(Boolean);

    const bilderHtml = bilder.length
      ? bilder.slice(0, 3).map((u, i) =>
          `<img src="${schuetzen(klein(u))}" alt="" loading="lazy" style="z-index:${3 - i}" />`).join('')
        + (bilder.length > 3 ? `<span class="plan-mehr">+${bilder.length - 3}</span>` : '')
      : `<span class="ew-ohne-bild">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor"
               stroke-width="1.6" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.8"/>
            <path d="M3.5 17l5-4.5 3.5 3 3-2.5 5.5 4.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>noch kein Bild</span>`;

    return `<article class="plan-karte ew-karte" data-id="${e.id}">
      <button type="button" class="plan-bilder ew-bilder" data-oeffnen
              title="Im Baukasten öffnen" aria-label="${schuetzen(e.titel || 'Entwurf')} im Baukasten öffnen">
        ${bilderHtml}
      </button>
      <div class="plan-mitte">
        <p class="plan-kopfzeile">
          <span class="ew-format${story ? ' story' : ''}">${story ? 'Story' : 'Beitrag'}</span>
          <span class="plan-stand">${schuetzen(woher)}</span>
          <span class="plan-wann-fest">· bearbeitet ${schuetzen(wannKurz(alsDatum(e.geaendert)))}</span>
          ${e.verwendet ? `<span class="ew-marke" title="${schuetzen(schoen(alsDatum(e.verwendet_am)))}">
            ${e.verwendet === 'geplant' ? 'eingeplant' : 'gepostet'} ${schuetzen(wannKurz(alsDatum(e.verwendet_am)))}</span>` : ''}
        </p>
        <label class="ew-name-zeile">
          <input type="text" class="ew-name" value="${schuetzen(e.titel || '')}" maxlength="120"
                 aria-label="Name des Entwurfs" placeholder="Name des Entwurfs" />
          <span class="ew-name-stand" aria-live="polite"></span>
        </label>
        ${text
          ? `<p class="ew-text">${schuetzen(text)}</p>`
          : `<p class="ew-text ew-text-leer">${story ? 'Story ohne Beschreibung' : 'Noch ohne Beschreibung'}</p>`}
        <p class="ew-fakten">
          <span>${bilder.length === 1 ? '1 Bild' : `${zahl(bilder.length)} Bilder`}</span>
          ${titelZeile ? `<span>Titel im Bild: „${schuetzen(titelZeile)}“</span>` : ''}
          ${z.warGeplant ? `<span>war geplant für ${schuetzen(schoen(alsDatum(z.warGeplant)))}</span>` : ''}
        </p>
        <div class="plan-knoepfe">
          <button type="button" class="plan-sofort" data-oeffnen>Weiterbearbeiten</button>
          <button type="button" data-kopie>Kopie anlegen</button>
          <button type="button" class="plan-weg" data-weg>Löschen</button>
        </div>
      </div>
    </article>`;
  }

  function verdrahten() {
    liste.querySelectorAll('.ew-karte').forEach(k => {
      const id = Number(k.dataset.id);

      k.querySelectorAll('[data-oeffnen]').forEach(b => b.addEventListener('click', () => {
        location.href = '/admin/content?entwurf=' + id;
      }));

      // Ein Bild kann inzwischen geloescht sein. Dann statt
      // eines zerbrochenen Bildes nur der Hinweis – der Entwurf selbst bleibt.
      k.querySelectorAll('.ew-bilder img').forEach(img => img.addEventListener('error', () => {
        img.remove();
        const kasten = k.querySelector('.ew-bilder');
        if (kasten && !kasten.querySelector('img') && !kasten.querySelector('.ew-ohne-bild')) {
          kasten.insertAdjacentHTML('afterbegin',
            '<span class="ew-ohne-bild">Bild nicht mehr verfügbar</span>');
        }
      }, { once: true }));

      // Umbenennen: gespeichert wird beim Verlassen des Felds oder mit Enter.
      const name = k.querySelector('.ew-name');
      const stand = k.querySelector('.ew-name-stand');
      let bisher = name.value;
      let laeuft = false;
      const umbenennen = async () => {
        const neu = name.value.trim();
        if (neu === bisher || laeuft) return;
        if (!neu) { name.value = bisher; return; }
        laeuft = true;
        stand.textContent = 'wird gespeichert …';
        const d = await senden('PUT', { id, titel: neu }, k);
        laeuft = false;
        if (d) {
          bisher = neu;
          const e = alle.find(x => x.id === id);
          if (e) Object.assign(e, d.entwurf);
          stand.textContent = 'gespeichert ✓';
          setTimeout(() => { stand.textContent = ''; }, 2000);
        } else {
          name.value = bisher;
          stand.textContent = '';
        }
      };
      name.addEventListener('keydown', ev => {
        // Enter speichert selbst: nicht jeder Browser meldet nach blur() noch
        // ein change, wenn das Fenster gerade nicht im Vordergrund ist.
        if (ev.key === 'Enter') { ev.preventDefault(); umbenennen(); name.blur(); }
        if (ev.key === 'Escape') { name.value = bisher; name.blur(); }
      });
      // Beides: change kommt beim Bestaetigen, blur auch dann, wenn der Browser
      // das Feld verlaesst, ohne change zu melden.
      name.addEventListener('change', umbenennen);
      name.addEventListener('blur', umbenennen);

      k.querySelector('[data-kopie]').addEventListener('click', async ev => {
        const knopf = ev.currentTarget;
        knopf.disabled = true;
        const d = await senden('POST', { id, aktion: 'kopie' }, k);
        knopf.disabled = false;
        if (d) laden();
      });

      k.querySelector('[data-weg]').addEventListener('click', async () => {
        const e = alle.find(x => x.id === id);
        const ja = await frage({
          titel: 'Diesen Entwurf löschen?',
          text: `„${(e && e.titel) || 'Entwurf'}“ wird gelöscht. Die Bilder bleiben in der Galerie `
            + 'bleiben erhalten – weg ist nur der Entwurf.',
          knopf: 'Ja, löschen'
        });
        if (!ja) return;
        try {
          const a = await fetch('/api/studio/entwuerfe?id=' + id,
            { method: 'DELETE', credentials: 'same-origin' });
          const d = await a.json();
          if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
        } catch (err) { melden(k, err.message); return; }
        laden();
      });
    });
  }

  async function senden(methode, daten, karte) {
    try {
      const a = await fetch('/api/studio/entwuerfe', {
        method: methode, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(daten)
      });
      const d = await a.json();
      if (!d || !d.ok) throw new Error((d && d.fehler) || 'HTTP ' + a.status);
      return d;
    } catch (err) {
      melden(karte, err.message);
      return null;
    }
  }

  // Der Fehler gehoert an die Karte, um die es geht.
  function melden(karte, satz) {
    if (!karte) return;
    let zeile = karte.querySelector('.plan-fehler');
    if (!zeile) {
      zeile = document.createElement('p');
      zeile.className = 'plan-fehler';
      karte.querySelector('.plan-kopfzeile').after(zeile);
    }
    zeile.textContent = satz;
  }

  // ─── Kleinkram ───

  const klein = u => String(u);

  function alsDatum(wert) {
    if (!wert) return null;
    const d = new Date(String(wert).includes('T') ? wert : String(wert).replace(' ', 'T') + 'Z');
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // "heute, 10:14" / "gestern, 18:02" / "am 12.09." – kurz genug fuer die
  // Kopfzeile einer Karte.
  function wannKurz(d) {
    if (!d) return '';
    const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const heute = new Date();
    const gestern = new Date(); gestern.setDate(heute.getDate() - 1);
    if (d.toDateString() === heute.toDateString()) return `heute, ${uhr}`;
    if (d.toDateString() === gestern.toDateString()) return `gestern, ${uhr}`;
    return 'am ' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit',
      year: d.getFullYear() === heute.getFullYear() ? undefined : 'numeric' });
  }

  function schoen(d) {
    if (!d) return '';
    return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit',
      year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
  }

  laden();
})();
