"use client";

import React from "react";
import { Sparkles, Trophy } from "lucide-react";
import { Language, translations } from "../lib/translations";
import { toDevanagari } from "../lib/utils";

interface BingoProgressProps {
  completedLines: number;
  opponentLines?: number;
  lang: Language;
  devanagariNumerals: boolean;
  isMyTurn?: boolean;
}

export const BingoProgress: React.FC<BingoProgressProps> = ({
  completedLines,
  opponentLines = 0,
  lang,
  devanagariNumerals,
  isMyTurn,
}) => {
  const t = translations[lang];
  const letters = ["B", "I", "N", "G", "O"];
  const clampedLines = Math.min(5, Math.max(0, completedLines));

  const formatNum = (n: number) => (devanagariNumerals ? toDevanagari(n) : n);

  return (
    <div className="w-full bg-gradient-to-r from-slate-900/90 via-slate-800/95 to-slate-900/90 rounded-2xl p-4 border border-amber-500/30 shadow-xl relative overflow-hidden">
      {/* Subtle backdrop pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#c8102e_1px,transparent_1px)] [background-size:16px_16px] opacity-15 pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* B I N G O Milestone Letters */}
        <div className="flex flex-col items-center sm:items-start gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-amber-300 font-bold flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {t.linesCompleted}:
            </span>
            <span className="text-sm font-extrabold text-white">
              {formatNum(clampedLines)} / {formatNum(5)}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 mt-1">
            {letters.map((char, index) => {
              const isAchieved = index < clampedLines;
              return (
                <div
                  key={char}
                  className={`relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl font-black text-xl sm:text-2xl transition-all duration-500 select-none shadow-md ${
                    isAchieved
                      ? "bg-gradient-to-br from-amber-400 via-rose-600 to-amber-600 text-white border-2 border-amber-300 scale-105 shadow-rose-900/50 animate-bounce-short ring-2 ring-amber-400/50"
                      : "bg-slate-800 text-slate-500 border border-slate-700 opacity-60"
                  }`}
                >
                  {char}
                  {isAchieved && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-300 rounded-full animate-ping" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rule badge & Opponent comparison */}
        <div className="flex flex-col items-center sm:items-end gap-1.5 text-center sm:text-right">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 text-[11px] text-amber-200/90 font-medium max-w-xs">
            <span className="font-semibold text-amber-300 block mb-0.5">
              {t.linesTarget}
            </span>
            {t.ruleReminder}
          </div>

          {opponentLines !== undefined && (
            <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
              <span className="text-slate-400">{t.opponentStatus}:</span>
              <span className="font-mono font-bold text-amber-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                {formatNum(opponentLines)} / {formatNum(5)} {lang === "ne" ? "लाइन" : "lines"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
