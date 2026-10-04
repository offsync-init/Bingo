import asyncio
import time
import random
import string
from typing import Dict, List, Optional, Set, Any, Tuple
from app.game.engine import (
    generate_board,
    validate_board,
    get_completed_lines,
    count_completed_lines,
    has_bingo,
    format_board_with_marks,
    validate_move,
    TARGET_LINES_FOR_BINGO
)
from app.database import save_room_state, load_room_state

PREPARATION_DURATION_SEC = 60.0
TURN_DURATION_SEC = 120.0
MATCH_DURATION_SEC = 300.0
DISCONNECT_GRACE_SEC = 30.0


def generate_room_code(length: int = 6) -> str:
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(chars) for _ in range(length))


class GameRoom:
    def __init__(self, room_id: str, creator_id: str, creator_name: str):
        self.room_id = room_id
        self.creator_id = creator_id
        self.leader_id = creator_id
        self.status = "WAITING"  # WAITING, PREPARING, PLAYING, FINISHED
        self.players: Dict[str, Dict[str, Any]] = {
            creator_id: {
                "id": creator_id,
                "name": creator_name,
                "connected": False,  # Verified upon WebSocket handshake
                "ready": False,
                "rematch_requested": False,
                "disconnected_at": None,
                "is_leader": True,
                "connection_state": "DISCONNECTED",
                "last_heartbeat": time.time(),
                "session_id": None,
            }
        }
        self.player_order: List[str] = [creator_id]
        self.boards: Dict[str, List[List[int]]] = {
            creator_id: generate_board()
        }
        self.called_numbers: List[int] = []
        self.current_turn: Optional[str] = None
        self.preparation_deadline: Optional[float] = None
        self.turn_started_at: Optional[float] = None
        self.turn_deadline: Optional[float] = None
        self.match_deadline: Optional[float] = None
        self.winner: Optional[str] = None
        self.result: Optional[str] = None
        self.result_reason: Optional[str] = None

        self.lock = asyncio.Lock()
        self._timer_task: Optional[asyncio.Task] = None
        self._listeners: Set[Any] = set()

    def add_listener(self, queue: asyncio.Queue):
        self._listeners.add(queue)

    def remove_listener(self, queue: asyncio.Queue):
        self._listeners.discard(queue)

    async def notify_listeners(self, event_type: str, data: Dict[str, Any]):
        for q in list(self._listeners):
            try:
                await q.put({"type": event_type, "data": data})
            except Exception:
                pass

    def to_dict(self) -> Dict[str, Any]:
        return {
            "room_id": self.room_id,
            "status": self.status,
            "creator_id": self.creator_id,
            "leader_id": self.leader_id,
            "players": self.players,
            "player_order": self.player_order,
            "boards": self.boards,
            "called_numbers": self.called_numbers,
            "current_turn": self.current_turn,
            "preparation_deadline": self.preparation_deadline,
            "turn_started_at": self.turn_started_at,
            "turn_deadline": self.turn_deadline,
            "match_deadline": self.match_deadline,
            "winner": self.winner,
            "result": self.result,
            "result_reason": self.result_reason,
        }

    def get_player_view(self, player_id: str) -> Dict[str, Any]:
        called_set = set(self.called_numbers)
        player_board = self.boards.get(player_id)
        formatted_board = format_board_with_marks(player_board, called_set) if player_board else None
        completed_lines_count = count_completed_lines(player_board, called_set) if player_board else 0
        completed_line_details = get_completed_lines(player_board, called_set) if player_board else []

        opponent_id = None
        opponent_lines = 0
        for pid in self.player_order:
            if pid != player_id:
                opponent_id = pid
                opp_board = self.boards.get(pid)
                if opp_board:
                    opponent_lines = count_completed_lines(opp_board, called_set)
                break

        lines_summary = {
            pid: count_completed_lines(self.boards[pid], called_set)
            for pid in self.player_order if pid in self.boards
        }

        # Real verified opponent connection
        opponent_player = self.players.get(opponent_id) if opponent_id else None
        peer_connected = bool(opponent_player and opponent_player.get("connected", False))
        peer_connection_state = opponent_player.get("connection_state", "DISCONNECTED") if opponent_player else "DISCONNECTED"
        both_connected = bool(
            len(self.player_order) >= 2 and
            all(self.players[pid].get("connected", False) for pid in self.player_order if pid in self.players)
        )

        # Synchronize is_leader on each player record
        for pid, pdata in self.players.items():
            pdata["is_leader"] = (pid == self.leader_id)

        return {
            "room_id": self.room_id,
            "status": self.status,
            "creator_id": self.creator_id,
            "leader_id": self.leader_id,
            "is_leader": player_id == self.leader_id,
            "players": self.players,
            "player_order": self.player_order,
            "current_turn": self.current_turn,
            "called_numbers": self.called_numbers,
            "preparation_deadline": self.preparation_deadline,
            "match_deadline": self.match_deadline,
            "turn_started_at": self.turn_started_at,
            "turn_deadline": self.turn_deadline,
            "completed_lines": lines_summary,
            "winner": self.winner,
            "result": self.result,
            "result_reason": self.result_reason,
            "board": formatted_board,
            "player_id": player_id,
            "player_lines": completed_lines_count,
            "opponent_id": opponent_id,
            "opponent_lines": opponent_lines,
            "peer_connected": peer_connected,
            "peer_connection_state": peer_connection_state,
            "both_connected": both_connected,
            "completed_line_details": completed_line_details,
        }


class RoomService:
    def __init__(self):
        self.rooms: Dict[str, GameRoom] = {}
        self._bg_monitor_task: Optional[asyncio.Task] = None

    async def start_monitor(self):
        if self._bg_monitor_task is None or self._bg_monitor_task.done():
            self._bg_monitor_task = asyncio.create_task(self._monitor_rooms())

    async def _monitor_rooms(self):
        while True:
            try:
                await asyncio.sleep(0.5)
                now = time.time()
                for room in list(self.rooms.values()):
                    async with room.lock:
                        # Check heartbeat timeout (15s tolerance)
                        for pid, pdata in room.players.items():
                            if pdata.get("connected"):
                                last_hb = pdata.get("last_heartbeat", now)
                                if now - last_hb >= 15.0:
                                    pdata["connected"] = False
                                    pdata["connection_state"] = "DISCONNECTED"
                                    pdata["disconnected_at"] = now
                                    await save_room_state(room.to_dict())
                                    await room.notify_listeners("PLAYER_DISCONNECTED", {
                                        "player_id": pid,
                                        "grace_period_sec": DISCONNECT_GRACE_SEC
                                    })

                        if room.status == "PREPARING":
                            if room.preparation_deadline and now >= room.preparation_deadline:
                                # Only auto-start if both players are actually connected!
                                if len(room.players) == 2 and all(p.get("connected") for p in room.players.values()):
                                    await self._start_game_unlocked(room)
                        elif room.status == "PLAYING":
                            # Check match deadline first
                            if room.match_deadline and now >= room.match_deadline:
                                await self._handle_match_timeout_unlocked(room)
                            # Check turn deadline
                            elif room.turn_deadline and now >= room.turn_deadline:
                                await self._handle_turn_timeout_unlocked(room)

                        # Check disconnect forfeit grace period
                        for pid, pdata in room.players.items():
                            if not pdata.get("connected") and pdata.get("disconnected_at"):
                                if now - pdata["disconnected_at"] >= DISCONNECT_GRACE_SEC and room.status in ("PREPARING", "PLAYING"):
                                    await self._handle_disconnect_forfeit_unlocked(room, pid)
            except Exception as e:
                # Keep monitor alive
                await asyncio.sleep(1)

    async def create_room(self, creator_id: str, creator_name: str) -> GameRoom:
        room_id = generate_room_code()
        while room_id in self.rooms:
            room_id = generate_room_code()

        room = GameRoom(room_id, creator_id, creator_name)
        self.rooms[room_id] = room
        await save_room_state(room.to_dict())
        return room

    async def get_or_load_room(self, room_id: str) -> Optional[GameRoom]:
        room = self.rooms.get(room_id)
        if room:
            return room

        # Try loading from DB
        data = await load_room_state(room_id)
        if not data:
            return None

        # Reconstruct GameRoom
        room = GameRoom(data["room_id"], data["creator_id"], "")
        room.leader_id = data.get("leader_id", data["creator_id"])
        room.status = data["status"]
        room.players = data["players"]
        room.player_order = data["player_order"]
        room.boards = data["boards"]
        room.called_numbers = data["called_numbers"]
        room.current_turn = data["current_turn"]
        room.preparation_deadline = data["preparation_deadline"]
        room.turn_started_at = data["turn_started_at"]
        room.turn_deadline = data["turn_deadline"]
        room.match_deadline = data["match_deadline"]
        room.winner = data["winner"]
        room.result = data["result"]
        room.result_reason = data["result_reason"]
        self.rooms[room_id] = room
        return room

    async def join_room(self, room_id: str, player_id: str, player_name: str, session_id: Optional[str] = None) -> Tuple[bool, Optional[str], Optional[GameRoom]]:
        room = await self.get_or_load_room(room_id)
        if not room:
            return False, "Room not found", None

        async with room.lock:
            # Check if this player is already in the room (reconnecting / returning)
            if player_id in room.players:
                room.players[player_id]["connected"] = True
                room.players[player_id]["connection_state"] = "CONNECTED"
                room.players[player_id]["disconnected_at"] = None
                room.players[player_id]["last_heartbeat"] = time.time()
                if session_id:
                    room.players[player_id]["session_id"] = session_id
                if player_name:
                    room.players[player_id]["name"] = player_name
                await save_room_state(room.to_dict())
                await room.notify_listeners("PLAYER_RECONNECTED", {"player_id": player_id, "room": room.to_dict()})
                return True, None, room

            # If room already has 2 players, reject 3rd player
            if len(room.players) >= 2:
                return False, "Room is full (maximum 2 players)", None

            # Add second player
            room.players[player_id] = {
                "id": player_id,
                "name": player_name or "Player 2",
                "connected": False,  # Will be marked True on WebSocket handshake
                "ready": False,
                "rematch_requested": False,
                "disconnected_at": None,
                "is_leader": False,
                "connection_state": "DISCONNECTED",
                "last_heartbeat": time.time(),
                "session_id": session_id,
            }
            if player_id not in room.player_order:
                room.player_order.append(player_id)
            if player_id not in room.boards:
                room.boards[player_id] = generate_board()

            # When 2nd player joins, transition to PREPARING phase with 60s timer
            room.status = "PREPARING"
            room.preparation_deadline = time.time() + PREPARATION_DURATION_SEC

            await save_room_state(room.to_dict())
            await room.notify_listeners("GAME_PREPARING", {
                "player_id": player_id,
                "player_name": player_name,
                "preparation_deadline": room.preparation_deadline,
                "room": room.to_dict()
            })
            return True, None, room

    async def set_player_ready(self, room: GameRoom, player_id: str, ready: bool):
        async with room.lock:
            if player_id not in room.players:
                return
            room.players[player_id]["ready"] = ready
            await save_room_state(room.to_dict())
            await room.notify_listeners("PLAYER_READY", {
                "player_id": player_id,
                "ready": ready,
                "players": room.players
            })

            # Check if both players are ready to start
            if len(room.players) == 2 and all(p.get("ready") for p in room.players.values()):
                if room.status == "PREPARING":
                    await self._start_game_unlocked(room)

    async def start_game_by_leader(self, room: GameRoom, requester_id: str) -> Tuple[bool, Optional[str]]:
        async with room.lock:
            if requester_id != room.leader_id:
                return False, "Only the room leader can start the game"
            if len(room.players) < 2:
                return False, "Cannot start match without 2 players"
            if room.status == "PLAYING":
                return True, None
            # Authoritative connection check: both players must be actively connected
            for pid in room.player_order:
                p = room.players.get(pid)
                if not p or not p.get("connected"):
                    return False, "Both players must be actively connected to start the match"
            await self._start_game_unlocked(room)
            return True, None

    async def kick_player(self, room: GameRoom, requester_id: str, target_player_id: str) -> Tuple[bool, Optional[str]]:
        async with room.lock:
            if requester_id != room.leader_id:
                return False, "Only the room leader can kick players"
            if target_player_id == room.leader_id:
                return False, "Room leader cannot kick themselves"
            if target_player_id not in room.players:
                return False, "Player not found in room"

            # Remove target player
            del room.players[target_player_id]
            if target_player_id in room.player_order:
                room.player_order.remove(target_player_id)
            if target_player_id in room.boards:
                del room.boards[target_player_id]

            # Reset room to WAITING so a new player can join
            room.status = "WAITING"
            room.preparation_deadline = None
            room.turn_deadline = None
            room.match_deadline = None
            room.called_numbers = []
            room.winner = None
            room.result = None
            room.result_reason = None
            room.current_turn = None

            # Reset readiness of remaining players
            for p in room.players.values():
                p["ready"] = False
                p["rematch_requested"] = False

            await save_room_state(room.to_dict())
            await room.notify_listeners("PLAYER_KICKED", {
                "kicked_player_id": target_player_id,
                "leader_id": room.leader_id,
                "room": room.to_dict(),
            })
            return True, None

    async def transfer_leader_if_needed(self, room: GameRoom, departing_player_id: str) -> Optional[str]:
        async with room.lock:
            if departing_player_id != room.leader_id:
                return None
            candidates = [pid for pid in room.player_order if pid != departing_player_id and pid in room.players]
            if candidates:
                new_leader_id = candidates[0]
                room.leader_id = new_leader_id
                if new_leader_id in room.players:
                    room.players[new_leader_id]["is_leader"] = True
                if departing_player_id in room.players:
                    room.players[departing_player_id]["is_leader"] = False
                await save_room_state(room.to_dict())
                await room.notify_listeners("LEADER_TRANSFERRED", {
                    "old_leader_id": departing_player_id,
                    "new_leader_id": new_leader_id,
                    "room": room.to_dict()
                })
                return new_leader_id
            return None

    async def randomize_board(self, room: GameRoom, player_id: str) -> Optional[List[List[int]]]:
        async with room.lock:
            if room.status not in ("WAITING", "PREPARING"):
                return None
            new_board = generate_board()
            room.boards[player_id] = new_board
            await save_room_state(room.to_dict())
            await room.notify_listeners("BOARD_UPDATED", {
                "player_id": player_id,
                "board": format_board_with_marks(new_board, set(room.called_numbers))
            })
            return new_board

    async def swap_cells(self, room: GameRoom, player_id: str, r1: int, c1: int, r2: int, c2: int) -> Tuple[bool, Optional[str]]:
        async with room.lock:
            if room.status not in ("WAITING", "PREPARING"):
                return False, "Cannot modify board outside preparation phase"

            board = room.boards.get(player_id)
            if not board:
                return False, "Board not found"

            if not (0 <= r1 < 5 and 0 <= c1 < 5 and 0 <= r2 < 5 and 0 <= c2 < 5):
                return False, "Cell coordinates out of bounds"

            # Swap cells
            board[r1][c1], board[r2][c2] = board[r2][c2], board[r1][c1]
            valid, err = validate_board(board)
            if not valid:
                return False, f"Invalid board after swap: {err}"

            await save_room_state(room.to_dict())
            await room.notify_listeners("BOARD_UPDATED", {
                "player_id": player_id,
                "board": format_board_with_marks(board, set(room.called_numbers))
            })
            return True, None

    async def set_entire_board(self, room: GameRoom, player_id: str, grid: List[List[int]]) -> Tuple[bool, Optional[str]]:
        async with room.lock:
            if room.status not in ("WAITING", "PREPARING"):
                return False, "Cannot set board outside preparation phase"

            valid, err = validate_board(grid)
            if not valid:
                return False, err

            room.boards[player_id] = grid
            await save_room_state(room.to_dict())
            await room.notify_listeners("BOARD_UPDATED", {
                "player_id": player_id,
                "board": format_board_with_marks(grid, set(room.called_numbers))
            })
            return True, None

    async def _start_game_unlocked(self, room: GameRoom):
        """Authoritative start of the match."""
        if room.status == "PLAYING" or room.status == "FINISHED":
            return

        now = time.time()
        room.status = "PLAYING"
        # Player 1 (creator) starts
        room.current_turn = room.player_order[0]
        room.match_deadline = now + MATCH_DURATION_SEC
        room.turn_started_at = now
        room.turn_deadline = now + TURN_DURATION_SEC

        await save_room_state(room.to_dict())
        await room.notify_listeners("GAME_STARTED", {
            "current_turn": room.current_turn,
            "match_deadline": room.match_deadline,
            "turn_deadline": room.turn_deadline,
            "turn_started_at": room.turn_started_at,
            "room": room.to_dict()
        })

    async def call_number(self, room: GameRoom, player_id: str, number: int) -> Tuple[bool, Optional[str]]:
        async with room.lock:
            now = time.time()
            match_expired = bool(room.match_deadline and now >= room.match_deadline)
            turn_expired = bool(room.turn_deadline and now >= room.turn_deadline)

            board = room.boards.get(player_id, [])
            called_set = set(room.called_numbers)

            valid, err = validate_move(
                player_id=player_id,
                current_turn=room.current_turn,
                number=number,
                called_numbers=called_set,
                player_board=board,
                game_status=room.status,
                turn_expired=turn_expired,
                match_expired=match_expired
            )
            if not valid:
                return False, err

            # Add to called numbers
            room.called_numbers.append(number)
            called_set.add(number)

            # Check both boards for completed lines
            p1_id = room.player_order[0]
            p2_id = room.player_order[1]
            p1_lines = count_completed_lines(room.boards[p1_id], called_set)
            p2_lines = count_completed_lines(room.boards[p2_id], called_set)

            p1_has_bingo = p1_lines >= TARGET_LINES_FOR_BINGO
            p2_has_bingo = p2_lines >= TARGET_LINES_FOR_BINGO

            if p1_has_bingo or p2_has_bingo:
                # Winner detected!
                # Simultaneous rule: if both reached Bingo on this move,
                # the player whose turn it was wins because they triggered the transition!
                if p1_has_bingo and p2_has_bingo:
                    winner_id = player_id
                elif p1_has_bingo:
                    winner_id = p1_id
                else:
                    winner_id = p2_id

                room.status = "FINISHED"
                room.winner = winner_id
                room.result = "PLAYER1_WIN" if winner_id == p1_id else "PLAYER2_WIN"
                room.result_reason = "BINGO"

                await save_room_state(room.to_dict())
                await room.notify_listeners("NUMBER_CALLED", {
                    "number": number,
                    "called_by": player_id,
                    "called_numbers": room.called_numbers,
                    "p1_lines": p1_lines,
                    "p2_lines": p2_lines
                })
                await room.notify_listeners("GAME_FINISHED", {
                    "winner": winner_id,
                    "result": room.result,
                    "result_reason": room.result_reason,
                    "p1_lines": p1_lines,
                    "p2_lines": p2_lines
                })
                return True, None

            # No bingo yet: switch turn to opponent
            next_player = p2_id if player_id == p1_id else p1_id
            room.current_turn = next_player
            room.turn_started_at = now
            room.turn_deadline = now + TURN_DURATION_SEC

            await save_room_state(room.to_dict())
            await room.notify_listeners("NUMBER_CALLED", {
                "number": number,
                "called_by": player_id,
                "called_numbers": room.called_numbers,
                "p1_lines": p1_lines,
                "p2_lines": p2_lines,
                "next_turn": next_player,
                "turn_deadline": room.turn_deadline
            })
            return True, None

    async def _handle_turn_timeout_unlocked(self, room: GameRoom):
        """Turn timeout: current player loses, opponent wins immediately."""
        timed_out_player = room.current_turn
        if not timed_out_player:
            return

        p1_id = room.player_order[0]
        p2_id = room.player_order[1]
        winner_id = p2_id if timed_out_player == p1_id else p1_id

        room.status = "FINISHED"
        room.winner = winner_id
        room.result = "PLAYER1_WIN" if winner_id == p1_id else "PLAYER2_WIN"
        room.result_reason = "TURN_TIMEOUT"

        await save_room_state(room.to_dict())
        await room.notify_listeners("GAME_FINISHED", {
            "winner": winner_id,
            "timed_out_player": timed_out_player,
            "result": room.result,
            "result_reason": room.result_reason,
        })

    async def _handle_match_timeout_unlocked(self, room: GameRoom):
        """Match timeout (5 min): compare lines, higher wins, equal is DRAW."""
        called_set = set(room.called_numbers)
        p1_id = room.player_order[0]
        p2_id = room.player_order[1]
        p1_lines = count_completed_lines(room.boards[p1_id], called_set)
        p2_lines = count_completed_lines(room.boards[p2_id], called_set)

        room.status = "FINISHED"
        if p1_lines > p2_lines:
            room.winner = p1_id
            room.result = "PLAYER1_WIN"
        elif p2_lines > p1_lines:
            room.winner = p2_id
            room.result = "PLAYER2_WIN"
        else:
            room.winner = None
            room.result = "DRAW"
        room.result_reason = "MATCH_TIMEOUT"

        await save_room_state(room.to_dict())
        await room.notify_listeners("GAME_FINISHED", {
            "winner": room.winner,
            "result": room.result,
            "result_reason": room.result_reason,
            "p1_lines": p1_lines,
            "p2_lines": p2_lines,
        })

    async def _handle_disconnect_forfeit_unlocked(self, room: GameRoom, disconnected_pid: str):
        """30s grace period expired: forfeit to connected opponent."""
        p1_id = room.player_order[0]
        p2_id = room.player_order[1]
        winner_id = p2_id if disconnected_pid == p1_id else p1_id

        room.status = "FINISHED"
        room.winner = winner_id
        room.result = "PLAYER1_WIN" if winner_id == p1_id else "PLAYER2_WIN"
        room.result_reason = "DISCONNECT_FORFEIT"

        await save_room_state(room.to_dict())
        await room.notify_listeners("GAME_FINISHED", {
            "winner": winner_id,
            "forfeit_player": disconnected_pid,
            "result": room.result,
            "result_reason": room.result_reason,
        })

    async def mark_player_disconnected(self, room: GameRoom, player_id: str):
        async with room.lock:
            if player_id in room.players:
                room.players[player_id]["connected"] = False
                room.players[player_id]["disconnected_at"] = time.time()
                await save_room_state(room.to_dict())
                await room.notify_listeners("PLAYER_DISCONNECTED", {
                    "player_id": player_id,
                    "grace_period_sec": DISCONNECT_GRACE_SEC
                })

    async def request_rematch(self, room: GameRoom, player_id: str):
        async with room.lock:
            if room.status != "FINISHED":
                return
            if player_id not in room.players:
                return

            room.players[player_id]["rematch_requested"] = True

            # If both requested rematch, reset for new match!
            if len(room.players) == 2 and all(p.get("rematch_requested") for p in room.players.values()):
                # Section 39: Rematch
                # Clear marks, generate new boards, reset timers, reset winner, back to preparation
                for pid in room.player_order:
                    room.boards[pid] = generate_board()
                    room.players[pid]["ready"] = False
                    room.players[pid]["rematch_requested"] = False

                room.called_numbers = []
                room.status = "PREPARING"
                room.preparation_deadline = time.time() + PREPARATION_DURATION_SEC
                room.winner = None
                room.result = None
                room.result_reason = None
                room.match_deadline = None
                room.turn_deadline = None
                room.turn_started_at = None
                room.current_turn = None

                await save_room_state(room.to_dict())
                await room.notify_listeners("REMATCH_STARTED", {
                    "preparation_deadline": room.preparation_deadline,
                    "room": room.to_dict()
                })
            else:
                await save_room_state(room.to_dict())
                await room.notify_listeners("REMATCH_REQUESTED", {
                    "player_id": player_id,
                    "players": room.players
                })


room_service = RoomService()
