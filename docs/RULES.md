# Turkish Draughts — Rules Specification

This document is the source of truth for the rules engine in [`src/engine`](../src/engine).
It follows the rules published by the Turkish Draughts Federation (TÜDAF):
[_Türk Daması Kuralları_](https://turkdamasi.org.tr/wp-content/uploads/2022/11/Turk_Damasi_Kurallari_Tudaf_v3.pdf)
by Atila Zeybek. The ten worked examples in that document are reproduced as tests in
[`tudaf-examples.test.ts`](../src/engine/tudaf-examples.test.ts).

Items marked **(convention)** are choices this project makes where the federation rules are silent.

## Board and setup

- 8×8 board; all 64 squares are used.
- Each side has 16 men. White occupies ranks 2–3, Black occupies ranks 6–7. Ranks 1 and 8 start empty.
- White moves first **(convention; the TÜDAF text does not say)**.

## Movement

- **Man (yoz):** moves one square straight forward or sideways onto an empty square. Never backward, never diagonally.
- **King (dama):** moves any number of empty squares along a rank or file ("flying king"). Never diagonally.

## Capturing

- A **man** captures by jumping over an adjacent enemy piece, forward or sideways,
  onto the empty square directly beyond it. Men never capture backward.
- A **king** captures by jumping over a single enemy piece on the same rank or file, with any number
  of empty squares before it, and landing on any empty square beyond it. Chains of king captures
  can therefore turn corners ("L" moves, TÜDAF example 3).
- A capture continues with further jumps by the same piece in the same turn (a chain).
- Captured pieces are **removed immediately** as they are jumped. A piece therefore cannot be jumped twice,
  and a removed piece can open a line for a later jump in the same chain (TÜDAF example 3).
- A king may not turn 180° between two consecutive jumps of a chain (TÜDAF example 4).
- **Capturing is mandatory** (TÜDAF rule 1).
- **Maximum capture rule:** the player must choose a chain that captures the greatest possible number of
  pieces, across all of their pieces. Men and kings count equally, both as capturers and as victims.
  Among equally long chains, the player chooses freely (TÜDAF rules 2–3, examples 1, 2, 8–10).

## Promotion

- A man that ends its move on the far rank (rank 8 for White, rank 1 for Black) becomes a king.
- A man that reaches the far rank **by capturing** continues the chain **as a man** (sideways) if it can,
  and is promoted only when the move is over (TÜDAF rule 5, examples 5 and 7).
- A man that reaches the far rank **without capturing** ends its move there, even if an enemy piece
  stands next to it (TÜDAF rule 5, example 6).

## End of game

- A player **loses** when they have no pieces left, or no legal move on their turn.
- A player may resign at any time. In timed games, a player whose clock reaches zero loses.
- **Draw — one piece each:** each side has exactly one piece left, whatever its kind.
- **Draw — repetition:** the same position with the same side to move occurs for the third time.
- **Draw — no progress (convention):** 50 consecutive moves per side (100 plies) without a capture or
  a man move. This stops games against the computer from going on forever.

## Notation (convention)

Squares are named like chess: files `a`–`h` from White's left, ranks `1`–`8` from White's side.
A quiet move is written `d3-d4`. A capture lists the start square and every landing square,
e.g. `f3xf5xd5`. (The TÜDAF text names the captured square instead, e.g. `e5xf5`.)

Positions use the draughts FEN convention: side to move, then each side's pieces with `K` for kings,
e.g. `W:Wa2,b2,Kc4:Bd6,Ke8`.
