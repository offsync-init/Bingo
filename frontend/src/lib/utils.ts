export function toDevanagari(val: number | string): string {
  const nepaliDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  return String(val).replace(/[0-9]/g, (w) => nepaliDigits[parseInt(w, 10)]);
}

export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatTimeNepali(seconds: number): string {
  const timeStr = formatTime(seconds);
  return toDevanagari(timeStr);
}

export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") {
    return "player_" + Math.random().toString(36).substring(2, 9);
  }
  const KEY = "nepali_bingo_player_id";
  let pid = localStorage.getItem(KEY);
  if (!pid) {
    pid = "p_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
    localStorage.setItem(KEY, pid);
  }
  return pid;
}

export function getStoredPlayerName(): string {
  if (typeof window === "undefined") return "Player";
  return localStorage.getItem("nepali_bingo_player_name") || "";
}

export function setStoredPlayerName(name: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("nepali_bingo_player_name", name);
  }
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
