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
}

export const Board: React.FC<BoardProps> = ({
  board,
  isMyTurn,
  onCallNumber,
  devanagariNumerals,
  completedLines = [],
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

      <div className="w-full bg-slate-950/80 p-3 sm:p-5 rounded-b-2xl border-2 border-t-0 border-amber-600/40 shadow-2xl backdrop-blur-sm">
        <div className="grid grid-cols-5 gap-2 sm:gap-3 aspect-square w-full">
          {board.map((row, rIdx) =>
            row.map((cell, cIdx) => (
              <Cell
                key={`${rIdx}-${cIdx}-${cell.number}`}
                number={cell.number}
                marked={cell.marked}
                row={rIdx}
                col={cIdx}
                isClickable={isMyTurn && !cell.marked}
                isInCompletedLine={completedCoords.has(`${rIdx}_${cIdx}`)}
                onClick={() => onCallNumber(cell.number)}
                devanagariNumerals={devanagariNumerals}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
