# The computer opponent

The AI lives in [`src/ai`](../src/ai) and depends only on the rules engine. It runs in a Web Worker,
so the board stays responsive while it thinks.

## Search

[`search.ts`](../src/ai/search.ts) implements a classic game-tree search:

- **Negamax with alpha-beta pruning** and **principal variation search**: after the first move, each
  move is first tested with a null window and only re-searched if it might be better.
- **Iterative deepening** to a time budget. Depth 1 always completes, so there is always a move.
  An iteration that runs out of time is discarded, and the board is rolled back to the root.
  The next iteration is skipped if less than about half the budget remains.
- **Quiescence**: captures are mandatory, so the search never stops in a position where a capture is
  pending. It follows capture sequences to the end and only evaluates quiet positions.
- **Single-reply extension**: a position with only one legal move costs no depth.
- **Transposition table** ([`tt.ts`](../src/ai/tt.ts)): 2²⁰ entries in flat typed arrays, keyed by a
  64-bit **Zobrist hash** split into two 32-bit halves ([`zobrist.ts`](../src/ai/zobrist.ts)) and
  updated incrementally on make/unmake. Mate scores are stored relative to the node.
- **Move ordering**: table move first, then promotions, two killer moves per ply, and the history
  heuristic.
- **Draw awareness**: a repetition on the search path, one piece each, or 100 plies without
  progress score 0, matching [docs/RULES.md](RULES.md).

## Evaluation

[`evaluate.ts`](../src/ai/evaluate.ts) is deliberately small, because the search does most of the work:

| Term                                                       | Value                                      |
| ---------------------------------------------------------- | ------------------------------------------ |
| Man                                                        | 100                                        |
| King                                                       | 330                                        |
| Man advancement, by ranks from its own back rank           | 0, 0, 2, 6, 12, 22, 40                     |
| Man one step from promotion with the promotion square free | +35                                        |
| Trading down when ahead                                    | the lead × (32 − pieces on the board) / 64 |

Scores are from the side to move's point of view. A test checks that the evaluation is symmetric:
mirroring the board and swapping the sides gives the same score.

## Levels

| Level    | Depth limit | Time per move | Random margin |
| -------- | ----------- | ------------- | ------------- |
| Beginner | 1           | 0.3 s         | 150           |
| Easy     | 3           | 0.5 s         | 50            |
| Medium   | 6           | 1 s           | 15            |
| Hard     | —           | 1.5 s         | 0             |
| Expert   | —           | 4 s           | 0             |

The random margin weakens the lower levels. The AI searches every root move with a full window and
picks at random among those scoring within the margin of the best, so its mistakes look human
rather than random.

**Draw offers**: the AI searches the position without randomness and accepts unless it is clearly
better, by 25 points (a quarter of a man) or more.

## Benchmarks

`npm run bench` plays engine matches. Each random 4-ply opening is played twice with colours swapped.
[`bench/legacy-ai.ts`](../bench/legacy-ai.ts) is a faithful port of the original Python AI: plain
fixed-depth alpha-beta with its original evaluation. It runs on the new, correct rules engine, so the
comparison measures search and evaluation, not rule bugs.

Results (Node.js 24 on a 12-thread laptop; W/D/L from the first player's side):

| Match                                                | Games | Result    | Score | Elo difference |
| ---------------------------------------------------- | ----- | --------- | ----- | -------------- |
| New, 0.2 s per move vs legacy depth 3 (old "Medium") | 40    | +36 =4 −0 | 95.0% | +512           |
| New, 0.2 s per move vs legacy depth 5 (old "Hard")   | 20    | +19 =1 −0 | 97.5% | +636           |
| Easy vs Beginner                                     | 20    | +20 =0 −0 | 100%  | > +400         |
| Medium vs Easy                                       | 20    | +19 =1 −0 | 97.5% | +636           |
| Hard vs Medium                                       | 20    | +17 =1 −2 | 87.5% | +338           |

Elo differences from small samples are rough; they show the direction and the order of magnitude.

Speed: about 200–250 thousand nodes per second in Node.js on a laptop. That reaches depth 8 from the
opening in one second. The legacy Python engine needed 27 seconds for depth 5 in the middlegame.

Reproduce:

```bash
npm run bench -- --games 40 --time 200 --legacy-depth 3
npm run bench -- --games 20 --level hard --vs-level medium
```
