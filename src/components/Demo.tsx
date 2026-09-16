"use client";
import { useState } from "react";
import { Send, Check, AlertCircle, Info } from "lucide-react";
import { useSprache } from "@/lib/sprache";

// „Demo ansehen“: Besucher gibt seine E-Mail-Adresse an und bekommt die
// Links zu den Demo-Websites automatisch zugeschickt (functions/api/demo.js).
// Der Verwaltungsbereich bleibt zu – die Mail bietet dafuer ein Gespraech an.

type Stand = "idle" | "sending" | "sent" | "fehler" | "zuViel" | "nichtVersandt";

export default function Demo() {
  const { t, sprache } = useSprache();
  const d = t.demo;
  const [email, setEmail] = useState("");
  const [fax, setFax] = useState("");
  const [stand, setStand] = useState<Stand>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStand("sending");
    try {
      const r = await fetch("/api/demo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sprache, fax }),
      });
      const j = await r.json().catch(() => null);
      if (j && j.ok) setStand("sent");
      else if (j && (j.fehler === "nichtVersandt" || j.fehler === "zuViel")) setStand(j.fehler);
      else setStand("fehler");
    } catch {
      setStand("fehler");
    }
  };

  return (
    <section id="demo" className="surface-base py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="card p-8 md:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          <div>
            <span className="eyebrow inline-block mb-3">{d.eyebrow}</span>
            <h2 className="display-h text-3xl md:text-4xl text-[var(--fg)] mb-3">{d.titel}</h2>
            <p className="text-[var(--fg-muted)] leading-relaxed">{d.text}</p>
          </div>

          {stand === "sent" ? (
            <div className="flex items-start gap-3">
              <span className="icon-tile w-10 h-10 shrink-0"><Check size={18} /></span>
              <div>
                <p className="font-semibold text-[var(--fg)] mb-1">{d.fertigTitel}</p>
                <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{d.fertigText}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="email" name="email" required autoComplete="email" value={email}
                       onChange={e => setEmail(e.target.value)} placeholder={d.platz} aria-label={d.platz}
                       className="field px-4 py-3 text-sm flex-1" />
                <button type="submit" disabled={stand === "sending"}
                        className="btn-primary px-5 py-3 text-sm whitespace-nowrap inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {stand === "sending" ? d.sendet : <><span>{d.knopf}</span><Send size={15} /></>}
                </button>
              </div>
              {/* Honeypot – bleibt fuer Menschen unsichtbar */}
              <input type="text" name="fax" tabIndex={-1} autoComplete="off" value={fax}
                     onChange={e => setFax(e.target.value)} className="hidden" aria-hidden="true" />
              {stand === "fehler" && (
                <p className="flex items-center gap-2 text-sm" style={{ color: "#ef4444" }}><AlertCircle size={16} />{d.fehler}</p>
              )}
              {stand === "zuViel" && (
                <p className="flex items-center gap-2 text-sm" style={{ color: "#ef4444" }}><AlertCircle size={16} />{d.zuViel}</p>
              )}
              {stand === "nichtVersandt" && (
                <p className="flex items-start gap-2 text-sm text-[var(--fg)]"><Info size={16} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />{d.nichtVersandt}</p>
              )}
              <p className="text-xs text-[var(--fg-subtle)] leading-relaxed">
                {d.zustimmung1}
                <a href="/datenschutz" className="underline underline-offset-2 hover:opacity-80" style={{ color: "var(--accent)" }}>{t.kontakt.datenschutz}</a>
                {d.zustimmung2}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
