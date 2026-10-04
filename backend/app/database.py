import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, DateTime

import os
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./bingo.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class RoomRecord(Base):
    __tablename__ = "rooms"

    room_id: Mapped[str] = mapped_column(String(32), primary_key=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="WAITING")
    creator_id: Mapped[str] = mapped_column(String(64))
    player_data: Mapped[str] = mapped_column(Text, default="{}")  # JSON encoded players dict
    player_order: Mapped[str] = mapped_column(Text, default="[]")  # JSON encoded [p1_id, p2_id]
    boards_data: Mapped[str] = mapped_column(Text, default="{}")  # JSON encoded boards dict
    called_numbers_data: Mapped[str] = mapped_column(Text, default="[]")  # JSON encoded list
    current_turn: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    preparation_deadline: Mapped[Optional[float]] = mapped_column(nullable=True)
    turn_started_at: Mapped[Optional[float]] = mapped_column(nullable=True)
    turn_deadline: Mapped[Optional[float]] = mapped_column(nullable=True)
    match_deadline: Mapped[Optional[float]] = mapped_column(nullable=True)
    winner: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    result: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    result_reason: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


_db_initialized = False

async def init_db():
    global _db_initialized
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    _db_initialized = True


async def ensure_db():
    global _db_initialized
    if not _db_initialized:
        await init_db()


async def save_room_state(room_dict: Dict[str, Any]):
    try:
        await ensure_db()
        async with async_session() as session:
            async with session.begin():
                record = await session.get(RoomRecord, room_dict["room_id"])
                if not record:
                    record = RoomRecord(room_id=room_dict["room_id"])
                    session.add(record)

                record.status = room_dict["status"]
                record.creator_id = room_dict["creator_id"]
                record.player_data = json.dumps(room_dict.get("players", {}))
                record.player_order = json.dumps(room_dict.get("player_order", []))
                record.boards_data = json.dumps(room_dict.get("boards", {}))
                record.called_numbers_data = json.dumps(room_dict.get("called_numbers", []))
                record.current_turn = room_dict.get("current_turn")
                record.preparation_deadline = room_dict.get("preparation_deadline")
                record.turn_started_at = room_dict.get("turn_started_at")
                record.turn_deadline = room_dict.get("turn_deadline")
                record.match_deadline = room_dict.get("match_deadline")
                record.winner = room_dict.get("winner")
                record.result = room_dict.get("result")
                record.result_reason = room_dict.get("result_reason")
                record.updated_at = datetime.now(timezone.utc)
    except Exception as e:
        import logging
        logging.getLogger("bingo.db").error(f"Failed to save room state for {room_dict.get('room_id')}: {e}")


async def load_room_state(room_id: str) -> Optional[Dict[str, Any]]:
    async with async_session() as session:
        record = await session.get(RoomRecord, room_id)
        if not record:
            return None
        return {
            "room_id": record.room_id,
            "status": record.status,
            "creator_id": record.creator_id,
            "players": json.loads(record.player_data or "{}"),
            "player_order": json.loads(record.player_order or "[]"),
            "boards": json.loads(record.boards_data or "{}"),
            "called_numbers": json.loads(record.called_numbers_data or "[]"),
            "current_turn": record.current_turn,
            "preparation_deadline": record.preparation_deadline,
            "turn_started_at": record.turn_started_at,
            "turn_deadline": record.turn_deadline,
            "match_deadline": record.match_deadline,
            "winner": record.winner,
            "result": record.result,
            "result_reason": record.result_reason,
        }
