"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import AdminShell, { api } from "@/components/admin/AdminShell";

// Aufbau und Optik wie das Monitoring im Autohaus-Admin (Diezmann): vier
// Kennzahlen, der Besucherverlauf ueber die volle Breite, darunter die
// Anfragen und zum Schluss Seiten und Herkunft nebeneinander.
// Die Klassen (.mon-*, .viz-*, .zeitwahl-*) stehen in globals.css.

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

type Stand = {
  tage: number;
  von: string;
  bis: string;
  anfragen: Anfragen;
  besucher: Besucher;
  davor: { anfragen: number | null; besuche: number | null; aufrufe: number | null } | null;
};

// Zwei Reihen, klar unterscheidbar auch ohne Farbsehen: dunkel und hell.
const FARBE_BESUCHE = "#12557F";
const FARBE_AUFRUFE = "#4DA3E0";

const STATUS = [
  { schluessel: "neu", wort: "Neu" },
  { schluessel: "in_bearbeitung", wort: "In Bearbeitung" },
  { schluessel: "beantwortet", wort: "Beantwortet" },
  { schluessel: "archiviert", wort: "Archiviert" },
];

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
  anfragenStatus:
    "Gezählt wird auf dem Server, beim tatsächlichen Absenden – nicht im Browser. Der Status ist " +
    "der, den die Anfrage unter „Anfragen“ gerade hat.",
  seiten:
    "Zählt Seitenaufrufe, nicht Besuche. Die Startseite liegt fast immer vorn, weil die meisten " +
    "dort einsteigen.",
  herkunft:
    "Klicks innerhalb der Website sind herausgerechnet – sonst wäre die eigene Domain die größte " +
    "Zeile und würde Google verdecken. „Direkt / Lesezeichen“ heißt: eingetippt, gespeichert, oder " +
    "aus WhatsApp bzw. einem E-Mail-Programm heraus, die den Verweis nicht mitschicken.",
};

// "Gesamt" steht vorn und ist die Voreinstellung: beim Öffnen soll man
// alles sehen, eingegrenzt wird bei Bedarf.
const ZEITRAEUME = [
  { wert: "alles", titel: "Gesamt" },
  { wert: "7", titel: "Letzte 7 Tage" },
  { wert: "30", titel: "Letzte 30 Tage" },
  { wert: "90", titel: "Letzte 90 Tage" },
];

const zahl = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("de-DE"));

const kurzDatum = (iso: string) =>
  new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

const langDatum = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso)
    .toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

function Info({ text }: { text: string }) {
  return (
    <span className="mon-info" tabIndex={0} role="note" aria-label={text}>
      <span className="mon-info-zeichen" aria-hidden="true">i</span>
      <span className="mon-info-blase" aria-hidden="true">{text}</span>
    </span>
  );
}

// Der Pfeil sagt nur etwas, wenn es einen Vorzeitraum gab. Unter einem
// Prozent Unterschied heisst "unveraendert" – ein Pfeil waere dort eine
// Behauptung ueber Rauschen.
function Trend({ jetzt, davor }: { jetzt: number | null | undefined; davor: number | null | undefined }) {
  if (jetzt == null || davor == null || davor === 0) return null;
  const diff = ((jetzt - davor) / davor) * 100;
  if (Math.abs(diff) < 1) return <span className="mon-trend gleich">unverändert</span>;
  const hoch = diff > 0;
  const wort = Math.abs(diff) >= 999 ? "999+" : Math.abs(diff).toFixed(0);
  return <span className={`mon-trend ${hoch ? "hoch" : "runter"}`}>{hoch ? "▲" : "▼"} {wort} %</span>;
}

function Kachel({ titel, wert, unter, hinweis, vergleich }: {
  titel: string; wert: string; unter: string; hinweis?: string; vergleich?: React.ReactNode;
}) {
  return (
    <div className="mon-kachel">
      <p className="mon-kachel-titel">{titel}{hinweis && <Info text={hinweis} />}</p>
      <p className="mon-kachel-wert">{wert}</p>
      <p className="mon-kachel-unter">{vergleich}{unter}</p>
    </div>
  );
}

function Karte({ titel, hinweis, children }: { titel: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <section className="mon-block">
      <h2>{titel}{hinweis && <Info text={hinweis} />}</h2>
      {children}
    </section>
  );
}

function Ausfall({ was, fehler }: { was: string; fehler?: string }) {
  return (
    <section className="mon-block mon-fehler">
      <h2>{was} nicht verfügbar</h2>
      <p>{fehler || "Unbekannter Grund."}</p>
    </section>
  );
}

// Erklaerungen unter einer Tabelle oder einem Diagramm, als abgesetzter Kasten.
function Legende({ paare }: { paare: [string, string][] }) {
  return (
    <dl className="mon-legende">
      {paare.map(([wort, text]) => (
        <div key={wort}><dt>{wort}</dt><dd>{text}</dd></div>
      ))}
    </dl>
  );
}

// Cloudflare liefert nur Tage MIT Daten. Fuer eine ehrliche Zeitachse
// muessen die Luecken als Null dazwischen.
function tageFuellen(proTag: Besucher["proTag"], vonIso: string, bisIso: string) {
  const nachTag = new Map(proTag.map(z => [z.tag, z]));
  const raus: { tag: string; besuche: number; aufrufe: number }[] = [];
  const d = new Date(vonIso.slice(0, 10) + "T00:00:00Z");
  const ende = new Date(bisIso.slice(0, 10) + "T00:00:00Z");
  for (let i = 0; d <= ende && i < 400; i++) {
    const tag = d.toISOString().slice(0, 10);
    const z = nachTag.get(tag);
    raus.push({ tag, besuche: z?.besuche ?? 0, aufrufe: z?.aufrufe ?? 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return raus;
}

// Runder Achsenschritt, damit 0/20/40/60/80 dasteht und nicht 0/16/33/49/65.
function runderSchritt(roh: number) {
  if (roh <= 1) return 1;
  const zehner = Math.pow(10, Math.floor(Math.log10(roh)));
  const rest = roh / zehner;
  const gewaehlt = rest <= 1 ? 1 : rest <= 2 ? 2 : rest <= 2.5 ? 2.5 : rest <= 5 ? 5 : 10;
  return Math.max(1, Math.round(gewaehlt * zehner));
}

// Besuche und Seitenaufrufe als zwei Linien. Gezeichnet in echter
// Pixelbreite (nicht per viewBox gestreckt), sonst wird die Schrift mit
// verzerrt. Ein Faden folgt der Maus und zeigt die Werte des Tages.
function Verlauf({ punkte }: { punkte: { tag: string; besuche: number; aufrufe: number }[] }) {
  const kasten = useRef<HTMLDivElement>(null);
  const [breite, setBreite] = useState(0);
  const [zeiger, setZeiger] = useState<number | null>(null);

  useEffect(() => {
    const el = kasten.current;
    if (!el) return;
    const beobachter = new ResizeObserver(e => setBreite(Math.max(280, Math.floor(e[0].contentRect.width))));
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  const hoehe = 250;
  const rand = { oben: 14, rechts: 14, unten: 26, links: 42 };
  const zeichenBreite = breite - rand.links - rand.rechts;
  const zeichenHoehe = hoehe - rand.oben - rand.unten;
  const stufen = 4;
  const hoechst = Math.max(1, ...punkte.map(p => Math.max(p.besuche, p.aufrufe)));
  const schritt = runderSchritt(hoechst / stufen);
  const obergrenze = schritt * stufen;

  const x = (i: number) => punkte.length === 1
    ? rand.links + zeichenBreite / 2
    : rand.links + (i / (punkte.length - 1)) * zeichenBreite;
  const y = (v: number) => rand.oben + zeichenHoehe - (v / obergrenze) * zeichenHoehe;
  const linie = (feld: "besuche" | "aufrufe") =>
    punkte.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[feld]).toFixed(1)}`).join(" ");

  // Nur so viele Datumsangaben, wie nebeneinander passen.
  const platz = Math.max(1, Math.floor(punkte.length / Math.max(2, Math.floor(zeichenBreite / 76))));
  const letzter = punkte.length - 1;

  const zeigen = (e: React.PointerEvent<SVGRectElement>) => {
    const kiste = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const anteil = (e.clientX - kiste.left - rand.links) / zeichenBreite;
    setZeiger(Math.max(0, Math.min(letzter, Math.round(anteil * letzter))));
  };

  const p = zeiger != null ? punkte[zeiger] : null;

  return (
    <div className="viz" ref={kasten} onPointerLeave={() => setZeiger(null)}>
      {breite > 0 && (
        <svg className="viz-svg" viewBox={`0 0 ${breite} ${hoehe}`} width={breite} height={hoehe} role="img"
             aria-label="Besuche und Seitenaufrufe im gewählten Zeitraum">
          {Array.from({ length: stufen + 1 }, (_, k) => {
            const yy = y(schritt * k);
            return (
              <g key={k}>
                <line className="viz-raster" x1={rand.links} y1={yy} x2={breite - rand.rechts} y2={yy} />
                <text className="viz-achse" x={rand.links - 8} y={yy + 4} textAnchor="end">
                  {zahl(Math.round(schritt * k))}
                </text>
              </g>
            );
          })}
          {punkte.map((pt, i) => {
            const istLetzter = i === letzter;
            if (i % platz !== 0 && !istLetzter) return null;
            // Beschriftungen, die der letzten zu nahe kaemen, entfallen –
            // sonst stehen zwei Daten uebereinander.
            if (!istLetzter && letzter - i < platz / 2) return null;
            return (
              <text key={pt.tag} className="viz-achse" x={x(i)} y={hoehe - 8}
                    textAnchor={i === 0 ? "start" : istLetzter ? "end" : "middle"}>
                {kurzDatum(pt.tag)}
              </text>
            );
          })}
          <path className="viz-linie" d={linie("aufrufe")} stroke={FARBE_AUFRUFE} />
          <path className="viz-linie" d={linie("besuche")} stroke={FARBE_BESUCHE} />
          <circle className="viz-ende" cx={x(letzter)} cy={y(punkte[letzter].aufrufe)} r="4" fill={FARBE_AUFRUFE} />
          <circle className="viz-ende" cx={x(letzter)} cy={y(punkte[letzter].besuche)} r="4" fill={FARBE_BESUCHE} />
          {p && zeiger != null && (
            <>
              <line className="viz-faden" x1={x(zeiger)} x2={x(zeiger)} y1={rand.oben} y2={rand.oben + zeichenHoehe} />
              <circle className="viz-treffer" cx={x(zeiger)} cy={y(p.aufrufe)} r="5" fill={FARBE_AUFRUFE} />
              <circle className="viz-treffer" cx={x(zeiger)} cy={y(p.besuche)} r="5" fill={FARBE_BESUCHE} />
            </>
          )}
          <rect x={rand.links} y={rand.oben} width={Math.max(0, zeichenBreite)} height={zeichenHoehe}
                fill="transparent" onPointerMove={zeigen} onPointerDown={zeigen} />
        </svg>
      )}
      {p && zeiger != null && (
        <div className={`viz-blase ${x(zeiger) / breite > 0.6 ? "links" : ""}`}
             style={{ left: `${(x(zeiger) / breite) * 100}%` }}>
          <p className="viz-blase-tag">{langDatum(p.tag)}</p>
          <p className="viz-blase-zeile"><i style={{ background: FARBE_BESUCHE }} /><b>{zahl(p.besuche)}</b> Besuche</p>
          <p className="viz-blase-zeile"><i style={{ background: FARBE_AUFRUFE }} /><b>{zahl(p.aufrufe)}</b> Seitenaufrufe</p>
        </div>
      )}
    </div>
  );
}

function Liste({ eintraege, leer }: { eintraege: { name: string; wert: number }[]; leer: string }) {
  if (!eintraege.length) return <p className="mon-leer">{leer}</p>;
  return (
    <ul className="mon-liste">
      {eintraege.map(e => (
        <li key={e.name}>
          <span className="mon-liste-name">{e.name}</span>
          <span className="mon-liste-wert">{zahl(e.wert)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MonitoringSeite() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [wahl, setWahl] = useState("alles");
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

  useEffect(() => { if (wahl !== "frei") laden(`tage=${wahl}`); }, [wahl, laden]);

  // Klick daneben schliesst die Tafel.
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
    setWahl("frei");
    laden(`von=${freiVon}&bis=${freiBis}`);
  };

  const a = stand?.anfragen;
  const b = stand?.besucher;
  const d = stand?.davor;

  const name = ZEITRAEUME.find(z => z.wert === wahl)?.titel ?? "Eigener Zeitraum";
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
  const tageMitAnfragen = (a?.proTag || []).filter(z => z.anzahl > 0);
  const hoechsterTag = Math.max(1, ...tageMitAnfragen.map(z => z.anzahl));

  return (
    <AdminShell titel="Monitoring" eyebrow="Zahlen & Auswertung">

      {/* Unter dem Titel, rechtsbuendig. Die Tafel klappt nach links auf,
          damit sie am rechten Rand nicht abgeschnitten wird. */}
      <div className="flex justify-end -mt-3 mb-5">
        <div className={`zeitwahl ${offen ? "offen" : ""}`} ref={tafel}>
          <button type="button" className="zeitwahl-knopf" onClick={() => setOffen(o => !o)}
                  aria-expanded={offen} aria-haspopup="dialog">
            <Calendar size={15} />
            <span>{name}</span>
            <ChevronDown size={13} className="zeitwahl-pfeil" />
          </button>
          {offen && (
            <div className="zeitwahl-tafel" role="dialog" aria-label="Zeitraum wählen">
              {ZEITRAEUME.map(z => (
                <button key={z.wert} type="button"
                        className={`zeitwahl-reihe ${wahl === z.wert ? "aktiv" : ""}`}
                        onClick={() => { setWahl(z.wert); setOffen(false); }}>
                  {z.titel}
                </button>
              ))}
              <div className="zeitwahl-frei">
                <p className="zeitwahl-frei-titel">Eigener Zeitraum</p>
                <div className="zeitwahl-felder">
                  <label htmlFor="mon-von">Von</label>
                  <input type="date" id="mon-von" value={freiVon} onChange={e => setFreiVon(e.target.value)} />
                  <label htmlFor="mon-bis">bis</label>
                  <input type="date" id="mon-bis" value={freiBis} onChange={e => setFreiBis(e.target.value)} />
                </div>
                <button type="button" className="zeitwahl-anwenden" onClick={freiAnwenden}>Anzeigen</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      {laedt && !stand ? (
        <p className="mon-leer">Zahlen werden geladen …</p>
      ) : !stand ? null : (
        <div style={{ opacity: laedt ? 0.6 : 1, transition: "opacity .2s ease" }}>
          {/* Faellt eine Quelle aus, fehlen ihre Kacheln, statt Nullen zu
              zeigen, die nach "nichts los" aussehen. */}
          <div className="mon-kennzahlen">
            {b?.ok && (
              <>
                <Kachel titel="Besuche" wert={zahl(b.besuche)} unter={spanne} hinweis={ERKLAERUNG.besuche}
                        vergleich={<Trend jetzt={b.besuche} davor={d?.besuche} />} />
                <Kachel titel="Seitenaufrufe" wert={zahl(b.aufrufe)} unter="wie gründlich geschaut wird"
                        hinweis={ERKLAERUNG.aufrufe}
                        vergleich={<Trend jetzt={b.aufrufe} davor={d?.aufrufe} />} />
              </>
            )}
            {a?.ok && (
              <Kachel titel="Anfragen" wert={zahl(a.gesamt)} unter={`${zahl(a.offen)} unbeantwortet`}
                      hinweis={ERKLAERUNG.anfragen}
                      vergleich={<Trend jetzt={a.gesamt} davor={d?.anfragen} />} />
            )}
            {quote != null && (
              <Kachel titel="Anfrage je Besuch" wert={quote.toFixed(1).replace(".", ",") + " %"}
                      unter="grober Richtwert" hinweis={ERKLAERUNG.quote} />
            )}
          </div>

          {b?.ok === false ? (
            <Ausfall was="Besucherzahlen" fehler={b.fehler} />
          ) : (
            <Karte titel="Besucher im Verlauf" hinweis={ERKLAERUNG.verlauf}>
              {b?.proTag?.length ? (
                <>
                  <div className="viz-legende">
                    <span><i style={{ background: FARBE_BESUCHE }} />Besuche</span>
                    <span><i style={{ background: FARBE_AUFRUFE }} />Seitenaufrufe</span>
                  </div>
                  <Verlauf punkte={tageFuellen(b.proTag, b.von || stand.von, stand.bis)} />
                  {kuerzer && <p className="mon-notiz">{kuerzer}</p>}
                </>
              ) : (
                <p className="mon-leer">Für diesen Zeitraum liegen keine Besucherdaten vor.</p>
              )}
            </Karte>
          )}

          {a?.ok === false ? (
            <Ausfall was="Anfragen" fehler={a.fehler} />
          ) : a && (
            <>
              <Karte titel="Anfragen nach Status" hinweis={ERKLAERUNG.anfragenStatus}>
                {a.gesamt ? (
                  <div className="mon-tabelle-huelle">
                    <table className="mon-tabelle">
                      <thead>
                        <tr><th>Status</th><th className="num">Anfragen</th></tr>
                      </thead>
                      <tbody>
                        {STATUS.filter(st => a.status?.[st.schluessel]).map(st => (
                          <tr key={st.schluessel}>
                            <td>{st.wort}</td>
                            <td className="num stark">{zahl(a.status[st.schluessel])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mon-leer">In diesem Zeitraum ist keine Anfrage eingegangen.</p>
                )}
              </Karte>

              {tageMitAnfragen.length > 0 && (
                <Karte titel="Anfragen pro Tag">
                  <div className="mon-balken" role="img" aria-label="Anfragen pro Tag">
                    {tageMitAnfragen.map(z => (
                      <div key={z.tag} className="mon-balken-spalte" title={`${z.tag}: ${zahl(z.anzahl)}`}>
                        <div className="mon-balken-wert"
                             style={{ height: `${Math.round((z.anzahl / hoechsterTag) * 100)}%` }} />
                        <span className="mon-balken-tag">{kurzDatum(z.tag)}</span>
                      </div>
                    ))}
                  </div>
                  <Legende paare={[
                    ["Gezeigt", "nur Tage, an denen etwas ankam."],
                    ["Höchstwert", `${zahl(hoechsterTag)} an einem Tag.`],
                  ]} />
                </Karte>
              )}
            </>
          )}

          {b?.ok && (
            <div className="mon-zwei">
              <Karte titel="Meistbesuchte Seiten" hinweis={ERKLAERUNG.seiten}>
                <Liste leer="Noch keine Daten."
                       eintraege={(b.proSeite || []).map(z => ({ name: z.pfad, wert: z.aufrufe }))} />
              </Karte>
              <Karte titel="Woher die Besucher kommen" hinweis={ERKLAERUNG.herkunft}>
                <Liste leer="Noch keine Verweise von außerhalb."
                       eintraege={(b.proHerkunft || []).map(z => ({
                         name: z.host === "direkt" ? "Direkt / Lesezeichen" : z.host, wert: z.aufrufe,
                       }))} />
              </Karte>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
