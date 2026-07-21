"use client";
import { useState } from "react";
import { Mail, Send, CheckCircle, AlertCircle } from "lucide-react";

type State = "idle" | "sending" | "success" | "error";

export default function Contact() {
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="eyebrow inline-block mb-3">Kontakt</span>
            <h2 className="display-h text-4xl md:text-5xl text-[var(--fg)] mb-6 leading-tight">
              Lassen Sie uns<br />
              <span className="accent-text">zusammenarbeiten</span>
            </h2>
            <p className="text-[var(--fg-muted)] text-lg leading-relaxed mb-10">
              Sie möchten einen professionellen Webauftritt für Ihren Gastronomiebetrieb? Nehmen Sie gerne Kontakt auf — ich melde mich innerhalb von 24 Stunden bei Ihnen.
            </p>
            <div className="card flex items-center gap-3 p-4">
              <div className="icon-tile w-10 h-10">
                <Mail size={18} />
              </div>
              <div>
                <div className="text-xs text-[var(--fg-subtle)] mb-0.5">E-Mail</div>
                <a href="mailto:kontakt@ihsan-yilmaz.de" className="text-[var(--fg)] text-sm font-medium hover:opacity-80 transition-opacity">kontakt@ihsan-yilmaz.de</a>
              </div>
            </div>

            <div className="relative mt-4 rounded-[12px] overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              <iframe
                title="Standort – Oberer Mainkai 9, 97070 Würzburg (OpenStreetMap)"
                src="https://www.openstreetmap.org/export/embed.html?bbox=9.9239%2C49.7879%2C9.9309%2C49.7915&layer=mapnik&marker=49.7897%2C9.9274"
                className="w-full h-56 block"
                style={{ border: 0, filter: "grayscale(1)" }}
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
                In Google Maps öffnen
              </a>
            </div>
          </div>

          <div className="card p-8">
            {state === "success" ? (
              <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
                <div className="icon-tile w-16 h-16">
                  <CheckCircle size={32} />
                </div>
                <h3 className="display-h text-xl font-semibold text-[var(--fg)]">Nachricht gesendet!</h3>
                <p className="text-[var(--fg-muted)]">Ich melde mich so schnell wie möglich bei Ihnen.</p>
                <button onClick={() => { setState("idle"); setForm({ name:"",email:"",company:"",message:"" }); }} className="text-sm underline underline-offset-2 hover:opacity-80" style={{ color: "var(--accent)" }}>
                  Weitere Nachricht senden
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[["name","Name *","Max Mustermann","text",true],["company","Betrieb / Lokal","Zum goldenen Löwen","text",false]].map(([n,l,p,t,r]) => (
                    <div key={n as string}>
                      <label className="block text-sm text-[var(--fg-muted)] mb-1.5">{l as string}</label>
                      <input type={t as string} name={n as string} required={r as boolean} value={form[n as keyof typeof form]} onChange={change} placeholder={p as string}
                        className="field px-4 py-3 text-sm" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-sm text-[var(--fg-muted)] mb-1.5">E-Mail *</label>
                  <input type="email" name="email" required value={form.email} onChange={change} placeholder="max@muster.de"
                    className="field px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--fg-muted)] mb-1.5">Ihr Anliegen *</label>
                  <textarea name="message" required rows={5} value={form.message} onChange={change} placeholder="Kurze Beschreibung Ihres Projekts..."
                    className="field px-4 py-3 text-sm resize-none" />
                </div>
                {state === "error" && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "#ef4444" }}><AlertCircle size={16} />Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.</div>
                )}
                <button type="submit" disabled={state === "sending"} className="btn-primary w-full px-6 py-3 disabled:opacity-60">
                  {state === "sending" ? "Wird gesendet..." : <><span>Nachricht senden</span><Send size={16} /></>}
                </button>
                <p className="text-xs text-[var(--fg-subtle)] text-center leading-relaxed">
                  Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Angaben gemäß{" "}
                  <a href="/datenschutz" className="underline underline-offset-2 hover:opacity-80" style={{ color: "var(--accent)" }}>Datenschutzerklärung</a> zu. Ich antworte innerhalb von 24 Stunden.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
