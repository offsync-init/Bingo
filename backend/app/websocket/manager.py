import json
import logging
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket
from app.services.room_service import room_service, GameRoom

logger = logging.getLogger("bingo.ws")


class ConnectionManager:
    def __init__(self):
        # room_id -> { player_id -> WebSocket }
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, room_id: str, player_id: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        self.active_connections[room_id][player_id] = websocket

    def disconnect(self, room_id: str, player_id: str):
        if room_id in self.active_connections:
            if player_id in self.active_connections[room_id]:
                del self.active_connections[room_id][player_id]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def send_to_player(self, room_id: str, player_id: str, message: Dict[str, Any]):
        if room_id in self.active_connections and player_id in self.active_connections[room_id]:
            ws = self.active_connections[room_id][player_id]
            try:
                await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Error sending message to {player_id}: {e}")

    async def broadcast_state(self, room: GameRoom, event_type: str = "STATE_UPDATE", extra: Optional[Dict[str, Any]] = None):
        """
        Broadcasts authoritative player-specific state to each player in the room.
        Opponent board arrangement is hidden while player's own board with markings is sent.
        """
        room_id = room.room_id
        for player_id in room.player_order:
            player_state = room.get_player_view(player_id)
            payload = {
                "type": event_type,
                "data": {
                    "game_state": player_state,
                    **(extra or {})
                }
            }
            await self.send_to_player(room_id, player_id, payload)

    async def kick_and_close(self, room_id: str, player_id: str, reason: str = "You were removed from the room by the room leader."):
        if room_id in self.active_connections and player_id in self.active_connections[room_id]:
            ws = self.active_connections[room_id][player_id]
            try:
                await ws.send_text(json.dumps({
                    "type": "KICKED",
                    "data": {"message": reason}
                }))
                await ws.close(code=4005, reason=reason)
            except Exception as e:
                logger.warning(f"Error kicking player {player_id}: {e}")
            self.disconnect(room_id, player_id)


ws_manager = ConnectionManager()
