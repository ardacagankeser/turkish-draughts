import type { Board } from './board';
import { INITIAL_FEN, parseFen, toFen } from './fen';
import { generateMoves } from './movegen';
import { findMove } from './notation';
import type { Color, GameResult, Move } from './types';
import { BLACK, WHITE, isKing, opponent } from './types';

/**
 * Plies without a capture or a man move before the game is drawn (50 moves each).
 * Project convention; the TÜDAF rules have no such limit. See docs/RULES.md.
 */
export const NO_PROGRESS_LIMIT = 100;

interface HistoryEntry {
  readonly move: Move;
  readonly quietPlies: number;
}

/** A game in progress: legal moves, history with undo, and end-of-game detection. */
export class Game {
  readonly #board: Board;
  readonly #history: HistoryEntry[] = [];
  readonly #positionCounts = new Map<string, number>();
  #legalMoves: Move[];
  #quietPlies = 0;
  #result: GameResult | null = null;

  constructor(fen: string = INITIAL_FEN) {
    this.#board = parseFen(fen);
    this.#legalMoves = generateMoves(this.#board);
    this.#countPosition(1);
    this.#result = this.#detectResult();
  }

  /** A copy of the current board. */
  get board(): Board {
    return this.#board.clone();
  }

  get turn(): Color {
    return this.#board.turn;
  }

  get result(): GameResult | null {
    return this.#result;
  }

  get isOver(): boolean {
    return this.#result !== null;
  }

  get history(): readonly Move[] {
    return this.#history.map((entry) => entry.move);
  }

  /** Legal moves for the side to move; empty once the game is over. */
  get legalMoves(): readonly Move[] {
    return this.#result ? [] : this.#legalMoves;
  }

  fen(): string {
    return toFen(this.#board);
  }

  /** Plays a legal move, given as a move object or in notation (`d3-d4`, `f3xf5xd5`). */
  play(input: Move | string): Move {
    if (this.#result) throw new Error('The game is over');
    const move =
      typeof input === 'string'
        ? findMove(this.#legalMoves, input)
        : this.#legalMoves.find((legal) => sameMove(legal, input));
    if (!move) throw new Error('Illegal move');

    const progress = move.captures.length > 0 || !isKing(this.#board.get(move.from));
    this.#history.push({ move, quietPlies: this.#quietPlies });
    this.#quietPlies = progress ? 0 : this.#quietPlies + 1;
    this.#board.make(move);
    this.#legalMoves = generateMoves(this.#board);
    this.#countPosition(1);
    this.#result = this.#detectResult();
    return move;
  }

  /** Takes back the last move. Returns it, or `undefined` if there is nothing to undo. */
  undo(): Move | undefined {
    const entry = this.#history.pop();
    if (!entry) return undefined;
    this.#countPosition(-1);
    this.#board.unmake(entry.move);
    this.#quietPlies = entry.quietPlies;
    this.#legalMoves = generateMoves(this.#board);
    this.#result = this.#detectResult();
    return entry.move;
  }

  resign(color: Color): void {
    if (!this.#result) this.#result = { winner: opponent(color), reason: 'resignation' };
  }

  /** Records that `color` ran out of time. */
  timeout(color: Color): void {
    if (!this.#result) this.#result = { winner: opponent(color), reason: 'timeout' };
  }

  #countPosition(delta: 1 | -1): void {
    const key = this.#board.key();
    const count = (this.#positionCounts.get(key) ?? 0) + delta;
    if (count > 0) this.#positionCounts.set(key, count);
    else this.#positionCounts.delete(key);
  }

  #detectResult(): GameResult | null {
    const board = this.#board;
    const white = board.count(WHITE);
    const black = board.count(BLACK);
    if (white === 0) return { winner: BLACK, reason: 'no-pieces' };
    if (black === 0) return { winner: WHITE, reason: 'no-pieces' };
    if (white === 1 && black === 1) return { winner: null, reason: 'one-piece-each' };
    if (this.#legalMoves.length === 0) return { winner: opponent(board.turn), reason: 'no-moves' };
    if ((this.#positionCounts.get(board.key()) ?? 0) >= 3) {
      return { winner: null, reason: 'repetition' };
    }
    if (this.#quietPlies >= NO_PROGRESS_LIMIT) return { winner: null, reason: 'no-progress' };
    return null;
  }
}

const sameMove = (a: Move, b: Move): boolean =>
  a.from === b.from &&
  a.to === b.to &&
  a.captures.length === b.captures.length &&
  a.captures.every((square) => b.captures.includes(square));
