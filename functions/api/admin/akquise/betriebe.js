// /api/admin/akquise/betriebe — Liste, Status/Notiz/Website aendern,
// manuell anlegen, loeschen.
//
// GET ?status=&suche=&minPrio=&nurWebsite=1&sortierung=prioritaet|name|geprueft
//   → { ok, betriebe:[ …Spalten, signale (letzte Pruefung, geparst),
//                      letzte_pruefung:{…}|null ] }   (max. 1000)
// PATCH  { id, status?, notiz?, website? }
// POST   { name, website?, ort?, plz?, telefon? }  → quelle 'manuell'
// DELETE { id }  (Pruefungen mit)
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { websiteNormalisieren } from '../../../_lib/akquise.js';

export const ERLAUBTE_STATUS = ['neu', 'beobachten', 'brief', 'kontakt', 'kunde', 'aus'];

const SORTIERUNG = {
  prioritaet: '(b.prioritaet IS NULL), b.prioritaet DESC, b.name COLLATE NOCASE',
  name: 'b.name COLLATE NOCASE',
  geprueft: '(b.geprueft_am IS NULL), b.geprueft_am DESC, b.name COLLATE NOCASE',
};

// Die letzte Pruefung je Betrieb kommt per Unterabfrage mit – spart einen
// zweiten Roundtrip und bleibt bei 1000 Zeilen ueber den Index schnell.
const LISTE = `SELECT b.*,
    p.zeitpunkt AS p_zeitpunkt, p.erreichbar AS p_erreichbar, p.https AS p_https,
    p.viewport AS p_viewport, p.cms AS p_cms, p.baukasten AS p_baukasten,
    p.copyright_jahr AS p_copyright_jahr, p.psi_leistung AS p_psi_leistung,
    p.psi_lcp AS p_psi_lcp, p.psi_cls AS p_psi_cls,
    p.wayback_erster AS p_wayback_erster, p.wayback_letzter AS p_wayback_letzter,
    p.fehler AS p_fehler, p.signale AS p_signale
  FROM akquise_betriebe b
  LEFT JOIN akquise_pruefungen p ON p.id = (
    SELECT id FROM akquise_pruefungen WHERE betrieb_id = b.id ORDER BY zeitpunkt DESC, id DESC LIMIT 1
  )`;

function signaleParsen(s) {
  if (!s) return [];
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { return []; }
}

export const onRequestGet = nurAngemeldet(async ({ request, env }) => {
  const q = new URL(request.url).searchParams;
  const wo = [];
  const werte = [];

  const status = q.get('status');
  if (status && ERLAUBTE_STATUS.includes(status)) { wo.push('b.status = ?'); werte.push(status); }

  const suche = (q.get('suche') || '').trim().slice(0, 80);
  if (suche) {
    const muster = '%' + suche.replace(/[\\%_]/g, '\\$&') + '%';
    wo.push("(b.name LIKE ? ESCAPE '\\' OR b.ort LIKE ? ESCAPE '\\')");
    werte.push(muster, muster);
  }

  const minPrio = Number(q.get('minPrio'));
  if (Number.isFinite(minPrio) && minPrio > 0) { wo.push('b.prioritaet >= ?'); werte.push(minPrio); }

  if (q.get('nurWebsite') === '1') wo.push('b.website IS NOT NULL');

  const sortierung = SORTIERUNG[q.get('sortierung')] || SORTIERUNG.prioritaet;
  const sql = `${LISTE} ${wo.length ? 'WHERE ' + wo.join(' AND ') : ''} ORDER BY ${sortierung} LIMIT 1000`;
  const { results } = await env.DB.prepare(sql).bind(...werte).all();

  const betriebe = (results ?? []).map(z => {
    const b = {};
    for (const [k, v] of Object.entries(z)) if (!k.startsWith('p_')) b[k] = v;
    b.signale = signaleParsen(z.p_signale);
    b.letzte_pruefung = z.p_zeitpunkt ? {
      zeitpunkt: z.p_zeitpunkt, erreichbar: z.p_erreichbar, https: z.p_https, viewport: z.p_viewport,
      cms: z.p_cms, baukasten: z.p_baukasten, copyright_jahr: z.p_copyright_jahr,
      psi_leistung: z.p_psi_leistung, psi_lcp: z.p_psi_lcp, psi_cls: z.p_psi_cls,
      wayback_erster: z.p_wayback_erster, wayback_letzter: z.p_wayback_letzter, fehler: z.p_fehler,
    } : null;
    return b;
  });
  return json({ ok: true, betriebe });
});

export const onRequestPatch = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  const felder = [];
  const werte = [];
  const setze = (spalte, wert) => { felder.push(`${spalte} = ?`); werte.push(wert); };

  if (body.status !== undefined) {
    if (!ERLAUBTE_STATUS.includes(body.status)) return json({ ok: false, error: 'Unbekannter Status.' }, 400);
    setze('status', body.status);
  }
  if (body.notiz !== undefined) setze('notiz', body.notiz === null ? null : String(body.notiz).slice(0, 4000));
  if (body.website !== undefined) {
    const roh = String(body.website ?? '').trim();
    const website = roh ? websiteNormalisieren(roh) : null;
    if (roh && !website) return json({ ok: false, error: 'Website-Adresse ungültig.' }, 400);
    setze('website', website);
  }
  if (!felder.length) return json({ ok: true });

  felder.push("geaendert = datetime('now')");
  werte.push(id);
  const { meta } = await env.DB.prepare(`UPDATE akquise_betriebe SET ${felder.join(', ')} WHERE id = ?`).bind(...werte).run();
  if (!meta?.changes) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
  return json({ ok: true });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const name = String(body?.name || '').trim().slice(0, 200);
  if (!name) return json({ ok: false, error: 'Name fehlt.' }, 400);

  const rohWebsite = String(body?.website || '').trim();
  const website = rohWebsite ? websiteNormalisieren(rohWebsite) : null;
  if (rohWebsite && !website) return json({ ok: false, error: 'Website-Adresse ungültig.' }, 400);

  const leerZuNull = s => { const t = String(s ?? '').trim().slice(0, 200); return t ? t : null; };
  // Zufaellige ID, damit der eindeutige Index (quelle, quelle_id) auch fuer
  // manuelle Eintraege greift.
  const zufall = new Uint8Array(8);
  crypto.getRandomValues(zufall);
  const quelleId = 'm-' + [...zufall].map(b => b.toString(16).padStart(2, '0')).join('');

  const { meta } = await env.DB.prepare(
    `INSERT INTO akquise_betriebe (quelle, quelle_id, name, website, ort, plz, telefon, region)
     VALUES ('manuell', ?, ?, ?, ?, ?, ?, 'manuell')`,
  ).bind(quelleId, name, website, leerZuNull(body?.ort), leerZuNull(body?.plz), leerZuNull(body?.telefon)).run();
  return json({ ok: true, id: meta?.last_row_id });
});

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM akquise_pruefungen WHERE betrieb_id = ?').bind(id),
    env.DB.prepare('DELETE FROM akquise_betriebe WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
});
