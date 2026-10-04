import pytest
import asyncio
import time
from app.services.room_service import RoomService, GameRoom
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
