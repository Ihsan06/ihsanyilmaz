// /api/admin/akquise/anschrift — fehlende Anschrift eines Betriebs aus
// OpenStreetMap ergaenzen (Nominatim, Rueckwaertssuche an der Koordinate).
//
// POST { id } → { ok, ergaenzt:{ strasse?, plz?, ort? }, betrieb:{ strasse, plz, ort, anschrift_stand } }
//
// Viele Betriebe sind in OSM nur ein Punkt ohne addr:*-Angaben; das Gebaeude
// darunter hat die Adresse aber meist. Gefuellt wird nur, was fehlt – eine
// von Hand eingetragene Anschrift bleibt stehen. anschrift_stand merkt den
// Versuch, damit der Suchlauf es nicht bei jedem Lauf wiederholt.
// Nominatim erlaubt hoechstens eine Anfrage je Sekunde; den Takt haelt der
// Browser (eine nach der anderen, mit Pause). Daten: © OpenStreetMap-Mitwirkende (ODbL).
import { json, nurAngemeldet } from '../../../_lib/auth.js';

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const UA = 'AIY-Akquise/1.0 (kontakt@ihsan-yilmaz.de)';

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const b = await env.DB.prepare('SELECT id, strasse, plz, ort, lat, lng FROM akquise_betriebe WHERE id = ?').bind(id).first();
  if (!b) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);

  const stand = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const merken = () => env.DB.prepare("UPDATE akquise_betriebe SET anschrift_stand = ?, geaendert = datetime('now') WHERE id = ?").bind(stand, id).run();
  if (b.strasse && b.plz && b.ort) return json({ ok: true, ergaenzt: {}, betrieb: { ...b, anschrift_stand: stand } });
  if (b.lat == null || b.lng == null) { await merken(); return json({ ok: true, ergaenzt: {}, grund: 'keine Koordinate', betrieb: { ...b, anschrift_stand: stand } }); }

  let a;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12_000);
    const r = await fetch(`${NOMINATIM}?lat=${b.lat}&lon=${b.lng}&format=jsonv2&zoom=18&addressdetails=1&accept-language=de`, {
      signal: ac.signal, headers: { 'User-Agent': UA, Accept: 'application/json' },
    }).finally(() => clearTimeout(t));
    if (!r.ok) return json({ ok: false, error: `OpenStreetMap antwortet mit ${r.status}` });
    a = (await r.json())?.address || {};
  } catch (e) {
    return json({ ok: false, error: e?.name === 'AbortError' ? 'OpenStreetMap: Zeitüberschreitung' : 'OpenStreetMap nicht erreichbar.' });
  }

  const strasse = a.road ? [a.road, a.house_number].filter(Boolean).join(' ') : null;
  const plz = /^\d{5}$/.test(String(a.postcode || '')) ? String(a.postcode) : null;
  const ort = a.city || a.town || a.village || a.municipality || null;
  const ergaenzt = {};
  if (!b.strasse && strasse) ergaenzt.strasse = strasse.slice(0, 200);
  if (!b.plz && plz) ergaenzt.plz = plz;
  if (!b.ort && ort) ergaenzt.ort = String(ort).slice(0, 120);

  await env.DB.prepare(
    `UPDATE akquise_betriebe SET strasse = COALESCE(strasse, ?), plz = COALESCE(plz, ?), ort = COALESCE(ort, ?),
       anschrift_stand = ?, geaendert = datetime('now') WHERE id = ?`,
  ).bind(ergaenzt.strasse ?? null, ergaenzt.plz ?? null, ergaenzt.ort ?? null, stand, id).run();
  const neu = await env.DB.prepare('SELECT strasse, plz, ort, anschrift_stand FROM akquise_betriebe WHERE id = ?').bind(id).first();
  return json({ ok: true, ergaenzt, betrieb: neu });
});
