// /api/admin/akquise/psi — PageSpeed (mobil) fuer einen Betrieb messen.
//
// POST { id } → PageSpeed Insights mit Schluessel, Werte an die letzte
//               Pruefung, Scores neu. Antwort wie POST /pruefen.
//
// Bisher holte der Browser PageSpeed ohne Schluessel – Google lehnte fast
// jede Anfrage ab (429, geteiltes Kontingent). Mit Schluessel sind 25.000
// Messungen am Tag frei. Die volle Antwort ist mehrere MB gross; "fields"
// schneidet sie auf die drei Werte zu, die wir brauchen, damit das Parsen in
// der Function kaum CPU kostet. Eine Messung dauert 10–40 s (Google laedt die
// Seite wirklich) – gewartet wird auf das Netz, nicht gerechnet.
//
// Schluessel: PSI_KEY, sonst PLACES_KEY (dann muss am Schluessel auch die
// "PageSpeed Insights API" freigegeben und im Projekt aktiviert sein).
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { istBoersenSeite, betriebLaden, letztePruefungLaden, pruefungNeuBewerten, pruefAntwort } from '../../../_lib/akquise.js';
import { klartext, fehlerMerken } from '../../../_lib/places.js';

const PSI_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const FELDER = 'lighthouseResult/categories/performance/score,lighthouseResult/audits/largest-contentful-paint/numericValue,lighthouseResult/audits/cumulative-layout-shift/numericValue';
const TIMEOUT_MS = 90_000;

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  const schluessel = env.PSI_KEY || env.PLACES_KEY;
  if (!schluessel) return json({ ok: false, error: 'PageSpeed nicht eingerichtet: Schlüssel in Cloudflare hinterlegen.', code: 'psi_nicht_frei' });
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  const betrieb = await betriebLaden(env, id);
  if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
  if (!betrieb.website || istBoersenSeite(betrieb.website)) return json({ ok: false, error: 'Keine eigene Website – nichts zu messen.' }, 400);
  const letzte = await letztePruefungLaden(env, id);
  if (!letzte) return json({ ok: false, error: 'Erst prüfen, dann messen.' }, 409);

  const url = `${PSI_URL}?url=${encodeURIComponent(betrieb.website)}&strategy=mobile&category=performance&fields=${encodeURIComponent(FELDER)}&key=${encodeURIComponent(schluessel)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  let daten;
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    daten = await r.json().catch(() => ({}));
    if (!r.ok) {
      const klar = klartext(r.status, daten?.error, 'PageSpeed Insights API');
      // 400/500 ohne Schluessel-Grund: Google konnte die Seite nicht laden.
      const msg = klar ? `PageSpeed: ${klar}` : 'PageSpeed: Google konnte die Seite nicht laden';
      const nichtFrei = /gesperrt|nicht aktiviert|ungültig|beschränkt|Abrechnung/.test(klar);
      if (nichtFrei) await fehlerMerken(env, 'psi', `Betrieb ${id}`, msg);
      return json({ ok: false, error: msg, code: nichtFrei ? 'psi_nicht_frei' : 'psi_seite' });
    }
  } catch (e) {
    return json({ ok: false, error: e?.name === 'AbortError' ? 'PageSpeed: Zeitüberschreitung' : 'PageSpeed nicht erreichbar.', code: 'psi_seite' });
  } finally {
    clearTimeout(t);
  }

  const lr = daten?.lighthouseResult || {};
  const score = Number(lr?.categories?.performance?.score);
  if (!Number.isFinite(score)) return json({ ok: false, error: 'PageSpeed: kein Messwert', code: 'psi_seite' });
  const lcp = Number(lr?.audits?.['largest-contentful-paint']?.numericValue);
  const cls = Number(lr?.audits?.['cumulative-layout-shift']?.numericValue);
  const ergebnis = await pruefungNeuBewerten(env, betrieb, letzte, {
    psi_leistung: Math.round(score * 100),
    psi_lcp: Number.isFinite(lcp) ? Math.round(lcp / 100) / 10 : null,
    psi_cls: Number.isFinite(cls) ? Math.round(cls * 1000) / 1000 : null,
  });
  return json(pruefAntwort(betrieb, ergebnis, ergebnis.pruefung));
});
