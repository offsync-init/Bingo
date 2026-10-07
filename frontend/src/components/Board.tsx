"use client";

import React, { useMemo } from "react";
import { Cell } from "./Cell";
import { CellData, LineDetail } from "../types/game";
import { DhakaBorder } from "./DhakaPattern";

interface BoardProps {
  board: CellData[][];
  isMyTurn: boolean;
  onCallNumber: (num: number) => void;
  devanagariNumerals: boolean;
  completedLines?: LineDetail[];
  disabled?: boolean;
  disabledLabel?: string;
}

export const Board: React.FC<BoardProps> = ({
  board,
  isMyTurn,
  onCallNumber,
  devanagariNumerals,
  completedLines = [],
  disabled = false,
  disabledLabel,
}) => {
  // Compute set of coordinates (r, c) that are part of any completed line
  const completedCoords = useMemo(() => {
    const coordsSet = new Set<string>();
    for (const line of completedLines) {
      for (const [r, c] of line.coordinates) {
        coordsSet.add(`${r}_${c}`);
      }
    }
    return coordsSet;
  }, [completedLines]);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center">
      {/* Dhaka Header Accent */}
      <DhakaBorder className="rounded-t-lg" />

      <div className="relative w-full bg-slate-950/80 p-3 sm:p-5 rounded-b-2xl border-2 border-t-0 border-amber-600/40 shadow-2xl backdrop-blur-sm">
        <div className={`grid grid-cols-5 gap-2 sm:gap-3 aspect-square w-full ${disabled ? "pointer-events-none opacity-50" : ""}`}>
          {board.map((row, rIdx) =>
            row.map((cell, cIdx) => (
              <Cell
                key={`${rIdx}-${cIdx}-${cell.number}`}
                number={cell.number}
                marked={cell.marked}
                row={rIdx}
                col={cIdx}
                isClickable={!disabled && isMyTurn && !cell.marked}
                isInCompletedLine={completedCoords.has(`${rIdx}_${cIdx}`)}
                onClick={() => onCallNumber(cell.number)}
                devanagariNumerals={devanagariNumerals}
              />
            ))
          )}
        </div>
        {disabled && disabledLabel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="px-3 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-black tracking-widest uppercase shadow-lg">
              {disabledLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
