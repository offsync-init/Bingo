import asyncio
import json
import logging
import time
import uuid
from typing import Any, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel
from app.services.room_service import MAX_PLAYERS, room_service, slog
from app.websocket.manager import ws_manager

logger = logging.getLogger("bingo.api")
router = APIRouter()

USER_ERROR_MAP = {
    "Room not found": "This room does not exist or has expired.",
    "Room is full (maximum 2 players)": "This room is already full (maximum 2 players).",
    "This match is already in progress": "This match has already started.",
    "This match has already finished": "This match has already finished.",
    "You were removed from the room by the room leader.": "You were removed from the room by the room leader.",
    "Only the room leader can start the game": "Only the room leader can start the game.",
    "Only the room leader can kick players": "Only the room leader can remove players.",
    "Both players must be actively connected to start the match": "Waiting for player connection...",
}


def user_message(err: Optional[str]) -> str:
    if not err:
        return "Something went wrong. Please try again."
    return USER_ERROR_MAP.get(err, err)


class CreateRoomRequest(BaseModel):
    player_id: str
    player_name: str


class JoinRoomRequest(BaseModel):
    player_id: str
    player_name: str
    session_id: Optional[str] = None


@router.post("/rooms")
async def create_room(req: CreateRoomRequest):
    if not req.player_id.strip():
        raise HTTPException(status_code=400, detail="player_id is required")

    name = req.player_name.strip() or "Player 1"
    room = await room_service.create_room(req.player_id, name)
    slog("room_created", room_id=room.room_id, leader_id=room.leader_id)
    return {
        "room_id": room.room_id,
        "player_id": req.player_id,
        "player_name": name,
        "leader_id": room.leader_id,
        "status": room.status,
    }


@router.get("/rooms/{room_id}")
async def get_room(room_id: str, player_id: Optional[str] = Query(None)):
    room = await room_service.get_or_load_room(room_id.upper().strip())
    if not room:
        raise HTTPException(status_code=404, detail="This room does not exist or has expired.")

    player_count = len(room.players)
    is_member = bool(player_id and player_id in room.players)
    return {
        "room_id": room.room_id,
        "status": room.status,
        "leader_id": room.leader_id,
        "player_count": player_count,
        "is_full": player_count >= MAX_PLAYERS and not is_member,
        "is_member": is_member,
        "in_progress": room.status in ("PLAYING", "STARTING"),
    }


@router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, req: JoinRoomRequest):
    room_id = room_id.upper().strip()
    if not req.player_id.strip():
        raise HTTPException(status_code=400, detail="player_id is required")

    name = req.player_name.strip() or "Player 2"
    success, err, room = await room_service.join_room(room_id, req.player_id, name, session_id=req.session_id)
    if not success or not room:
        raise HTTPException(status_code=400, detail=user_message(err))

    await ws_manager.broadcast_state(room, "PLAYER_JOINED", {
        "joined_player": req.player_id,
        "joined_name": name,
        "leader_id": room.leader_id,
    })

    return {
        "room_id": room.room_id,
        "player_id": req.player_id,
        "player_name": name,
        "leader_id": room.leader_id,
        "status": room.status,
    }


async def _send_error(room_id: str, player_id: str, message: str, code: str = "ERROR"):
    await ws_manager.send_to_player(room_id, player_id, {
        "type": "ERROR",
        "data": {"code": code, "message": user_message(message)},
    })


async def _try_peer_hello(room, room_id: str):
    signaling = room_service.signaling_player_ids(room)
    if len(signaling) < MAX_PLAYERS:
        return
    room._peer_round += 1
    round_id = room._peer_round
    slog("peer_hello_begin", room_id=room_id, players=signaling, round=round_id)
    for pid in signaling:
        peer_id = next(p for p in signaling if p != pid)
        peer = room.players[peer_id]
        await ws_manager.send_to_player(room_id, pid, {
            "type": "PEER_HELLO",
            "data": {
                "round": round_id,
                "room_id": room.room_id,
                "peer_id": peer_id,
                "peer_session_id": peer.get("session_id"),
                "peer_connection_id": peer.get("connection_id"),
                "game_state": room.get_player_view(pid),
            },
        })


async def _try_peer_ready(room, room_id: str):
    if not room_service.both_peers_hello_acked(room):
        return
    slog("peer_ready_begin", room_id=room_id)
    for pid in room_service.signaling_player_ids(room):
        await ws_manager.send_to_player(room_id, pid, {
            "type": "PEER_READY",
            "data": {
                "room_id": room.room_id,
                "game_state": room.get_player_view(pid),
            },
        })


@router.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    player_id: str,
    player_name: str = Query(default=""),
):
    room_id = room_id.upper().strip()
    room = await room_service.get_or_load_room(room_id)
    if not room:
        await websocket.close(code=4004, reason="Room not found")
        return

    if player_id in room.kicked_ids and player_id not in room.players:
        await websocket.close(code=4007, reason="Kicked from room")
        return

    if player_id not in room.players:
        success, err, room = await room_service.join_room(room_id, player_id, player_name or "Player 2")
        if not success or not room:
            code = 4003 if err and "full" in err.lower() else 4006
            await websocket.close(code=code, reason=(err or "Cannot join")[:120])
            return

    connection_id = str(uuid.uuid4())
    record = await ws_manager.connect(room_id, player_id, websocket, connection_id=connection_id)
    slog("ws_accepted", room_id=room_id, player_id=player_id, connection_id=connection_id)

    async with room.lock:
        pdata = room.players.get(player_id)
        if pdata:
            pdata["connection_id"] = connection_id
            pdata["connection_state"] = "SIGNALING"
            pdata["connected"] = False
            pdata["handshake_verified"] = False
            pdata["signaling_ok"] = False

    queue: asyncio.Queue = asyncio.Queue()
    room.add_listener(queue)
    handshake_done = {"ok": False}
    handshake_event = asyncio.Event()

    async def forward_room_events():
        try:
            # Wait for initial handshake to complete before delivering queued events
            await handshake_event.wait()
            while True:
                msg = await queue.get()
                event_type = msg.get("type", "EVENT")
                data = msg.get("data", {})
                player_state = room.get_player_view(player_id)
                payload = {
                    "type": event_type,
                    "data": {
                        "game_state": player_state,
                        **data,
                    },
                }
                if not ws_manager.is_live(room_id, player_id, connection_id):
                    break
                await ws_manager.send_to_player(room_id, player_id, payload)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("forward_room_events %s", json.dumps({"player_id": player_id, "error": str(e)}))

    async def handshake_watchdog():
        await asyncio.sleep(30)
        if not handshake_done["ok"] and ws_manager.is_live(room_id, player_id, connection_id):
            slog("handshake_timeout", room_id=room_id, player_id=player_id)
            try:
                await websocket.close(code=4006, reason="Handshake timeout")
            except Exception:
                pass

    forward_task = asyncio.create_task(forward_room_events())
    watchdog_task = asyncio.create_task(handshake_watchdog())

    await ws_manager.send_to_player(room_id, player_id, {
        "type": "WELCOME",
        "data": {
            "room_id": room.room_id,
            "player_id": player_id,
            "leader_id": room.leader_id,
            "connection_id": connection_id,
            "status": room.status,
        },
    })

    try:
        while True:
            text = await websocket.receive_text()
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                await _send_error(room_id, player_id, "Invalid message format")
                continue

            action = payload.get("action")
            data = payload.get("data") or {}

            try:
                if action == "PING":
                    sent = data.get("timestamp")
                    now = time.time()
                    rtt = None
                    if isinstance(sent, (int, float)):
                        rtt = max(0.0, (now * 1000) - sent) if sent > 1e12 else max(0.0, (now - sent) * 1000)
                    room_service.note_heartbeat(room, player_id, rtt)
                    await websocket.send_text(json.dumps({
                        "type": "PONG",
                        "data": {
                            "client_timestamp": data.get("timestamp"),
                            "server_timestamp": now,
                        },
                    }))

                elif action == "HANDSHAKE":
                    claimed_room = str(data.get("room_id") or "").upper().strip()
                    claimed_player = str(data.get("player_id") or "")
                    session_id = str(data.get("session_id") or uuid.uuid4())
                    if claimed_room and claimed_room != room_id:
                        await _send_error(room_id, player_id, "Room mismatch", "HANDSHAKE_REJECTED")
                        await websocket.close(code=4006, reason="Room mismatch")
                        break
                    if claimed_player and claimed_player != player_id:
                        await _send_error(room_id, player_id, "Player mismatch", "HANDSHAKE_REJECTED")
                        await websocket.close(code=4006, reason="Player mismatch")
                        break
                    record.session_id = session_id
                    record.connection_id = connection_id
                    pname = data.get("player_name") or player_name
                    async with room.lock:
                        ok, err = room_service.apply_server_handshake(
                            room, player_id, session_id, connection_id, player_name=pname
                        )
                        view = room.get_player_view(player_id) if ok else None
                    if not ok:
                        await _send_error(room_id, player_id, err or "Handshake failed", "HANDSHAKE_REJECTED")
                        continue
                    handshake_done["ok"] = True
                    handshake_event.set()
                    slog(
                        "handshake_ack",
                        room_id=room_id,
                        player_id=player_id,
                        session_id=session_id,
                        connection_id=connection_id,
                    )
                    await ws_manager.send_to_player(room_id, player_id, {
                        "type": "HANDSHAKE_ACK",
                        "data": {
                            "player_id": player_id,
                            "session_id": session_id,
                            "connection_id": connection_id,
                            "leader_id": room.leader_id,
                            "is_leader": player_id == room.leader_id,
                            "peer_verified": False,
                            "game_state": view,
                        },
                    })
                    await _try_peer_hello(room, room_id)

                elif action == "PEER_HELLO_ACK":
                    room_service.note_heartbeat(room, player_id)
                    peer_id = data.get("peer_id")
                    peer_session = data.get("peer_session_id")
                    round_id = data.get("round")
                    async with room.lock:
                        ok, err = room_service.apply_peer_hello_ack(
                            room, player_id, peer_id, peer_session, round_id=round_id
                        )
                    if not ok:
                        slog("peer_hello_ack_rejected", room_id=room_id, player_id=player_id, error=err)
                        continue
                    await _try_peer_ready(room, room_id)

                elif action == "PEER_READY_ACK":
                    room_service.note_heartbeat(room, player_id)
                    async with room.lock:
                        ok, err = room_service.apply_peer_ready_ack(room, player_id)
                        both = room_service._both_verified_unlocked(room) if ok else False
                    if not ok:
                        slog("peer_ready_ack_rejected", room_id=room_id, player_id=player_id, error=err)
                        continue
                    if both:
                        slog("both_connected", room_id=room_id)
                        await ws_manager.broadcast_state(room, "PEER_VERIFIED", {
                            "both_connected": True,
                        })
                        # If both players in PREPARING were already marked ready, auto-start!
                        async with room.lock:
                            if (
                                room.status == "PREPARING"
                                and len(room.players) == MAX_PLAYERS
                                and all(p.get("ready") for p in room.players.values())
                            ):
                                slog("auto_start_after_verification", room_id=room_id)
                                await room_service._start_game_unlocked(room)

                elif action == "PEER_PONG":
                    room_service.note_heartbeat(room, player_id, data.get("rtt_ms"))

                elif action == "START_GAME":
                    ok, err = await room_service.start_game_by_leader(room, player_id)
                    if not ok:
                        await _send_error(room_id, player_id, err or "Cannot start", "START_REJECTED")

                elif action == "KICK_PLAYER":
                    target_pid = data.get("target_player_id")
                    ok, err = await room_service.kick_player(room, player_id, target_pid)
                    if not ok:
                        await _send_error(room_id, player_id, err or "Cannot remove player", "KICK_REJECTED")
                    else:
                        await ws_manager.kick_and_close(
                            room_id,
                            target_pid,
                            "You were removed from the room by the room leader.",
                        )
                        await ws_manager.broadcast_state(room, "PLAYER_KICKED", {
                            "kicked_player_id": target_pid,
                            "leader_id": room.leader_id,
                        })

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
                        await _send_error(room_id, player_id, err or "Cannot swap cells")

                elif action == "SET_BOARD":
                    grid = data.get("board", [])
                    ok, err = await room_service.set_entire_board(room, player_id, grid)
                    if not ok:
                        await _send_error(room_id, player_id, err or "Cannot update board")

                elif action == "CALL_NUMBER":
                    num = int(data.get("number", 0))
                    ok, err = await room_service.call_number(room, player_id, num)
                    if not ok:
                        await _send_error(room_id, player_id, err or "Invalid move")

                elif action == "REQUEST_REMATCH":
                    await room_service.request_rematch(room, player_id)

            except (ValueError, TypeError) as err:
                await _send_error(room_id, player_id, "Invalid data payload")

    except WebSocketDisconnect:
        slog("ws_disconnected", room_id=room_id, player_id=player_id, connection_id=connection_id)
    except Exception as e:
        logger.error("ws_error %s", json.dumps({"player_id": player_id, "error": str(e)}))
    finally:
        watchdog_task.cancel()
        forward_task.cancel()
        try:
            await forward_task
        except (asyncio.CancelledError, Exception):
            pass
        try:
            await watchdog_task
        except (asyncio.CancelledError, Exception):
            pass
        room.remove_listener(queue)
        ws_manager.disconnect(room_id, player_id, connection_id)
        await room_service.mark_player_disconnected(
            room,
            player_id,
            connection_id=connection_id,
            transfer_leader=False,
        )
        remaining = ws_manager.active_connections.get(room_id, {})
        if remaining:
            await ws_manager.broadcast_state(room, "PLAYER_DISCONNECTED", {"player_id": player_id})
        slog("ws_cleanup", room_id=room_id, player_id=player_id, connection_id=connection_id)
