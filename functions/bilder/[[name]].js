// GET /bilder/<schluessel> – liefert ein hochgeladenes Bild aus R2 aus.
//
// Bewusst ueber die eigene Domain statt ueber eine oeffentliche R2-Adresse:
// so kontaktiert der Browser des Besuchers keinen fremden Server, und der
// Bucket bleibt komplett privat.
//
// Zwei Schluessel-Muster, weil hier zwei Welten zusammenlaufen:
//   <24 Hex>.<endung>            – Uploads des Content-Studios (Bucket-Wurzel)
//   galerie/<uuid>.<endung>      – die schon vorhandene Admin-Galerie
// Deshalb ein Sammelpfad ([[name]]) statt eines einzelnen Segments – die
// Galerie-Schluessel enthalten einen Schraegstrich.

const MUSTER = [
  /^[a-f0-9]{24}\.(jpg|png|webp)$/,
  /^galerie\/[a-f0-9-]{36}\.[a-z0-9]{1,5}$/,
];

export async function onRequestGet({ params, env }) {
  const teile = Array.isArray(params.name) ? params.name : [params.name];
  const schluessel = teile.join('/');

  // Nur die Muster, die die Uploads vergeben. Alles andere gar nicht erst
  // nachschlagen – schuetzt vor Rateversuchen und Pfadtricks.
  if (!MUSTER.some(m => m.test(schluessel))) {
    return new Response('Nicht gefunden', { status: 404 });
  }

  if (!env.BILDER) return new Response('Bildspeicher nicht verbunden', { status: 503 });

  const objekt = await env.BILDER.get(schluessel);
  if (!objekt) return new Response('Nicht gefunden', { status: 404 });

  const kopf = new Headers();
  objekt.writeHttpMetadata(kopf);
  kopf.set('etag', objekt.httpEtag);
  // Der Dateiname wechselt bei jeder neuen Datei, der Inhalt aendert sich
  // nie – deshalb darf sehr lange zwischengespeichert werden. Das haelt
  // zugleich die Zugriffe auf R2 niedrig.
  kopf.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(objekt.body, { headers: kopf });
}
