"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Copy,
  Check,
  Clock,
  ShieldAlert,
  Share2,
  ArrowLeft,
  Crown,
  UserX,
  Play,
  Activity,
  History,
  Flag,
} from "lucide-react";
import { Header } from "../../../components/Header";
import { DhakaBorder, NepaliMandalaBadge } from "../../../components/DhakaPattern";
import { PreparationBoard } from "../../../components/PreparationBoard";
import { Board } from "../../../components/Board";
import { BingoProgress } from "../../../components/BingoProgress";
import { TimerDisplay } from "../../../components/TimerDisplay";
import { GameNotificationBanner } from "../../../components/Notifications";
import { GameModal } from "../../../components/GameModal";
import { PlayerStatus } from "../../../components/PlayerStatus";
import { ChatPanel } from "../../../components/ChatPanel";
import { GameInspectionModal } from "../../../components/GameInspectionModal";
import { useBingoSocket } from "../../../hooks/useBingoSocket";
import { Language, translations } from "../../../lib/translations";
import {
  getOrCreatePlayerId,
  getStoredPlayerName,
  formatTime,
  formatTimeNepali,
  toDevanagari,
  copyToClipboard,
} from "../../../lib/utils";

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
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copyFailed, setCopyFailed] = useState<boolean>(false);
  const [prepSecLeft, setPrepSecLeft] = useState<number>(60);
  const [disconnectSecLeft, setDisconnectSecLeft] = useState<number | null>(null);

  // Kick confirmation, kicked, forfeit, chat, and inspection modals
  const [kickCandidate, setKickCandidate] = useState<{ id: string; name: string } | null>(null);
  const [showKickedModal, setShowKickedModal] = useState<boolean>(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [showInspectionModal, setShowInspectionModal] = useState<boolean>(false);

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
    isKicked,
    kickedReason,
    error,
    isLeader,
    peerConnected,
    bothConnected,
    chatMessages,
    inspectionData,
    lastCalled,
    callNumber,
    randomizeBoard,
    swapCells,
    resetBoard,
    setReady,
    startGame,
    kickPlayer,
    requestRematch,
    forfeitGame,
    sendChat,
  } = useBingoSocket({
    roomId,
    playerId,
    playerName,
    onKicked: () => {
      setShowKickedModal(true);
    },
  });

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

  const playersList = Object.values(gameState?.players || {});
  const opponent = playersList.find((p) => p.id !== playerId);

  // Opponent disconnect countdown timer
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

  const handleCopyLink = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/room/${roomId}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyCode = async () => {
    const code = roomId.trim();
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopyFailed(false);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } else {
      setCopiedCode(false);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2500);
    }
  };

  const handleConfirmKick = () => {
    if (kickCandidate) {
      kickPlayer(kickCandidate.id);
      setKickCandidate(null);
    }
  };

  const myPlayer = gameState?.players?.[playerId];
  const isMyReady = myPlayer?.ready || false;

  const isPlaying = gameState?.status === "PLAYING";
  const isFinished = gameState?.status === "FINISHED";
  const isGamePhase = isPlaying || isFinished;

  const isMyTurn = gameState?.current_turn === playerId && isPlaying;
  const myLines = gameState?.player_lines || 0;
  const opponentLines = gameState?.opponent_lines || 0;
  const isWinner = gameState?.winner === playerId;
  const isDraw = gameState?.result === "DRAW";
  const rematchRequested = myPlayer?.rematch_requested || false;

  const currentTurnPlayer = gameState?.current_turn
    ? gameState.players[gameState.current_turn]?.name || "Player"
    : undefined;

  const iForfeited = Boolean(myPlayer?.is_forfeited);
  const opponentForfeited = Boolean(opponent?.is_forfeited);

  const handleCallNumber = (num: number) => {
    if (!isMyTurn || iForfeited) return;
    callNumber(num);
  };

  const handleConfirmForfeit = () => {
    forfeitGame();
    setShowForfeitConfirm(false);
  };

  const handleExit = () => {
    router.push("/");
  };

  const formatNum = (n: number) => (devanagariNumerals ? toDevanagari(n) : n);

  // Verified Connection State Indicator
  const getConnectionIndicator = () => {
    if (bothConnected) {
      return {
        dotClass: "bg-emerald-500",
        pingClass: "bg-emerald-500 animate-ping",
        textClass: "text-emerald-400",
        label: t.connConnected,
      };
    }

    if (connectionState === "RECONNECTING") {
      return {
        dotClass: "bg-amber-500",
        pingClass: "bg-amber-500 animate-ping",
        textClass: "text-amber-400",
        label: t.connReconnecting,
      };
    }

    if (connectionState === "FAILED" || isKicked) {
      return {
        dotClass: "bg-rose-500",
        pingClass: "",
        textClass: "text-rose-400",
        label: t.connFailed,
      };
    }

    if (
      connectionState === "CONNECTING" ||
      connectionState === "SIGNALING" ||
      connectionState === "NEGOTIATING"
    ) {
      return {
        dotClass: "bg-amber-500",
        pingClass: "bg-amber-500 animate-ping",
        textClass: "text-amber-400",
        label: t.connConnecting,
      };
    }

    if (isConnected && !peerConnected) {
      return {
        dotClass: "bg-amber-500",
        pingClass: "bg-amber-500/50 animate-pulse",
        textClass: "text-amber-400",
        label: t.waitingForPlayerConnection,
      };
    }

    return {
      dotClass: "bg-slate-500",
      pingClass: "",
      textClass: "text-slate-400",
      label: t.connDisconnected,
    };
  };

  const connIndicator = getConnectionIndicator();

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

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 sm:py-6 flex flex-col items-center gap-4">
        {/* Navigation Breadcrumb (When in lobby/preparation) */}
        {!isGamePhase && (
          <div className="w-full max-w-4xl flex items-center justify-between mb-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.exitHome}</span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors shadow"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? t.copied : copyFailed ? t.copyFailed : t.copyCode}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 transition-colors shadow"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? t.copied : t.shareRoom}</span>
              </button>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="w-full max-w-xl p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/80 text-rose-200 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Reconnecting Alert Banner */}
        {connectionState === "RECONNECTING" && (
          <div className="w-full max-w-xl p-3 rounded-xl bg-amber-950/90 border border-amber-500/80 text-amber-200 text-xs flex items-center justify-between shadow-lg animate-pulse">
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

        {/* Opponent Disconnected Countdown Banner (During Playing) */}
        {isGamePhase && disconnectSecLeft !== null && disconnectSecLeft > 0 && !isFinished && (
          <div className="w-full max-w-xl p-3 rounded-xl bg-rose-950/90 border border-rose-500/80 text-rose-200 text-xs flex items-center justify-between shadow-lg">
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

        {/* ---------------- PHASE 1 & 2: LOBBY & PREPARATION HEADER BANNER ---------------- */}
        {!isGamePhase && (
          <div className="w-full max-w-xl mb-2 bg-slate-900 border border-amber-500/30 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                <Users className="w-4 h-4 text-amber-400" />
                <span>
                  {t.connectedPlayers} ({playersList.length}/2)
                </span>
              </div>

              {/* REAL VERIFIED CONNECTION INDICATOR */}
              <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center">
                  {connIndicator.pingClass && (
                    <span className={`absolute w-3 h-3 rounded-full opacity-75 ${connIndicator.pingClass}`} />
                  )}
                  <span className={`relative w-2.5 h-2.5 rounded-full ${connIndicator.dotClass}`} />
                </div>
                <span className={`text-xs font-semibold ${connIndicator.textClass}`}>
                  {connIndicator.label}
                </span>
                {latency !== null && isConnected && (
                  <span className="text-[10px] text-slate-400 font-mono ml-1">
                    ({latency}ms)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Player 1 (You) */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-slate-200 font-bold truncate">
                      {myPlayer?.name || playerName} (You)
                    </span>
                  </div>
                  {isLeader ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 shrink-0">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span>{t.roomLeader}</span>
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                      {t.playerRole}
                    </span>
                  )}
                </div>

                <PlayerStatus
                  player={myPlayer}
                  connected={isConnected}
                  lang={lang}
                />
              </div>

              {/* Player 2 (Opponent) */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs text-slate-200 font-bold truncate">
                      {opponent ? opponent.name : t.player2}
                    </span>
                  </div>
                  {opponent && (
                    <>
                      {opponent.is_leader ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 shrink-0">
                          <Crown className="w-3 h-3 text-amber-400" />
                          <span>{t.roomLeader}</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                          {t.playerRole}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  {opponent ? (
                    <>
                      <div className="flex items-center justify-between gap-2 w-full">
                        <PlayerStatus
                          player={opponent}
                          connected={peerConnected}
                          lang={lang}
                          compact
                        />
                        {isLeader && (
                          <button
                            onClick={() => setKickCandidate({ id: opponent.id, name: opponent.name })}
                            className="p-1 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-600/40 transition-colors"
                            title={t.kickPlayer}
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-[10px] text-amber-400/80 italic animate-pulse">
                      {lang === "ne" ? "प्रतीक्षा..." : "Waiting..."}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Room Leader Manual Start Button if both connected */}
            {isLeader && opponent && (gameState?.status === "PREPARING" || gameState?.status === "WAITING") && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {!bothConnected
                    ? t.waitingForPlayerConnection
                    : !playersList.every((p) => p.ready)
                    ? (lang === "ne" ? `खेल सुरु गर्न ${opponent.name} को तयारीको प्रतीक्षा गरिँदैछ...` : `Waiting for ${opponent.name} to be ready...`)
                    : (lang === "ne" ? "दुबै खेलाडी तयार छन्! खेल सुरु गर्न सक्नुहुन्छ।" : "All players ready! Launch the match now.")}
                </span>
                <button
                  onClick={startGame}
                  disabled={!bothConnected || !playersList.every((p) => p.ready)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed shadow transition-all active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t.startMatchNow}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------- WAITING PHASE: When waiting for Player 2 to join ---------------- */}
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
                onClick={handleCopyCode}
                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <DhakaBorder className="mt-4" />
          </div>
        )}

        {/* ---------------- PREPARING PHASE: When both players joined, 60s countdown ---------------- */}
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
                  <span className="text-xs text-slate-300">{t.preparationNotice}</span>
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

            {/* Preparation Board with Click-to-Swap, Drag-and-Drop, Randomize, Reset, and Ready Toggle */}
            <PreparationBoard
              board={gameState.board}
              onSwapCells={swapCells}
              onRandomize={randomizeBoard}
              onResetBoard={resetBoard}
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

        {/* ---------------- PHASE 3 & 4: ACTIVE PLAYING / FINISHED GAME ---------------- */}
        {isGamePhase && (
          <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
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

            {/* 4. Responsive Layout: Main 5x5 Board & Side Panel */}
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
                    disabled={iForfeited}
                    disabledLabel={t.youForfeited}
                  />
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    <NepaliMandalaBadge size={48} className="mx-auto mb-3" />
                    <p>{lang === "ne" ? "बोर्ड लोड हुँदैछ..." : "Loading Board..."}</p>
                  </div>
                )}
              </div>

              {/* Side Panel: Live Opponent & Called Numbers (lg:col-span-4) */}
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
                        {opponentForfeited
                          ? t.forfeited
                          : peerConnected
                          ? t.connected
                          : disconnectSecLeft !== null
                          ? `${t.disconnected} (${disconnectSecLeft}s)`
                          : t.disconnected}
                      </span>
                      {opponent && (
                        <div className="mt-1">
                          <PlayerStatus player={opponent} connected={peerConnected} lang={lang} compact />
                        </div>
                      )}
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

                {isPlaying && !iForfeited && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                      {lang === "ne" ? "खेल मेनु" : "Game Menu"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowForfeitConfirm(true)}
                      aria-label={t.forfeitGame}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-transparent hover:bg-rose-950/50 text-rose-400 hover:text-rose-300 border border-rose-800/40 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{t.forfeitGame}</span>
                    </button>
                  </div>
                )}

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
          </div>
        )}
      </main>

      {/* Game Over Modal with Rematch & Inspection Coordination */}
      <GameModal
        isOpen={isFinished}
        result={gameState?.result ?? null}
        resultReason={gameState?.result_reason ?? null}
        isWinner={isWinner}
        isDraw={isDraw}
        myLines={myLines}
        opponentLines={opponentLines}
        myName={myPlayer?.name}
        opponentName={opponent?.name}
        winnerName={gameState?.winner ? gameState.players[gameState.winner]?.name : undefined}
        rematchRequested={rematchRequested}
        onRequestRematch={requestRematch}
        onInspectGame={() => setShowInspectionModal(true)}
        onExit={handleExit}
        lang={lang}
        devanagariNumerals={devanagariNumerals}
      />

      {/* Real-Time Multiplayer Chat Drawer */}
      <ChatPanel
        messages={chatMessages}
        myPlayerId={playerId}
        onSendMessage={sendChat}
        lang={lang}
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen((prev) => !prev)}
      />

      {/* Post-Game Replay & Inspection Modal */}
      <GameInspectionModal
        isOpen={showInspectionModal}
        onClose={() => setShowInspectionModal(false)}
        inspectionData={inspectionData || (gameState?.inspection_data ?? null)}
        myPlayerId={playerId}
        lang={lang}
        devanagariNumerals={devanagariNumerals}
      />

      {showForfeitConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forfeit-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowForfeitConfirm(false);
          }}
        >
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto mb-3">
              <Flag className="w-6 h-6 text-rose-400" />
            </div>
            <h3 id="forfeit-title" className="text-base font-bold text-white mb-2">
              {t.forfeitConfirmTitle}
            </h3>
            <p className="text-xs text-slate-300 mb-6">{t.forfeitConfirmMessage}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForfeitConfirm(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmForfeit}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
              >
                {t.confirmForfeit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kick Player Confirmation Modal (Leader only) */}
      {kickCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto mb-3">
              <UserX className="w-6 h-6 text-rose-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">{t.kickConfirmTitle}</h3>
            <p className="text-xs text-slate-300 mb-6">
              {t.kickConfirmMessage.replace("{name}", kickCandidate.name)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setKickCandidate(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleConfirmKick}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors"
              >
                {t.confirmKick}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kicked Alert Modal (For kicked player) */}
      {(showKickedModal || isKicked) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/60 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/50 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-rose-400" />
            </div>
            <h3 className="text-lg font-bold text-rose-300 mb-2">{t.kickedTitle}</h3>
            <p className="text-xs text-slate-300 mb-6">
              {kickedReason || t.kickedNotice}
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              {t.backToHome}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
