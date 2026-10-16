// /api/admin/akquise/post-einstellungen — Absender, Briefvorlage, Link-Basis.
//
// Liegt in der Tabelle einstellungen (schluessel/wert):
//   akquise.absender      JSON { name, zusatz, strasse, plz_ort, telefon, email, web }
//   akquise.vorlage       Text mit Platzhaltern
//   akquise.landing_basis z. B. https://ihsan-yilmaz.de/fuer/
//   akquise.vorlage_nachfass  Text des zweiten Briefs
//   akquise.referenz      ein Satz ueber einen Kunden (nur mit dessen Erlaubnis),
//                         Platzhalter {referenz} und Abschnitt auf der persoenlichen Seite
//
// GET → { ok, absender, vorlage, vorlage_nachfass, referenz, landing_basis, platzhalter, standard:{…} }
// PUT { absender?, vorlage?, vorlage_nachfass?, referenz?, landing_basis? } → { ok }
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { ABSENDER_STANDARD, VORLAGE_STANDARD, VORLAGE_NACHFASS, LANDING_BASIS_STANDARD, PLATZHALTER } from '../../../_lib/brief.js';

const SCHLUESSEL = {
  absender: 'akquise.absender', vorlage: 'akquise.vorlage', landing_basis: 'akquise.landing_basis',
  vorlage_nachfass: 'akquise.vorlage_nachfass', referenz: 'akquise.referenz',
};
const ABSENDER_FELDER = ['name', 'zusatz', 'strasse', 'plz_ort', 'telefon', 'email', 'web'];

// Von briefe.js, fuer/[token].js und demo.js mitbenutzt. Fehlt ein Wert,
// gilt der Standard – so laeuft alles auch ohne je gespeicherte Einstellung.
export async function postEinstellungenLaden(env) {
  const { results } = await env.DB.prepare(
    `SELECT schluessel, wert FROM einstellungen WHERE schluessel IN (${Object.keys(SCHLUESSEL).map(() => '?').join(', ')})`,
  ).bind(...Object.values(SCHLUESSEL)).all();
  const werte = {};
  for (const z of results ?? []) werte[z.schluessel] = z.wert;

  let absender = { ...ABSENDER_STANDARD };
  if (werte[SCHLUESSEL.absender]) {
    try { absender = { ...absender, ...absenderSaeubern(JSON.parse(werte[SCHLUESSEL.absender])) }; } catch { /* Standard */ }
  }
  return {
    absender,
    vorlage: werte[SCHLUESSEL.vorlage] || VORLAGE_STANDARD,
    vorlage_nachfass: werte[SCHLUESSEL.vorlage_nachfass] || VORLAGE_NACHFASS,
    referenz: werte[SCHLUESSEL.referenz] || '',
    landing_basis: werte[SCHLUESSEL.landing_basis] || LANDING_BASIS_STANDARD,
  };
}

function absenderSaeubern(roh) {
  const a = {};
  for (const f of ABSENDER_FELDER) {
    if (roh && roh[f] !== undefined) a[f] = String(roh[f] ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }
  return a;
}

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const e = await postEinstellungenLaden(env);
  return json({
    ok: true, ...e, platzhalter: PLATZHALTER,
    standard: { absender: ABSENDER_STANDARD, vorlage: VORLAGE_STANDARD, vorlage_nachfass: VORLAGE_NACHFASS, referenz: '', landing_basis: LANDING_BASIS_STANDARD },
  });
});

export const onRequestPut = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }

  const schreiben = [];
  const setze = (schluessel, wert) => schreiben.push(
    env.DB.prepare(`INSERT INTO einstellungen (schluessel, wert, geaendert) VALUES (?, ?, datetime('now'))
      ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert, geaendert = excluded.geaendert`).bind(schluessel, wert),
  );

  if (body.absender !== undefined) {
    const a = absenderSaeubern(body.absender);
    if (!a.name || !a.strasse || !/^\d{5}\s+\S/.test(a.plz_ort || '')) {
      return json({ ok: false, error: 'Absender braucht Name, Straße und „PLZ Ort“.' }, 400);
    }
    setze(SCHLUESSEL.absender, JSON.stringify(a));
  }
  for (const [feld, name] of [['vorlage', 'Vorlage'], ['vorlage_nachfass', 'Vorlage für den zweiten Brief']]) {
    if (body[feld] === undefined) continue;
    const v = String(body[feld] ?? '').replace(/\r/g, '').trim();
    if (v.length < 20 || v.length > 8000) return json({ ok: false, error: `${name} ist zu kurz oder zu lang (max. 8000 Zeichen).` }, 400);
    // Der Widerspruchsweg im Hinweis steht ueber {link_kurz}/nein.
    if (!/\{link(_kurz)?\}/.test(v)) return json({ ok: false, error: `${name} braucht {link} oder {link_kurz}.` }, 400);
    setze(SCHLUESSEL[feld], v);
  }
  if (body.referenz !== undefined) {
    const r = String(body.referenz ?? '').replace(/\s+/g, ' ').trim();
    if (r.length > 300) return json({ ok: false, error: 'Referenz höchstens 300 Zeichen.' }, 400);
    setze(SCHLUESSEL.referenz, r);
  }
  if (body.landing_basis !== undefined) {
    const b = String(body.landing_basis ?? '').trim();
    if (!/^https:\/\/[a-z0-9.-]+\/[a-z0-9\/-]*$/i.test(b)) return json({ ok: false, error: 'Link-Basis muss mit https:// beginnen, z. B. https://ihsan-yilmaz.de/fuer/' }, 400);
    setze(SCHLUESSEL.landing_basis, b.endsWith('/') ? b : b + '/');
  }
  if (!schreiben.length) return json({ ok: true });
  await env.DB.batch(schreiben);
  return json({ ok: true });
});
