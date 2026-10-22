"use client";
// Vertrieb → Übersicht: die wichtigsten Zahlen aus Betrieben und Post auf
// einen Blick – Trichter, Kosten, Rückläufer, Verlauf, Aufgaben, Dienste.
// Alles kommt in einem Aufruf von /api/admin/akquise/uebersicht.
import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, ExternalLink, Globe, Mail, Phone, RefreshCw } from "lucide-react";
import AdminShell, { api, datum, euro } from "@/components/admin/AdminShell";
import { KAT_FARBE } from "../Karte";
import "./uebersicht.css";

type Kennzahlen = { briefe: number; zurueck: number; geoeffnet: number; demo: number; kontakt: number; kosten_cent: number };
type Gruppe = Kennzahlen & { gruppe: string };
type Woche = Kennzahlen & { woche: string };
type Aktivitaet = { zeit: string; art: "aufruf" | "demo" | "kontakt" | "zurueck"; id: number; aufrufe: number; name: string | null; ort: string | null };
// Ein Betrieb, der auf den Brief reagiert hat (Kontakt erlaubt oder Interesse gezeigt).
type Lead = {
  id: number; token: string; gesendet_am: string | null; aufrufe: number; zuletzt_aufgerufen: string | null; demo_geoeffnet: string | null; befunde: string | null;
  kontakt_erlaubt?: string | null; briefe_bisher?: number;
  betrieb_id: number; name: string; ort: string | null; telefon: string | null; email: string | null; website: string | null;
  kategorie: string | null; google_bewertung: number | null; google_anzahl: number | null;
};
type Rueck = { id: number; zurueck_am: string | null; gesendet_am: string | null; empfaenger: string | null; betrieb_id: number | null; name: string | null; strasse: string | null; plz: string | null; ort: string | null; google: number; im_korb: number };
type Bestand = { kategorie: string; alle: number; versandfertig: number; stark: number };
type Daten = {
  gesamt: Kennzahlen & { betriebe: number; erster: string | null; letzter: string | null };
  monat: Kennzahlen;
  nach_kategorie: Gruppe[]; nach_region: Gruppe[]; wochen: Woche[];
  aktivitaet: Aktivitaet[]; kontakte: Lead[]; warm: Lead[]; ruecklaeufer: Rueck[]; bestand: Bestand[];
  betriebe: { aktiv: number; auswahl: number; kunden: number; papierkorb: number };
  offen: { entwurf: number; freigegeben: number; fehler: number };
  dienste: {
    letterxpress: { eingerichtet: boolean; modus: string; guthaben_cent: number | null; preis_cent: number | null };
    google: { monat: string; genutzt: number; grenze: number };
    suchlauf: { region?: string; gefunden?: number; neu?: number; fehler?: string | null; zeitpunkt?: string };
  };
};

const KAT_LABEL: Record<string, string> = {
  ohne_website: "Ohne Website", nur_boerse: "Nur Börse", baukasten: "Baukasten", veraltet: "Veraltet",
  mittel: "Mittel", gepflegt: "Gepflegt", offen: "Offen",
};
const AKT_LABEL: Record<Aktivitaet["art"], string> = {
  aufruf: "QR-Code geöffnet", demo: "Demo angesehen", kontakt: "Kontakt erlaubt", zurueck: "Rückläufer",
};

const zahl = (n?: number | null) => (n == null ? "—" : n.toLocaleString("de-DE"));

// Zahl, die beim Laden in ~0,7 s von 0 hochzaehlt (ohne Bewegung, wenn der
// Nutzer reduzierte Bewegung eingestellt hat).
function Hochzaehlen({ wert, format }: { wert: number | null | undefined; format: (n: number) => string }) {
  const [jetzt, setJetzt] = useState<number | null>(null);
  useEffect(() => {
    if (wert == null) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now(), dauer = still ? 0 : 700;
    let rahmen = 0;
    const schritt = (t: number) => {
      const p = dauer ? Math.min(1, (t - start) / dauer) : 1;
      setJetzt(wert * (1 - Math.pow(1 - p, 3)));
      if (p < 1) rahmen = requestAnimationFrame(schritt);
    };
    rahmen = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(rahmen);
  }, [wert]);
  return <>{wert == null ? "—" : format(jetzt ?? 0)}</>;
}
const quote = (teil?: number, ganz?: number) => (ganz ? `${(Math.round(((teil || 0) / ganz) * 1000) / 10).toLocaleString("de-DE")} %` : "—");
const telLink = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;
const befundAnzahl = (roh: string | null) => { try { return (JSON.parse(roh || "[]") as unknown[]).length; } catch { return 0; } };
const domain = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");

// Karte je Betrieb unter „Wer reagiert hat“: was passiert ist, Eckdaten, Aktionen.
function LeadKarte({ l, kontakt }: { l: Lead; kontakt: boolean }) {
  const zustand = kontakt && l.kontakt_erlaubt
    ? { klasse: "kontakt", text: `Kontakt erlaubt · ${vorWann(l.kontakt_erlaubt)}` }
    : l.demo_geoeffnet
      ? { klasse: "demo", text: `Demo angesehen · ${vorWann(l.demo_geoeffnet)}` }
      : { klasse: "seite", text: `QR-Code ${l.aufrufe}× geöffnet` };
  return (
    <article className={`vu-lead ${zustand.klasse}`}>
      <header>
        <div>
          <p className="vu-lead-name">{l.name}</p>
          <p className="vu-leise">{[l.ort, KAT_LABEL[l.kategorie || ""] || null].filter(Boolean).join(" · ")}</p>
        </div>
        <span className={`vu-lead-zustand ${zustand.klasse}`}>{zustand.text}</span>
      </header>
      <dl className="vu-lead-daten">
        <div><dt>Brief</dt><dd>{l.gesendet_am ? datum(l.gesendet_am) : "—"}{l.briefe_bisher && l.briefe_bisher > 1 ? ` · ${l.briefe_bisher}. Brief` : ""}</dd></div>
        <div><dt>QR-Code geöffnet</dt><dd>{l.aufrufe ? `${l.aufrufe}×${l.zuletzt_aufgerufen ? `, zuletzt ${vorWann(l.zuletzt_aufgerufen)}` : ""}` : "—"}</dd></div>
        <div><dt>Demo</dt><dd>{l.demo_geoeffnet ? datum(l.demo_geoeffnet) : "nicht geöffnet"}</dd></div>
        <div><dt>Google</dt><dd>{l.google_anzahl != null ? `★ ${String(l.google_bewertung ?? "").replace(".", ",")} · ${l.google_anzahl} Bewertungen` : "—"}</dd></div>
        <div><dt>Im Brief</dt><dd>{befundAnzahl(l.befunde)} Befunde</dd></div>
        <div><dt>Telefon</dt><dd>{l.telefon || "nicht hinterlegt"}</dd></div>
      </dl>
      <footer>
        {l.telefon && <a className={kontakt ? "btn-primary vu-lead-haupt" : "akq-knopf"} href={telLink(l.telefon)}><Phone size={13} /> Anrufen</a>}
        {kontakt && l.email && <a className="akq-knopf" href={`mailto:${l.email}`}><Mail size={13} /> E-Mail</a>}
        {l.website && <a className="akq-knopf" href={l.website} target="_blank" rel="noopener noreferrer"><Globe size={13} /> {domain(l.website)}</a>}
        <a className="akq-knopf" href={`/fuer/${l.token}`} target="_blank" rel="noopener noreferrer" title="Was der Betrieb gesehen hat"><ExternalLink size={13} /> Seite</a>
        {!kontakt && <a className="akq-knopf" href={`/admin/akquise/post?betrieb=${l.betrieb_id}`}>Zweiten Brief <ArrowRight size={12} /></a>}
      </footer>
    </article>
  );
}
// „vor 3 Std.“ für die Aktivitaet; aelter als eine Woche: Datum.
function vorWann(iso: string) {
  const t = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z")).getTime();
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 60) return `vor ${Math.max(1, min)} Min.`;
  if (min < 60 * 24) return `vor ${Math.round(min / 60)} Std.`;
  if (min < 60 * 24 * 2) return "gestern";
  if (min < 60 * 24 * 7) return `vor ${Math.round(min / 1440)} Tagen`;
  return datum(iso);
}

export default function VertriebUebersicht() {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  const holen = useCallback(() => api("/api/admin/akquise/uebersicht")
    .then(x => { setD(x as Daten); setFehler(""); })
    .catch(e => setFehler(e instanceof Error ? e.message : "Konnte nicht laden."))
    .finally(() => setLaedt(false)), []);
  useEffect(() => { holen(); }, [holen]);
  const laden = () => { setLaedt(true); holen(); };

  const g = d?.gesamt;
  const lxp = d?.dienste.letterxpress;
  const reichtFuer = lxp?.guthaben_cent != null && lxp?.preis_cent ? Math.floor(lxp.guthaben_cent / lxp.preis_cent) : null;
  const reaktionen = (g?.demo || 0) + (g?.kontakt || 0);
  const maxWoche = Math.max(1, ...(d?.wochen || []).map(w => w.briefe));

  // Trichter: jede Stufe als Anteil der verschickten Briefe.
  const stufen = g ? [
    { titel: "Verschickt", wert: g.briefe, hinweis: `an ${zahl(g.betriebe)} Betriebe` },
    { titel: "Angekommen", wert: g.briefe - (g.zurueck || 0), hinweis: `${zahl(g.zurueck)} Rückläufer` },
    { titel: "QR-Code geöffnet", wert: g.geoeffnet, hinweis: quote(g.geoeffnet, g.briefe) },
    { titel: "Demo angesehen", wert: g.demo, hinweis: quote(g.demo, g.briefe) },
    { titel: "Kontakt erlaubt", wert: g.kontakt, hinweis: quote(g.kontakt, g.briefe) },
  ] : [];

  return (
    <AdminShell titel="Übersicht" eyebrow="Vertrieb" lead="Was die Briefe bringen, was sie kosten und was als Nächstes zu tun ist.">
      {fehler && <p className="mb-4 text-sm" style={{ color: "#dc2626" }}>{fehler}</p>}

      <div className="vu-kopf">
        <span className="vu-leise">{g?.erster ? `Briefe seit ${datum(g.erster)} · zuletzt ${datum(g.letzter)}` : laedt ? "Wird geladen …" : "Noch keine Briefe verschickt."}</span>
        {!!(d?.offen.fehler || d?.offen.freigegeben || d?.offen.entwurf) && (
          <a className="vu-offen" href="/admin/akquise/post">
            {[d?.offen.entwurf ? `${d.offen.entwurf} Entwürfe` : "", d?.offen.freigegeben ? `${d.offen.freigegeben} freigegeben, nicht gesendet` : "", d?.offen.fehler ? `${d.offen.fehler} mit Fehler` : ""].filter(Boolean).join(" · ")}
            <ArrowRight size={13} />
          </a>
        )}
        <button type="button" className="akq-knopf" onClick={laden} disabled={laedt}><RefreshCw size={13} className={laedt ? "akq-dreht" : undefined} /> Aktualisieren</button>
      </div>

      {/* Kopfzahlen */}
      <div className={`vu-kacheln${d ? "" : " laedt"}`}>
        <div className="vu-kachel">
          <p className="vu-titel">Briefe verschickt</p>
          <p className="vu-wert"><Hochzaehlen wert={g?.briefe} format={n => zahl(Math.round(n))} /></p>
          <p className="vu-unter">{d?.monat ? `${new Date().toLocaleDateString("de-DE", { month: "long" })}: ${zahl(d.monat.briefe)}` : ""}</p>
        </div>
        <div className="vu-kachel">
          <p className="vu-titel">QR-Code geöffnet</p>
          <p className="vu-wert">{g?.briefe ? <Hochzaehlen wert={(g.geoeffnet / g.briefe) * 100} format={n => `${(Math.round(n * 10) / 10).toLocaleString("de-DE")} %`} /> : "—"}</p>
          <p className="vu-unter">{zahl(g?.geoeffnet)} von {zahl(g?.briefe)} Betrieben</p>
        </div>
        <div className={`vu-kachel${g?.kontakt ? " gut" : ""}`}>
          <p className="vu-titel">Kontakt erlaubt</p>
          <p className="vu-wert"><Hochzaehlen wert={g?.kontakt} format={n => zahl(Math.round(n))} /></p>
          <p className="vu-unter">{zahl(g?.demo)} {g?.demo === 1 ? "hat" : "haben"} die Demo angesehen</p>
        </div>
        <div className="vu-kachel">
          <p className="vu-titel">Ausgegeben</p>
          <p className="vu-wert"><Hochzaehlen wert={g ? g.kosten_cent || 0 : null} format={n => euro(Math.round(n))} /></p>
          <p className="vu-unter">{reaktionen ? `${euro(Math.round((g?.kosten_cent || 0) / reaktionen))} je Reaktion` : "noch keine Reaktion"}</p>
        </div>
        <div className={`vu-kachel${reichtFuer != null && reichtFuer < 10 ? " warn" : ""}`}>
          <p className="vu-titel">Guthaben</p>
          <p className="vu-wert"><Hochzaehlen wert={lxp?.guthaben_cent} format={n => euro(Math.round(n))} /></p>
          <p className="vu-unter">{reichtFuer != null ? `reicht für ca. ${zahl(reichtFuer)} Briefe` : "LetterXpress"}</p>
        </div>
      </div>

      <div className={`vu-raster${d ? " da" : ""}`}>
        {/* Trichter */}
        <section className="mon-block vu-block vu-s-trichter">
          <h2>Vom Brief zum Gespräch</h2>
          <ol className="vu-trichter">
            {stufen.map(s => (
              <li key={s.titel} title={`${s.titel}: ${zahl(s.wert)} (${quote(s.wert, g?.briefe)} der Briefe)`}>
                <span className="vu-trichter-titel">{s.titel}</span>
                <span className="vu-trichter-spur"><i style={{ width: `${g?.briefe ? Math.max(1.5, (s.wert / g.briefe) * 100) : 0}%` }} /></span>
                <b>{zahl(s.wert)}</b>
                <span className="vu-leise">{s.hinweis}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Verlauf: Briefe je Woche, darunter die Kosten der Woche */}
        <section className="mon-block vu-block vu-s-wochen">
          <div className="vu-block-kopf">
            <h2>Briefe je Woche</h2>
            {g && <span className="vu-leise">{zahl(g.briefe)} Briefe · {euro(g.kosten_cent || 0)}</span>}
          </div>
          {!d?.wochen.length ? <p className="mon-leer">Noch keine Briefe.</p> : (
            <div className="vu-wochen" role="list">
              {d.wochen.map(w => (
                <div key={w.woche} className="vu-woche" role="listitem"
                     title={`Woche ab ${datum(w.woche)}: ${w.briefe} Briefe · ${euro(w.kosten_cent)} · ${w.geoeffnet} QR-Code geöffnet · ${w.demo} Demo · ${w.kontakt} Kontakt`}>
                  <b>{w.briefe}</b>
                  <span className="vu-woche-spur"><i style={{ height: `${(w.briefe / maxWoche) * 100}%` }} /></span>
                  <span className="vu-woche-datum">{new Date(w.woche).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>
                  <span className="vu-woche-kosten">{euro(w.kosten_cent)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Wer reagiert hat – breit, mit Karten je Betrieb */}
        <section className="mon-block vu-block vu-s-reagiert vu-breit">
          <div className="vu-block-kopf">
            <h2>Wer reagiert hat</h2>
            {d && <span className="vu-leise">{zahl(d.kontakte.length)} mit Kontakt-Erlaubnis · {zahl(d.warm.length)} interessiert</span>}
          </div>
          {d && !d.kontakte.length && !d.warm.length && <p className="mon-leer">Noch keine Reaktion auf die Briefe.</p>}
          {!!d?.kontakte.length && (
            <>
              <p className="vu-gruppe gut">Kontakt erlaubt – jetzt melden</p>
              <div className="vu-leads">{d.kontakte.map(k => <LeadKarte key={k.id} l={k} kontakt />)}</div>
            </>
          )}
          {!!d?.warm.length && (
            <>
              <p className="vu-gruppe">Interessiert – Demo angesehen oder QR-Code mehrfach geöffnet, aber noch kein Kontakt</p>
              <div className="vu-leads">{d.warm.map(w => <LeadKarte key={w.id} l={w} kontakt={false} />)}</div>
            </>
          )}
        </section>

        {/* Letzte Aktivitaet */}
        <section className="mon-block vu-block vu-s-aktivitaet">
          <h2>Letzte Aktivität</h2>
          {!d?.aktivitaet.length ? <p className="mon-leer">Noch nichts passiert.</p> : (
            <ul className="vu-feed">
              {d.aktivitaet.map((a, i) => (
                <li key={`${a.art}-${a.id}-${i}`} className={a.art}>
                  <i aria-hidden="true" />
                  <span><b>{a.name || "Betrieb"}</b>{a.ort ? ` · ${a.ort}` : ""}<br /><span className="vu-leise">{AKT_LABEL[a.art]}{a.art === "aufruf" && a.aufrufe > 1 ? ` (${a.aufrufe}×)` : ""}</span></span>
                  <span className="vu-leise vu-zeit">{vorWann(a.zeit)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Aufschluesselung */}
        {(["nach_kategorie", "nach_region"] as const).map(k => (
          <section key={k} className={`mon-block vu-block vu-s-${k === "nach_kategorie" ? "kategorie" : "region"}`}>
            <h2>{k === "nach_kategorie" ? "Nach Kategorie" : "Nach Region"}</h2>
            {!d?.[k].length ? <p className="mon-leer">Noch keine Briefe.</p> : (
              <div className="post-huelle">
                <table className="mon-tabelle vu-tabelle">
                  <thead><tr><th>{k === "nach_kategorie" ? "Kategorie" : "Region"}</th><th className="num">Briefe</th><th className="num">QR-Code</th><th className="num">Demo</th><th className="num">Kontakt</th></tr></thead>
                  <tbody>
                    {d[k].map(r => (
                      <tr key={r.gruppe}>
                        <td className="stark">
                          {k === "nach_kategorie"
                            ? <span className="vu-kat" style={{ "--kat": KAT_FARBE[r.gruppe] || KAT_FARBE.offen } as React.CSSProperties}><i aria-hidden="true" />{KAT_LABEL[r.gruppe] || r.gruppe}</span>
                            : r.gruppe}
                        </td>
                        <td className="num">{zahl(r.briefe)}</td>
                        <td className="num">{zahl(r.geoeffnet)}<span className="vu-quote">{quote(r.geoeffnet, r.briefe)}</span></td>
                        <td className="num">{zahl(r.demo)}</td>
                        <td className="num">{zahl(r.kontakt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        {/* Bestand */}
        <section className="mon-block vu-block vu-s-bestand">
          <h2>Noch nicht angeschrieben</h2>
          {!d?.bestand.length ? <p className="mon-leer">Keine passenden Betriebe mehr – neuen Suchlauf starten.</p> : (
            <ul className="vu-bestand">
              {d.bestand.map(b => (
                <li key={b.kategorie}>
                  <span><b className="vu-kat" style={{ "--kat": KAT_FARBE[b.kategorie] || KAT_FARBE.offen } as React.CSSProperties}><i aria-hidden="true" />{KAT_LABEL[b.kategorie] || b.kategorie}</b><br /><span className="vu-leise">{zahl(b.versandfertig)} versandfertig · {zahl(b.stark)} mit über 10 Google-Bewertungen</span></span>
                  <a className="akq-knopf" href={`/admin/akquise/post?tab=sammel&kat=${b.kategorie}`}>{zahl(b.alle)} <ArrowRight size={12} /></a>
                </li>
              ))}
            </ul>
          )}
          <p className="vu-fuss">Ohne Website, nur Börse, Baukasten und veraltet – ohne verschickten Brief und ohne offenen Entwurf.</p>
        </section>
      </div>
    </AdminShell>
  );
}
