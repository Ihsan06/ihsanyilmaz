"use client";
import { useEffect, useMemo, useState } from "react";
import { Camera, CalendarClock, Users, Heart, MessageCircle, ArrowRight, ExternalLink } from "lucide-react";
import AdminShell, { api } from "@/components/admin/AdminShell";

// Die Seite zeigt, was WIRKLICH auf Instagram steht — abgefragt bei Meta —
// und daneben, was noch in der Warteschlange wartet. Früher las sie eine
// eigene Planungstabelle, in die aber weder das Studio noch Content planen
// je geschrieben haben: deshalb blieb sie leer, egal wie viel gepostet wurde.

type Medium = {
  id: string;
  text: string;
  art: string;
  sorte: string;
  weg: string;
  bild: string;
  bilder: string[];
  zeitpunkt: string;
  likes: number | null;
  kommentare: number | null;
};

type Konto = { benutzer: string; follower: number | null; folgt: number | null; beitraege: number | null };
type Wartend = { id: number; zeitpunkt: string; format: string; text: string | null; bilder: string[] };

export default function InstagramProfil() {
  const [konto, setKonto] = useState<Konto | null>(null);
  const [medien, setMedien] = useState<Medium[]>([]);
  const [geplant, setGeplant] = useState<Wartend[]>([]);
  const [igFehler, setIgFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    api("/api/studio/instagram")
      .then(d => {
        // profil sind die frisch abgefragten Zahlen. Klemmt Instagram, steht
        // in "jetzt" der zuletzt gespeicherte Stand — besser als gar nichts.
        const p = d.profil || null;
        const gespeichert = d.jetzt || null;
        setKonto({
          benutzer: p?.benutzer || d.konto || "",
          follower: p?.follower ?? gespeichert?.follower ?? null,
          folgt: p?.folgt ?? null,
          beitraege: p?.beitraege ?? gespeichert?.beitraege ?? null,
        });
        setMedien(Array.isArray(d.medien) ? d.medien : []);
        if (d.fehler) setIgFehler(String(d.fehler));
      })
      .catch(e => setIgFehler(e.message))
      .finally(() => setLaedt(false));

    api("/api/studio/warteschlange")
      .then(d => setGeplant(Array.isArray(d.geplant) ? d.geplant : []))
      .catch(() => setGeplant([]));
  }, []);

  const naechster = useMemo(
    () => [...geplant].sort((a, b) => a.zeitpunkt.localeCompare(b.zeitpunkt))[0],
    [geplant],
  );

  const verbunden = !!konto && !!konto.benutzer && !igFehler;

  return (
    <AdminShell
      titel="Profil"
      eyebrow="Instagram"
      lead="Der Stand deines Kontos: was draußen ist und was als Nächstes rausgeht."
    >
      <div className="card p-5 mb-6">
        {laedt ? (
          <p className="text-[var(--fg-subtle)] text-sm">Verbindung wird geprüft…</p>
        ) : verbunden ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a
              href={`https://www.instagram.com/${konto!.benutzer}/`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              ✓ Verbunden: @{konto!.benutzer} <ExternalLink size={13} />
            </a>
            {konto!.folgt !== null && (
              <span className="text-[var(--fg-muted)] text-sm">
                folgt <strong className="text-[var(--fg)]">{konto!.folgt}</strong>
              </span>
            )}
          </div>
        ) : (
          <p className="text-[var(--fg-muted)] text-sm leading-relaxed">
            <strong className="text-[var(--fg)]">@aiy.web ist gerade nicht erreichbar.</strong>{" "}
            {igFehler || "Prüfe, ob der Zugriffstoken noch gültig ist."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Zahl icon={<Users size={18} />} label="Follower" wert={konto?.follower ?? null} />
        <Zahl icon={<Camera size={18} />} label="Beiträge auf Instagram" wert={konto?.beitraege ?? null} />
        <Zahl
          icon={<CalendarClock size={18} />}
          label="Eingeplant"
          wert={geplant.length}
          unter={naechster ? (
            <a href="/admin/planen" className="hover:opacity-80" style={{ color: "var(--accent)" }}>
              nächster {zeitpunkt(naechster.zeitpunkt)} →
            </a>
          ) : (
            <a href="/admin/content" className="hover:opacity-80" style={{ color: "var(--accent)" }}>
              Beitrag bauen →
            </a>
          )}
        />
        <Zahl
          icon={<Heart size={18} />}
          label="Likes (letzte Beiträge)"
          wert={medien.length ? medien.reduce((n, m) => n + (m.likes || 0), 0) : null}
        />
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="display-h text-lg font-semibold text-[var(--fg)]">Auf Instagram</h2>
        <a href="/admin/content"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80"
          style={{ color: "var(--accent)" }}>
          Content erstellen <ArrowRight size={15} />
        </a>
      </div>

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : medien.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--fg-muted)]">
            {verbunden ? "Auf dem Konto steht noch kein Beitrag." : "Beiträge lassen sich gerade nicht abrufen."}
          </p>
          <p className="text-[var(--fg-subtle)] text-sm mt-1">
            Was du unter „Content erstellen" postest, erscheint hier.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {medien.map(m => (
            <a
              key={m.id}
              href={m.weg || undefined}
              target="_blank" rel="noopener noreferrer"
              className="card overflow-hidden group no-underline"
            >
              <div className="relative" style={{ aspectRatio: "1 / 1", background: "var(--bg-alt, #0D2A40)" }}>
                {m.bild && (
                  // Die Adressen kommen von Instagrams eigenem Auslieferdienst.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.bild} alt="" loading="lazy"
                    className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" />
                )}
                {m.bilder.length > 1 && (
                  <span className="absolute top-2 right-2 text-[0.7rem] font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(0,0,0,.6)", color: "#fff" }}>
                    {m.bilder.length}
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-[var(--fg-muted)] text-xs leading-snug line-clamp-2">
                  {(m.text || "").split("\n")[0] || "Ohne Bildunterschrift"}
                </p>
                <div className="flex items-center gap-3 mt-2 text-[var(--fg-subtle)] text-xs">
                  <span className="inline-flex items-center gap-1"><Heart size={12} /> {m.likes ?? "–"}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {m.kommentare ?? "–"}</span>
                  <span className="ml-auto">{kurzDatum(m.zeitpunkt)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function zeitpunkt(wert: string) {
  const d = new Date(wert);
  if (isNaN(d.getTime())) return wert;
  return d.toLocaleString("de-DE", {
    weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }) + " Uhr";
}

function kurzDatum(wert: string) {
  const d = new Date(wert);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function Zahl({ icon, label, wert, unter }: {
  icon: React.ReactNode; label: string; wert: number | null; unter?: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="icon-tile w-10 h-10 mb-3">{icon}</div>
      <div className="text-[var(--fg-subtle)] text-xs mb-1">{label}</div>
      <div className="display-h text-2xl font-semibold text-[var(--fg)]">
        {wert === null ? "–" : wert.toLocaleString("de-DE")}
      </div>
      {/* Die Unterzeile traegt, was frueher ein eigener Kasten war: wann der
          naechste Beitrag rausgeht. Eine Zahl allein sagt nicht, ob heute
          oder in drei Wochen etwas ansteht. */}
      {unter && <div className="text-[var(--fg-subtle)] text-xs mt-1.5 leading-snug">{unter}</div>}
    </div>
  );
}
