"use client";
import { createContext, useContext, useEffect, useState } from "react";
import ThemeSwitcher from "./ThemeSwitcher";

export type Theme = "cobalt" | "magenta" | "emerald";
const THEMES: Theme[] = ["cobalt", "magenta", "emerald"];

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "cobalt",
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeCtx);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("cobalt");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved && THEMES.includes(saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch {}
  };

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      <ThemeSwitcher theme={theme} setTheme={setTheme} />
      {children}
    </ThemeCtx.Provider>
  );
}
