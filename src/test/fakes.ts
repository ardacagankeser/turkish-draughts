import type {
  AiRequest,
  AiResponse,
  AnalysisRequest,
  AnalysisUpdate,
  AnalysisWorkerLike,
  WorkerLike,
} from '../ai';
import { AiClient, AnalysisClient, Searcher, analyse, handleRequest } from '../ai';

/** Runs requests through the real AI synchronously, in place of a Web Worker. */
export class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<AiResponse>) => void) | null = null;
  terminated = false;
  /** When set, requests are swallowed, like a worker stuck in a long search. */
  hold = false;
  readonly #searcher = new Searcher(16);

  postMessage(message: AiRequest): void {
    if (this.hold || this.terminated) return;
    // Keep tests fast: search shallowly whatever level is asked for.
    const request =
      message.type === 'new-game' ? message : { ...message, level: 'beginner' as const };
    const response = handleRequest(this.#searcher, request);
    queueMicrotask(() => this.onmessage?.({ data: response } as MessageEvent<AiResponse>));
  }

  terminate(): void {
    this.terminated = true;
  }
}

export const fakeAi = (): AiClient => new AiClient(() => new FakeWorker());

/** Runs the real live analysis, kept shallow so tests stay fast. */
export class FakeAnalysisWorker implements AnalysisWorkerLike {
  onmessage: ((event: MessageEvent<AnalysisUpdate>) => void) | null = null;
  terminated = false;
  readonly requests: AnalysisRequest[] = [];
  #current = 0;
  readonly #searcher = new Searcher(16);

  postMessage(message: AnalysisRequest): void {
    this.requests.push(message);
    this.#current = message.type === 'analyse' ? message.id : 0;
    if (message.type !== 'analyse' || this.terminated) return;
    void analyse(
      this.#searcher,
      { ...message, maxDepth: Math.min(message.maxDepth, 3) },
      (update) => {
        if (!this.terminated) this.onmessage?.({ data: update } as MessageEvent<AnalysisUpdate>);
      },
      () => this.#current === message.id && !this.terminated,
    );
  }

  terminate(): void {
    this.terminated = true;
  }
}

export const fakeAnalysis = (): AnalysisClient =>
  new AnalysisClient(() => new FakeAnalysisWorker());

/** An in-memory `Storage`. */
export class MemoryStorage implements Storage {
  readonly #items = new Map<string, string>();

  get length(): number {
    return this.#items.size;
  }

  clear(): void {
    this.#items.clear();
  }

  getItem(key: string): string | null {
    return this.#items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#items.set(key, value);
  }
}
