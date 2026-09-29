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

## Endgame tablebase

Every position with three pieces (two against one) is solved exactly by retrograde analysis in
[`tools/generate-tablebase.ts`](../tools/generate-tablebase.ts), about 40 seconds with `npm run tablebase`.
The result is [`public/tablebase/3pieces.bin.gz`](../public/tablebase/3pieces.bin.gz), 205 KB compressed.
It stores win, loss or draw and the exact distance in plies for 3.1 million positions.

The worker loads it in the background. From then on the search stops at any three-piece position
with the exact result, so these endgames are played perfectly. [`tools/tablebase.test.ts`](../tools/tablebase.test.ts)
checks the committed file two ways:

- **It is a fixpoint.** 30,000 random entries each equal the value implied by their successors.
- **It agrees with a plain search that does not use the table.** On random positions, short wins
  and losses have exactly the same distance, and draws never show a forced result.

What the tables say:

| Signature | To move | Positions | Win   | Draw  | Loss  | Longest win (plies) |
| --------- | ------- | --------- | ----- | ----- | ----- | ------------------- |
| KK-K      | White   | 124,992   | 30.6% | 69.4% | 0.0%  | 5                   |
| KK-K      | Black   | 124,992   | 8.0%  | 91.8% | 0.2%  | 1                   |
| KK-M      | White   | 109,368   | 97.9% | 2.1%  | 0.0%  | 9                   |
| KK-M      | Black   | 109,368   | 0.2%  | 20.0% | 79.8% | 1                   |
| KM-K      | White   | 218,736   | 19.3% | 80.7% | 0.0%  | 5                   |
| KM-K      | Black   | 218,736   | 8.4%  | 91.6% | 0.0%  | 1                   |
| KM-M      | White   | 191,456   | 96.5% | 3.5%  | 0.0%  | 25                  |
| KM-M      | Black   | 191,456   | 0.2%  | 22.3% | 77.4% | 1                   |
| MM-K      | White   | 95,480    | 7.3%  | 92.7% | 0.0%  | 1                   |
| MM-K      | Black   | 95,480    | 8.9%  | 91.1% | 0.0%  | 1                   |
| MM-M      | White   | 83,600    | 70.4% | 29.6% | 0.0%  | 37                  |
| MM-M      | Black   | 83,600    | 0.3%  | 48.5% | 51.3% | 1                   |

K = king, M = man; White has the two pieces. The rows for one against two follow by symmetry.

- **Two kings cannot force a win against a lone king.** They only win through an immediate tactic,
  within 5 plies. Otherwise the lone king always escapes along an open line. The same holds for a king and a man.
- **Against a lone man, a king makes the win almost certain** (96–98%). Two men against a man win
  70% of the time, sometimes only after 37 plies.

The tablebase ignores the 100-ply no-progress rule. None of its wins comes close to that length.

## Evaluation bar and winning chances

The bar beside the board shows the winning chance, not the raw score. A second worker
([`analysis.ts`](../src/ai/analysis.ts)) analyses the displayed position one depth at a time and
reports each depth, from White's point of view. A running search cannot be interrupted from outside:
that would need a `SharedArrayBuffer`, which requires cross-origin isolation headers that GitHub Pages
cannot send. So the analysis yields to the event loop between depths and stops as soon as a newer
position is requested. The transposition table makes each restart cheap.

The curve has the same shape as lichess's: `w(s) = 2 / (1 + e^(−k·s)) − 1`
([lila#11148](https://github.com/lichess-org/lila/pull/11148)). The constant `k` was fitted for Turkish
draughts with [`bench/calibrate.ts`](../bench/calibrate.ts):

- **Data:** 240 self-play games (60 ms per move, a small random margin, random 4-ply openings) gave
  33,004 positions. Each is labelled with the game's final result.
- **Fit:** `k` maximises the likelihood of the results, **k = 0.0040**, against 0.00368 for chess. A
  one-man lead (+1.0) means about a 60% expected score for the side ahead.

| Evaluation (White) | Positions | Predicted | Observed |
| ------------------ | --------- | --------- | -------- |
| below −3.0         | 5,471     | 11.3%     | 12.6%    |
| −3.0 to −1.5       | 2,330     | 29.3%     | 31.1%    |
| −1.5 to −0.5       | 2,470     | 38.5%     | 37.3%    |
| −0.5 to +0.5       | 8,707     | 50.2%     | 55.8%    |
| +0.5 to +1.5       | 3,132     | 61.2%     | 60.2%    |
| +1.5 to +3.0       | 2,681     | 70.5%     | 74.3%    |
| above +3.0         | 8,213     | 90.5%     | 90.0%    |

The data also shows a **first-move advantage**: White won 112 games, drew 55 and lost 73, and scores
55.8% in positions the evaluation calls equal. The evaluation does not model this yet (see #7).

```bash
npm run calibrate -- play --games 30 --seed 1 > samples-1.jsonl   # repeat with other seeds in parallel
npm run calibrate -- fit samples-*.jsonl
```

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
