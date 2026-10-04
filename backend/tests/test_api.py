import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_create_and_join_room_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create room
        create_resp = await client.post("/api/rooms", json={
            "player_id": "p1_test",
            "player_name": "Aayush"
        })
        assert create_resp.status_code == 200
        data = create_resp.json()
        room_id = data["room_id"]
        assert len(room_id) == 6
        assert data["status"] == "WAITING"

        # Check room details
        get_resp = await client.get(f"/api/rooms/{room_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["player_count"] == 1
        assert get_resp.json()["is_full"] is False

        # Join room as player 2
        join_resp = await client.post(f"/api/rooms/{room_id}/join", json={
            "player_id": "p2_test",
            "player_name": "Bibek"
        })
        assert join_resp.status_code == 200
        join_data = join_resp.json()
        assert join_data["status"] == "PREPARING"

        # Check room details again -> now full
        get_resp2 = await client.get(f"/api/rooms/{room_id}")
        assert get_resp2.status_code == 200
        assert get_resp2.json()["player_count"] == 2
        assert get_resp2.json()["is_full"] is True

        # Third player rejected
        join_resp3 = await client.post(f"/api/rooms/{room_id}/join", json={
            "player_id": "p3_test",
            "player_name": "Chandra"
        })
        assert join_resp3.status_code == 400
        assert "full" in join_resp3.json()["detail"]
