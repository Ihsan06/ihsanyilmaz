// /api/admin/akquise/vorschau — Website-Vorschau eines Betriebs bauen,
// abfragen, loeschen. Die Seite selbst liegt unter /fuer/<token>/website.
//
// GET    ?betrieb_id=      → { ok, vorschau|null, optionen }   (ohne: { ok, vorschauen:[…] })
// POST   { betrieb_id, wunsch?, texte? }
//          wunsch: Steckbrief-Wuensche (palette, logo, symbol, marken[], mischung)
//          texte: 'neu' (Standard) → Claude schreibt; 'behalten' → nur Aussehen
//          30 Tage gueltig → { ok, vorschau, hinweis? }
// DELETE { betrieb_id }    → { ok }
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { fakten, texteSchreiben, vorlagenTexte, LAUFZEIT_TAGE, MODELL } from '../../../_lib/vorschau.js';
import { steckbriefBauen, PALETTEN, SYMBOLE, LOGO_ARTEN } from '../../../_lib/steckbrief.js';
import { fahrzeugAnzeige } from '../../../_lib/fahrzeugpool.js';

const laden = (env, id) => env.DB.prepare('SELECT * FROM akquise_vorschauen WHERE betrieb_id = ?').bind(id).first();
const lesen = s => { try { return JSON.parse(s); } catch { return null; } };
const aufbereiten = z => {
  if (!z) return null;
  const steckbrief = lesen(z.steckbrief);
  const fahrzeuge = (steckbrief?.fahrzeuge || []).map(id => fahrzeugAnzeige(id, z.betrieb_id)).filter(Boolean)
    .map(f => ({ id: f.id, marke: f.marke, modell: f.modell, bild: f.bild }));
  return { ...z, texte: lesen(z.texte), steckbrief, fahrzeuge };
};
const OPTIONEN = {
  paletten: Object.entries(PALETTEN).map(([k, p]) => ({ schluessel: k, ...p })),
  symbole: Object.entries(SYMBOLE).map(([k, s]) => ({ schluessel: k, ...s })),
  logo_arten: Object.entries(LOGO_ARTEN).map(([k, name]) => ({ schluessel: k, name })),
};

export const onRequestGet = nurAngemeldet(async ({ request, env }) => {
  const id = Number(new URL(request.url).searchParams.get('betrieb_id'));
  if (!id) {
    // Ohne betrieb_id: alle Vorschauen in Kurzform (fuer die Liste unter Post).
    const { results } = await env.DB.prepare(
      "SELECT betrieb_id, modell, erstellt, ablauf, aufrufe, zuletzt_aufgerufen, ablauf > datetime('now') AS gueltig FROM akquise_vorschauen",
    ).all();
    return json({ ok: true, vorschauen: results ?? [] });
  }
  const b = await env.DB.prepare('SELECT marken FROM akquise_betriebe WHERE id = ?').bind(id).first();
  return json({ ok: true, vorschau: aufbereiten(await laden(env, id)), optionen: OPTIONEN, marken_betrieb: b?.marken || '' });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.betrieb_id);
  if (!id) return json({ ok: false, error: 'betrieb_id fehlt.' }, 400);
  const b = await env.DB.prepare('SELECT id, name, ort, art, marken, website, oeffnungszeiten, geloescht FROM akquise_betriebe WHERE id = ?').bind(id).first();
  if (!b) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);

  const alt = await laden(env, id);
  const wunsch = body.wunsch && typeof body.wunsch === 'object' ? body.wunsch : {};
  const steckbrief = await steckbriefBauen(b, wunsch, lesen(alt?.steckbrief));
  // Die Marken aus dem Steckbrief gelten auch fuer die Texte.
  const f = { ...fakten(b), marken: steckbrief.marken };

  let texte = body.texte === 'behalten' && alt ? lesen(alt.texte) : null;
  let modell = texte ? alt.modell : MODELL, hinweis = null;
  if (!texte) {
    try {
      texte = await texteSchreiben(env, f);
    } catch (e) {
      texte = vorlagenTexte(f);
      modell = 'vorlage';
      hinweis = `Claude nicht verfügbar (${String(e?.message || e).slice(0, 160)}) – Standardtexte verwendet.`;
    }
  }

  await env.DB.prepare(
    `INSERT INTO akquise_vorschauen (betrieb_id, texte, modell, steckbrief, erstellt, ablauf)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+${LAUFZEIT_TAGE} days'))
     ON CONFLICT(betrieb_id) DO UPDATE SET texte = excluded.texte, modell = excluded.modell, steckbrief = excluded.steckbrief,
       erstellt = excluded.erstellt, ablauf = excluded.ablauf`,
  ).bind(id, JSON.stringify(texte), modell, JSON.stringify(steckbrief)).run();
  return json({ ok: true, vorschau: aufbereiten(await laden(env, id)), hinweis });
});

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.betrieb_id);
  if (!id) return json({ ok: false, error: 'betrieb_id fehlt.' }, 400);
  await env.DB.prepare('DELETE FROM akquise_vorschauen WHERE betrieb_id = ?').bind(id).run();
  return json({ ok: true });
});
