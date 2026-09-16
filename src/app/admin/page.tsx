"use client";
import { useEffect, useRef, useState } from "react";
import { ChartNoAxesColumn, Camera, Inbox, Euro, Images } from "lucide-react";
import AdminShell, { api, euro, datum } from "@/components/admin/AdminShell";

// Die Uebersicht nach dem Muster der Autohaus-Demo: Abschnitte mit
// Ueberschrift und Weg weiter, darunter Kacheln im Monitoring-Stil.
// Hier geht es um "steht alles gut" – die Auswertung ist das Monitoring.

type Stats = {
  neueAnfragen: number; anfragenGesamt: number;
  einnahmenCent: number; ausgabenCent: number; saldoCent: number;
  dokumente: number;
};
type Kurz = {
  von: string; bis: string;
  besucher?: { ok?: boolean; besuche: number; aufrufe: number; proTag: { tag: string; besuche: number; aufrufe: number }[] };
  anfragen?: { ok?: boolean; gesamt: number; offen: number };
  instagram?: { ok?: boolean; follower: number | null; beitraege: number | null; zuwachs: number | null };
  speicher?: { ok?: boolean; bilder: number; bytes: number; anteil: number };
  davor?: { besuche: number | null; aufrufe: number | null; anfragen: number | null } | null;
};
type Insta = {
  profil?: { follower: number; beitraege: number } | null;
  medien?: { zeitpunkt: string; likes: number | null; kommentare: number | null }[];
};
type Anfrage = { id: number; name: string; betrieb: string | null; status: string; erstellt_am: string };

const FARBE_BESUCHE = "#12557F";
const FARBE_AUFRUFE = "#4DA3E0";
const STATUS_WORT: Record<string, string> = {
  neu: "Neu", in_bearbeitung: "In Bearbeitung", beantwortet: "Beantwortet", archiviert: "Archiviert",
};

const zahl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("de-DE"));
const groesse = (b: number) => b >= 1024 ** 3
  ? (b / 1024 ** 3).toFixed(2).replace(".", ",") + " GB"
  : (b / 1024 ** 2).toFixed(1).replace(".", ",") + " MB";
const kurzDatum = (iso: string) =>
  new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

function Trend({ jetzt, davor }: { jetzt?: number | null; davor?: number | null }) {
  if (jetzt == null || davor == null || davor === 0) return null;
  const diff = ((jetzt - davor) / davor) * 100;
  if (Math.abs(diff) < 1) return <span className="mon-trend gleich">unverändert</span>;
  const hoch = diff > 0;
  return <span className={`mon-trend ${hoch ? "hoch" : "runter"}`}>{hoch ? "▲" : "▼"} {Math.abs(diff) >= 999 ? "999+" : Math.abs(diff).toFixed(0)} %</span>;
}

function Kachel({ titel, wert, unter, vergleich, href }: {
  titel: string; wert: string; unter?: string; vergleich?: React.ReactNode; href: string;
}) {
  return (
    <a href={href} className="mon-kachel block no-underline">
      <p className="mon-kachel-titel">{titel}</p>
      <p className="mon-kachel-wert">{wert}</p>
      <p className="mon-kachel-unter">{vergleich}{unter}</p>
    </a>
  );
}

// Abschnittskopf wie in der Demo: Zeichen, Titel, Linie, rechts der Weg weiter.
function Abschnitt({ icon, titel, weg, wegText, children }: {
  icon: React.ReactNode; titel: string; weg: string; wegText: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <div className="ueb-kopf">
        <span className="ueb-kopf-zeichen">{icon}</span>
        <h2>{titel}</h2>
        <span className="ueb-kopf-linie" />
        <a href={weg}>{wegText} →</a>
      </div>
      {children}
    </section>
  );
}

// Kleiner Verlauf ohne Achsen: Flaeche fuer Aufrufe, Linie fuer Besuche.
// Die Tage dazwischen sind gefuellt, sonst wirken Luecken wie Einbrueche.
type Tag = { tag: string; besuche: number; aufrufe: number };
function Verlauf({ proTag, von, bis }: { proTag: Tag[]; von: string; bis: string }) {
  const kasten = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(0);
  useEffect(() => {
    const el = kasten.current; if (!el) return;
    const b = new ResizeObserver(e => setBreite(Math.floor(e[0].contentRect.width)));
    b.observe(el); return () => b.disconnect();
  }, []);

  const nachTag = new Map((proTag || []).map(z => [z.tag, z]));
  const punkte: Tag[] = [];
  const d = new Date(von.slice(0, 10) + "T00:00:00Z"); const ende = new Date(bis.slice(0, 10) + "T00:00:00Z");
  for (let i = 0; d <= ende && i < 400; i++) {
    const tag = d.toISOString().slice(0, 10); const z = nachTag.get(tag);
    punkte.push({ tag, besuche: z?.besuche ?? 0, aufrufe: z?.aufrufe ?? 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const H = 120, oben = 6, unten = 4;
  const hoechst = Math.max(1, ...punkte.map(p => Math.max(p.besuche, p.aufrufe)));
  const x = (i: number) => punkte.length < 2 ? breite / 2 : (i / (punkte.length - 1)) * breite;
  const y = (v: number) => oben + (1 - v / hoechst) * (H - oben - unten);
  const linie = (f: "besuche" | "aufrufe") => punkte.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[f]).toFixed(1)}`).join(" ");
  const flaeche = `${linie("aufrufe")} L${x(punkte.length - 1).toFixed(1)},${H} L0,${H} Z`;

  return (
    <div ref={kasten}>
      {breite > 0 && punkte.length > 1 && (
        <svg viewBox={`0 0 ${breite} ${H}`} width={breite} height={H} role="img" aria-label="Besuche und Seitenaufrufe der letzten 30 Tage" className="block">
          <path d={flaeche} fill={FARBE_AUFRUFE} opacity="0.12" />
          <path d={linie("aufrufe")} fill="none" stroke={FARBE_AUFRUFE} strokeWidth="2" strokeLinejoin="round" />
          <path d={linie("besuche")} fill="none" stroke={FARBE_BESUCHE} strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )}
      {punkte.length > 1 && (
        <div className="flex justify-between text-[0.72rem] text-[var(--fg-subtle)] mt-1">
          <span>{kurzDatum(punkte[0].tag)}</span><span>{kurzDatum(punkte[punkte.length - 1].tag)}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminUebersicht() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [kurz, setKurz] = useState<Kurz | null>(null);
  const [insta, setInsta] = useState<Insta | null>(null);
  const [geplant, setGeplant] = useState<number | null>(null);
  const [anfragen, setAnfragen] = useState<Anfrage[]>([]);
  const [fehler, setFehler] = useState("");

  // Jede Quelle fuer sich – faellt eine aus, steht der Rest trotzdem.
  useEffect(() => {
    api("/api/admin/stats").then(d => setStats(d.stats)).catch(e => setFehler(e.message));
    api("/api/studio/monitoring?tage=30").then(d => setKurz(d as Kurz)).catch(() => setKurz(null));
    api("/api/studio/instagram").then(d => setInsta(d as Insta)).catch(() => setInsta(null));
    api("/api/studio/warteschlange").then(d => setGeplant(Array.isArray(d.geplant) ? d.geplant.length : 0)).catch(() => setGeplant(null));
    api("/api/admin/anfragen").then(d => setAnfragen((d.anfragen || []).slice(0, 5))).catch(() => setAnfragen([]));
  }, []);

  const b = kurz?.besucher; const a = kurz?.anfragen; const dv = kurz?.davor; const s = kurz?.speicher;
  const quote = a?.ok && b?.ok && b.besuche > 0 ? (a.gesamt / b.besuche) * 100 : null;

  const medien = insta?.medien || [];
  const follower = insta?.profil?.follower ?? kurz?.instagram?.follower ?? null;
  const beitraege = insta?.profil?.beitraege ?? kurz?.instagram?.beitraege ?? null;
  const reaktionen = medien.length
    ? Math.round(medien.reduce((n, m) => n + (m.likes || 0) + (m.kommentare || 0), 0) / medien.length) : null;
  const letzter = medien.map(m => m.zeitpunkt).filter(Boolean).sort().pop();
  const seitTagen = letzter ? Math.max(0, Math.floor((Date.now() - new Date(letzter).getTime()) / 86400000)) : null;

  const heute = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const monat = new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  return (
    <AdminShell titel="Übersicht" eyebrow={heute}>
      {fehler && (
        <div className="mon-block mon-fehler"><h2>Zahlen nicht abrufbar</h2><p>{fehler}</p></div>
      )}

      <Abschnitt icon={<ChartNoAxesColumn size={17} />} titel="Monitoring" weg="/admin/monitoring" wegText="Alle Zahlen ansehen">
        <div className="mon-kennzahlen">
          <Kachel titel="Besuche" href="/admin/monitoring" wert={b?.ok ? zahl(b.besuche) : "—"}
                  unter={b?.ok ? "letzte 30 Tage" : "Zählung noch ohne Daten"}
                  vergleich={b?.ok ? <Trend jetzt={b.besuche} davor={dv?.besuche} /> : null} />
          <Kachel titel="Seitenaufrufe" href="/admin/monitoring" wert={b?.ok ? zahl(b.aufrufe) : "—"}
                  unter="wie gründlich geschaut wird"
                  vergleich={b?.ok ? <Trend jetzt={b.aufrufe} davor={dv?.aufrufe} /> : null} />
          <Kachel titel="Anfragen" href="/admin/anfragen" wert={a?.ok ? zahl(a.gesamt) : "—"}
                  unter={stats ? `${zahl(stats.neueAnfragen)} neu` : "letzte 30 Tage"}
                  vergleich={a?.ok ? <Trend jetzt={a.gesamt} davor={dv?.anfragen} /> : null} />
          <Kachel titel="Anfrage je Besuch" href="/admin/monitoring"
                  wert={quote == null ? "—" : quote.toFixed(1).replace(".", ",") + " %"}
                  unter="grober Richtwert" />
        </div>
        {b?.ok && kurz && (
          <div className="mon-block !mb-0">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-[0.78rem] text-[var(--fg-subtle)]">
              <b className="text-[var(--fg)] uppercase tracking-wide text-[0.72rem]">Besucher im Verlauf</b>
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: FARBE_BESUCHE }} /> {zahl(b.besuche)} Besuche</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: FARBE_AUFRUFE }} /> {zahl(b.aufrufe)} Aufrufe</span>
            </div>
            <Verlauf proTag={b.proTag} von={kurz.von} bis={kurz.bis} />
          </div>
        )}
      </Abschnitt>

      <Abschnitt icon={<Camera size={17} />} titel="Instagram" weg="/admin/content" wegText="Beitrag vorbereiten">
        <div className="mon-kennzahlen !mb-0">
          <Kachel titel="Follower" href="/admin/instagram" wert={zahl(follower)}
                  unter={kurz?.instagram?.zuwachs != null ? `${kurz.instagram.zuwachs >= 0 ? "+" : ""}${kurz.instagram.zuwachs} in 30 Tagen` : ""} />
          <Kachel titel="Beiträge auf dem Profil" href="/admin/instagram" wert={zahl(beitraege)}
                  unter={geplant != null ? `${zahl(geplant)} eingeplant` : ""} />
          <Kachel titel="Reaktionen je Beitrag" href="/admin/instagram" wert={zahl(reaktionen)}
                  unter={medien.length ? `aus ${medien.length} Beiträgen` : "Likes und Kommentare"} />
          <Kachel titel="Seit dem letzten Beitrag" href="/admin/planen"
                  wert={seitTagen == null ? "—" : seitTagen === 1 ? "1 Tag" : `${seitTagen} Tage`}
                  unter={letzter ? datum(letzter) : ""} />
        </div>
      </Abschnitt>

      {/* Alle Bereiche untereinander, auch auf breiten Schirmen. */}
      <div>
        <Abschnitt icon={<Inbox size={17} />} titel="Letzte Anfragen" weg="/admin/anfragen" wegText="Alle Anfragen">
          <div className="mon-block !mb-0 !py-2">
            {anfragen.length === 0 ? (
              <p className="mon-leer py-3">Noch keine Anfrage eingegangen.</p>
            ) : (
              <ul className="mon-liste">
                {anfragen.map(x => (
                  <li key={x.id}>
                    <span className="mon-liste-name">
                      <b className="font-semibold text-[var(--fg)]">{x.name}</b>
                      {x.betrieb && <span className="text-[var(--fg-subtle)]"> · {x.betrieb}</span>}
                      <span className="block text-[0.74rem] text-[var(--fg-subtle)]">{datum(x.erstellt_am)}</span>
                    </span>
                    <span className="chip px-2.5 py-0.5 text-xs font-medium"
                          style={x.status === "neu" ? { background: "var(--accent)", color: "#fff", borderColor: "transparent" } : undefined}>
                      {STATUS_WORT[x.status] || x.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Abschnitt>

        <div>
          <Abschnitt icon={<Euro size={17} />} titel={`Finanzen · ${monat}`} weg="/admin/finanzen" wegText="Zu den Finanzen">
            <div className="mon-kennzahlen !mb-0">
              <Kachel titel="Einnahmen" href="/admin/finanzen" wert={stats ? euro(stats.einnahmenCent) : "—"} />
              <Kachel titel="Ausgaben" href="/admin/finanzen" wert={stats ? euro(stats.ausgabenCent) : "—"} />
              <Kachel titel="Saldo" href="/admin/finanzen" wert={stats ? euro(stats.saldoCent) : "—"} />
            </div>
          </Abschnitt>

          <Abschnitt icon={<Images size={17} />} titel="Galerie & Dokumente" weg="/admin/galerie" wegText="Zur Galerie">
            <div className="mon-kennzahlen !mb-0">
              <Kachel titel="Bilder" href="/admin/galerie" wert={s?.ok ? zahl(s.bilder) : "—"}
                      unter={s?.ok ? `${groesse(s.bytes)} · ${String(s.anteil).replace(".", ",")} % von 9,5 GB` : ""} />
              <Kachel titel="Dokumente" href="/admin/dokumente" wert={stats ? zahl(stats.dokumente) : "—"} unter="Rechnungen & Belege" />
            </div>
          </Abschnitt>
        </div>
      </div>
    </AdminShell>
  );
}
