import pytest
import asyncio
from app.services.room_service import RoomService, force_verified

@pytest.mark.asyncio
async def test_reconnection_state_restoration():
    service = RoomService()
    p1 = "rec_user_1"
    p2 = "rec_user_2"
    room = await service.create_room(p1, "Player 1")
    await service.join_room(room.room_id, p2, "Player 2")
    force_verified(room)
    await service.set_player_ready(room, p1, True)
    await service.set_player_ready(room, p2, True)

    assert room.status == "PLAYING"

    # P1 makes move
    num = room.boards[p1][0][0]
    await service.call_number(room, p1, num)

    # Disconnect P2
    await service.mark_player_disconnected(room, p2)
    assert room.players[p2]["connected"] is False
    assert room.players[p2]["disconnected_at"] is not None

    # Reconnect P2 — membership is restored, but connection is not verified yet
    success, err, r = await service.join_room(room.room_id, p2, "Player 2")
    assert success is True
    assert r.players[p2]["connected"] is False
    assert r.players[p2]["disconnected_at"] is None
    assert r.players[p2]["id"] == p2
    assert num in r.called_numbers
    assert r.status == "PLAYING"
    force_verified(r)
    assert r.players[p2]["connected"] is True
    assert r.players[p2]["handshake_verified"] is True
