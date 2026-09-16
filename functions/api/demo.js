// Cloudflare Pages Function — POST /api/demo
//
// „Demo ansehen“ auf der Startseite: Ein Besucher gibt seine E-Mail-Adresse
// an und bekommt die Links zu den Demo-Websites automatisch zugeschickt –
// ohne Zugang zum Verwaltungsbereich. Den zeigt Ihsan persoenlich; die Mail
// bietet dafuer ein kurzes Gespraech an. Jede Anfrage landet ausserdem unter
// „Anfragen“ (Tabelle anfragen), damit nichts untergeht – auch dann, wenn
// der Versand scheitert.
//
// Umgebungsvariablen (Pages-Projekt):
//   RESEND_API_KEY   — wie beim Kontaktformular
//   MAIL_FROM        (optional) — Absender, sobald die Domain bei Resend
//                    bestaetigt ist, z. B. "AIY | Ihsan Yilmaz <kontakt@ihsan-yilmaz.de>".
//                    Ohne sie geht der Test-Absender onboarding@resend.dev
//                    raus – und der darf nur an die eigene Adresse zustellen.
//   CONTACT_TO, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID — wie beim Kontaktformular
//
// Bremsen: je Adresse eine Mail in 24 Stunden, insgesamt hoechstens 30 in
// der Stunde, Honeypot „fax“. Gespeichert werden Adresse, Zeitpunkt, Sprache
// und ob der Versand klappte – keine IP.

const KOPF = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: KOPF });
const esc = s => String(s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const KONTAKT = 'kontakt@ihsan-yilmaz.de';
const SEITE = 'https://ihsan-yilmaz.de';
const JE_STUNDE = 30;
const DEMOS = [
  { name: 'Autohaus-Demo', url: 'https://autohaus-demo.pages.dev' },
  { name: 'Gastro-Demo', url: 'https://gastrodemo.pages.dev' },
];

const TEXTE = {
  de: {
    betreff: 'Ihre Demo-Links – Autohaus und Café',
    hallo: 'Guten Tag,',
    intro: 'hier sind die beiden Demos. Beide Websites sind echt und stehen offen – klicken Sie sich einfach durch.',
    verwaltung: 'Der Verwaltungsbereich ist nicht öffentlich. Gern zeige ich ihn Ihnen in einem kurzen Gespräch: 20 Minuten per Video oder Telefon, ohne Verpflichtung. Antworten Sie einfach auf diese E-Mail mit einem Terminvorschlag.',
    gruss: 'Viele Grüße',
    fuss: 'Sie erhalten diese E-Mail, weil auf ihsan-yilmaz.de ein Demo-Link für diese Adresse angefordert wurde. Falls nicht: einfach ignorieren, es passiert nichts weiter.',
  },
  en: {
    betreff: 'Your demo links – car dealer and café',
    hallo: 'Hello,',
    intro: 'here are the two demos. Both websites are real and open – just click through.',
    verwaltung: 'The admin area is not public. I am happy to show it to you in a short call: 20 minutes by video or phone, no obligation. Simply reply to this email with a time that suits you.',
    gruss: 'Best regards',
    fuss: 'You are receiving this email because a demo link was requested for this address on ihsan-yilmaz.de. If that was not you, simply ignore it – nothing else will happen.',
  },
  es: {
    betreff: 'Sus enlaces a las demos – concesionario y café',
    hallo: 'Buenos días,',
    intro: 'aquí tiene las dos demos. Ambas webs son reales y están abiertas – navegue con toda libertad.',
    verwaltung: 'El área de administración no es pública. Con gusto se la muestro en una breve conversación: 20 minutos por vídeo o teléfono, sin compromiso. Responda a este correo con una propuesta de fecha.',
    gruss: 'Un cordial saludo',
    fuss: 'Recibe este correo porque en ihsan-yilmaz.de se solicitó un enlace a la demo para esta dirección. Si no fue usted, simplemente ignórelo – no ocurrirá nada más.',
  },
};

function mailHtml(t) {
  const links = DEMOS.map(d =>
    `<p style="margin:0 0 12px"><a href="${d.url}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#1B6FA8;color:#fff;text-decoration:none;font-weight:600">${esc(d.name)} →</a>
     <br><span style="font-size:13px;color:#7C8A97">${esc(d.url)}</span></p>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#F3F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1B2530">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:14px;padding:32px 28px;border:1px solid #E3E9EF">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#1B6FA8;font-weight:700">AIY · Ihsan Yilmaz</p>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.6">${esc(t.hallo)}<br>${esc(t.intro)}</p>
      ${links}
      <p style="margin:22px 0 0;font-size:16px;line-height:1.6">${esc(t.verwaltung)}</p>
      <p style="margin:26px 0 0;font-size:16px;line-height:1.6">${esc(t.gruss)}<br><strong>Ihsan Yilmaz</strong><br>
        <a href="${SEITE}" style="color:#1B6FA8">ihsan-yilmaz.de</a> · <a href="mailto:${KONTAKT}" style="color:#1B6FA8">${KONTAKT}</a></p>
    </div>
    <p style="margin:18px 6px 0;font-size:12px;line-height:1.6;color:#7C8A97">${esc(t.fuss)}</p>
  </div></body></html>`;
}

function mailText(t) {
  return `${t.hallo}\n${t.intro}\n\n${DEMOS.map(d => `${d.name}: ${d.url}`).join('\n')}\n\n${t.verwaltung}\n\n${t.gruss}\nIhsan Yilmaz\n${SEITE} · ${KONTAKT}\n\n—\n${t.fuss}\n`;
}

// Jeder Versuch landet in "eingaenge" (Formular "demo") – das Monitoring
// zeigt daraus ok / ungueltig / fehler / bot, wie beim Kontaktformular.
function zaehlen(env, waitUntil, ergebnis) {
  if (!env.DB) return;
  const lauf = env.DB.prepare('INSERT INTO eingaenge (zeitpunkt, formular, ergebnis) VALUES (?, ?, ?)')
    .bind(new Date().toISOString(), 'demo', ergebnis).run().catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(lauf);
}

async function resend(env, nachricht) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(nachricht),
  });
}

// Ihsan Bescheid geben: Mail mit der Adresse, Telegram nur mit dem Hinweis.
async function benachrichtigen(env, email, sprache, versandt, grund) {
  if (env.RESEND_API_KEY) {
    try {
      await resend(env, {
        from: 'Demo-Anfrage <onboarding@resend.dev>',
        to: env.CONTACT_TO || KONTAKT,
        reply_to: email,
        subject: `Demo-Link angefordert: ${email}`,
        html: `<h2 style="margin:0 0 16px">Demo-Link angefordert – ihsan-yilmaz.de</h2>
          <p><strong>E-Mail:</strong> ${esc(email)}</p><p><strong>Sprache:</strong> ${esc(sprache.toUpperCase())}</p>
          <p><strong>Versand an den Besucher:</strong> ${versandt ? 'geklappt' : 'NICHT geklappt – bitte Links persönlich schicken'}${grund ? ` (${esc(grund)})` : ''}</p>
          <p>Die Anfrage steht auch unter <a href="${SEITE}/admin/anfragen">Anfragen</a>.</p>`,
      });
    } catch { /* nur eine Zusatzmeldung */ }
  }
  const token = env.TELEGRAM_BOT_TOKEN, chatId = env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, disable_web_page_preview: true,
          text: `🔗 Demo-Link über ihsan-yilmaz.de angefordert${versandt ? '' : ' – Versand hat NICHT geklappt'} — Details im Postfach.` }),
      });
    } catch { /* egal */ }
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  let d;
  try { d = await request.json(); } catch { return json({ ok: false, fehler: 'ungueltig' }, 400); }
  const { email: roh, sprache: sp, fax } = d || {};
  const sprache = ['de', 'en', 'es'].includes(sp) ? sp : 'de';

  // Honeypot: Bots fuellen "fax" aus – stillschweigend ignorieren.
  if (fax) { zaehlen(env, waitUntil, 'bot'); return json({ ok: true }); }

  const email = String(roh || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    zaehlen(env, waitUntil, 'ungueltig');
    return json({ ok: false, fehler: 'ungueltig' }, 400);
  }
  if (!env.DB) { zaehlen(env, waitUntil, 'fehler'); return json({ ok: false, fehler: 'nichtVersandt' }, 500); }

  // Bremsen – erst nachsehen, dann schreiben.
  const jetzt = Date.now();
  const [stunde, gleiche] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM demo_zugaenge WHERE zeitpunkt > ?')
      .bind(new Date(jetzt - 3600e3).toISOString()).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM demo_zugaenge WHERE email = ? AND versandt = 1 AND zeitpunkt > ?')
      .bind(email, new Date(jetzt - 86400e3).toISOString()).first(),
  ]);
  // Schon unterwegs: nicht noch einmal schicken – schuetzt auch fremde
  // Adressen davor, mehrfach angeschrieben zu werden.
  if ((gleiche?.n || 0) > 0) return json({ ok: true, bereits: true });
  if ((stunde?.n || 0) >= JE_STUNDE) { zaehlen(env, waitUntil, 'fehler'); return json({ ok: false, fehler: 'zuViel' }, 429); }

  const zeitpunkt = new Date(jetzt).toISOString();
  const neu = await env.DB.prepare('INSERT INTO demo_zugaenge (zeitpunkt, email, sprache) VALUES (?, ?, ?)')
    .bind(zeitpunkt, email, sprache).run();
  const id = neu.meta?.last_row_id;

  // Unter „Anfragen“ sichtbar machen – bewusst VOR dem Versand.
  try {
    await env.DB.prepare('INSERT INTO anfragen (name, email, betrieb, nachricht) VALUES (?, ?, ?, ?)')
      .bind('Demo-Link', email, null,
        `Demo-Links über die Website angefordert (${sprache.toUpperCase()}). Gespräch zum Verwaltungsbereich anbieten.`).run();
  } catch { /* Zusatzfunktion – der Versand darf daran nicht scheitern */ }

  let versandt = false, grund = '';
  if (!env.RESEND_API_KEY) {
    grund = 'RESEND_API_KEY fehlt';
  } else {
    const t = TEXTE[sprache];
    try {
      const r = await resend(env, {
        from: env.MAIL_FROM || 'AIY | Ihsan Yilmaz <onboarding@resend.dev>',
        to: email,
        reply_to: KONTAKT,
        subject: t.betreff,
        html: mailHtml(t),
        text: mailText(t),
      });
      if (r.ok) versandt = true;
      else grund = `Resend ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`;
    } catch (err) {
      grund = String(err && err.message || err).slice(0, 200);
    }
  }
  await env.DB.prepare('UPDATE demo_zugaenge SET versandt = ?, fehler = ? WHERE id = ?')
    .bind(versandt ? 1 : 0, grund || null, id).run().catch(() => {});
  zaehlen(env, waitUntil, versandt ? 'ok' : 'fehler');

  const melden = benachrichtigen(env, email, sprache, versandt, grund);
  if (typeof waitUntil === 'function') waitUntil(melden); else await melden;

  return versandt ? json({ ok: true }) : json({ ok: false, fehler: 'nichtVersandt' }, 502);
}
