# STYLEGUIDE.md - Code Style Guide

> **Priority Level:** MEDIUM  
> Subordinate to RULES.md, ARCHITECTURE.md, and DOMAIN.md.

---

## Python Version

- **Minimum:** Python 3.10+
- **Reason:** Type hints, match statements, modern features

---

## Folder and File Structure

### Root Layout
```
dama/
├── main.py              # Application entry point
├── requirements.txt     # Dependencies
├── RULES.md             # Governance rules
├── ARCHITECTURE.md      # System architecture
├── DOMAIN.md            # Domain terminology
├── STYLEGUIDE.md        # This document
├── TASK_TEMPLATE.md     # Task format
├── game/                # Domain & Application layer
│   ├── __init__.py
│   ├── types.py         # Enums, dataclasses
│   ├── board.py         # TurkishDraughts class
│   ├── ai.py            # TurkishDraughtsAI class
│   └── state.py         # GameState management
├── ui/                  # Presentation layer
│   ├── __init__.py
│   ├── theme.py         # Colors, fonts, constants
│   ├── menu_screen.py   # Main menu
│   ├── game_screen.py   # Gameplay screen
│   ├── result_screen.py # End-game screen
│   └── components/      # Reusable UI widgets
│       ├── __init__.py
│       ├── board_view.py
│       ├── timer.py
│       ├── move_history.py
│       └── captured.py
└── assets/              # Static resources (optional)
```

### Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Folders | `snake_case` | `game/`, `ui/components/` |
| Python files | `snake_case.py` | `game_screen.py` |
| Classes | `PascalCase` | `TurkishDraughts`, `GameState` |
| Functions | `snake_case` | `get_valid_moves()` |
| Constants | `UPPER_SNAKE_CASE` | `BOARD_SIZE = 8` |
| Enums | `PascalCase` class, `UPPER_CASE` members | `Player.WHITE` |
| Private | Leading underscore | `_calculate_score()` |

---

## File Responsibilities

### Single Responsibility Rule
Each file should have **one primary responsibility**:

| File | Responsibility |
|------|----------------|
| `types.py` | Type definitions only |
| `board.py` | Game rules and board state |
| `ai.py` | AI algorithm only |
| `state.py` | State coordination |
| `theme.py` | Visual constants only |
| Screen files | One screen each |
| Component files | One widget each |

### File Size Limits

| File Type | Recommended | Maximum |
|-----------|-------------|---------|
| Type definitions | < 100 lines | 150 lines |
| Logic modules | < 300 lines | 500 lines |
| UI screens | < 400 lines | 600 lines |
| UI components | < 200 lines | 300 lines |

If limits are exceeded, refactor into smaller modules.

---

## Import Rules

### Import Order
1. Standard library imports
2. Third-party imports (flet)
3. Local application imports

### Import Style
```python
# Standard library
from enum import Enum
from dataclasses import dataclass
from typing import List, Optional, Tuple

# Third-party
import flet as ft

# Local imports
from game.types import Player, PieceType, Move
from game.board import TurkishDraughts
```

### Prohibited Import Patterns
- `from module import *` (wildcard imports)
- Circular imports
- UI imports in `game/` module
- `game/` imports of `flet`

---

## Type Hints

### Required For
- All function parameters
- All function return types
- Class attributes

### Example
```python
def get_valid_moves(self, row: int, col: int) -> List[Move]:
    """Return valid moves for piece at position."""
    ...

def make_move(self, move: Move) -> bool:
    """Execute move, return success status."""
    ...
```

---

## Documentation

### Docstrings
- All public classes: class-level docstring
- All public methods: one-line or multi-line docstring
- Complex logic: inline comments

### Docstring Format
```python
def get_capture_moves(self, row: int, col: int) -> List[Move]:
    """
    Find all capture moves for piece at given position.
    
    Args:
        row: Board row (0-7)
        col: Board column (0-7)
    
    Returns:
        List of Move objects representing valid captures.
        Empty list if no captures available.
    """
```

### Comment Philosophy
- **Why, not What**: Explain reasoning, not obvious code
- **Domain Context**: Reference game rules when relevant
- **Avoid Noise**: No comments like `# increment counter`

---

## Structural vs Behavioral Changes

### Structural Changes (Require Architecture Review)
- Adding new modules or packages
- Changing dependency direction
- Adding new layers
- Modifying public interfaces
- Renaming classes or modules

### Behavioral Changes (Within Task Scope)
- Bug fixes
- Performance improvements
- Adding methods to existing classes
- UI styling adjustments
- New private helper functions

---

## Flet-Specific Guidelines

### Control Naming
```python
# Use descriptive names for refs
self.difficulty_selector = ft.Dropdown(...)
self.start_button = ft.ElevatedButton(...)
self.board_grid = ft.GridView(...)
```

### Event Handlers
```python
# Name pattern: on_<action>_<target>
def on_click_start(self, e):
    ...

def on_change_difficulty(self, e):
    ...
```

### Theme Usage
```python
# Always use theme constants, never hardcode
from ui.theme import COLORS

container = ft.Container(
    bgcolor=COLORS["surface"],
    border=ft.border.all(1, COLORS["glass_border"]),
)
```

---

## Error Handling

### Required
- Validate user input
- Handle AI computation failures gracefully
- Provide user feedback for errors

### Prohibited
- Silent exception swallowing
- Generic `except:` clauses
- Crashing on invalid moves

---

*Last Updated: 2026-01-19*
