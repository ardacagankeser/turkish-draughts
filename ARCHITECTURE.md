# ARCHITECTURE.md - System Architecture

> **Priority Level:** HIGH  
> Subordinate to RULES.md only.

---

## Architectural Style

This project follows a **Layered Architecture** with clear separation between:

1. **Presentation Layer** (UI)
2. **Application Layer** (State Management)
3. **Domain Layer** (Game Logic)

```
┌─────────────────────────────────────────┐
│           PRESENTATION (ui/)            │
│  Flet screens, components, user input   │
├─────────────────────────────────────────┤
│           APPLICATION (game/state.py)   │
│  Game state, timers, history, events    │
├─────────────────────────────────────────┤
│           DOMAIN (game/board.py, ai.py) │
│  Turkish Draughts rules, AI algorithm   │
└─────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Presentation Layer (`ui/`)
**Purpose:** User interface rendering and input handling

**Responsibilities:**
- Render screens (menu, game, result)
- Capture user interactions (clicks, selections)
- Display game state visually
- Manage animations and transitions
- Route between screens

**Allowed Dependencies:**
- Application Layer
- `flet` library

**Prohibited:**
- Direct access to Domain Layer logic
- Game rule calculations
- AI move computation

---

### Application Layer (`game/state.py`)
**Purpose:** Coordinate game flow and manage state

**Responsibilities:**
- Maintain current game state
- Manage player timers
- Track move history
- Handle undo operations
- Coordinate AI turns
- Emit events for UI updates

**Allowed Dependencies:**
- Domain Layer

**Prohibited:**
- UI rendering
- Direct Flet widget manipulation
- Pygame or other UI library calls

---

### Domain Layer (`game/board.py`, `game/ai.py`)
**Purpose:** Pure game logic and AI algorithms

**Responsibilities:**
- Turkish Draughts rule enforcement
- Move validation
- Capture detection (mandatory captures, chains)
- King promotion logic
- AI move calculation (minimax, evaluation)

**Allowed Dependencies:**
- Python standard library only
- `game/types.py` (shared types)

**Prohibited:**
- Any UI framework imports
- State management logic
- Timer logic
- External I/O operations

---

## Dependency Direction

```
UI ──depends on──► Application ──depends on──► Domain
```

- **Allowed:** Upper layers depend on lower layers
- **Prohibited:** Lower layers depend on upper layers
- **Prohibited:** Circular dependencies

---

## Entry Points

| Entry Point | Location | Purpose |
|-------------|----------|---------|
| Application Start | `main.py` | Initialize Flet app, load menu screen |
| Game Start | `ui/game_screen.py` | Initialize game state, begin play |

---

## Module Boundaries

### `game/` Module
- Self-contained game logic
- MUST be testable without Flet
- MUST NOT import from `ui/`

### `ui/` Module
- All Flet-specific code
- MAY import from `game/`
- Screens are independent units

---

## Architectural Prohibitions

The following are explicitly NOT allowed:

1. **God Objects**: No single class managing everything
2. **UI Logic in Domain**: Game rules must not reference UI
3. **Direct Pygame Usage**: Legacy Pygame code must be fully removed
4. **Global Mutable State**: State must flow through GameState
5. **Hardcoded Values**: Use `game/types.py` for enums and constants
6. **Mixed Responsibilities**: Each module has one purpose

---

## Extension Points

Future features should integrate at these points:

| Feature Type | Integration Point |
|--------------|-------------------|
| New Game Modes | `game/types.py` → `GameMode` enum |
| New Difficulty | `game/types.py` → `Difficulty` enum |
| New UI Screens | `ui/` → new screen file |
| Persistence | `game/state.py` → save/load methods |
| Sound Effects | `ui/` → audio manager component |

---

*Last Updated: 2026-01-19*
