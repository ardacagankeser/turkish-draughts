/**
 * A faithful TypeScript port of the original Python AI (`game/ai.py` on the
 * `legacy/flet` branch), used only as a benchmark opponent.
 *
 * It keeps the original search (plain fixed-depth alpha-beta, no move ordering, no
 * transposition table) and the original evaluation terms and weights. It runs on the
 * new, correct rules engine, so a match measures search and evaluation only.
 */
import type { Board, Color, Move } from '../src/engine';
import { BLACK, WHITE, colorOf, generateMoves, isKing } from '../src/engine';

const WIN = 10_000;

export class LegacyAi {
  constructor(readonly depth: number) {}

  chooseMove(board: Board): Move | null {
    const me = board.turn;
    const moves = generateMoves(board);
    let best: Move | null = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    for (const move of moves) {
      board.make(move);
      const score = this.#minimax(board, this.depth - 1, alpha, Infinity, false, me);
      board.unmake(move);
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
      alpha = Math.max(alpha, score);
    }
    return best;
  }

  #minimax(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
    me: Color,
  ): number {
    const moves = generateMoves(board);
    // The original treated "no pieces" and "no moves" as game over; it knew no draws.
    if (depth === 0 || moves.length === 0) return evaluateLegacy(board, me, moves.length);
    if (maximizing) {
      let value = -Infinity;
      for (const move of moves) {
        board.make(move);
        value = Math.max(value, this.#minimax(board, depth - 1, alpha, beta, false, me));
        board.unmake(move);
        alpha = Math.max(alpha, value);
        if (beta <= alpha) break;
      }
      return value;
    }
    let value = Infinity;
    for (const move of moves) {
      board.make(move);
      value = Math.min(value, this.#minimax(board, depth - 1, alpha, beta, true, me));
      board.unmake(move);
      beta = Math.min(beta, value);
      if (beta <= alpha) break;
    }
    return value;
  }
}

/**
 * `_evaluate_position` from the Python version, from `me`'s point of view. The Python
 * board counted rows from Black's side (row = 7 - rank); the formulas are converted.
 */
function evaluateLegacy(board: Board, me: Color, moveCount: number): number {
  if (moveCount === 0) return board.turn === me ? -WIN : WIN;

  let score = 0;
  for (let square = 0; square < 64; square++) {
    const piece = board.get(square);
    const color = colorOf(piece);
    if (color === 0) continue;
    const rank = square >> 3;
    const file = square & 7;
    const row = 7 - rank;
    const centerDistance = Math.abs(row - 3.5) + Math.abs(file - 3.5);
    let value: number;
    if (isKing(piece)) {
      value = 300 + Math.max(0, 7 - centerDistance) * 5;
      if (row === 0 || row === 7 || file === 0 || file === 7) value -= 10;
    } else {
      value = 100 + (color === WHITE ? (7 - row) * 2 : row * 2);
      value += Math.max(0, 7 - centerDistance) * 3;
      // _get_king_advancement_bonus: men within three rows of promotion.
      if (color === WHITE && row <= 2) value += (3 - row) * 20;
      if (color === BLACK && row >= 5) value += (row - 4) * 20;
    }
    score += color === me ? value : -value;
  }

  // Mobility, counted only for the side to move, as in the original.
  score += board.turn === me ? moveCount * 5 : -moveCount * 5;

  // Capture difference; both sides start with 16 pieces.
  const opponent = me === WHITE ? BLACK : WHITE;
  const capturedByMe = 16 - board.count(opponent);
  const capturedByOpponent = 16 - board.count(me);
  score += (capturedByMe - capturedByOpponent) * 50;
  return score;
}
