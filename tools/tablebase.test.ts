/**
 * Verifies the committed tablebase file independently of the generator: every sampled
 * entry must equal the value implied by its successors (a retrograde-analysis fixpoint),
 * and the search must agree with it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Board, Game, generateMoves, toFen } from '../src/engine';
import type { Piece } from '../src/engine';
import { MATE, Searcher, mateIn } from '../src/ai/search';
import type { Outcome } from '../src/ai/tablebase';
import { SIGNATURES, TABLE_SIZE, Tablebase, decode, flipColours } from '../src/ai/tablebase';

const file = resolve(import.meta.dirname, '../public/tablebase/3pieces.bin.gz');
const tablebase = new Tablebase(new Uint8Array(gunzipSync(readFileSync(file))));

/** The outcome of `board` derived only from the outcomes of its successors. */
function derive(board: Board): Outcome {
  const moves = generateMoves(board);
  if (moves.length === 0) return { result: 'loss', plies: 0 };
  let shortestWin = Infinity;
  let longestLoss = -1;
  let allLose = true;
  for (const move of moves) {
    board.make(move);
    const white = board.count(1);
    const black = board.count(-1);
    const toMove = board.turn === 1 ? white : black;
    let next: Outcome;
    if (toMove === 0) next = { result: 'loss', plies: 0 };
    else if (white === 1 && black === 1) next = { result: 'draw' };
    else {
      const probed = tablebase.probe(board);
      if (!probed) throw new Error('successor not covered');
      next = probed;
    }
    board.unmake(move);
    if (next.result === 'loss') shortestWin = Math.min(shortestWin, next.plies + 1);
    if (next.result === 'win') longestLoss = Math.max(longestLoss, next.plies + 1);
    else allLose = false;
  }
  if (shortestWin !== Infinity) return { result: 'win', plies: shortestWin };
  if (allLose) return { result: 'loss', plies: longestLoss };
  return { result: 'draw' };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('three-piece tablebase', () => {
  it('has one table per signature', () => {
    expect(tablebase.data.length).toBe(SIGNATURES.length * TABLE_SIZE);
  });

  it('is consistent: every sampled entry follows from its successors', { timeout: 60_000 }, () => {
    const random = mulberry32(3);
    const board = new Board();
    let checked = 0;
    while (checked < 30_000) {
      const signature = SIGNATURES[Math.floor(random() * SIGNATURES.length)];
      if (!signature) continue;
      const index = Math.floor(random() * TABLE_SIZE);
      const stored = decode(
        tablebase.data[SIGNATURES.indexOf(signature) * TABLE_SIZE + index] ?? 255,
      );
      if (!stored) continue; // not a valid position
      const side = index & 1;
      const rest = index >> 1;
      const [w0, w1, b] = [rest >> 12, (rest >> 6) & 63, rest & 63];
      board.squares.fill(0);
      board.set(w0, signature.white[0] === 'K' ? 2 : 1);
      board.set(w1, signature.white[1] === 'K' ? 2 : 1);
      board.set(b, signature.black === 'K' ? -2 : -1);
      board.turn = side === 0 ? 1 : -1;
      expect(stored, `${signature.name} #${index}`).toEqual(derive(board));
      checked++;
    }
  });

  it('gives the same answer for a position and its colour-flipped twin', () => {
    const game = new Game('W:WKa1,Kh1:Bd5');
    const outcome = tablebase.probe(game.board);
    expect(outcome).toEqual({ result: 'win', plies: 5 });
    expect(tablebase.probe(flipColours(game.board))).toEqual(outcome);
    expect(tablebase.probe(new Game('B:Wd4:BKa8,Kh8').board)).toEqual(outcome);
  });

  it('knows that two kings cannot force a win against a lone king', () => {
    expect(tablebase.probe(new Game('W:WKa1,Kb1:BKh8').board)).toEqual({ result: 'draw' });
  });

  it('agrees with the search, which then plays endgames perfectly', () => {
    const game = new Game('W:WKa1,Kh1:Bd5');
    const plain = new Searcher(16).search(game, { maxDepth: 10 });
    const searcher = new Searcher(16);
    searcher.tablebase = tablebase;
    const withTable = searcher.search(game, { maxDepth: 2 });
    expect(withTable.score).toBe(plain.score);
    expect(withTable.score).toBe(MATE - 5);
    expect(mateIn(withTable.score)).toBe(3);
  });

  it('matches an independent search on random positions', { timeout: 120_000 }, () => {
    // A plain alpha-beta search (no tablebase) must find exactly the tablebase's distance for
    // short wins and losses, and must never find a forced result in a tablebase draw.
    const random = mulberry32(9);
    const searcher = new Searcher(18);
    let wins = 0;
    let draws = 0;
    while (wins < 25 || draws < 25) {
      const board = new Board();
      const kinds = [
        random() < 0.5 ? 2 : 1,
        random() < 0.5 ? 2 : 1,
        random() < 0.5 ? -2 : -1,
      ] as const;
      const squares = new Set<number>();
      while (squares.size < 3) squares.add(Math.floor(random() * 64));
      [...squares].forEach((square, i) => {
        board.set(square, kinds[i] as Piece);
      });
      board.turn = random() < 0.5 ? 1 : -1;
      const outcome = tablebase.probe(board);
      if (!outcome) continue; // e.g. a man on its promotion rank
      const fen = toFen(board);
      let position: Game;
      try {
        position = new Game(fen);
      } catch {
        continue;
      }
      if (position.isOver) continue;
      const score = searcher.search(position, { maxDepth: 7 }).score;
      if (outcome.result === 'draw') {
        if (draws >= 25) continue;
        draws++;
        expect(mateIn(score), fen).toBeNull();
      } else if (outcome.plies <= 5) {
        if (wins >= 25) continue;
        wins++;
        const expected = MATE - outcome.plies;
        expect(score, fen).toBe(outcome.result === 'win' ? expected : -expected);
      }
    }
  });

  it('is ignored for positions it does not cover', () => {
    expect(tablebase.probe(new Game().board)).toBeNull();
    expect(tablebase.probe(new Game('W:WKa1,Kb1:BKh8,Kg8').board)).toBeNull();
  });
});
