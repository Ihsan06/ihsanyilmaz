"use client";
import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Seitenweise Listen im Admin (Betriebe, Post → Briefe): Groesse merkt sich
// der Browser je Liste, die Seite springt bei jeder Filteraenderung auf 1.
export const SEITEN_GROESSEN = [50, 100, 200, 0] as const; // 0 = alle

const zahl = (n: number) => n.toLocaleString("de-DE");

export function useSeiten<T>(liste: T[], { speicher, filterSchluessel, standard = 100, nachOben }: {
  speicher: string; filterSchluessel: string; standard?: number; nachOben?: string;
}) {
  const [groesse, setGroesse] = useState<number>(() => {
    try {
      const roh = localStorage.getItem(speicher);
      const g = roh === null ? standard : Number(roh);
      return SEITEN_GROESSEN.includes(g as 0 | 50 | 100 | 200) ? g : standard;
    } catch { return standard; }
  });
  // Die Seite gilt nur fuer den Filterstand, unter dem sie gewaehlt wurde –
  // aendert sich ein Filter, zeigt die Liste wieder Seite 1 (ohne Effekt).
  const [seite, setSeite] = useState<{ n: number; stand: string }>({ n: 1, stand: "" });
  const anzahl = groesse ? Math.max(1, Math.ceil(liste.length / groesse)) : 1;
  const jetzt = Math.min(seite.stand === filterSchluessel ? seite.n : 1, anzahl);
  const start = groesse ? (jetzt - 1) * groesse : 0;
  const aufSeite = useMemo(() => (groesse ? liste.slice(start, start + groesse) : liste), [liste, groesse, start]);

  const wechseln = (n: number) => {
    setSeite({ n: Math.max(1, Math.min(anzahl, n)), stand: filterSchluessel });
    if (nachOben) document.querySelector(nachOben)?.scrollIntoView({ block: "start" });
  };
  const groesseSetzen = (g: number) => {
    setGroesse(g); setSeite({ n: 1, stand: filterSchluessel });
    try { localStorage.setItem(speicher, String(g)); } catch { /* egal */ }
  };
  // Seitenzahlen: 1 … n mit Luecken, immer die aktuelle und ihre Nachbarn.
  const zahlen = useMemo(() => {
    const alle = Array.from({ length: anzahl }, (_, i) => i + 1);
    if (anzahl <= 9) return alle;
    const nah = new Set([1, 2, anzahl - 1, anzahl, jetzt - 1, jetzt, jetzt + 1]);
    const out: (number | null)[] = [];
    for (const n of alle) {
      if (nah.has(n)) out.push(n);
      else if (out[out.length - 1] !== null) out.push(null);
    }
    return out;
  }, [anzahl, jetzt]);

  const leiste = liste.length === 0 ? null : (
    <nav className="akq-seiten" aria-label="Seiten">
      <span className="akq-seiten-stand">
        {groesse ? `${zahl(start + 1)}–${zahl(Math.min(liste.length, start + groesse))}` : zahl(liste.length)} von {zahl(liste.length)}
      </span>
      {anzahl > 1 && (
        <span className="akq-seiten-zahlen">
          <button type="button" className="akq-knopf akq-symbol" onClick={() => wechseln(jetzt - 1)} disabled={jetzt === 1} aria-label="Vorherige Seite"><ChevronLeft size={14} /></button>
          {zahlen.map((n, i) => n === null
            ? <span key={`l${i}`} className="akq-seiten-luecke">…</span>
            : <button key={n} type="button" className={`akq-seite${n === jetzt ? " an" : ""}`} onClick={() => wechseln(n)} aria-current={n === jetzt ? "page" : undefined}>{n}</button>)}
          <button type="button" className="akq-knopf akq-symbol" onClick={() => wechseln(jetzt + 1)} disabled={jetzt === anzahl} aria-label="Nächste Seite"><ChevronRight size={14} /></button>
        </span>
      )}
      <label className="akq-seiten-groesse">
        je Seite
        <select value={groesse} onChange={e => groesseSetzen(Number(e.target.value))} className="field px-2 py-1 text-sm">
          {SEITEN_GROESSEN.map(g => <option key={g} value={g}>{g === 0 ? "alle" : g}</option>)}
        </select>
      </label>
    </nav>
  );
  return { aufSeite, leiste, start };
}
