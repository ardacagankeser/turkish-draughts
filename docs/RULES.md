# Turkish Draughts — Rules Specification

This document is the source of truth for the rules engine. Every rule below must be covered by a test.
Items marked **(convention)** are choices this project makes where traditional play varies.

## Board and setup

- 8×8 board; all 64 squares are used.
- Each side has 16 men. White occupies ranks 2–3, Black occupies ranks 6–7. Ranks 1 and 8 start empty.
- White moves first.

## Movement

- **Man:** moves one square straight forward or sideways onto an empty square. Never backward, never diagonally.
- **King:** moves any number of empty squares along a rank or file ("flying king"). Never diagonally.

## Capturing

- A **man** captures by jumping over an adjacent enemy piece, forward or sideways,
  onto the empty square directly beyond it. Men never capture backward.
- A **king** captures by jumping over a single enemy piece on the same rank or file, with any number
  of empty squares before it, and landing on any empty square beyond it.
- A capture may continue with further jumps by the same piece in the same turn (a chain).
- Captured pieces are **removed immediately** as they are jumped. A piece therefore cannot be jumped twice,
  and a removed piece can open a line for a later jump in the same chain.
- A king may not turn 180° between two consecutive jumps of a chain.
- **Capturing is mandatory.**
- **Maximum capture rule:** the player must choose a chain that captures the greatest possible number of
  pieces. Men and kings count equally. Among equally long chains, the player chooses freely.

## Promotion

- A man that ends its move on the far rank (rank 8 for White, rank 1 for Black) becomes a king.
- **Open question:** behaviour when a man reaches the far rank in the middle of a capture chain.
  To be confirmed against the Turkish Draughts Federation rules before Phase 1 is complete.

## End of game

- A player **loses** when they have no pieces left, or no legal move on their turn.
- **Draw — insufficient material:** one king against one king.
- **Draw — repetition (convention):** the same position with the same side to move occurs for the third time.
- **Draw — no progress (convention):** 50 consecutive moves per side without a capture or a man move.
- A player may resign at any time. In timed games, a player whose clock reaches zero loses.

## Notation (convention)

Squares are named like chess: files `a`–`h` from White's left, ranks `1`–`8` from White's side.
A quiet move is written `d3-d4`; a capture chain lists every landing square, e.g. `d4xd6xf6`.
