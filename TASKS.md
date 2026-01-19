# TASKS.md - Project Task Registry

> All tasks follow TASK_TEMPLATE.md format.  
> Governed by RULES.md, ARCHITECTURE.md, DOMAIN.md, STYLEGUIDE.md.

---

## Task Index

| Phase | Task ID | Title | Status |
|-------|---------|-------|--------|
| **1. Setup** | TASK-SETUP-001 | Project Structure & Dependencies | [x] |
| **2. Game Logic** | TASK-GAME-001 | Create Type Definitions | [x] |
| **2. Game Logic** | TASK-GAME-002 | Port TurkishDraughts Class | [x] |
| **2. Game Logic** | TASK-GAME-003 | Port TurkishDraughtsAI Class | [x] |
| **2. Game Logic** | TASK-GAME-004 | Implement GameState Manager | [x] |
| **3. UI Foundation** | TASK-UI-001 | Create Theme Constants | [x] |
| **3. UI Foundation** | TASK-UI-002 | Create Board Component | [x] |
| **3. UI Foundation** | TASK-UI-003 | Create Timer Component | [x] |
| **3. UI Foundation** | TASK-UI-004 | Create Move History Component | [x] |
| **3. UI Foundation** | TASK-UI-005 | Create Captured Pieces Component | [x] |
| **4. Screens** | TASK-UI-006 | Implement Menu Screen | [x] |
| **4. Screens** | TASK-UI-007 | Implement Game Screen | [x] |
| **4. Screens** | TASK-UI-008 | Implement Result Screen | [x] |
| **5. Integration** | TASK-FEAT-001 | Main App & Screen Navigation | [x] |
| **5. Integration** | TASK-FEAT-002 | Connect AI to Game Loop | [x] |
| **5. Integration** | TASK-FEAT-003 | Implement Undo Feature | [x] |
| **5. Integration** | TASK-FEAT-004 | Implement Forfeit Feature | [x] |
| **5. Integration** | TASK-FEAT-005 | Implement Timer Logic | [x] |

---

# Phase 1: Project Setup

---

## TASK-SETUP-001: Project Structure & Dependencies

**Status:** [x] Complete  
**Priority:** Critical  
**Estimated Effort:** 30 minutes

### Goal
Create project folder structure and install Flet dependency.

### Scope

#### In Scope
- [x] Create `requirements.txt` with `flet>=0.21.0`
- [x] Create folder: `game/`
- [x] Create folder: `ui/`
- [x] Create folder: `ui/components/`
- [x] Create `game/__init__.py`
- [x] Create `ui/__init__.py`
- [x] Create `ui/components/__init__.py`
- [x] Create placeholder `main.py`

#### Out of Scope
- Any game logic
- Any UI implementation
- Theme or styling

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement any functionality
- Do not modify `dama.py`
- Do not add extra dependencies

### Expected Output

#### Deliverables
- [x] `requirements.txt`
- [x] `main.py` (placeholder with `pass`)
- [x] `game/__init__.py`
- [x] `ui/__init__.py`
- [x] `ui/components/__init__.py`

#### Acceptance Criteria
- [x] `pip install -r requirements.txt` succeeds
- [x] `python main.py` runs without error
- [x] Folder structure matches STYLEGUIDE.md

### Verification
- [x] Run: `pip install -r requirements.txt`
- [x] Run: `python main.py` (exits cleanly)

---

# Phase 2: Game Logic

---

## TASK-GAME-001: Create Type Definitions

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 30 minutes

### Goal
Create shared type definitions, enums, and dataclasses for the game.

### Scope

#### In Scope
- [x] Create `game/types.py`
- [x] Define `PieceType` enum (MAN, KING)
- [x] Define `Player` enum (WHITE, BLACK)
- [x] Define `Difficulty` enum (EASY, MEDIUM, HARD, GRANDMASTER)
- [x] Define `GameMode` enum (AI, LOCAL)
- [x] Define `Piece` dataclass
- [x] Define `Move` dataclass
- [x] Define `GameSettings` dataclass
- [x] Define `MoveRecord` dataclass (for history)

#### Out of Scope
- Game logic implementation
- AI implementation
- Board class

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not copy any logic from `dama.py`
- Do not add UI-related code
- Do not add Flet imports
- Do not create classes with behavior (only data)

### Expected Output

#### Deliverables
- [x] `game/types.py`

#### Acceptance Criteria
- [x] All enums use DOMAIN.md terminology
- [x] Type hints on all fields
- [x] No external dependencies except `typing`, `dataclasses`, `enum`
- [x] File passes `python -m py_compile game/types.py`

### Dependencies
- Requires: TASK-SETUP-001

### Verification
- [x] `python -c "from game.types import *"`

---

## TASK-GAME-002: Port TurkishDraughts Class

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 2 hours

### Goal
Extract and refactor `TurkishDraughts` class from `dama.py`, removing all Pygame dependencies.

### Scope

#### In Scope
- [x] Create `game/board.py`
- [x] Port `TurkishDraughts` class from `dama.py`
- [x] Remove all Pygame imports and references
- [x] Remove animation-related variables and methods
- [x] Use types from `game/types.py`
- [x] Preserve all game rule logic:
  - Board setup
  - Move validation
  - Capture detection (mandatory, chain)
  - Promotion logic
  - Game over detection
- [x] Add type hints

#### Out of Scope
- AI logic (separate task)
- UI rendering
- State management beyond board state
- Timer logic

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not modify Turkish Draughts rules
- Do not import Pygame
- Do not import Flet
- Do not add new game features
- Do not change move validation logic

### Expected Output

#### Deliverables
- [x] `game/board.py`

#### Acceptance Criteria
- [x] Class is pure Python (no external deps)
- [x] All methods have type hints
- [x] `setup_board()` places pieces correctly
- [x] `get_valid_moves_for_piece()` works
- [x] `make_move()` executes moves properly
- [x] `check_game_over()` detects end conditions
- [x] Original `dama.py` unchanged

### Dependencies
- Requires: TASK-GAME-001

### Verification
- [x] `python -c "from game.board import TurkishDraughts; g = TurkishDraughts()"`
- [x] Manual: Create board, make moves, verify rules

---

## TASK-GAME-003: Port TurkishDraughtsAI Class

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 1 hour

### Goal
Extract `TurkishDraughtsAI` class from `dama.py` as standalone module.

### Scope

#### In Scope
- [x] Create `game/ai.py`
- [x] Port `TurkishDraughtsAI` class from `dama.py`
- [x] Use types from `game/types.py`
- [x] Use `TurkishDraughts` from `game/board.py`
- [x] Preserve minimax with alpha-beta pruning
- [x] Preserve position evaluation logic
- [x] Support all Difficulty levels
- [x] Add type hints

#### Out of Scope
- New AI strategies
- Performance optimizations
- UI integration

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not modify AI algorithm logic
- Do not change evaluation function
- Do not import Pygame or Flet
- Do not add new difficulty levels

### Expected Output

#### Deliverables
- [x] `game/ai.py`

#### Acceptance Criteria
- [x] Class uses `game/types.py` types
- [x] `get_best_move()` returns valid Move
- [x] Different Difficulty levels have different depths
- [x] No Pygame references
- [x] Original `dama.py` unchanged

### Dependencies
- Requires: TASK-GAME-001, TASK-GAME-002

### Verification
- [x] `python -c "from game.ai import TurkishDraughtsAI"`
- [x] Manual: AI returns moves in test scenarios

---

## TASK-GAME-004: Implement GameState Manager

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 1.5 hours

### Goal
Create centralized game state manager for coordinating game flow.

### Scope

#### In Scope
- [x] Create `game/state.py`
- [x] Define `GameState` class with:
  - Current settings (`GameSettings`)
  - Board instance (`TurkishDraughts`)
  - AI instance (optional)
  - Move history list (`MoveRecord`)
  - Timer values (white_time, black_time)
  - Undo stack (board snapshots)
- [x] Methods:
  - `new_game(settings)` - Initialize game
  - `execute_move(move)` - Make move, update history
  - `undo()` - Revert last move(s)
  - `get_move_history()` - Return history list
  - `save_snapshot()` - For undo support
  - `is_game_over()` - Check end condition
  - `get_winner()` - Return winner if game over

#### Out of Scope
- Timer countdown logic (UI responsibility)
- AI move selection (called externally)
- Persistence/save games

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement timer countdown
- Do not import Flet
- Do not add networking or persistence
- Do not modify board/AI classes

### Expected Output

#### Deliverables
- [x] `game/state.py`

#### Acceptance Criteria
- [x] State tracks all game data
- [x] Undo restores previous board state
- [x] Move history is maintained
- [x] Type hints on all methods

### Dependencies
- Requires: TASK-GAME-001, TASK-GAME-002, TASK-GAME-003

### Verification
- [x] `python -c "from game.state import GameState"`
- [x] Manual: Create game, make moves, undo, verify state

---

# Phase 3: UI Foundation

---

## TASK-UI-001: Create Theme Constants

**Status:** [x] Complete  
**Priority:** Medium  
**Estimated Effort:** 30 minutes

### Goal
Define color palette and styling constants inspired by HTML mockups.

### Scope

#### In Scope
- [x] Create `ui/theme.py`
- [x] Define `COLORS` dictionary with:
  - primary, primary_dark
  - bg_dark, surface, surface_light
  - text_white, text_gray
  - accent_green, accent_amber
  - board_light (maple), board_dark (walnut)
  - piece_white, piece_black
- [x] Define `FONTS` dictionary (optional names)
- [x] Define `SIZES` dictionary (board, pieces, spacing)

#### Out of Scope
- UI components
- Flet widgets

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not create UI components
- Do not import Flet in this file
- Do not add themes beyond dark mode

### Expected Output

#### Deliverables
- [x] `ui/theme.py`

#### Acceptance Criteria
- [x] All colors from mockups defined
- [x] Values are hex strings
- [x] No Flet imports

### Dependencies
- Requires: TASK-SETUP-001

### Verification
- [x] `python -c "from ui.theme import COLORS"`

---

## TASK-UI-002: Create Board Component

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 2 hours

### Goal
Create reusable 8x8 board widget with piece rendering and interaction.

### Scope

#### In Scope
- [x] Create `ui/components/board_view.py`
- [x] Create `BoardView` class (Flet UserControl or function)
- [x] Render 8x8 grid with alternating colors
- [x] Render pieces at positions (Man and King)
- [x] Handle square click events
- [x] Highlight selected piece
- [x] Show valid move indicators
- [x] Show capture targets (red highlight)
- [x] Use theme colors from `ui/theme.py`

#### Out of Scope
- Move execution logic (callback only)
- Timer display
- Move history
- Coordinates display (A-H, 1-8)

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement game logic
- Do not manage state
- Do not add animations
- Do not add coordinates yet

### Expected Output

#### Deliverables
- [x] `ui/components/board_view.py`

#### Acceptance Criteria
- [x] Renders 8x8 board
- [x] Pieces display correctly
- [x] King pieces show crown indicator
- [x] Click callback fires with (row, col)
- [x] Selected piece highlighted
- [x] Valid moves shown

### Dependencies
- Requires: TASK-UI-001, TASK-GAME-001

### Verification
- [x] Visual: Board renders in test app
- [x] Click squares, verify callback

---

## TASK-UI-003: Create Timer Component

**Status:** [x] Complete  
**Priority:** Medium  
**Estimated Effort:** 1 hour

### Goal
Create countdown timer display component.

### Scope

#### In Scope
- [x] Create `ui/components/timer.py`
- [x] Create `TimerDisplay` class/function
- [x] Display time in MM:SS format
- [x] Accept time value in seconds
- [x] Visual styling (active/inactive state)
- [x] Low time warning (optional color change)

#### Out of Scope
- Countdown logic (parent manages tick)
- Sound effects
- Time controls selection

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement countdown interval
- Do not manage game state
- Do not add sound

### Expected Output

#### Deliverables
- [x] `ui/components/timer.py`

#### Acceptance Criteria
- [x] Displays formatted time
- [x] Styling matches theme
- [x] Updates when value changes

### Dependencies
- Requires: TASK-UI-001

### Verification
- [x] Visual: Timer displays in test

---

## TASK-UI-004: Create Move History Component

**Status:** [x] Complete  
**Priority:** Medium  
**Estimated Effort:** 45 minutes

### Goal
Create scrollable move history list component.

### Scope

#### In Scope
- [x] Create `ui/components/move_history.py`
- [x] Create `MoveHistory` class/function
- [x] Accept list of `MoveRecord`
- [x] Display moves in notation format
- [x] Show piece color indicator
- [x] Auto-scroll to latest move
- [x] Highlight capture moves

#### Out of Scope
- Move replay
- Move selection/navigation

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement move replay
- Do not manage state

### Expected Output

#### Deliverables
- [x] `ui/components/move_history.py`

#### Acceptance Criteria
- [x] Renders move list
- [x] Scrollable when long
- [x] Uses DOMAIN.md notation

### Dependencies
- Requires: TASK-UI-001, TASK-GAME-001

### Verification
- [x] Visual: History displays moves

---

## TASK-UI-005: Create Captured Pieces Component

**Status:** [x] Complete  
**Priority:** Low  
**Estimated Effort:** 30 minutes

### Goal
Create component showing captured pieces for each player.

### Scope

#### In Scope
- [x] Create `ui/components/captured.py`
- [x] Create `CapturedPieces` class/function
- [x] Accept captured count per player
- [x] Display mini piece icons
- [x] Label for each player

#### Out of Scope
- Captured piece animation
- Click interactions

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not add animations
- Do not manage state

### Expected Output

#### Deliverables
- [x] `ui/components/captured.py`

#### Acceptance Criteria
- [x] Shows captured count
- [x] Mini piece visuals

### Dependencies
- Requires: TASK-UI-001

### Verification
- [x] Visual: Captured pieces display

---

# Phase 4: Screens

---

## TASK-UI-006: Implement Menu Screen

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 2.5 hours

### Goal
Create main menu screen with game configuration options.

### Scope

#### In Scope
- [x] Create `ui/menu_screen.py`
- [x] Title/logo display
- [x] Game mode selection:
  - "Play vs AI" button
  - "Local Match" button
- [x] Difficulty selector (4 levels) - shown for AI mode
- [x] Time control selector:
  - Untimed
  - 3 minutes
  - 5 minutes
  - 10 minutes
- [x] Side selection: White / Black / Random
- [x] "START MATCH" button
- [x] Return `GameSettings` on start
- [x] Styling per theme and mockup

#### Out of Scope
- Settings persistence
- Custom time input
- Player profiles

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement game logic
- Do not persist settings
- Do not add leaderboards
- Do not add features not in mockup

### Expected Output

#### Deliverables
- [x] `ui/menu_screen.py`

#### Acceptance Criteria
- [x] All options functional
- [x] Returns valid GameSettings
- [x] Styling matches mockup intent
- [x] Mode toggle hides/shows difficulty

### Dependencies
- Requires: TASK-UI-001, TASK-GAME-001

### Verification
- [x] Visual: Menu renders correctly
- [x] Functional: All selections work

---

## TASK-UI-007: Implement Game Screen

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 3 hours

### Goal
Create gameplay screen with board, timers, history, and controls.

### Scope

#### In Scope
- [x] Create `ui/game_screen.py`
- [x] Layout:
  - Header: Player info bars with timers
  - Center: Board component
  - Sidebar: Move history + captured pieces
  - Footer: Undo and Forfeit buttons
- [x] Integrate `BoardView` component
- [x] Integrate `TimerDisplay` components
- [x] Integrate `MoveHistory` component
- [x] Integrate `CapturedPieces` component
- [x] Handle piece selection and move
- [x] Show "AI Thinking..." indicator
- [x] Turn indicator (whose turn)

#### Out of Scope
- Timer countdown interval (TASK-FEAT-005)
- Undo logic (TASK-FEAT-003)
- Forfeit logic (TASK-FEAT-004)
- AI move execution (TASK-FEAT-002)

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement timer countdown
- Do not implement undo logic
- Do not implement forfeit logic
- Buttons are placeholders (wired in integration tasks)

### Expected Output

#### Deliverables
- [x] `ui/game_screen.py`

#### Acceptance Criteria
- [x] Layout matches mockup structure
- [x] Board interactive
- [x] Components integrated visually
- [x] Placeholder button handlers

### Dependencies
- Requires: TASK-UI-002, TASK-UI-003, TASK-UI-004, TASK-UI-005, TASK-GAME-004

### Verification
- [x] Visual: Game screen renders
- [x] Click board squares, selection works

---

## TASK-UI-008: Implement Result Screen

**Status:** [x] Complete  
**Priority:** Medium  
**Estimated Effort:** 1.5 hours

### Goal
Create game over screen with winner display and statistics.

### Scope

#### In Scope
- [x] Create `ui/result_screen.py`
- [x] Winner announcement (large text)
- [x] Statistics display:
  - Total moves
  - Pieces captured (per player)
  - Game duration
- [x] "Return to Menu" button
- [x] Premium styling with accents

#### Out of Scope
- Game analysis
- Replay functionality
- Share/export

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement replay
- Do not add sharing
- Do not persist results

### Expected Output

#### Deliverables
- [x] `ui/result_screen.py`

#### Acceptance Criteria
- [x] Displays winner correctly
- [x] Shows statistics
- [x] Button navigates to menu

### Dependencies
- Requires: TASK-UI-001

### Verification
- [x] Visual: Result screen renders with test data

---

# Phase 5: Integration

---

## TASK-FEAT-001: Main App & Screen Navigation

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 1.5 hours

### Goal
Wire up main.py with screen navigation and game flow.

### Scope

#### In Scope
- [x] Implement `main.py` as Flet app
- [x] Initialize with Menu screen
- [x] Navigate Menu → Game on start
- [x] Navigate Game → Result on game over
- [x] Navigate Result → Menu on return
- [x] Pass settings between screens
- [x] Pass game stats to result screen

#### Out of Scope
- AI integration (separate task)
- Timer logic (separate task)

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not add splash screen
- Do not add settings persistence
- Do not add extra screens

### Expected Output

#### Deliverables
- [x] `main.py` (complete)

#### Acceptance Criteria
- [x] App launches to menu
- [x] Full navigation flow works
- [x] Settings passed correctly

### Dependencies
- Requires: TASK-UI-006, TASK-UI-007, TASK-UI-008, TASK-GAME-004

### Verification
- [x] Run app, navigate all screens
- [x] Complete a 2-player game manually

---

## TASK-FEAT-002: Connect AI to Game Loop

**Status:** [x] Complete  
**Priority:** High  
**Estimated Effort:** 1 hour

### Goal
Integrate AI move calculation into game screen for AI mode.

### Scope

#### In Scope
- [x] Detect AI's turn in game screen
- [x] Show "AI Thinking..." indicator
- [x] Call `TurkishDraughtsAI.get_best_move()`
- [x] Execute AI move after delay (UX)
- [x] Update board and history
- [x] Handle AI difficulty from settings

#### Out of Scope
- New AI algorithms
- AI vs AI mode

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not modify AI logic
- Do not add AI vs AI mode
- Do not add hint system

### Expected Output

#### Deliverables
- [x] Modified `ui/game_screen.py`

#### Acceptance Criteria
- [x] AI makes moves in AI mode
- [x] Indicator shows during thinking
- [x] Different difficulties work

### Dependencies
- Requires: TASK-FEAT-001, TASK-GAME-003

### Verification
- [x] Play AI mode, AI responds
- [x] Test all difficulty levels

---

## TASK-FEAT-003: Implement Undo Feature

**Status:** [x] Complete  
**Priority:** Medium  
**Estimated Effort:** 1 hour

### Goal
Wire undo button to restore previous game state.

### Scope

#### In Scope
- [x] Wire Undo button in game screen
- [x] AI Mode: Undo last 2 moves (player + AI)
- [x] Local Mode: Undo last 1 move
- [x] Update board display
- [x] Update move history
- [x] Disable when no moves to undo

#### Out of Scope
- Redo functionality
- Undo limit

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not implement redo
- Do not add undo count limit

### Expected Output

#### Deliverables
- [x] Modified `ui/game_screen.py`
- [x] Modified `game/state.py` (if needed)

#### Acceptance Criteria
- [x] Undo restores board state
- [x] History updates correctly
- [x] Button disabled appropriately

### Dependencies
- Requires: TASK-FEAT-001

### Verification
- [x] Make moves, undo, verify state

---

## TASK-FEAT-004: Implement Forfeit Feature

**Status:** [x] Complete  
**Priority:** Medium  
**Estimated Effort:** 45 minutes

### Goal
Allow player to forfeit game with confirmation.

### Scope

#### In Scope
- [x] Wire Forfeit button in game screen
- [x] Show confirmation dialog
- [x] On confirm: Set opponent as winner
- [x] Navigate to result screen
- [x] On cancel: Resume game

#### Out of Scope
- Draw offers
- Pause game

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not add draw functionality
- Do not add pause

### Expected Output

#### Deliverables
- [x] Modified `ui/game_screen.py`

#### Acceptance Criteria
- [x] Confirmation dialog appears
- [x] Forfeit ends game correctly
- [x] Cancel resumes game

### Dependencies
- Requires: TASK-FEAT-001

### Verification
- [x] Click forfeit, confirm, verify result

---

## TASK-FEAT-005: Implement Timer Logic

**Status:** [x] Complete  
**Priority:** Medium  
**Estimated Effort:** 1.5 hours

### Goal
Implement countdown timer for timed games.

### Scope

#### In Scope
- [x] Start timer on game start (if timed)
- [x] Decrement active player's time each second
- [x] Switch timer on turn change
- [x] Detect time expiry → game over
- [x] Hide timers for untimed games
- [x] Update TimerDisplay components

#### Out of Scope
- Increment/delay modes
- Time bonuses

### Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not add increment time
- Do not add time bonuses

### Expected Output

#### Deliverables
- [x] Modified `ui/game_screen.py`

#### Acceptance Criteria
- [x] Timers count down
- [x] Active timer highlighted
- [x] Time expiry ends game
- [x] Untimed games hide timers

### Dependencies
- Requires: TASK-FEAT-001, TASK-UI-003

### Verification
- [x] Start timed game, verify countdown
- [x] Let time expire, verify game over

---

*Last Updated: 2026-01-19*
