"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GameState, WebSocketMessage, ConnectionState } from "../types/game";
import { soundFX } from "../lib/audio";

interface UseBingoSocketOptions {
  roomId: string;
  playerId: string;
  playerName: string;
  onNumberCalled?: (num: number, calledBy: string) => void;
  onLineCompleted?: (count: number) => void;
  onGameOver?: (result: string, winner: string | null) => void;
  onKicked?: (reason?: string) => void;
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
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const missedPongsRef = useRef<number>(0);
  const pingTimestampRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isManuallyClosedRef = useRef<boolean>(false);
  const prevLinesRef = useRef<number>(0);
  const prevTurnRef = useRef<string | null>(null);

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

  const sendAction = useCallback((action: string, data: any = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, data }));
      return true;
    }
    return false;
  }, []);

  const connect = useCallback(() => {
    if (!roomId || !playerId || isKicked) return;

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      setConnectionState((prev) => (reconnectAttemptsRef.current > 0 ? "RECONNECTING" : "CONNECTING"));
      const url = getWsUrl();
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionState("SIGNALING");
        setError(null);
        reconnectAttemptsRef.current = 0;
        missedPongsRef.current = 0;

        // Perform explicit application-level HANDSHAKE
        setConnectionState("NEGOTIATING");
        ws.send(
          JSON.stringify({
            action: "HANDSHAKE",
            data: {
              player_id: playerId,
              player_name: playerName || "Player",
              room_id: roomId.toUpperCase(),
              session_id: `${playerId}_${Date.now()}`,
            },
          })
        );

        // Start frequent ping-pong heartbeat (every 5 seconds)
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            missedPongsRef.current += 1;
            if (missedPongsRef.current >= 3) {
              // Missed 3 pongs (15s) - connection likely broken, trigger reconnect
              console.warn("Heartbeat missed 3 pongs, closing websocket to reconnect...");
              setConnectionState("RECONNECTING");
              ws.close(4000, "Heartbeat timeout");
              return;
            }
            pingTimestampRef.current = performance.now();
            ws.send(JSON.stringify({ action: "PING" }));
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          const type = msg.type;
          const data = msg.data;

          if (type === "PONG") {
            missedPongsRef.current = 0;
            if (pingTimestampRef.current > 0) {
              const rtt = Math.round(performance.now() - pingTimestampRef.current);
              setLatency(rtt);
            }
            return;
          }

          if (type === "HANDSHAKE_ACK") {
            setConnectionState("CONNECTED");
            if (data?.game_state) {
              setGameState(data.game_state);
            }
            return;
          }

          if (type === "KICKED") {
            setIsKicked(true);
            const reason = data?.reason || "You were removed from the room by the room leader.";
            setKickedReason(reason);
            setConnectionState("FAILED");
            setError(reason);
            onKicked?.(reason);
            if (socketRef.current) {
              socketRef.current.close(4008, "Kicked");
            }
            return;
          }

          if (type === "ERROR") {
            setError(data?.message || "Server reported an error");
            return;
          }

          // Authoritative game state update
          if (data?.game_state) {
            const nextState: GameState = data.game_state;
            setGameState(nextState);

            // Turn sound notification
            if (
              nextState.current_turn === playerId &&
              prevTurnRef.current !== playerId &&
              nextState.status === "PLAYING"
            ) {
              soundFX.playTurnAlert();
            }
            prevTurnRef.current = nextState.current_turn;

            // Line completion sound notification
            const currentLines = nextState.player_lines || 0;
            if (currentLines > prevLinesRef.current) {
              soundFX.playLineComplete();
              onLineCompleted?.(currentLines);
            }
            prevLinesRef.current = currentLines;
          }

          if (type === "NUMBER_CALLED") {
            const num = data?.number;
            const caller = data?.called_by;
            if (num) {
              setLastCalled({ number: num, by: caller });
              soundFX.playSingingBowl();
              onNumberCalled?.(num, caller);
            }
          } else if (type === "GAME_FINISHED") {
            const winner = data?.winner;
            const result = data?.result;
            if (winner === playerId) {
              soundFX.playVictory();
            } else if (winner) {
              soundFX.playDefeat();
            }
            onGameOver?.(result, winner);
          }
        } catch (e) {
          console.error("Failed to parse websocket message:", e);
        }
      };

      ws.onclose = (event) => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        if (event.code === 4008 || isKicked) {
          setConnectionState("FAILED");
          return;
        }

        if (isManuallyClosedRef.current || event.code === 1000) {
          setConnectionState("DISCONNECTED");
          return;
        }

        if (event.code === 4003) {
          setConnectionState("FAILED");
          setError("Room is full (maximum 2 players).");
          return;
        }

        if (event.code === 4004) {
          setConnectionState("FAILED");
          setError("Room does not exist.");
          return;
        }

        // Connection dropped unexpectedly; initiate auto-reconnect
        setConnectionState("RECONNECTING");
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        setConnectionState((prev) => (prev === "CONNECTED" ? "RECONNECTING" : "FAILED"));
      };
    } catch (e) {
      console.error("WebSocket connection initiation failed:", e);
      setConnectionState("FAILED");
    }
  }, [roomId, playerId, playerName, isKicked, getWsUrl, onNumberCalled, onLineCompleted, onGameOver, onKicked]);

  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();
    return () => {
      isManuallyClosedRef.current = true;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
      }
    };
  }, [connect]);

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

  const isConnected = connectionState === "CONNECTED";
  const isLeader = Boolean(
    gameState?.is_leader ||
    (gameState?.leader_id && gameState?.leader_id === playerId) ||
    (gameState?.creator_id && gameState?.creator_id === playerId)
  );
  const peerConnected = Boolean(gameState?.peer_connected);
  const bothConnected = Boolean(gameState?.both_connected);

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

