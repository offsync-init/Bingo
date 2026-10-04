"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { toDevanagari } from "../lib/utils";
import { soundFX } from "../lib/audio";

interface CellProps {
  number: number;
  marked: boolean;
  isClickable: boolean;
  isInCompletedLine?: boolean;
  onClick: () => void;
  devanagariNumerals: boolean;
  row: number;
  col: number;
}

export const Cell: React.FC<CellProps> = ({
  number,
  marked,
  isClickable,
  isInCompletedLine = false,
  onClick,
  devanagariNumerals,
  row,
  col,
}) => {
  const displayNum = devanagariNumerals ? toDevanagari(number) : number;

  const handleClick = () => {
    if (isClickable && !marked) {
      soundFX.playClick();
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isClickable || marked}
      aria-label={`Cell row ${row + 1} column ${col + 1} number ${number} ${
        marked ? "marked" : "unmarked"
      }`}
      aria-pressed={marked}
      className={`relative flex items-center justify-center rounded-xl font-bold select-none transition-all duration-200 outline-none focus-visible:ring-4 focus-visible:ring-amber-400 aspect-square text-lg sm:text-2xl md:text-3xl shadow-sm ${
        marked
          ? isInCompletedLine
            ? "bg-gradient-to-br from-amber-600 to-rose-700 text-amber-100 border-2 border-amber-300 ring-2 ring-amber-400/60 shadow-lg scale-[0.98]"
            : "bg-slate-800/90 text-slate-400 border border-slate-700/80 scale-[0.97]"
          : isClickable
          ? "bg-gradient-to-br from-slate-800 to-slate-900 text-amber-300 border-2 border-amber-500/50 hover:border-amber-400 hover:from-slate-750 hover:to-slate-850 hover:scale-[1.03] active:scale-95 shadow-md cursor-pointer group"
          : "bg-slate-900/60 text-slate-300 border border-slate-800 cursor-not-allowed opacity-90"
      }`}
    >
      {/* Background decorative corner notch */}
      <span className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-amber-500/30 rounded-tl pointer-events-none" />
      <span className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-amber-500/30 rounded-br pointer-events-none" />

      {/* Number Value */}
      <span
        className={`transition-all duration-200 ${
          marked
            ? "opacity-40 line-through decoration-rose-500 decoration-4"
            : "group-hover:text-amber-200"
        }`}
      >
        {displayNum}
      </span>

      {/* Accessibility + Visual Marked Indicator Badge */}
      {marked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            <X className="w-8 h-8 sm:w-10 sm:h-10 text-rose-500/80 drop-shadow stroke-[3]" />
            <div className="absolute -top-1 -right-2 bg-rose-600 text-white rounded-full p-0.5 shadow">
              <Check className="w-2.5 h-2.5 stroke-[4]" />
            </div>
          </div>
        </div>
      )}

      {/* Pulsing glow when clickable on player's turn */}
      {isClickable && !marked && (
        <span className="absolute inset-0 rounded-xl border border-amber-400/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </button>
  );
};
