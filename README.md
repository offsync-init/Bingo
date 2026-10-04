# Real-Time 1v1 Nepali Bingo Web Application

[![Tests](https://img.shields.io/badge/pytest-20%20passed-brightgreen.svg)]()
[![Frontend](https://img.shields.io/badge/Next.js-16%20Turbopack-blue.svg)]()
[![Backend](https://img.shields.io/badge/FastAPI-0.142%20WebSockets-teal.svg)]()
[![License](https://img.shields.io/badge/License-MIT-amber.svg)]()

A complete production-quality **real-time multiplayer 1v1 Bingo web application** inspired by Nepali visual culture (Dhaka weave geometry, Himalayan crimson & gold tones, Devanagari numerals, and singing bowl audio synthesis) designed around a fast competitive turn-based match.

---

## 1. Core Architecture

The system is organized into decoupled, independent layers:

```text
/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app with CORS & lifespan initialization
│   │   ├── database.py              # SQLite + aiosqlite / SQLAlchemy persistence
│   │   ├── api/
│   │   │   └── routes.py            # REST endpoints & WebSocket endpoint
│   │   ├── game/
│   │   │   └── engine.py            # Deterministic, pure game engine
│   │   ├── models/
│   │   │   └── schema.py            # Pydantic schemas for state, players, moves
│   │   ├── services/
│   │   │   └── room_service.py      # Room lifecycle, authoritative timers & rematch
│   │   └── websocket/
│   │       └── manager.py           # Real-time WebSocket connection manager
│   ├── tests/
│   │   ├── test_engine.py           # Core engine unit tests (all 12 lines, Bingo)
│   │   ├── test_rules.py            # Turn/match timeouts, simultaneous wins, rematch
│   │   ├── test_api.py              # REST API tests (creation, joining, rejection)
│   │   ├── test_websocket.py        # End-to-end WebSocket simulation test
│   │   └── test_reconnect.py        # Reconnection grace period & state restore
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Landing page (hero, rules, create/join buttons)
│   │   │   ├── create/page.tsx      # Create room interface
│   │   │   ├── join/page.tsx        # Join room interface
│   │   │   ├── room/[roomId]/       # Lobby and 60-second preparation phase
│   │   │   └── game/[roomId]/       # Active 1v1 turn-based match gameplay
│   │   ├── components/
│   │   │   ├── Board.tsx            # 5x5 active gameplay board
│   │   │   ├── Cell.tsx             # Accessible, high-contrast marked cell
│   │   │   ├── PreparationBoard.tsx # Drag-and-drop & click-to-swap 5x5 board
│   │   │   ├── BingoProgress.tsx    # B-I-N-G-O progress (1 to 5 lines indicator)
│   │   │   ├── TimerDisplay.tsx     # Authoritative Turn & Match countdowns
│   │   │   ├── DhakaPattern.tsx     # SVG Palpali Dhaka patterns and motifs
│   │   │   ├── Header.tsx           # Navigation bar with bilingual & audio toggles
│   │   │   ├── GameModal.tsx        # Victory/Defeat/Draw dialog with rematch
│   │   │   └── Notifications.tsx    # Real-time number call banners
│   │   ├── hooks/
│   │   │   └── useBingoSocket.ts    # WebSocket hook with auto-reconnect & audio
│   │   ├── lib/
│   │   │   ├── audio.ts             # Web Audio API synthesizer (singing bowl, chimes)
│   │   │   ├── translations.ts      # English & Nepali bilingual dictionaries
│   │   │   └── utils.ts             # Devanagari numerals converter and helpers
│   │   └── types/
│   │       └── game.ts              # TypeScript definitions
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 2. Key Game Rules & Implementation Details

1. **Board Structure**:
   - Each player has an individual 5×5 board containing numbers 1–25 exactly once.
   - Numbers are arranged independently per player (randomly or manually arranged).

2. **Preparation Phase (60 Seconds)**:
   - When Player 2 joins, a 60-second countdown begins.
   - Players can click **[Randomize]**, click any two cells to swap them, or drag and drop cells.
   - Both players can toggle **READY**. If both become ready, the game starts immediately; otherwise, it starts automatically when the 60 seconds expire.

3. **Turn-Based Number Calling**:
   - Player 1 starts.
   - On a player's turn, they select an unmarked number from their board.
   - The server validates the move authoritatively.
   - The selected number is **marked on BOTH players' boards**.
   - The turn alternates to the other player.

4. **Winning Condition (CRITICAL RULE)**:
   - There are 12 possible winning lines:
     - 5 horizontal rows
     - 5 vertical columns
     - 2 diagonals (main diagonal and anti-diagonal)
   - A player wins when `completed_lines >= 5`.
   - **ANY 5 lines in any combination win!** There is **NO ordered B-I-N-G-O requirement**.
   - If a single call results in both players simultaneously reaching $\ge 5$ lines, the player whose turn it was wins because their valid move triggered the transition.

5. **Authoritative Timers & Timeouts**:
   - **Turn Timer**: 2 minutes (120s) per turn. If a player runs out of turn time, they lose immediately and the opponent wins.
   - **Match Timer**: 5 minutes (300s) maximum match duration. If the match timer expires, line counts are compared; the player with more lines wins, or DRAW if equal.
   - **Disconnect Grace Period**: 30 seconds to reconnect before forfeiting the match.

6. **Rematch Flow**:
   - When a match finishes, both players can click **[PLAY AGAIN]**.
   - When both players accept, new boards are generated, marks and called numbers are cleared, timers reset, and a new match enters the preparation phase.

7. **Nepali Cultural Visuals**:
   - Palpali Dhaka geometric repeat borders (crimson `#8A1538`, gold `#D4AF37`, and deep slate).
   - Bilingual support: One-click toggle between English and Nepali Devanagari labels.
   - Numerals toggle: Switch between Western (1, 2, 3...) and Devanagari (१, २, ३...) numerals.
   - Web Audio API synthesizer: Authentic singing bowl tones, bell harmonics, wood clicks, and celebration fanfare without external media dependencies.

---

## 3. Quick Start (Local Development)

### Prerequisites

- **Node.js** >= 18.0 (Node 20+ recommended)
- **Python** >= 3.10 (tested through Python 3.14)

### 1. Clone & Set Up Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Run tests to verify:

```bash
PYTHONPATH=. pytest tests/
```

Start the backend server on `http://127.0.0.1:8000`:

```bash
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Set Up Frontend

In another terminal window:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

## 4. Production Build

### Frontend Production Build

```bash
cd frontend
npm run build
npm start
```

### Docker Compose

Run the entire stack with Docker:

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api`
- Backend Docs: `http://localhost:8000/docs`

---

## 5. Environment Variables

Create `.env` in the root (see `.env.example`):

```bash
# Backend
PORT=8000
HOST=0.0.0.0
DATABASE_URL=sqlite+aiosqlite:///./bingo.db
SECRET_KEY=nepali_bingo_super_secret_production_key_2026

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_HOST=localhost:8000
PORT=3000
```

---

## 6. Automated Test Suite

The test suite covers all constraints in Section 35 of the specification:

```bash
PYTHONPATH=backend backend/venv/bin/pytest backend/tests/ -v
```

### Verified Test Cases:
1. `test_board_generation_shape_and_range`: 5x5, 1–25 unique, no duplicates.
2. `test_board_validation_errors`: Rejects out-of-range, duplicate numbers, or wrong dimensions.
3. `test_number_marking`: Marking verified on board representations.
4. `test_row_detection_all_five_rows`: All 5 horizontal rows detected.
5. `test_column_detection_all_five_columns`: All 5 vertical columns detected.
6. `test_diagonal_detection_both_diagonals`: Main and anti-diagonals detected.
7. `test_single_move_completing_multiple_lines`: Single number completing 2, 3, or 4 lines simultaneously.
8. `test_win_condition_and_no_ordered_bingo`: Any 5 lines win (4 continues, 5 wins, no B-I-N-G-O order).
9. `test_move_validation`: Validates turn, duplicate numbers, out-of-bounds, expired turns.
10. `test_room_creation_and_rejection_of_third_player`: 3rd player rejected.
11. `test_ready_starts_game_and_p1_starts`: Player 1 always starts.
12. `test_move_turns_and_marks`: Moves alternate and numbers mark on both boards.
13. `test_turn_timeout_loses_immediately`: 2-minute timeout causes immediate loss.
14. `test_match_timeout_resolution`: 5-minute timeout compares lines; equal lines produce DRAW.
15. `test_simultaneous_bingo_turn_player_wins`: Move initiator wins simultaneous Bingo.
16. `test_rematch_flow`: Both players accept rematch -> fresh boards, reset timers.
17. `test_health_check`: REST API health endpoint.
18. `test_create_and_join_room_api`: REST room creation and joining.
19. `test_full_game_lifecycle_end_to_end`: Complete match simulation.
20. `test_reconnection_state_restoration`: 30s disconnect grace period & state restoration.
