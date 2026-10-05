import { describe, expect, it } from 'vitest';
import {
  AmbiguousMoveError,
  BLACK,
  Game,
  INITIAL_FEN,
  NO_PROGRESS_LIMIT,
  WHITE,
  parseFen,
  toFen,
} from '.';

describe('Game', () => {
  it('starts from the standard position with White to move', () => {
    const game = new Game();
    expect(game.fen()).toBe(INITIAL_FEN);
    expect(game.turn).toBe(WHITE);
    expect(game.legalMoves).toHaveLength(8);
    expect(game.result).toBeNull();
  });

  it('rejects illegal moves and malformed notation', () => {
    const game = new Game();
    expect(() => game.play('a2-a3')).toThrow('Illegal move');
    expect(() => game.play('a3-a5')).toThrow('Illegal move');
    expect(() => game.play('z9-a1')).toThrow('Invalid square');
  });

  it('accepts short notation when it is unambiguous', () => {
    const game = new Game('W:WKh1,e5,a2:Ba7,b7,c7,d7,e7,g7,a6,b6,c6,d6,f6,h6,a5,c5,f5');
    expect(game.play('h1xf7').path).toHaveLength(2);
  });

  it('asks for every landing square when two captures share their start and end', () => {
    const game = new Game('W:Wd2:Bd3,c4,b5,c2,b3');
    expect(() => game.play('d2xb6')).toThrow(AmbiguousMoveError);
    expect(game.play('d2xb2xb4xb6').captures).toHaveLength(3);
  });

  it('undoes moves back to the start', () => {
    const game = new Game();
    game.play('a3-a4');
    game.play('h6-h5');
    expect(game.history).toHaveLength(2);
    expect(game.undo()).toBeDefined();
    expect(game.undo()).toBeDefined();
    expect(game.undo()).toBeUndefined();
    expect(game.fen()).toBe(INITIAL_FEN);
  });

  it('exposes a copy of the board, not the live one', () => {
    const game = new Game();
    game.board.set(0, 0);
    expect(game.fen()).toBe(INITIAL_FEN);
  });
});

describe('end of game', () => {
  it('is won by capturing every opposing piece', () => {
    const game = new Game('W:Wd4,a1:Bd5');
    game.play('d4xd6');
    expect(game.result).toEqual({ winner: WHITE, reason: 'no-pieces' });
    expect(game.legalMoves).toEqual([]);
    expect(() => game.play('a1-a2')).toThrow('The game is over');
  });

  it('is won when the opponent has no legal move', () => {
    // Black's only man cannot move forward or sideways, nor capture.
    const game = new Game('B:Wa3,a4,b5,c5:Ba5');
    expect(game.result).toEqual({ winner: WHITE, reason: 'no-moves' });
  });

  it('is drawn when each side has a single piece left', () => {
    const game = new Game('W:Wd4:Bd5,a8');
    game.play('d4xd6');
    expect(game.result).toEqual({ winner: null, reason: 'one-piece-each' });
  });

  it('is drawn when the same position occurs for the third time', () => {
    const game = new Game('W:WKa1,Kb1:BKh8,Kg8');
    const cycle = ['a1-a2', 'h8-h7', 'a2-a1', 'h7-h8'];
    for (const move of [...cycle, ...cycle]) game.play(move);
    expect(game.result).toEqual({ winner: null, reason: 'repetition' });
    game.undo();
    expect(game.result).toBeNull();
  });

  it(`is drawn after ${NO_PROGRESS_LIMIT} plies without a capture or a man move`, () => {
    // Two kings each, kept in separate corners so they can never attack each other.
    const game = new Game('W:WKa1,Kb2:BKg7,Kh8');
    const inRegion = (square: number) => {
      const rank = square >> 3;
      const file = square & 7;
      return game.turn === WHITE ? file <= 1 && rank <= 3 : file >= 6 && rank >= 4;
    };
    const seen = new Map<string, number>();
    while (!game.isOver) {
      // Pick the in-region move leading to the least-visited position.
      let best: { move: (typeof game.legalMoves)[number]; visits: number } | null = null;
      for (const move of game.legalMoves) {
        if (!inRegion(move.to)) continue;
        game.play(move);
        const visits = seen.get(game.fen()) ?? 0;
        game.undo();
        if (!best || visits < best.visits) best = { move, visits };
      }
      if (!best) throw new Error('No move inside the region');
      game.play(best.move);
      seen.set(game.fen(), (seen.get(game.fen()) ?? 0) + 1);
    }
    expect(game.result).toEqual({ winner: null, reason: 'no-progress' });
    expect(game.history).toHaveLength(NO_PROGRESS_LIMIT);
  });

  it('records a draw by agreement', () => {
    const game = new Game();
    game.agreeDraw();
    expect(game.result).toEqual({ winner: null, reason: 'agreement' });
    expect(game.legalMoves).toEqual([]);
  });

  it('keeps a move list in TÜDAF notation', () => {
    const game = new Game('W:WKh1,e5,a2:Ba7,b7,c7,d7,a6,b6,c6,d6,h6,a5,c5,f5');
    game.play('h1xh8');
    game.play('f5xd5');
    expect(game.moveList).toEqual(['h1xh6→h8', 'f5xe5']);
    game.undo();
    expect(game.moveList).toEqual(['h1xh6→h8']);
  });

  it('records resignation and timeouts', () => {
    const resigned = new Game();
    resigned.resign(WHITE);
    expect(resigned.result).toEqual({ winner: BLACK, reason: 'resignation' });

    const flagged = new Game();
    flagged.timeout(BLACK);
    expect(flagged.result).toEqual({ winner: WHITE, reason: 'timeout' });
  });
});

describe('FEN', () => {
  it('round-trips positions', () => {
    for (const fen of [INITIAL_FEN, 'B:WKa1,d4:BKe5,h8', 'W:W:Ba2,a3']) {
      expect(toFen(parseFen(fen))).toBe(fen);
    }
  });

  it('rejects malformed input', () => {
    expect(() => parseFen('')).toThrow();
    expect(() => parseFen('X:Wa1:Bb2')).toThrow();
    expect(() => parseFen('W:Wa1')).toThrow();
    expect(() => parseFen('W:Wa1:Wb2')).toThrow();
    expect(() => parseFen('W:Wa1:Ba1')).toThrow('listed twice');
    expect(() => parseFen('W:Wi9:Bb2')).toThrow('Invalid square');
  });
});
