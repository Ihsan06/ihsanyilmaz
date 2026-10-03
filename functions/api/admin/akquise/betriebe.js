// /api/admin/akquise/betriebe — Liste, Aenderungen, manuell anlegen,
// Papierkorb.
//
// GET  ?papierkorb=1&suche=&minPrio=
//   → { ok, betriebe:[ …Spalten, signale (letzte Pruefung, geparst),
//                      letzte_pruefung:{…}|null ] }   (max. 1500)
//   Geloeschte sind standardmaessig ausgeblendet; papierkorb=1 zeigt NUR sie.
// PATCH  { id, auswahl?, kategorie?, status?, notiz?, website?, website_quelle? }
//   website: neue Adresse → website_quelle 'manuell'; leer/null → verwerfen
//   (website und website_quelle NULL). website_quelle 'bestaetigt' allein →
//   die vermutete/Google-Adresse bestaetigen.
// POST   { name, website?, ort?, plz?, telefon? }  → quelle 'manuell'
// POST   { id, aktion:'wiederherstellen' }         → aus dem Papierkorb
// DELETE { id }                    → in den Papierkorb (geloescht = jetzt)
// DELETE { alle:true, endgueltig:true } → Papierkorb leeren (ohne Betriebe mit verschickten Briefen)
// POST { aktion:'alle_wiederherstellen' } → ganzen Papierkorb zurueckholen
// Endgueltig Geloeschtes bleibt als Quellschluessel in akquise_ausgeschlossen –
// sonst legte der naechste Suchlauf den Betrieb wieder an.
// DELETE { id, endgueltig:true }   → wirklich loeschen, Pruefungen mit
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { websiteNormalisieren, kategorieOhnePruefung, kategorieErmitteln, KATEGORIEN, jsonLesen, betriebLaden, letztePruefungLaden, pruefungNeuBewerten } from '../../../_lib/akquise.js';

export const ERLAUBTE_STATUS = ['neu', 'beobachten', 'brief', 'kontakt', 'kunde', 'aus'];

// Die letzte Pruefung je Betrieb kommt per Unterabfrage mit – spart einen
// zweiten Roundtrip und bleibt ueber den Index schnell.
const LISTE = `SELECT b.*,
    p.zeitpunkt AS p_zeitpunkt, p.erreichbar AS p_erreichbar, p.https AS p_https,
    p.viewport AS p_viewport, p.cms AS p_cms, p.baukasten AS p_baukasten,
    p.copyright_jahr AS p_copyright_jahr, p.psi_leistung AS p_psi_leistung,
    p.psi_lcp AS p_psi_lcp, p.psi_cls AS p_psi_cls,
    p.wayback_erster AS p_wayback_erster, p.wayback_letzter AS p_wayback_letzter,
    p.wayback_anzahl AS p_wayback_anzahl,
    p.fehler AS p_fehler, p.signale AS p_signale,
    -- Brief-Stand fuer die Markierung in der Liste (Testbriefe zaehlen nicht)
    (SELECT MAX(gesendet_am) FROM akquise_briefe WHERE betrieb_id = b.id AND art != 'test' AND status IN ('gesendet', 'zugestellt')) AS brief_gesendet,
    (SELECT COUNT(*) FROM akquise_briefe WHERE betrieb_id = b.id AND art != 'test' AND status IN ('entwurf', 'freigegeben')) AS brief_entwurf
  FROM akquise_betriebe b
  LEFT JOIN akquise_pruefungen p ON p.id = (
    SELECT id FROM akquise_pruefungen WHERE betrieb_id = b.id ORDER BY zeitpunkt DESC, id DESC LIMIT 1
  )`;

export const onRequestGet = nurAngemeldet(async ({ request, env }) => {
  const q = new URL(request.url).searchParams;
  // Zusammengefuehrte Dubletten sind auch geloescht, gehoeren aber nicht in
  // den Papierkorb – wiederherstellen waere dort falsch.
  const wo = [q.get('papierkorb') === '1' ? 'b.geloescht IS NOT NULL AND b.zusammengefuehrt_in IS NULL' : 'b.geloescht IS NULL'];
  const werte = [];

  const suche = (q.get('suche') || '').trim().slice(0, 80);
  if (suche) {
    const muster = '%' + suche.replace(/[\\%_]/g, '\\$&') + '%';
    wo.push("(b.name LIKE ? ESCAPE '\\' OR b.ort LIKE ? ESCAPE '\\')");
    werte.push(muster, muster);
  }
  const minPrio = Number(q.get('minPrio'));
  if (Number.isFinite(minPrio) && minPrio > 0) { wo.push('b.prioritaet >= ?'); werte.push(minPrio); }

  const sql = `${LISTE} WHERE ${wo.join(' AND ')} ORDER BY (b.prioritaet IS NULL), b.prioritaet DESC, b.name COLLATE NOCASE LIMIT 1500`;
  const { results } = await env.DB.prepare(sql).bind(...werte).all();

  // Zeilen aus Runde 1 haben noch keine Kategorie: ohne Website bzw. mit
  // Boersen-Adresse steht sie ohne Pruefung fest, bei einer erreichbaren
  // Pruefung folgt sie aus Score und Signalen – einmalig nachgetragen,
  // damit Filter und Kennzahlen stimmen, ohne alles neu zu pruefen.
  const nachtragen = [];
  const betriebe = (results ?? []).map(z => {
    const b = {};
    for (const [k, v] of Object.entries(z)) if (!k.startsWith('p_')) b[k] = v;
    b.signale = jsonLesen(z.p_signale, []);
    if (!Array.isArray(b.signale)) b.signale = [];
    if (!b.kategorie) {
      let k = kategorieOhnePruefung(b.website);
      if (!k && z.p_erreichbar && b.score_website !== null && b.score_website !== undefined) {
        k = kategorieErmitteln(b, b.signale, b.score_website);
      }
      if (k) { b.kategorie = k; nachtragen.push([b.id, k]); }
    }
    b.letzte_pruefung = z.p_zeitpunkt ? {
      zeitpunkt: z.p_zeitpunkt, erreichbar: z.p_erreichbar, https: z.p_https, viewport: z.p_viewport,
      cms: z.p_cms, baukasten: z.p_baukasten, copyright_jahr: z.p_copyright_jahr,
      psi_leistung: z.p_psi_leistung, psi_lcp: z.p_psi_lcp, psi_cls: z.p_psi_cls,
      wayback_erster: z.p_wayback_erster, wayback_letzter: z.p_wayback_letzter, wayback_anzahl: z.p_wayback_anzahl,
      fehler: z.p_fehler,
    } : null;
    return b;
  });
  if (nachtragen.length) {
    const st = env.DB.prepare('UPDATE akquise_betriebe SET kategorie = ? WHERE id = ? AND kategorie IS NULL');
    for (let i = 0; i < nachtragen.length; i += 40) await env.DB.batch(nachtragen.slice(i, i + 40).map(([id, k]) => st.bind(k, id)));
  }
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
  const antwort = {};

  if (body.status !== undefined) {
    if (!ERLAUBTE_STATUS.includes(body.status)) return json({ ok: false, error: 'Unbekannter Status.' }, 400);
    setze('status', body.status);
  }
  if (body.auswahl !== undefined) setze('auswahl', body.auswahl ? 1 : 0);
  if (body.kategorie !== undefined) {
    if (body.kategorie !== null && !KATEGORIEN.includes(body.kategorie)) return json({ ok: false, error: 'Unbekannte Kategorie.' }, 400);
    setze('kategorie', body.kategorie);
  }
  if (body.notiz !== undefined) setze('notiz', body.notiz === null ? null : String(body.notiz).slice(0, 4000));
  // Anschrift von Hand: leer = unbekannt; PLZ nur fuenfstellig.
  for (const feld of ['strasse', 'plz', 'ort']) {
    if (body[feld] === undefined) continue;
    const wert = String(body[feld] ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
    if (feld === 'plz' && wert && !/^\d{5}$/.test(wert)) return json({ ok: false, error: 'PLZ muss fünfstellig sein.' }, 400);
    setze(feld, wert); antwort[feld] = wert;
  }

  // Nach Bestaetigen oder Verwerfen werden die Signale der letzten Pruefung
  // neu gerechnet (der Chip "Website geraten" soll verschwinden). Eine neue
  // Adresse von Hand setzt die Scores zurueck – der Browser prueft gleich.
  let neuRechnen = false;

  // Fahrzeuge und Gruendungsjahr: leer = unbekannt; beides fliesst sofort in
  // die Staerke ein.
  const ganzeZahl = (wert, min, max) => {
    if (wert === null || wert === '') return null;
    const n = Number(wert);
    return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
  };
  if (body.fahrzeuge !== undefined) {
    const n = ganzeZahl(body.fahrzeuge, 0, 100000);
    if (n === undefined) return json({ ok: false, error: 'Fahrzeuganzahl ungültig.' }, 400);
    setze('fahrzeuge', n); antwort.fahrzeuge = n; neuRechnen = true;
  }
  if (body.gruendungsjahr !== undefined) {
    const n = ganzeZahl(body.gruendungsjahr, 1850, new Date().getFullYear());
    if (n === undefined) return json({ ok: false, error: 'Gründungsjahr ungültig.' }, 400);
    setze('gruendungsjahr', n); antwort.gruendungsjahr = n; neuRechnen = true;
  }
  if (body.website !== undefined) {
    const roh = String(body.website ?? '').trim();
    const website = roh ? websiteNormalisieren(roh) : null;
    if (roh && !website) return json({ ok: false, error: 'Website-Adresse ungültig.' }, 400);
    const alt = await env.DB.prepare('SELECT website FROM akquise_betriebe WHERE id = ?').bind(id).first();
    if (!alt) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
    if ((alt.website || null) !== website) {
      setze('website', website);
      setze('website_quelle', website ? 'manuell' : null);
      setze('kategorie', kategorieOhnePruefung(website));
      antwort.website = website;
      antwort.website_quelle = website ? 'manuell' : null;
      antwort.kategorie = kategorieOhnePruefung(website);
      if (website) { setze('score_website', null); setze('score_betrieb', null); setze('prioritaet', null); setze('geprueft_am', null); }
      else neuRechnen = true;
    }
  } else if (body.website_quelle !== undefined) {
    if (body.website_quelle !== 'bestaetigt') return json({ ok: false, error: 'Nur „bestaetigt“ ist erlaubt.' }, 400);
    setze('website_quelle', 'bestaetigt');
    antwort.website_quelle = 'bestaetigt';
    neuRechnen = true;
  }
  if (!felder.length) return json({ ok: true });

  felder.push("geaendert = datetime('now')");
  werte.push(id);
  const { meta } = await env.DB.prepare(`UPDATE akquise_betriebe SET ${felder.join(', ')} WHERE id = ?`).bind(...werte).run();
  if (!meta?.changes) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);

  if (neuRechnen) {
    const betrieb = await betriebLaden(env, id);
    const letzte = betrieb ? await letztePruefungLaden(env, id) : null;
    if (betrieb && letzte) {
      const e = await pruefungNeuBewerten(env, betrieb, letzte, {});
      Object.assign(antwort, { signale: e.signale, score_website: e.score_website, score_betrieb: e.score_betrieb, prioritaet: e.prioritaet, kategorie: e.kategorie ?? null });
    }
  }
  return json({ ok: true, ...antwort });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }

  // Ganzen Papierkorb zurueckholen. Zusammengefuehrte Dubletten sind zwar
  // auch "geloescht", gehoeren aber nicht dazu und bleiben unsichtbar.
  if (body?.aktion === 'alle_wiederherstellen') {
    const { meta } = await env.DB.prepare(
      "UPDATE akquise_betriebe SET geloescht = NULL, geaendert = datetime('now') WHERE geloescht IS NOT NULL AND zusammengefuehrt_in IS NULL",
    ).run();
    return json({ ok: true, wiederhergestellt: Number(meta?.changes || 0) });
  }

  if (body?.aktion === 'wiederherstellen') {
    const id = Number(body?.id);
    if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
    const { meta } = await env.DB.prepare(
      "UPDATE akquise_betriebe SET geloescht = NULL, geaendert = datetime('now') WHERE id = ?",
    ).bind(id).run();
    if (!meta?.changes) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
    return json({ ok: true });
  }

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
    `INSERT INTO akquise_betriebe (quelle, quelle_id, name, website, website_quelle, kategorie, ort, plz, telefon, region)
     VALUES ('manuell', ?, ?, ?, ?, ?, ?, ?, ?, 'manuell')`,
  ).bind(quelleId, name, website, website ? 'manuell' : null, kategorieOhnePruefung(website),
    leerZuNull(body?.ort), leerZuNull(body?.plz), leerZuNull(body?.telefon)).run();
  return json({ ok: true, id: meta?.last_row_id });
});

// Quellschluessel der Betriebe aus "ids" (Unterabfrage) festhalten: OSM-ID
// bzw. Google-ID des Eintrags und die verknuepfte Place-ID.
function ausschliessen(env, ids, werte = []) {
  return [
    env.DB.prepare(`INSERT OR IGNORE INTO akquise_ausgeschlossen (quelle, quelle_id)
      SELECT quelle, quelle_id FROM akquise_betriebe WHERE id IN (${ids}) AND quelle IN ('osm', 'google') AND quelle_id IS NOT NULL`).bind(...werte),
    env.DB.prepare(`INSERT OR IGNORE INTO akquise_ausgeschlossen (quelle, quelle_id)
      SELECT 'google', google_place_id FROM akquise_betriebe WHERE id IN (${ids}) AND google_place_id IS NOT NULL`).bind(...werte),
  ];
}

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  // Papierkorb leeren: alles endgueltig weg, ausser Betrieben mit
  // verschickten Briefen (deren persoenliche Seite braucht den Eintrag).
  // Mengenweise in einem Batch – bindet keine IDs, passt also fuer jede Groesse.
  if (body?.alle === true && body?.endgueltig === true) {
    const imKorb = `SELECT id FROM akquise_betriebe b WHERE b.geloescht IS NOT NULL AND b.zusammengefuehrt_in IS NULL
      AND NOT EXISTS (SELECT 1 FROM akquise_briefe br WHERE br.betrieb_id = b.id AND br.status IN ('gesendet', 'zugestellt'))`;
    const vorher = await env.DB.prepare('SELECT COUNT(*) AS n FROM akquise_betriebe WHERE geloescht IS NOT NULL AND zusammengefuehrt_in IS NULL').first();
    const erg = await env.DB.batch([
      ...ausschliessen(env, imKorb),
      env.DB.prepare(`DELETE FROM akquise_pruefungen WHERE betrieb_id IN (${imKorb})`),
      env.DB.prepare(`DELETE FROM akquise_betriebe WHERE id IN (${imKorb})`),
    ]);
    const geloescht = Number(erg.at(-1)?.meta?.changes || 0);
    const behalten = Math.max(0, Number(vorher?.n || 0) - geloescht);
    return json({ ok: true, geloescht, behalten });
  }

  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);

  if (body.endgueltig === true) {
    // Verschickte Briefe verweisen mit ihrer persoenlichen Seite auf den
    // Betrieb – der bleibt, bis die Briefe unter Post geloescht sind.
    const offen = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM akquise_briefe WHERE betrieb_id = ? AND status IN ('gesendet', 'zugestellt')",
    ).bind(id).first();
    if (Number(offen?.n || 0) > 0) return json({ ok: false, error: 'Zu diesem Betrieb gibt es verschickte Briefe – erst unter Post löschen.' }, 409);
    await env.DB.batch([
      ...ausschliessen(env, 'SELECT ?', [id]),
      env.DB.prepare('DELETE FROM akquise_pruefungen WHERE betrieb_id = ?').bind(id),
      env.DB.prepare('DELETE FROM akquise_betriebe WHERE id = ?').bind(id),
    ]);
    return json({ ok: true, endgueltig: true });
  }
  const { meta } = await env.DB.prepare(
    "UPDATE akquise_betriebe SET geloescht = datetime('now'), geaendert = datetime('now') WHERE id = ? AND geloescht IS NULL",
  ).bind(id).run();
  if (!meta?.changes) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
  return json({ ok: true });
});
