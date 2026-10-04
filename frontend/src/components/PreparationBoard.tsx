"use client";

import React, { useState } from "react";
import { Dices, CheckCircle, ArrowRightLeft, Move } from "lucide-react";
import { DhakaBorder } from "./DhakaPattern";
import { CellData } from "../types/game";
import { Language, translations } from "../lib/translations";
import { toDevanagari } from "../lib/utils";
import { soundFX } from "../lib/audio";

interface PreparationBoardProps {
  board: CellData[][];
  onSwapCells: (r1: number, c1: number, r2: number, c2: number) => void;
  onRandomize: () => void;
  isReady: boolean;
  onToggleReady: (ready: boolean) => void;
  lang: Language;
  devanagariNumerals: boolean;
}

export const PreparationBoard: React.FC<PreparationBoardProps> = ({
  board,
  onSwapCells,
  onRandomize,
  isReady,
  onToggleReady,
  lang,
  devanagariNumerals,
}) => {
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number; num: number } | null>(null);
  const [draggedCell, setDraggedCell] = useState<{ r: number; c: number } | null>(null);
  const t = translations[lang];

  const handleCellClick = (r: number, c: number, num: number) => {
    if (isReady) return; // Cannot modify while ready
    soundFX.playClick();

    if (!selectedCell) {
      // First cell selected for swap
      setSelectedCell({ r, c, num });
    } else {
      // Second cell selected -> perform swap if different
      if (selectedCell.r !== r || selectedCell.c !== c) {
        onSwapCells(selectedCell.r, selectedCell.c, r, c);
      }
      setSelectedCell(null);
    }
  };

  const handleDragStart = (r: number, c: number) => {
    if (isReady) return;
    setDraggedCell({ r, c });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (r: number, c: number) => {
    if (isReady || !draggedCell) return;
    if (draggedCell.r !== r || draggedCell.c !== c) {
      soundFX.playClick();
      onSwapCells(draggedCell.r, draggedCell.c, r, c);
    }
    setDraggedCell(null);
    setSelectedCell(null);
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center">
      {/* Top Banner & Action Controls */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={() => {
            soundFX.playClick();
            onRandomize();
            setSelectedCell(null);
          }}
          disabled={isReady}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Dices className="w-4 h-4 text-amber-400" />
          <span>{t.randomize}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundFX.playClick();
            onToggleReady(!isReady);
            setSelectedCell(null);
          }}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-black shadow-lg transition-all active:scale-95 border ${
            isReady
              ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300 ring-2 ring-emerald-400/50"
              : "bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white border-amber-400"
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>{isReady ? t.ready : t.iAmReady}</span>
        </button>
      </div>

      {/* Swap Hint Banner */}
      <div className="w-full mb-3 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-center text-slate-300 flex items-center justify-center gap-2">
        <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>
          {selectedCell
            ? t.swapActive.replace("{n}", String(devanagariNumerals ? toDevanagari(selectedCell.num) : selectedCell.num))
            : t.swapHint}
        </span>
      </div>

      {/* Board Border & 5x5 Grid */}
      <DhakaBorder className="rounded-t-lg" />
      <div className="w-full bg-slate-950/80 p-3 sm:p-5 rounded-b-2xl border-2 border-t-0 border-amber-600/40 shadow-2xl backdrop-blur-sm">
        <div className="grid grid-cols-5 gap-2 sm:gap-3 aspect-square w-full">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isSelected = selectedCell?.r === r && selectedCell?.c === c;
              const isBeingDragged = draggedCell?.r === r && draggedCell?.c === c;
              const displayVal = devanagariNumerals ? toDevanagari(cell.number) : cell.number;

              return (
                <div
                  key={`${r}-${c}-${cell.number}`}
                  draggable={!isReady}
                  onDragStart={() => handleDragStart(r, c)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(r, c)}
                  onClick={() => handleCellClick(r, c, cell.number)}
                  className={`relative flex items-center justify-center rounded-xl font-bold select-none aspect-square text-lg sm:text-2xl md:text-3xl transition-all duration-150 cursor-pointer shadow-sm ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 ring-4 ring-amber-300 scale-105 z-10 shadow-amber-500/50"
                      : isBeingDragged
                      ? "opacity-40 border-2 border-dashed border-amber-400"
                      : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/70 hover:scale-[1.02] active:scale-95"
                  } ${isReady ? "cursor-default opacity-80" : ""}`}
                >
                  <span>{displayVal}</span>
                  {!isReady && (
                    <div className="absolute top-1 right-1 opacity-0 hover:opacity-100 transition-opacity text-[10px] text-slate-400 pointer-events-none">
                      <Move className="w-3 h-3 text-slate-500" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
