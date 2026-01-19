# DOMAIN.md - Domain Language

> **Priority Level:** MEDIUM-HIGH  
> Subordinate to RULES.md and ARCHITECTURE.md.

---

## Purpose

This document defines the canonical terminology for the Turkish Checkers (Dama) project. All code, documentation, comments, and user-facing text MUST use these terms consistently.

---

## Core Domain Concepts

### Game Entities

| Term | Definition | Notes |
|------|------------|-------|
| **Board** | 8x8 grid where the game is played | Always refers to the game grid |
| **Square** | Single cell on the board | Identified by (row, col) tuple |
| **Piece** | Game token that moves on the board | Either Man or King |
| **Man** | Regular piece with limited movement | Can only move forward and sideways |
| **King** | Promoted piece with extended movement | Can move in all 4 orthogonal directions |
| **Player** | Participant in the game | Either WHITE or BLACK |

### Game Actions

| Term | Definition | Notes |
|------|------------|-------|
| **Move** | Relocating a piece from one square to another | Includes start, end, and captures |
| **Capture** | Removing an opponent's piece by jumping over it | Mandatory when available |
| **Chain Capture** | Multiple consecutive captures in one turn | Must complete entire chain |
| **Promotion** | Converting a Man to King upon reaching the last row | Automatic |
| **Forfeit** | Voluntarily conceding the game | Player loses immediately |
| **Undo** | Reverting to a previous board state | Removes last move(s) |

### Game States

| Term | Definition | Notes |
|------|------------|-------|
| **Turn** | One player's opportunity to make a move | Alternates between players |
| **Game Over** | End condition reached | Win, loss, or draw |
| **Winner** | Player who won the game | Opponent has no moves or no pieces |

### AI Concepts

| Term | Definition | Notes |
|------|------------|-------|
| **Difficulty** | AI strength level | EASY, MEDIUM, HARD, GRANDMASTER |
| **Depth** | Minimax search depth | Higher = stronger AI |
| **Evaluation** | Numerical score of board position | Used by AI to choose moves |

### Game Modes

| Term | Definition | Notes |
|------|------------|-------|
| **AI Mode** | Human plays against computer | AI controls one side |
| **Local Mode** | Two humans on same device | No AI involvement |
| **Timed Game** | Match with countdown timer | Loss on time expiry |
| **Untimed Game** | Match without time limit | No timer displayed |

---

## Canonical Terminology

### MUST Use (Required)

| Canonical Term | Context |
|----------------|---------|
| `Player.WHITE` | The player with light-colored pieces |
| `Player.BLACK` | The player with dark-colored pieces |
| `PieceType.MAN` | Non-promoted piece |
| `PieceType.KING` | Promoted piece |
| `Difficulty.EASY` | Lowest AI level |
| `Difficulty.MEDIUM` | Standard AI level |
| `Difficulty.HARD` | Advanced AI level |
| `Difficulty.GRANDMASTER` | Highest AI level |
| `GameMode.AI` | Playing against computer |
| `GameMode.LOCAL` | Two-player local mode |

### MUST NOT Use (Banned Synonyms)

| Banned Term | Use Instead | Reason |
|-------------|-------------|--------|
| Checker | Piece | "Checker" is Western terminology |
| Token | Piece | Consistency |
| Pawn | Man | Chess terminology |
| Crowned | King | Clarity |
| RED/BLACK pieces | WHITE/BLACK | Color scheme consistency |
| Cell | Square | Consistency |
| Tile | Square | Consistency |
| Grid | Board | Board is the domain term |
| Jump | Capture | Capture is more precise |
| Eat | Capture | "Eat" is informal |
| Skip | — | Ambiguous, do not use |
| Computer | AI | AI is canonical |
| Bot | AI | Consistency |
| 1P/2P | AI/Local | Clarity |
| Resign | Forfeit | Consistency |
| Retreat | — | Not applicable in Turkish Draughts |

---

## Turkish Draughts Specific Rules

These rules distinguish Turkish Draughts from Western Checkers:

| Rule | Description |
|------|-------------|
| **Orthogonal Movement** | Pieces move horizontally and vertically only (no diagonals) |
| **Backward Restriction** | Man pieces CANNOT move backward |
| **Sideways Movement** | Man pieces CAN move sideways (left/right) |
| **All Squares Used** | All 64 squares are playable |
| **Starting Position** | Rows 2-3 for BLACK, Rows 6-7 for WHITE |
| **Mandatory Capture** | If capture is available, it MUST be taken |
| **Maximum Capture** | If multiple capture paths exist, longest chain is mandatory |

---

## Coordinate System

| Convention | Format | Example |
|------------|--------|---------|
| Internal | (row, col) tuple | (0, 0) = top-left |
| Display | Chess-style notation | A8, B7, etc. |
| Row Index | 0-7 (top to bottom) | Row 0 = top |
| Column Index | 0-7 (left to right) | Col 0 = left |

---

## UI Text Guidelines

### Button Labels
- "Play vs AI" (not "Play Computer")
- "Local Match" (not "2 Player")
- "Forfeit" (not "Resign" or "Give Up")
- "Undo" (not "Take Back")

### Status Messages
- "Your Turn" / "Opponent's Turn"
- "AI Thinking..." (not "Computer Thinking")
- "White Wins!" / "Black Wins!"
- "Time Expired" (for timed games)

---

*Last Updated: 2026-01-19*
