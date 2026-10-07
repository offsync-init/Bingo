from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

class PlayerInfo(BaseModel):
    id: str
    name: str
    connected: bool = True
    ready: bool = False
    rematch_requested: bool = False
    disconnected_at: Optional[float] = None
    is_forfeited: bool = False


class MoveRequest(BaseModel):
    number: int


class SwapCellsRequest(BaseModel):
    row1: int
    col1: int
    row2: int
    col2: int


class SetBoardRequest(BaseModel):
    board: List[List[int]]


class GameStateResponse(BaseModel):
    room_id: str
    status: str  # WAITING, PREPARING, PLAYING, FINISHED
    creator_id: str
    players: Dict[str, PlayerInfo]
    player_order: List[str]
    current_turn: Optional[str] = None
    called_numbers: List[int] = Field(default_factory=list)
    preparation_deadline: Optional[float] = None
    match_deadline: Optional[float] = None
    turn_started_at: Optional[float] = None
    turn_deadline: Optional[float] = None
    completed_lines: Dict[str, int] = Field(default_factory=dict)
    winner: Optional[str] = None
    result: Optional[str] = None
    result_reason: Optional[str] = None
    # Player's own board with marked status
    board: Optional[List[List[Dict[str, Any]]]] = None
    opponent_id: Optional[str] = None
    opponent_lines: int = 0
    completed_line_details: List[Dict[str, Any]] = Field(default_factory=list)
