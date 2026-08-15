// /api/admin/dokument — Dokumentenarchiv (Rechnungen, Belege, Verträge, Behördenpost)
//
// Gleiche Bauart wie die Galerie (bild.js): Dateien privat in R2 (Binding BILDER)
// unter dem Präfix "dokumente/", Verzeichnis in D1, Auslieferung nur über diese
// Funktion — nie über eine öffentliche Bucket-Adresse.
import { json, nurAngemeldet, istAngemeldet } from '../../_lib/auth.js';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB je Dokument
// iOS liefert je nach Quelle (Fotos, Dateien-App, Teilen-Menü) mal HEIC, mal einen
// leeren MIME-Typ. Deshalb: bekannte MIME-Typen ODER bekannte Datei-Endung genügt.
const ERLAUBTE_TYPEN = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.oasis.opendocument.text',                                  // .odt
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
  'text/csv',
];
const ERLAUBTE_ENDUNGEN = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'docx', 'odt', 'xlsx', 'csv'];
const KATEGORIEN = ['Rechnung', 'Beleg', 'Vertrag', 'Behörde', 'Sonstiges'];

export function dateiErlaubt(datei) {
  const endung = (datei.name?.split('.').pop() || '').toLowerCase();
  return ERLAUBTE_TYPEN.includes(datei.type) || ERLAUBTE_ENDUNGEN.includes(endung);
}

// GET ohne ?schluessel= : Liste. Mit ?schluessel= : die Datei selbst (Download).
export async function onRequestGet({ request, env }) {
  if (!(await istAngemeldet(request, env))) {
    return json({ ok: false, error: 'Nicht angemeldet.' }, 401);
  }

  const url = new URL(request.url);
  const schluessel = url.searchParams.get('schluessel');

  if (schluessel) {
    if (!env.BILDER) return json({ ok: false, error: 'Dateispeicher nicht verbunden.' }, 503);
    if (!schluessel.startsWith('dokumente/')) {
      return json({ ok: false, error: 'Ungültiger Schlüssel.' }, 400);
    }
    const objekt = await env.BILDER.get(schluessel);
    if (!objekt) return json({ ok: false, error: 'Dokument nicht gefunden.' }, 404);

    // Ursprünglichen Dateinamen für den Download mitgeben
    const eintrag = env.DB
      ? await env.DB.prepare('SELECT dateiname FROM dokumente WHERE schluessel = ?')
          .bind(schluessel).first().catch(() => null)
      : null;
    const name = (eintrag?.dateiname || 'dokument').replace(/[^\w.\- ]/g, '_');

    return new Response(objekt.body, {
      headers: {
        'Content-Type': objekt.httpMetadata?.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${name}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  }

  if (!env.DB) return json({ ok: false, error: 'Datenbank ist nicht verbunden.' }, 500);

  try {
    const { results } = await env.DB.prepare(
      `SELECT schluessel, dateiname, kategorie, notiz, groesse, typ, erstellt_am
       FROM dokumente ORDER BY erstellt_am DESC LIMIT 300`,
    ).all();
    return json({ ok: true, dokumente: results ?? [], speicherVerbunden: Boolean(env.BILDER) });
  } catch (e) {
    return json({ ok: false, error: `Datenbankfehler: ${e.message}` }, 500);
  }
}

// Upload als multipart/form-data: Felder "datei", optional "kategorie" und "notiz"
export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  if (!env.BILDER) return json({ ok: false, error: 'Dateispeicher nicht verbunden.' }, 503);

  const form = await request.formData();
  const datei = form.get('datei');
  if (!datei || typeof datei === 'string') {
    return json({ ok: false, error: 'Keine Datei erhalten.' }, 400);
  }
  if (!dateiErlaubt(datei)) {
    return json({ ok: false, error: `Dateityp nicht unterstützt (${datei.type || 'unbekannt'} / ${datei.name}). Erlaubt: PDF, Bilder, Word/ODT, Excel, CSV.` }, 415);
  }
  if (datei.size > MAX_BYTES) {
    return json({ ok: false, error: 'Dokument ist größer als 15 MB.' }, 413);
  }

  const kategorieRoh = String(form.get('kategorie') || '');
  const kategorie = KATEGORIEN.includes(kategorieRoh) ? kategorieRoh : 'Sonstiges';
  const notiz = String(form.get('notiz') || '').slice(0, 500) || null;

  const endung = (datei.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
  const schluessel = `dokumente/${crypto.randomUUID()}.${endung}`;

  await env.BILDER.put(schluessel, datei.stream(), {
    httpMetadata: { contentType: datei.type },
  });

  await env.DB.prepare(
    `INSERT INTO dokumente (schluessel, dateiname, kategorie, notiz, groesse, typ)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(schluessel, datei.name.slice(0, 200), kategorie, notiz, datei.size, datei.type).run();

  return json({ ok: true, schluessel });
});

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  const { schluessel } = await request.json();
  if (!schluessel?.startsWith('dokumente/')) {
    return json({ ok: false, error: 'Ungültiger Schlüssel.' }, 400);
  }

  if (env.BILDER) await env.BILDER.delete(schluessel);
  await env.DB.prepare('DELETE FROM dokumente WHERE schluessel = ?').bind(schluessel).run();

  return json({ ok: true });
});
