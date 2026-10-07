import json
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Optional, Any
from fastapi import WebSocket
from app.services.room_service import GameRoom

logger = logging.getLogger("bingo.ws")


@dataclass
class ConnectionRecord:
    websocket: WebSocket
    player_id: str
    room_id: str
    connection_id: str
    session_id: str
    accepted_at: float = field(default_factory=time.time)


class ConnectionManager:
    def __init__(self):
        # room_id -> { player_id -> ConnectionRecord }
        self.active_connections: Dict[str, Dict[str, ConnectionRecord]] = {}

    def get(self, room_id: str, player_id: str) -> Optional[ConnectionRecord]:
        return self.active_connections.get(room_id, {}).get(player_id)

    def is_live(self, room_id: str, player_id: str, connection_id: Optional[str] = None) -> bool:
        rec = self.get(room_id, player_id)
        if not rec:
            return False
        if connection_id and rec.connection_id != connection_id:
            return False
        return True

    async def connect(
        self,
        room_id: str,
        player_id: str,
        websocket: WebSocket,
        connection_id: str = "",
        session_id: str = "",
    ) -> ConnectionRecord:
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}

        previous = self.active_connections[room_id].get(player_id)
        if previous and previous.websocket is not websocket:
            logger.info(
                "supersede_connection %s",
                json.dumps({
                    "room_id": room_id,
                    "player_id": player_id,
                    "old_connection_id": previous.connection_id,
                    "new_connection_id": connection_id,
                }),
            )
            try:
                await previous.websocket.send_text(json.dumps({
                    "type": "ERROR",
                    "data": {
                        "code": "SESSION_SUPERSEDED",
                        "message": "This room was opened in another tab.",
                    },
                }))
                await previous.websocket.close(code=4009, reason="Superseded by a newer session")
            except Exception:
                pass

        record = ConnectionRecord(
            websocket=websocket,
            player_id=player_id,
            room_id=room_id,
            connection_id=connection_id or f"{player_id}-{time.time()}",
            session_id=session_id,
        )
        self.active_connections[room_id][player_id] = record
        return record

    def disconnect(self, room_id: str, player_id: str, connection_id: Optional[str] = None):
        rec = self.get(room_id, player_id)
        if not rec:
            return
        if connection_id and rec.connection_id != connection_id:
            return
        del self.active_connections[room_id][player_id]
        if not self.active_connections[room_id]:
            del self.active_connections[room_id]

    async def send_to_player(self, room_id: str, player_id: str, message: Dict[str, Any]):
        rec = self.get(room_id, player_id)
        if not rec:
            return
        try:
            await rec.websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.warning(
                "send_failed %s",
                json.dumps({"room_id": room_id, "player_id": player_id, "error": str(e)}),
            )

    async def broadcast_state(self, room: GameRoom, event_type: str = "STATE_UPDATE", extra: Optional[Dict[str, Any]] = None):
        """Broadcasts authoritative player-specific state to each live socket in the room."""
        room_id = room.room_id
        live = list(self.active_connections.get(room_id, {}).keys())
        for player_id in live:
            player_state = room.get_player_view(player_id)
            payload = {
                "type": event_type,
                "data": {
                    "game_state": player_state,
                    **(extra or {}),
                },
            }
            await self.send_to_player(room_id, player_id, payload)

    async def kick_and_close(self, room_id: str, player_id: str, reason: str = "You were removed from the room by the room leader."):
        rec = self.get(room_id, player_id)
        if not rec:
            return
        try:
            await rec.websocket.send_text(json.dumps({
                "type": "KICKED",
                "data": {"reason": reason, "message": reason},
            }))
            await rec.websocket.close(code=4005, reason=reason[:120])
        except Exception as e:
            logger.warning(
                "kick_close_failed %s",
                json.dumps({"room_id": room_id, "player_id": player_id, "error": str(e)}),
            )
        self.disconnect(room_id, player_id, rec.connection_id)


ws_manager = ConnectionManager()
