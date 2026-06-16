export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-slate-950 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <div className="text-xl font-bold text-white mb-2">Ihsan<span className="text-indigo-400">.</span></div>
            <p className="text-slate-500 text-sm max-w-xs">IT-Freelancer für Webentwicklung, Data Engineering und KI-Integration.</p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm">
            {[["#leistungen","Leistungen"],["#ueber-mich","Über mich"],["#projekte","Projekte"],["#kontakt","Kontakt"],["/impressum","Impressum"],["/datenschutz","Datenschutz"]].map(([h,l]) => (
              <a key={h} href={h} className="text-slate-500 hover:text-white transition-colors">{l}</a>
            ))}
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/[0.06] text-center text-xs text-slate-600">
          © {year} Ihsan. Alle Rechte vorbehalten.
        </div>
      </div>
    </footer>
  );
}
