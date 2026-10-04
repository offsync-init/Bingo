"use client";

import React from "react";
import { Bell, Flame } from "lucide-react";
import { Language, translations } from "../lib/translations";
import { toDevanagari } from "../lib/utils";

interface GameNotificationProps {
  lastCalledNumber?: number;
  lastCalledBy?: string;
  isMyTurn: boolean;
  lang: Language;
  devanagariNumerals: boolean;
}

export const GameNotificationBanner: React.FC<GameNotificationProps> = ({
  lastCalledNumber,
  lastCalledBy,
  isMyTurn,
  lang,
  devanagariNumerals,
}) => {
  const t = translations[lang];

  if (!lastCalledNumber) {
    return (
      <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-xs text-amber-200/80">
        <Bell className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span>{t.noNumberCalledYet}</span>
      </div>
    );
  }

  const numDisplay = devanagariNumerals ? toDevanagari(lastCalledNumber) : lastCalledNumber;

  return (
    <div className="w-full bg-gradient-to-r from-amber-950/60 via-slate-900 to-rose-950/60 border border-amber-500/40 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-md animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
        <span className="text-xs text-slate-300 font-medium">
          {t.lastCalled}:
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 text-slate-950 font-black text-lg flex items-center justify-center shadow">
          {numDisplay}
        </span>
        <span className="text-[11px] text-amber-300/80 font-semibold">
          {isMyTurn ? t.yourTurn : t.opponentTurn}
        </span>
      </div>
    </div>
  );
};
