import { describe, expect, it } from 'vitest';
import type { ReviewPosition } from '../ai';
import { judgeMoves, moveAccuracy, summarise } from './review';

/** A reviewed position: White's evaluation, the engine's choice, legal moves, second best. */
const position = (
  score: number,
  best: string | null = 'a3-a4',
  legal = 8,
  second: number | null = null,
): ReviewPosition => ({
  id: 1,
  type: 'review-position',
  index: 0,
  score,
  depth: 6,
  best,
  pv: best ? [best] : [],
  legal,
  second,
});

/** White plays `c3-c4` from an even position, ending up at `after`. */
const whiteMove = (after: number) => judgeMoves([position(0), position(after)], ['c3-c4'])[0];

describe('move judgement', () => {
  it('grades a move by the winning chances it gives away', () => {
    // Chances (from -1 to 1) lost: about 0.76, 0.25, 0.15 and 0.04.
    expect(whiteMove(-500)?.judgement).toBe('blunder');
    expect(whiteMove(-128)?.judgement).toBe('mistake');
    expect(whiteMove(-76)?.judgement).toBe('inaccuracy');
    expect(whiteMove(-20)?.judgement).toBe('good');
    // Getting better is never a mistake.
    expect(whiteMove(300)?.judgement).toBe('good');
  });

  it("judges each move from its own side's point of view", () => {
    const moves = judgeMoves(
      [position(0, 'c3-c4'), position(0, 'f6-f5'), position(500)],
      ['c3-c4', 'c6-c5'],
    );
    expect(moves.map((move) => [move.side, move.judgement])).toEqual([
      [1, 'best'],
      [-1, 'blunder'],
    ]);
    expect(moves[1]?.best).toBe('f6-f5');
  });

  it('marks the only move that holds, and never judges a forced one', () => {
    const only = judgeMoves([position(0, 'c3-c4', 5, -600), position(0)], ['c3-c4'])[0];
    expect(only?.judgement).toBe('only');
    const oneOfMany = judgeMoves([position(0, 'c3-c4', 5, -10), position(0)], ['c3-c4'])[0];
    expect(oneOfMany?.judgement).toBe('best');
    const forced = judgeMoves([position(0, 'c3-c4', 1), position(-900)], ['c3-c4'])[0];
    expect(forced).toMatchObject({ judgement: 'forced', accuracy: null });
  });

  it('waits for both positions of a move', () => {
    expect(judgeMoves([position(0), undefined], ['c3-c4'])).toEqual([]);
  });
});

describe('accuracy', () => {
  it('follows the lichess curve', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 2);
    expect(moveAccuracy(10)).toBeCloseTo(63.6, 1);
    expect(moveAccuracy(100)).toBe(0);
  });

  it('averages the moves of each side, leaving forced moves out', () => {
    const moves = judgeMoves(
      [
        position(0, 'c3-c4'),
        position(0, 'f6-f5'),
        position(0, 'd3-d4', 1),
        position(0, 'h6-h5'),
        position(0),
      ],
      ['c3-c4', 'c6-c5', 'd3-d4', 'h6-h5'],
    );
    const white = summarise(moves, 1);
    expect(white.accuracy).toBe(100);
    expect(white.counts).toMatchObject({ best: 1, forced: 1 });
    const black = summarise(moves, -1);
    expect(black.counts).toMatchObject({ good: 1, best: 1 });
    expect(black.accuracy).toBeCloseTo(100, 1);
    expect(summarise([], 1).accuracy).toBeNull();
  });
});
