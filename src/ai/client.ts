import type { Level } from './levels';
import type { AiRequest, AiResponse } from './protocol';

/** The part of the `Worker` interface the client needs; lets tests pass a fake. */
export interface WorkerLike {
  postMessage(message: AiRequest): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<AiResponse>) => void) | null;
}

export type MoveResponse = Extract<AiResponse, { type: 'move' }>;

type Pending = {
  resolve: (response: AiResponse) => void;
  reject: (error: Error) => void;
};

const createWorker = (): WorkerLike =>
  new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

/**
 * Promise-based access to the AI running in a Web Worker. A search cannot be
 * interrupted from outside, so `cancel()` terminates the worker and starts a new one.
 */
export class AiClient {
  readonly #create: () => WorkerLike;
  #worker: WorkerLike;
  #nextId = 1;
  readonly #pending = new Map<number, Pending>();

  constructor(create: () => WorkerLike = createWorker) {
    this.#create = create;
    this.#worker = this.#spawn();
  }

  async chooseMove(fen: string, moves: readonly string[], level: Level): Promise<MoveResponse> {
    const response = await this.#send({ id: this.#nextId++, type: 'move', fen, moves, level });
    if (response.type !== 'move') throw new Error('Unexpected response from the AI');
    return response;
  }

  async offerDraw(fen: string, moves: readonly string[], level: Level): Promise<boolean> {
    const response = await this.#send({
      id: this.#nextId++,
      type: 'draw-offer',
      fen,
      moves,
      level,
    });
    if (response.type !== 'draw-offer') throw new Error('Unexpected response from the AI');
    return response.accepted;
  }

  async newGame(): Promise<void> {
    await this.#send({ id: this.#nextId++, type: 'new-game' });
  }

  /** Stops any search in progress. Pending calls reject with an `AbortError`. */
  cancel(): void {
    this.#worker.terminate();
    this.#rejectAll();
    this.#worker = this.#spawn();
  }

  dispose(): void {
    this.#worker.terminate();
    this.#rejectAll();
  }

  #spawn(): WorkerLike {
    const worker = this.#create();
    worker.onmessage = (event) => {
      const response = event.data;
      const pending = this.#pending.get(response.id);
      if (!pending) return;
      this.#pending.delete(response.id);
      if (response.type === 'error') pending.reject(new Error(response.message));
      else pending.resolve(response);
    };
    return worker;
  }

  #send(request: AiRequest): Promise<AiResponse> {
    return new Promise((resolve, reject) => {
      this.#pending.set(request.id, { resolve, reject });
      this.#worker.postMessage(request);
    });
  }

  #rejectAll(): void {
    for (const { reject } of this.#pending.values()) {
      reject(new DOMException('The AI search was cancelled', 'AbortError'));
    }
    this.#pending.clear();
  }
}
