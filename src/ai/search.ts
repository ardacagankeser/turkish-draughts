import type { Board, Game, Move } from '../engine';
import { BLACK, NO_PROGRESS_LIMIT, WHITE, generateMoves, isKing } from '../engine';
import { evaluate } from './evaluate';
import { EXACT, LOWER, TranspositionTable, UPPER } from './tt';
import type { Hash } from './zobrist';
import { hashBoard, moveDelta } from './zobrist';

/** Score of a won position at the root; a win in `n` plies scores `MATE - n`. */
export const MATE = 100_000;
const INFINITY = 1_000_000;
const MAX_PLY = 128;
/** Scores this close to MATE are wins or losses, not evaluations. */
const MATE_BOUND = MATE - MAX_PLY;

export interface SearchOptions {
  /** Deepest iteration to run. Default: no limit other than time. */
  readonly maxDepth?: number;
  /** Time budget in milliseconds. Default: unlimited (then `maxDepth` must be set). */
  readonly timeMs?: number;
  /**
   * Pick randomly among root moves scoring within this many points of the best.
   * 0 (default) always plays the best move. Used to weaken the easier levels.
   */
  readonly randomMargin?: number;
  /** Random source for `randomMargin`; defaults to `Math.random`. */
  readonly random?: () => number;
}

export interface SearchResult {
  /** The chosen move, or `null` if the game is already over. */
  readonly move: Move | null;
  /** Evaluation from the point of view of the side to move. */
  readonly score: number;
  /** Deepest completed iteration. */
  readonly depth: number;
  readonly nodes: number;
  readonly timeMs: number;
  /** Principal variation, starting with `move`. */
  readonly pv: readonly Move[];
}

class SearchAborted extends Error {}

/** Converts a score to "moves to mate" for display, or `null` for a normal evaluation. */
export function mateIn(score: number): number | null {
  if (Math.abs(score) < MATE_BOUND) return null;
  const plies = MATE - Math.abs(score);
  return Math.sign(score) * Math.ceil(plies / 2);
}

/**
 * Negamax alpha-beta search with iterative deepening. One `Searcher` keeps its
 * transposition table between searches, which is what a game-long AI wants.
 */
export class Searcher {
  readonly tt: TranspositionTable;

  #board!: Board;
  #hash: Hash = { hi: 0, lo: 0 };
  // Per-position stacks, indexed by game ply (game history followed by the search path).
  #hashHi = new Int32Array(1024 + MAX_PLY);
  #hashLo = new Int32Array(1024 + MAX_PLY);
  #quiet = new Int32Array(1024 + MAX_PLY);
  #root = 0;
  #whitePieces = 0;
  #blackPieces = 0;
  // Moves currently made on the board, so an aborted search can be rolled back.
  #path: Move[] = [];
  #made = 0;
  #deltas: Hash[] = Array.from({ length: MAX_PLY }, () => ({ hi: 0, lo: 0 }));
  #killers = new Int32Array(MAX_PLY * 2);
  #history = new Int32Array(64 * 64);
  #nodes = 0;
  #deadline = Infinity;
  #canAbort = false;

  constructor(ttBits = 20) {
    this.tt = new TranspositionTable(ttBits);
  }

  search(game: Game, options: SearchOptions = {}): SearchResult {
    const started = now();
    const maxDepth = Math.min(options.maxDepth ?? MAX_PLY - 1, MAX_PLY - 1);
    const timeMs = options.timeMs ?? Infinity;
    if (timeMs === Infinity && options.maxDepth === undefined) {
      throw new Error('Set a time limit or a maximum depth');
    }
    this.#prepare(game);
    this.#deadline = started + timeMs;
    this.#canAbort = false;
    this.#nodes = 0;

    const rootMoves = game.isOver ? [] : generateMoves(this.#board);
    if (rootMoves.length === 0) {
      return { move: null, score: 0, depth: 0, nodes: 0, timeMs: 0, pv: [] };
    }

    const margin = options.randomMargin ?? 0;
    let order = rootMoves.map((_, i) => i);
    let best = { index: 0, score: 0, depth: 0, scores: [] as number[] };

    for (let depth = 1; depth <= maxDepth; depth++) {
      try {
        const scores = this.#searchRoot(rootMoves, order, depth, margin > 0);
        order = [...order].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
        const index = order[0] ?? 0;
        best = { index, score: scores[index] ?? 0, depth, scores };
      } catch (error) {
        if (!(error instanceof SearchAborted)) throw error;
        while (this.#made > 0) {
          const ply = this.#made - 1;
          const move = this.#path[ply];
          if (move) this.#unmake(move, ply);
          else this.#made = ply;
        }
        break;
      }
      // Depth 1 always completes, so there is always a move to play.
      this.#canAbort = true;
      const elapsed = now() - started;
      if (Math.abs(best.score) >= MATE_BOUND) break;
      if (rootMoves.length === 1 && depth >= 4) break;
      // The next iteration usually takes several times longer; do not start it in vain.
      if (elapsed > timeMs * 0.45) break;
    }

    let chosen = best.index;
    if (margin > 0) {
      const top = best.score;
      const candidates = order.filter((i) => (best.scores[i] ?? -INFINITY) >= top - margin);
      const random = options.random ?? Math.random;
      chosen = candidates[Math.floor(random() * candidates.length)] ?? best.index;
    }

    const move = rootMoves[chosen] ?? null;
    return {
      move,
      score: chosen === best.index ? best.score : (best.scores[chosen] ?? best.score),
      depth: best.depth,
      nodes: this.#nodes,
      timeMs: Math.round(now() - started),
      pv: move ? [move, ...this.#principalVariation(move, best.depth)] : [],
    };
  }

  #prepare(game: Game): void {
    const board = game.board;
    const history = game.history;
    if (history.length + MAX_PLY > this.#hashHi.length) {
      const size = history.length + MAX_PLY + 1024;
      this.#hashHi = new Int32Array(size);
      this.#hashLo = new Int32Array(size);
      this.#quiet = new Int32Array(size);
    }

    // Walk the game backwards to recover the hash of every earlier position, and the
    // number of plies since the last capture or man move.
    const replay = board.clone();
    let quiet = 0;
    let progressSeen = false;
    for (let i = history.length - 1; i >= 0; i--) {
      const move = history[i];
      if (!move) break;
      replay.unmake(move);
      const hash = hashBoard(replay);
      this.#hashHi[i] = hash.hi;
      this.#hashLo[i] = hash.lo;
      const progress = move.captures.length > 0 || !isKing(replay.get(move.from));
      if (progress) progressSeen = true;
      if (!progressSeen) quiet++;
    }

    this.#board = board;
    this.#hash = hashBoard(board);
    this.#root = history.length;
    this.#hashHi[this.#root] = this.#hash.hi;
    this.#hashLo[this.#root] = this.#hash.lo;
    this.#quiet[this.#root] = quiet;
    this.#whitePieces = board.count(WHITE);
    this.#blackPieces = board.count(BLACK);
    this.#made = 0;
    this.#killers.fill(0);
    // Keep history scores between moves, but let old ones fade.
    for (let i = 0; i < this.#history.length; i++) this.#history[i] = (this.#history[i] ?? 0) >> 2;
  }

  /** Searches every root move and returns their scores (exact for PV and full-window moves). */
  #searchRoot(moves: Move[], order: number[], depth: number, fullWindow: boolean): number[] {
    const scores: number[] = new Array<number>(moves.length).fill(-INFINITY);
    let alpha = -INFINITY;
    let first = true;
    for (const index of order) {
      const move = moves[index];
      if (!move) continue;
      this.#make(move, 0);
      let score: number;
      if (first || fullWindow) {
        score = -this.#negamax(depth - 1, 1, -INFINITY, fullWindow ? INFINITY : -alpha);
      } else {
        score = -this.#negamax(depth - 1, 1, -alpha - 1, -alpha);
        if (score > alpha) score = -this.#negamax(depth - 1, 1, -INFINITY, -alpha);
      }
      this.#unmake(move, 0);
      scores[index] = score;
      if (score > alpha) alpha = score;
      first = false;
    }
    this.tt.store(this.#hash.hi, this.#hash.lo, depth, EXACT, alpha, order[0] ?? 0);
    return scores;
  }

  #negamax(depth: number, ply: number, alpha: number, beta: number): number {
    this.#nodes++;
    if (this.#canAbort && (this.#nodes & 1023) === 0 && now() > this.#deadline) {
      throw new SearchAborted();
    }

    const at = this.#root + ply;
    const quiet = this.#quiet[at] ?? 0;
    if (quiet >= NO_PROGRESS_LIMIT || this.#isRepetition(at, quiet)) return 0;
    if (this.#whitePieces === 1 && this.#blackPieces === 1) return 0;

    const board = this.#board;
    const moves = generateMoves(board);
    if (moves.length === 0) return -MATE + ply;
    if (ply >= MAX_PLY - 1) return evaluate(board);

    // Quiescence: captures are forced, so never stop the search while one is pending.
    const forced = (moves[0]?.captures.length ?? 0) > 0;
    if (depth <= 0 && !forced) return evaluate(board);
    // A position with a single legal move costs no depth.
    const nextDepth = moves.length === 1 ? depth : depth - 1;

    const { hi, lo } = this.#hash;
    let ttMove = -1;
    const slot = this.tt.probe(hi, lo);
    if (slot >= 0) {
      ttMove = this.tt.move(slot);
      if (this.tt.depth(slot) >= depth) {
        const score = fromTable(this.tt.score(slot), ply);
        const bound = this.tt.bound(slot);
        if (bound === EXACT) return score;
        if (bound === LOWER && score >= beta) return score;
        if (bound === UPPER && score <= alpha) return score;
      }
    }

    const order = this.#orderMoves(moves, ply, ttMove);
    const alphaStart = alpha;
    let bestScore = -INFINITY;
    let bestIndex = order[0] ?? 0;

    for (let i = 0; i < order.length; i++) {
      const index = order[i] ?? 0;
      const move = moves[index];
      if (!move) continue;
      this.#make(move, ply);
      let score: number;
      if (i === 0) {
        score = -this.#negamax(nextDepth, ply + 1, -beta, -alpha);
      } else {
        // Principal variation search: prove the move is worse with a null window first.
        score = -this.#negamax(nextDepth, ply + 1, -alpha - 1, -alpha);
        if (score > alpha && score < beta)
          score = -this.#negamax(nextDepth, ply + 1, -beta, -alpha);
      }
      this.#unmake(move, ply);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!forced) this.#rememberCutoff(move, ply, depth);
        break;
      }
    }

    const bound = bestScore <= alphaStart ? UPPER : bestScore >= beta ? LOWER : EXACT;
    this.tt.store(hi, lo, Math.max(depth, 0), bound, toTable(bestScore, ply), bestIndex);
    return bestScore;
  }

  #orderMoves(moves: Move[], ply: number, ttMove: number): number[] {
    const killer1 = this.#killers[ply * 2] ?? -1;
    const killer2 = this.#killers[ply * 2 + 1] ?? -1;
    const keys = moves.map((move, index) => {
      if (index === ttMove) return 1 << 30;
      const id = moveId(move);
      let key = this.#history[id] ?? 0;
      if (move.promotes) key += 1 << 26;
      if (id === killer1) key += 1 << 25;
      else if (id === killer2) key += 1 << 24;
      return key;
    });
    return moves.map((_, i) => i).sort((a, b) => (keys[b] ?? 0) - (keys[a] ?? 0));
  }

  #rememberCutoff(move: Move, ply: number, depth: number): void {
    const id = moveId(move);
    if (this.#killers[ply * 2] !== id) {
      this.#killers[ply * 2 + 1] = this.#killers[ply * 2] ?? 0;
      this.#killers[ply * 2] = id;
    }
    this.#history[id] = Math.min((this.#history[id] ?? 0) + depth * depth, 1 << 22);
  }

  #isRepetition(at: number, quiet: number): boolean {
    // Only positions since the last irreversible move can repeat, with the same side to move.
    const hi = this.#hashHi[at];
    const lo = this.#hashLo[at];
    for (let i = at - 2; i >= at - quiet && i >= 0; i -= 2) {
      if (this.#hashHi[i] === hi && this.#hashLo[i] === lo) return true;
    }
    return false;
  }

  #make(move: Move, ply: number): void {
    const board = this.#board;
    const delta = this.#deltas[ply] ?? { hi: 0, lo: 0 };
    moveDelta(board, move, delta);
    const mover = board.turn;
    const progress = move.captures.length > 0 || !isKing(board.get(move.from));
    board.make(move);
    this.#hash.hi ^= delta.hi;
    this.#hash.lo ^= delta.lo;
    if (mover === WHITE) this.#blackPieces -= move.captures.length;
    else this.#whitePieces -= move.captures.length;
    this.#path[ply] = move;
    this.#made = ply + 1;
    const at = this.#root + ply + 1;
    this.#hashHi[at] = this.#hash.hi;
    this.#hashLo[at] = this.#hash.lo;
    this.#quiet[at] = progress ? 0 : (this.#quiet[at - 1] ?? 0) + 1;
  }

  #unmake(move: Move, ply: number): void {
    const board = this.#board;
    const delta = this.#deltas[ply] ?? { hi: 0, lo: 0 };
    board.unmake(move);
    this.#hash.hi ^= delta.hi;
    this.#hash.lo ^= delta.lo;
    if (board.turn === WHITE) this.#blackPieces += move.captures.length;
    else this.#whitePieces += move.captures.length;
    this.#made = ply;
  }

  /** Follows best moves stored in the transposition table after `first`. */
  #principalVariation(first: Move, depth: number): Move[] {
    const line: Move[] = [];
    const board = this.#board.clone();
    board.make(first);
    const seen = new Set<string>();
    for (let i = 1; i < depth; i++) {
      const hash = hashBoard(board);
      const key = `${hash.hi}:${hash.lo}`;
      if (seen.has(key)) break;
      seen.add(key);
      const slot = this.tt.probe(hash.hi, hash.lo);
      if (slot < 0) break;
      const move = generateMoves(board)[this.tt.move(slot)];
      if (!move) break;
      line.push(move);
      board.make(move);
    }
    return line;
  }
}

const moveId = (move: Move): number => move.from * 64 + move.to;

// Mate scores are stored relative to the node so they stay valid at any ply.
const toTable = (score: number, ply: number): number =>
  score >= MATE_BOUND ? score + ply : score <= -MATE_BOUND ? score - ply : score;
const fromTable = (score: number, ply: number): number =>
  score >= MATE_BOUND ? score - ply : score <= -MATE_BOUND ? score + ply : score;

const now = (): number => performance.now();
