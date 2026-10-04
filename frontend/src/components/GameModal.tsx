"use client";

import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy, Frown, Equal, RefreshCw, Home, Sparkles } from "lucide-react";
import { Language, translations } from "../lib/translations";
import { toDevanagari } from "../lib/utils";
import { DhakaBorder, NepaliMandalaBadge } from "./DhakaPattern";

interface GameModalProps {
  isOpen: boolean;
  result: "PLAYER1_WIN" | "PLAYER2_WIN" | "DRAW" | null;
  resultReason: "BINGO" | "TURN_TIMEOUT" | "MATCH_TIMEOUT" | "DISCONNECT_FORFEIT" | null;
  isWinner: boolean;
  isDraw: boolean;
  myLines: number;
  opponentLines: number;
  rematchRequested: boolean;
  onRequestRematch: () => void;
  onExit: () => void;
  lang: Language;
  devanagariNumerals: boolean;
}

export const GameModal: React.FC<GameModalProps> = ({
  isOpen,
  result,
  resultReason,
  isWinner,
  isDraw,
  myLines,
  opponentLines,
  rematchRequested,
  onRequestRematch,
  onExit,
  lang,
  devanagariNumerals,
}) => {
  const t = translations[lang];

  useEffect(() => {
    if (isOpen && isWinner) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#8A1538", "#D4AF37", "#C8102E", "#FFFBEB"],
        });
      } catch (e) {
        // Confetti fallback
      }
    }
  }, [isOpen, isWinner]);

  if (!isOpen) return null;

  const formatNum = (n: number) => (devanagariNumerals ? toDevanagari(n) : n);

  let title = t.youWin;
  let subtitle = t.reasonBingo;
  let icon = <Trophy className="w-14 h-14 text-amber-400 animate-bounce" />;
  let headerBg = "from-amber-500/20 via-rose-600/20 to-amber-600/20 border-amber-500/50";

  if (isDraw) {
    title = t.draw;
    subtitle = t.reasonMatchTimeout;
    icon = <Equal className="w-14 h-14 text-slate-300" />;
    headerBg = "from-slate-700/20 to-slate-800/20 border-slate-600";
  } else if (!isWinner) {
    title = t.youLose;
    icon = <Frown className="w-14 h-14 text-rose-400" />;
    headerBg = "from-rose-950/40 to-slate-900 border-rose-500/40";

    if (resultReason === "TURN_TIMEOUT") {
      subtitle = t.reasonTurnTimeout;
    } else if (resultReason === "MATCH_TIMEOUT") {
      subtitle = t.reasonMatchTimeout;
    } else if (resultReason === "DISCONNECT_FORFEIT") {
      subtitle = t.reasonDisconnect;
    } else {
      subtitle = t.reasonBingo;
    }
  } else {
    // Winner
    if (resultReason === "TURN_TIMEOUT") {
      subtitle = t.reasonTurnTimeout;
    } else if (resultReason === "MATCH_TIMEOUT") {
      subtitle = t.reasonMatchTimeout;
    } else if (resultReason === "DISCONNECT_FORFEIT") {
      subtitle = t.reasonDisconnect;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden text-center">
        <DhakaBorder />

        <div className={`p-6 bg-gradient-to-b ${headerBg} border-b`}>
          <div className="flex justify-center mb-3">{icon}</div>

          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-200 to-amber-400 font-serif mb-1">
            {title}
          </h2>

          <p className="text-xs sm:text-sm text-amber-200/80 font-medium">
            {subtitle}
          </p>
        </div>

        {/* Match Statistics */}
        <div className="p-6 bg-slate-950/60">
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">
                {t.yourName}
              </span>
              <span className="text-2xl font-black text-amber-400">
                {formatNum(myLines)}
              </span>
              <span className="text-[10px] text-slate-500 block uppercase">
                {lang === "ne" ? "पूरा लाइनहरू" : "Lines"}
              </span>
            </div>

            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-semibold">
                {t.opponentStatus}
              </span>
              <span className="text-2xl font-black text-slate-300">
                {formatNum(opponentLines)}
              </span>
              <span className="text-[10px] text-slate-500 block uppercase">
                {lang === "ne" ? "पूरा लाइनहरू" : "Lines"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onRequestRematch}
              disabled={rematchRequested}
              className={`w-full py-3 px-4 rounded-xl font-black text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 ${
                rematchRequested
                  ? "bg-slate-800 text-amber-300/80 border border-slate-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-amber-500 via-rose-600 to-amber-600 hover:from-amber-400 hover:to-rose-500 text-white border border-amber-300 active:scale-95"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${rematchRequested ? "animate-spin" : ""}`} />
              <span>{rematchRequested ? t.waitingRematch : t.playAgain}</span>
            </button>

            <button
              type="button"
              onClick={onExit}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 font-semibold text-xs tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-3.5 h-3.5" />
              <span>{t.exitHome}</span>
            </button>
          </div>
        </div>

        <DhakaBorder />
      </div>
    </div>
  );
};
