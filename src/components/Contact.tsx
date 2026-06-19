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
    <section id="kontakt" className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <span className="inline-block text-indigo-400 text-sm font-medium tracking-wider uppercase mb-3">Kontakt</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Lassen Sie uns<br />
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">zusammenarbeiten</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-10">
              Sie möchten einen professionellen Webauftritt für Ihren Gastronomiebetrieb? Nehmen Sie gerne Kontakt auf — ich melde mich innerhalb von 24 Stunden bei Ihnen.
            </p>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Mail size={18} className="text-indigo-400" />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">E-Mail</div>
                <a href="mailto:ihsan.yilmaz@gmx.de" className="text-white text-sm font-medium hover:text-indigo-400 transition-colors">ihsan.yilmaz@gmx.de</a>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
            {state === "success" ? (
              <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Nachricht gesendet!</h3>
                <p className="text-slate-400">Ich melde mich so schnell wie möglich bei Ihnen.</p>
                <button onClick={() => { setState("idle"); setForm({ name:"",email:"",company:"",message:"" }); }} className="text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2">
                  Weitere Nachricht senden
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[["name","Name *","Max Mustermann","text",true],["company","Betrieb / Lokal","Zum goldenen Löwen","text",false]].map(([n,l,p,t,r]) => (
                    <div key={n as string}>
                      <label className="block text-sm text-slate-400 mb-1.5">{l as string}</label>
                      <input type={t as string} name={n as string} required={r as boolean} value={form[n as keyof typeof form]} onChange={change} placeholder={p as string}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">E-Mail *</label>
                  <input type="email" name="email" required value={form.email} onChange={change} placeholder="max@muster.de"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Ihr Anliegen *</label>
                  <textarea name="message" required rows={5} value={form.message} onChange={change} placeholder="Kurze Beschreibung Ihres Projekts..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none" />
                </div>
                {state === "error" && (
                  <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={16} />Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.</div>
                )}
                <button type="submit" disabled={state === "sending"}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/25">
                  {state === "sending" ? "Wird gesendet..." : <><span>Nachricht senden</span><Send size={16} /></>}
                </button>
                <p className="text-xs text-slate-600 text-center">Ich antworte innerhalb von 24 Stunden.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
