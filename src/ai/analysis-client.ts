import type { AnalysisRequest, AnalysisUpdate } from './analysis';

/** The part of the `Worker` interface the analysis client needs; tests pass a fake. */
export interface AnalysisWorkerLike {
  postMessage(message: AnalysisRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<AnalysisUpdate>) => void) | null;
}

export interface AnalysisOptions {
  readonly maxDepth?: number;
  readonly timeMs?: number;
}

/** Enough for a stable evaluation without keeping a phone's CPU busy for long. */
const DEFAULTS = { maxDepth: 18, timeMs: 3000 };

const createWorker = (): AnalysisWorkerLike =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

/**
 * Live analysis of the displayed position in its own worker, so it never delays the AI's
 * moves. Starting a new analysis supersedes the previous one; only updates for the latest
 * request reach the listener.
 */
export class AnalysisClient {
  readonly #create: () => AnalysisWorkerLike;
  #worker: AnalysisWorkerLike | null = null;
  #id = 0;
  #listener: ((update: AnalysisUpdate) => void) | null = null;

  constructor(create: () => AnalysisWorkerLike = createWorker) {
    this.#create = create;
  }

  analyse(
    fen: string,
    moves: readonly string[],
    onUpdate: (update: AnalysisUpdate) => void,
    options: AnalysisOptions = {},
  ): void {
    const id = ++this.#id;
    this.#listener = onUpdate;
    this.#worker ??= this.#spawn();
    this.#worker.postMessage({ id, type: 'analyse', fen, moves, ...DEFAULTS, ...options });
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

  #spawn(): AnalysisWorkerLike {
    const worker = this.#create();
    worker.onmessage = (event) => {
      if (event.data.id === this.#id) this.#listener?.(event.data);
    };
    return worker;
  }
}
