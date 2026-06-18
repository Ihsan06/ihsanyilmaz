// Cloudflare Pages Function — POST /api/contact
// Benötigte Umgebungsvariablen (im Pages-Projekt setzen):
//   RESEND_API_KEY  — API-Key aus dem Resend-Dashboard (bereits vom Autohaus-Projekt vorhanden)
//   CONTACT_TO      (optional) — Standard: ihsan.yilmaz@gmx.de

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: 'Ungültige Anfrage.' }, 400);
  }

  const { name, email, company, message, fax } = data || {};

  // Honeypot: Bots füllen "fax" aus → stillschweigend ignorieren
  if (fax) return json({ ok: true });

  if (!name || !email || !message) {
    return json({ ok: false, error: 'Bitte Name, E-Mail und Nachricht ausfüllen.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 400);
  }

  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: 'E-Mail-Dienst ist noch nicht konfiguriert.' }, 500);
  }

  const to = env.CONTACT_TO || 'ihsan.yilmaz@gmx.de';

  const html = `
    <h2 style="margin:0 0 16px">Neue Kontaktanfrage – ihsan-yilmaz.de</h2>
    <p><strong>Name:</strong> ${esc(name)}</p>
    <p><strong>E-Mail:</strong> ${esc(email)}</p>
    ${company ? `<p><strong>Unternehmen:</strong> ${esc(company)}</p>` : ''}
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
    return json({ ok: false, error: 'E-Mail-Dienst nicht erreichbar.' }, 502);
  }

  if (!r.ok) {
    return json({ ok: false, error: 'Versand fehlgeschlagen. Bitte später erneut versuchen.' }, 502);
  }

  return json({ ok: true });
}
