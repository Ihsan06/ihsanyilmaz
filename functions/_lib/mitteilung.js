// Kurze Nachricht an mich selbst, wenn sich auf einer persoenlichen Seite
// /fuer/<token> etwas tut (erster Aufruf, Demo geoeffnet, Rueckrufbitte).
//
// Mail ueber Resend an CONTACT_TO (wie Kontaktformular und Demo-Zugang);
// Telegram nur, wenn `telegram` gesetzt ist, und dann ohne Personendaten –
// die Einzelheiten stehen in der Mail. Wirft nie: die Seite darf an einer
// Benachrichtigung nicht scheitern.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export async function mirMitteilen(env, { betreff, zeilen, link, telegram }) {
  const auftraege = [];
  if (env.RESEND_API_KEY) {
    const html = `<h2 style="margin:0 0 12px;font-size:18px">${esc(betreff)}</h2>`
      + zeilen.filter(Boolean).map(z => `<p style="margin:0 0 6px">${z}</p>`).join('')
      + (link ? `<p style="margin:16px 0 0"><a href="${esc(link)}">Im Admin ansehen</a></p>` : '');
    auftraege.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'Akquise <onboarding@resend.dev>',
        to: env.CONTACT_TO || 'kontakt@ihsan-yilmaz.de',
        subject: betreff,
        html,
      }),
    }));
  }
  if (telegram && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    auftraege.push(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: telegram, disable_web_page_preview: true }),
    }));
  }
  const erg = await Promise.allSettled(auftraege);
  return erg.some(e => e.status === 'fulfilled' && e.value.ok);
}

export const adminLink = request => `${new URL(request.url).origin}/admin/akquise/post?tab=briefe`;

// „Firma – was passiert ist“ als Mail, z. B. erster Aufruf oder Demo geoeffnet.
export async function betriebMelden(env, request, betriebId, was) {
  const b = await env.DB.prepare('SELECT name, ort FROM akquise_betriebe WHERE id = ?').bind(betriebId).first();
  if (!b) return;
  await mirMitteilen(env, {
    betreff: `${was}: ${b.name}`,
    zeilen: [`<b>${esc(b.name)}</b>${b.ort ? ` · ${esc(b.ort)}` : ''} – ${esc(was)}.`],
    link: adminLink(request),
  });
}
