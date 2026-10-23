// /api/admin/akquise/dubletten — doppelte Betriebe finden und zusammenfuehren.
//
// OpenStreetMap fuehrt manche Betriebe mehrfach: Showroom und Werkstatt als
// eigene Punkte, einmal als Knoten und einmal als Gebaeude, mit und ohne
// Rechtsform im Namen. Seit der Google-Abfrage ist das sicher erkennbar: zwei
// Eintraege mit derselben Google-Place-ID sind derselbe Ort.
//
// GET  → { ok, gruppen: [{ ids, haupt, sicher, grund, betriebe:[…] }] }
// POST { gruppen: [[id, id, …], …] } → fuehrt jede Gruppe in ihren Haupteintrag
//      zusammen. Ohne gruppen: alle sicheren.
//
// "Sicher" heisst: die Namen teilen ein unterscheidendes Wort (nicht nur
// "Autohaus" oder "Werkstatt") und keine zwei Eintraege nennen verschiedene
// Postleitzahlen. Sonst steht die Gruppe zum Pruefen da – dann hat eher
// Google zwei Standorte auf einen Eintrag gelegt oder falsch zugeordnet.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { hostVon, istBoersenSeite, branche } from '../../../_lib/akquise.js';
import { kennwoerter as googleKennwoerter } from '../../../_lib/places.js';

const GATTUNG = new Set(['autohaus', 'auto', 'autos', 'autoservice', 'autocenter', 'werkstatt', 'kfz', 'service', 'automobile',
  'fahrzeuge', 'garage', 'meisterbetrieb', 'autohandel', 'automobil', 'zentrum', 'center', 'showroom', 'verkaufsraum',
  'gebrauchtwagen', 'reifen', 'mehrmarkencenter', 'niederlassung', 'filiale']);
const STATUS_RANG = { aus: 0, neu: 1, beobachten: 2, brief: 3, kontakt: 4, kunde: 5 };
const FELDER = 'id, name, art, marken, strasse, plz, ort, telefon, email, website, website_quelle, oeffnungszeiten, status, notiz, auswahl, google_place_id, prioritaet, lat, lng';

// Kennwoerter wie bei der Google-Zuordnung, dazu Zusaetze wie "Showroom",
// die zwei Eintraege desselben Betriebs nicht unterscheiden.
const kennwoerterSet = name => new Set(googleKennwoerter(name).filter(w => !GATTUNG.has(w)));

function namenPassen(a, b) {
  const wa = kennwoerterSet(a.name), wb = kennwoerterSet(b.name);
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

// Welcher Eintrag bleibt: der markierte, dann der mit Briefen und Notiz, dann
// der Autohaus-Eintrag vor der Werkstatt, dann der Name ohne Zusatz wie
// "Werkstatt" oder "Verkaufsraum", dann der vollstaendigere, dann der aeltere.
const ZUSATZ = /\b(werkstatt|showroom|verkaufsraum|gebrauchtwagen\w*|service\s*center|niederlassung|filiale)\b/i;
function hauptWaehlen(betriebe, briefe) {
  const vollstaendig = b => ['strasse', 'plz', 'ort', 'telefon', 'website', 'oeffnungszeiten'].filter(k => b[k]).length;
  return [...betriebe].sort((x, y) =>
    (y.auswahl - x.auswahl)
    || ((briefe.get(y.id) || 0) - (briefe.get(x.id) || 0))
    || ((y.notiz ? 1 : 0) - (x.notiz ? 1 : 0))
    || ((y.art === 'car' ? 1 : 0) - (x.art === 'car' ? 1 : 0))
    || ((ZUSATZ.test(x.name) ? 1 : 0) - (ZUSATZ.test(y.name) ? 1 : 0))
    || (vollstaendig(y) - vollstaendig(x))
    || (x.id - y.id))[0];
}

export async function gruppenFinden(env, welche = 'kfz') {
  const { results } = await env.DB.prepare(
    `SELECT ${FELDER} FROM akquise_betriebe WHERE geloescht IS NULL AND zusammengefuehrt_in IS NULL AND branche = ?`,
  ).bind(branche(welche)).all();
  const betriebe = results || [];
  const { results: br } = await env.DB.prepare('SELECT betrieb_id, COUNT(*) AS n FROM akquise_briefe GROUP BY betrieb_id').all();
  const briefe = new Map((br || []).map(r => [r.betrieb_id, r.n]));

  // Union-Find ueber drei Schluessel: Place-ID, eigene Domain + PLZ, Name ohne
  // Gattungswoerter + PLZ. Die Domain allein reicht nicht – Ketten wie Spindler
  // haben eine Domain fuer mehrere Standorte.
  const eltern = new Map(betriebe.map(b => [b.id, b.id]));
  const wurzel = id => { while (eltern.get(id) !== id) { eltern.set(id, eltern.get(eltern.get(id))); id = eltern.get(id); } return id; };
  const vereinen = (a, b) => { const ra = wurzel(a), rb = wurzel(b); if (ra !== rb) eltern.set(rb, ra); };
  const gruende = new Map();
  const merken = (schluessel, grund) => {
    const erster = new Map();
    for (const b of betriebe) {
      const k = schluessel(b);
      if (!k) continue;
      if (erster.has(k)) {
        vereinen(erster.get(k), b.id);
        if (!gruende.has(b.id)) gruende.set(b.id, grund);
        if (!gruende.has(erster.get(k))) gruende.set(erster.get(k), grund);
      }
      else erster.set(k, b.id);
    }
  };
  merken(b => b.google_place_id || null, 'gleicher Google-Eintrag');
  merken(b => (b.website && b.plz && !istBoersenSeite(b.website) ? `${hostVon(b.website)}|${b.plz}` : null), 'gleiche Website und PLZ');
  merken(b => {
    const w = [...kennwoerterSet(b.name)].sort().join(' ');
    return w && b.plz ? `${w}|${b.plz}` : null;
  }, 'gleicher Name und PLZ');

  const gruppen = new Map();
  for (const b of betriebe) {
    const r = wurzel(b.id);
    if (!gruppen.has(r)) gruppen.set(r, []);
    gruppen.get(r).push(b);
  }
  return [...gruppen.values()].filter(g => g.length > 1).map(g => {
    const haupt = hauptWaehlen(g, briefe);
    const plzen = new Set(g.map(b => b.plz).filter(Boolean));
    const sicher = plzen.size <= 1 && g.every(b => b === haupt || namenPassen(b, haupt));
    const grund = g.map(b => gruende.get(b.id)).find(Boolean) || 'gleicher Google-Eintrag';
    return { ids: g.map(b => b.id), haupt: haupt.id, sicher, grund, betriebe: g };
  }).sort((a, b) => Number(b.sicher) - Number(a.sicher));
}

export const onRequestGet = nurAngemeldet(async ({ request, env }) =>
  json({ ok: true, gruppen: await gruppenFinden(env, new URL(request.url).searchParams.get('branche')) }));

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body = {};
  try { body = await request.json(); } catch { /* ohne Body: alle sicheren */ }
  const alle = await gruppenFinden(env, body?.branche);

  // Nur Gruppen zusammenfuehren, die der Server selbst so sieht – eine
  // uebergebene Liste waehlt nur aus, sie kann keine neuen Paare bilden.
  let ziel;
  if (Array.isArray(body?.gruppen) && body.gruppen.length) {
    const gewuenscht = body.gruppen.map(g => new Set((Array.isArray(g) ? g : []).map(Number)));
    ziel = alle.filter(g => gewuenscht.some(w => g.ids.every(id => w.has(id)) && w.size === g.ids.length));
  } else {
    ziel = alle.filter(g => g.sicher);
  }
  if (!ziel.length) return json({ ok: true, zusammengefuehrt: 0, gruppen: 0 });

  const befehle = [];
  let anzahl = 0;
  for (const g of ziel) {
    const haupt = g.betriebe.find(b => b.id === g.haupt);
    const rest = g.betriebe.filter(b => b.id !== g.haupt);

    // Leere Felder des Haupteintrags aus den anderen fuellen; Marken
    // vereinigen, Notizen anhaengen, Auswahl und Status behalten das Staerkste.
    const neu = {};
    for (const k of ['strasse', 'plz', 'ort', 'telefon', 'email', 'oeffnungszeiten', 'lat', 'lng', 'google_place_id']) {
      if (haupt[k] == null || haupt[k] === '') {
        const quelle = rest.find(b => b[k] != null && b[k] !== '');
        if (quelle) neu[k] = quelle[k];
      }
    }
    if (!haupt.website) {
      const quelle = rest.find(b => b.website);
      if (quelle) { neu.website = quelle.website; neu.website_quelle = quelle.website_quelle; }
    }
    const marken = [...new Set(g.betriebe.flatMap(b => String(b.marken || '').split(',').map(s => s.trim()).filter(Boolean)))];
    if (marken.join(', ') !== (haupt.marken || '')) neu.marken = marken.join(', ') || null;
    const notizen = g.betriebe.map(b => (b.notiz || '').trim()).filter(Boolean);
    if (notizen.length > 1 || (notizen.length === 1 && !haupt.notiz)) neu.notiz = [...new Set(notizen)].join('\n\n');
    if (g.betriebe.some(b => b.auswahl) && !haupt.auswahl) neu.auswahl = 1;
    const status = g.betriebe.reduce((s, b) => ((STATUS_RANG[b.status] ?? 1) > (STATUS_RANG[s] ?? 1) ? b.status : s), haupt.status);
    if (status !== haupt.status) neu.status = status;

    const spalten = Object.keys(neu);
    if (spalten.length) {
      befehle.push(env.DB.prepare(
        `UPDATE akquise_betriebe SET ${spalten.map(k => `${k} = ?`).join(', ')}, geaendert = datetime('now') WHERE id = ?`,
      ).bind(...spalten.map(k => neu[k]), haupt.id));
    }
    for (const b of rest) {
      befehle.push(env.DB.prepare('UPDATE akquise_briefe SET betrieb_id = ? WHERE betrieb_id = ?').bind(haupt.id, b.id));
      befehle.push(env.DB.prepare('UPDATE akquise_sperrliste SET betrieb_id = ? WHERE betrieb_id = ?').bind(haupt.id, b.id));
      befehle.push(env.DB.prepare('DELETE FROM akquise_pruefungen WHERE betrieb_id = ?').bind(b.id));
      befehle.push(env.DB.prepare(
        "UPDATE akquise_betriebe SET zusammengefuehrt_in = ?, geloescht = datetime('now'), auswahl = 0, geaendert = datetime('now') WHERE id = ?",
      ).bind(haupt.id, b.id));
      anzahl++;
    }
  }
  for (let i = 0; i < befehle.length; i += 40) await env.DB.batch(befehle.slice(i, i + 40));
  return json({ ok: true, zusammengefuehrt: anzahl, gruppen: ziel.length });
});
