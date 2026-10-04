import json
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel
from app.services.room_service import room_service
from app.websocket.manager import ws_manager

logger = logging.getLogger("bingo.api")
router = APIRouter()


class CreateRoomRequest(BaseModel):
    player_id: str
    player_name: str


class JoinRoomRequest(BaseModel):
    player_id: str
    player_name: str


@router.post("/rooms")
async def create_room(req: CreateRoomRequest):
    if not req.player_id.strip():
        raise HTTPException(status_code=400, detail="player_id is required")

    name = req.player_name.strip() or "Player 1"
    room = await room_service.create_room(req.player_id, name)
    return {
        "room_id": room.room_id,
        "player_id": req.player_id,
        "player_name": name,
        "leader_id": room.leader_id,
        "status": room.status,
    }


@router.get("/rooms/{room_id}")
async def get_room(room_id: str):
    room = await room_service.get_or_load_room(room_id.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    player_count = len(room.players)
    return {
        "room_id": room.room_id,
        "status": room.status,
        "leader_id": room.leader_id,
        "player_count": player_count,
        "is_full": player_count >= 2,
    }


@router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, req: JoinRoomRequest):
    room_id = room_id.upper()
    if not req.player_id.strip():
        raise HTTPException(status_code=400, detail="player_id is required")

    name = req.player_name.strip() or "Player 2"
    success, err, room = await room_service.join_room(room_id, req.player_id, name)
    if not success or not room:
        raise HTTPException(status_code=400, detail=err or "Could not join room")

    # Broadcast updated room state to connected players
    await ws_manager.broadcast_state(room, "PLAYER_JOINED", {
        "joined_player": req.player_id,
        "joined_name": name,
        "leader_id": room.leader_id
    })

    return {
        "room_id": room.room_id,
        "player_id": req.player_id,
        "player_name": name,
        "leader_id": room.leader_id,
        "status": room.status,
    }


@router.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, player_id: str):
    room_id = room_id.upper()
    room = await room_service.get_or_load_room(room_id)
    if not room:
        await websocket.close(code=4004, reason="Room not found")
        return

    # Check authorization / capacity: allow existing or auto-join as player 2
    if player_id not in room.players:
        if len(room.players) >= 2:
            await websocket.close(code=4003, reason="Room is full")
            return
        success, err, room = await room_service.join_room(room_id, player_id, "Player 2")
        if not success or not room:
            await websocket.close(code=4003, reason=err or "Room is full")
            return

    await ws_manager.connect(room_id, player_id, websocket)

    # Mark player connected & verified in room
    async with room.lock:
        if player_id in room.players:
            room.players[player_id]["connected"] = True
            room.players[player_id]["connection_state"] = "CONNECTED"
            room.players[player_id]["last_heartbeat"] = time.time()
            room.players[player_id]["disconnected_at"] = None

    import asyncio
    queue = asyncio.Queue()
    room.add_listener(queue)

    async def forward_room_events():
        try:
            while True:
                msg = await queue.get()
                event_type = msg.get("type", "EVENT")
                data = msg.get("data", {})
                player_state = room.get_player_view(player_id)
                payload = {
                    "type": event_type,
                    "data": {
                        "game_state": player_state,
                        **data
                    }
                }
                await ws_manager.send_to_player(room_id, player_id, payload)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning(f"Error in forward_room_events: {e}")

    forward_task = asyncio.create_task(forward_room_events())

    # Send initial state immediately upon connection to this player
    init_state = room.get_player_view(player_id)
    await ws_manager.send_to_player(room_id, player_id, {
        "type": "HANDSHAKE_ACK",
        "data": {
            "session_id": player_id,
            "player_id": player_id,
            "leader_id": room.leader_id,
            "is_leader": player_id == room.leader_id,
            "game_state": init_state
        }
    })

    # Notify all room listeners that this player has actively connected
    await room.notify_listeners("PLAYER_CONNECTED", {
        "player_id": player_id,
        "leader_id": room.leader_id
    })

    try:
        while True:
            text = await websocket.receive_text()
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                await ws_manager.send_to_player(room_id, player_id, {
                    "type": "ERROR",
                    "data": {"message": "Invalid JSON format"}
                })
                continue

            action = payload.get("action")
            data = payload.get("data", {})

            try:
                if action == "PING":
                    if player_id in room.players:
                        room.players[player_id]["last_heartbeat"] = time.time()
                    await websocket.send_text(json.dumps({
                        "type": "PONG",
                        "data": {
                            "client_timestamp": data.get("timestamp"),
                            "server_timestamp": time.time()
                        }
                    }))

                elif action == "HANDSHAKE":
                    pname = data.get("player_name")
                    sid = data.get("session_id")
                    if pname and player_id in room.players:
                        room.players[player_id]["name"] = pname
                    if sid and player_id in room.players:
                        room.players[player_id]["session_id"] = sid
                    room.players[player_id]["last_heartbeat"] = time.time()
                    await ws_manager.send_to_player(room_id, player_id, {
                        "type": "HANDSHAKE_ACK",
                        "data": {
                            "player_id": player_id,
                            "leader_id": room.leader_id,
                            "is_leader": player_id == room.leader_id,
                            "game_state": room.get_player_view(player_id)
                        }
                    })

                elif action == "START_GAME":
                    ok, err = await room_service.start_game_by_leader(room, player_id)
                    if not ok:
                        await ws_manager.send_to_player(room_id, player_id, {
                            "type": "ERROR",
                            "data": {"message": err}
                        })

                elif action == "KICK_PLAYER":
                    target_pid = data.get("target_player_id")
                    ok, err = await room_service.kick_player(room, player_id, target_pid)
                    if not ok:
                        await ws_manager.send_to_player(room_id, player_id, {
                            "type": "ERROR",
                            "data": {"message": err}
                        })
                    else:
                        await ws_manager.kick_and_close(room_id, target_pid, "You were removed from the room by the room leader.")

                elif action == "READY":
                    ready_val = bool(data.get("ready", True))
                    await room_service.set_player_ready(room, player_id, ready_val)

                elif action == "RANDOMIZE_BOARD":
                    await room_service.randomize_board(room, player_id)

                elif action == "SWAP_CELLS":
                    r1 = int(data.get("row1", 0))
                    c1 = int(data.get("col1", 0))
                    r2 = int(data.get("row2", 0))
                    c2 = int(data.get("col2", 0))
                    ok, err = await room_service.swap_cells(room, player_id, r1, c1, r2, c2)
                    if not ok:
                        await ws_manager.send_to_player(room_id, player_id, {
                            "type": "ERROR",
                            "data": {"message": err}
                        })

                elif action == "SET_BOARD":
                    grid = data.get("board", [])
                    ok, err = await room_service.set_entire_board(room, player_id, grid)
                    if not ok:
                        await ws_manager.send_to_player(room_id, player_id, {
                            "type": "ERROR",
                            "data": {"message": err}
                        })

                elif action == "CALL_NUMBER":
                    num = int(data.get("number", 0))
                    ok, err = await room_service.call_number(room, player_id, num)
                    if not ok:
                        await ws_manager.send_to_player(room_id, player_id, {
                            "type": "ERROR",
                            "data": {"message": err}
                        })

                elif action == "REQUEST_REMATCH":
                    await room_service.request_rematch(room, player_id)

            except (ValueError, TypeError) as err:
                await ws_manager.send_to_player(room_id, player_id, {
                    "type": "ERROR",
                    "data": {"message": f"Invalid data payload: {err}"}
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {player_id} from {room_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {player_id}: {e}")
    finally:
        forward_task.cancel()
        try:
            await forward_task
        except (asyncio.CancelledError, Exception):
            pass
        room.remove_listener(queue)
        ws_manager.disconnect(room_id, player_id)
        await room_service.mark_player_disconnected(room, player_id)
        await room_service.transfer_leader_if_needed(room, player_id)
