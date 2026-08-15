"use client";
import { useEffect, useState } from "react";
import { Database, Image as ImageIcon, Mail, Activity, Send, AlertTriangle, CheckCircle } from "lucide-react";
import AdminShell, { api } from "@/components/admin/AdminShell";

type Daten = {
  grenzen: {
    d1SpeicherBytes: number;
    d1ZeilenGelesenTag: number;
    d1ZeilenGeschriebenTag: number;
    r2SpeicherBytes: number;
    anfragenTag: number;
    mailsMonat: number;
  };
  eigene: { dbBytes: number; r2Bytes: number; bilderAnzahl: number; mailsMonat: number };
  cloudflare: null | {
    d1: { gelesen: number; geschrieben: number } | null;
    functions: { aufrufe: number; fehler: number } | null;
    fehler: string[];
  };
  tokenVorhanden: boolean;
};

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const zahl = (n: number) => n.toLocaleString("de-DE");

export default function ApiVerbrauch() {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    api("/api/admin/verbrauch")
      .then(setD)
      .catch(e => setFehler(e.message));
  }, []);

  const kritisch = d
    ? [
        d.eigene.dbBytes / d.grenzen.d1SpeicherBytes,
        d.eigene.r2Bytes / d.grenzen.r2SpeicherBytes,
        d.eigene.mailsMonat / d.grenzen.mailsMonat,
      ].some(a => a >= 0.8)
    : false;

  return (
    <AdminShell
      titel="API & Verbrauch"
      eyebrow="Finanzen"
      lead="Was deine Dienste verbrauchen — und wie viel bis zur kostenpflichtigen Stufe noch frei ist."
    >
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      {d && (
        <div className="card p-5 mb-6 flex items-start gap-3">
          <div className="shrink-0 mt-0.5" style={{ color: kritisch ? "#ef4444" : "var(--accent)" }}>
            {kritisch ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
          </div>
          <div>
            <p className="text-[var(--fg)] font-medium">
              {kritisch ? "Achtung — eine Grenze ist bald erreicht" : "Alles im kostenlosen Bereich"}
            </p>
            <p className="text-[var(--fg-muted)] text-sm mt-0.5">
              {kritisch
                ? "Mindestens ein Wert liegt über 80 % des Freikontingents. Details unten."
                : "Nach aktuellem Verbrauch entstehen dir keine Kosten."}
            </p>
          </div>
        </div>
      )}

      {!d ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : (
        <>
          <h2 className="display-h text-lg font-semibold text-[var(--fg)] mb-4">Speicher & Kontingente</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            <Balken
              icon={<Database size={18} />}
              titel="Datenbank (D1)"
              wert={d.eigene.dbBytes}
              grenze={d.grenzen.d1SpeicherBytes}
              zeige={bytes}
              hinweis="5 GB frei je Konto"
            />
            <Balken
              icon={<ImageIcon size={18} />}
              titel="Bildspeicher (R2)"
              wert={d.eigene.r2Bytes}
              grenze={d.grenzen.r2SpeicherBytes}
              zeige={bytes}
              hinweis={`${d.eigene.bilderAnzahl} Bilder · 10 GB frei`}
            />
            <Balken
              icon={<Mail size={18} />}
              titel="E-Mails diesen Monat"
              wert={d.eigene.mailsMonat}
              grenze={d.grenzen.mailsMonat}
              zeige={zahl}
              hinweis="Resend: 3.000/Monat frei"
            />
          </div>

          <h2 className="display-h text-lg font-semibold text-[var(--fg)] mb-4">Heute</h2>

          {!d.tokenVorhanden ? (
            <div className="card p-6">
              <p className="text-[var(--fg)] font-medium mb-1">Tageszahlen noch nicht verbunden</p>
              <p className="text-[var(--fg-muted)] text-sm leading-relaxed">
                Für gelesene/geschriebene Datenbankzeilen und die Zahl der Seitenaufrufe pro Tag
                braucht es einen lesenden Cloudflare-API-Token. Anleitung steht in{" "}
                <code>ADMIN-SETUP.md</code> unter „API-Verbrauch". Ohne ihn funktioniert alles
                andere hier normal weiter.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {d.cloudflare?.d1 && (
                  <>
                    <Balken
                      icon={<Activity size={18} />}
                      titel="Zeilen gelesen"
                      wert={d.cloudflare.d1.gelesen}
                      grenze={d.grenzen.d1ZeilenGelesenTag}
                      zeige={zahl}
                      hinweis="5 Mio./Tag frei"
                    />
                    <Balken
                      icon={<Activity size={18} />}
                      titel="Zeilen geschrieben"
                      wert={d.cloudflare.d1.geschrieben}
                      grenze={d.grenzen.d1ZeilenGeschriebenTag}
                      zeige={zahl}
                      hinweis="100.000/Tag frei"
                    />
                  </>
                )}
                {d.cloudflare?.functions && (
                  <Balken
                    icon={<Send size={18} />}
                    titel="Function-Aufrufe"
                    wert={d.cloudflare.functions.aufrufe}
                    grenze={d.grenzen.anfragenTag}
                    zeige={zahl}
                    hinweis="100.000/Tag frei"
                  />
                )}
              </div>

              {d.cloudflare?.fehler?.length ? (
                <div className="card p-5 mt-5">
                  <p className="text-[var(--fg)] font-medium mb-2">Nicht abrufbar</p>
                  <ul className="text-[var(--fg-muted)] text-sm space-y-1 list-disc list-inside">
                    {d.cloudflare.fehler.map(f => <li key={f}>{f}</li>)}
                  </ul>
                  <p className="text-[var(--fg-subtle)] text-xs mt-3">
                    Meist fehlt dem Token eine Leseberechtigung (Account Analytics / D1).
                  </p>
                </div>
              ) : null}
            </>
          )}

          <div className="card p-6 mt-10">
            <h2 className="display-h text-lg font-semibold text-[var(--fg)] mb-3">Kostenlos, nichts zu überwachen</h2>
            <ul className="text-[var(--fg-muted)] text-sm space-y-1.5">
              <li>· <strong className="text-[var(--fg)]">Telegram</strong> — Benachrichtigungen, dauerhaft ohne Kosten</li>
              <li>· <strong className="text-[var(--fg)]">OpenStreetMap</strong> — Karte als Einbettung, kein API-Zugang</li>
              <li>· <strong className="text-[var(--fg)]">Google Maps</strong> — nur ein Link, kein API-Aufruf</li>
            </ul>
          </div>
        </>
      )}
    </AdminShell>
  );
}

function Balken({
  icon, titel, wert, grenze, zeige, hinweis,
}: {
  icon: React.ReactNode; titel: string; wert: number; grenze: number;
  zeige: (n: number) => string; hinweis: string;
}) {
  const anteil = grenze > 0 ? Math.min(100, (wert / grenze) * 100) : 0;
  const farbe = anteil >= 80 ? "#ef4444" : anteil >= 50 ? "#d97706" : "var(--accent)";

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="icon-tile w-10 h-10">{icon}</div>
        <h3 className="display-h text-sm font-semibold text-[var(--fg)]">{titel}</h3>
      </div>

      <div className="display-h text-2xl font-semibold text-[var(--fg)]">{zeige(wert)}</div>
      <div className="text-[var(--fg-subtle)] text-xs mt-0.5 mb-3">von {zeige(grenze)}</div>

      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}
        role="progressbar" aria-valuenow={Math.round(anteil)} aria-valuemin={0} aria-valuemax={100}
        aria-label={`${titel}: ${Math.round(anteil)} Prozent belegt`}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(anteil, wert > 0 ? 1.5 : 0)}%`, background: farbe }} />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-medium" style={{ color: farbe }}>
          {anteil < 0.1 && wert > 0 ? "< 0,1 %" : `${anteil.toFixed(anteil < 10 ? 1 : 0)} %`}
        </span>
        <span className="text-[var(--fg-subtle)] text-xs">{hinweis}</span>
      </div>
    </div>
  );
}
