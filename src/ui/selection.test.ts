import { describe, expect, it } from 'vitest';
import { Game, moveToNotation, parseSquare } from '../engine';
import type { Selection } from './selection';
import {
  click,
  destinations,
  jumpedSoFar,
  movableSquares,
  nextSquares,
  premoveTargets,
} from './selection';

const sq = parseSquare;
const names = (squares: Set<number>) =>
  [...squares].map((s) => `${'abcdefgh'[s & 7] ?? ''}${(s >> 3) + 1}`).sort();

describe('click-to-move', () => {
  const moves = new Game().legalMoves;

  it('selects a movable piece and ignores pieces that cannot move', () => {
    expect(click(moves, null, sq('a3'))).toEqual({
      type: 'select',
      selection: { from: sq('a3'), path: [] },
    });
    expect(click(moves, null, sq('a2'))).toEqual({ type: 'select', selection: null });
    expect(click(moves, null, sq('d5'))).toEqual({ type: 'select', selection: null });
  });

  it('plays a quiet move by clicking its destination', () => {
    const result = click(moves, { from: sq('a3'), path: [] }, sq('a4'));
    expect(result.type === 'play' && moveToNotation(result.move)).toBe('a3-a4');
  });

  it('switches to another piece, and deselects on a second click', () => {
    const selected: Selection = { from: sq('a3'), path: [] };
    expect(click(moves, selected, sq('b3'))).toEqual({
      type: 'select',
      selection: { from: sq('b3'), path: [] },
    });
    expect(click(moves, selected, sq('a3'))).toEqual({ type: 'select', selection: null });
    expect(click(moves, selected, sq('h8'))).toEqual({ type: 'select', selection: null });
  });

  it('lists movable pieces, next squares and destinations', () => {
    expect(names(movableSquares(moves))).toEqual(['a3', 'b3', 'c3', 'd3', 'e3', 'f3', 'g3', 'h3']);
    expect(names(nextSquares(moves, { from: sq('c3'), path: [] }))).toEqual(['c4']);
    expect(names(destinations(moves, { from: sq('c3'), path: [] }))).toEqual(['c4']);
  });

  it('steps through a capture chain when several chains reach the same square', () => {
    // A king loop: going round either way captures the same pieces and is one move.
    const game = new Game('W:WKa1:Ba3,c5,e3,Kc1,h8');
    const legal = game.legalMoves;
    const start: Selection = { from: sq('a1'), path: [] };
    // The loop back to a1 needs the start square itself as the last landing square.
    const loop = legal.find((move) => move.to === move.from);
    if (!loop) throw new Error('expected a loop');
    let selection: Selection = start;
    for (const square of loop.path.slice(0, -1)) {
      const step = click(legal, selection, square);
      if (step.type !== 'select' || !step.selection) throw new Error('expected a step');
      selection = step.selection;
    }
    const final = click(legal, selection, sq('a1'));
    expect(final).toEqual({ type: 'play', move: loop });
  });

  it('plays a capture straight away when its destination is unambiguous', () => {
    const game = new Game('W:WKh1,e5,a2:Ba7,b7,c7,d7,e7,g7,a6,b6,c6,d6,f6,h6,a5,c5,f5');
    const result = click(game.legalMoves, { from: sq('h1'), path: [] }, sq('f7'));
    expect(result.type === 'play' && moveToNotation(result.move)).toBe('h1xh7xf7');
  });

  it('lists premove targets from the movement pattern, ignoring other pieces', () => {
    // A white man on d4: one or two squares forward and sideways (captures land two away).
    expect(names(premoveTargets(1, sq('d4')))).toEqual(['b4', 'c4', 'd5', 'd6', 'e4', 'f4']);
    // A black man moves the other way.
    expect(names(premoveTargets(-1, sq('d4')))).toContain('d2');
    // A king: its whole rank and file.
    const king = premoveTargets(2, sq('a1'));
    expect(king.size).toBe(14);
    expect(king.has(sq('a8'))).toBe(true);
    expect(king.has(sq('h1'))).toBe(true);
    expect(king.has(sq('b2'))).toBe(false);
  });

  it('shows the pieces jumped so far while a chain is chosen step by step', () => {
    const legal = new Game('W:WKa1:Ba3,c5,e3,Kc1,h8').legalMoves;
    const loop = legal.find((move) => move.to === move.from);
    if (!loop) throw new Error('expected a loop');
    expect(jumpedSoFar(legal, { from: sq('a1'), path: [] })).toEqual([]);
    expect(jumpedSoFar(legal, { from: sq('a1'), path: loop.path.slice(0, 2) })).toEqual(
      loop.captures.slice(0, 2),
    );
  });
});
