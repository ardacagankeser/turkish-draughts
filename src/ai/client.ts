import type { Color } from '../engine';
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
 * interrupted from outside, so `cancel()` terminates the worker. A worker is started
 * lazily on the next request, which also makes the client reusable after `dispose()`.
 */
export class AiClient {
  readonly #create: () => WorkerLike;
  #worker: WorkerLike | null = null;
  #nextId = 1;
  readonly #pending = new Map<number, Pending>();

  constructor(create: () => WorkerLike = createWorker) {
    this.#create = create;
  }

  /** Asks for a move; `timeMs` caps the level's thinking time (a running clock). */
  async chooseMove(
    fen: string,
    moves: readonly string[],
    level: Level,
    timeMs?: number,
  ): Promise<MoveResponse> {
    const response = await this.#send({
      id: this.#nextId++,
      type: 'move',
      fen,
      moves,
      level,
      ...(timeMs === undefined ? {} : { timeMs }),
    });
    if (response.type !== 'move') throw new Error('Unexpected response from the AI');
    return response;
  }

  /** Asks the AI, playing `ai`, whether it accepts a draw. */
  async offerDraw(
    fen: string,
    moves: readonly string[],
    level: Level,
    ai: Color,
  ): Promise<boolean> {
    const response = await this.#send({
      id: this.#nextId++,
      type: 'draw-offer',
      fen,
      moves,
      level,
      ai,
    });
    if (response.type !== 'draw-offer') throw new Error('Unexpected response from the AI');
    return response.accepted;
  }

  async newGame(): Promise<void> {
    await this.#send({ id: this.#nextId++, type: 'new-game' });
  }

  /** Stops any search in progress. Pending calls reject with an `AbortError`. */
  cancel(): void {
    this.#worker?.terminate();
    this.#worker = null;
    this.#rejectAll();
  }

  /** Releases the worker. The client starts a new one if it is used again. */
  dispose(): void {
    this.cancel();
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
      this.#worker ??= this.#spawn();
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
