export type RoomStatus = "WAITING" | "PREPARING" | "STARTING" | "PLAYING" | "FINISHED";

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

export type ConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "SIGNALING"
  | "NEGOTIATING"
  | "CONNECTED"
  | "RECONNECTING"
  | "FAILED";

export interface PlayerInfo {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  rematch_requested: boolean;
  disconnected_at: number | null;
  is_leader?: boolean;
  is_forfeited?: boolean;
  connection_state?: ConnectionState;
  last_heartbeat?: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  timestamp: number;
}

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
        marked_board: CellData[][];
        completed_lines: number;
        completed_line_details: LineDetail[];
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
  winning_lines: LineDetail[];
  events: GameEvent[];
  player_boards: Record<
    string,
    {
      player_id: string;
      player_name: string;
      is_leader: boolean;
      is_forfeited: boolean;
      grid: number[][];
      marked_board: CellData[][];
      completed_lines_count: number;
      completed_line_details: LineDetail[];
    }
  >;
}

export interface GameState {
  room_id: string;
  status: RoomStatus;
  creator_id: string;
  leader_id: string;
  is_leader: boolean;
  game_session_id?: string | null;
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
  result_reason: "BINGO" | "TURN_TIMEOUT" | "MATCH_TIMEOUT" | "DISCONNECT_FORFEIT" | "PLAYER_FORFEIT" | null;
  board: CellData[][] | null;
  player_id: string;
  player_lines: number;
  opponent_id: string | null;
  opponent_lines: number;
  peer_connected: boolean;
  peer_connection_state: ConnectionState;
  both_connected: boolean;
  completed_line_details: LineDetail[];
  chat_messages?: ChatMessage[];
  inspection_data?: InspectionData | null;
  connection_diagnostics?: {
    room_id: string;
    player_id: string;
    session_id?: string | null;
    connection_id?: string | null;
    role: string;
    signaling: string;
    transport: string;
    handshake: string;
    heartbeat: string;
    last_ping_ms?: number | null;
    peer_connected: boolean;
    game_session_id?: string | null;
  };
}

export interface WebSocketMessage {
  type: string;
  data?: any;
}
