"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, History, Bell, Volume2, UserCheck, Crown, Activity } from "lucide-react";
import { Header } from "../../../components/Header";
import { DhakaBorder, NepaliMandalaBadge } from "../../../components/DhakaPattern";
import { Board } from "../../../components/Board";
import { BingoProgress } from "../../../components/BingoProgress";
import { TimerDisplay } from "../../../components/TimerDisplay";
import { GameNotificationBanner } from "../../../components/Notifications";
import { GameModal } from "../../../components/GameModal";
import { useBingoSocket } from "../../../hooks/useBingoSocket";
import { Language, translations } from "../../../lib/translations";
import { getOrCreatePlayerId, getStoredPlayerName, toDevanagari } from "../../../lib/utils";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default function GamePage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId.toUpperCase();

  const [lang, setLang] = useState<Language>("en");
  const [devanagariNumerals, setDevanagariNumerals] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");

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
    connectionState,
    latency,
    peerConnected,
    isLeader,
    isKicked,
    kickedReason,
    error,
    lastCalled,
    callNumber,
    requestRematch,
  } = useBingoSocket({
    roomId,
    playerId,
    playerName,
  });

  // Disconnect grace countdown state
  const [disconnectSecLeft, setDisconnectSecLeft] = useState<number | null>(null);

  // If game is in PREPARING or WAITING phase, redirect back to /room/[roomId]
  useEffect(() => {
    if (gameState?.status === "PREPARING" || gameState?.status === "WAITING") {
      router.push(`/room/${roomId}`);
    }
  }, [gameState?.status, roomId, router]);

  const opponentId = gameState?.opponent_id;
  const opponent = opponentId ? gameState?.players?.[opponentId] : null;

  // Track opponent disconnect countdown
  useEffect(() => {
    if (!opponent || peerConnected || !opponent.disconnected_at) {
      setDisconnectSecLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() / 1000 - (opponent.disconnected_at || 0);
      const remaining = Math.max(0, 30 - elapsed);
      setDisconnectSecLeft(Math.ceil(remaining));
    }, 250);

    return () => clearInterval(interval);
  }, [opponent, peerConnected, opponent?.disconnected_at]);

  const isMyTurn = gameState?.current_turn === playerId && gameState?.status === "PLAYING";
  const myPlayer = gameState?.players?.[playerId];
  const myLines = gameState?.player_lines || 0;
  const opponentLines = gameState?.opponent_lines || 0;
  const isWinner = gameState?.winner === playerId;
  const isDraw = gameState?.result === "DRAW";
  const isGameOver = gameState?.status === "FINISHED";
  const rematchRequested = myPlayer?.rematch_requested || false;

  const currentTurnPlayer = gameState?.current_turn
    ? gameState.players[gameState.current_turn]?.name || "Player"
    : undefined;

  const handleCallNumber = (num: number) => {
    if (!isMyTurn) return;
    callNumber(num);
  };

  const handleExit = () => {
    router.push("/");
  };

  const formatNum = (n: number) => (devanagariNumerals ? toDevanagari(n) : n);

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

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 sm:py-6 flex flex-col gap-4">
        {/* Local Reconnection Banner */}
        {connectionState === "RECONNECTING" && (
          <div className="w-full p-3 rounded-xl bg-amber-950/90 border border-amber-500/80 text-amber-200 text-xs flex items-center justify-between shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>
                {lang === "ne"
                  ? "सर्भरसँग पुनः सम्पर्क जोडिँदैछ..."
                  : "Connection lost. Reconnecting to game server..."}
              </span>
            </div>
            <span className="text-[10px] text-amber-300 font-mono">RECONNECTING</span>
          </div>
        )}

        {/* Opponent Disconnected Countdown Banner */}
        {disconnectSecLeft !== null && disconnectSecLeft > 0 && !isGameOver && (
          <div className="w-full p-3 rounded-xl bg-rose-950/90 border border-rose-500/80 text-rose-200 text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping" />
              <span>
                {lang === "ne"
                  ? `विपक्षी सम्पर्कविहीन! ${disconnectSecLeft} सेकेन्डमा खेल स्वतः जितिनेछ।`
                  : `Opponent disconnected! Forfeiting match in ${disconnectSecLeft}s if not reconnected.`}
              </span>
            </div>
            <span className="font-mono font-bold text-sm text-rose-300">
              {disconnectSecLeft}s
            </span>
          </div>
        )}

        {error && (
          <div className="w-full p-3 rounded-xl bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Timers and Active Turn Bar */}
        <TimerDisplay
          turnDeadline={gameState?.turn_deadline ?? null}
          matchDeadline={gameState?.match_deadline ?? null}
          isMyTurn={isMyTurn}
          currentTurnPlayerName={currentTurnPlayer}
          lang={lang}
          devanagariNumerals={devanagariNumerals}
        />

        {/* 2. B I N G O Line Progress */}
        <BingoProgress
          completedLines={myLines}
          opponentLines={opponentLines}
          lang={lang}
          devanagariNumerals={devanagariNumerals}
          isMyTurn={isMyTurn}
        />

        {/* 3. Call Notification Banner */}
        <GameNotificationBanner
          lastCalledNumber={lastCalled?.number || gameState?.called_numbers?.[gameState?.called_numbers?.length - 1]}
          lastCalledBy={lastCalled?.by}
          isMyTurn={isMyTurn}
          lang={lang}
          devanagariNumerals={devanagariNumerals}
        />

        {/* 4. Responsive Layout: Desktop side-by-side, Mobile stacked (Section 40) */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main 5x5 Board Area (lg:col-span-8) */}
          <div className="lg:col-span-8 w-full flex flex-col items-center">
            {gameState?.board ? (
              <Board
                board={gameState.board}
                isMyTurn={isMyTurn}
                onCallNumber={handleCallNumber}
                devanagariNumerals={devanagariNumerals}
                completedLines={gameState.completed_line_details}
              />
            ) : (
              <div className="p-12 text-center text-slate-400">
                <NepaliMandalaBadge size={48} className="mx-auto mb-3" />
                <p>{lang === "ne" ? "बोर्ड लोड हुँदैछ..." : "Loading Board..."}</p>
              </div>
            )}
          </div>

          {/* Side Panel: Called Numbers & Game Info (lg:col-span-4) */}
          <div className="lg:col-span-4 w-full flex flex-col gap-4">
            {/* Live Opponent & Connection Widget */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative">
                  <span
                    className={`block w-3 h-3 rounded-full ${
                      peerConnected ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
                    }`}
                  />
                  {peerConnected && (
                    <span className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200 truncate">
                      {opponent ? opponent.name : t.player2}
                    </span>
                    {opponent?.is_leader && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50">
                        <Crown className="w-2.5 h-2.5 text-amber-400" />
                        <span>{t.roomLeader}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block -mt-0.5">
                    {peerConnected
                      ? t.connected
                      : disconnectSecLeft !== null
                      ? `${t.disconnected} (${disconnectSecLeft}s)`
                      : t.disconnected}
                  </span>
                </div>
              </div>

              {latency !== null && isConnected && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
                  <Activity className="w-3 h-3 text-amber-400" />
                  <span>{latency}ms</span>
                </div>
              )}
            </div>

            {/* Called Numbers History */}
            <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <History className="w-4 h-4 text-amber-400" />
                  <span>{t.gameHistory}</span>
                </div>
                <span className="font-mono text-xs text-slate-400">
                  {formatNum(gameState?.called_numbers?.length || 0)} / {formatNum(25)}
                </span>
              </div>

              {gameState?.called_numbers && gameState.called_numbers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                  {gameState.called_numbers.map((num, idx) => {
                    const isLatest = idx === gameState.called_numbers.length - 1;
                    return (
                      <span
                        key={num}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-all shadow-sm ${
                          isLatest
                            ? "bg-rose-600 text-white border-2 border-amber-300 ring-2 ring-rose-500/50 scale-110 font-extrabold animate-bounce-short"
                            : "bg-slate-800 text-amber-200 border border-slate-700"
                        }`}
                      >
                        {formatNum(num)}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">
                  {lang === "ne" ? "कुनै अंक बोलाइएको छैन" : "No numbers called yet"}
                </p>
              )}
            </div>

            {/* Quick Strategic Tips */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                {lang === "ne" ? "खेल सुझाव" : "Tactical Hint"}
              </span>
              <p>
                {lang === "ne"
                  ? "तपाईंले बोलाएको अंक विपक्षीको बोर्डमा पनि काटिन्छ। त्यसैले आफ्नो लाइन छिटो बनाउने अंक छान्नुहोस्!"
                  : "Every number you call is marked on your opponent's board as well. Choose numbers that complete your rows, columns, or diagonals faster!"}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Game Over Modal with Rematch Coordination */}
      <GameModal
        isOpen={isGameOver}
        result={gameState?.result ?? null}
        resultReason={gameState?.result_reason ?? null}
        isWinner={isWinner}
        isDraw={isDraw}
        myLines={myLines}
        opponentLines={opponentLines}
        rematchRequested={rematchRequested}
        onRequestRematch={requestRematch}
        onExit={handleExit}
        lang={lang}
        devanagariNumerals={devanagariNumerals}
      />
    </div>
  );
}
