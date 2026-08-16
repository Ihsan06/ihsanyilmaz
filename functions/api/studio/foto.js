// GET /api/admin/foto?u=<Bildadresse bei mobile.de>
//
// Reicht ein Fahrzeugfoto durch die eigene Domain. Klingt nach Umweg, ist
// aber der einzige Weg zum Teilen-Knopf: Um Text UND Bilder an Instagram zu
// uebergeben, muss die Seite aus den Bildern Dateien bauen. Dafuer muss sie
// sie lesen duerfen – und ein fremder Server wie img.classistatic.de erlaubt
// das dem Browser nicht (keine CORS-Freigabe). Ueber die eigene Adresse
// geholt, gehoert das Bild zur Seite und laesst sich anfassen.
//
// Nur Bilder von mobile.de, nur fuer Angemeldete (siehe _middleware.js).
// Ohne die Einschraenkung waere das ein offener Weiterleitungsdienst, ueber
// den jeder beliebige Inhalte unter unserer Domain ausliefern koennte.

const ERLAUBT = /^https:\/\/img\.classistatic\.de\//;

export async function onRequestGet({ request }) {
  const u = new URL(request.url).searchParams.get('u') || '';

  if (!ERLAUBT.test(u)) {
    return new Response('Nicht erlaubt', { status: 400 });
  }

  const antwort = await fetch(u, { cf: { cacheEverything: true, cacheTtl: 3600 } });
  if (!antwort.ok) return new Response('Nicht gefunden', { status: 404 });

  const typ = antwort.headers.get('content-type') || '';
  // Der Host liefert nur Bilder – aber verlassen wir uns nicht darauf.
  if (!typ.startsWith('image/')) return new Response('Kein Bild', { status: 415 });

  const kopf = new Headers();
  kopf.set('Content-Type', typ);
  kopf.set('Cache-Control', 'private, max-age=3600');
  return new Response(antwort.body, { headers: kopf });
}
