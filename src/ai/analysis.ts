import { Game, WHITE, moveToNotation } from '../engine';
import type { Searcher } from './search';
import { mateIn } from './search';

/** Messages from the UI thread to the analysis worker. */
export type AnalysisRequest =
  | {
      readonly id: number;
      readonly type: 'analyse';
      /** Starting position and moves played since, in landing notation. */
      readonly fen: string;
      readonly moves: readonly string[];
      readonly maxDepth: number;
      readonly timeMs: number;
    }
  | { readonly id: number; readonly type: 'stop' };

/** One update from the analysis worker, sent after every finished depth. */
export interface AnalysisUpdate {
  readonly id: number;
  readonly type: 'analysis';
  readonly depth: number;
  /** Evaluation from White's point of view (positive: White is better). */
  readonly score: number;
  readonly pv: readonly string[];
  /** True for the last update of this analysis. */
  readonly done: boolean;
}

export const isAnalysisRequest = (message: { type: string }): message is AnalysisRequest =>
  message.type === 'analyse' || message.type === 'stop';

const nextTask = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

/**
 * Analyses a position one depth at a time, reporting after each depth.
 *
 * A running search cannot be interrupted from outside (that would need a
 * SharedArrayBuffer, which GitHub Pages cannot enable), so the analysis yields to the
 * event loop between depths and stops as soon as `isCurrent()` says it was superseded.
 * The transposition table makes each new depth cheap to start.
 */
export async function analyse(
  searcher: Searcher,
  request: Extract<AnalysisRequest, { type: 'analyse' }>,
  post: (update: AnalysisUpdate) => void,
  isCurrent: () => boolean,
  yieldToEvents: () => Promise<void> = nextTask,
): Promise<void> {
  const game = new Game(request.fen);
  for (const move of request.moves) game.play(move);
  if (game.isOver) return;
  const sign = game.turn === WHITE ? 1 : -1;
  const deadline = performance.now() + request.timeMs;
  let last: Omit<AnalysisUpdate, 'done'> | null = null;

  for (let depth = 1; depth <= request.maxDepth; depth++) {
    await yieldToEvents();
    if (!isCurrent()) return;
    const remaining = deadline - performance.now();
    if (remaining <= 0) break;
    const result = searcher.search(game, { maxDepth: depth, timeMs: remaining });
    if (!isCurrent()) return;
    if (result.depth <= (last?.depth ?? 0)) break; // out of time before finishing this depth
    last = {
      id: request.id,
      type: 'analysis',
      depth: result.depth,
      score: sign * result.score,
      pv: result.pv.map(moveToNotation),
    };
    post({ ...last, done: false });
    // A forced result will not change with more depth.
    if (mateIn(result.score) !== null) break;
  }
  if (last && isCurrent()) post({ ...last, done: true });
}
