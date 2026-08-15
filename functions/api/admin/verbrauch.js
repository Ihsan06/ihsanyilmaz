// GET /api/admin/verbrauch — Verbrauch gegen die kostenlosen Kontingente
//
// Zwei Schichten:
//  1. Ohne jeden Zugang: Datenbankgröße (D1 liefert size_after bei jeder Abfrage
//     mit), belegter Bildspeicher und versendete Mails — alles aus eigenen Daten.
//  2. Optional mit CF_API_TOKEN + CF_ACCOUNT_ID: Tageszahlen von Cloudflare
//     (gelesene/geschriebene Zeilen, Function-Aufrufe) über die GraphQL-API.
//
// Schlägt Schicht 2 fehl, bleibt Schicht 1 trotzdem stehen — die Seite zeigt dann
// bei den betroffenen Werten offen an, dass sie nicht abrufbar waren.
import { json, nurAngemeldet } from '../../_lib/auth.js';

// Stand der Free-Tier-Grenzen: Cloudflare-Doku, geprüft 2026-08-16.
const GRENZEN = {
  d1SpeicherBytes: 5 * 1024 * 1024 * 1024,   // 5 GB je Konto
  d1ZeilenGelesenTag: 5_000_000,
  d1ZeilenGeschriebenTag: 100_000,
  r2SpeicherBytes: 10 * 1024 * 1024 * 1024,  // 10 GB-Monate
  anfragenTag: 100_000,                       // Workers Free: Requests/Tag
  mailsMonat: 3000,                           // Resend Free
};

const GQL = 'https://api.cloudflare.com/client/v4/graphql';

async function graphql(env, query, variables) {
  const r = await fetch(GQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const d = await r.json();
  if (!r.ok || d.errors?.length) {
    throw new Error(d.errors?.[0]?.message || `HTTP ${r.status}`);
  }
  return d.data;
}

async function cloudflareZahlen(env) {
  const heute = new Date().toISOString().slice(0, 10);
  const accountTag = env.CF_ACCOUNT_ID;

  const ergebnis = { d1: null, functions: null, fehler: [] };

  // Gelesene/geschriebene Zeilen heute
  try {
    const d = await graphql(env, `
      query($accountTag: String!, $tag: Date!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            d1AnalyticsAdaptiveGroups(limit: 100, filter: { date_geq: $tag, date_leq: $tag }) {
              sum { rowsRead rowsWritten }
            }
          }
        }
      }`, { accountTag, tag: heute });

    const gruppen = d?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups ?? [];
    ergebnis.d1 = gruppen.reduce(
      (acc, g) => ({
        gelesen: acc.gelesen + Number(g.sum?.rowsRead ?? 0),
        geschrieben: acc.geschrieben + Number(g.sum?.rowsWritten ?? 0),
      }),
      { gelesen: 0, geschrieben: 0 },
    );
  } catch (e) {
    ergebnis.fehler.push(`D1-Tageszahlen: ${e.message}`);
  }

  // Aufrufe der Pages-Functions heute
  try {
    const d = await graphql(env, `
      query($accountTag: String!, $tag: Date!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            pagesFunctionsInvocationsAdaptiveGroups(limit: 100, filter: { date_geq: $tag, date_leq: $tag }) {
              sum { requests errors }
            }
          }
        }
      }`, { accountTag, tag: heute });

    const gruppen = d?.viewer?.accounts?.[0]?.pagesFunctionsInvocationsAdaptiveGroups ?? [];
    ergebnis.functions = gruppen.reduce(
      (acc, g) => ({
        aufrufe: acc.aufrufe + Number(g.sum?.requests ?? 0),
        fehler: acc.fehler + Number(g.sum?.errors ?? 0),
      }),
      { aufrufe: 0, fehler: 0 },
    );
  } catch (e) {
    ergebnis.fehler.push(`Function-Aufrufe: ${e.message}`);
  }

  return ergebnis;
}

export const onRequestGet = nurAngemeldet(async ({ env }) => {
  const monatsStart = new Date().toISOString().slice(0, 7) + '-01';

  // Eine echte Abfrage: das Ergebnis brauchen wir, und ihr meta.size_after
  // verrät nebenbei die tatsächliche Größe der Datenbank.
  const mails = await env.DB.prepare(
    `SELECT COUNT(*) AS anzahl FROM anfragen WHERE erstellt_am >= ?`,
  ).bind(monatsStart).run();

  const dbBytes = Number(mails.meta?.size_after ?? 0);
  const mailsMonat = Number(mails.results?.[0]?.anzahl ?? 0);

  const bilder = await env.DB.prepare(
    `SELECT COUNT(*) AS anzahl, COALESCE(SUM(groesse), 0) AS bytes FROM bilder`,
  ).all();

  const antwort = {
    ok: true,
    grenzen: GRENZEN,
    eigene: {
      dbBytes,
      r2Bytes: Number(bilder.results?.[0]?.bytes ?? 0),
      bilderAnzahl: Number(bilder.results?.[0]?.anzahl ?? 0),
      mailsMonat,
    },
    cloudflare: null,
    tokenVorhanden: Boolean(env.CF_API_TOKEN && env.CF_ACCOUNT_ID),
  };

  if (antwort.tokenVorhanden) {
    antwort.cloudflare = await cloudflareZahlen(env);
  }

  return json(antwort);
});
