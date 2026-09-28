import { describe, expect, it } from 'vitest';
import { Board, Game, generateMoves, moveToNotation, parseFen } from '../engine';
import type { Move, Piece } from '../engine';
import { evaluate } from './evaluate';
import { LEVELS, LEVEL_OPTIONS, acceptsDraw } from './levels';
import { MATE, Searcher, mateIn } from './search';
import { hashBoard, moveDelta } from './zobrist';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The notation of the chosen move; fails the test if there is none. */
function chosen(result: { readonly move: Move | null }): string {
  if (!result.move) throw new Error('expected a move');
  return moveToNotation(result.move);
}

describe('zobrist hashing', () => {
  it('updates incrementally exactly like a full recomputation', () => {
    const random = mulberry32(7);
    const delta = { hi: 0, lo: 0 };
    for (let game = 0; game < 30; game++) {
      const board = Board.initial();
      let hash = hashBoard(board);
      for (let ply = 0; ply < 150; ply++) {
        const moves = generateMoves(board);
        const move = moves[Math.floor(random() * moves.length)];
        if (!move) break;
        moveDelta(board, move, delta);
        board.make(move);
        hash = { hi: hash.hi ^ delta.hi, lo: hash.lo ^ delta.lo };
        expect(hash).toEqual(hashBoard(board));
      }
    }
  });

  it('distinguishes the side to move', () => {
    expect(hashBoard(parseFen('W:Wa2:Bh7'))).not.toEqual(hashBoard(parseFen('B:Wa2:Bh7')));
  });
});

describe('evaluate', () => {
  it('scores both sides alike: a mirrored position with sides swapped scores the same', () => {
    const random = mulberry32(11);
    for (let i = 0; i < 200; i++) {
      const board = Board.initial();
      for (let ply = 0; ply < 30; ply++) {
        const move = generateMoves(board)[Math.floor(random() * 10)];
        if (!move) break;
        board.make(move);
      }
      const mirror = new Board(undefined, board.turn === 1 ? -1 : 1);
      for (let square = 0; square < 64; square++) {
        const rank = square >> 3;
        const file = square & 7;
        mirror.set((7 - rank) * 8 + file, -board.get(square) as Piece);
      }
      expect(evaluate(mirror) + 0).toBe(evaluate(board) + 0);
    }
  });

  it('values material first', () => {
    expect(evaluate(parseFen('W:Wa2,b2:Bh7'))).toBeGreaterThan(50);
    expect(evaluate(parseFen('B:Wa2,b2:Bh7'))).toBeLessThan(-50);
    expect(evaluate(parseFen('W:WKa1:Bh7,g7'))).toBeGreaterThan(0);
  });
});

describe('Searcher', () => {
  it('returns a legal move and leaves the game untouched', () => {
    const game = new Game();
    const before = game.fen();
    const result = new Searcher(16).search(game, { maxDepth: 4 });
    expect(game.fen()).toBe(before);
    expect(game.legalMoves.map(moveToNotation)).toContain(chosen(result));
    expect(result.depth).toBe(4);
    expect(result.pv[0]).toBe(result.move);
  });

  it('returns no move once the game is over', () => {
    const game = new Game('W:Wd4:Bd5,a8');
    game.play('d4xd6');
    expect(new Searcher(16).search(game, { maxDepth: 3 }).move).toBeNull();
  });

  it('finds a forced win and reports it as a mate score', () => {
    // Two kings against a lone man: the man is caught within three moves.
    const result = new Searcher(16).search(new Game('W:WKa1,Kh1:Bd5'), { maxDepth: 10 });
    expect(result.score).toBeGreaterThan(MATE - 20);
    expect(mateIn(result.score)).toBe(3);
  });

  it('sees that it is lost', () => {
    const result = new Searcher(16).search(new Game('B:WKa1,Kh1:Bd5'), { maxDepth: 10 });
    expect(mateIn(result.score)).toBeLessThan(0);
  });

  it('plays forced moves even with a tiny budget', () => {
    const game = new Game('W:WKh1,e5,a2:Ba7,b7,c7,d7,e7,g7,a6,b6,c6,d6,f6,h6,a5,c5,f5');
    const result = new Searcher(16).search(game, { timeMs: 1 });
    expect(chosen(result)).toBe('h1xh7xf7');
  });

  it('respects the time limit and keeps a move from the last finished iteration', () => {
    const game = new Game();
    const searcher = new Searcher(18);
    const started = performance.now();
    const result = searcher.search(game, { timeMs: 150 });
    expect(performance.now() - started).toBeLessThan(600);
    expect(result.depth).toBeGreaterThanOrEqual(1);
    // An aborted iteration must leave the searcher usable and the board consistent.
    const again = searcher.search(game, { maxDepth: 3 });
    expect(game.legalMoves.map(moveToNotation)).toContain(chosen(again));
  });

  it('scores a repeated position as a draw', () => {
    // Kings only, so every move is reversible. After a full cycle the start position repeats:
    // going back into it now counts as a draw for the search.
    const game = new Game('W:WKa1,Kb1:BKh8,Kg8');
    for (const move of ['a1-a2', 'h8-h7', 'a2-a1', 'h7-h8']) game.play(move);
    const result = new Searcher(16).search(game, { maxDepth: 1 });
    expect(Math.abs(result.score)).toBeLessThan(MATE - 1000);
  });

  it('chooses among near-equal moves when a random margin is set, deterministically per seed', () => {
    const game = new Game();
    const pick = (seed: number) =>
      chosen(
        new Searcher(16).search(game, {
          maxDepth: 2,
          randomMargin: 1000,
          random: mulberry32(seed),
        }),
      );
    expect(pick(1)).toBe(pick(1));
    const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(pick));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('requires a time limit or a depth limit', () => {
    expect(() => new Searcher(16).search(new Game(), {})).toThrow();
  });
});

describe('levels', () => {
  it('are all playable', () => {
    const searcher = new Searcher(16);
    for (const level of LEVELS) {
      const options = { ...LEVEL_OPTIONS[level], timeMs: 50 };
      expect(searcher.search(new Game(), options).move).not.toBeNull();
    }
  });

  it('accept a draw unless clearly better', () => {
    expect(acceptsDraw(-300)).toBe(true);
    expect(acceptsDraw(0)).toBe(true);
    expect(acceptsDraw(10)).toBe(true);
    expect(acceptsDraw(100)).toBe(false);
  });
});
