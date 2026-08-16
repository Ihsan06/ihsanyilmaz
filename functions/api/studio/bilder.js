// GET /api/bilder?ids=1,2,3 – die vollen Bildlisten mehrerer Fahrzeuge.
//
// Warum es das gibt: die Suchschnittstelle von mobile.de liefert je Anzeige
// nur das Titelbild. Auf den Karten laesst sich damit nichts durchblaettern.
// Die komplette Galerie steht erst im Detail-Abruf je Anzeige.
//
// Deshalb holt die Seite die Bilder NACH dem Laden hier nach, statt sie beim
// Rendern abzuwarten: die Seite ist sofort da, die Pfeile erscheinen einen
// Moment spaeter. Faellt der Abruf aus, bleibt es beim Titelbild – kein
// Fehler, nur keine Pfeile.
//
// Kosten im Blick: ein Aufruf je Fahrzeug, hoechstens zwoelf pro Anfrage,
// und die Antwort haengt eine Stunde im Cache. Damit bleibt die Zahl der
// Abrufe bei mobile.de in derselben Groessenordnung wie die Detailseiten.

import { mobileHeaders, extractImages, DEMO_ADS } from './vehicles.js';

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=86400'
};

const MAX = 12;

export async function onRequestGet({ request, env }) {
  const roh = new URL(request.url).searchParams.get('ids') || '';
  // Nur Ziffern – die Kennungen von mobile.de sind Zahlen.
  const ids = [...new Set(roh.split(',').map(s => s.trim()).filter(s => /^\d{1,20}$/.test(s)))].slice(0, MAX);
  if (!ids.length) return antwort({});

  const live = env.MOBILE_API_USER && env.MOBILE_API_PASSWORD;

  if (!live) {
    const bilder = {};
    ids.forEach(id => {
      const ad = DEMO_ADS.find(a => String(a.mobileAdId) === id);
      if (ad) bilder[id] = extractImages(ad);
    });
    return antwort(bilder);
  }

  // Parallel, aber jeder Abruf fuer sich: ein Ausfall kostet nur dieses eine
  // Fahrzeug seine Galerie.
  const paare = await Promise.all(ids.map(async id => {
    try {
      const r = await fetch(`https://services.mobile.de/search-api/ad/${encodeURIComponent(id)}`, {
        headers: mobileHeaders(env)
      });
      if (!r.ok) return null;
      const daten = await r.json();
      const ad = daten?.ad ?? daten?.['search-result']?.ads?.ad ?? daten;
      const bilder = extractImages(ad);
      return bilder.length > 1 ? [id, bilder] : null;
    } catch {
      return null;
    }
  }));

  return antwort(Object.fromEntries(paare.filter(Boolean)));
}

function antwort(bilder) {
  return new Response(JSON.stringify({ ok: true, bilder }), { headers: KOPF });
}
