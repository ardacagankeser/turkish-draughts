import { describe, expect, it } from 'vitest';
import { Game, INITIAL_FEN, moveToNotation } from '../engine';
import type { WorkerLike } from './client';
import { AiClient } from './client';
import type { AiRequest, AiResponse } from './protocol';
import { handleRequest } from './protocol';
import { Searcher } from './search';

describe('handleRequest', () => {
  const searcher = new Searcher(16);

  it('replays the game and answers with a legal move', () => {
    const response = handleRequest(searcher, {
      id: 1,
      type: 'move',
      fen: INITIAL_FEN,
      moves: ['a3-a4', 'h6-h5'],
      level: 'easy',
    });
    if (response.type !== 'move') throw new Error(`unexpected ${response.type}`);
    const game = new Game();
    game.play('a3-a4');
    game.play('h6-h5');
    expect(game.legalMoves.map(moveToNotation)).toContain(response.move);
    expect(response.id).toBe(1);
  });

  it('accepts a draw when losing and refuses when winning', () => {
    const offer = (fen: string, ai: 1 | -1) =>
      handleRequest(searcher, { id: 2, type: 'draw-offer', fen, moves: [], level: 'hard', ai });
    // White (two kings) wins against the lone man, whoever is to move.
    for (const fen of ['W:WKa1,Kh1:Bd5', 'B:WKa1,Kh1:Bd4']) {
      expect(offer(fen, -1)).toEqual({ id: 2, type: 'draw-offer', accepted: true });
      expect(offer(fen, 1)).toEqual({ id: 2, type: 'draw-offer', accepted: false });
    }
  });

  it('reports illegal input as an error instead of throwing', () => {
    const response = handleRequest(searcher, {
      id: 3,
      type: 'move',
      fen: INITIAL_FEN,
      moves: ['a2-a1'],
      level: 'easy',
    });
    expect(response).toMatchObject({ id: 3, type: 'error' });
  });

  it('clears its memory for a new game', () => {
    expect(handleRequest(searcher, { id: 4, type: 'new-game' })).toEqual({
      id: 4,
      type: 'new-game',
    });
  });
});

/** Runs requests synchronously through handleRequest, like a real worker would. */
class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<AiResponse>) => void) | null = null;
  terminated = false;
  hold = false;
  readonly #searcher = new Searcher(16);

  postMessage(message: AiRequest): void {
    if (this.hold) return;
    const response = handleRequest(this.#searcher, message);
    queueMicrotask(() => this.onmessage?.({ data: response } as MessageEvent<AiResponse>));
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('AiClient', () => {
  it('resolves moves and draw offers', async () => {
    const client = new AiClient(() => new FakeWorker());
    const response = await client.chooseMove(INITIAL_FEN, [], 'beginner');
    expect(new Game().legalMoves.map(moveToNotation)).toContain(response.move);
    await expect(client.offerDraw('B:WKa1,Kh1:Bd5', [], 'easy', -1)).resolves.toBe(true);
    await expect(client.newGame()).resolves.toBeUndefined();
    client.dispose();
  });

  it('rejects errors from the worker', async () => {
    const client = new AiClient(() => new FakeWorker());
    await expect(client.chooseMove(INITIAL_FEN, ['z9-z9'], 'easy')).rejects.toThrow(
      'Invalid square',
    );
  });

  it('cancels a pending search by replacing the worker', async () => {
    const workers: FakeWorker[] = [];
    const client = new AiClient(() => {
      const worker = new FakeWorker();
      worker.hold = workers.length === 0;
      workers.push(worker);
      return worker;
    });
    const pending = client.chooseMove(INITIAL_FEN, [], 'expert');
    client.cancel();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0]?.terminated).toBe(true);
    await expect(client.chooseMove(INITIAL_FEN, [], 'beginner')).resolves.toMatchObject({
      type: 'move',
    });
  });
});
