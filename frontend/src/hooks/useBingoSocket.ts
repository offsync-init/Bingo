"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GameState, WebSocketMessage } from "../types/game";
import { soundFX } from "../lib/audio";

interface UseBingoSocketOptions {
  roomId: string;
  playerId: string;
  playerName: string;
  onNumberCalled?: (num: number, calledBy: string) => void;
  onLineCompleted?: (count: number) => void;
  onGameOver?: (result: string, winner: string | null) => void;
}

export function useBingoSocket({
  roomId,
  playerId,
  playerName,
  onNumberCalled,
  onLineCompleted,
  onGameOver,
}: UseBingoSocketOptions) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCalled, setLastCalled] = useState<{ number: number; by: string } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
    return `${protocol}//${host}/api/ws/${roomId.toUpperCase()}/${playerId}`;
  }, [roomId, playerId]);

  const connect = useCallback(() => {
    if (!roomId || !playerId) return;

    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        // Start ping interval
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "PING" }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          const type = msg.type;
          const data = msg.data;

          if (type === "PONG") {
            return;
          }

          if (type === "ERROR") {
            setError(data?.message || "Server reported an error");
            return;
          }

          // Handle authoritative game state update
          if (data?.game_state) {
            const nextState: GameState = data.game_state;
            setGameState(nextState);

            // Check if player's turn just started
            if (nextState.current_turn === playerId && prevTurnRef.current !== playerId && nextState.status === "PLAYING") {
              soundFX.playTurnAlert();
            }
            prevTurnRef.current = nextState.current_turn;

            // Check if player completed a line
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
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Auto-reconnect after 2 seconds if not intentionally closed
        if (event.code !== 1000 && event.code !== 4003 && event.code !== 4004) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 2000);
        } else if (event.code === 4003) {
          setError("Room is full (maximum 2 players).");
        } else if (event.code === 4004) {
          setError("Room does not exist.");
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.error("WebSocket connection failed:", e);
    }
  }, [roomId, playerId, getWsUrl, onNumberCalled, onLineCompleted, onGameOver]);

  useEffect(() => {
    connect();
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close(1000);
      }
    };
  }, [connect]);

  const sendAction = useCallback((action: string, data: any = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, data }));
      return true;
    }
    return false;
  }, []);

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

  return {
    gameState,
    isConnected,
    error,
    lastCalled,
    callNumber,
    setReady,
    randomizeBoard,
    swapCells,
    setEntireBoard,
    requestRematch,
    clearError: () => setError(null),
  };
}
