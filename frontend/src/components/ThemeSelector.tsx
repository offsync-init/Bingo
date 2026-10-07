"use client";

import React, { useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { THEME_LABELS, THEMES, BingoTheme } from "../lib/theme";
import { Language } from "../lib/translations";

interface ThemeSelectorProps {
  lang: Language;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ lang }) => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const heading = lang === "ne" ? "रूप" : "Appearance";
  const themeLabel = lang === "ne" ? "थिम" : "Theme";

  const apply = (next: BingoTheme) => {
    setTheme(next);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={lang === "ne" ? "थिम छान्नुहोस्" : "Select theme"}
        title={`${heading} / ${themeLabel}`}
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{THEME_LABELS[theme]}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-2 z-50"
        >
          <p className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            {heading} · {themeLabel}
          </p>
          <div className="flex flex-col gap-1">
            {THEMES.map((id) => {
              const selected = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => apply(id)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-amber-600/25 text-amber-200 border border-amber-500/50"
                      : "text-slate-200 hover:bg-slate-800 border border-transparent"
                  }`}
                >
                  <span className="uppercase tracking-wide">{THEME_LABELS[id]}</span>
                  {selected && <Check className="w-3.5 h-3.5 text-amber-300" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
