import random
from typing import List, Set, Tuple, Optional, Dict, Any

BOARD_SIZE = 5
TOTAL_CELLS = 25
TARGET_LINES_FOR_BINGO = 5
MAX_POSSIBLE_LINES = 12

class BoardCell:
    def __init__(self, number: int, marked: bool = False, row: int = 0, col: int = 0):
        self.number = number
        self.marked = marked
        self.row = row
        self.col = col

    def to_dict(self) -> Dict[str, Any]:
        return {
            "number": self.number,
            "marked": self.marked,
            "row": self.row,
            "col": self.col
        }


def generate_board() -> List[List[int]]:
    """
    Generates a 5x5 board containing numbers 1 to 25 exactly once, randomly shuffled.
    """
    numbers = list(range(1, TOTAL_CELLS + 1))
    random.shuffle(numbers)
    return [numbers[i * BOARD_SIZE:(i + 1) * BOARD_SIZE] for i in range(BOARD_SIZE)]


def validate_board(grid: List[List[int]]) -> Tuple[bool, Optional[str]]:
    """
    Validates that grid is a 5x5 matrix containing numbers 1-25 exactly once.
    """
    if not isinstance(grid, list) or len(grid) != BOARD_SIZE:
        return False, f"Board must have exactly {BOARD_SIZE} rows"

    seen = set()
    for r_idx, row in enumerate(grid):
        if not isinstance(row, list) or len(row) != BOARD_SIZE:
            return False, f"Row {r_idx} must have exactly {BOARD_SIZE} columns"
        for val in row:
            if not isinstance(val, int):
                return False, f"Invalid value {val}: board cells must be integers"
            if val < 1 or val > TOTAL_CELLS:
                return False, f"Number {val} is outside allowed range 1-{TOTAL_CELLS}"
            if val in seen:
                return False, f"Duplicate number {val} detected on board"
            seen.add(val)

    if len(seen) != TOTAL_CELLS:
        return False, f"Board must contain all numbers 1-{TOTAL_CELLS}"

    return True, None


def get_completed_lines(grid: List[List[int]], called_numbers: Set[int]) -> List[Dict[str, Any]]:
    """
    Identifies all completed lines on a board based on called numbers.
    Lines checked:
      - 5 horizontal rows (row 0 to 4)
      - 5 vertical columns (col 0 to 4)
      - 1 main diagonal ((0,0) to (4,4))
      - 1 anti-diagonal ((0,4) to (4,0))
    Total 12 possible lines.
    """
    completed = []

    # 1. Check rows
    for r in range(BOARD_SIZE):
        row_numbers = [grid[r][c] for c in range(BOARD_SIZE)]
        if all(num in called_numbers for num in row_numbers):
            completed.append({
                "type": "row",
                "index": r,
                "id": f"row_{r}",
                "coordinates": [(r, c) for c in range(BOARD_SIZE)],
                "numbers": row_numbers
            })

    # 2. Check columns
    for c in range(BOARD_SIZE):
        col_numbers = [grid[r][c] for r in range(BOARD_SIZE)]
        if all(num in called_numbers for num in col_numbers):
            completed.append({
                "type": "col",
                "index": c,
                "id": f"col_{c}",
                "coordinates": [(r, c) for r in range(BOARD_SIZE)],
                "numbers": col_numbers
            })

    # 3. Main diagonal (top-left to bottom-right)
    main_diag = [grid[i][i] for i in range(BOARD_SIZE)]
    if all(num in called_numbers for num in main_diag):
        completed.append({
            "type": "diagonal",
            "index": 0,
            "id": "diag_main",
            "coordinates": [(i, i) for i in range(BOARD_SIZE)],
            "numbers": main_diag
        })

    # 4. Anti-diagonal (top-right to bottom-left)
    anti_diag = [grid[i][BOARD_SIZE - 1 - i] for i in range(BOARD_SIZE)]
    if all(num in called_numbers for num in anti_diag):
        completed.append({
            "type": "diagonal",
            "index": 1,
            "id": "diag_anti",
            "coordinates": [(i, BOARD_SIZE - 1 - i) for i in range(BOARD_SIZE)],
            "numbers": anti_diag
        })

    return completed


def count_completed_lines(grid: List[List[int]], called_numbers: Set[int]) -> int:
    """
    Returns the count of distinct completed lines (0 to 12).
    """
    return len(get_completed_lines(grid, called_numbers))


def has_bingo(grid: List[List[int]], called_numbers: Set[int]) -> bool:
    """
    CRITICAL RULE:
    Bingo is achieved when completed_lines >= 5.
    Can be ANY combination of rows, columns, or diagonals.
    NO ordered requirement of B-I-N-G-O!
    """
    return count_completed_lines(grid, called_numbers) >= TARGET_LINES_FOR_BINGO


def format_board_with_marks(grid: List[List[int]], called_numbers: Set[int]) -> List[List[Dict[str, Any]]]:
    """
    Returns the 5x5 grid with cell marking status.
    """
    result = []
    for r in range(BOARD_SIZE):
        row_cells = []
        for c in range(BOARD_SIZE):
            val = grid[r][c]
            row_cells.append({
                "number": val,
                "marked": val in called_numbers,
                "row": r,
                "col": c
            })
        result.append(row_cells)
    return result


def validate_move(
    player_id: str,
    current_turn: Optional[str],
    number: int,
    called_numbers: Set[int],
    player_board: List[List[int]],
    game_status: str,
    turn_expired: bool = False,
    match_expired: bool = False
) -> Tuple[bool, Optional[str]]:
    """
    Authoritative server-side move validation.
    Section 22:
      1. Game is PLAYING
      2. Player is authenticated/identified in room
      3. It is that player's turn
      4. Match has not expired
      5. Turn has not expired
      6. Number is between 1 and 25
      7. Number has not already been called
      8. Number exists on the player's board
    """
    if game_status != "PLAYING":
        return False, f"Game is not active (current status: {game_status})"

    if match_expired:
        return False, "Match time has expired"

    if turn_expired:
        return False, "Turn time has expired"

    if current_turn != player_id:
        return False, f"Not your turn. Current turn belongs to {current_turn}"

    if not isinstance(number, int) or number < 1 or number > TOTAL_CELLS:
        return False, f"Number must be an integer between 1 and {TOTAL_CELLS}"

    if number in called_numbers:
        return False, f"Number {number} has already been called"

    # Verify number exists on player's board
    board_numbers = {cell for row in player_board for cell in row}
    if number not in board_numbers:
        return False, f"Number {number} does not exist on your board"

    return True, None
