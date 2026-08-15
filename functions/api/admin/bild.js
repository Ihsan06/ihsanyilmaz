// /api/admin/bild — Bilder der Galerie
//
// Ablage: Cloudflare R2 (Binding "BILDER"). Gezählt wird zusätzlich in D1
// (Tabelle "bilder"), weil R2 die Gesamtgröße nicht günstig abfragen lässt.
// Ausgeliefert wird NICHT über eine öffentliche R2-Adresse, sondern über
// diese Funktion — so bleibt der Bucket privat.
//
// Solange kein R2-Bucket verbunden ist, meldet die Galerie das sauber
// und der Rest des Adminbereichs läuft normal weiter.
import { json, nurAngemeldet, istAngemeldet } from '../../_lib/auth.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB pro Bild
const ERLAUBTE_TYPEN = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

// GET ohne ?schluessel= : Liste. Mit ?schluessel= : das Bild selbst.
export async function onRequestGet({ request, env }) {
  if (!(await istAngemeldet(request, env))) {
    return json({ ok: false, error: 'Nicht angemeldet.' }, 401);
  }

  const url = new URL(request.url);
  const schluessel = url.searchParams.get('schluessel');

  if (schluessel) {
    if (!env.BILDER) return json({ ok: false, error: 'Bildspeicher nicht verbunden.' }, 503);
    const objekt = await env.BILDER.get(schluessel);
    if (!objekt) return json({ ok: false, error: 'Bild nicht gefunden.' }, 404);
    return new Response(objekt.body, {
      headers: {
        'Content-Type': objekt.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  if (!env.DB) return json({ ok: false, error: 'Datenbank ist nicht verbunden.' }, 500);

  try {
    const { results } = await env.DB.prepare(
      `SELECT schluessel, dateiname, groesse, typ, erstellt_am
       FROM bilder ORDER BY erstellt_am DESC LIMIT 300`,
    ).all();
    const bilder = results ?? [];
    const summe = bilder.reduce((s, b) => s + Number(b.groesse || 0), 0);
    return json({ ok: true, bilder, summeBytes: summe, speicherVerbunden: Boolean(env.BILDER) });
  } catch (e) {
    return json({ ok: false, error: `Datenbankfehler: ${e.message}` }, 500);
  }
}

// Upload als multipart/form-data mit Feld "datei"
export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  if (!env.BILDER) return json({ ok: false, error: 'Bildspeicher nicht verbunden.' }, 503);

  const form = await request.formData();
  const datei = form.get('datei');
  if (!datei || typeof datei === 'string') {
    return json({ ok: false, error: 'Keine Datei erhalten.' }, 400);
  }
  if (!ERLAUBTE_TYPEN.includes(datei.type)) {
    return json({ ok: false, error: 'Nur JPG, PNG, WebP oder AVIF.' }, 415);
  }
  if (datei.size > MAX_BYTES) {
    return json({ ok: false, error: 'Bild ist größer als 8 MB.' }, 413);
  }

  // Dateiname niemals ungeprüft als Schlüssel verwenden — sonst ließe sich
  // über "../" aus dem Bilderbereich ausbrechen.
  const endung = (datei.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const schluessel = `galerie/${crypto.randomUUID()}.${endung}`;

  await env.BILDER.put(schluessel, datei.stream(), {
    httpMetadata: { contentType: datei.type },
  });

  await env.DB.prepare(
    'INSERT INTO bilder (schluessel, dateiname, groesse, typ) VALUES (?, ?, ?, ?)',
  ).bind(schluessel, datei.name.slice(0, 200), datei.size, datei.type).run();

  return json({ ok: true, schluessel });
});

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  const { schluessel } = await request.json();
  if (!schluessel) return json({ ok: false, error: 'Schlüssel fehlt.' }, 400);

  if (env.BILDER) await env.BILDER.delete(schluessel);
  await env.DB.prepare('DELETE FROM bilder WHERE schluessel = ?').bind(schluessel).run();

  return json({ ok: true });
});
