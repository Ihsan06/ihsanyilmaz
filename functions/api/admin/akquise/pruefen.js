// /api/admin/akquise/pruefen — Website eines Betriebs pruefen und bewerten.
//
// POST  { id }               → Website + Wayback serverseitig pruefen, Zeile in
//                              akquise_pruefungen, Scores am Betrieb.
// PATCH { id, psi:{leistung,lcp,cls} } → PageSpeed-Werte an die letzte Pruefung
//                              schreiben und Scores neu rechnen. PSI holt der
//                              Browser selbst: die Antwort ist gross, das
//                              Parsen wuerde hier die CPU-Grenze reissen.
// GET   ?id=                 → letzte 5 Pruefungen, roh und signale geparst.
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { betriebPruefen, bewerten } from '../../../_lib/akquise.js';

const SPALTEN = [
  'erreichbar', 'https', 'viewport', 'cms', 'baukasten', 'jquery', 'copyright_jahr',
  'impressum', 'datenschutz', 'schema_org', 'fahrzeuge_eigen', 'boersen_link',
  'psi_leistung', 'psi_lcp', 'psi_cls', 'wayback_erster', 'wayback_letzter', 'wayback_anzahl',
  'titel', 'generator', 'antwort_ms', 'groesse_kb', 'fehler',
];

const parse = (s, leer) => { if (!s) return leer; try { return JSON.parse(s); } catch { return leer; } };

async function betriebLaden(env, id) {
  return env.DB.prepare('SELECT * FROM akquise_betriebe WHERE id = ?').bind(id).first();
}

// Gleicher Name mehrfach in der Tabelle → mehrere Standorte.
async function mehrfach(env, betrieb) {
  const z = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM akquise_betriebe WHERE lower(name) = lower(?) AND id != ?',
  ).bind(betrieb.name, betrieb.id).first();
  return Number(z?.n || 0) > 0;
}

async function scoresSchreiben(env, id, bew) {
  await env.DB.prepare(
    `UPDATE akquise_betriebe SET score_website = ?, score_betrieb = ?, prioritaet = ?,
       geprueft_am = datetime('now'), geaendert = datetime('now') WHERE id = ?`,
  ).bind(bew.score_website, bew.score_betrieb, bew.prioritaet, id).run();
}

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  const betrieb = await betriebLaden(env, id);
  if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);

  let ergebnis;
  try {
    ergebnis = await betriebPruefen(betrieb, { mehrfach: await mehrfach(env, betrieb) });
  } catch (e) {
    return json({ ok: false, error: `Prüfung fehlgeschlagen: ${String(e?.message || e).slice(0, 200)}` });
  }
  const { pruefung, score_website, score_betrieb, prioritaet, signale } = ergebnis;

  const { meta } = await env.DB.prepare(
    `INSERT INTO akquise_pruefungen (betrieb_id, ${SPALTEN.join(', ')}, signale, roh)
     VALUES (?, ${SPALTEN.map(() => '?').join(', ')}, ?, ?)`,
  ).bind(id, ...SPALTEN.map(s => pruefung[s] ?? null), JSON.stringify(signale), JSON.stringify(pruefung.roh ?? {})).run();
  await scoresSchreiben(env, id, { score_website, score_betrieb, prioritaet });

  return json({
    ok: true,
    pruefung: { id: meta?.last_row_id, betrieb_id: id, zeitpunkt: new Date().toISOString().slice(0, 19).replace('T', ' '), ...pruefung },
    score_website, score_betrieb, prioritaet, signale,
  });
});

export const onRequestPatch = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const psi = body?.psi || {};
  const leistung = Number(psi.leistung);
  if (!Number.isFinite(leistung) || leistung < 0 || leistung > 100) return json({ ok: false, error: 'PageSpeed-Wert fehlt.' }, 400);
  const lcp = Number.isFinite(Number(psi.lcp)) ? Number(psi.lcp) : null;
  const cls = Number.isFinite(Number(psi.cls)) ? Number(psi.cls) : null;

  const betrieb = await betriebLaden(env, id);
  if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
  const letzte = await env.DB.prepare(
    'SELECT * FROM akquise_pruefungen WHERE betrieb_id = ? ORDER BY zeitpunkt DESC, id DESC LIMIT 1',
  ).bind(id).first();
  if (!letzte) return json({ ok: false, error: 'Noch keine Prüfung vorhanden.' }, 404);

  const pruefung = { ...letzte, psi_leistung: Math.round(leistung), psi_lcp: lcp, psi_cls: cls };
  const bew = bewerten(betrieb, pruefung, parse(letzte.roh, {}), { mehrfach: await mehrfach(env, betrieb) });

  await env.DB.batch([
    env.DB.prepare('UPDATE akquise_pruefungen SET psi_leistung = ?, psi_lcp = ?, psi_cls = ?, signale = ? WHERE id = ?')
      .bind(pruefung.psi_leistung, lcp, cls, JSON.stringify(bew.signale), letzte.id),
    env.DB.prepare('UPDATE akquise_betriebe SET score_website = ?, score_betrieb = ?, prioritaet = ?, geaendert = datetime(\'now\') WHERE id = ?')
      .bind(bew.score_website, bew.score_betrieb, bew.prioritaet, id),
  ]);

  return json({
    ok: true,
    pruefung: { ...pruefung, signale: bew.signale, roh: parse(letzte.roh, {}) },
    score_website: bew.score_website, score_betrieb: bew.score_betrieb, prioritaet: bew.prioritaet, signale: bew.signale,
  });
});

export const onRequestGet = nurAngemeldet(async ({ request, env }) => {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const { results } = await env.DB.prepare(
    'SELECT * FROM akquise_pruefungen WHERE betrieb_id = ? ORDER BY zeitpunkt DESC, id DESC LIMIT 5',
  ).bind(id).all();
  const pruefungen = (results ?? []).map(p => ({ ...p, signale: parse(p.signale, []), roh: parse(p.roh, {}) }));
  return json({ ok: true, pruefungen });
});
