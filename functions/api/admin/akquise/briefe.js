// /api/admin/akquise/briefe — Briefe an Betriebe: Entwurf, PDF, Freigabe,
// Versand ueber LetterXpress, Sperrliste.
//
// GET  ?status=            → { ok, briefe:[…mit betrieb_name/ort/status], zaehler }
// GET  ?id=<id>            → { ok, brief, betrieb, kandidaten }  (ein Brief samt
//                            allen moeglichen Befunden zum Ankreuzen)
// GET  ?pdf=<id>           → das PDF aus R2 (inline)
// GET  ?stand=1            → { ok, eingerichtet, modus, anbieter, guthaben_cent?, preis_cent? }
// GET  ?sperrliste=1       → { ok, sperrliste:[…] }
// GET  ?kandidaten=<betrieb> → { ok, betrieb, kandidaten, gesperrt }  (Vorschau
//                            vor dem Entwurf, legt nichts an)
// POST JSON { betrieb_id, art?, befunde?:[code] }   → Entwurf anlegen
// POST JSON { aktion:'senden', id, test? }          → Versand
// POST JSON { aktion:'status', id }                 → Status beim Anbieter
// POST JSON { aktion:'stornieren', id }             → Storno (15 Minuten)
// POST JSON { aktion:'mailtest', id }               → PDF per E-Mail an mich (Resend),
//                                                     Status bleibt, nichts wird gedruckt
// POST JSON { aktion:'sperren', betrieb_id, grund } / { aktion:'entsperren', id }
// POST multipart (pdf, id)                          → PDF nach R2
// PATCH { id, text?, befunde?, empfaenger?, status? }
// DELETE { id }
//
// Der Ablauf: Entwurf (Text, Befunde) → PDF im Browser erzeugt und hochgeladen
// → freigegeben → gesendet (Anbieter) → zugestellt (per Statusabfrage).
// Doppelversand verhindert das UPDATE … WHERE status = 'freigegeben': nur wer
// die Zeile umschaltet, ruft den Anbieter.
import { json, nurAngemeldet, istAngemeldet } from '../../../_lib/auth.js';
import {
  tokenErzeugen, empfaengerBlock, absenderBlock, anschriftVollstaendig,
  befundeAusPruefung, BEFUNDE_BEISPIEL, briefFuellen, landingLink, googleZeile,
} from '../../../_lib/brief.js';
import { boersenName } from '../../../_lib/akquise.js';
import * as lxp from '../../../_lib/letterxpress.js';
import { postEinstellungenLaden } from './post-einstellungen.js';

const STATUS = ['entwurf', 'freigegeben', 'gesendet', 'zugestellt', 'fehler', 'storniert'];
const ARTEN = ['brief', 'nachfass', 'test'];
const PDF_MAX = 3 * 1024 * 1024;
const TEXT_MAX = 8000;

const parse = (s, leer) => { if (!s) return leer; try { return JSON.parse(s); } catch { return leer; } };

function briefAufbereiten(z) {
  if (!z) return null;
  return { ...z, befunde: parse(z.befunde, []) };
}

async function briefLaden(env, id) {
  return briefAufbereiten(await env.DB.prepare('SELECT * FROM akquise_briefe WHERE id = ?').bind(id).first());
}

async function betriebLaden(env, id) {
  return env.DB.prepare('SELECT * FROM akquise_betriebe WHERE id = ?').bind(id).first();
}

// Sperrliste: nach ID und nach Name. Der Name faengt den Fall ab, dass ein
// Betrieb endgueltig geloescht und spaeter aus OSM neu eingelesen wurde –
// der Widerspruch muss trotzdem gelten. Ein Namensvetter wird dabei lieber
// einmal zu viel gesperrt als einmal zu wenig.
async function gesperrt(env, betriebId, name = null) {
  const z = await env.DB.prepare(
    'SELECT id FROM akquise_sperrliste WHERE betrieb_id = ? OR (? IS NOT NULL AND name IS NOT NULL AND lower(name) = lower(?)) LIMIT 1',
  ).bind(betriebId, name, name).first();
  return Boolean(z);
}

// IDs aus Query und Body: ganze Zahl groesser null, sonst 0 (= "fehlt").
const idLesen = roh => { const n = Number(roh); return Number.isInteger(n) && n > 0 ? n : 0; };

// Alle Befunde, die zu diesem Betrieb passen – aus der letzten Pruefung,
// ergaenzt um das, was auch ohne Pruefung feststeht.
async function kandidatenErmitteln(env, betrieb) {
  const p = await env.DB.prepare(
    'SELECT * FROM akquise_pruefungen WHERE betrieb_id = ? ORDER BY zeitpunkt DESC, id DESC LIMIT 1',
  ).bind(betrieb.id).first();
  const signale = parse(p?.signale, []);
  const boerse = boersenName(betrieb.website);
  const liste = befundeAusPruefung(signale, { ...(p || {}), boerse }, { anzahl: 4 });
  const hat = code => liste.some(k => k.code === code);
  if (!betrieb.website && !hat('keine_website')) {
    liste.unshift({ code: 'keine_website', text: befundeAusPruefung([{ code: 'keine_website', seite: 'website', punkte: 100 }])[0].text, punkte: 100, vorgewaehlt: true });
  }
  if (betrieb.kategorie === 'nur_boerse' && !hat('nur_boerse')) {
    liste.unshift({ code: 'nur_boerse', text: befundeAusPruefung([{ code: 'nur_boerse', seite: 'website', punkte: 100 }], { boerse })[0].text, punkte: 100, vorgewaehlt: true });
  }
  // Hoechstens vier vorgewaehlt, auch nach dem Ergaenzen.
  let n = 0;
  for (const k of liste) { if (k.vorgewaehlt) { n++; if (n > 4) k.vorgewaehlt = false; } }
  // Die positive Google-Zeile zaehlt nicht zur Drei-Grenze – sie steht
  // immer zuletzt und spricht fuer den Betrieb.
  const google = googleZeile(betrieb);
  if (google) liste.push({ ...google, punkte: 0, vorgewaehlt: true });
  return liste;
}

function betriebKurz(b) {
  if (!b) return null;
  return {
    id: b.id, name: b.name, strasse: b.strasse, plz: b.plz, ort: b.ort, website: b.website,
    status: b.status, kategorie: b.kategorie, geprueft_am: b.geprueft_am, geloescht: b.geloescht,
    google_stand: b.google_stand, google_bewertung: b.google_bewertung, google_anzahl: b.google_anzahl,
  };
}

// ------------------------------------------------------------------ GET

export async function onRequestGet({ request, env }) {
  if (!(await istAngemeldet(request, env))) return json({ ok: false, error: 'Nicht angemeldet.' }, 401);
  if (!env.DB) return json({ ok: false, error: 'Datenbank ist nicht verbunden.' }, 500);
  const q = new URL(request.url).searchParams;

  try {
    // Das PDF selbst – nur angemeldet, nie ueber eine oeffentliche Adresse.
    if (q.get('pdf')) {
      const brief = await briefLaden(env, idLesen(q.get('pdf')));
      if (!brief?.pdf_schluessel) return json({ ok: false, error: 'Kein PDF hinterlegt.' }, 404);
      if (!env.BILDER) return json({ ok: false, error: 'Dateispeicher nicht verbunden.' }, 503);
      const objekt = await env.BILDER.get(brief.pdf_schluessel);
      if (!objekt) return json({ ok: false, error: 'PDF nicht gefunden.' }, 404);
      return new Response(objekt.body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="brief-${brief.token}.pdf"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    if (q.get('stand') === '1') {
      const eingerichtet = lxp.konfiguriert(env);
      const antwort = { ok: true, eingerichtet, modus: lxp.modus(env), anbieter: 'LetterXpress' };
      if (eingerichtet) {
        const [guthaben, preis] = await Promise.all([lxp.guthabenCent(env), lxp.preisCent(env, 2)]);
        if (guthaben != null) antwort.guthaben_cent = guthaben;
        if (preis != null) antwort.preis_cent = preis;
      }
      return json(antwort);
    }

    if (q.get('sperrliste') === '1') {
      const { results } = await env.DB.prepare(
        `SELECT s.id, s.betrieb_id, COALESCE(s.name, b.name) AS name, b.ort, s.grund, s.angelegt
         FROM akquise_sperrliste s LEFT JOIN akquise_betriebe b ON b.id = s.betrieb_id
         ORDER BY s.angelegt DESC, s.id DESC LIMIT 500`,
      ).all();
      return json({ ok: true, sperrliste: results ?? [] });
    }

    // Vorschau vor dem Entwurf: dieselben Befunde, die ein Entwurf bekaeme,
    // ohne etwas anzulegen – dazu, ob der Betrieb gesperrt ist.
    if (q.get('kandidaten')) {
      const betrieb = await betriebLaden(env, idLesen(q.get('kandidaten')));
      if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
      const [kandidaten, sperre, frueher] = await Promise.all([
        kandidatenErmitteln(env, betrieb), gesperrt(env, betrieb.id, betrieb.name),
        env.DB.prepare("SELECT id, status, art, gesendet_am FROM akquise_briefe WHERE betrieb_id = ? AND art != 'test' ORDER BY id DESC").bind(betrieb.id).all(),
      ]);
      // Damit die Oberflaeche selbst entscheidet: offener Entwurf → oeffnen,
      // schon verschickt → zweiter Brief (Nachfass), sonst erster Brief.
      const briefe = frueher.results ?? [];
      const offen = briefe.find(b => ['entwurf', 'freigegeben', 'fehler'].includes(b.status)) || null;
      const verschickt = briefe.filter(b => ['gesendet', 'zugestellt'].includes(b.status));
      return json({
        ok: true, betrieb: betriebKurz(betrieb), kandidaten, gesperrt: sperre,
        offener_entwurf: offen ? offen.id : null,
        verschickt: verschickt.length, zuletzt_gesendet: verschickt[0]?.gesendet_am || null,
      });
    }

    if (q.get('id')) {
      const brief = await briefLaden(env, idLesen(q.get('id')));
      if (!brief) return json({ ok: false, error: 'Brief nicht gefunden.' }, 404);
      const betrieb = await betriebLaden(env, brief.betrieb_id);
      const kandidaten = betrieb ? await kandidatenErmitteln(env, betrieb) : [];
      return json({ ok: true, brief, betrieb: betriebKurz(betrieb), kandidaten });
    }

    const wo = [];
    const werte = [];
    const status = q.get('status');
    if (status && STATUS.includes(status)) { wo.push('br.status = ?'); werte.push(status); }
    const [liste, zaehler] = await env.DB.batch([
      env.DB.prepare(
        `SELECT br.*, b.name AS betrieb_name, b.ort AS betrieb_ort, b.status AS betrieb_status,
                b.geprueft_am AS betrieb_geprueft_am, b.google_stand AS betrieb_google_stand
         FROM akquise_briefe br LEFT JOIN akquise_betriebe b ON b.id = br.betrieb_id
         ${wo.length ? 'WHERE ' + wo.join(' AND ') : ''}
         ORDER BY br.angelegt DESC, br.id DESC LIMIT 500`,
      ).bind(...werte),
      env.DB.prepare(
        `SELECT status, COUNT(*) AS n, SUM(aufrufe) AS aufrufe, SUM(demo_angefordert IS NOT NULL OR demo_geoeffnet IS NOT NULL) AS demo
         FROM akquise_briefe GROUP BY status`,
      ),
    ]);
    const z = { entwurf: 0, freigegeben: 0, gesendet: 0, zugestellt: 0, fehler: 0, storniert: 0, aufrufe: 0, demo: 0 };
    for (const r of zaehler.results ?? []) {
      z[r.status] = Number(r.n || 0);
      z.aufrufe += Number(r.aufrufe || 0);
      z.demo += Number(r.demo || 0);
    }
    return json({ ok: true, briefe: (liste.results ?? []).map(briefAufbereiten), zaehler: z });
  } catch (e) {
    return json({ ok: false, error: `Datenbankfehler: ${e.message}` }, 500);
  }
}

// ------------------------------------------------------------------ POST

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  const typ = request.headers.get('Content-Type') || '';
  if (typ.includes('multipart/form-data')) return pdfHochladen(request, env);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }

  switch (body?.aktion) {
    case undefined: return entwurfAnlegen(body, env);
    case 'senden': return senden(body, env);
    case 'status': return statusAbfragen(body, env);
    case 'stornieren': return stornieren(body, env);
    case 'mailtest': return mailTest(body, env);
    case 'sperren': return sperren(body, env);
    case 'entsperren': return entsperren(body, env);
    default: return json({ ok: false, error: 'Unbekannte Aktion.' }, 400);
  }
});

async function entwurfAnlegen(body, env) {
  const betriebId = Number(body?.betrieb_id);
  if (!betriebId) return json({ ok: false, error: 'Betrieb fehlt.' }, 400);
  const art = ARTEN.includes(body?.art) ? body.art : 'brief';

  const betrieb = await betriebLaden(env, betriebId);
  if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
  if (betrieb.geloescht) return json({ ok: false, error: 'Betrieb liegt im Papierkorb.' }, 400);
  if (art !== 'test' && await gesperrt(env, betriebId, betrieb.name)) return json({ ok: false, error: 'Auf der Sperrliste.' }, 409);

  const e = await postEinstellungenLaden(env);
  const kandidaten = await kandidatenErmitteln(env, betrieb);

  let befunde;
  if (Array.isArray(body.befunde)) {
    const codes = new Set(body.befunde.map(String));
    befunde = kandidaten.filter(k => codes.has(k.code));
  } else {
    befunde = kandidaten.filter(k => k.vorgewaehlt);
  }
  if (!befunde.length && art === 'test') befunde = BEFUNDE_BEISPIEL;
  befunde = befunde.map(b => ({ code: b.code, text: b.text }));

  // Token so lange wuerfeln, bis er frei ist – bei 36^12 praktisch beim ersten Mal.
  let token = tokenErzeugen();
  for (let i = 0; i < 3; i++) {
    const belegt = await env.DB.prepare('SELECT id FROM akquise_briefe WHERE token = ?').bind(token).first();
    if (!belegt) break;
    token = tokenErzeugen();
  }

  const link = landingLink(e.landing_basis, token);
  const text = briefFuellen(e.vorlage, {
    firma: betrieb.name, ort: betrieb.ort, befunde, link, absender: e.absender,
  });
  const empfaenger = art === 'test' ? absenderBlock(e.absender) : empfaengerBlock(betrieb);

  const { meta } = await env.DB.prepare(
    `INSERT INTO akquise_briefe (betrieb_id, token, status, art, empfaenger, befunde, text)
     VALUES (?, ?, 'entwurf', ?, ?, ?, ?)`,
  ).bind(betriebId, token, art, empfaenger, JSON.stringify(befunde), text).run();

  const brief = await briefLaden(env, meta?.last_row_id);
  return json({ ok: true, brief, betrieb: betriebKurz(betrieb), kandidaten, link });
}

// PDF aus dem Browser (pdf-lib) nach R2 unter akquise/<token>.pdf.
async function pdfHochladen(request, env) {
  if (!env.BILDER) return json({ ok: false, error: 'Dateispeicher nicht verbunden.' }, 503);
  // Groesse schon am Header abweisen – formData() liest sonst den ganzen
  // Body in den Speicher, bevor die Datei ueberhaupt geprueft wird.
  const laenge = Number(request.headers.get('content-length'));
  if (Number.isFinite(laenge) && laenge > PDF_MAX + 4096) return json({ ok: false, error: 'PDF ist größer als 3 MB.' }, 413);
  let form;
  try { form = await request.formData(); } catch { return json({ ok: false, error: 'Ungültiger Upload.' }, 400); }
  const datei = form.get('pdf');
  const id = Number(form.get('id'));
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  if (!datei || typeof datei === 'string') return json({ ok: false, error: 'Kein PDF erhalten.' }, 400);
  if (datei.size > PDF_MAX) return json({ ok: false, error: 'PDF ist größer als 3 MB.' }, 413);
  if (datei.type && datei.type !== 'application/pdf') return json({ ok: false, error: 'Nur PDF.' }, 415);

  const bytes = new Uint8Array(await datei.arrayBuffer());
  const kopf = String.fromCharCode(...bytes.subarray(0, 5));
  if (kopf !== '%PDF-') return json({ ok: false, error: 'Datei ist kein PDF.' }, 415);

  const brief = await briefLaden(env, id);
  if (!brief) return json({ ok: false, error: 'Brief nicht gefunden.' }, 404);
  if (!['entwurf', 'freigegeben', 'fehler'].includes(brief.status)) {
    return json({ ok: false, error: 'PDF lässt sich nur bei Entwürfen ersetzen.' }, 409);
  }

  const schluessel = `akquise/${brief.token}.pdf`;
  await env.BILDER.put(schluessel, bytes, { httpMetadata: { contentType: 'application/pdf' } });
  await env.DB.prepare('UPDATE akquise_briefe SET pdf_schluessel = ? WHERE id = ?').bind(schluessel, id).run();
  return json({ ok: true, pdf_schluessel: schluessel, groesse: bytes.length });
}

// Testversand ohne Post: das PDF als Anhang ans eigene Postfach (wie das
// Kontaktformular: CONTACT_TO, sonst kontakt@). Der Brief bleibt, wie er ist.
async function mailTest(body, env) {
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  if (!env.RESEND_API_KEY) return json({ ok: false, error: 'E-Mail nicht eingerichtet: RESEND_API_KEY fehlt.' }, 400);
  if (!env.BILDER) return json({ ok: false, error: 'Dateispeicher nicht verbunden.' }, 503);
  const brief = await briefLaden(env, id);
  if (!brief) return json({ ok: false, error: 'Brief nicht gefunden.' }, 404);
  if (!brief.pdf_schluessel) return json({ ok: false, error: 'Erst das PDF erzeugen.' }, 409);
  const objekt = await env.BILDER.get(brief.pdf_schluessel);
  if (!objekt) return json({ ok: false, error: 'PDF nicht gefunden.' }, 404);

  const bytes = new Uint8Array(await objekt.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const betrieb = await betriebLaden(env, brief.betrieb_id);
  const name = betrieb?.name || `Betrieb ${brief.betrieb_id}`;
  const an = env.CONTACT_TO || 'kontakt@ihsan-yilmaz.de';
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'Akquise <onboarding@resend.dev>',
        to: an,
        subject: `Testbrief: ${name}`,
        html: `<p>Testversand aus Akquise → Post – nichts wurde gedruckt oder verschickt.</p>
          <p><b>An:</b><br>${esc(brief.empfaenger).replace(/\n/g, '<br>')}</p>
          <p>Das PDF hängt an, so wie es an LetterXpress ginge.</p>`,
        attachments: [{ filename: `brief-${brief.token}.pdf`, content: btoa(bin) }],
      }),
    });
  } catch {
    return json({ ok: false, error: 'E-Mail-Dienst nicht erreichbar.' }, 502);
  }
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    return json({ ok: false, error: `E-Mail ging nicht raus: ${String(d?.message || r.status).slice(0, 160)}` }, 502);
  }
  return json({ ok: true, an });
}

async function senden(body, env) {
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  if (!lxp.konfiguriert(env)) return json({ ok: false, error: lxp.FEHLER_NICHT_EINGERICHTET }, 400);
  if (!env.BILDER) return json({ ok: false, error: 'Dateispeicher nicht verbunden.' }, 503);

  const brief = await briefLaden(env, id);
  if (!brief) return json({ ok: false, error: 'Brief nicht gefunden.' }, 404);
  if (body.test && brief.art !== 'test') return json({ ok: false, error: 'Testversand nur für einen Testbrief an mich.' }, 400);
  if (brief.status !== 'freigegeben') return json({ ok: false, error: 'Nur freigegebene Briefe werden gesendet.' }, 409);
  if (!brief.pdf_schluessel) return json({ ok: false, error: 'Kein PDF hinterlegt.' }, 409);
  if (!anschriftVollstaendig(brief.empfaenger)) return json({ ok: false, error: 'Anschrift unvollständig.' }, 409);
  // Pflichtabgleich vor jedem Versand – auch wenn der Entwurf aelter ist als der Eintrag.
  if (brief.art !== 'test') {
    const betrieb = await betriebLaden(env, brief.betrieb_id);
    if (await gesperrt(env, brief.betrieb_id, betrieb?.name ?? null)) return json({ ok: false, error: 'Auf der Sperrliste.' }, 409);
  }

  // Sperre: nur wer die Zeile von freigegeben auf gesendet schaltet, darf
  // den Anbieter rufen. Ein zweiter Klick bekommt hier 409.
  const { meta } = await env.DB.prepare(
    "UPDATE akquise_briefe SET status = 'gesendet', anbieter = 'LetterXpress', fehler = NULL WHERE id = ? AND status = 'freigegeben'",
  ).bind(id).run();
  if (!meta?.changes) return json({ ok: false, error: 'Brief wird bereits gesendet.' }, 409);

  const fehlgeschlagen = async grund => {
    await env.DB.prepare("UPDATE akquise_briefe SET status = 'fehler', fehler = ? WHERE id = ?").bind(grund.slice(0, 300), id).run();
    return json({ ok: false, error: grund, brief: await briefLaden(env, id) });
  };

  // Ab hier steht die Zeile auf 'gesendet' – jeder Fehler muss sie auf
  // 'fehler' zuruecksetzen, sonst bliebe der Brief ohne Auftrag haengen.
  let a;
  try {
    const objekt = await env.BILDER.get(brief.pdf_schluessel);
    if (!objekt) return fehlgeschlagen('PDF nicht mehr im Speicher – bitte neu erzeugen.');
    const pdfBytes = new Uint8Array(await objekt.arrayBuffer());
    a = await lxp.auftragAnlegen(env, {
      pdfBytes, dateiname: `akquise-${brief.betrieb_id}-${brief.token}.pdf`, notiz: `akquise ${brief.token}`,
    });
  } catch {
    return fehlgeschlagen('Versand abgebrochen: PDF nicht lesbar oder Anbieter nicht erreichbar.');
  }
  if (!a.ok) return fehlgeschlagen(a.fehler || 'Anbieter hat abgelehnt.');

  const schreiben = [
    env.DB.prepare(
      `UPDATE akquise_briefe SET anbieter_id = ?, kosten_cent = ?, gesendet_am = datetime('now'), fehler = NULL WHERE id = ?`,
    ).bind(a.id, a.kosten_cent, id),
  ];
  if (brief.art !== 'test') {
    schreiben.push(env.DB.prepare(
      "UPDATE akquise_betriebe SET status = 'brief', geaendert = datetime('now') WHERE id = ? AND status IN ('neu', 'beobachten')",
    ).bind(brief.betrieb_id));
  }
  await env.DB.batch(schreiben);
  return json({ ok: true, brief: await briefLaden(env, id), anbieter_adresse: a.adresse, anbieter_status: a.status, modus: lxp.modus(env) });
}

async function statusAbfragen(body, env) {
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const brief = await briefLaden(env, id);
  if (!brief) return json({ ok: false, error: 'Brief nicht gefunden.' }, 404);
  if (!brief.anbieter_id) return json({ ok: false, error: 'Noch nicht beim Anbieter.' }, 409);

  const a = await lxp.auftragAbrufen(env, brief.anbieter_id);
  if (!a.ok) return json({ ok: false, error: a.fehler }, 400);

  let neu = brief.status;
  if (a.status === 'canceled') neu = 'storniert';
  else if (a.status === 'done' && (a.itemStatus === 'sent' || !a.itemStatus)) neu = 'zugestellt';

  const felder = [];
  const werte = [];
  if (neu !== brief.status && ['gesendet', 'zugestellt'].includes(brief.status)) {
    felder.push('status = ?'); werte.push(neu);
    if (neu === 'zugestellt') felder.push("zugestellt_am = datetime('now')");
  }
  if (brief.kosten_cent == null && a.kosten_cent != null) { felder.push('kosten_cent = ?'); werte.push(a.kosten_cent); }
  if (felder.length) {
    werte.push(id);
    await env.DB.prepare(`UPDATE akquise_briefe SET ${felder.join(', ')} WHERE id = ?`).bind(...werte).run();
  }
  return json({ ok: true, brief: await briefLaden(env, id), anbieter_status: a.status, item_status: a.itemStatus });
}

async function stornieren(body, env) {
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const brief = await briefLaden(env, id);
  if (!brief) return json({ ok: false, error: 'Brief nicht gefunden.' }, 404);
  if (brief.status !== 'gesendet' || !brief.anbieter_id) return json({ ok: false, error: 'Nur gesendete Briefe lassen sich stornieren.' }, 409);

  const a = await lxp.auftragStornieren(env, brief.anbieter_id);
  if (!a.ok) return json({ ok: false, error: `${a.fehler} – Storno geht nur 15 Minuten nach dem Senden.` }, 400);
  await env.DB.prepare("UPDATE akquise_briefe SET status = 'storniert', fehler = NULL WHERE id = ?").bind(id).run();
  return json({ ok: true, brief: await briefLaden(env, id) });
}

async function sperren(body, env) {
  const betriebId = Number(body?.betrieb_id);
  if (!betriebId) return json({ ok: false, error: 'Betrieb fehlt.' }, 400);
  const betrieb = await betriebLaden(env, betriebId);
  if (!betrieb) return json({ ok: false, error: 'Betrieb nicht gefunden.' }, 404);
  if (await gesperrt(env, betriebId)) return json({ ok: true, bereits: true });
  const grund = String(body?.grund || 'manuell').slice(0, 200);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO akquise_sperrliste (betrieb_id, name, grund) VALUES (?, ?, ?)').bind(betriebId, betrieb.name, grund),
    env.DB.prepare("UPDATE akquise_betriebe SET status = 'aus', geaendert = datetime('now') WHERE id = ?").bind(betriebId),
  ]);
  return json({ ok: true });
}

async function entsperren(body, env) {
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const { meta } = await env.DB.prepare('DELETE FROM akquise_sperrliste WHERE id = ?').bind(id).run();
  if (!meta?.changes) return json({ ok: false, error: 'Eintrag nicht gefunden.' }, 404);
  return json({ ok: true });
}

// ------------------------------------------------------------------ PATCH

export const onRequestPatch = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const brief = await briefLaden(env, id);
  if (!brief) return json({ ok: false, error: 'Brief nicht gefunden.' }, 404);

  const felder = [];
  const werte = [];
  const setze = (spalte, wert) => { felder.push(`${spalte} = ?`); werte.push(wert); };
  let pdfVerwerfen = false;

  const inhaltAendern = body.text !== undefined || body.befunde !== undefined || body.empfaenger !== undefined;
  if (inhaltAendern && brief.status !== 'entwurf') {
    return json({ ok: false, error: 'Text nur im Entwurf änderbar – erst die Freigabe zurücknehmen.' }, 409);
  }
  if (body.text !== undefined) {
    const t = String(body.text ?? '').replace(/\r/g, '');
    if (!t.trim() || t.length > TEXT_MAX) return json({ ok: false, error: 'Text fehlt oder ist zu lang.' }, 400);
    if (t !== brief.text) { setze('text', t); pdfVerwerfen = true; }
  }
  if (body.befunde !== undefined) {
    if (!Array.isArray(body.befunde)) return json({ ok: false, error: 'Befunde müssen eine Liste sein.' }, 400);
    const b = body.befunde.slice(0, 8).map(x => ({ code: String(x?.code || '').slice(0, 40), text: String(x?.text || '').slice(0, 300) })).filter(x => x.text);
    setze('befunde', JSON.stringify(b));
    pdfVerwerfen = true;
  }
  if (body.empfaenger !== undefined) {
    const e = String(body.empfaenger ?? '').replace(/\r/g, '').split('\n').map(z => z.trim()).filter(Boolean).slice(0, 6).join('\n');
    if (!e) return json({ ok: false, error: 'Anschrift fehlt.' }, 400);
    if (e !== brief.empfaenger) { setze('empfaenger', e); pdfVerwerfen = true; }
  }
  if (body.status !== undefined) {
    const neu = body.status;
    const erlaubt =
      (brief.status === 'entwurf' && neu === 'freigegeben') ||
      (brief.status === 'freigegeben' && neu === 'entwurf') ||
      (brief.status === 'fehler' && (neu === 'freigegeben' || neu === 'entwurf')) ||
      (['entwurf', 'freigegeben', 'fehler'].includes(brief.status) && neu === 'storniert');
    if (!erlaubt) return json({ ok: false, error: `Wechsel von ${brief.status} zu ${String(neu).slice(0, 20)} nicht möglich.` }, 409);
    if (neu === 'freigegeben') {
      if (!brief.pdf_schluessel || pdfVerwerfen) return json({ ok: false, error: 'Erst das PDF erzeugen.' }, 409);
      if (!anschriftVollstaendig(brief.empfaenger)) return json({ ok: false, error: 'Anschrift unvollständig: Name, Straße und „PLZ Ort“ nötig.' }, 409);
      if (brief.art !== 'test') {
        const betrieb = await betriebLaden(env, brief.betrieb_id);
        if (await gesperrt(env, brief.betrieb_id, betrieb?.name ?? null)) return json({ ok: false, error: 'Auf der Sperrliste.' }, 409);
      }
    }
    setze('status', neu);
    if (neu !== 'fehler') setze('fehler', null);
  }

  // Ein geaendertes Blatt braucht ein neues PDF – das alte weg, sonst geht
  // spaeter der falsche Text in die Post.
  if (pdfVerwerfen && brief.pdf_schluessel) {
    if (env.BILDER) await env.BILDER.delete(brief.pdf_schluessel).catch(() => {});
    setze('pdf_schluessel', null);
  }
  if (!felder.length) return json({ ok: true, brief });
  werte.push(id);
  await env.DB.prepare(`UPDATE akquise_briefe SET ${felder.join(', ')} WHERE id = ?`).bind(...werte).run();
  return json({ ok: true, brief: await briefLaden(env, id) });
});

// ------------------------------------------------------------------ DELETE

export const onRequestDelete = nurAngemeldet(async ({ request, env }) => {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Ungültiger Body.' }, 400); }
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: 'ID fehlt.' }, 400);
  const brief = await briefLaden(env, id);
  if (!brief) return json({ ok: false, error: 'Brief nicht gefunden.' }, 404);
  if (brief.pdf_schluessel && env.BILDER) await env.BILDER.delete(brief.pdf_schluessel).catch(() => {});
  await env.DB.prepare('DELETE FROM akquise_briefe WHERE id = ?').bind(id).run();
  return json({ ok: true });
});
