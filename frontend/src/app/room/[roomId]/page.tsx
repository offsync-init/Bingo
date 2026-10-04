"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Copy, Check, Clock, ShieldAlert, Sparkles, Share2, ArrowLeft } from "lucide-react";
import { Header } from "../../../components/Header";
import { DhakaBorder, NepaliMandalaBadge } from "../../../components/DhakaPattern";
import { PreparationBoard } from "../../../components/PreparationBoard";
import { useBingoSocket } from "../../../hooks/useBingoSocket";
import { Language, translations } from "../../../lib/translations";
import { getOrCreatePlayerId, getStoredPlayerName, formatTime, formatTimeNepali, toDevanagari } from "../../../lib/utils";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default function RoomLobbyPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId.toUpperCase();

  const [lang, setLang] = useState<Language>("en");
  const [devanagariNumerals, setDevanagariNumerals] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [prepSecLeft, setPrepSecLeft] = useState<number>(60);

  const t = translations[lang];

  useEffect(() => {
    const pid = getOrCreatePlayerId();
    const name = getStoredPlayerName() || "Player";
    setPlayerId(pid);
    setPlayerName(name);
  }, []);

  const {
    gameState,
    isConnected,
    error,
    randomizeBoard,
    swapCells,
    setReady,
  } = useBingoSocket({
    roomId,
    playerId,
    playerName,
  });

  // When game enters PLAYING status, redirect to /game/[roomId]
  useEffect(() => {
    if (gameState?.status === "PLAYING") {
      router.push(`/game/${roomId}`);
    }
  }, [gameState?.status, roomId, router]);

  // Synchronized 60-second preparation countdown timer
  useEffect(() => {
    if (!gameState?.preparation_deadline) return;

    const interval = setInterval(() => {
      const now = Date.now() / 1000;
      const left = Math.max(0, gameState.preparation_deadline! - now);
      setPrepSecLeft(left);
    }, 200);

    return () => clearInterval(interval);
  }, [gameState?.preparation_deadline]);

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const myPlayer = gameState?.players?.[playerId];
  const isMyReady = myPlayer?.ready || false;

  const playersList = Object.values(gameState?.players || {});
  const opponent = playersList.find((p) => p.id !== playerId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        lang={lang}
        onToggleLang={() => setLang((prev) => (prev === "en" ? "ne" : "en"))}
        devanagariNumerals={devanagariNumerals}
        onToggleNumerals={() => setDevanagariNumerals((prev) => !prev)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        roomCode={roomId}
      />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 flex flex-col items-center">
        {/* Navigation Breadcrumb */}
        <div className="w-full flex items-center justify-between mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.exitHome}</span>
          </Link>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 transition-colors shadow"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? t.copied : t.shareRoom}</span>
          </button>
        </div>

        {error && (
          <div className="w-full max-w-xl mb-4 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Lobby Players Status Banner */}
        <div className="w-full max-w-xl mb-6 bg-slate-900 border border-amber-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <Users className="w-4 h-4 text-amber-400" />
              <span>{t.connectedPlayers} ({playersList.length}/2)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-semibold text-emerald-400">{t.connected}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Player 1 (You or Creator) */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  {myPlayer?.name || playerName} {myPlayer ? "(You)" : ""}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isMyReady
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  }`}
                >
                  {isMyReady ? t.ready : t.notReady}
                </span>
              </div>
            </div>

            {/* Player 2 (Opponent) */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase font-semibold truncate max-w-[100px]">
                  {opponent ? opponent.name : t.player2}
                </span>
                {opponent ? (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      opponent.ready
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    }`}
                  >
                    {opponent.ready ? t.ready : t.notReady}
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400/80 italic animate-pulse">
                    {lang === "ne" ? "प्रतीक्षा..." : "Waiting..."}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* WAITING PHASE: When waiting for Player 2 to join */}
        {gameState?.status === "WAITING" && (
          <div className="w-full max-w-md bg-slate-900/90 border border-amber-500/40 rounded-2xl p-6 text-center shadow-xl animate-in fade-in">
            <DhakaBorder className="mb-4" />
            <div className="flex justify-center mb-3">
              <NepaliMandalaBadge size={64} />
            </div>
            <h2 className="text-xl font-black text-amber-300 font-serif mb-2">
              {t.waitingOpponent}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {lang === "ne"
                ? "यो कोठा कोड साथीलाई पठाउनुहोस्। दोस्रो खेलाडी जोडिनेबित्तिकै ६० सेकेन्डको बोर्ड तयारी समय सुरु हुनेछ।"
                : "Share this room code with your opponent. As soon as they join, the 60-second board preparation countdown begins."}
            </p>

            <div className="flex items-center justify-center gap-2 p-3 bg-slate-950 rounded-xl border border-amber-500/50 mb-4">
              <span className="font-mono text-2xl font-black tracking-widest text-white">
                {roomId}
              </span>
              <button
                onClick={handleCopyLink}
                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors"
                title="Copy link"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <DhakaBorder className="mt-4" />
          </div>
        )}

        {/* PREPARING PHASE: When both players joined, 60s countdown to arrange board */}
        {gameState?.status === "PREPARING" && gameState.board && (
          <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            {/* 60s Preparation Countdown Banner */}
            <div className="w-full max-w-xl mb-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-rose-950/80 border-2 border-amber-500/60 rounded-2xl p-3.5 flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400 animate-spin-slow" />
                <div>
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                    {t.preparationPhase}
                  </span>
                  <span className="text-xs text-slate-300">
                    {t.preparationNotice}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono text-2xl font-black tracking-widest text-amber-300">
                  {devanagariNumerals ? formatTimeNepali(prepSecLeft) : formatTime(prepSecLeft)}
                </span>
                <span className="text-[9px] text-slate-400 block -mt-1">
                  {lang === "ne" ? "बाँकी समय" : "remaining"}
                </span>
              </div>
            </div>

            {/* Preparation Board with Click-to-Swap, Drag-and-Drop, Randomize, and Ready Toggle */}
            <PreparationBoard
              board={gameState.board}
              onSwapCells={swapCells}
              onRandomize={randomizeBoard}
              isReady={isMyReady}
              onToggleReady={setReady}
              lang={lang}
              devanagariNumerals={devanagariNumerals}
            />

            <p className="text-[11px] text-slate-400 text-center max-w-md mt-4">
              {t.autoStartNotice}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
