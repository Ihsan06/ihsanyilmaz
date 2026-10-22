// /api/admin/akquise/vorschau — Website-Vorschau eines Betriebs bauen,
// abfragen, loeschen. Die Seite selbst liegt unter /fuer/<token>/website.
//
// GET    ?betrieb_id=      → { ok, vorschau|null }   (ohne: { ok, vorschauen:[…] })
// POST   { betrieb_id }    → Texte von Claude schreiben lassen (sonst Vorlage),
//                             30 Tage gueltig → { ok, vorschau, hinweis? }
// DELETE { betrieb_id }    → { ok }
import { json, nurAngemeldet } from '../../../_lib/auth.js';
import { fakten, texteSchreiben, vorlagenTexte, LAUFZEIT_TAGE, MODELL } from '../../../_lib/vorschau.js';

const laden = (env, id) => env.DB.prepare('SELECT * FROM akquise_vorschauen WHERE betrieb_id = ?').bind(id).first();
const aufbereiten = z => {
  if (!z) return null;
  let texte = null;
  try { texte = JSON.parse(z.texte); } catch { /* kaputt */ }
  return { ...z, texte };
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
  return json({ ok: true, vorschau: aufbereiten(await laden(env, id)) });
});

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.betrieb_id);
  if (!id) return json({ ok: false, error: 'betrieb_id fehlt.' }, 400);
  const b = await env.DB.prepare('SELECT id, name, ort, art, marken, oeffnungszeiten, geloescht FROM akquise_betriebe WHERE id = ?').bind(id).first();
  if (!b) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);

  const f = fakten(b);
  let texte, modell = MODELL, hinweis = null;
  try {
    texte = await texteSchreiben(env, f);
  } catch (e) {
    texte = vorlagenTexte(f);
    modell = 'vorlage';
    hinweis = `Claude nicht verfügbar (${String(e?.message || e).slice(0, 160)}) – Standardtexte verwendet.`;
  }

  await env.DB.prepare(
    `INSERT INTO akquise_vorschauen (betrieb_id, texte, modell, erstellt, ablauf)
     VALUES (?, ?, ?, datetime('now'), datetime('now', '+${LAUFZEIT_TAGE} days'))
     ON CONFLICT(betrieb_id) DO UPDATE SET texte = excluded.texte, modell = excluded.modell,
       erstellt = excluded.erstellt, ablauf = excluded.ablauf`,
  ).bind(id, JSON.stringify(texte), modell).run();
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
