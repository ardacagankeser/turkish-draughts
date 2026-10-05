import { describe, expect, it } from 'vitest';
import { INITIAL_FEN } from './fen';
import { parsePdn, pdnResult, toPdn } from './pdn';

describe('PDN', () => {
  it('writes the tags, numbered moves and the result', () => {
    const pdn = toPdn(
      INITIAL_FEN,
      ['c3-c4', 'f6-f5', 'c4-c5'],
      { winner: 1, reason: 'resignation' },
      {
        White: 'Ayşe',
      },
    );
    expect(pdn).toContain('[White "Ayşe"]');
    expect(pdn).toContain('[GameType "30"]');
    expect(pdn).toContain('[Result "2-0"]');
    expect(pdn).not.toContain('[FEN');
    expect(pdn.trim().endsWith('1. c3-c4 f6-f5 2. c4-c5 2-0')).toBe(true);
  });

  it('starts the numbering with "1..." when Black moves first', () => {
    const fen = 'B:Wc3,e3:Bc6,e6';
    const pdn = toPdn(fen, ['c6-c5', 'c3-c4'], null);
    expect(pdn).toContain(`[FEN "${fen}"]`);
    expect(pdn).toContain('1... c6-c5 2. c3-c4 *');
  });

  it('reads back what it writes', () => {
    const moves = ['a3-a4', 'b6-b5', 'd3-d4', 'd6-d5', 'd4xd6xb6xb8'];
    const game = parsePdn(toPdn(INITIAL_FEN, moves, null));
    expect(game.fen).toBe(INITIAL_FEN);
    expect(game.moves).toEqual(moves);
    expect(game.tags.GameType).toBe('30');
  });

  it('skips comments, variations, marks and move numbers, and reads TÜDAF notation', () => {
    const text = `[Event "Club"]
1. a3-a4 {a quiet start} b6-b5 (1... c6-c5 2. c3-c4) 2.d3-d4! d6-d5?
3. d4xd5xc6xb7 *`;
    expect(parsePdn(text).moves).toEqual(['a3-a4', 'b6-b5', 'd3-d4', 'd6-d5', 'd4xd6xb6xb8']);
  });

  it('names an illegal move', () => {
    expect(() => parsePdn('1. c3-c5')).toThrow('c3-c5');
  });

  it('scores results the draughts way', () => {
    expect(pdnResult(null)).toBe('*');
    expect(pdnResult({ winner: -1, reason: 'no-pieces' })).toBe('0-2');
    expect(pdnResult({ winner: null, reason: 'agreement' })).toBe('1-1');
  });
});
