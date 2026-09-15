// Cloudflare Pages Function — POST /api/contact
// Benötigte Umgebungsvariablen (im Pages-Projekt setzen):
//   RESEND_API_KEY       — API-Key aus dem Resend-Dashboard
//   CONTACT_TO           (optional) — Standard: kontakt@ihsan-yilmaz.de
//   TELEGRAM_BOT_TOKEN   (optional) — Token vom @BotFather; aktiviert Telegram-Benachrichtigung
//   TELEGRAM_CHAT_ID     (optional) — eigene Chat-ID; nur zusammen mit TELEGRAM_BOT_TOKEN aktiv

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Zusätzliche, nicht blockierende Telegram-Benachrichtigung.
// Datensparsam: nur der Hinweis, DASS eine Anfrage kam — KEINE personenbezogenen Inhalte.
// Die Details stehen in der E-Mail. Schlägt sie fehl oder ist nicht konfiguriert,
// bleibt der Formularversand davon unberührt.
async function notifyTelegram(env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = '📩 Neue Kontaktanfrage über ihsan-yilmaz.de eingegangen — Details in deinem E-Mail-Postfach.';

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // Telegram ist nur eine Zusatz-Benachrichtigung – Fehler bewusst ignorieren.
  }
}

// Jeder Versuch landet in "eingaenge" – auch die, aus denen keine Anfrage
// wird. Das Monitoring zeigt daraus, wie oft das Formular haengt (fehler),
// unvollstaendig abgeschickt wird (ungueltig) oder Bots abfaengt (bot).
// Darf die Antwort nie verzoegern oder scheitern lassen.
function zaehlen(env, waitUntil, ergebnis) {
  if (!env.DB) return;
  const lauf = env.DB.prepare(
    'INSERT INTO eingaenge (zeitpunkt, formular, ergebnis) VALUES (?, ?, ?)'
  ).bind(new Date().toISOString(), 'kontakt', ergebnis).run().catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(lauf);
}

export async function onRequestPost({ request, env, waitUntil }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'Ungültige Anfrage.' }, 400);
  }

  const { name, email, company, message, fax } = data || {};

  // Honeypot: Bots füllen "fax" aus → stillschweigend ignorieren
  if (fax) { zaehlen(env, waitUntil, 'bot'); return json({ ok: true }); }

  if (!name || !email || !message) {
    zaehlen(env, waitUntil, 'ungueltig');
    return json({ ok: false, error: 'Bitte Name, E-Mail und Nachricht ausfüllen.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    zaehlen(env, waitUntil, 'ungueltig');
    return json({ ok: false, error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 400);
  }

  // Anfrage im Dashboard sichtbar machen. Bewusst VOR dem Mailversand und
  // fehlertolerant: Wenn die Datenbank streikt, soll die E-Mail trotzdem rausgehen.
  if (env.DB) {
    try {
      await env.DB.prepare(
        'INSERT INTO anfragen (name, email, betrieb, nachricht) VALUES (?, ?, ?, ?)',
      ).bind(name, email, company || null, message).run();
    } catch {
      // Dashboard ist nur eine Zusatzfunktion — Formular darf daran nicht scheitern.
    }
  }

  if (!env.RESEND_API_KEY) {
    zaehlen(env, waitUntil, 'fehler');
    return json({ ok: false, error: 'E-Mail-Dienst ist noch nicht konfiguriert.' }, 500);
  }

  const to = env.CONTACT_TO || 'kontakt@ihsan-yilmaz.de';

  const html = `
    <h2 style="margin:0 0 16px">Neue Kontaktanfrage – ihsan-yilmaz.de</h2>
    <p><strong>Name:</strong> ${esc(name)}</p>
    <p><strong>E-Mail:</strong> ${esc(email)}</p>
    ${company ? `<p><strong>Betrieb:</strong> ${esc(company)}</p>` : ''}
    <p><strong>Nachricht:</strong></p>
    <p style="white-space:pre-wrap">${esc(message)}</p>
  `;

  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kontaktformular <onboarding@resend.dev>',
        to,
        reply_to: email,
        subject: `Kontaktanfrage von ${name}${company ? ` (${company})` : ''}`,
        html,
      }),
    });
  } catch {
    zaehlen(env, waitUntil, 'fehler');
    return json({ ok: false, error: 'E-Mail-Dienst nicht erreichbar.' }, 502);
  }

  if (!r.ok) {
    zaehlen(env, waitUntil, 'fehler');
    return json({ ok: false, error: 'Versand fehlgeschlagen. Bitte später erneut versuchen.' }, 502);
  }
  zaehlen(env, waitUntil, 'ok');

  // Zusätzliche Telegram-Benachrichtigung, ohne die Antwort zu verzögern.
  const tg = notifyTelegram(env);
  if (typeof waitUntil === 'function') waitUntil(tg); else await tg;

  return json({ ok: true });
}
