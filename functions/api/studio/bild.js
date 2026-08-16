// Bilder hochladen – nur fuer Angemeldete (siehe _middleware.js daneben).
//
//   POST   /api/admin/bild        multipart mit Feld "datei"  -> { pfad: "/bilder/…" }
//   DELETE /api/admin/bild?pfad=  entfernt ein hochgeladenes Bild
//
// Ablage: Cloudflare R2, Bucket "diezmann-bilder", Speicherklasse Standard.
//
// KOSTENBREMSE – bewusst mehrfach abgesichert:
//   1. Harte Obergrenze fuer den Gesamtspeicher (GRENZE_GESAMT). Der Gratis-
//      Rahmen liegt bei 10 GB; hier wird schon vorher dichtgemacht, damit
//      niemand versehentlich in die Abrechnung rutscht.
//   2. Obergrenze je Datei – ein einzelnes Fahrzeugfoto braucht keine 5 MB.
//   3. Nur Bildformate. Kein Ablageplatz fuer beliebige Dateien.
// Gezaehlt wird in D1 (Tabelle bilder), weil R2 die Gesamtgroesse zur
// Laufzeit nicht verraet. Loeschen bucht wieder ab.
//
// Ausgeliefert wird NICHT ueber eine oeffentliche R2-Adresse, sondern ueber
// functions/bilder/[name].js auf der eigenen Domain. Sonst wuerde der
// Browser des Besuchers einen fremden Server kontaktieren – genau das, was
// diese Website bewusst vermeidet (deshalb braucht sie kein Cookie-Banner).

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};
const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });

export const GRENZE_GESAMT = 9.5 * 1024 * 1024 * 1024;  // 9,5 GB – Sicherheitsabstand zu 10
export const GRENZE_DATEI  = 5 * 1024 * 1024;           // 5 MB je Bild

export const TYPEN = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp'
};

export async function onRequestPost({ request, env }) {
  if (!env.BILDER) return antwort({ ok: false, fehler: 'Bildspeicher nicht verbunden.' }, 503);

  let datei, formular;
  try {
    formular = await request.formData();
    datei = formular.get('datei');
  } catch (err) {
    console.error('Bild formData:', err);
    return antwort({ ok: false, fehler: 'Datei konnte nicht gelesen werden '
      + `(${String(err && err.message || err).slice(0, 120)}).` }, 400);
  }
  if (!datei || typeof datei === 'string') {
    // Mit Befund statt blind: WAS kam an? Ohne das laesst sich ein Fehl-
    // schlag, der nur in der Produktionsumgebung auftritt, nicht eingrenzen.
    const felder = [...formular.keys()].join(', ') || 'keine Felder';
    const art = datei === null ? 'fehlt' : typeof datei;
    console.error('Bild ohne Datei:', felder, art, request.headers.get('content-type'));
    return antwort({ ok: false, fehler:
      `Keine Datei erhalten (Felder: ${felder}; datei: ${art}).` }, 400);
  }

  const endung = TYPEN[datei.type];
  if (!endung) {
    return antwort({ ok: false, fehler: 'Nur JPG, PNG oder WebP.' }, 400);
  }
  if (datei.size > GRENZE_DATEI) {
    return antwort({
      ok: false,
      fehler: `Das Bild ist ${mb(datei.size)} groß – erlaubt sind ${mb(GRENZE_DATEI)}.`
    }, 400);
  }

  // Vor dem Schreiben pruefen, nicht danach. Sonst liegt die Datei schon im
  // Speicher, wenn die Grenze auffaellt.
  const belegt = await belegung(env);
  if (belegt + datei.size > GRENZE_GESAMT) {
    return antwort({
      ok: false,
      fehler: `Speicher voll (${gb(belegt)} von ${gb(GRENZE_GESAMT)} belegt). Bitte alte Bilder löschen.`
    }, 507);
  }

  const schluessel = `${zufall()}.${endung}`;
  try {
    await env.BILDER.put(schluessel, datei.stream(), {
      httpMetadata: { contentType: datei.type, cacheControl: 'public, max-age=31536000, immutable' }
    });
    await env.DB?.prepare(
      'INSERT INTO studio_bilder (schluessel, groesse, typ, angelegt) VALUES (?, ?, ?, ?)'
    ).bind(schluessel, datei.size, datei.type, new Date().toISOString()).run();

    return antwort({ ok: true, pfad: '/bilder/' + schluessel, groesse: datei.size });
  } catch (err) {
    console.error('Bild hochladen:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!env.BILDER) return antwort({ ok: false, fehler: 'Bildspeicher nicht verbunden.' }, 503);

  const pfad = new URL(request.url).searchParams.get('pfad') || '';
  const schluessel = pfad.replace(/^\/bilder\//, '');
  // Nur eigene Schluessel – kein Pfadwechsel in fremde Ablagen.
  if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(schluessel)) {
    return antwort({ ok: false, fehler: 'Unbekanntes Bild.' }, 400);
  }

  try {
    await env.BILDER.delete(schluessel);
    await env.DB?.prepare('DELETE FROM studio_bilder WHERE schluessel = ?').bind(schluessel).run();
    return antwort({ ok: true });
  } catch (err) {
    console.error('Bild loeschen:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 500);
  }
}

// Wie viel liegt schon da? Faellt die Buchhaltung aus, wird der Upload
// abgelehnt statt durchgewunken – im Zweifel lieber nichts schreiben, als
// die Grenze ungeprueft zu ueberschreiten.
export async function belegung(env) {
  if (!env.DB) throw new Error('Speicherstand nicht pruefbar.');
  const z = await env.DB.prepare('SELECT COALESCE(SUM(groesse), 0) AS summe FROM studio_bilder').first();
  return Number(z?.summe || 0);
}

export function zufall() {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export const mb = n => (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
export const gb = n => (n / 1024 / 1024 / 1024).toFixed(2).replace('.', ',') + ' GB';
