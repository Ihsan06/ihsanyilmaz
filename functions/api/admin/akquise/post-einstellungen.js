// /api/admin/akquise/post-einstellungen — Absender, Briefvorlage, Link-Basis.
//
// Liegt in der Tabelle einstellungen (schluessel/wert):
//   akquise.absender      JSON { name, zusatz, strasse, plz_ort, telefon, email, web }
//   akquise.vorlage       Text mit Platzhaltern
//   akquise.landing_basis z. B. https://ihsan-yilmaz.de/fuer/
//
// GET → { ok, absender, vorlage, landing_basis, platzhalter, standard:{…} }
// PUT { absender?, vorlage?, landing_basis? } → { ok }
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { ABSENDER_STANDARD, VORLAGE_STANDARD, LANDING_BASIS_STANDARD, PLATZHALTER } from '../../../_lib/brief.js';

const SCHLUESSEL = { absender: 'akquise.absender', vorlage: 'akquise.vorlage', landing_basis: 'akquise.landing_basis' };
const ABSENDER_FELDER = ['name', 'zusatz', 'strasse', 'plz_ort', 'telefon', 'email', 'web'];

// Von briefe.js, fuer/[token].js und demo.js mitbenutzt. Fehlt ein Wert,
// gilt der Standard – so laeuft alles auch ohne je gespeicherte Einstellung.
export async function postEinstellungenLaden(env) {
  const { results } = await env.DB.prepare(
    'SELECT schluessel, wert FROM einstellungen WHERE schluessel IN (?, ?, ?)',
  ).bind(SCHLUESSEL.absender, SCHLUESSEL.vorlage, SCHLUESSEL.landing_basis).all();
  const werte = {};
  for (const z of results ?? []) werte[z.schluessel] = z.wert;

  let absender = { ...ABSENDER_STANDARD };
  if (werte[SCHLUESSEL.absender]) {
    try { absender = { ...absender, ...absenderSaeubern(JSON.parse(werte[SCHLUESSEL.absender])) }; } catch { /* Standard */ }
  }
  return {
    absender,
    vorlage: werte[SCHLUESSEL.vorlage] || VORLAGE_STANDARD,
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
    standard: { absender: ABSENDER_STANDARD, vorlage: VORLAGE_STANDARD, landing_basis: LANDING_BASIS_STANDARD },
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
  if (body.vorlage !== undefined) {
    const v = String(body.vorlage ?? '').replace(/\r/g, '').trim();
    if (v.length < 20 || v.length > 8000) return json({ ok: false, error: 'Vorlage ist zu kurz oder zu lang (max. 8000 Zeichen).' }, 400);
    if (!v.includes('{link}')) return json({ ok: false, error: 'Vorlage braucht den Platzhalter {link}.' }, 400);
    setze(SCHLUESSEL.vorlage, v);
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
