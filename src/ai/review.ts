import { Game, WHITE, moveToNotation } from '../engine';
import type { Searcher } from './search';
import { MATE } from './search';

/** Asks the analysis worker to evaluate every position of a game. */
export interface ReviewRequest {
  readonly id: number;
  readonly type: 'review';
  /** Starting position and the moves of the game, in landing notation. */
  readonly fen: string;
  readonly moves: readonly string[];
  /** Search time per position, in milliseconds. */
  readonly timeMs: number;
  readonly maxDepth: number;
}

/** The evaluation of one position of the game: `index` is the number of moves played. */
export interface ReviewPosition {
  readonly id: number;
  readonly type: 'review-position';
  readonly index: number;
  /** Evaluation from White's point of view. */
  readonly score: number;
  readonly depth: number;
  /** The engine's choice in landing notation, and its line; `null` once the game is over. */
  readonly best: string | null;
  readonly pv: readonly string[];
  /** Number of legal moves; a single one is forced and is never judged. */
  readonly legal: number;
  /**
   * When the move played here was the engine's choice: the evaluation (White's point of
   * view) of the best other move, to tell an only move from one of several good ones.
   */
  readonly second: number | null;
}

export interface ReviewDone {
  readonly id: number;
  readonly type: 'review-done';
}

export type ReviewUpdate = ReviewPosition | ReviewDone;

/** Search time per position that keeps a whole review around 20 seconds on a laptop. */
export function reviewTime(positions: number): number {
  return Math.max(60, Math.min(300, Math.floor(16_000 / Math.max(1, positions))));
}

export const isReviewRequest = (message: { type: string }): message is ReviewRequest =>
  message.type === 'review';

const nextTask = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/**
 * Evaluates every position of a game in order, reporting each as it is done. Like the live
 * analysis it yields between positions and stops as soon as `isCurrent()` turns false.
 */
export async function review(
  searcher: Searcher,
  request: ReviewRequest,
  post: (update: ReviewUpdate) => void,
  isCurrent: () => boolean,
  yieldToEvents: () => Promise<void> = nextTask,
): Promise<void> {
  const game = new Game(request.fen);
  const options = { maxDepth: request.maxDepth, timeMs: request.timeMs };
  for (let index = 0; index <= request.moves.length; index++) {
    await yieldToEvents();
    if (!isCurrent()) return;
    const sign = game.turn === WHITE ? 1 : -1;
    const played = request.moves[index];
    const legal = game.isOver ? 0 : game.legalMoves.length;

    if (game.isOver) {
      const winner = game.result?.winner ?? null;
      post({
        id: request.id,
        type: 'review-position',
        index,
        score: winner === null ? 0 : winner * MATE,
        depth: 0,
        best: null,
        pv: [],
        legal,
        second: null,
      });
    } else {
      const result = searcher.search(game, options);
      const best = result.move ? moveToNotation(result.move) : null;
      let second: number | null = null;
      if (best !== null && best === played && legal > 1) {
        const other = searcher.search(game, {
          ...options,
          timeMs: request.timeMs / 2,
          exclude: (move) => moveToNotation(move) === best,
        });
        second = sign * other.score;
      }
      post({
        id: request.id,
        type: 'review-position',
        index,
        score: sign * result.score,
        depth: result.depth,
        best,
        pv: result.pv.map(moveToNotation),
        legal,
        second,
      });
    }
    if (played === undefined || game.isOver) break;
    game.play(played);
  }
  if (isCurrent()) post({ id: request.id, type: 'review-done' });
}
