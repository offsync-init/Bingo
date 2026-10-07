"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyThemeToDocument,
  BingoTheme,
  DEFAULT_THEME,
  parseTheme,
  persistTheme,
  readStoredTheme,
} from "../lib/theme";

interface ThemeContextValue {
  theme: BingoTheme;
  setTheme: (theme: BingoTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<BingoTheme>(() => {
    if (typeof document === "undefined") return DEFAULT_THEME;
    return parseTheme(document.documentElement.dataset.theme);
  });

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyThemeToDocument(stored);
  }, []);

  const setTheme = useCallback((next: BingoTheme) => {
    setThemeState(next);
    persistTheme(next);
    applyThemeToDocument(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
