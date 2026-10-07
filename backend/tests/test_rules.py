import pytest
import asyncio
import time
from app.services.room_service import RoomService, GameRoom, force_verified
from app.game.engine import TARGET_LINES_FOR_BINGO

@pytest.mark.asyncio
async def test_room_creation_and_rejection_of_third_player():
    service = RoomService()
    p1_id = "user_1"
    room = await service.create_room(p1_id, "Ram")
    assert room.status == "WAITING"
    assert len(room.players) == 1

    # Second player joins -> PREPARING
    p2_id = "user_2"
    success, err, r = await service.join_room(room.room_id, p2_id, "Sita")
    assert success is True
    assert r.status == "PREPARING"
    assert len(r.players) == 2
    assert r.preparation_deadline is not None

    # Third player joins -> REJECTED
    p3_id = "user_3"
    success_3, err_3, r_3 = await service.join_room(room.room_id, p3_id, "Hari")
    assert success_3 is False
    assert "full" in err_3
    assert len(room.players) == 2


@pytest.mark.asyncio
async def test_ready_starts_game_and_p1_starts():
    service = RoomService()
    p1_id = "user_1"
    p2_id = "user_2"
    room = await service.create_room(p1_id, "Player 1")
    await service.join_room(room.room_id, p2_id, "Player 2")
    force_verified(room)

    assert room.status == "PREPARING"

    # Player 1 ready
    await service.set_player_ready(room, p1_id, True)
    assert room.status == "PREPARING"

    # Player 2 ready -> triggers start immediately
    await service.set_player_ready(room, p2_id, True)
    assert room.status == "PLAYING"
    # Player 1 starts
    assert room.current_turn == p1_id
    assert room.turn_deadline is not None
    assert room.match_deadline is not None


@pytest.mark.asyncio
async def test_move_turns_and_marks():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)

    assert room.current_turn == p1

    # Player 2 attempts move out of turn -> rejected
    num_to_call = room.boards[p2][0][0]
    ok, err = await service.call_number(room, p2, num_to_call)
    assert ok is False
    assert "Not your turn" in err

    # Player 1 calls a valid number
    call_num = room.boards[p1][0][0]
    ok, err = await service.call_number(room, p1, call_num)
    assert ok is True
    assert call_num in room.called_numbers
    # Turn flips to player 2
    assert room.current_turn == p2

    # Attempting to call the same number again by player 2 -> rejected
    ok2, err2 = await service.call_number(room, p2, call_num)
    assert ok2 is False
    assert "already been called" in err2


@pytest.mark.asyncio
async def test_turn_timeout_loses_immediately():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)

    assert room.current_turn == p1

    # Simulate turn timeout for player 1
    async with room.lock:
        await service._handle_turn_timeout_unlocked(room)

    assert room.status == "FINISHED"
    assert room.winner == p2
    assert room.result == "PLAYER2_WIN"
    assert room.result_reason == "TURN_TIMEOUT"


@pytest.mark.asyncio
async def test_match_timeout_resolution():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)

    # Set predetermined boards
    room.boards[p1] = [
        [1,  2,  3,  4,  5],
        [6,  7,  8,  9,  10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]
    room.boards[p2] = [
        [1,  2,  3,  4,  5],
        [6,  11, 16, 21, 22],
        [12, 7,  17, 23, 24],
        [13, 18, 8,  25, 14],
        [15, 19, 20, 9,  10]
    ]

    # 1. Equal lines -> DRAW
    # When [1, 2, 3, 4, 5] are called, both p1 and p2 have exactly row 0 complete (1 line each)
    room.called_numbers = [1, 2, 3, 4, 5]
    async with room.lock:
        await service._handle_match_timeout_unlocked(room)
    assert room.status == "FINISHED"
    assert room.result == "DRAW"
    assert room.winner is None

    # 2. Unequal lines -> Player with more lines wins
    room.status = "PLAYING"
    # Calling [6, 7, 8, 9, 10] completes row 1 for p1 (now 2 lines)
    # But for p2:
    # row 0 is 1 line, rows 1-4 have only 1-2 numbers, cols have at most 3 numbers
    room.called_numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    from app.game.engine import count_completed_lines
    p1_lines = count_completed_lines(room.boards[p1], set(room.called_numbers))
    p2_lines = count_completed_lines(room.boards[p2], set(room.called_numbers))
    assert p1_lines == 2
    assert p2_lines == 1

    async with room.lock:
        await service._handle_match_timeout_unlocked(room)
    assert room.winner == p1
    assert room.result == "PLAYER1_WIN"


@pytest.mark.asyncio
async def test_simultaneous_bingo_turn_player_wins():
    """
    CRITICAL RULE (Section 14):
    If both players achieve >= 5 lines on the exact same move,
    the player whose turn it was wins because they triggered the transition.
    """
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)

    # Identical boards for both players
    fixed_board = [
        [1,  2,  3,  4,  5],
        [6,  7,  8,  9,  10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]
    room.boards[p1] = [row[:] for row in fixed_board]
    room.boards[p2] = [row[:] for row in fixed_board]

    # Pre-call 4 rows + part of col 2 (so both players have 4 lines)
    # 1..20 is rows 0, 1, 2, 3
    room.called_numbers = list(range(1, 21))
    # It is p1's turn
    room.current_turn = p1

    # Calling 23 completes col 2 for both players simultaneously!
    # Giving both 5 lines!
    ok, err = await service.call_number(room, p1, 23)
    assert ok is True
    assert room.status == "FINISHED"
    # Player 1 initiated the turn, so Player 1 wins!
    assert room.winner == p1
    assert room.result == "PLAYER1_WIN"
    assert room.result_reason == "BINGO"


@pytest.mark.asyncio
async def test_rematch_flow():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)

    # Force finish
    async with room.lock:
        await service._handle_turn_timeout_unlocked(room)
    assert room.status == "FINISHED"

    # P1 requests rematch
    await service.request_rematch(room, p1)
    assert room.players[p1]["rematch_requested"] is True
    assert room.status == "FINISHED"

    # P2 requests rematch -> Triggers rematch
    await service.request_rematch(room, p2)
    assert room.status == "PREPARING"
    assert room.winner is None
    assert room.result is None
    assert len(room.called_numbers) == 0
    assert room.preparation_deadline is not None


@pytest.mark.asyncio
async def test_disconnect_forfeit_grace_period():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)

    assert room.status == "PLAYING"

    # Player 2 disconnects
    await service.mark_player_disconnected(room, p2)
    assert room.players[p2]["connected"] is False
    assert room.players[p2]["disconnected_at"] is not None

    # Simulate 30s expiration
    async with room.lock:
        await service._handle_disconnect_forfeit_unlocked(room, p2)

    assert room.status == "FINISHED"
    assert room.winner == p1
    assert room.result == "PLAYER1_WIN"
    assert room.result_reason == "DISCONNECT_FORFEIT"


@pytest.mark.asyncio
async def test_swap_cells_and_validation():
    service = RoomService()
    p1 = "user_1"
    room = await service.create_room(p1, "Player 1")
    
    val_0_0 = room.boards[p1][0][0]
    val_1_1 = room.boards[p1][1][1]

    # Valid swap
    ok, err = await service.swap_cells(room, p1, 0, 0, 1, 1)
    assert ok is True
    assert room.boards[p1][0][0] == val_1_1
    assert room.boards[p1][1][1] == val_0_0

    # Invalid coordinates
    ok, err = await service.swap_cells(room, p1, 0, 0, 5, 5)
    assert ok is False
    assert "out of bounds" in err


@pytest.mark.asyncio
async def test_room_leader_authority_and_kick():
    service = RoomService()
    p1 = "leader_1"
    p2 = "player_2"
    room = await service.create_room(p1, "Leader Ram")
    assert room.leader_id == p1
    assert room.players[p1]["is_leader"] is True

    await service.join_room(room.room_id, p2, "Guest Sita")
    assert room.status == "PREPARING"
    assert room.leader_id == p1
    assert room.players[p2]["is_leader"] is False

    # Non-leader tries to kick leader -> rejected
    ok, err = await service.kick_player(room, p2, p1)
    assert ok is False
    assert "Only the room leader" in err

    # Leader tries to kick self -> rejected
    ok, err = await service.kick_player(room, p1, p1)
    assert ok is False
    assert "cannot kick themselves" in err

    # Leader kicks player 2 -> success!
    ok, err = await service.kick_player(room, p1, p2)
    assert ok is True
    assert p2 not in room.players
    assert p2 not in room.player_order
    assert p2 not in room.boards
    assert room.status == "WAITING"
    assert room.preparation_deadline is None

    # New player 3 can now join
    p3 = "player_3"
    ok, err, r = await service.join_room(room.room_id, p3, "New Guest Hari")
    assert ok is True
    assert room.status == "PREPARING"
    assert len(room.players) == 2


@pytest.mark.asyncio
async def test_leader_transfer_when_leader_leaves():
    service = RoomService()
    p1 = "leader_1"
    p2 = "player_2"
    room = await service.create_room(p1, "Leader Ram")
    await service.join_room(room.room_id, p2, "Guest Sita")
    assert room.leader_id == p1

    # Leader leaves -> leadership transfers to player 2
    new_leader = await service.transfer_leader_if_needed(room, p1)
    assert new_leader == p2
    assert room.leader_id == p2
    assert room.players[p2]["is_leader"] is True


@pytest.mark.asyncio
async def test_start_game_by_leader_validation():
    service = RoomService()
    p1 = "leader_1"
    p2 = "player_2"
    room = await service.create_room(p1, "Leader Ram")
    await service.join_room(room.room_id, p2, "Guest Sita")

    # Non-leader tries to start -> rejected
    ok, err = await service.start_game_by_leader(room, p2)
    assert ok is False
    assert "Only the room leader" in err

    # Leader tries to start while players not connected -> rejected
    ok, err = await service.start_game_by_leader(room, p1)
    assert ok is False
    assert "Both players must be actively connected" in err

    force_verified(room)
    ok, err = await service.start_game_by_leader(room, p1)
    assert ok is False
    assert "ready" in err.lower()

    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)
    ok, err = await service.start_game_by_leader(room, p1)
    assert ok is True
    assert room.status == "PLAYING"
    assert room.current_turn == p1


@pytest.mark.asyncio
async def test_ready_without_verified_connection_does_not_start():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)
    assert room.status == "PREPARING"


@pytest.mark.asyncio
async def test_concurrent_joins_never_exceed_two_players():
    service = RoomService()
    room = await service.create_room("host", "Host")

    async def join(pid: str):
        return await service.join_room(room.room_id, pid, pid)

    results = await asyncio.gather(join("a"), join("b"), join("c"), join("d"))
    successes = [r for r in results if r[0]]
    assert len(successes) == 1  # host already occupies one slot; only one extra join
    assert len(room.players) == 2


@pytest.mark.asyncio
async def test_duplicate_start_keeps_same_session():
    service = RoomService()
    p1 = "leader_1"
    p2 = "player_2"
    room = await service.create_room(p1, "Leader")
    await service.join_room(room.room_id, p2, "Guest")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)
    ok, err = await service.start_game_by_leader(room, p1)
    assert ok is True
    session = room.game_session_id
    ok2, err2 = await service.start_game_by_leader(room, p1)
    assert ok2 is True
    assert room.game_session_id == session
    assert room.status == "PLAYING"


async def _playing_room():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)
    assert room.status == "PLAYING"
    return service, room, p1, p2


@pytest.mark.asyncio
async def test_player_forfeit_ends_game_and_opponent_wins():
    service, room, p1, p2 = await _playing_room()
    ok, err = await service.forfeit_game(room, p2)
    assert ok is True
    assert err is None
    assert room.players[p2]["is_forfeited"] is True
    assert room.players[p1]["is_forfeited"] is False
    assert room.status == "FINISHED"
    assert room.winner == p1
    assert room.result == "PLAYER1_WIN"
    assert room.result_reason == "PLAYER_FORFEIT"
    assert room.leader_id == p1


@pytest.mark.asyncio
async def test_duplicate_forfeit_is_rejected():
    service, room, p1, p2 = await _playing_room()
    ok, err = await service.forfeit_game(room, p1)
    assert ok is True
    ok2, err2 = await service.forfeit_game(room, p1)
    assert ok2 is False
    assert "Already forfeited" in err2
    assert room.result_reason == "PLAYER_FORFEIT"
    assert room.winner == p2


@pytest.mark.asyncio
async def test_forfeit_rejected_when_not_playing():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    ok, err = await service.forfeit_game(room, p1)
    assert ok is False
    assert "not active" in err.lower()
    assert room.players[p1].get("is_forfeited") is False


@pytest.mark.asyncio
async def test_forfeit_survives_disconnect_and_rejoin():
    service, room, p1, p2 = await _playing_room()
    ok, err = await service.forfeit_game(room, p1)
    assert ok is True
    await service.mark_player_disconnected(room, p1)
    assert room.players[p1]["is_forfeited"] is True
    success, join_err, _ = await service.join_room(room.room_id, p1, "Player 1")
    assert success is True
    assert room.players[p1]["is_forfeited"] is True
    assert room.players[p1]["connected"] is False  # handshake not complete
    assert room.status == "FINISHED"


@pytest.mark.asyncio
async def test_forfeit_does_not_transfer_host():
    service, room, p1, p2 = await _playing_room()
    assert room.leader_id == p1
    ok, err = await service.forfeit_game(room, p1)
    assert ok is True
    assert room.leader_id == p1
    assert room.players[p1]["is_leader"] is True


@pytest.mark.asyncio
async def test_forfeited_player_cannot_call_number():
    service, room, p1, p2 = await _playing_room()
    room.players[p1]["is_forfeited"] = True
    num = room.boards[p1][0][0]
    ok, err = await service.call_number(room, p1, num)
    assert ok is False
    assert "forfeit" in err.lower()


@pytest.mark.asyncio
async def test_disconnect_is_not_forfeit():
    service, room, p1, p2 = await _playing_room()
    await service.mark_player_disconnected(room, p2)
    assert room.players[p2]["is_forfeited"] is False
    assert room.status == "PLAYING"
    assert room.players[p2]["disconnected_at"] is not None


@pytest.mark.asyncio
async def test_rematch_clears_forfeit():
    service, room, p1, p2 = await _playing_room()
    await service.forfeit_game(room, p2)
    await service.request_rematch(room, p1)
    await service.request_rematch(room, p2)
    assert room.status == "PREPARING"
    assert room.players[p1]["is_forfeited"] is False
    assert room.players[p2]["is_forfeited"] is False


@pytest.mark.asyncio
async def test_strict_start_game_readiness():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Host")
    await service.join_room(room.room_id, p2, "Guest")
    force_verified(room)

    # Host ready, Guest NOT ready
    await service.set_player_ready(room, p1, True)
    ok, err = await service.start_game_by_leader(room, p1)
    assert ok is False
    assert "Waiting for Guest" in err
    assert room.status == "PREPARING"

    # Guest ready -> setting both ready auto-starts or host can start!
    await service.set_player_ready(room, p2, True)
    assert room.status == "PLAYING"


@pytest.mark.asyncio
async def test_chat_message_system():
    service = RoomService()
    p1 = "user_1"
    p2 = "user_2"
    room = await service.create_room(p1, "Apsan")
    await service.join_room(room.room_id, p2, "Rahul")

    # Empty chat -> rejected
    ok1, err1, _ = await service.send_chat(room, p1, "   ")
    assert ok1 is False
    assert "empty" in err1.lower()

    # Valid chat -> stored with server-authoritative sender name
    ok2, err2, msg2 = await service.send_chat(room, p1, "Good luck Rahul!")
    assert ok2 is True
    assert msg2["sender_name"] == "Apsan"
    assert msg2["message"] == "Good luck Rahul!"
    assert len(room.chat_messages) == 1

    # Reply from Rahul
    ok3, err3, msg3 = await service.send_chat(room, p2, "GG let's play!")
    assert ok3 is True
    assert msg3["sender_name"] == "Rahul"
    assert len(room.chat_messages) == 2


@pytest.mark.asyncio
async def test_event_history_and_inspection_payload():
    service, room, p1, p2 = await _playing_room()
    assert len(room.events) >= 1  # GAME_STARTED event

    # Make moves until game finishes
    called = []
    board_p1 = room.boards[p1]
    for row in board_p1:
        for num in row:
            if num not in called:
                curr = room.current_turn
                ok, err = await service.call_number(room, curr, num)
                called.append(num)
                if room.status == "FINISHED":
                    break
        if room.status == "FINISHED":
            break

    assert room.status == "FINISHED"
    inspection = room.get_inspection_data()
    assert inspection is not None
    assert inspection["status"] == "FINISHED"
    assert len(inspection["events"]) >= 2
    assert "player_boards" in inspection
    assert p1 in inspection["player_boards"]
    assert p2 in inspection["player_boards"]
    assert inspection["player_boards"][p1]["player_name"] == "Player 1"

