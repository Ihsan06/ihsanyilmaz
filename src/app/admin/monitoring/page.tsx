"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, TriangleAlert } from "lucide-react";
import AdminShell, { api } from "@/components/admin/AdminShell";

// Jede Quelle antwortet einzeln – faellt eine aus, steht sie mit ihrem Grund
// da und der Rest der Seite bleibt benutzbar.
type Fehlbar = { ok?: boolean; fehler?: string };

type Anfragen = Fehlbar & {
  gesamt: number;
  offen: number;
  status: Record<string, number>;
  proTag: { tag: string; anzahl: number }[];
};
type Besucher = Fehlbar & {
  von?: string;
  besuche: number;
  aufrufe: number;
  proTag: { tag: string; aufrufe: number; besuche: number }[];
  proSeite: { pfad: string; aufrufe: number }[];
  proHerkunft: { host: string; aufrufe: number }[];
};
type Instagram = Fehlbar & {
  punkte: { tag: string; follower: number; beitraege: number }[];
  follower: number | null;
  beitraege: number | null;
  zuwachs: number | null;
};
type Speicher = Fehlbar & { bilder: number; bytes: number; grenze: number; anteil: number };

type Stand = {
  tage: number;
  von: string;
  bis: string;
  anfragen: Anfragen;
  besucher: Besucher;
  instagram: Instagram;
  speicher: Speicher;
  davor: { anfragen: number | null; besuche: number | null; aufrufe: number | null } | null;
};

const STATUS_WORT: Record<string, string> = {
  neu: "Neu",
  in_bearbeitung: "In Bearbeitung",
  beantwortet: "Beantwortet",
  archiviert: "Archiviert",
};

const ERKLAERUNG = {
  besuche:
    "Ein Besuch ist eine Sitzung, nicht ein Klick: Wer sich vier Seiten ansieht, zählt einmal. " +
    "Erkannte Bots sind herausgerechnet.",
  aufrufe:
    "Jede einzeln aufgerufene Seite. Deshalb liegt diese Zahl immer über den Besuchen – sie zeigt, " +
    "wie gründlich geschaut wird.",
  anfragen:
    "Nachrichten aus dem Kontaktformular, die tatsächlich in der Datenbank gelandet sind. " +
    "Abgebrochene Versuche und aussortierte Bots sind nicht dabei.",
  quote:
    "Anfragen geteilt durch Besuche. Bewusst ein grober Richtwert: Wer heute schaut, schreibt oft " +
    "erst nächste Woche – dann fällt der Besuch in den einen Zeitraum und die Anfrage in den nächsten.",
  verlauf:
    "Gezählt wird ohne Cookies, direkt im Browser. Erkannte Bots sind herausgerechnet – deshalb " +
    "liegen diese Zahlen unter den Rohwerten aus dem Cloudflare-Bericht, in denen Suchmaschinen " +
    "und Scanner mitlaufen. Tage ohne Besuch werden als Null gezeichnet.",
  anfragenVerlauf:
    "Gezählt wird auf dem Server, beim tatsächlichen Absenden – nicht im Browser. Gespeichert wird " +
    "die Anfrage selbst, nichts darüber hinaus.",
  seiten:
    "Zählt Seitenaufrufe, nicht Besuche. Die Startseite liegt fast immer vorn, weil die meisten " +
    "dort einsteigen.",
  herkunft:
    "Klicks innerhalb der Website sind herausgerechnet – sonst wäre die eigene Domain die größte " +
    "Zeile und würde Google verdecken. „direkt“ heißt: eingetippt, gespeichert, oder aus WhatsApp " +
    "bzw. einem E-Mail-Programm heraus, die den Verweis nicht mitschicken.",
  instagram:
    "Der Stand wird einmal am Tag beim Abruf des Profils festgehalten. Der Zuwachs bezieht sich auf " +
    "den gewählten Zeitraum, nicht auf den Anfang der Aufzeichnung.",
  speicher:
    "Alle Bilder in der Galerie zusammen. Die Grenze von 9,5 GB ist selbst gesetzt, mit Abstand zu " +
    "den 10 GB des Gratis-Tarifs.",
};

const ZEITRAEUME = [
  { wert: "7", titel: "Letzte 7 Tage" },
  { wert: "30", titel: "Letzte 30 Tage" },
  { wert: "90", titel: "Letzte 90 Tage" },
  { wert: "alles", titel: "Gesamt" },
];

const zahl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("de-DE"));

const langDatum = (iso?: string | null) =>
  !iso ? "—"
    : new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

function groesse(bytes: number) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2).replace(".", ",") + " GB";
  return (bytes / 1024 ** 2).toFixed(1).replace(".", ",") + " MB";
}

// Kleines "i" neben einer Ueberschrift. Ueber title, damit es ohne eigenes
// Aufklapp-Werk auskommt und auch mit der Tastatur erreichbar ist.
function Info({ text }: { text: string }) {
  return (
    <span
      tabIndex={0}
      role="note"
      title={text}
      aria-label={text}
      className="inline-flex items-center justify-center ml-1.5 cursor-help align-middle"
      style={{
        width: 14, height: 14, borderRadius: "50%", fontSize: 9, fontWeight: 700,
        border: "1px solid var(--border)", color: "var(--fg-subtle)",
      }}
    >
      i
    </span>
  );
}

// Der Pfeil sagt nur etwas, wenn es einen Vorzeitraum gab. Unter einem
// Prozent Unterschied heisst "unveraendert" – ein Pfeil waere dort eine
// Behauptung ueber Rauschen.
function Trend({ jetzt, davor }: { jetzt: number | null | undefined; davor: number | null | undefined }) {
  if (jetzt == null || davor == null || davor === 0) return null;
  const diff = ((jetzt - davor) / davor) * 100;
  if (Math.abs(diff) < 1) {
    return <span className="text-xs mr-1.5" style={{ color: "var(--fg-subtle)" }}>unverändert</span>;
  }
  const hoch = diff > 0;
  const wort = Math.abs(diff) >= 999 ? "999+" : Math.abs(diff).toFixed(0);
  return (
    <span className="text-xs mr-1.5" style={{ color: hoch ? "#16a34a" : "#dc2626" }}>
      {hoch ? "▲" : "▼"} {wort} %
    </span>
  );
}

function Kachel({
  titel, wert, unter, hinweis, vergleich,
}: {
  titel: string; wert: string; unter: string; hinweis?: string; vergleich?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <p className="text-[var(--fg-subtle)] text-xs mb-1.5">
        {titel}{hinweis && <Info text={hinweis} />}
      </p>
      <p className="text-2xl font-semibold text-[var(--fg)] leading-tight">{wert}</p>
      <p className="text-xs text-[var(--fg-subtle)] mt-1">{vergleich}{unter}</p>
    </div>
  );
}

function Karte({
  titel, hinweis, children,
}: { titel: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-medium text-[var(--fg)] mb-3">
        {titel}{hinweis && <Info text={hinweis} />}
      </h2>
      {children}
    </div>
  );
}

function Ausfall({ was, fehler }: { was: string; fehler?: string }) {
  return (
    <div className="card p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
        <TriangleAlert size={15} style={{ color: "#d97706" }} /> {was} nicht verfügbar
      </h2>
      <p className="text-sm text-[var(--fg-subtle)] mt-1.5">{fehler || "Konnte nicht geladen werden."}</p>
    </div>
  );
}

// Tage ohne Wert als Null einzeichnen, sonst zieht die Linie eine Gerade
// ueber eine Luecke und behauptet Verkehr, den es nicht gab.
function tageFuellen(punkte: { tag: string; wert: number }[], vonIso: string, bisIso: string) {
  const habe = new Map(punkte.map(p => [p.tag, p.wert]));
  const raus: { tag: string; wert: number }[] = [];
  const d = new Date(vonIso.slice(0, 10) + "T00:00:00Z");
  const ende = new Date(bisIso.slice(0, 10) + "T00:00:00Z");
  let schutz = 0;
  while (d <= ende && schutz++ < 400) {
    const tag = d.toISOString().slice(0, 10);
    raus.push({ tag, wert: habe.get(tag) ?? 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return raus;
}

// Liniendiagramm als SVG, ohne Bibliothek: fuer einen Verlauf reicht ein
// Polygonzug, und der laedt nichts nach.
function Linie({ punkte, farbe = "var(--accent)" }: { punkte: { tag: string; wert: number }[]; farbe?: string }) {
  if (punkte.length < 2) {
    return <p className="text-[var(--fg-subtle)] text-sm">Zu wenig Daten für einen Verlauf.</p>;
  }
  const B = 600, H = 140, rand = { oben: 8, unten: 18, links: 30, rechts: 6 };
  const hoechst = Math.max(...punkte.map(p => p.wert), 1);
  const x = (i: number) => rand.links + (i / (punkte.length - 1)) * (B - rand.links - rand.rechts);
  const y = (w: number) => rand.oben + (1 - w / hoechst) * (H - rand.oben - rand.unten);
  const pfad = punkte.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.wert).toFixed(1)}`).join(" ");
  const flaeche = `${pfad} L${x(punkte.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;

  return (
    <svg viewBox={`0 0 ${B} ${H}`} width="100%" height={H} role="img"
         aria-label={`Verlauf, Höchstwert ${hoechst}`}>
      {[0, hoechst / 2, hoechst].map((w, i) => (
        <g key={i}>
          <line x1={rand.links} x2={B - rand.rechts} y1={y(w)} y2={y(w)}
                stroke="var(--border)" strokeWidth="1" />
          <text x={rand.links - 5} y={y(w) + 3} textAnchor="end"
                fontSize="9" fill="var(--fg-subtle)">{Math.round(w)}</text>
        </g>
      ))}
      <path d={flaeche} fill={farbe} opacity="0.12" />
      <path d={pfad} fill="none" stroke={farbe} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />
      {punkte.map((p, i) => (
        <circle key={p.tag} cx={x(i)} cy={y(p.wert)} r="6" fill="transparent">
          <title>{`${p.tag}: ${zahl(p.wert)}`}</title>
        </circle>
      ))}
      <text x={rand.links} y={H - 4} fontSize="9" fill="var(--fg-subtle)">{punkte[0].tag}</text>
      <text x={B - rand.rechts} y={H - 4} textAnchor="end" fontSize="9"
            fill="var(--fg-subtle)">{punkte[punkte.length - 1].tag}</text>
    </svg>
  );
}

function Liste({ eintraege }: { eintraege: { name: string; wert: number }[] }) {
  if (!eintraege.length) return <p className="text-[var(--fg-subtle)] text-sm">Noch keine Daten.</p>;
  return (
    <ul className="text-sm">
      {eintraege.map(e => (
        <li key={e.name} className="flex justify-between gap-3 py-1 border-b last:border-0"
            style={{ borderColor: "var(--border)" }}>
          <span className="text-[var(--fg-muted)] truncate">{e.name}</span>
          <span className="text-[var(--fg)] shrink-0 tabular-nums">{zahl(e.wert)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MonitoringSeite() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [wahl, setWahl] = useState("30");
  const [offen, setOffen] = useState(false);
  const [freiVon, setFreiVon] = useState("");
  const [freiBis, setFreiBis] = useState("");
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState("");
  const tafel = useRef<HTMLDivElement>(null);

  const laden = useCallback((abfrage: string) => {
    setLaedt(true); setFehler("");
    api(`/api/studio/monitoring?${abfrage}`)
      .then(d => setStand(d as Stand))
      .catch(e => setFehler(e instanceof Error ? e.message : "Ging nicht."))
      .finally(() => setLaedt(false));
  }, []);

  useEffect(() => { laden(`tage=${wahl}`); }, [wahl, laden]);

  // Klick daneben schliesst die Tafel – sonst bliebe sie offen stehen,
  // waehrend man schon wieder woanders liest.
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent) => {
      if (tafel.current && !tafel.current.contains(e.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);

  const freiAnwenden = () => {
    if (!freiVon || !freiBis) { setFehler("Bitte beide Daten angeben."); return; }
    setOffen(false);
    laden(`von=${freiVon}&bis=${freiBis}`);
  };

  const a = stand?.anfragen;
  const b = stand?.besucher;
  const i = stand?.instagram;
  const s = stand?.speicher;
  const d = stand?.davor;

  const name = wahl === "alles" ? "Gesamt"
    : ZEITRAEUME.find(z => z.wert === wahl)?.titel ?? "Eigener Zeitraum";
  const spanne = stand ? `${langDatum(stand.von)} – ${langDatum(stand.bis)}` : "";

  // Cloudflare haelt Besucherzahlen nur ein halbes Jahr vor. Reicht der
  // gewaehlte Zeitraum weiter zurueck, muss das dabeistehen – sonst wirkt
  // der abgeschnittene Anfang wie ein Einbruch.
  const kuerzer = b?.ok && b.von && stand
    && new Date(b.von).getTime() - new Date(stand.von).getTime() > 86400000
    ? `Weiter zurück als ${langDatum(b.von)} reichen die Besucherzahlen nicht: `
      + "Cloudflare hält sie nur ein halbes Jahr vor. Die Anfragen darunter zählen den ganzen Zeitraum."
    : "";

  const quote = a?.ok && b?.ok && b.besuche > 0 ? (a.gesamt / b.besuche) * 100 : null;

  // Rechts neben der Ueberschrift wie in der Autohaus-Demo; die Tafel klappt
  // nach links auf, damit sie am rechten Rand nicht abgeschnitten wird.
  const zeitwahl = (
    <div className="flex flex-col items-end gap-1.5">
      <div className="relative" ref={tafel}>
        <button
          onClick={() => setOffen(o => !o)}
          aria-expanded={offen}
          aria-haspopup="dialog"
          className="chip px-3 py-2 text-sm flex items-center gap-2"
        >
          <Calendar size={15} /> {name} <ChevronDown size={13} />
        </button>
        {offen && (
          <div
            role="dialog"
            aria-label="Zeitraum wählen"
            className="absolute right-0 z-30 mt-1.5 card p-2"
            style={{ minWidth: 250, boxShadow: "0 10px 30px rgba(7,26,43,0.18)" }}
          >
            {ZEITRAEUME.map(z => (
              <button
                key={z.wert}
                onClick={() => { setWahl(z.wert); setOffen(false); }}
                className="w-full text-left px-3 py-2 rounded-[7px] text-sm"
                style={wahl === z.wert
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--fg-muted)" }}
              >
                {z.titel}
              </button>
            ))}
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs text-[var(--fg-subtle)] px-3 mb-1.5">Eigener Zeitraum</p>
              <div className="flex items-center gap-2 px-3">
                <input type="date" value={freiVon} onChange={e => setFreiVon(e.target.value)}
                       className="feld text-xs flex-1" aria-label="Von" />
                <span className="text-xs text-[var(--fg-subtle)]">bis</span>
                <input type="date" value={freiBis} onChange={e => setFreiBis(e.target.value)}
                       className="feld text-xs flex-1" aria-label="bis" />
              </div>
              <button onClick={freiAnwenden}
                      className="btn-primary w-full mt-2 py-1.5 text-sm">Anzeigen</button>
            </div>
          </div>
        )}
      </div>
      {stand && <span className="text-[var(--fg-subtle)] text-xs">{spanne}</span>}
    </div>
  );

  return (
    <AdminShell
      titel="Monitoring"
      eyebrow="Zahlen & Auswertung"
      lead="Was auf der Website passiert – und was davon zu einer Anfrage wird."
      aktion={zeitwahl}
    >

      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      {laedt && !stand ? (
        <p className="text-[var(--fg-muted)]">Zahlen werden geladen …</p>
      ) : !stand ? null : (
        <>
          {/* Vier Kacheln – zwei aus der Besucherzaehlung, zwei aus der
              eigenen Datenbank. Faellt eine Quelle aus, fehlen ihre Kacheln,
              statt vier Nullen zu zeigen, die nach "nichts los" aussehen. */}
          <div className="grid gap-3 mb-5"
               style={{ gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))" }}>
            {b?.ok && (
              <>
                <Kachel titel="Besuche" wert={zahl(b.besuche)} unter={spanne}
                        hinweis={ERKLAERUNG.besuche}
                        vergleich={<Trend jetzt={b.besuche} davor={d?.besuche} />} />
                <Kachel titel="Seitenaufrufe" wert={zahl(b.aufrufe)} unter="wie gründlich geschaut wird"
                        hinweis={ERKLAERUNG.aufrufe}
                        vergleich={<Trend jetzt={b.aufrufe} davor={d?.aufrufe} />} />
              </>
            )}
            {a?.ok && (
              <Kachel titel="Anfragen" wert={zahl(a.gesamt)}
                      unter={`${zahl(a.offen)} unbeantwortet`}
                      hinweis={ERKLAERUNG.anfragen}
                      vergleich={<Trend jetzt={a.gesamt} davor={d?.anfragen} />} />
            )}
            {quote != null && (
              <Kachel titel="Anfrage je Besuch"
                      wert={quote.toFixed(1).replace(".", ",") + " %"}
                      unter="grober Richtwert" hinweis={ERKLAERUNG.quote} />
            )}
            {s?.ok && (
              <Kachel titel="Bildspeicher" wert={groesse(s.bytes)}
                      unter={`${zahl(s.bilder)} Bilder · ${String(s.anteil).replace(".", ",")} % von 9,5 GB`}
                      hinweis={ERKLAERUNG.speicher} />
            )}
          </div>

          <div className="grid gap-4"
               style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
            {b?.ok === false ? (
              <Ausfall was="Besucherzahlen" fehler={b.fehler} />
            ) : b?.proTag?.length ? (
              <Karte titel="Besucher im Verlauf" hinweis={ERKLAERUNG.verlauf}>
                <Linie punkte={tageFuellen(
                  b.proTag.map(z => ({ tag: z.tag, wert: z.besuche })),
                  b.von || stand.von, stand.bis)} />
                {kuerzer && <p className="text-xs text-[var(--fg-subtle)] mt-2">{kuerzer}</p>}
              </Karte>
            ) : (
              <Karte titel="Besucher im Verlauf" hinweis={ERKLAERUNG.verlauf}>
                <p className="text-[var(--fg-subtle)] text-sm">
                  Für diesen Zeitraum liegen keine Besucherdaten vor.
                </p>
              </Karte>
            )}

            {a?.ok === false ? (
              <Ausfall was="Anfragen" fehler={a.fehler} />
            ) : (
              <Karte titel="Anfragen im Verlauf" hinweis={ERKLAERUNG.anfragenVerlauf}>
                {a?.proTag?.length ? (
                  <Linie punkte={tageFuellen(
                    a.proTag.map(z => ({ tag: z.tag, wert: z.anzahl })), stand.von, stand.bis)} />
                ) : (
                  <p className="text-[var(--fg-subtle)] text-sm">
                    In diesem Zeitraum ist keine Anfrage eingegangen.
                  </p>
                )}
                {a && Object.keys(a.status || {}).length > 0 && (
                  <div className="mt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <table className="w-full text-sm mt-2">
                      <tbody>
                        {Object.entries(a.status).map(([k, n]) => (
                          <tr key={k}>
                            <td className="py-1 text-[var(--fg-muted)]">{STATUS_WORT[k] || k}</td>
                            <td className="py-1 text-right text-[var(--fg)] tabular-nums">{zahl(n)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Karte>
            )}

            {b?.ok && (
              <>
                <Karte titel="Meistbesuchte Seiten" hinweis={ERKLAERUNG.seiten}>
                  <Liste eintraege={(b.proSeite || []).map(z => ({ name: z.pfad, wert: z.aufrufe }))} />
                </Karte>
                <Karte titel="Woher die Besucher kommen" hinweis={ERKLAERUNG.herkunft}>
                  <Liste eintraege={(b.proHerkunft || []).map(z => ({
                    name: z.host === "direkt" ? "direkt / Lesezeichen" : z.host, wert: z.aufrufe,
                  }))} />
                </Karte>
              </>
            )}

            {i?.ok && i.punkte?.length > 1 && (
              <Karte titel="Follower im Verlauf" hinweis={ERKLAERUNG.instagram}>
                <Linie punkte={i.punkte.map(z => ({ tag: z.tag, wert: z.follower }))} />
              </Karte>
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}
