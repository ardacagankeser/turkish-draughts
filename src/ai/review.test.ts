import { describe, expect, it } from 'vitest';
import { INITIAL_FEN } from '../engine';
import type { ReviewUpdate } from './review';
import { review } from './review';
import { MATE, Searcher } from './search';

const run = async (fen: string, moves: string[]) => {
  const updates: ReviewUpdate[] = [];
  await review(
    new Searcher(16),
    { id: 7, type: 'review', fen, moves, timeMs: 1000, maxDepth: 3 },
    (update) => updates.push(update),
    () => true,
    () => Promise.resolve(),
  );
  return updates;
};

describe('game review', () => {
  it('evaluates every position of the game, in order, then says it is done', async () => {
    const updates = await run(INITIAL_FEN, ['c3-c4', 'f6-f5']);
    expect(
      updates.map((update) => (update.type === 'review-position' ? update.index : 'done')),
    ).toEqual([0, 1, 2, 'done']);
    const first = updates[0];
    expect(first).toMatchObject({ type: 'review-position', legal: 8 });
    expect(first?.type === 'review-position' && first.best).toMatch(/^[a-h][1-8]-[a-h][1-8]$/);
  });

  it('scores a finished game by its result, from White’s point of view', async () => {
    // White takes Black's last piece.
    const updates = await run('W:Wc3,a2:Bc4', ['c3xc5']);
    expect(updates[1]).toMatchObject({ index: 1, score: MATE, best: null, legal: 0 });
  });

  it('weighs the best other move when the engine’s choice was played', async () => {
    const opening = await run(INITIAL_FEN, ['c3-c4']);
    const first = opening[0];
    if (first?.type !== 'review-position') throw new Error('expected a position');
    // The engine's choice was played only if it was c3-c4.
    expect(first.second === null).toBe(first.best !== 'c3-c4');
  });

  it('stops when superseded', async () => {
    const updates: ReviewUpdate[] = [];
    let current = true;
    await review(
      new Searcher(16),
      {
        id: 1,
        type: 'review',
        fen: INITIAL_FEN,
        moves: ['c3-c4', 'f6-f5'],
        timeMs: 500,
        maxDepth: 2,
      },
      (update) => {
        updates.push(update);
        current = false;
      },
      () => current,
      () => Promise.resolve(),
    );
    expect(updates).toHaveLength(1);
  });
});
