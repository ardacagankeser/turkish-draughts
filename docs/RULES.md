# Turkish Draughts — Rules Specification

This document is the source of truth for the rules engine in [`src/engine`](../src/engine).
Every rule links to its source. Where no source decides a case, the reasoning is written down.

## Sources

In order of authority:

1. **TÜDAF rulebook (TR, v3)**: [_Türk Daması Kuralları_](https://turkdamasi.org.tr/wp-content/uploads/2022/11/Turk_Damasi_Kurallari_Tudaf_v3.pdf),
   Atila Zeybek, Turkish Draughts Federation. Cited below as **R** (rules) and **Ex** (examples).
2. **TÜDAF rulebook (EN, v4.0)**: [_Turkish Draughts Rules_](https://turkdamasi.org.tr/wp-content/uploads/2022/11/Turkish_Checkers_Rules_Tudaf.pdf).
3. **TÜDAF tournament rules 2024**: [_Turnuva Kuralları 2024_](https://turkdamasi.org.tr/turk-damasi-turnuva-kurallari-2024/). Cited as **T**.
4. [Wikipedia: Turkish draughts](https://en.wikipedia.org/wiki/Turkish_draughts), used only where TÜDAF is silent.

All ten worked examples of the rulebook are tests in
[`tudaf-examples.test.ts`](../src/engine/tudaf-examples.test.ts). Each position is transcribed square
by square, and the expected notation is copied verbatim from the English edition. Cases the book does
not illustrate are tested in [`edge-cases.test.ts`](../src/engine/edge-cases.test.ts).

## Board and setup

- 8×8 board; all 64 squares are used.
- Each side has 16 men. White on ranks 2–3, Black on ranks 6–7; ranks 1, 4, 5 and 8 are empty (EN).
- **White moves first.** Wikipedia says so explicitly; TÜDAF does not. It is consistent with **T 1f**
  ("siyahlar saatleri çalıştırabilir"): as in chess, Black starts the clock so White's time runs first.

## Movement

- **Man (yoz):** one square forward, left or right onto an empty square. Never backward, never diagonally.
- **King (dama):** any number of empty squares along a rank or file. Never diagonally.
  Its path only turns corners ("L" moves) while capturing.

## Capturing

- A **man** captures forward, left or right by jumping an adjacent enemy piece onto the empty
  square directly beyond. Never backward.
- A **king** captures along a rank or file: it may start any distance from the enemy piece, jumps it,
  and may land on **any** empty square beyond it. This is the "flying king" of the EN edition
  ("multiple squares movement"), also stated by Wikipedia. Every example in the book is consistent with it.
- A chain continues with the same piece while captures are available. It must be completed (**R 1**)
  and cannot stop part-way (**T 5o**).
- Captured pieces are **removed immediately**. This is not stated in words, but **Ex 3** requires it:
  the king passes over e2 again after having captured it. So a piece cannot be jumped twice, and a
  captured piece can open a line later in the same chain.
- A king may not turn 180° between **consecutive** jumps, vertically or horizontally (**Ex 4**, EN:
  "left jumping can not be followed by the right jumping"). A U-turn spread over two corners is
  allowed (**Ex 3**: north, west, then south).
- The moving piece is lifted off its square, so a king's chain may cross or finish on its own starting square.
- **Capturing is mandatory**, and the chain that captures the **most pieces** is mandatory, counted across
  all of the player's pieces. Men and kings count equally, both as capturers and as victims (**R 2–3**,
  **Ex 1, 2, 8, 9, 10**). This holds even if the capturing king is lost straight after (**Ex 10**).
  Among equally long chains the player chooses freely (**R 2**, **Ex 8**).
- Chains that capture the same pieces and end on the same square give the same position. The engine
  treats them as a single move (**Ex 3** gives two such routes).

## Promotion

- A man that reaches the far rank (8 for White, 1 for Black) becomes a king (**R**, "Normal Taşların Hamleleri").
- **By capture:** the man continues the chain **as a man** (sideways along the far rank) if it can, and
  is promoted when the move ends. It cannot capture like a king on that move (**R 5**, **T 1h**, **Ex 5, 7**).
  - The TR edition says it continues "if a piece is adjacent"; the EN edition and **T 1h** say "if an
    enemy king is adjacent". These agree: Black's men start on ranks 6–7 and never move backward,
    so any enemy piece on White's far rank is a king (and vice versa).
- **Without capture:** the man stops on the far rank even if an enemy piece is next to it (**R 5**, **Ex 6**).
- **R 5** says the piece "becomes a king after the opponent's move". This is equivalent to promoting
  at the end of the move: during the opponent's turn the piece does not move, and the maximum-capture
  rule counts men and kings equally, so its status cannot change any legal move.

## End of game

- **Win:** the opponent has no pieces left, or cannot move on their turn (**R**, "Galibiyet").
- **Win:** the opponent resigns (**R**, "Galibiyet").
- **Win on time:** a player whose clock runs out loses, whatever the position (**T 1g**).
- **Draw — one piece each:** each side has exactly one piece, of any kind (**R**, "Beraberlik"). Applied
  literally and immediately, even if the side to move could capture.
- **Draw — repetition:** the same position occurs for the third time (**R**, **T 4g**). "Same position"
  includes the side to move, as in chess.
- **Draw — agreement:** both players agree (**R**, **T 5i**). A player may offer a draw at most
  **2 times per game** (**T 3g**). Against the computer, the AI accepts when its evaluation of the
  position is not better than a draw for itself.
- **Draw — no progress (project rule):** 100 plies (50 moves each) without a capture or a man move.
  TÜDAF leaves this to the arbiter: "no progress" (**T 3g, 4g**) or "neither side can win by normal
  means" (**T 4f**). Without an arbiter, this fixed limit stands in for that judgement.

## Rules for the physical board

- **Touch-move (R 4)** — a lifted piece must be played — is **not enforced**. Selecting a piece on
  screen is not lifting it; the move is final when the piece is dropped on a square.
- **Announcing captures (T 5l, 5o)** — declaring how many pieces you will take and where you will land —
  is handled by the UI. The player chooses the full chain before it is played.
- **Courtesy rules** ("Dama altı", "DAMA!") are optional (**R**, "Nezaket Kuralları"). The UI may show them.
- **Folk rules not in TÜDAF's rules**, such as "the last three pieces become kings", do not apply. The
  federation lists that one as a common misconception.

## Notation

Squares are named like chess: files `a`–`h` from White's left, ranks `1`–`8` from White's side.

- **TÜDAF notation (shown to players):** the start square, then every captured square: `f3xf4xe5xd6xc7`.
  After a king's last capture this does not say where it stopped, so when several landing squares are
  legal the landing square is added: `h1xh6→h8`. Quiet moves are written `d3-d4`.
- **Landing notation (stored, unambiguous):** the start square, then every landing square: `f3xf5xd5xd7xb7`.
  Used internally, in tests and as input.

Positions use the draughts FEN convention: side to move, then each side's pieces with `K` for kings,
e.g. `W:Wa2,b2,Kc4:Bd6,Ke8`. A man on its own promotion rank is rejected as an impossible position.
