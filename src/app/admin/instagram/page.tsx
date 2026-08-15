"use client";
import { useEffect, useMemo, useState } from "react";
import { Camera, CalendarClock, FileText, CheckCircle, ArrowRight } from "lucide-react";
import AdminShell, { api, datum } from "@/components/admin/AdminShell";

type Post = {
  id: number;
  titel: string;
  caption: string | null;
  hashtags: string | null;
  geplant_am: string | null;
  status: string;
};

const LABEL: Record<string, string> = {
  idee: "Idee",
  entwurf: "Entwurf",
  geplant: "Geplant",
  veroeffentlicht: "Veröffentlicht",
};

export default function InstagramProfil() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    api("/api/admin/posts")
      .then(d => setPosts(d.posts))
      .catch(e => setFehler(e.message))
      .finally(() => setLaedt(false));
  }, []);

  const zahlen = useMemo(() => {
    const z = (s: string) => posts.filter(p => p.status === s).length;
    const heute = new Date().toISOString().slice(0, 10);
    const naechster = posts
      .filter(p => p.status === "geplant" && p.geplant_am && p.geplant_am >= heute)
      .sort((a, b) => (a.geplant_am! < b.geplant_am! ? -1 : 1))[0];
    return {
      ideen: z("idee"),
      entwuerfe: z("entwurf"),
      geplant: z("geplant"),
      veroeffentlicht: z("veroeffentlicht"),
      naechster,
    };
  }, [posts]);

  const veroeffentlicht = posts.filter(p => p.status === "veroeffentlicht");

  return (
    <AdminShell
      titel="Profil"
      eyebrow="Instagram"
      lead="Der Stand deines Kontos: was in Arbeit ist und was schon draußen ist."
    >
      {fehler && <p className="mb-5 text-sm" style={{ color: "#ef4444" }}>{fehler}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Zahl icon={<Camera size={18} />} label="Ideen" wert={zahlen.ideen} />
        <Zahl icon={<FileText size={18} />} label="Entwürfe" wert={zahlen.entwuerfe} />
        <Zahl icon={<CalendarClock size={18} />} label="Geplant" wert={zahlen.geplant} />
        <Zahl icon={<CheckCircle size={18} />} label="Veröffentlicht" wert={zahlen.veroeffentlicht} />
      </div>

      <div className="card p-6 mb-8">
        <h2 className="display-h text-lg font-semibold text-[var(--fg)] mb-3">Als Nächstes geplant</h2>
        {laedt ? (
          <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
        ) : zahlen.naechster ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip px-2.5 py-1 text-xs font-medium"
              style={{ background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" }}>
              {datum(zahlen.naechster.geplant_am)}
            </span>
            <span className="text-[var(--fg)] font-medium">{zahlen.naechster.titel}</span>
          </div>
        ) : (
          <p className="text-[var(--fg-muted)] text-sm">
            Nichts geplant.{" "}
            <a href="/admin/instagram/content" className="font-medium hover:opacity-80"
              style={{ color: "var(--accent)" }}>Jetzt einen Beitrag vorbereiten →</a>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="display-h text-lg font-semibold text-[var(--fg)]">Schon veröffentlicht</h2>
        <a href="/admin/instagram/content"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80"
          style={{ color: "var(--accent)" }}>
          Content erstellen <ArrowRight size={15} />
        </a>
      </div>

      {laedt ? (
        <p className="text-[var(--fg-subtle)] text-sm">Wird geladen…</p>
      ) : veroeffentlicht.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-[var(--fg-muted)]">Noch nichts veröffentlicht.</p>
          <p className="text-[var(--fg-subtle)] text-sm mt-1">
            Beiträge, die du unter „Content erstellen" auf <em>Veröffentlicht</em> setzt, erscheinen hier.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {veroeffentlicht.map(p => (
            <div key={p.id} className="card p-6">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="display-h text-base font-semibold text-[var(--fg)]">{p.titel}</h3>
                <span className="chip px-2.5 py-1 text-xs font-medium shrink-0">{LABEL[p.status]}</span>
              </div>
              {p.caption && (
                <p className="text-[var(--fg-muted)] text-sm leading-relaxed whitespace-pre-wrap">{p.caption}</p>
              )}
              {p.hashtags && (
                <p className="text-sm mt-2" style={{ color: "var(--accent)" }}>{p.hashtags}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

function Zahl({ icon, label, wert }: { icon: React.ReactNode; label: string; wert: number }) {
  return (
    <div className="card p-5">
      <div className="icon-tile w-10 h-10 mb-3">{icon}</div>
      <div className="text-[var(--fg-subtle)] text-xs mb-1">{label}</div>
      <div className="display-h text-2xl font-semibold text-[var(--fg)]">{wert}</div>
    </div>
  );
}
