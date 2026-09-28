import { describe, expect, it } from 'vitest';
import { Board, Game, moveToNotation, parseFen, perft, toFen } from '.';

const notations = (fen: string): string[] => new Game(fen).legalMoves.map(moveToNotation).sort();

describe('men', () => {
  it('move one square forward or sideways, never backward', () => {
    expect(notations('W:Wd4:Bh8,a8')).toEqual(['d4-c4', 'd4-d5', 'd4-e4']);
    expect(notations('B:Wa1,b1:Bd5')).toEqual(['d5-c5', 'd5-d4', 'd5-e5']);
  });

  it('capture forward and sideways', () => {
    expect(notations('W:Wd4:Bd5,c4,e4,h8')).toEqual(['d4xb4', 'd4xd6', 'd4xf4']);
  });

  it('never capture backward', () => {
    expect(notations('W:Wd4:Bd3,h8')).toEqual(['d4-c4', 'd4-d5', 'd4-e4']);
    expect(notations('B:Wd5,a1:Bd4')).toEqual(['d4-c4', 'd4-d3', 'd4-e4']);
  });

  it('cannot jump two pieces in a row or land off the board', () => {
    expect(notations('W:Wd4:Bd5,d6,a8')).not.toContain('d4xd6');
    expect(notations('W:Wa4:Ba5,a6,h8').some((n) => n.includes('x'))).toBe(false);
    expect(notations('W:Wd7:Bd8,h1').some((n) => n.includes('x'))).toBe(false);
  });

  it('promote when a quiet move reaches the far rank', () => {
    const game = new Game('W:Wd7:Bh1,a1');
    const move = game.play('d7-d8');
    expect(move.promotes).toBe(true);
    expect(game.fen()).toBe('B:WKd8:Ba1,h1');
  });
});

describe('kings', () => {
  it('fly any distance along ranks and files', () => {
    expect(notations('W:WKd4,Kd2:Bh8')).toHaveLength(12 + 9);
  });

  it('capture from a distance and may land on any empty square beyond', () => {
    expect(notations('W:WKa1:Ba4,h8')).toEqual(['a1xa5', 'a1xa6', 'a1xa7', 'a1xa8']);
  });

  it('cannot capture over two adjacent pieces or over their own pieces', () => {
    expect(notations('W:WKa1,a3:Ba5,h8').some((n) => n.includes('x'))).toBe(false);
    expect(notations('W:WKa1:Ba4,a5,h8').some((n) => n.includes('x'))).toBe(false);
  });

  it('prefer landing squares that allow the chain to continue', () => {
    // Only landing on a6 lets the king go on to capture c6.
    expect(notations('W:WKa1:Ba4,c6,h8')).toEqual([
      'a1xa6xd6',
      'a1xa6xe6',
      'a1xa6xf6',
      'a1xa6xg6',
      'a1xa6xh6',
    ]);
  });
});

describe('capture rules', () => {
  it('make capturing mandatory for every piece', () => {
    expect(notations('W:Wa2,h4:Bh5,a8')).toEqual(['h4xh6']);
  });

  it('count a captured king the same as a captured man', () => {
    // The man can capture two men; the king only one king.
    expect(notations('W:Wg3,Ka1:Bg4,g6,Kc1')).toEqual(['g3xg5xg7']);
  });

  it('do not let a captured piece be jumped twice', () => {
    // Around a ring of men, the king cannot re-use a removed piece to keep going.
    const moves = new Game('W:WKa1:Ba3,c8,h6,f1,h8').legalMoves;
    for (const move of moves) expect(new Set(move.captures).size).toBe(move.captures.length);
  });

  it('only return one move per resulting position', () => {
    for (const fen of ['B:Wc5,a4,g4,a3,b3,c3,f3,h3,b2,e2,g2:BKc8,a7,d7,e7,f7,g7,e6,f6,g6,e5']) {
      const moves = new Game(fen).legalMoves;
      const keys = moves.map((m) => `${m.from}:${m.to}:${[...m.captures].sort().join(',')}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('Board.make / unmake', () => {
  it('restores the exact position, including promotion and captured kings', () => {
    const board = parseFen('W:Wf6,a4,c4:BKe8,f7,a7,h1');
    const before = toFen(board);
    const game = new Game(before);
    for (const move of game.legalMoves) {
      board.make(move);
      board.unmake(move);
      expect(toFen(board)).toBe(before);
    }
  });
});

describe('perft', () => {
  it('matches known counts from the starting position', () => {
    // Regression values; cross-checked against the reference generator in reference.test.ts.
    expect([1, 2, 3, 4, 5].map((depth) => perft(Board.initial(), depth))).toEqual([
      8, 64, 708, 7538, 85090,
    ]);
  });
});
