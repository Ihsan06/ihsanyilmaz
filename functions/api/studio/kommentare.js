// Kommentare zu einem Instagram-Beitrag lesen und beantworten.
//
//   GET  /api/admin/kommentare?media=<id>   liefert die Kommentare mit Antworten
//   POST /api/admin/kommentare              { kommentar, text }  antwortet
//   POST /api/admin/kommentare              { kommentar, verbergen }  blendet aus
//
// Moeglich ist das durch instagram_business_manage_comments – die Berechtigung
// steckt im Anwendungsfall "Messaging und Content auf Instagram verwalten"
// und war schon da.
//
// Antworten gehen oeffentlich unter dem Namen des Kontos raus. Deshalb macht
// dieser Endpunkt nichts von sich aus: er schreibt nur, was ihm als Text
// uebergeben wird, und die Adminseite fragt vorher nach.

const KOPF = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, private'
};

const BASIS = 'https://graph.instagram.com';
const FELDER = 'id,text,timestamp,username,like_count,hidden';

export async function onRequestGet({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  const media = new URL(request.url).searchParams.get('media') || '';
  if (!/^\d+$/.test(media)) return antwort({ ok: false, fehler: 'Kein Beitrag angegeben.' }, 400);

  const token = await tokenHolen(db, env);
  if (!token) return antwort({ ok: false, fehler: 'Kein Zugriffstoken hinterlegt.' }, 400);

  try {
    // replies gleich mitholen: eine Antwort ist Teil des Gespraechs, und ein
    // zweiter Abruf je Kommentar waere bei zwanzig Kommentaren zwanzig Abrufe.
    const d = await fragen(
      `${BASIS}/${media}/comments?fields=${FELDER},replies{${FELDER}}` +
      `&limit=50&access_token=${enc(token)}`
    );
    const kommentare = (d.data || []).map(k => ({
      ...aufbereiten(k),
      antworten: ((k.replies && k.replies.data) || []).map(aufbereiten)
    }));
    return antwort({ ok: true, kommentare });
  } catch (err) {
    console.error('Kommentare lesen:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 502);
  }
}

export async function onRequestPost({ env, request }) {
  const db = env.DB;
  if (!db) return antwort({ ok: false, fehler: 'Keine Datenbank verbunden.' }, 500);

  let d;
  try { d = await request.json(); } catch { d = null; }
  const kommentar = d && d.kommentar ? String(d.kommentar) : '';
  if (!/^\d+$/.test(kommentar)) return antwort({ ok: false, fehler: 'Kein Kommentar angegeben.' }, 400);

  const token = await tokenHolen(db, env);
  if (!token) return antwort({ ok: false, fehler: 'Kein Zugriffstoken hinterlegt.' }, 400);

  try {
    if (d.verbergen !== undefined) {
      await fragen(`${BASIS}/${kommentar}?hide=${d.verbergen ? 'true' : 'false'}` +
        `&access_token=${enc(token)}`, 'POST');
      return antwort({ ok: true, verborgen: !!d.verbergen });
    }

    const text = String(d.text || '').trim().slice(0, 2200);
    if (!text) return antwort({ ok: false, fehler: 'Ohne Text keine Antwort.' }, 400);

    const a = await fragen(
      `${BASIS}/${kommentar}/replies?message=${enc(text)}&access_token=${enc(token)}`, 'POST'
    );
    return antwort({ ok: true, id: a.id || null });
  } catch (err) {
    console.error('Kommentar schreiben:', err);
    return antwort({ ok: false, fehler: String(err.message || err) }, 502);
  }
}

// ─── Kleinkram ───

const aufbereiten = k => ({
  id: k.id,
  text: k.text || '',
  wer: k.username || '',
  zeitpunkt: k.timestamp || '',
  likes: Number.isFinite(Number(k.like_count)) ? Number(k.like_count) : null,
  verborgen: !!k.hidden
});

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
