// POST /api/admin/veroeffentlichen – stellt einen Beitrag auf Instagram ein.
//
//   { bilder: ["https://…/bilder/….jpg", …], text: "…", format: "beitrag"|"story" }
//
// Zwei Schritte, so verlangt es Meta: erst einen Container anlegen, dann
// veroeffentlichen. Dazwischen laedt Instagram das Bild von unserem Server –
// deshalb muessen die Adressen oeffentlich erreichbar sein und auf die eigene
// Domain zeigen. Fremde Adressen lehnt dieser Endpunkt ab: was hier
// hinausgeht, soll aus unserem eigenen Bestand kommen und nicht aus einem
// Feld, das jemand von aussen fuellt.
//
// Bei mehreren Bildern wird daraus eine Galerie: je Bild ein Kindcontainer,
// darueber ein Sammelcontainer. Stories nehmen genau ein Bild.
//
// Reels bleiben aussen vor – dafuer braucht es eine Videodatei, und Videos
// entstehen bei uns nicht am Rechner, sondern am Telefon.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const BASIS = 'https://graph.instagram.com';
const MAX_BILDER = 10;          // Metas Grenze fuer eine Galerie
const WARTEN_MS = 1500;         // zwischen Container und Veroeffentlichen
const VERSUCHE = 8;             // so oft wird der Container nachgefragt

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  if (!d) return antwort({ ok: false, fehler: 'Nichts erhalten.' }, 400);

  const eigene = new URL(request.url).origin;
  const bilder = (Array.isArray(d.bilder) ? d.bilder : [])
    .map(String)
    .filter(u => u.startsWith(eigene + '/bilder/'));

  if (!bilder.length) {
    return antwort({ ok: false, fehler: 'Keine gültigen Bilder übergeben.' }, 400);
  }
  // Lieber ablehnen als stillschweigend kuerzen. Frueher stand hier ein
  // .slice(0, MAX_BILDER) und die Antwort war trotzdem ok – wer zwoelf Bilder
  // ausgewaehlt hatte, bekam zehn gepostet und erfuhr es nie. Die Oberflaeche
  // begrenzt die Auswahl nicht, der Fall tritt also wirklich ein.
  if (bilder.length > MAX_BILDER) {
    return antwort({ ok: false, fehler:
      `Instagram nimmt höchstens ${MAX_BILDER} Bilder je Beitrag – ausgewählt sind ${bilder.length}.` }, 400);
  }

  const text = String(d.text || '').slice(0, 2200);   // Metas Grenze fuer die Bildunterschrift
  const story = d.format === 'story';
  if (story && bilder.length > 1) {
    return antwort({ ok: false, fehler: 'Eine Story nimmt genau ein Bild.' }, 400);
  }

  const token = await tokenHolen(db, env);
  if (!token) return antwort({ ok: false, fehler: 'Kein Zugriffstoken hinterlegt.' }, 400);

  try {
    const id = await kontoId(token);
    const container = story
      ? await anlegen(id, token, { image_url: bilder[0], media_type: 'STORIES' })
      : (bilder.length === 1
        ? await anlegen(id, token, { image_url: bilder[0], caption: text })
        : await galerie(id, token, bilder, text));

    await fertig(container, token);
    const beitrag = await fragen(
      `${BASIS}/${id}/media_publish?creation_id=${enc(container)}&access_token=${enc(token)}`,
      'POST'
    );
    if (!beitrag || !beitrag.id) throw new Error('Instagram hat keine Beitrags-ID zurückgegeben.');

    // Der Weg zum fertigen Beitrag – damit die Adminseite gleich hinzeigen kann.
    let weg = '';
    try {
      const m = await fragen(`${BASIS}/${beitrag.id}?fields=permalink&access_token=${enc(token)}`);
      weg = m.permalink || '';
    } catch { /* der Beitrag steht trotzdem */ }

    return antwort({ ok: true, id: beitrag.id, weg });
  } catch (err) {
    console.error('Veroeffentlichen:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 502);
  }
}

// ─── Container ───

async function anlegen(id, token, felder) {
  const teile = Object.entries(felder).map(([k, v]) => `${k}=${enc(v)}`).join('&');
  const d = await fragen(`${BASIS}/${id}/media?${teile}&access_token=${enc(token)}`, 'POST');
  if (!d || !d.id) throw new Error('Instagram hat keinen Container angelegt.');
  return d.id;
}

async function galerie(id, token, bilder, text) {
  const kinder = [];
  for (const u of bilder) {
    kinder.push(await anlegen(id, token, { image_url: u, is_carousel_item: 'true' }));
  }
  return anlegen(id, token, {
    media_type: 'CAROUSEL',
    children: kinder.join(','),
    caption: text
  });
}

// Instagram laedt das Bild erst herunter, nachdem der Container angelegt ist.
// Wer sofort veroeffentlicht, bekommt "Media ID is not available". Also
// nachfragen, bis der Container fertig ist – und aufhoeren, wenn er scheitert.
async function fertig(container, token) {
  for (let i = 0; i < VERSUCHE; i++) {
    const d = await fragen(
      `${BASIS}/${container}?fields=status_code,status&access_token=${enc(token)}`
    );
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') {
      throw new Error(d.status || `Instagram konnte das Bild nicht verarbeiten (${d.status_code}).`);
    }
    await new Promise(r => setTimeout(r, WARTEN_MS));
  }
  throw new Error('Instagram hat das Bild nicht rechtzeitig verarbeitet. Bitte noch einmal versuchen.');
}

// ─── Kleinkram ───

async function kontoId(token) {
  const d = await fragen(`${BASIS}/me?fields=user_id&access_token=${enc(token)}`);
  const id = d.user_id || d.id;
  if (!id) throw new Error('Das Konto ließ sich nicht bestimmen.');
  return id;
}

async function fragen(url, methode = 'GET') {
  const a = await fetch(url, { method: methode, headers: { Accept: 'application/json' } });
  const d = await a.json().catch(() => null);
  if (!a.ok || (d && d.error)) {
    const e = d && d.error;
    const teile = [e && e.error_user_msg, e && e.message].filter(Boolean);
    throw new Error(teile.join(' · ') || `Instagram antwortete mit ${a.status}.`);
  }
  return d || {};
}

async function tokenHolen(db, env) {
  const z = await db.prepare('SELECT wert FROM studio_zugaenge WHERE name = ?').bind('instagram').first();
  return (z && z.wert) || env.INSTAGRAM_TOKEN || null;
}

const enc = encodeURIComponent;
const antwort = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: KOPF });
