export const THEME_STORAGE_KEY = "bingo-theme";

export const THEMES = ["minimal", "traditional", "space"] as const;

export type BingoTheme = (typeof THEMES)[number];

export const DEFAULT_THEME: BingoTheme = "traditional";

export const THEME_LABELS: Record<BingoTheme, string> = {
  traditional: "Traditional",
  minimal: "Minimal",
  space: "Space",
};

export function isBingoTheme(value: unknown): value is BingoTheme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function parseTheme(value: unknown): BingoTheme {
  return isBingoTheme(value) ? value : DEFAULT_THEME;
}

export function readStoredTheme(): BingoTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function persistTheme(theme: BingoTheme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyThemeToDocument(theme: BingoTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = "dark";
}

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var v=localStorage.getItem(k);var ok=${JSON.stringify(THEMES)};var t=ok.indexOf(v)!==-1?v:${JSON.stringify(DEFAULT_THEME)};document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme",${JSON.stringify(DEFAULT_THEME)});}})();`;
