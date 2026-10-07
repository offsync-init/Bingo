"use client";

import React from "react";
import Link from "next/link";
import { Volume2, VolumeX, Globe, Copy, Check } from "lucide-react";
import { DhakaBorder, NepalSunMoonIcon } from "./DhakaPattern";
import { soundFX } from "../lib/audio";
import { Language, translations } from "../lib/translations";
import { copyToClipboard } from "../lib/utils";

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  devanagariNumerals: boolean;
  onToggleNumerals: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  roomCode?: string;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onToggleLang,
  devanagariNumerals,
  onToggleNumerals,
  soundEnabled,
  onToggleSound,
  roomCode,
}) => {
  const [copied, setCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const t = translations[lang];

  const handleCopyCode = async () => {
    if (!roomCode) return;
    const displayed = roomCode.trim();
    const ok = await copyToClipboard(displayed);
    if (ok) {
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2500);
    }
  };

  return (
    <header className="w-full bg-slate-900 border-b border-amber-600/30 sticky top-0 z-40 shadow-lg">
      <DhakaBorder />
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-700 to-amber-700 p-1 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform border border-amber-400/40">
            <NepalSunMoonIcon className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-300 to-amber-400 font-serif">
              {lang === "ne" ? "नेपाली बिङ्गो" : "NEPALI BINGO"}
            </h1>
            <p className="text-[10px] text-amber-200/70 font-medium tracking-wider uppercase -mt-0.5">
              1v1 Real-Time Battle
            </p>
          </div>
        </Link>

        {/* Room Code Badge if in room */}
        {roomCode && (
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-amber-500/40 rounded-full px-3 py-1 shadow-inner">
            <span className="text-xs text-amber-400 font-semibold tracking-wider">
              {t.roomCode}:
            </span>
            <span className="font-mono text-sm font-bold text-white tracking-widest">
              {roomCode.trim()}
            </span>
            <button
              onClick={handleCopyCode}
              title={copyFailed ? t.copyFailed : "Copy room code"}
              className="ml-1 text-slate-400 hover:text-amber-300 transition-colors p-0.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Devanagari numerals toggle */}
          <button
            onClick={onToggleNumerals}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all ${
              devanagariNumerals
                ? "bg-amber-600/30 text-amber-300 border-amber-500/60 shadow-sm"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            }`}
            title="Toggle Devanagari / Western numerals"
          >
            {devanagariNumerals ? "१ २ ३" : "1 2 3"}
          </button>

          {/* Language toggle */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === "en" ? "नेपाली" : "English"}</span>
          </button>

          {/* Sound toggle */}
          <button
            onClick={() => {
              onToggleSound();
              soundFX.enabled = !soundEnabled;
            }}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors"
            title={soundEnabled ? t.soundOff : t.soundOn}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>
    </header>
  );
};
