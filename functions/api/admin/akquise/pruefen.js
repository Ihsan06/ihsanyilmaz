// /api/admin/akquise/pruefen — Website eines Betriebs pruefen und bewerten.
//
// POST  { id }  → Website serverseitig holen, Zeile in akquise_pruefungen,
//                 Scores und Kategorie am Betrieb.
//                 Ohne Website wird die Adresse GERATEN (Kandidaten aus dem
//                 Namen, Treffer nur mit Bezug zum Betrieb). Treffer → Website
//                 als "vermutet" gespeichert und normal geprueft. Kein Treffer
//                 → keine neue leere Pruefzeile; nur beim allerersten Mal eine
//                 Zeile mit den Betriebssignalen.
// PATCH { id, psi?:{leistung,lcp,cls}, wayback?:{erster,letzter,anzahl} }
//               → Werte an die letzte Pruefung schreiben und neu rechnen.
//                 PageSpeed und Wayback holt der Browser: die Antworten sind
//                 gross bzw. langsam, hier wuerde das die CPU-Grenze reissen.
// GET   ?id=    → letzte 5 Pruefungen, roh und signale geparst.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import {
  betriebPruefen, bewerten, websiteRaten, hostVon, waybackDatum, waybackErsterAbfragen,
  LEERE_PRUEFUNG, jsonLesen, betriebLaden, istMehrfach, letztePruefungLaden,
  pruefungSpeichern, pruefungNeuBewerten, scoresStatement, pruefAntwort,
} from '../../../_lib/akquise.js';

const HINWEIS_OHNE_WEBSITE = 'Keine Website bei OpenStreetMap – Google-Suche starten oder bei Google Maps nachsehen';

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  const betrieb = await betriebLaden(env, id);
  if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
  const mehrfach = await istMehrfach(env, betrieb);

  let geraten = null;
  if (!betrieb.website) {
    let raten;
    try {
      raten = await websiteRaten(betrieb);
    } catch (e) {
      return json({ ok: false, error: `Raten fehlgeschlagen: ${String(e?.message || e).slice(0, 200)}` });
    }
    if (!raten.treffer) {
      // Nichts gefunden: Betriebssignale rechnen, aber nur beim ersten Mal
      // eine Zeile anlegen – sonst wuchsen bei jedem Klick leere Zeilen.
      const bew = bewerten(betrieb, LEERE_PRUEFUNG, {}, { mehrfach });
      const letzte = await letztePruefungLaden(env, id);
      let pruefung;
      if (letzte) {
        await env.DB.batch([
          env.DB.prepare('UPDATE akquise_pruefungen SET signale = ? WHERE id = ?').bind(JSON.stringify(bew.signale), letzte.id),
          scoresStatement(env, id, bew, { geprueft: true }),
        ]);
        pruefung = { ...letzte, signale: bew.signale, roh: jsonLesen(letzte.roh, {}) };
      } else {
        pruefung = await pruefungSpeichern(env, betrieb, { pruefung: { ...LEERE_PRUEFUNG, roh: {} }, ...bew });
      }
      return json(pruefAntwort(betrieb, bew, pruefung, { gefunden: false, hinweis: HINWEIS_OHNE_WEBSITE, kandidaten: raten.kandidaten }));
    }
    geraten = raten.treffer;
    betrieb.website = geraten.website;
    betrieb.website_quelle = 'vermutet';
    await env.DB.prepare(
      "UPDATE akquise_betriebe SET website = ?, website_quelle = 'vermutet', geaendert = datetime('now') WHERE id = ?",
    ).bind(betrieb.website, id).run();
  }

  let ergebnis;
  try {
    ergebnis = await betriebPruefen(betrieb, { mehrfach, abruf: geraten?.abruf ?? null });
  } catch (e) {
    return json({ ok: false, error: `Prüfung fehlgeschlagen: ${String(e?.message || e).slice(0, 200)}` });
  }
  const pruefung = await pruefungSpeichern(env, betrieb, ergebnis);
  return json(pruefAntwort(betrieb, ergebnis, pruefung, geraten ? { gefunden: true, geraten: { website: geraten.website, gruende: geraten.gruende } } : {}));
});

export const onRequestPatch = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  const aenderungen = {};
  if (body.psi !== undefined) {
    const psi = body.psi || {};
    const leistung = Number(psi.leistung);
    if (!Number.isFinite(leistung) || leistung < 0 || leistung > 100) return json({ ok: false, error: 'PageSpeed-Wert fehlt.' }, 400);
    aenderungen.psi_leistung = Math.round(leistung);
    aenderungen.psi_lcp = Number.isFinite(Number(psi.lcp)) ? Number(psi.lcp) : null;
    aenderungen.psi_cls = Number.isFinite(Number(psi.cls)) ? Number(psi.cls) : null;
  }
  if (body.wayback !== undefined) {
    const w = body.wayback && typeof body.wayback === 'object' ? body.wayback : {};
    aenderungen.wayback_erster = waybackDatum(w.erster);
    aenderungen.wayback_letzter = waybackDatum(w.letzter);
    // null bleibt null – Number(null) waere 0 und saehe nach "keine Snapshots" aus.
    const anzahl = w.anzahl === null || w.anzahl === undefined ? NaN : Number(w.anzahl);
    aenderungen.wayback_anzahl = Number.isInteger(anzahl) && anzahl >= 0 ? anzahl : null;
  }
  if (!Object.keys(aenderungen).length) return json({ ok: false, error: 'Nichts zu ändern.' }, 400);

  const betrieb = await betriebLaden(env, id);
  if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
  const letzte = await letztePruefungLaden(env, id);
  if (!letzte) return json({ ok: false, error: 'Noch keine Prüfung vorhanden.' }, 404);

  // Fallback fuer den ersten Snapshot: nur, wenn die Seite archiviert ist
  // (letzter vorhanden) und der Browser den ersten nicht bekommen hat.
  if (body.wayback !== undefined && !aenderungen.wayback_erster && aenderungen.wayback_letzter && betrieb.website) {
    aenderungen.wayback_erster = await waybackErsterAbfragen(hostVon(betrieb.website));
  }

  const ergebnis = await pruefungNeuBewerten(env, betrieb, letzte, aenderungen);
  return json(pruefAntwort(betrieb, ergebnis, ergebnis.pruefung));
});

export const onRequestGet = nurAngemeldet(async ({ request, env }) => {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const { results } = await env.DB.prepare(
    'SELECT * FROM akquise_pruefungen WHERE betrieb_id = ? ORDER BY zeitpunkt DESC, id DESC LIMIT 5',
  ).bind(id).all();
  const pruefungen = (results ?? []).map(p => ({ ...p, signale: jsonLesen(p.signale, []), roh: jsonLesen(p.roh, {}) }));
  return json({ ok: true, pruefungen });
});
