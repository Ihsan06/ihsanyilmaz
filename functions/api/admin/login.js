// POST /api/admin/login  — Anmeldung am Adminbereich
import { json, sessionCookieErstellen, sicherGleich } from '../../_lib/auth.js';

const MAX_FEHLVERSUCHE = 8;
const FENSTER_MINUTEN = 15;

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ ok: false, error: 'Adminbereich ist noch nicht konfiguriert.' }, 500);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unbekannt';

  // Brute-Force-Bremse: zu viele Fehlversuche aus derselben IP → sperren
  if (env.DB) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT COUNT(*) AS anzahl FROM login_versuche
         WHERE ip = ? AND zeitpunkt > datetime('now', ?)`,
      ).bind(ip, `-${FENSTER_MINUTEN} minutes`).all();

      if ((results?.[0]?.anzahl ?? 0) >= MAX_FEHLVERSUCHE) {
        return json(
          { ok: false, error: `Zu viele Fehlversuche. Bitte ${FENSTER_MINUTEN} Minuten warten.` },
          429,
        );
      }
    } catch {
      // Tabelle evtl. noch nicht angelegt — Login trotzdem zulassen.
    }
  }

  let daten;
  try {
    daten = await request.json();
  } catch {
    return json({ ok: false, error: 'Ungültige Anfrage.' }, 400);
  }

  if (!sicherGleich(daten?.passwort, env.ADMIN_PASSWORD)) {
    if (env.DB) {
      try {
        await env.DB.prepare('INSERT INTO login_versuche (ip) VALUES (?)').bind(ip).run();
      } catch { /* egal */ }
    }
    // Kleine Verzögerung bremst automatisiertes Durchprobieren zusätzlich aus.
    await new Promise(r => setTimeout(r, 600));
    return json({ ok: false, error: 'Falsches Passwort.' }, 401);
  }

  // Erfolg → alte Fehlversuche dieser IP aufräumen
  if (env.DB) {
    try {
      await env.DB.prepare('DELETE FROM login_versuche WHERE ip = ?').bind(ip).run();
    } catch { /* egal */ }
  }

  const cookie = await sessionCookieErstellen(env);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
