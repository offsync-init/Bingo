"use client";

import React, { useEffect, useState } from "react";
import { Clock, Hourglass, AlertTriangle, UserCheck } from "lucide-react";
import { formatTime, formatTimeNepali } from "../lib/utils";
import { Language, translations } from "../lib/translations";

interface TimerDisplayProps {
  turnDeadline: number | null;
  matchDeadline: number | null;
  isMyTurn: boolean;
  currentTurnPlayerName?: string;
  lang: Language;
  devanagariNumerals: boolean;
}

export const TimerDisplay: React.FC<TimerDisplayProps> = ({
  turnDeadline,
  matchDeadline,
  isMyTurn,
  currentTurnPlayerName,
  lang,
  devanagariNumerals,
}) => {
  const [turnSecLeft, setTurnSecLeft] = useState<number>(120);
  const [matchSecLeft, setMatchSecLeft] = useState<number>(300);
  const t = translations[lang];

  useEffect(() => {
    const update = () => {
      const now = Date.now() / 1000;
      if (turnDeadline) {
        setTurnSecLeft(Math.max(0, turnDeadline - now));
      }
      if (matchDeadline) {
        setMatchSecLeft(Math.max(0, matchDeadline - now));
      }
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [turnDeadline, matchDeadline]);

  const displayTime = (sec: number) => {
    return devanagariNumerals ? formatTimeNepali(sec) : formatTime(sec);
  };

  const isTurnUrgent = turnSecLeft <= 25 && turnSecLeft > 0;
  const isMatchUrgent = matchSecLeft <= 60 && matchSecLeft > 0;

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* 1. Turn Status Indicator */}
      <div
        className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 shadow-md ${
          isMyTurn
            ? "bg-gradient-to-r from-emerald-950/80 to-slate-900 border-emerald-500/60 ring-2 ring-emerald-500/40"
            : "bg-slate-900/90 border-slate-700/80"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold shadow ${
            isMyTurn
              ? "bg-emerald-500 text-slate-950 animate-pulse"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          <UserCheck className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            {isMyTurn ? t.yourTurn : t.opponentTurn}
          </span>
          <p className="text-sm font-extrabold text-white truncate max-w-[140px]">
            {isMyTurn ? (lang === "ne" ? "तपाईंको पालो" : "Your Move") : (currentTurnPlayerName || t.opponentTurn)}
          </p>
        </div>
      </div>

      {/* 2. Turn Countdown (2:00) */}
      <div
        className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 shadow-md ${
          isTurnUrgent
            ? "bg-rose-950/80 border-rose-500/80 ring-2 ring-rose-500/50 animate-pulse"
            : "bg-slate-900/90 border-amber-600/30"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shadow ${
            isTurnUrgent
              ? "bg-rose-600 text-white"
              : isMyTurn
              ? "bg-amber-500 text-slate-950"
              : "bg-slate-800 text-amber-400"
          }`}
        >
          {isTurnUrgent ? (
            <AlertTriangle className="w-5 h-5 animate-bounce" />
          ) : (
            <Hourglass className="w-5 h-5" />
          )}
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            {t.turnTime}
          </span>
          <span
            className={`font-mono text-xl font-black tracking-widest ${
              isTurnUrgent
                ? "text-rose-400"
                : isMyTurn
                ? "text-amber-300"
                : "text-white"
            }`}
          >
            {displayTime(turnSecLeft)}
          </span>
        </div>
      </div>

      {/* 3. Match Countdown (5:00) */}
      <div
        className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 shadow-md ${
          isMatchUrgent
            ? "bg-amber-950/60 border-amber-500/70"
            : "bg-slate-900/90 border-slate-700/80"
        }`}
      >
        <div className="w-10 h-10 rounded-lg bg-slate-800 text-amber-400 flex items-center justify-center shadow">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            {t.matchTime}
          </span>
          <span className="font-mono text-xl font-black tracking-widest text-slate-200">
            {displayTime(matchSecLeft)}
          </span>
        </div>
      </div>
    </div>
  );
};
