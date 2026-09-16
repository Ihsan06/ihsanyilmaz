"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TEXTE, type Sprache, type Texte } from "./texte";

// Die Sprachwahl lebt im Browser (localStorage), Vorgabe Deutsch. Beim ersten
// Besuch zaehlt die Browsersprache, sofern wir sie haben. Die Seite ist
// statisch – ein Wechsel tauscht nur die Texte, nichts wird neu geladen.

const SCHLUESSEL = "aiy-sprache";

type Wert = { sprache: Sprache; setSprache: (s: Sprache) => void; t: Texte };
const Kontext = createContext<Wert>({ sprache: "de", setSprache: () => {}, t: TEXTE.de });

function erkennen(): Sprache {
  try {
    const merk = localStorage.getItem(SCHLUESSEL);
    if (merk === "de" || merk === "en" || merk === "es") return merk;
    const nav = (navigator.language || "").slice(0, 2).toLowerCase();
    if (nav === "en" || nav === "es") return nav;
  } catch {}
  return "de";
}

export function SpracheProvider({ children }: { children: ReactNode }) {
  const [sprache, setSpracheRoh] = useState<Sprache>("de");

  useEffect(() => { setSpracheRoh(erkennen()); }, []);
  useEffect(() => { document.documentElement.lang = sprache; }, [sprache]);

  const setSprache = (s: Sprache) => {
    setSpracheRoh(s);
    try { localStorage.setItem(SCHLUESSEL, s); } catch {}
  };

  return (
    <Kontext.Provider value={{ sprache, setSprache, t: TEXTE[sprache] }}>
      {children}
    </Kontext.Provider>
  );
}

export const useSprache = () => useContext(Kontext);
