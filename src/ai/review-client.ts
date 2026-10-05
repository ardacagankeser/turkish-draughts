import type { AnalysisRequest } from './analysis';
import type { ReviewPosition, ReviewRequest, ReviewUpdate } from './review';
import { reviewTime } from './review';

/** The part of the `Worker` interface the review client needs; tests pass a fake. */
export interface ReviewWorkerLike {
  postMessage(message: ReviewRequest | AnalysisRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<ReviewUpdate>) => void) | null;
}

export interface ReviewOptions {
  /** Search time per position. */
  readonly timeMs?: number;
  readonly maxDepth?: number;
}

const createWorker = (): ReviewWorkerLike =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

/**
 * Reviews a finished game in its own worker, so neither the AI nor the live analysis has
 * to wait. A new review (or `stop`) supersedes the previous one.
 */
export class ReviewClient {
  readonly #create: () => ReviewWorkerLike;
  #worker: ReviewWorkerLike | null = null;
  #id = 0;
  #listener: ((update: ReviewUpdate) => void) | null = null;

  constructor(create: () => ReviewWorkerLike = createWorker) {
    this.#create = create;
  }

  review(
    fen: string,
    moves: readonly string[],
    onPosition: (position: ReviewPosition) => void,
    onDone: () => void,
    options: ReviewOptions = {},
  ): void {
    const id = ++this.#id;
    this.#listener = (update) => {
      if (update.type === 'review-position') onPosition(update);
      else onDone();
    };
    this.#worker ??= this.#spawn();
    this.#worker.postMessage({
      id,
      type: 'review',
      fen,
      moves,
      timeMs: options.timeMs ?? reviewTime(moves.length + 1),
      maxDepth: options.maxDepth ?? 16,
    });
  }

  stop(): void {
    const id = ++this.#id;
    this.#listener = null;
    this.#worker?.postMessage({ id, type: 'stop' });
  }

  /** Releases the worker. The client starts a new one if it is used again. */
  dispose(): void {
    this.#id++;
    this.#listener = null;
    this.#worker?.terminate();
    this.#worker = null;
  }

  #spawn(): ReviewWorkerLike {
    const worker = this.#create();
    worker.onmessage = (event) => {
      if (event.data.id === this.#id) this.#listener?.(event.data);
    };
    return worker;
  }
}
