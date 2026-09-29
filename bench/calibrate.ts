/**
 * Fits the evaluation-to-winning-chance curve used by the evaluation bar.
 *
 *   npm run calibrate -- play --games 40 --seed 1 > samples-1.jsonl
 *   npm run calibrate -- fit samples-*.jsonl
 *
 * `play` runs engine self-play and prints one JSON line per position: the evaluation from
 * White's point of view and the game's final result for White (1, 0.5 or 0). `fit` finds the
 * k in `1 / (1 + e^(-k·score))` that best predicts the results (maximum likelihood), the
 * method lichess used for chess in lila#11148.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Game, moveToNotation } from '../src/engine';
import { Searcher, mateIn } from '../src/ai/search';

const MAX_PLIES = 300;
/** Skip the opening plies, which come from the random opening, not from the engines. */
const FIRST_PLY = 8;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function play(games: number, seed: number, timeMs: number): void {
  const random = mulberry32(seed);
  for (let g = 0; g < games; g++) {
    const game = new Game();
    // Four random plies, then two engines with a little randomness, for varied games.
    for (let i = 0; i < 4; i++) {
      const moves = game.legalMoves;
      const move = moves[Math.floor(random() * moves.length)];
      if (move) game.play(move);
    }
    const searchers = { 1: new Searcher(18), [-1]: new Searcher(18) };
    const samples: number[] = [];
    while (!game.isOver && game.history.length < MAX_PLIES) {
      const result = searchers[game.turn].search(game, { timeMs, randomMargin: 20, random });
      if (!result.move) break;
      if (game.history.length >= FIRST_PLY && mateIn(result.score) === null) {
        samples.push(game.turn === 1 ? result.score : -result.score);
      }
      game.play(result.move);
    }
    const winner = game.result?.winner ?? null;
    const outcome = winner === 1 ? 1 : winner === -1 ? 0 : 0.5;
    for (const score of samples) console.log(JSON.stringify({ score, outcome }));
    process.stderr.write(
      `game ${g + 1}/${games}: ${outcome} after ${game.history.length} plies ` +
        `(${game.history.slice(-1).map(moveToNotation).join('')})\n`,
    );
  }
}

interface Sample {
  readonly score: number;
  readonly outcome: number;
}

/** Mean cross-entropy of the predictions for `k` (lower is better). */
function loss(samples: readonly Sample[], k: number): number {
  let total = 0;
  for (const { score, outcome } of samples) {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, 1 / (1 + Math.exp(-k * score))));
    total -= outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p);
  }
  return total / samples.length;
}

function fit(files: readonly string[]): void {
  const samples: Sample[] = files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Sample),
  );
  // The loss is convex in k: golden-section search on a generous bracket.
  let lo = 0.0001;
  let hi = 0.05;
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 100; i++) {
    const a = hi - ratio * (hi - lo);
    const b = lo + ratio * (hi - lo);
    if (loss(samples, a) < loss(samples, b)) hi = b;
    else lo = a;
  }
  const k = (lo + hi) / 2;
  const games = new Set(samples.map((s) => s.outcome)).size;
  console.log(`samples: ${samples.length} (${games} distinct outcomes)`);
  console.log(`k = ${k.toFixed(5)}  (loss ${loss(samples, k).toFixed(4)})`);
  console.log(`lichess chess k = 0.00368 would give loss ${loss(samples, 0.00368).toFixed(4)}`);
  // Calibration table: predicted vs observed score by evaluation bucket.
  console.log('\n| Evaluation | Positions | Predicted | Observed |\n| --- | --- | --- | --- |');
  for (const [from, to] of [
    [-Infinity, -300],
    [-300, -150],
    [-150, -50],
    [-50, 50],
    [50, 150],
    [150, 300],
    [300, Infinity],
  ] as const) {
    const bucket = samples.filter((s) => s.score >= from && s.score < to);
    if (bucket.length === 0) continue;
    const observed = bucket.reduce((sum, s) => sum + s.outcome, 0) / bucket.length;
    const predicted =
      bucket.reduce((sum, s) => sum + 1 / (1 + Math.exp(-k * s.score)), 0) / bucket.length;
    const label = `${Number.isFinite(from) ? from : '−∞'} … ${Number.isFinite(to) ? to : '+∞'}`;
    console.log(
      `| ${label} | ${bucket.length} | ${(predicted * 100).toFixed(1)}% | ${(observed * 100).toFixed(1)}% |`,
    );
  }
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'play') {
  const { values } = parseArgs({
    args: rest,
    options: {
      games: { type: 'string', default: '20' },
      seed: { type: 'string', default: '1' },
      time: { type: 'string', default: '60' },
    },
  });
  play(Number(values.games), Number(values.seed), Number(values.time));
} else if (command === 'fit') {
  fit(rest);
} else {
  console.error(
    'usage: calibrate play [--games n] [--seed s] [--time ms] | calibrate fit <files…>',
  );
  process.exit(1);
}
