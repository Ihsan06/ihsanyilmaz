"use client";
import { useState } from "react";
import { Mail, Send, CheckCircle, AlertCircle } from "lucide-react";
import { useSprache } from "@/lib/sprache";

type State = "idle" | "sending" | "success" | "error";

export default function Contact() {
  const { t } = useSprache();
  const k = t.kontakt;
  const [state, setState] = useState<State>("idle");
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fax: "" }),
      });
      setState(res.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <section id="kontakt" className="surface-base py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-stretch">
          <div className="flex flex-col">
            <span className="eyebrow inline-block mb-3">{k.eyebrow}</span>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-6 leading-tight">
              {k.titel1}<br />
              <span className="accent-text">{k.titel2}</span>
            </h2>
            <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-10">
              {k.text}
            </p>
            <div className="card flex items-center gap-3 p-4">
              <div className="icon-tile w-10 h-10">
                <Mail size={18} />
              </div>
              <div>
                <div className="text-xs text-[var(--fg-subtle)] mb-0.5">{k.email}</div>
                <a href="mailto:kontakt@ihsan-yilmaz.de" className="text-[var(--fg)] text-sm font-medium hover:opacity-80 transition-opacity">kontakt@ihsan-yilmaz.de</a>
              </div>
            </div>

            <div className="relative mt-4 flex-1 min-h-[16rem] rounded-[12px] overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              <iframe
                title={k.karte}
                src="https://www.openstreetmap.org/export/embed.html?bbox=9.9239%2C49.7879%2C9.9309%2C49.7915&layer=mapnik&marker=49.7897%2C9.9274"
                className="w-full h-full block"
                style={{ border: 0, filter: "grayscale(1) invert(0.92) contrast(0.9)" }}
                loading="lazy"
              />
              <a
                href="https://www.google.com/maps/search/?api=1&query=Oberer+Mainkai+9%2C+97070+W%C3%BCrzburg"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary absolute bottom-3 right-3 px-3.5 py-1.5 text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
                </svg>
                {k.maps}
              </a>
            </div>
          </div>

          <div className="card p-8 flex flex-col">
            {state === "success" ? (
              <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
                <div className="icon-tile w-16 h-16">
                  <CheckCircle size={32} />
                </div>
                <h3 className="display-h text-xl font-semibold text-[var(--fg)]">{k.gesendet}</h3>
                <p className="text-[var(--fg-muted)]">{k.gesendetText}</p>
                <button onClick={() => { setState("idle"); setForm({ name:"",email:"",company:"",message:"" }); }} className="text-sm underline underline-offset-2 hover:opacity-80" style={{ color: "var(--accent)" }}>
                  {k.nochmal}
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col flex-1 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[["name",k.name,k.namePlatz,"text",true],["company",k.betrieb,k.betriebPlatz,"text",false]].map(([n,l,p,t,r]) => (
                    <div key={n as string}>
                      <label className="block text-sm text-[var(--fg-muted)] mb-1.5">{l as string}</label>
                      <input type={t as string} name={n as string} required={r as boolean} value={form[n as keyof typeof form]} onChange={change} placeholder={p as string}
                        className="field px-4 py-3 text-sm" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-sm text-[var(--fg-muted)] mb-1.5">{k.emailFeld}</label>
                  <input type="email" name="email" required value={form.email} onChange={change} placeholder={k.emailPlatz}
                    className="field px-4 py-3 text-sm" />
                </div>
                <div className="flex flex-1 flex-col">
                  <label className="block text-sm text-[var(--fg-muted)] mb-1.5">{k.anliegen}</label>
                  <textarea name="message" required rows={5} value={form.message} onChange={change} placeholder={k.anliegenPlatz}
                    className="field px-4 py-3 text-sm resize-none flex-1 min-h-[8rem]" />
                </div>
                {state === "error" && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "#ef4444" }}><AlertCircle size={16} />{k.fehler}</div>
                )}
                <button type="submit" disabled={state === "sending"} className="btn-primary self-start px-5 py-2.5 text-sm disabled:opacity-60">
                  {state === "sending" ? k.sendet : <><span>{k.senden}</span><Send size={15} /></>}
                </button>
                <p className="text-xs text-[var(--fg-subtle)] text-left leading-relaxed">
                  {k.zustimmung1}
                  <a href="/datenschutz" className="underline underline-offset-2 hover:opacity-80" style={{ color: "var(--accent)" }}>{k.datenschutz}</a>{k.zustimmung2}
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
