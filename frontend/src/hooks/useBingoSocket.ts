"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GameState, WebSocketMessage, ConnectionState } from "../types/game";
import { soundFX } from "../lib/audio";
import { getOrCreateSessionId } from "../lib/utils";

interface UseBingoSocketOptions {
  roomId: string;
  playerId: string;
  playerName: string;
  onNumberCalled?: (num: number, calledBy: string) => void;
  onLineCompleted?: (count: number) => void;
  onGameOver?: (result: string, winner: string | null) => void;
  onKicked?: (reason?: string) => void;
}

const USER_CONNECTION_ERROR =
  "Unable to establish a connection with the other player. Please try reconnecting.";

const FATAL_CLOSE_CODES = new Set([4003, 4004, 4005, 4007, 4008, 4009]);
const MAX_RECONNECT_ATTEMPTS = 8;
const CONNECT_TIMEOUT_MS = 20000;
const HEARTBEAT_MS = 5000;
const MISSED_PONG_LIMIT = 5;

function netlog(event: string, fields: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[bingo.net] ${event}`, fields);
  }
}

function closeReasonMessage(code: number): string | null {
  switch (code) {
    case 4003:
      return "This room already has two players.";
    case 4004:
      return "This room does not exist or has expired.";
    case 4005:
    case 4007:
    case 4008:
      return "You were removed from the room by the room leader.";
    case 4006:
      return USER_CONNECTION_ERROR;
    case 4009:
      return "This room was opened in another tab.";
    default:
      return null;
  }
}

export function useBingoSocket({
  roomId,
  playerId,
  playerName,
  onNumberCalled,
  onLineCompleted,
  onGameOver,
  onKicked,
}: UseBingoSocketOptions) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("CONNECTING");
  const [latency, setLatency] = useState<number | null>(null);
  const [isKicked, setIsKicked] = useState<boolean>(false);
  const [kickedReason, setKickedReason] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lastCalled, setLastCalled] = useState<{ number: number; by: string } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const missedPongsRef = useRef<number>(0);
  const pingTimestampRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isManuallyClosedRef = useRef<boolean>(false);
  const isKickedRef = useRef<boolean>(false);
  const prevLinesRef = useRef<number>(0);
  const prevTurnRef = useRef<string | null>(null);
  const connectionIdRef = useRef<string>("");
  const helloRoundRef = useRef<number>(0);
  const verifiedRef = useRef<boolean>(false);
  const gameSessionIdRef = useRef<string | null>(null);

  const onNumberCalledRef = useRef(onNumberCalled);
  const onLineCompletedRef = useRef(onLineCompleted);
  const onGameOverRef = useRef(onGameOver);
  const onKickedRef = useRef(onKicked);
  onNumberCalledRef.current = onNumberCalled;
  onLineCompletedRef.current = onLineCompleted;
  onGameOverRef.current = onGameOver;
  onKickedRef.current = onKicked;

  const getWsUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = process.env.NEXT_PUBLIC_WS_HOST;
    if (!host) {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        host = window.location.hostname + ":8000";
      } else {
        host = "bingo-backend-e686.onrender.com";
      }
    }
    const cleanRoom = roomId.toUpperCase().trim();
    const query = playerName ? `?player_name=${encodeURIComponent(playerName)}` : "";
    return `${protocol}//${host}/api/ws/${cleanRoom}/${playerId}${query}`;
  }, [roomId, playerId, playerName]);

  const sendAction = useCallback((action: string, data: Record<string, unknown> = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, data }));
      return true;
    }
    return false;
  }, []);

  const stopHeartbeat = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  const applyGameState = useCallback((nextState: GameState) => {
    if (nextState.game_session_id) {
      gameSessionIdRef.current = nextState.game_session_id;
    }
    setGameState(nextState);

    if (nextState.both_connected) {
      verifiedRef.current = true;
      setConnectionState("CONNECTED");
    } else if (verifiedRef.current) {
      verifiedRef.current = false;
      setConnectionState((prev) => (prev === "FAILED" || prev === "DISCONNECTED" ? prev : "NEGOTIATING"));
    }

    if (
      nextState.current_turn === playerId &&
      prevTurnRef.current !== playerId &&
      nextState.status === "PLAYING"
    ) {
      soundFX.playTurnAlert();
    }
    prevTurnRef.current = nextState.current_turn;

    const currentLines = nextState.player_lines || 0;
    if (currentLines > prevLinesRef.current) {
      soundFX.playLineComplete();
      onLineCompletedRef.current?.(currentLines);
    }
    prevLinesRef.current = currentLines;
  }, [playerId]);

  const connect = useCallback(() => {
    if (!roomId || !playerId || isKickedRef.current) return;

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      verifiedRef.current = false;
      const reconnecting = reconnectAttemptsRef.current > 0;
      setConnectionState(reconnecting ? "RECONNECTING" : "CONNECTING");
      netlog(reconnecting ? "reconnect_attempt" : "connect_begin", {
        roomId,
        playerId,
        attempt: reconnectAttemptsRef.current,
      });

      const url = getWsUrl();
      const ws = new WebSocket(url);
      socketRef.current = ws;

      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          netlog("connect_timeout", { roomId, playerId });
          setError(USER_CONNECTION_ERROR);
          setConnectionState("FAILED");
          try {
            ws.close(4000, "Connect timeout");
          } catch {
            /* ignore */
          }
        }
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        setConnectionState("SIGNALING");
        setError(null);
        missedPongsRef.current = 0;
        netlog("ws_open", { roomId, playerId });
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          const type = msg.type;
          const data = msg.data || {};

          if (type === "PONG") {
            missedPongsRef.current = 0;
            if (pingTimestampRef.current > 0) {
              const rtt = Math.round(performance.now() - pingTimestampRef.current);
              setLatency(rtt);
            }
            return;
          }

          if (type === "WELCOME") {
            connectionIdRef.current = data.connection_id || "";
            setConnectionState("NEGOTIATING");
            const sessionId = getOrCreateSessionId(playerId);
            netlog("welcome", { roomId, playerId, connectionId: connectionIdRef.current, sessionId });
            ws.send(
              JSON.stringify({
                action: "HANDSHAKE",
                data: {
                  player_id: playerId,
                  player_name: playerName || "Player",
                  room_id: roomId.toUpperCase().trim(),
                  session_id: sessionId,
                  connection_id: connectionIdRef.current,
                },
              })
            );
            stopHeartbeat();
            pingIntervalRef.current = setInterval(() => {
              if (ws.readyState !== WebSocket.OPEN) return;
              missedPongsRef.current += 1;
              if (missedPongsRef.current >= MISSED_PONG_LIMIT) {
                netlog("heartbeat_timeout", { roomId, playerId, missed: missedPongsRef.current });
                setConnectionState("RECONNECTING");
                ws.close(4000, "Heartbeat timeout");
                return;
              }
              pingTimestampRef.current = performance.now();
              ws.send(JSON.stringify({ action: "PING", data: { timestamp: Date.now() } }));
            }, HEARTBEAT_MS);
            return;
          }

          if (type === "HANDSHAKE_ACK") {
            reconnectAttemptsRef.current = 0;
            setConnectionState("NEGOTIATING");
            netlog("handshake_ack", { roomId, playerId, sessionId: data.session_id });
            if (data.game_state) applyGameState(data.game_state);
            return;
          }

          if (type === "PEER_HELLO") {
            helloRoundRef.current = data.round ?? helloRoundRef.current;
            setConnectionState("NEGOTIATING");
            netlog("peer_hello", {
              roomId,
              playerId,
              peerId: data.peer_id,
              round: data.round,
            });
            ws.send(
              JSON.stringify({
                action: "PEER_HELLO_ACK",
                data: {
                  peer_id: data.peer_id,
                  peer_session_id: data.peer_session_id,
                  peer_connection_id: data.peer_connection_id,
                  round: data.round,
                  room_id: roomId.toUpperCase().trim(),
                  player_id: playerId,
                  session_id: getOrCreateSessionId(playerId),
                },
              })
            );
            if (data.game_state) applyGameState(data.game_state);
            return;
          }

          if (type === "PEER_READY") {
            setConnectionState("NEGOTIATING");
            netlog("peer_ready", { roomId, playerId });
            ws.send(
              JSON.stringify({
                action: "PEER_READY_ACK",
                data: {
                  room_id: roomId.toUpperCase().trim(),
                  player_id: playerId,
                  session_id: getOrCreateSessionId(playerId),
                  round: helloRoundRef.current,
                },
              })
            );
            if (data.game_state) applyGameState(data.game_state);
            return;
          }

          if (type === "PEER_VERIFIED") {
            netlog("peer_verified", { roomId, playerId });
            if (data.game_state) applyGameState(data.game_state);
            else {
              verifiedRef.current = true;
              setConnectionState("CONNECTED");
            }
            return;
          }

          if (type === "KICKED") {
            isKickedRef.current = true;
            setIsKicked(true);
            const reason = data?.reason || "You were removed from the room by the room leader.";
            setKickedReason(reason);
            setConnectionState("FAILED");
            setError(reason);
            onKickedRef.current?.(reason);
            netlog("kicked", { roomId, playerId });
            socketRef.current?.close(4008, "Kicked");
            return;
          }

          if (type === "ERROR") {
            const code = data?.code;
            const message = data?.message || USER_CONNECTION_ERROR;
            netlog("server_error", { roomId, playerId, code, message });
            if (code === "SESSION_SUPERSEDED") {
              isManuallyClosedRef.current = true;
              setConnectionState("FAILED");
            }
            setError(message);
            return;
          }

          if (data?.game_state) {
            applyGameState(data.game_state);
          }

          if (type === "NUMBER_CALLED") {
            const num = data?.number;
            const caller = data?.called_by;
            if (num) {
              setLastCalled({ number: num, by: caller });
              soundFX.playSingingBowl();
              onNumberCalledRef.current?.(num, caller);
            }
          } else if (type === "GAME_FINISHED") {
            const winner = data?.winner;
            const result = data?.result;
            if (winner === playerId) {
              soundFX.playVictory();
            } else if (winner) {
              soundFX.playDefeat();
            }
            onGameOverRef.current?.(result, winner);
          } else if (type === "GAME_STARTED") {
            netlog("game_started", {
              roomId,
              playerId,
              gameSessionId: data.game_session_id || gameSessionIdRef.current,
            });
          }
        } catch (e) {
          console.error("[bingo.net] parse_failed", e);
        }
      };

      ws.onclose = (event) => {
        stopHeartbeat();
        if (connectTimeoutRef.current) {
          clearTimeout(connectTimeoutRef.current);
          connectTimeoutRef.current = null;
        }
        verifiedRef.current = false;
        netlog("ws_close", { roomId, playerId, code: event.code, reason: event.reason });

        const fatalMessage = closeReasonMessage(event.code);
        if (event.code === 4005 || event.code === 4007 || event.code === 4008 || isKickedRef.current) {
          isKickedRef.current = true;
          setIsKicked(true);
          setConnectionState("FAILED");
          if (fatalMessage) {
            setKickedReason(fatalMessage);
            setError(fatalMessage);
          }
          return;
        }

        if (FATAL_CLOSE_CODES.has(event.code)) {
          setConnectionState("FAILED");
          setError(fatalMessage || USER_CONNECTION_ERROR);
          return;
        }

        if (isManuallyClosedRef.current || event.code === 1000) {
          setConnectionState("DISCONNECTED");
          return;
        }

        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionState("FAILED");
          setError(USER_CONNECTION_ERROR);
          return;
        }

        setConnectionState("RECONNECTING");
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        netlog("ws_error", { roomId, playerId });
        setConnectionState((prev) => (prev === "CONNECTED" ? "RECONNECTING" : prev === "FAILED" ? prev : "NEGOTIATING"));
      };
    } catch (e) {
      console.error("[bingo.net] connect_failed", e);
      setConnectionState("FAILED");
      setError(USER_CONNECTION_ERROR);
    }
  }, [roomId, playerId, playerName, getWsUrl, applyGameState]);

  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        netlog("tab_visible", { roomId, playerId });
        if (
          !socketRef.current ||
          socketRef.current.readyState === WebSocket.CLOSED ||
          socketRef.current.readyState === WebSocket.CLOSING
        ) {
          connect();
        } else if (socketRef.current.readyState === WebSocket.OPEN) {
          missedPongsRef.current = 0;
          pingTimestampRef.current = performance.now();
          socketRef.current.send(JSON.stringify({ action: "PING", data: { timestamp: Date.now() } }));
        }
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isManuallyClosedRef.current = true;
      stopHeartbeat();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
      }
    };
  }, [connect, roomId, playerId]);

  const callNumber = useCallback((number: number) => {
    return sendAction("CALL_NUMBER", { number });
  }, [sendAction]);

  const setReady = useCallback((ready: boolean) => {
    return sendAction("READY", { ready });
  }, [sendAction]);

  const randomizeBoard = useCallback(() => {
    return sendAction("RANDOMIZE_BOARD");
  }, [sendAction]);

  const swapCells = useCallback((row1: number, col1: number, row2: number, col2: number) => {
    return sendAction("SWAP_CELLS", { row1, col1, row2, col2 });
  }, [sendAction]);

  const setEntireBoard = useCallback((board: number[][]) => {
    return sendAction("SET_BOARD", { board });
  }, [sendAction]);

  const requestRematch = useCallback(() => {
    return sendAction("REQUEST_REMATCH");
  }, [sendAction]);

  const startGame = useCallback(() => {
    return sendAction("START_GAME");
  }, [sendAction]);

  const kickPlayer = useCallback((targetPlayerId: string) => {
    return sendAction("KICK_PLAYER", { target_player_id: targetPlayerId });
  }, [sendAction]);

  const peerConnected = Boolean(gameState?.peer_connected);
  const bothConnected = Boolean(gameState?.both_connected);
  const isConnected = connectionState === "CONNECTED" && bothConnected;
  const isLeader = Boolean(gameState?.is_leader || (gameState?.leader_id && gameState.leader_id === playerId));

  return {
    gameState,
    isConnected,
    connectionState,
    latency,
    isKicked,
    kickedReason,
    error,
    lastCalled,
    isLeader,
    peerConnected,
    bothConnected,
    callNumber,
    setReady,
    randomizeBoard,
    swapCells,
    setEntireBoard,
    requestRematch,
    startGame,
    kickPlayer,
    reconnect: connect,
    clearError: () => setError(null),
  };
}
