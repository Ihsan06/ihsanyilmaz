"use client";
import { useCallback, useEffect, useState } from "react";
import { Users, Inbox, Camera, HardDrive, TriangleAlert } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

// Jede Quelle antwortet einzeln – faellt eine aus, steht sie mit ihrem Grund
// da und der Rest der Seite bleibt benutzbar. Deshalb ueberall dieselbe Form:
// entweder { ok: true, … } oder { ok: false, fehler }.
type Fehlbar = { ok?: boolean; fehler?: string };

type Anfragen = Fehlbar & {
  gesamt: number;
  offen: number;
  status: Record<string, number>;
  proTag: { tag: string; anzahl: number }[];
};
type Besucher = Fehlbar & {
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

const ZEITRAEUME = [
  { tage: 7, titel: "7 Tage" },
  { tage: 30, titel: "30 Tage" },
  { tage: 90, titel: "90 Tage" },
  { tage: 180, titel: "180 Tage" },
];

const zahl = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("de-DE");

function groesse(bytes: number) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2).replace(".", ",") + " GB";
  return (bytes / 1024 ** 2).toFixed(1).replace(".", ",") + " MB";
}

// Der Pfeil sagt nur etwas, wenn es einen Vorzeitraum gab UND sich etwas
// geaendert hat. Bei 0 auf 0 waere ein gruener Pfeil eine Behauptung.
function Delta({ jetzt, davor }: { jetzt: number | null; davor: number | null | undefined }) {
  if (jetzt == null || davor == null || jetzt === davor) return null;
  const rauf = jetzt > davor;
  const wert = davor === 0 ? null : Math.round(((jetzt - davor) / davor) * 100);
  return (
    <span className="text-xs ml-2" style={{ color: rauf ? "#16a34a" : "#dc2626" }}>
      {rauf ? "▲" : "▼"} {wert == null ? `${jetzt - davor > 0 ? "+" : ""}${jetzt - davor}` : `${Math.abs(wert)} %`}
    </span>
  );
}

function Kachel({
  titel, wert, unten, icon: Icon, delta,
}: {
  titel: string; wert: string; unten?: string;
  icon: typeof Users; delta?: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[var(--fg-subtle)] text-xs mb-2">
        <Icon size={14} /> {titel}
      </div>
      <div className="text-2xl font-semibold text-[var(--fg)]">
        {wert}{delta}
      </div>
      {unten && <div className="text-xs text-[var(--fg-subtle)] mt-1">{unten}</div>}
    </div>
  );
}

// Ein Balken je Tag. Bewusst ohne Diagrammbibliothek: fuer "steigt es oder
// nicht" reichen Balken, und die laden nicht 100 kB nach.
function Balken({ werte }: { werte: { tag: string; wert: number }[] }) {
  if (!werte.length) return <p className="text-[var(--fg-subtle)] text-sm">Nichts im Zeitraum.</p>;
  const hoechst = Math.max(...werte.map(w => w.wert), 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 90 }}>
      {werte.map(w => (
        <div
          key={w.tag}
          title={`${w.tag}: ${zahl(w.wert)}`}
          className="flex-1 rounded-t-[2px]"
          style={{
            height: `${Math.max(2, (w.wert / hoechst) * 100)}%`,
            background: w.wert ? "var(--accent)" : "var(--surface-2)",
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}

function Ausfall({ was, fehler }: { was: string; fehler?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
        <TriangleAlert size={15} style={{ color: "#d97706" }} /> {was}
      </div>
      <p className="text-sm text-[var(--fg-subtle)] mt-1.5">{fehler || "Konnte nicht geladen werden."}</p>
    </div>
  );
}

export default function MonitoringSeite() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [tage, setTage] = useState(30);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState("");

  const laden = useCallback((t: number) => {
    setLaedt(true); setFehler("");
    api(`/api/studio/monitoring?tage=${t}`)
      .then(d => setStand(d as Stand))
      .catch(e => setFehler(e instanceof Error ? e.message : "Ging nicht."))
      .finally(() => setLaedt(false));
  }, []);

  useEffect(() => { laden(tage); }, [tage, laden]);

  const a = stand?.anfragen;
  const b = stand?.besucher;
  const i = stand?.instagram;
  const s = stand?.speicher;

  return (
    <AdminShell titel="Monitoring" eyebrow="Website" lead="Was auf der Seite und auf Instagram passiert.">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {ZEITRAEUME.map(z => (
          <button
            key={z.tage}
            onClick={() => setTage(z.tage)}
            className="chip px-3 py-1.5 text-sm"
            style={tage === z.tage
              ? { background: "var(--accent)", color: "#fff", borderColor: "transparent" }
              : undefined}
          >
            {z.titel}
          </button>
        ))}
        {stand && (
          <span className="text-[var(--fg-subtle)] text-sm ml-auto">
            {datum(stand.von)} – {datum(stand.bis)}
          </span>
        )}
      </div>

      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      {laedt && !stand ? (
        <p className="text-[var(--fg-muted)]">Wird geladen …</p>
      ) : !stand ? null : (
        <>
          <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <Kachel
              titel="Besuche" icon={Users}
              wert={b?.ok ? zahl(b.besuche) : "—"}
              unten={b?.ok ? `${zahl(b.aufrufe)} Seitenaufrufe` : "nicht eingerichtet"}
              delta={b?.ok ? <Delta jetzt={b.besuche} davor={stand.davor?.besuche} /> : undefined}
            />
            <Kachel
              titel="Anfragen" icon={Inbox}
              wert={a?.ok ? zahl(a.gesamt) : "—"}
              unten={a?.ok ? `${zahl(a.offen)} unbeantwortet` : undefined}
              delta={a?.ok ? <Delta jetzt={a.gesamt} davor={stand.davor?.anfragen} /> : undefined}
            />
            <Kachel
              titel="Follower" icon={Camera}
              wert={i?.ok && i.follower != null ? zahl(i.follower) : "—"}
              unten={i?.ok && i.zuwachs != null
                ? `${i.zuwachs >= 0 ? "+" : ""}${i.zuwachs} im Zeitraum · ${zahl(i.beitraege)} Beiträge`
                : undefined}
            />
            <Kachel
              titel="Bildspeicher" icon={HardDrive}
              wert={s?.ok ? groesse(s.bytes) : "—"}
              unten={s?.ok ? `${zahl(s.bilder)} Bilder · ${String(s.anteil).replace(".", ",")} % von 9,5 GB` : undefined}
            />
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {b?.ok === false ? (
              <Ausfall was="Besucherzahlen" fehler={b.fehler} />
            ) : (
              <div className="card p-4">
                <h2 className="text-sm font-medium text-[var(--fg)] mb-3">Besuche je Tag</h2>
                <Balken werte={(b?.proTag || []).map(z => ({ tag: z.tag, wert: z.besuche }))} />
              </div>
            )}

            {a?.ok === false ? (
              <Ausfall was="Anfragen" fehler={a.fehler} />
            ) : (
              <div className="card p-4">
                <h2 className="text-sm font-medium text-[var(--fg)] mb-3">Anfragen je Tag</h2>
                <Balken werte={(a?.proTag || []).map(z => ({ tag: z.tag, wert: z.anzahl }))} />
                {a && Object.keys(a.status || {}).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(a.status).map(([k, n]) => (
                      <span key={k} className="chip px-2 py-1 text-xs">
                        {k.replace("_", " ")} <span className="opacity-70 ml-1">{n}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {b?.ok && b.proSeite?.length > 0 && (
              <div className="card p-4">
                <h2 className="text-sm font-medium text-[var(--fg)] mb-3">Meistbesuchte Seiten</h2>
                <ul className="text-sm">
                  {b.proSeite.slice(0, 8).map(z => (
                    <li key={z.pfad} className="flex justify-between gap-3 py-1">
                      <span className="text-[var(--fg-muted)] truncate">{z.pfad}</span>
                      <span className="text-[var(--fg)] shrink-0">{zahl(z.aufrufe)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {b?.ok && b.proHerkunft?.length > 0 && (
              <div className="card p-4">
                <h2 className="text-sm font-medium text-[var(--fg)] mb-3">Woher die Besucher kommen</h2>
                <ul className="text-sm">
                  {b.proHerkunft.map(z => (
                    <li key={z.host} className="flex justify-between gap-3 py-1">
                      <span className="text-[var(--fg-muted)] truncate">{z.host}</span>
                      <span className="text-[var(--fg)] shrink-0">{zahl(z.aufrufe)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {i?.ok && i.punkte?.length > 1 && (
              <div className="card p-4">
                <h2 className="text-sm font-medium text-[var(--fg)] mb-3">Follower im Verlauf</h2>
                <Balken werte={i.punkte.map(z => ({ tag: z.tag, wert: z.follower }))} />
              </div>
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}
