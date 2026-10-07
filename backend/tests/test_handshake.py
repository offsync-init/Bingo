from fastapi.testclient import TestClient
from app.main import app
from app.services.room_service import room_service, player_is_verified


def _recv_until(ws, wanted: str, limit: int = 12):
    last = None
    for _ in range(limit):
        last = ws.receive_json()
        if last.get("type") == wanted:
            return last
    raise AssertionError(f"Did not receive {wanted}; last={last}")


def test_peer_handshake_required_before_connected():
    with TestClient(app) as client:
        create = client.post("/api/rooms", json={"player_id": "hs_p1", "player_name": "Apsan"})
        assert create.status_code == 200
        room_id = create.json()["room_id"]

        join = client.post(f"/api/rooms/{room_id}/join", json={"player_id": "hs_p2", "player_name": "Player2"})
        assert join.status_code == 200

        with client.websocket_connect(f"/api/ws/{room_id}/hs_p1?player_name=Apsan") as ws1:
            welcome1 = _recv_until(ws1, "WELCOME")
            assert welcome1["data"]["player_id"] == "hs_p1"
            ws1.send_json({
                "action": "HANDSHAKE",
                "data": {
                    "player_id": "hs_p1",
                    "player_name": "Apsan",
                    "room_id": room_id,
                    "session_id": "sess_p1",
                },
            })
            ack1 = _recv_until(ws1, "HANDSHAKE_ACK")
            assert ack1["data"]["game_state"]["both_connected"] is False
            room = room_service.rooms[room_id]
            assert player_is_verified(room.players["hs_p1"]) is False

            with client.websocket_connect(f"/api/ws/{room_id}/hs_p2?player_name=Player2") as ws2:
                _recv_until(ws2, "WELCOME")
                ws2.send_json({
                    "action": "HANDSHAKE",
                    "data": {
                        "player_id": "hs_p2",
                        "player_name": "Player2",
                        "room_id": room_id,
                        "session_id": "sess_p2",
                    },
                })
                _recv_until(ws2, "HANDSHAKE_ACK")

                hello1 = _recv_until(ws1, "PEER_HELLO")
                hello2 = _recv_until(ws2, "PEER_HELLO")
                assert hello1["data"]["peer_id"] == "hs_p2"
                assert hello2["data"]["peer_id"] == "hs_p1"

                ws1.send_json({
                    "action": "PEER_HELLO_ACK",
                    "data": {
                        "peer_id": hello1["data"]["peer_id"],
                        "peer_session_id": hello1["data"]["peer_session_id"],
                        "round": hello1["data"]["round"],
                    },
                })
                ws2.send_json({
                    "action": "PEER_HELLO_ACK",
                    "data": {
                        "peer_id": hello2["data"]["peer_id"],
                        "peer_session_id": hello2["data"]["peer_session_id"],
                        "round": hello2["data"]["round"],
                    },
                })

                ready1 = _recv_until(ws1, "PEER_READY")
                ready2 = _recv_until(ws2, "PEER_READY")
                assert ready1 and ready2

                ws1.send_json({"action": "PEER_READY_ACK", "data": {}})
                ws2.send_json({"action": "PEER_READY_ACK", "data": {}})

                verified1 = _recv_until(ws1, "PEER_VERIFIED")
                verified2 = _recv_until(ws2, "PEER_VERIFIED")
                assert verified1["data"]["game_state"]["both_connected"] is True
                assert verified2["data"]["game_state"]["peer_connected"] is True
                assert player_is_verified(room.players["hs_p1"]) is True
                assert player_is_verified(room.players["hs_p2"]) is True
                assert room.players["hs_p1"]["connected"] is True
                assert room.players["hs_p2"]["handshake_verified"] is True
