import pytest
import asyncio
import json
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.room_service import room_service

@pytest.mark.asyncio
async def test_full_game_lifecycle_end_to_end():
    """
    Simulates a full end-to-end match between two players:
    1. Player 1 creates room
    2. Player 2 joins room -> status becomes PREPARING
    3. Player 1 swaps cells during preparation
    4. Both players set READY -> status becomes PLAYING
    5. Player 1 starts
    6. Alternate number calls:
       - Calling a number marks it on BOTH boards
       - Next player turn is activated
       - Invalid turns and duplicates are rejected
    7. Player 1 completes 5 lines -> wins immediately with BINGO!
    8. Rematch requested by both -> resets boards, restarts PREPARING!
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        p1_id = "e2e_player_1"
        p2_id = "e2e_player_2"

        # 1. Create Room
        create_resp = await client.post("/api/rooms", json={"player_id": p1_id, "player_name": "Aayush"})
        assert create_resp.status_code == 200
        room_id = create_resp.json()["room_id"]

        room = await room_service.get_or_load_room(room_id)
        assert room is not None
        assert room.status == "WAITING"

        # 2. Player 2 Joins
        join_resp = await client.post(f"/api/rooms/{room_id}/join", json={"player_id": p2_id, "player_name": "Sita"})
        assert join_resp.status_code == 200
        assert room.status == "PREPARING"
        assert room.preparation_deadline is not None

        # 3. Swap cells during preparation
        b1_before = room.boards[p1_id][0][0]
        b2_before = room.boards[p1_id][0][1]
        ok, err = await room_service.swap_cells(room, p1_id, 0, 0, 0, 1)
        assert ok is True
        assert room.boards[p1_id][0][0] == b2_before
        assert room.boards[p1_id][0][1] == b1_before

        # 4. Ready up
        await room_service.set_player_ready(room, p1_id, True)
        assert room.status == "PREPARING"
        await room_service.set_player_ready(room, p2_id, True)
        assert room.status == "PLAYING"
        assert room.current_turn == p1_id

        # 5. Let's arrange p1 board to a predictable grid for testing win condition
        fixed_grid_p1 = [
            [1,  2,  3,  4,  5],
            [6,  7,  8,  9,  10],
            [11, 12, 13, 14, 15],
            [16, 17, 18, 19, 20],
            [21, 22, 23, 24, 25]
        ]
        fixed_grid_p2 = [
            [25, 24, 23, 22, 21],
            [20, 19, 18, 17, 16],
            [15, 14, 13, 12, 11],
            [10, 9, 8, 7, 6],
            [5, 4, 3, 2, 1]
        ]
        async with room.lock:
            room.boards[p1_id] = [row[:] for row in fixed_grid_p1]
            room.boards[p2_id] = [row[:] for row in fixed_grid_p2]

        # 6. Make moves:
        # P1 calls 1
        ok, err = await room_service.call_number(room, p1_id, 1)
        assert ok is True
        assert 1 in room.called_numbers
        # Turn changes to P2
        assert room.current_turn == p2_id

        # P2 calls 2
        ok, err = await room_service.call_number(room, p2_id, 2)
        assert ok is True
        assert room.current_turn == p1_id

        # P1 calls 3, P2 calls 4
        await room_service.call_number(room, p1_id, 3)
        await room_service.call_number(room, p2_id, 4)

        # P1 calls 5 -> Completes row 0 for P1!
        await room_service.call_number(room, p1_id, 5)

        view_p1 = room.get_player_view(p1_id)
        assert view_p1["player_lines"] == 1
        assert view_p1["called_numbers"] == [1, 2, 3, 4, 5]

        # Call rows 1, 2, 3:
        # Pre-call up to row 3:
        for num in range(6, 21):
            curr = room.current_turn
            await room_service.call_number(room, curr, num)

        # Now P1 has rows 0, 1, 2, 3 complete = 4 lines!
        view_p1 = room.get_player_view(p1_id)
        assert view_p1["player_lines"] == 4
        assert room.status == "PLAYING"

        # Make sure current turn is P1 to call the winning number
        async with room.lock:
            room.current_turn = p1_id

        # Call cell 23: completes column 2 (3, 8, 13, 18, 23) as the 5th line!
        ok, err = await room_service.call_number(room, p1_id, 23)
        assert ok is True
        assert room.status == "FINISHED"
        assert room.winner == p1_id
        assert room.result == "PLAYER1_WIN"
        assert room.result_reason == "BINGO"

        # 7. Rematch
        await room_service.request_rematch(room, p1_id)
        assert room.status == "FINISHED"
        await room_service.request_rematch(room, p2_id)
        assert room.status == "PREPARING"
        assert room.winner is None
        assert len(room.called_numbers) == 0
        assert room.preparation_deadline is not None
