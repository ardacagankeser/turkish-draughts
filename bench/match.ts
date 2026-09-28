/**
 * Plays engine matches and prints the result as a Markdown table.
 *
 *   npm run bench -- --games 20 --time 200 --legacy-depth 3
 *   npm run bench -- --games 20 --level hard --vs-level medium
 *
 * Each opening (four random plies, seeded) is played twice with colours swapped.
 */
import { parseArgs } from 'node:util';
import { Game, moveToNotation } from '../src/engine';
import type { Move } from '../src/engine';
import { LEVEL_OPTIONS } from '../src/ai/levels';
import type { Level } from '../src/ai/levels';
import type { SearchOptions } from '../src/ai/search';
import { Searcher } from '../src/ai/search';
import { LegacyAi } from './legacy-ai';

interface Player {
  readonly name: string;
  choose(game: Game): Move | null;
  reset(): void;
}

function searcherPlayer(name: string, options: SearchOptions, seed: number): Player {
  let searcher = new Searcher(20);
  const random = mulberry32(seed);
  return {
    name,
    choose: (game) => searcher.search(game, { ...options, random }).move,
    reset: () => {
      searcher = new Searcher(20);
    },
  };
}

function legacyPlayer(depth: number): Player {
  const ai = new LegacyAi(depth);
  return { name: `legacy depth ${depth}`, choose: (game) => ai.chooseMove(game.board), reset() {} };
}

const MAX_PLIES = 400;

function playGame(white: Player, black: Player, opening: readonly string[]): 1 | 0 | -1 {
  const game = new Game();
  white.reset();
  black.reset();
  for (const move of opening) game.play(move);
  while (!game.isOver && game.history.length < MAX_PLIES) {
    const player = game.turn === 1 ? white : black;
    const move = player.choose(game);
    if (!move) break;
    game.play(move);
  }
  const winner = game.result?.winner ?? null;
  return winner === 1 ? 1 : winner === -1 ? -1 : 0;
}

function randomOpening(random: () => number, plies: number): string[] {
  const game = new Game();
  const moves: string[] = [];
  for (let i = 0; i < plies; i++) {
    const legal = game.legalMoves;
    const move = legal[Math.floor(random() * legal.length)];
    if (!move) break;
    moves.push(moveToNotation(move));
    game.play(move);
  }
  return moves;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Elo difference implied by a score fraction, clamped for 0% and 100%. */
function eloDiff(fraction: number): string {
  if (fraction >= 1) return '> +400';
  if (fraction <= 0) return '< −400';
  const elo = -400 * Math.log10(1 / fraction - 1);
  return `${elo >= 0 ? '+' : ''}${Math.round(elo)}`;
}

const { values } = parseArgs({
  options: {
    games: { type: 'string', default: '20' },
    time: { type: 'string' },
    level: { type: 'string' },
    'legacy-depth': { type: 'string' },
    'vs-level': { type: 'string' },
    seed: { type: 'string', default: '1' },
  },
});

const games = Number(values.games);
const seed = Number(values.seed);
const candidate: Player = values.level
  ? searcherPlayer(`new (${values.level})`, LEVEL_OPTIONS[values.level as Level], seed)
  : searcherPlayer(`new (${values.time ?? 200} ms)`, { timeMs: Number(values.time ?? 200) }, seed);
const opponent: Player = values['vs-level']
  ? searcherPlayer(
      `new (${values['vs-level']})`,
      LEVEL_OPTIONS[values['vs-level'] as Level],
      seed + 1,
    )
  : legacyPlayer(Number(values['legacy-depth'] ?? 3));

const random = mulberry32(seed);
let wins = 0;
let draws = 0;
let losses = 0;
const started = performance.now();
for (let i = 0; i < games; i += 2) {
  const opening = randomOpening(random, 4);
  for (const candidateIsWhite of [true, false]) {
    if (wins + draws + losses >= games) break;
    const result = candidateIsWhite
      ? playGame(candidate, opponent, opening)
      : -playGame(opponent, candidate, opening);
    if (result > 0) wins++;
    else if (result < 0) losses++;
    else draws++;
    process.stderr.write(`game ${wins + draws + losses}/${games}: +${wins} =${draws} -${losses}\n`);
  }
}

const played = wins + draws + losses;
const fraction = (wins + draws / 2) / played;
const minutes = ((performance.now() - started) / 60000).toFixed(1);
console.log(
  `| ${candidate.name} vs ${opponent.name} | ${played} | +${wins} =${draws} −${losses} | ${(fraction * 100).toFixed(1)}% | ${eloDiff(fraction)} | ${minutes} min |`,
);
