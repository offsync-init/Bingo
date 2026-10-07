"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Trophy,
  CheckCircle,
  Eye,
  Flag,
  HelpCircle,
  ListOrdered,
} from "lucide-react";
import { Language, translations } from "../lib/translations";
import { toDevanagari } from "../lib/utils";
import { DhakaBorder } from "./DhakaPattern";
import { soundFX } from "../lib/audio";

export interface GameEvent {
  sequence_number: number;
  event_type: string;
  player_id?: string | null;
  player_name?: string | null;
  timestamp: number;
  payload: Record<string, any>;
  snapshot: {
    status: string;
    called_numbers: number[];
    current_turn: string | null;
    boards: Record<
      string,
      {
        player_id: string;
        player_name: string;
        grid: number[][];
        marked_board: { number: number; marked: boolean; row: number; col: number }[][];
        completed_lines: number;
        completed_line_details: any[];
      }
    >;
  };
}

export interface InspectionData {
  room_id: string;
  status: string;
  winner_id: string | null;
  winner_name: string | null;
  result: string | null;
  result_reason: string | null;
  duration_sec: number;
  total_moves: number;
  winning_move: number | null;
  winning_lines: any[];
  events: GameEvent[];
  player_boards: Record<
    string,
    {
      player_id: string;
      player_name: string;
      is_leader: boolean;
      is_forfeited: boolean;
      grid: number[][];
      marked_board: { number: number; marked: boolean; row: number; col: number }[][];
      completed_lines_count: number;
      completed_line_details: any[];
    }
  >;
}

interface GameInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectionData: InspectionData | null;
  myPlayerId: string;
  lang: Language;
  devanagariNumerals: boolean;
}

export const GameInspectionModal: React.FC<GameInspectionModalProps> = ({
  isOpen,
  onClose,
  inspectionData,
  myPlayerId,
  lang,
  devanagariNumerals,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeBoardPlayerId, setActiveBoardPlayerId] = useState<string>(myPlayerId);
  const t = translations[lang];

  useEffect(() => {
    if (inspectionData?.events && inspectionData.events.length > 0) {
      setCurrentStepIdx(inspectionData.events.length - 1);
    }
  }, [inspectionData]);

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying || !inspectionData?.events) return;

    const interval = setInterval(() => {
      setCurrentStepIdx((prev) => {
        if (prev >= inspectionData.events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isPlaying, inspectionData?.events]);

  if (!isOpen || !inspectionData) return null;

  const events = inspectionData.events || [];
  const currentEvent = events[currentStepIdx] || events[events.length - 1];
  const stepSnapshot = currentEvent?.snapshot;

  const playerIds = Object.keys(inspectionData.player_boards || {});
  const opponentId = playerIds.find((id) => id !== myPlayerId) || playerIds[1] || myPlayerId;
  const inspectedPlayerId = activeBoardPlayerId || myPlayerId;
  const inspectedPlayer = inspectionData.player_boards[inspectedPlayerId];

  const formatNum = (n: number) => (devanagariNumerals ? toDevanagari(n) : n);

  // Active step board data
  const stepBoardData = stepSnapshot?.boards?.[inspectedPlayerId];
  const markedGrid = stepBoardData?.marked_board || inspectedPlayer?.marked_board;

  // Check if cell is in winning line
  const isWinningCell = (row: number, col: number) => {
    if (!inspectionData.winning_lines || !inspectionData.winner_id) return false;
    if (inspectedPlayerId !== inspectionData.winner_id) return false;
    return inspectionData.winning_lines.some((line) =>
      line.coordinates?.some(([r, c]: [number, number]) => r === row && c === col)
    );
  };

  const handlePrev = () => {
    soundFX.playClick();
    setIsPlaying(false);
    setCurrentStepIdx((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    soundFX.playClick();
    setIsPlaying(false);
    setCurrentStepIdx((prev) => Math.min(events.length - 1, prev + 1));
  };

  const handleTogglePlay = () => {
    soundFX.playClick();
    if (currentStepIdx >= events.length - 1) {
      setCurrentStepIdx(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleRestart = () => {
    soundFX.playClick();
    setIsPlaying(false);
    setCurrentStepIdx(0);
  };

  const getEventText = (ev: GameEvent) => {
    if (!ev) return "";
    const name = ev.player_name || "Player";
    switch (ev.event_type) {
      case "GAME_STARTED":
        return lang === "ne" ? `खेल सुरु भयो! ${name} को पालो।` : `Game started! ${name}'s turn.`;
      case "NUMBER_CALLED":
        return lang === "ne"
          ? `${name} ले ${toDevanagari(ev.payload?.number)} अंक बोलाए`
          : `${name} called number ${ev.payload?.number}`;
      case "PLAYER_FORFEITED":
        return lang === "ne" ? `${name} ले हार माने!` : `${name} forfeited the match!`;
      case "PLAYER_DISCONNECTED":
        return lang === "ne" ? `${name} सम्पर्कविहीन भए` : `${name} disconnected`;
      case "PLAYER_RECONNECTED":
        return lang === "ne" ? `${name} पुनः जोडिए` : `${name} reconnected`;
      case "GAME_FINISHED":
        if (ev.payload?.result_reason === "BINGO") {
          return lang === "ne"
            ? `${name} ले बिङ्गो पूरा गरी जित हासिल गरे!`
            : `${name} achieved Bingo and won!`;
        }
        return lang === "ne" ? `खेल समाप्त भयो!` : `Game finished!`;
      default:
        return ev.event_type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border-2 border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        <DhakaBorder />

        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-rose-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-amber-300 uppercase tracking-wider font-serif">
                {lang === "ne" ? "खेल निरीक्षण र रिप्ले" : "Post-Game Inspection & Replay"}
              </h2>
              <p className="text-xs text-slate-300">
                {lang === "ne"
                  ? "खेलको विस्तृत इतिहास र प्रत्येक चालको समीक्षा गर्नुहोस्।"
                  : "Full transparent chronological match replay and board inspection."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inspection Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/80">
          {/* Match Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                {lang === "ne" ? "विजेता" : "Winner"}
              </span>
              <span className="font-bold text-amber-400 truncate block">
                {inspectionData.winner_name || (lang === "ne" ? "बराबरी" : "Draw")}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                {lang === "ne" ? "परिणाम कारण" : "Result Reason"}
              </span>
              <span className="font-bold text-slate-200 block truncate">
                {inspectionData.result_reason === "BINGO"
                  ? "Bingo (5 Lines)"
                  : inspectionData.result_reason === "PLAYER_FORFEIT"
                  ? "Forfeit"
                  : inspectionData.result_reason || "Finished"}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                {lang === "ne" ? "अन्तिम जित चाल" : "Winning Move"}
              </span>
              <span className="font-bold text-emerald-400 block">
                {inspectionData.winning_move
                  ? `#${formatNum(inspectionData.winning_move)}`
                  : "N/A"}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                {lang === "ne" ? "कुल चालहरू" : "Total Moves"}
              </span>
              <span className="font-bold text-slate-300 block">
                {formatNum(inspectionData.total_moves)}
              </span>
            </div>
          </div>

          {/* Explanation Banner: "How Did They Win?" */}
          {inspectionData.winner_name && (
            <div className="p-3 bg-gradient-to-r from-amber-500/10 via-slate-900 to-emerald-500/10 rounded-xl border border-amber-500/40 text-xs flex items-start gap-2.5">
              <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block">
                  {lang === "ne" ? "कसरी जिते?" : "How Did They Win?"}
                </span>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  {inspectionData.result_reason === "PLAYER_FORFEIT"
                    ? `${inspectionData.winner_name} won because the opponent forfeited the match.`
                    : `${inspectionData.winner_name} completed 5 Bingo lines. Final move was number ${
                        inspectionData.winning_move ?? "N/A"
                      }.`}
                </p>
              </div>
            </div>
          )}

          {/* Main Inspection Grid: Replay Controls & Board */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left/Main Column: Board Display */}
            <div className="lg:col-span-7 flex flex-col items-center gap-3">
              {/* Board Selector Tabs */}
              <div className="w-full flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveBoardPlayerId(myPlayerId)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    inspectedPlayerId === myPlayerId
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {inspectionData.player_boards[myPlayerId]?.player_name || "My Board"} (You)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBoardPlayerId(opponentId)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                    inspectedPlayerId === opponentId
                      ? "bg-amber-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {inspectionData.player_boards[opponentId]?.player_name || "Opponent"}'s Board
                </button>
              </div>

              {/* Board View */}
              <div className="w-full bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 shadow-xl">
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2 aspect-square w-full">
                  {markedGrid ? (
                    markedGrid.map((row, r) =>
                      row.map((cell, c) => {
                        const isWinning = isWinningCell(r, c);
                        const isWinningMove = cell.number === inspectionData.winning_move;
                        const displayVal = devanagariNumerals ? toDevanagari(cell.number) : cell.number;

                        return (
                          <div
                            key={`${r}-${c}-${cell.number}`}
                            className={`relative flex items-center justify-center rounded-xl font-bold aspect-square text-base sm:text-xl transition-all shadow-sm ${
                              isWinningMove
                                ? "bg-emerald-500 text-slate-950 ring-4 ring-emerald-300 scale-105 z-10 font-black animate-pulse"
                                : isWinning
                                ? "bg-amber-500/30 text-amber-200 border-2 border-amber-400 shadow-amber-500/40"
                                : cell.marked
                                ? "bg-slate-800 text-amber-400 border border-amber-500/50 opacity-90"
                                : "bg-slate-900 text-slate-400 border border-slate-800"
                            }`}
                          >
                            <span>{displayVal}</span>
                            {cell.marked && (
                              <CheckCircle className="absolute bottom-1 right-1 w-3 h-3 text-emerald-400" />
                            )}
                          </div>
                        );
                      })
                    )
                  ) : (
                    <div className="col-span-5 text-center text-slate-500 py-12">No board data</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Step-by-Step Replay Timeline */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase">
                    <ListOrdered className="w-4 h-4 text-amber-400" />
                    <span>Replay Timeline</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-300">
                    Step {currentStepIdx + 1} / {events.length}
                  </span>
                </div>

                {/* Step Description */}
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 min-h-[60px] flex items-center justify-center text-center">
                  <p className="text-xs font-semibold text-amber-200">
                    {getEventText(currentEvent)}
                  </p>
                </div>

                {/* Replay Controls */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Restart Replay"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={currentStepIdx === 0}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                    title="Previous Step"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow transition-all active:scale-95"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={currentStepIdx === events.length - 1}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                    title="Next Step"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, events.length - 1)}
                  value={currentStepIdx}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentStepIdx(Number(e.target.value));
                  }}
                  className="w-full accent-amber-500 bg-slate-800 cursor-pointer h-1.5 rounded-lg"
                />
              </div>

              {/* Full Events History List */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 max-h-48 overflow-y-auto space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                  Full Log ({events.length} events)
                </span>
                {events.map((ev, idx) => (
                  <button
                    key={ev.sequence_number}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentStepIdx(idx);
                    }}
                    className={`w-full text-left p-1.5 rounded text-[11px] font-medium transition-colors flex items-center justify-between ${
                      idx === currentStepIdx
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="truncate">{getEventText(ev)}</span>
                    <span className="font-mono text-[9px] text-slate-500 ml-1 shrink-0">
                      #{ev.sequence_number}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DhakaBorder />
      </div>
    </div>
  );
};
