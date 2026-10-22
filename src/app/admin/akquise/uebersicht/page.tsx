"use client";
// Vertrieb → Übersicht: die wichtigsten Zahlen aus Betrieben und Post auf
// einen Blick – Trichter, Kosten, Rückläufer, Verlauf, Aufgaben, Dienste.
// Alles kommt in einem Aufruf von /api/admin/akquise/uebersicht.
import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, Phone, RefreshCw } from "lucide-react";
import AdminShell, { api, datum, euro } from "@/components/admin/AdminShell";
import "./uebersicht.css";

type Kennzahlen = { briefe: number; zurueck: number; geoeffnet: number; demo: number; kontakt: number; kosten_cent: number };
type Gruppe = Kennzahlen & { gruppe: string };
type Woche = Kennzahlen & { woche: string };
type Aktivitaet = { zeit: string; art: "aufruf" | "demo" | "kontakt" | "zurueck"; id: number; aufrufe: number; name: string | null; ort: string | null };
type Kontakt = { id: number; kontakt_erlaubt: string; betrieb_id: number; name: string; ort: string | null; telefon: string | null; email: string | null; website: string | null };
type Warm = { id: number; aufrufe: number; zuletzt_aufgerufen: string | null; demo_geoeffnet: string | null; betrieb_id: number; name: string; ort: string | null; telefon: string | null };
type Rueck = { id: number; zurueck_am: string | null; gesendet_am: string | null; empfaenger: string | null; betrieb_id: number | null; name: string | null; strasse: string | null; plz: string | null; ort: string | null; google: number; im_korb: number };
type Bestand = { kategorie: string; alle: number; versandfertig: number; stark: number };
type Daten = {
  gesamt: Kennzahlen & { betriebe: number; erster: string | null; letzter: string | null };
  monat: Kennzahlen;
  nach_kategorie: Gruppe[]; nach_region: Gruppe[]; wochen: Woche[];
  aktivitaet: Aktivitaet[]; kontakte: Kontakt[]; warm: Warm[]; ruecklaeufer: Rueck[]; bestand: Bestand[];
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
  aufruf: "Seite geöffnet", demo: "Demo angesehen", kontakt: "Kontakt erlaubt", zurueck: "Rückläufer",
};

const zahl = (n?: number | null) => (n == null ? "—" : n.toLocaleString("de-DE"));
const quote = (teil?: number, ganz?: number) => (ganz ? `${(Math.round(((teil || 0) / ganz) * 1000) / 10).toLocaleString("de-DE")} %` : "—");
const telLink = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;
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
    { titel: "Seite geöffnet", wert: g.geoeffnet, hinweis: quote(g.geoeffnet, g.briefe) },
    { titel: "Demo angesehen", wert: g.demo, hinweis: quote(g.demo, g.briefe) },
    { titel: "Kontakt erlaubt", wert: g.kontakt, hinweis: quote(g.kontakt, g.briefe) },
  ] : [];

  return (
    <AdminShell titel="Übersicht" eyebrow="Vertrieb" lead="Was die Briefe bringen, was sie kosten und was als Nächstes zu tun ist.">
      {fehler && <p className="mb-4 text-sm" style={{ color: "#dc2626" }}>{fehler}</p>}

      <div className="vu-kopf">
        <span className="vu-leise">{g?.erster ? `Briefe seit ${datum(g.erster)} · zuletzt ${datum(g.letzter)}` : laedt ? "Wird geladen …" : "Noch keine Briefe verschickt."}</span>
        <button type="button" className="akq-knopf" onClick={laden} disabled={laedt}><RefreshCw size={13} className={laedt ? "akq-dreht" : undefined} /> Aktualisieren</button>
      </div>

      {/* Kopfzahlen */}
      <div className="vu-kacheln">
        <div className="vu-kachel">
          <p className="vu-titel">Briefe verschickt</p>
          <p className="vu-wert">{zahl(g?.briefe)}</p>
          <p className="vu-unter">{d?.monat ? `${new Date().toLocaleDateString("de-DE", { month: "long" })}: ${zahl(d.monat.briefe)}` : ""}</p>
        </div>
        <div className="vu-kachel">
          <p className="vu-titel">Seite geöffnet</p>
          <p className="vu-wert">{quote(g?.geoeffnet, g?.briefe)}</p>
          <p className="vu-unter">{zahl(g?.geoeffnet)} von {zahl(g?.briefe)} Betrieben</p>
        </div>
        <div className={`vu-kachel${g?.kontakt ? " gut" : ""}`}>
          <p className="vu-titel">Kontakt erlaubt</p>
          <p className="vu-wert">{zahl(g?.kontakt)}</p>
          <p className="vu-unter">{zahl(g?.demo)} {g?.demo === 1 ? "hat" : "haben"} die Demo angesehen</p>
        </div>
        <div className="vu-kachel">
          <p className="vu-titel">Ausgegeben</p>
          <p className="vu-wert">{euro(g?.kosten_cent || 0)}</p>
          <p className="vu-unter">{reaktionen ? `${euro(Math.round((g?.kosten_cent || 0) / reaktionen))} je Reaktion` : "noch keine Reaktion"}</p>
        </div>
        <div className={`vu-kachel${reichtFuer != null && reichtFuer < 10 ? " warn" : ""}`}>
          <p className="vu-titel">Guthaben</p>
          <p className="vu-wert">{lxp?.guthaben_cent != null ? euro(lxp.guthaben_cent) : "—"}</p>
          <p className="vu-unter">{reichtFuer != null ? `reicht für ca. ${zahl(reichtFuer)} Briefe` : "LetterXpress"}</p>
        </div>
        <div className={`vu-kachel${g?.zurueck ? " warn" : ""}`}>
          <p className="vu-titel">Rückläufer</p>
          <p className="vu-wert">{quote(g?.zurueck, g?.briefe)}</p>
          <p className="vu-unter">{zahl(g?.zurueck)} {g?.zurueck === 1 ? "Brief kam" : "Briefe kamen"} zurück</p>
        </div>
      </div>

      <div className="vu-raster">
        {/* Trichter */}
        <section className="mon-block vu-block">
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
          <p className="vu-fuss">Gezählt ohne deine eigenen Geräte und ohne die ersten zwei Tage nach dem Versand.</p>
        </section>

        {/* Zu tun */}
        <section className="mon-block vu-block">
          <h2>Zu tun</h2>
          {d && !d.kontakte.length && !d.warm.length && !d.ruecklaeufer.length && !d.offen.fehler && !d.offen.freigegeben && (
            <p className="mon-leer">Nichts offen.</p>
          )}
          {!!d?.kontakte.length && (
            <div className="vu-aufgabe gut">
              <p className="vu-aufgabe-titel">Melden – Kontakt erlaubt ({d.kontakte.length})</p>
              <ul>
                {d.kontakte.map(k => (
                  <li key={k.id}>
                    <span><b>{k.name}</b>{k.ort ? ` · ${k.ort}` : ""} <span className="vu-leise">{vorWann(k.kontakt_erlaubt)}</span></span>
                    {k.telefon ? <a className="akq-knopf" href={telLink(k.telefon)}><Phone size={12} /> {k.telefon}</a>
                      : <span className="vu-leise">Nummer im Internet suchen</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!d?.warm.length && (
            <div className="vu-aufgabe">
              <p className="vu-aufgabe-titel">Interessiert, aber noch kein Kontakt ({d.warm.length})</p>
              <ul>
                {d.warm.map(w => (
                  <li key={w.id}>
                    <span><b>{w.name}</b>{w.ort ? ` · ${w.ort}` : ""}</span>
                    <span className="vu-leise">{w.demo_geoeffnet ? `Demo ${vorWann(w.demo_geoeffnet)}` : `${w.aufrufe}× geöffnet`}</span>
                  </li>
                ))}
              </ul>
              <p className="vu-fuss">Kandidaten für den zweiten Brief.</p>
            </div>
          )}
          {!!d?.ruecklaeufer.length && (
            <div className="vu-aufgabe warn">
              <p className="vu-aufgabe-titel">Rückläufer – Anschrift prüfen ({d.ruecklaeufer.length})</p>
              <ul>
                {d.ruecklaeufer.map(r => (
                  <li key={r.id}>
                    <span><b>{r.name || "Betrieb"}</b> <span className="vu-leise">{[r.strasse, [r.plz, r.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span></span>
                    <span className="vu-leise">{r.im_korb ? "im Papierkorb" : r.google ? "Google-Eintrag vorhanden" : "nur OpenStreetMap"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!(d?.offen.fehler || d?.offen.freigegeben || d?.offen.entwurf) && (
            <a className="vu-aufgabe vu-link" href="/admin/akquise/post">
              <span>{[d?.offen.entwurf ? `${d.offen.entwurf} Entwürfe` : "", d?.offen.freigegeben ? `${d.offen.freigegeben} freigegeben, nicht gesendet` : "", d?.offen.fehler ? `${d.offen.fehler} mit Fehler` : ""].filter(Boolean).join(" · ")}</span>
              <ArrowRight size={14} />
            </a>
          )}
        </section>

        {/* Verlauf */}
        <section className="mon-block vu-block">
          <h2>Briefe je Woche</h2>
          {!d?.wochen.length ? <p className="mon-leer">Noch keine Briefe.</p> : (
            <div className="vu-wochen" role="list">
              {d.wochen.map(w => (
                <div key={w.woche} className="vu-woche" role="listitem"
                     title={`Woche ab ${datum(w.woche)}: ${w.briefe} Briefe · ${w.geoeffnet} Seite geöffnet · ${w.demo} Demo · ${w.kontakt} Kontakt · ${w.zurueck} Rückläufer · ${euro(w.kosten_cent)}`}>
                  <b>{w.briefe}</b>
                  <span className="vu-woche-spur"><i style={{ height: `${(w.briefe / maxWoche) * 100}%` }} /></span>
                  <span className="vu-leise">{new Date(w.woche).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
          <p className="vu-fuss">Balken = verschickte Briefe, Woche ab Montag. Mit der Maus auf einen Balken: Reaktionen und Kosten.</p>
        </section>

        {/* Letzte Aktivitaet */}
        <section className="mon-block vu-block">
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
          <section key={k} className="mon-block vu-block">
            <h2>{k === "nach_kategorie" ? "Nach Kategorie" : "Nach Region"}</h2>
            {!d?.[k].length ? <p className="mon-leer">Noch keine Briefe.</p> : (
              <div className="post-huelle">
                <table className="mon-tabelle vu-tabelle">
                  <thead><tr><th>{k === "nach_kategorie" ? "Kategorie" : "Region"}</th><th className="num">Briefe</th><th className="num">Geöffnet</th><th className="num">Demo</th><th className="num">Kontakt</th><th className="num">Rückl.</th></tr></thead>
                  <tbody>
                    {d[k].map(r => (
                      <tr key={r.gruppe}>
                        <td className="stark">{k === "nach_kategorie" ? KAT_LABEL[r.gruppe] || r.gruppe : r.gruppe}</td>
                        <td className="num">{zahl(r.briefe)}</td>
                        <td className="num">{zahl(r.geoeffnet)} <span className="vu-leise">{quote(r.geoeffnet, r.briefe)}</span></td>
                        <td className="num">{zahl(r.demo)}</td>
                        <td className="num">{zahl(r.kontakt)}</td>
                        <td className="num">{zahl(r.zurueck)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        {/* Bestand */}
        <section className="mon-block vu-block">
          <h2>Noch nicht angeschrieben</h2>
          {!d?.bestand.length ? <p className="mon-leer">Keine passenden Betriebe mehr – neuen Suchlauf starten.</p> : (
            <ul className="vu-bestand">
              {d.bestand.map(b => (
                <li key={b.kategorie}>
                  <span><b>{KAT_LABEL[b.kategorie] || b.kategorie}</b><br /><span className="vu-leise">{zahl(b.versandfertig)} versandfertig · {zahl(b.stark)} mit über 10 Google-Bewertungen</span></span>
                  <a className="akq-knopf" href={`/admin/akquise/post?tab=sammel&kat=${b.kategorie}`}>{zahl(b.alle)} <ArrowRight size={12} /></a>
                </li>
              ))}
            </ul>
          )}
          <p className="vu-fuss">Ohne Website, nur Börse, Baukasten und veraltet – ohne verschickten Brief und ohne offenen Entwurf.</p>
        </section>

        {/* Dienste */}
        <section className="mon-block vu-block">
          <h2>Dienste</h2>
          <ul className="vu-dienste">
            <li>
              <span><b>LetterXpress</b><br /><span className="vu-leise">{lxp?.eingerichtet ? `${lxp.modus === "live" ? "Live" : "Testmodus"} · ${lxp.preis_cent != null ? `${euro(lxp.preis_cent)} je Brief` : ""}` : "nicht eingerichtet"}</span></span>
              <span className={`vu-ampel ${!lxp?.eingerichtet ? "rot" : reichtFuer != null && reichtFuer < 10 ? "gelb" : "gruen"}`}>{lxp?.guthaben_cent != null ? euro(lxp.guthaben_cent) : "—"}</span>
            </li>
            <li>
              <span><b>Google Maps</b><br /><span className="vu-leise">Abfragen im {d ? new Date(`${d.dienste.google.monat}-01`).toLocaleDateString("de-DE", { month: "long" }) : ""} (Stopp bei {zahl(d?.dienste.google.grenze)})</span></span>
              <span className={`vu-ampel ${(d?.dienste.google.genutzt || 0) > 850 ? "gelb" : "gruen"}`}>{zahl(d?.dienste.google.genutzt)}</span>
            </li>
            <li>
              <span><b>Letzter Suchlauf</b><br /><span className="vu-leise">{d?.dienste.suchlauf.zeitpunkt ? `${d.dienste.suchlauf.region} · ${zahl(d.dienste.suchlauf.gefunden)} gefunden · ${vorWann(d.dienste.suchlauf.zeitpunkt)}` : "noch keiner"}</span></span>
              <span className={`vu-ampel ${d?.dienste.suchlauf.fehler ? "rot" : "gruen"}`}>{d?.dienste.suchlauf.fehler ? "Fehler" : "ok"}</span>
            </li>
            <li>
              <span><b>Betriebe</b><br /><span className="vu-leise">{zahl(d?.betriebe.auswahl)} mit Stern · {zahl(d?.betriebe.papierkorb)} im Papierkorb</span></span>
              <span className="vu-ampel neutral">{zahl(d?.betriebe.aktiv)}</span>
            </li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
