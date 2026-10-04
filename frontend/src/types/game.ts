export type RoomStatus = "WAITING" | "PREPARING" | "PLAYING" | "FINISHED";

export interface CellData {
  number: number;
  marked: boolean;
  row: number;
  col: number;
}

export interface LineDetail {
  type: "row" | "col" | "diagonal";
  index: number;
  id: string;
  coordinates: [number, number][];
  numbers: number[];
}

export interface PlayerInfo {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  rematch_requested: boolean;
  disconnected_at: number | null;
}

export interface GameState {
  room_id: string;
  status: RoomStatus;
  creator_id: string;
  players: Record<string, PlayerInfo>;
  player_order: string[];
  current_turn: string | null;
  called_numbers: number[];
  preparation_deadline: number | null;
  match_deadline: number | null;
  turn_started_at: number | null;
  turn_deadline: number | null;
  completed_lines: Record<string, number>;
  winner: string | null;
  result: "PLAYER1_WIN" | "PLAYER2_WIN" | "DRAW" | null;
  result_reason: "BINGO" | "TURN_TIMEOUT" | "MATCH_TIMEOUT" | "DISCONNECT_FORFEIT" | null;
  board: CellData[][] | null;
  player_id: string;
  player_lines: number;
  opponent_id: string | null;
  opponent_lines: number;
  completed_line_details: LineDetail[];
}

export interface WebSocketMessage {
  type: string;
  data?: any;
}
