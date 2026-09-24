// GET /fuer/<token>/nein — "Keine weitere Post von mir".
//
// Der Brief nennt diese Adresse als Widerspruchsweg. Die Seite selbst
// aendert nichts (ein GET darf keine Wirkung haben – Link-Vorschauen und
// Scanner wuerden sonst Betriebe sperren); der Knopf schickt POST /api/fuer.
import { seite, nichtGefunden, briefZuToken, esc } from '../[token].js';

export async function onRequestGet({ params, env }) {
  const token = String(params.token || '');
  const brief = await briefZuToken(env, token).catch(() => null);
  if (!brief) return nichtGefunden();

  const bereits = brief.betrieb_id
    ? await env.DB.prepare('SELECT id FROM akquise_sperrliste WHERE betrieb_id = ? LIMIT 1').bind(brief.betrieb_id).first().catch(() => null)
    : null;

  const inhalt = `
    <p class="eyebrow">Persönliche Seite</p>
    <h1>Keine weitere Post</h1>
    ${bereits
      ? `<p>Für ${esc(brief.name || 'Ihren Betrieb')} ist bereits vermerkt: keine weitere Post. Es kommt nichts mehr.</p>`
      : `<p>Wenn Sie keine Post mehr von mir möchten, genügt ein Klick. ${esc(brief.name || 'Ihr Betrieb')} kommt dann auf meine Sperrliste, und Ihre Anschrift wird nicht mehr für Anschreiben genutzt.</p>
         <p><button class="knopf" id="nein" type="button">Ja, keine weitere Post</button></p>
         <p class="meldung" id="meldung" aria-live="polite"></p>`}
    <p class="klein">Fragen dazu: <a href="mailto:kontakt@ihsan-yilmaz.de">kontakt@ihsan-yilmaz.de</a></p>
    <div class="fuss"><a href="https://ihsan-yilmaz.de/impressum">Impressum</a><a href="https://ihsan-yilmaz.de/datenschutz">Datenschutz</a><a href="/fuer/${esc(token)}">Zurück</a></div>
    <script>
      (function () {
        var k = document.getElementById('nein'), m = document.getElementById('meldung');
        if (!k) return;
        k.addEventListener('click', function () {
          k.disabled = true;
          fetch('/api/fuer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ${JSON.stringify(token)}, aktion: 'nein' }) })
            .then(function (r) { return r.json().catch(function () { return {}; }); })
            .then(function (a) {
              if (a && a.ok) { m.textContent = 'Vermerkt. Es kommt keine weitere Post.'; m.className = 'meldung ok'; k.remove(); }
              else { m.textContent = 'Das hat nicht geklappt. Bitte kurz per E-Mail Bescheid geben.'; m.className = 'meldung fehler'; k.disabled = false; }
            })
            .catch(function () { m.textContent = 'Keine Verbindung. Bitte später noch einmal versuchen.'; m.className = 'meldung fehler'; k.disabled = false; });
        });
      })();
    </script>`;
  return seite({ titel: 'Keine weitere Post – Ihsan Yilmaz', inhalt });
}
