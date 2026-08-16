// POST /api/admin/texten — Caption-Vorschlag für einen Instagram-Beitrag
//
// Nutzt die Anthropic-API (Claude) mit dem Secret ANTHROPIC_API_KEY.
// Structured Output erzwingt sauberes JSON { caption, hashtags } — kein
// Nachparsen, keine kaputten Antworten.
//
// Raw HTTP statt SDK: Pages Functions werden ohne Bundler deployt, ein
// npm-Paket steht hier nicht zur Verfügung.
import { json, nurAngemeldet } from '../../_lib/auth.js';

const SCHEMA = {
  type: 'object',
  properties: {
    caption: {
      type: 'string',
      description: 'Der Beitragstext auf Deutsch, 2-5 kurze Sätze, ohne Hashtags.',
    },
    hashtags: {
      type: 'string',
      description: 'Eine Zeile mit 5-8 passenden Hashtags, mit # und Leerzeichen getrennt.',
    },
  },
  required: ['caption', 'hashtags'],
  additionalProperties: false,
};

const SYSTEM = `Du schreibst Instagram-Captions für @aiy.web — den Auftritt von AIY | Ihsan Yilmaz aus Würzburg. AIY baut moderne Websites und smarte Funktionen für lokale Betriebe (Autohäuser, Gastronomie, Handwerk), dank KI-Tools zu fairen Preisen.

Ton: nahbar und direkt, professionell ohne steif zu sein, deutsche Sprache, "Sie" vermeiden — lieber neutral formulieren. Sparsame, passende Emojis sind erlaubt. Kein Marketing-Geschwurbel, keine leeren Superlative. Der Website-Link steht in der Bio — darauf darf verwiesen werden ("Link in Bio").

Hashtags: Mischung aus lokal (#würzburg u. ä.) und thematisch, klein geschrieben.`;

export const onRequestPost = nurAngemeldet(async ({ request, env }) => {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ ok: false, error: 'Text-Vorschläge sind noch nicht eingerichtet (Secret ANTHROPIC_API_KEY fehlt).' }, 503);
  }

  const { thema } = await request.json();
  if (!thema?.trim()) {
    return json({ ok: false, error: 'Bitte kurz angeben, worum es im Beitrag geht.' }, 400);
  }

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 16000,
        // Kurze Kreativ-Aufgabe: niedriger Aufwand reicht und antwortet schnell.
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: SCHEMA },
        },
        // Lehnen die Sicherheitsklassifizierer ab, übernimmt serverseitig ein
        // anderes Claude-Modell, statt dass der Nutzer eine Fehlermeldung sieht.
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `Schreibe eine Instagram-Caption zu folgendem Thema:\n\n${thema.trim().slice(0, 1000)}`,
        }],
      }),
    });
  } catch {
    return json({ ok: false, error: 'Anthropic-API nicht erreichbar.' }, 502);
  }

  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    return json({ ok: false, error: `Anthropic meldet: ${d?.error?.message || `HTTP ${r.status}`}` }, 502);
  }
  // Erst den Stop-Grund prüfen — bei einer Ablehnung ist content leer.
  if (d.stop_reason === 'refusal') {
    return json({ ok: false, error: 'Der Vorschlag wurde abgelehnt — bitte das Thema anders formulieren.' }, 502);
  }

  const text = (d.content || []).find(b => b.type === 'text')?.text;
  let ergebnis;
  try {
    ergebnis = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'Antwort war nicht lesbar — bitte nochmal versuchen.' }, 502);
  }

  return json({ ok: true, caption: ergebnis.caption, hashtags: ergebnis.hashtags });
});
