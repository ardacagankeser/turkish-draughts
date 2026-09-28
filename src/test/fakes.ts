import type { AiRequest, AiResponse, WorkerLike } from '../ai';
import { AiClient, Searcher, handleRequest } from '../ai';

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
