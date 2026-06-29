"use client";
import type { Theme } from "./ThemeProvider";

const opts: { id: Theme; label: string; dot: string }[] = [
  { id: "cobalt", label: "Blau", dot: "#2347FF" },
  { id: "magenta", label: "Pink", dot: "#FF1F6B" },
  { id: "emerald", label: "Grün", dot: "#059669" },
];

export default function ThemeSwitcher({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  return (
    <div className="fixed top-[4.75rem] right-4 z-[100] flex flex-col items-end gap-1.5">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 pr-1 select-none">
        Akzentfarbe
      </span>
      <div className="flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md border border-black/10 shadow-xl shadow-black/10 p-1">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => setTheme(o.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              theme === o.id ? "bg-black text-white" : "text-black/55 hover:text-black"
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: o.dot }} />
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
