import pytest
from app.game.engine import (
    BOARD_SIZE,
    TOTAL_CELLS,
    TARGET_LINES_FOR_BINGO,
    generate_board,
    validate_board,
    get_completed_lines,
    count_completed_lines,
    has_bingo,
    format_board_with_marks,
    validate_move,
)

def test_board_generation_shape_and_range():
    """Board generation: exactly 25 cells, numbers 1-25, no duplicates."""
    board = generate_board()
    assert len(board) == 5
    for row in board:
        assert len(row) == 5

    flattened = [num for row in board for num in row]
    assert len(flattened) == 25
    assert set(flattened) == set(range(1, 26))

    is_valid, error = validate_board(board)
    assert is_valid is True
    assert error is None


def test_board_validation_errors():
    """Verify validation detects wrong sizes, out-of-range numbers, and duplicates."""
    # Too few rows
    bad_board_1 = [[1, 2, 3, 4, 5]]
    valid, err = validate_board(bad_board_1)
    assert not valid
    assert "rows" in err

    # Duplicate number
    bad_board_2 = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 1]  # duplicate 1 instead of 25
    ]
    valid, err = validate_board(bad_board_2)
    assert not valid
    assert "Duplicate" in err

    # Out of range (0 or 26)
    bad_board_3 = [
        [0, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]
    valid, err = validate_board(bad_board_3)
    assert not valid
    assert "outside allowed range" in err


def test_number_marking():
    """Called numbers should correctly mark cells on the board."""
    board = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]
    called = {7, 13, 25}
    formatted = format_board_with_marks(board, called)
    assert formatted[1][1]["number"] == 7
    assert formatted[1][1]["marked"] is True
    assert formatted[2][2]["number"] == 13
    assert formatted[2][2]["marked"] is True
    assert formatted[4][4]["number"] == 25
    assert formatted[4][4]["marked"] is True
    assert formatted[0][0]["number"] == 1
    assert formatted[0][0]["marked"] is False


def test_row_detection_all_five_rows():
    """Verify each of the 5 horizontal rows is correctly detected when filled."""
    board = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]

    for r in range(5):
        called = set(board[r])
        lines = get_completed_lines(board, called)
        assert len(lines) == 1
        assert lines[0]["type"] == "row"
        assert lines[0]["index"] == r


def test_column_detection_all_five_columns():
    """Verify each of the 5 vertical columns is correctly detected when filled."""
    board = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]

    for c in range(5):
        called = {board[r][c] for r in range(5)}
        lines = get_completed_lines(board, called)
        assert len(lines) == 1
        assert lines[0]["type"] == "col"
        assert lines[0]["index"] == c


def test_diagonal_detection_both_diagonals():
    """Verify main diagonal and anti-diagonal detection."""
    board = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]

    # Main diagonal: 1, 7, 13, 19, 25
    main_diag = {1, 7, 13, 19, 25}
    lines = get_completed_lines(board, main_diag)
    assert len(lines) == 1
    assert lines[0]["type"] == "diagonal"
    assert lines[0]["id"] == "diag_main"

    # Anti-diagonal: 5, 9, 13, 17, 21
    anti_diag = {5, 9, 13, 17, 21}
    lines = get_completed_lines(board, anti_diag)
    assert len(lines) == 1
    assert lines[0]["type"] == "diagonal"
    assert lines[0]["id"] == "diag_anti"


def test_single_move_completing_multiple_lines():
    """
    Test a single move that completes 2 or 3 lines simultaneously.
    For example: center cell (row 2, col 2 = 13) is the intersection of:
    - row 2: [11, 12, 13, 14, 15]
    - col 2: [3, 8, 13, 18, 23]
    - main diagonal: [1, 7, 13, 19, 25]
    - anti diagonal: [5, 9, 13, 17, 21]
    If row 2, col 2, and both diagonals are almost full, calling 13 completes 3 or 4 lines at once!
    """
    board = [
        [1,  2,  3,  4,  5],
        [6,  7,  8,  9,  10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]

    # Row 2 (without 13) + Col 2 (without 13)
    pre_called = {11, 12, 14, 15, 3, 8, 18, 23}
    assert count_completed_lines(board, pre_called) == 0

    # Calling 13 completes BOTH row 2 and col 2
    after_call = pre_called | {13}
    lines = get_completed_lines(board, after_call)
    assert len(lines) == 2
    line_ids = {l["id"] for l in lines}
    assert line_ids == {"row_2", "col_2"}

    # Also include diagonal parts to test 3 or 4 lines at once
    pre_called_4 = pre_called | {1, 7, 19, 25, 5, 9, 17, 21}
    after_call_4 = pre_called_4 | {13}
    lines_4 = get_completed_lines(board, after_call_4)
    assert len(lines_4) == 4
    line_ids_4 = {l["id"] for l in lines_4}
    assert line_ids_4 == {"row_2", "col_2", "diag_main", "diag_anti"}


def test_win_condition_and_no_ordered_bingo():
    """
    CRITICAL RULE:
    - 4 lines -> continues (has_bingo == False)
    - 5 lines -> ends (has_bingo == True)
    - ANY combination of lines wins, NO requirement of B-I-N-G-O in order!
    """
    board = [
        [1,  2,  3,  4,  5],
        [6,  7,  8,  9,  10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]

    # 4 rows = 4 lines (not bingo yet)
    called_4_rows = set(board[0] + board[1] + board[2] + board[3])
    assert count_completed_lines(board, called_4_rows) == 4
    assert has_bingo(board, called_4_rows) is False

    # 5 rows = 5 lines -> BINGO!
    called_5_rows = set(board[0] + board[1] + board[2] + board[3] + board[4])
    assert count_completed_lines(board, called_5_rows) == 12  # All cells filled = 12 lines
    assert has_bingo(board, called_5_rows) is True

    # 4 rows (0, 1, 2, 3) + 1 column (col 2):
    # Rows 0, 1, 2, 3 contain 1..20
    # Column 2 has cells 3, 8, 13, 18 (all in rows 0-3) and cell (4,2) = 23
    # Neither main diagonal ((4,4)=25) nor anti-diagonal ((4,0)=21) is completed!
    called_4r_1c = set(range(1, 21)) | {23}
    lines_5 = get_completed_lines(board, called_4r_1c)
    assert len(lines_5) == 5
    line_ids_5 = {l["id"] for l in lines_5}
    assert line_ids_5 == {"row_0", "row_1", "row_2", "row_3", "col_2"}
    assert has_bingo(board, called_4r_1c) is True

    # 1 row + 2 columns + 2 diagonals = 5 lines -> BINGO!
    called_1r_2c_2d = {
        # row 2:
        11, 12, 13, 14, 15,
        # col 0:
        1, 6, 16, 21,
        # col 4:
        5, 10, 20, 25,
        # main diag needs (1,1)=7, (3,3)=19 (1, 13, 25 already in)
        7, 19,
        # anti diag needs (1,3)=9, (3,1)=17 (5, 13, 21 already in)
        9, 17
    }
    lines = get_completed_lines(board, called_1r_2c_2d)
    line_types = [l["type"] for l in lines]
    assert line_types.count("row") == 1
    assert line_types.count("col") == 2
    assert line_types.count("diagonal") == 2
    assert len(lines) == 5
    assert has_bingo(board, called_1r_2c_2d) is True


def test_move_validation():
    """Verify strict validation rules for player moves."""
    board = [
        [1,  2,  3,  4,  5],
        [6,  7,  8,  9,  10],
        [11, 12, 13, 14, 15],
        [16, 17, 18, 19, 20],
        [21, 22, 23, 24, 25]
    ]
    p1 = "player_1"
    p2 = "player_2"
    called = {5, 10}

    # 1. Valid move
    valid, err = validate_move(
        player_id=p1,
        current_turn=p1,
        number=17,
        called_numbers=called,
        player_board=board,
        game_status="PLAYING"
    )
    assert valid is True
    assert err is None

    # 2. Game not playing
    valid, err = validate_move(
        player_id=p1,
        current_turn=p1,
        number=17,
        called_numbers=called,
        player_board=board,
        game_status="PREPARING"
    )
    assert valid is False
    assert "not active" in err

    # 3. Wrong turn
    valid, err = validate_move(
        player_id=p2,
        current_turn=p1,
        number=17,
        called_numbers=called,
        player_board=board,
        game_status="PLAYING"
    )
    assert valid is False
    assert "Not your turn" in err

    # 4. Number already called
    valid, err = validate_move(
        player_id=p1,
        current_turn=p1,
        number=5,
        called_numbers=called,
        player_board=board,
        game_status="PLAYING"
    )
    assert valid is False
    assert "already been called" in err

    # 5. Out of bounds (e.g. 0 or 26)
    valid, err = validate_move(
        player_id=p1,
        current_turn=p1,
        number=26,
        called_numbers=called,
        player_board=board,
        game_status="PLAYING"
    )
    assert valid is False
    assert "between 1 and 25" in err

    # 6. Turn expired
    valid, err = validate_move(
        player_id=p1,
        current_turn=p1,
        number=17,
        called_numbers=called,
        player_board=board,
        game_status="PLAYING",
        turn_expired=True
    )
    assert valid is False
    assert "Turn time has expired" in err

    # 7. Match expired
    valid, err = validate_move(
        player_id=p1,
        current_turn=p1,
        number=17,
        called_numbers=called,
        player_board=board,
        game_status="PLAYING",
        match_expired=True
    )
    assert valid is False
    assert "Match time has expired" in err
