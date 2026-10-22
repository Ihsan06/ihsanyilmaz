// GET /fuer/<token>/website — Website-Vorschau fuer den Betrieb hinter dem Token.
//
// Eine fertige Startseite mit Namen, Ort, Marken, Oeffnungszeiten und Telefon
// des Betriebs, Texten von Claude (gebaut im Admin unter Post → Zweiter Brief)
// und den Beispielfahrzeugen der eigenen Demo. Nichts davon stammt von der
// Website des Betriebs. Nicht in Suchmaschinen, nach 30 Tagen weg.
//
// Gezaehlt wird wie auf der persoenlichen Seite (ohne eigene Geraete, hoechstens
// einmal je Minute); beim ersten Aufruf kommt eine Mail.
import { briefZuToken, nichtGefunden, esc } from '../[token].js';
import { eigenerAufruf } from '../../_lib/auth.js';
import { betriebMelden } from '../../_lib/mitteilung.js';
import { fakten, vorschauLaden, BEISPIEL_FAHRZEUGE, HERO_BILD } from '../../_lib/vorschau.js';
import { postEinstellungenLaden } from '../../api/admin/akquise/post-einstellungen.js';

const eur = n => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const tel = t => String(t || '').replace(/[^\d+]/g, '');

const CSS = `
  :root { color-scheme: dark; --bg:#0A0F14; --fl:#111820; --fl2:#182129; --rand:#243039; --text:#F2F5F7; --leise:#B4BFC9; --still:#7C8A97; --akzent:#4DA3E0; --knopf:#1B6FA8; }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; line-height:1.6; -webkit-font-smoothing:antialiased; padding-bottom:84px; }
  a { color:inherit; }
  .breite { max-width:1180px; margin:0 auto; padding:0 20px; }
  .hinweis { background:#1B6FA8; color:#fff; font-size:.82rem; text-align:center; padding:8px 16px; }
  .hinweis a { color:#fff; font-weight:600; }
  header.kopf { position:sticky; top:0; z-index:20; background:rgba(10,15,20,.88); backdrop-filter:blur(10px); border-bottom:1px solid var(--rand); }
  header.kopf .breite { display:flex; align-items:center; gap:24px; height:68px; }
  .logo { text-decoration:none; line-height:1.1; }
  .logo small { display:block; font-size:.62rem; letter-spacing:.18em; text-transform:uppercase; color:var(--still); }
  .logo b { font-family:Georgia,"Times New Roman",serif; font-size:1.25rem; font-weight:600; }
  nav.menue { display:flex; gap:22px; margin-left:auto; font-size:.92rem; }
  nav.menue a { text-decoration:none; color:var(--leise); }
  nav.menue a:hover { color:var(--text); }
  .knopf { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 22px; border-radius:10px; background:var(--knopf); color:#fff; text-decoration:none; font-weight:600; border:0; font:inherit; cursor:pointer; }
  .knopf:hover { background:#2380c0; }
  .knopf.rand { background:transparent; border:1px solid rgba(255,255,255,.55); }
  .knopf.rand:hover { background:rgba(255,255,255,.08); }
  .knopf.klein { padding:9px 16px; font-size:.9rem; }
  .held { position:relative; min-height:560px; display:flex; align-items:flex-end; background:#0b1219 center/cover no-repeat; }
  .held::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,15,20,.35) 0%, rgba(10,15,20,.55) 45%, rgba(10,15,20,.95) 100%); }
  .held .breite { position:relative; z-index:1; width:100%; padding-bottom:64px; }
  .eyebrow { color:var(--akzent); font-size:.8rem; font-weight:700; text-transform:uppercase; letter-spacing:.14em; margin:0 0 12px; }
  h1 { font-family:Georgia,"Times New Roman",serif; font-size:clamp(2.2rem, 5vw, 3.6rem); line-height:1.05; margin:0 0 16px; font-weight:600; max-width:780px; }
  .held p.unter { font-size:1.12rem; color:#DDE4EA; max-width:620px; margin:0 0 28px; }
  .held .aktionen { display:flex; gap:12px; flex-wrap:wrap; }
  .marken { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; }
  .marken span { padding:4px 12px; border-radius:999px; border:1px solid rgba(255,255,255,.35); font-size:.8rem; font-weight:600; }
  .leiste { background:var(--fl); border-bottom:1px solid var(--rand); }
  .leiste .breite { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:18px; padding-top:22px; padding-bottom:22px; }
  .leiste p { margin:0; font-size:.92rem; color:var(--leise); }
  .leiste b { display:block; color:var(--text); font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; }
  section.block { padding:72px 0; }
  section.block.hell { background:var(--fl); }
  h2 { font-family:Georgia,"Times New Roman",serif; font-size:clamp(1.7rem, 3vw, 2.3rem); margin:0 0 10px; font-weight:600; }
  .lead { color:var(--leise); margin:0 0 32px; max-width:680px; }
  .autos { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:18px; }
  @media (max-width:900px) { .autos { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
  @media (max-width:560px) { .autos { grid-template-columns:1fr; } }
  .auto { background:var(--fl); border:1px solid var(--rand); border-radius:14px; overflow:hidden; }
  .auto .bild { position:relative; aspect-ratio:4/3; background:#0b1219 center/cover no-repeat; }
  .auto .bild span { position:absolute; left:10px; top:10px; padding:3px 10px; border-radius:999px; background:rgba(10,15,20,.72); font-size:.74rem; font-weight:600; }
  .auto .text { padding:14px 16px 16px; }
  .auto h3 { margin:0 0 8px; font-size:1rem; line-height:1.3; }
  .auto dl { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin:0 0 12px; font-size:.8rem; }
  .auto dt { color:var(--still); font-size:.66rem; text-transform:uppercase; letter-spacing:.06em; }
  .auto dd { margin:0; }
  .auto .preis { font-size:1.25rem; font-weight:700; color:var(--akzent); }
  .notiz { margin:18px 0 0; font-size:.86rem; color:var(--still); }
  .karten { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:16px; }
  .karte { background:var(--fl2); border:1px solid var(--rand); border-radius:14px; padding:22px; }
  .karte h3 { margin:0 0 6px; font-size:1.05rem; }
  .karte p { margin:0; color:var(--leise); font-size:.92rem; }
  .zwei { display:grid; grid-template-columns:minmax(0, 1.2fr) minmax(0, 1fr); gap:40px; align-items:start; }
  .vorteile { list-style:none; padding:0; margin:20px 0 0; display:grid; gap:10px; }
  .vorteile li { display:flex; gap:10px; align-items:center; }
  .vorteile li::before { content:"✓"; color:#2F9E5F; font-weight:700; }
  .kontakt dl { margin:0; display:grid; gap:14px; }
  .kontakt dt { color:var(--still); font-size:.74rem; text-transform:uppercase; letter-spacing:.08em; }
  .kontakt dd { margin:2px 0 0; }
  .karte-osm { width:100%; height:300px; border:0; border-radius:14px; filter:grayscale(.3) brightness(.9); }
  footer.fuss { border-top:1px solid var(--rand); padding:28px 0; font-size:.82rem; color:var(--still); }
  footer.fuss .breite { display:flex; gap:18px; flex-wrap:wrap; justify-content:space-between; }
  .unten { position:fixed; left:0; right:0; bottom:0; z-index:30; background:rgba(17,24,32,.96); backdrop-filter:blur(10px); border-top:1px solid var(--rand); }
  .unten .breite { display:flex; align-items:center; gap:14px; padding-top:12px; padding-bottom:12px; flex-wrap:wrap; }
  .unten p { margin:0; font-size:.9rem; color:var(--leise); flex:1; min-width:200px; }
  .unten p b { color:var(--text); }
  .unten .ok { color:#6fcf97; font-size:.88rem; }
  .knopf.klein { white-space:nowrap; }
  @media (max-width:820px) {
    nav.menue { display:none; }
    .zwei { grid-template-columns:1fr; }
    .held { min-height:480px; }
    header.kopf .breite { justify-content:space-between; }
  }
  @media (max-width:560px) {
    body { padding-bottom:118px; }
    .logo b { font-size:1.05rem; }
    .hinweis { font-size:.74rem; padding:6px 12px; }
    .unten .breite { gap:8px; padding-top:10px; padding-bottom:10px; }
    .unten p { font-size:.8rem; min-width:100%; }
    .unten .knopf { padding:9px 14px; font-size:.88rem; flex:1; }
    .unten .knopf.rand { flex:none; }
    section.block { padding:52px 0; }
  }
`;

export async function onRequestGet({ request, params, env, waitUntil }) {
  const token = String(params.token || '');
  const brief = await briefZuToken(env, token).catch(() => null);
  if (!brief || !brief.betrieb_id) return nichtGefunden();
  const vorschau = await vorschauLaden(env, brief.betrieb_id).catch(() => null);
  if (!vorschau) {
    // Noch keine (oder abgelaufene) Vorschau: zurueck zur persoenlichen Seite.
    return Response.redirect(new URL(`/fuer/${token}`, request.url).toString(), 302);
  }

  if (!(await eigenerAufruf(request, env))) {
    const z = env.DB.prepare(
      `UPDATE akquise_vorschauen SET aufrufe = aufrufe + 1, zuletzt_aufgerufen = datetime('now')
       WHERE betrieb_id = ? AND (zuletzt_aufgerufen IS NULL OR zuletzt_aufgerufen < datetime('now', '-60 seconds'))
       RETURNING aufrufe`,
    ).bind(brief.betrieb_id).first()
      .then(r => (r && r.aufrufe === 1 ? betriebMelden(env, request, brief.betrieb_id, 'Website-Vorschau geöffnet') : null))
      .catch(() => {});
    if (typeof waitUntil === 'function') waitUntil(z); else await z;
  }

  const e = await postEinstellungenLaden(env).catch(() => null);
  const meinTelefon = e?.absender?.telefon || '';
  const f = fakten(brief);
  const t = vorschau.texte;
  const firma = f.name || 'Ihr Betrieb';
  const adresse = [brief.strasse, [brief.plz, brief.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const google = brief.google_anzahl >= 10 && brief.google_bewertung >= 4 ? `★ ${String(brief.google_bewertung).replace('.', ',')} bei ${brief.google_anzahl} Google-Bewertungen` : '';
  const karte = Number.isFinite(brief.lat) && Number.isFinite(brief.lng)
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${brief.lng - 0.01},${brief.lat - 0.006},${brief.lng + 0.01},${brief.lat + 0.006}&layer=mapnik&marker=${brief.lat},${brief.lng}`
    : '';
  const ablauf = new Date(vorschau.ablauf.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE');

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${esc(firma)} – Vorschau</title>
<style>${CSS}</style></head><body>
<div class="hinweis">Vorschau für ${esc(firma)} von Ihsan Yilmaz – nicht öffentlich, gültig bis ${esc(ablauf)}. Fahrzeuge und Bilder sind Beispiele. <a href="/fuer/${esc(token)}?seite=1">Zur persönlichen Seite</a></div>
<header class="kopf"><div class="breite">
  <a class="logo" href="#start">${new RegExp(f.werkstatt ? 'werkstatt' : 'autohaus', 'i').test(firma) ? '' : `<small>${esc(f.art)}</small>`}<b>${esc(firma)}</b></a>
  <nav class="menue"><a href="#fahrzeuge">Fahrzeuge</a><a href="#leistungen">Leistungen</a><a href="#ueber">Über uns</a><a href="#kontakt">Kontakt</a></nav>
  ${brief.telefon ? `<a class="knopf klein" href="tel:${esc(tel(brief.telefon))}">Jetzt anrufen</a>` : ''}
</div></header>

<section class="held" id="start" style="background-image:url('${HERO_BILD}')"><div class="breite">
  ${f.marken.length ? `<div class="marken">${f.marken.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
  <p class="eyebrow">${esc(f.art)}${f.ort ? ` in ${esc(f.ort)}` : ''}</p>
  <h1>${esc(t.claim)}</h1>
  <p class="unter">${esc(t.unterzeile)}</p>
  <div class="aktionen">
    <a class="knopf" href="#${f.werkstatt ? 'leistungen' : 'fahrzeuge'}">${f.werkstatt ? 'Leistungen ansehen' : 'Fahrzeuge ansehen'}</a>
    <a class="knopf rand" href="#kontakt">Kontakt aufnehmen</a>
  </div>
</div></section>

<div class="leiste"><div class="breite">
  ${adresse ? `<p><b>Adresse</b>${esc(adresse)}</p>` : ''}
  ${f.zeiten.length ? `<p><b>Öffnungszeiten</b>${f.zeiten.map(esc).join('<br>')}</p>` : ''}
  ${brief.telefon ? `<p><b>Telefon</b><a href="tel:${esc(tel(brief.telefon))}">${esc(brief.telefon)}</a></p>` : ''}
  ${google ? `<p><b>Bewertungen</b>${esc(google)}</p>` : ''}
</div></div>

${f.werkstatt ? '' : `<section class="block" id="fahrzeuge"><div class="breite">
  <h2>Aktuelle Fahrzeuge</h2>
  <p class="lead">Ihr Bestand erscheint hier automatisch aus mobile.de – mit Bildern, Preisen und Ausstattung. In der Vorschau stehen Beispiele.</p>
  <div class="autos">${BEISPIEL_FAHRZEUGE.map(a => `<article class="auto">
    <div class="bild" style="background-image:url('${a.bild}')"><span>Beispiel</span></div>
    <div class="text"><h3>${esc(a.marke)} ${esc(a.modell)}</h3>
      <dl><div><dt>EZ</dt><dd>${esc(a.ez)}</dd></div><div><dt>km</dt><dd>${a.km.toLocaleString('de-DE')}</dd></div><div><dt>Leistung</dt><dd>${a.ps} PS</dd></div></dl>
      <div class="preis">${eur(a.preis)}</div></div>
  </article>`).join('')}</div>
</div></section>`}

<section class="block hell" id="leistungen"><div class="breite">
  <h2>Unsere Leistungen</h2>
  <p class="lead">${esc(t.unterzeile)}</p>
  <div class="karten">${t.leistungen.map(l => `<div class="karte"><h3>${esc(l.titel)}</h3><p>${esc(l.text)}</p></div>`).join('')}</div>
</div></section>

<section class="block" id="ueber"><div class="breite zwei">
  <div><h2>Über ${esc(firma)}</h2><p class="lead" style="margin-bottom:0">${esc(t.ueber_uns)}</p>
    <ul class="vorteile">${t.vorteile.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div>
  <div class="karte"><h3>Persönlich vor Ort</h3><p>Hier kommen später Ihre eigenen Fotos hin – vom Hof, vom Team, von der Werkstatt.</p></div>
</div></section>

<section class="block hell" id="kontakt"><div class="breite zwei">
  <div class="kontakt"><h2>Kontakt</h2><p class="lead">Wir freuen uns auf Ihren Besuch oder Anruf.</p>
    <dl>
      ${adresse ? `<div><dt>Adresse</dt><dd>${esc(firma)}<br>${esc(adresse)}</dd></div>` : ''}
      ${brief.telefon ? `<div><dt>Telefon</dt><dd><a href="tel:${esc(tel(brief.telefon))}">${esc(brief.telefon)}</a></dd></div>` : ''}
      ${f.zeiten.length ? `<div><dt>Öffnungszeiten</dt><dd>${f.zeiten.map(esc).join('<br>')}</dd></div>` : ''}
    </dl></div>
  ${karte ? `<iframe class="karte-osm" src="${esc(karte)}" title="Karte" loading="lazy"></iframe>` : '<div class="karte"><h3>Anfahrt</h3><p>Hier erscheint die Karte zu Ihrem Standort.</p></div>'}
</div></section>

<footer class="fuss"><div class="breite">
  <span>© ${new Date().getFullYear()} ${esc(firma)} · Impressum und Datenschutz kommen mit Ihren Angaben</span>
  <span>Vorschau von <a href="https://ihsan-yilmaz.de">AIY | Ihsan Yilmaz</a> · Karte © OpenStreetMap-Mitwirkende</span>
</div></footer>

<div class="unten"><div class="breite">
  <p><b>Gefällt Ihnen die Vorschau?</b> Ein Klick genügt – ich melde mich per Telefon oder E-Mail.</p>
  <button class="knopf" type="button" id="kontakt-knopf">Ja, bitte melden Sie sich</button>
  ${meinTelefon ? `<a class="knopf rand" href="tel:${esc(tel(meinTelefon))}">${esc(meinTelefon)}</a>` : ''}
  <span class="ok" id="kontakt-meldung" aria-live="polite"></span>
</div></div>
<script>
  (function () {
    var k = document.getElementById('kontakt-knopf'), m = document.getElementById('kontakt-meldung');
    k.addEventListener('click', function () {
      k.disabled = true;
      fetch('/api/fuer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ${JSON.stringify(token)}, aktion: 'kontakt' }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (a) { if (a && a.ok) { k.textContent = 'Danke – ich melde mich'; m.textContent = 'In den nächsten Tagen, per Telefon oder E-Mail.'; } else { k.disabled = false; m.textContent = 'Das hat nicht geklappt – rufen Sie mich gern an.'; } })
        .catch(function () { k.disabled = false; m.textContent = 'Keine Verbindung.'; });
    });
  })();
</script>
</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
