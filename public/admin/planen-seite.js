// Content planen – die Warteschlange fuers zeitversetzte Posten.
//
// Oben das Geplante (verschieben, umtexten, sofort rausschicken, loeschen),
// darunter der Verlauf: was schon draussen ist und was gescheitert ist.
// Gepostet wird nicht von dieser Seite, sondern vom Cron-Worker
// (worker/planer) – hier wird nur verwaltet.

(function () {
  'use strict';

  const { schuetzen } = window.admin;
  const liste = document.getElementById('plan-liste');
  const verlauf = document.getElementById('plan-verlauf');
  if (!liste || !verlauf) return;

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

    liste.innerHTML = d.geplant.length
      ? d.geplant.map(karte).join('')
      : `<p class="mon-leer">Nichts eingeplant. Im
           <a href="/admin/content">Content-Studio</a> einen Beitrag bauen und
           im Posten-Dialog „Einplanen“ wählen.</p>`;

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
            ? `<label class="plan-wann-zeile">· Geht raus am
                 <input type="datetime-local" class="plan-wann" value="${ortszeit(wann)}" min="${ortszeit(new Date())}" />
               </label>`
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
    t.style.height = 'auto';
    t.style.height = (t.scrollHeight + 2) + 'px';
  }

  function verdrahten(wurzel) {
    wurzel.querySelectorAll('.plan-text').forEach(t => {
      textfeldWachsen(t);
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
