import { describe, expect, it } from 'vitest';
import { Board, parseSquare, toFen } from '../engine';
import { place, problems, withTurn } from './editor';

const sq = parseSquare;

describe('position editor', () => {
  it('puts pieces down and takes the same piece away again', () => {
    let board = new Board();
    board = place(board, sq('c3'), 1);
    board = place(board, sq('d6'), -2);
    expect(toFen(board)).toBe('W:Wc3:BKd6');
    // Another piece replaces it; the same piece is taken away.
    board = place(board, sq('c3'), -1);
    expect(board.get(sq('c3'))).toBe(-1);
    board = place(board, sq('c3'), -1);
    expect(board.get(sq('c3'))).toBe(0);
    board = place(board, sq('d6'), 0);
    expect(board.get(sq('d6'))).toBe(0);
  });

  it('crowns a man put down on its promotion rank', () => {
    expect(place(new Board(), sq('e8'), 1).get(sq('e8'))).toBe(2);
    expect(place(new Board(), sq('e1'), -1).get(sq('e1'))).toBe(-2);
    // The other side's promotion rank is fine for a man.
    expect(place(new Board(), sq('e1'), 1).get(sq('e1'))).toBe(1);
  });

  it('never changes the board it was given', () => {
    const board = new Board();
    place(board, sq('a2'), 1);
    withTurn(board, -1);
    expect(board.count(1)).toBe(0);
    expect(board.turn).toBe(1);
  });

  it('explains why a position cannot be analysed', () => {
    expect(problems(new Board())).toEqual(['noWhite', 'noBlack']);
    expect(problems(place(new Board(), sq('c3'), 1))).toEqual(['noBlack']);
    // One piece each is already a draw.
    const one = place(place(new Board(), sq('c3'), 1), sq('f6'), -1);
    expect(problems(one)).toEqual(['over']);
    expect(problems(Board.initial())).toEqual([]);
  });
});
