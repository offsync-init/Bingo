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

export function getOrCreateSessionId(playerId: string): string {
  if (typeof window === "undefined") {
    return `s_${playerId}_${Date.now().toString(36)}`;
  }
  const key = `nepali_bingo_session_${playerId}`;
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sid = `s_${playerId}_${rand}`;
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  const cleanText = (text || "").trim();
  if (!cleanText) return false;

  // 1. Try modern navigator.clipboard API
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(cleanText);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, attempting fallback:", err);
    }
  }

  // 2. Fallback to execCommand('copy') with textarea for mobile/HTTP environments
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = cleanText;
      textArea.setAttribute("readonly", "");
      textArea.setAttribute("aria-hidden", "true");
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "1px";
      textArea.style.height = "1px";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, cleanText.length);
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) return true;
    } catch (err) {
      console.error("Fallback execCommand copy failed:", err);
    }
  }

  return false;
}
