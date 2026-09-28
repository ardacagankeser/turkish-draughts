/**
 * Differential test: the optimized move generator must agree with a deliberately
 * naive reference implementation (coordinates, copied grids, no shared code) on
 * thousands of positions from random games and random piece placements.
 */
import { describe, expect, it } from 'vitest';
import { Board, generateMoves, parseFen, toFen } from '.';
import type { Piece } from '.';

type Grid = number[][]; // grid[rank][file]
interface RefMove {
  from: [number, number];
  to: [number, number];
  captures: [number, number][];
}

const inside = (r: number, f: number) => r >= 0 && r < 8 && f >= 0 && f < 8;
const cell = (grid: Grid, r: number, f: number) => grid[r]?.[f] ?? 0;
const copy = (grid: Grid): Grid => grid.map((row) => [...row]);

function referenceMoves(grid: Grid, side: number): Set<string> {
  const chains: RefMove[] = [];

  const explore = (
    g: Grid,
    king: boolean,
    from: [number, number],
    r: number,
    f: number,
    captures: [number, number][],
    last: [number, number] | null,
  ): void => {
    let extended = false;
    const dirs: [number, number][] = king
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
      : [
          [side, 0],
          [0, 1],
          [0, -1],
        ];
    for (const [dr, df] of dirs) {
      if (king && last && dr === -last[0] && df === -last[1]) continue;
      let k = 1;
      if (king) while (inside(r + dr * k, f + df * k) && cell(g, r + dr * k, f + df * k) === 0) k++;
      const er = r + dr * k;
      const ef = f + df * k;
      if (!inside(er, ef) || Math.sign(cell(g, er, ef)) !== -side) continue;
      const maxJump = king ? 8 : k + 1;
      for (let j = k + 1; j <= maxJump; j++) {
        const lr = r + dr * j;
        const lf = f + df * j;
        if (!inside(lr, lf) || cell(g, lr, lf) !== 0) break;
        const next = copy(g);
        (next[er] as number[])[ef] = 0;
        extended = true;
        explore(next, king, from, lr, lf, [...captures, [er, ef]], [dr, df]);
      }
    }
    if (!extended && captures.length > 0) chains.push({ from, to: [r, f], captures });
  };

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = cell(grid, r, f);
      if (Math.sign(piece) !== side) continue;
      const g = copy(grid);
      (g[r] as number[])[f] = 0;
      explore(g, Math.abs(piece) === 2, [r, f], r, f, [], null);
    }
  }

  const key = (m: RefMove) =>
    `${m.from[0] * 8 + m.from[1]}:${m.to[0] * 8 + m.to[1]}:${m.captures
      .map(([cr, cf]) => cr * 8 + cf)
      .sort((a, b) => a - b)
      .join(',')}`;

  if (chains.length > 0) {
    const longest = Math.max(...chains.map((m) => m.captures.length));
    return new Set(chains.filter((m) => m.captures.length === longest).map(key));
  }

  const quiet = new Set<string>();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = cell(grid, r, f);
      if (Math.sign(piece) !== side) continue;
      const king = Math.abs(piece) === 2;
      const dirs: [number, number][] = king
        ? [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]
        : [
            [side, 0],
            [0, 1],
            [0, -1],
          ];
      for (const [dr, df] of dirs) {
        for (let k = 1; k <= (king ? 7 : 1); k++) {
          const tr = r + dr * k;
          const tf = f + df * k;
          if (!inside(tr, tf) || cell(grid, tr, tf) !== 0) break;
          quiet.add(key({ from: [r, f], to: [tr, tf], captures: [] }));
        }
      }
    }
  }
  return quiet;
}

const toGrid = (board: Board): Grid =>
  Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, f) => board.get(r * 8 + f)));

const engineMoves = (board: Board): Set<string> =>
  new Set(
    generateMoves(board).map(
      (m) => `${m.from}:${m.to}:${[...m.captures].sort((a, b) => a - b).join(',')}`,
    ),
  );

/** Small deterministic PRNG so failures are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectAgreement(board: Board): void {
  const fen = toFen(board);
  const expected = [...referenceMoves(toGrid(board), board.turn)].sort();
  const actual = [...engineMoves(board)].sort();
  expect(actual, fen).toEqual(expected);
  // Every generated move must be undone exactly.
  for (const move of generateMoves(board)) {
    board.make(move);
    board.unmake(move);
    expect(toFen(board), fen).toBe(fen);
  }
}

// These run thousands of positions; allow for slow CI machines and coverage instrumentation.
const HEAVY = { timeout: 30_000 };

describe('move generator vs reference implementation', () => {
  it('agrees along random games from the starting position', HEAVY, () => {
    const random = mulberry32(2026);
    let positions = 0;
    for (let game = 0; game < 100; game++) {
      const board = Board.initial();
      for (let ply = 0; ply < 200; ply++) {
        expectAgreement(board);
        positions++;
        const moves = generateMoves(board);
        const move = moves[Math.floor(random() * moves.length)];
        if (!move) break;
        board.make(move);
      }
    }
    expect(positions).toBeGreaterThan(5000);
  });

  it('agrees on random placements with many kings', HEAVY, () => {
    const random = mulberry32(42);
    for (let i = 0; i < 3000; i++) {
      const board = new Board(undefined, random() < 0.5 ? 1 : -1);
      const pieces = 2 + Math.floor(random() * 20);
      for (let p = 0; p < pieces; p++) {
        const square = Math.floor(random() * 64);
        const color = random() < 0.5 ? 1 : -1;
        const kind = random() < 0.4 ? 2 : 1;
        board.set(square, (color * kind) as Piece);
      }
      expectAgreement(board);
    }
  });

  it('agrees on a dense king position with long chains', () => {
    expectAgreement(parseFen('W:WKa1,Kh8:Bb3,b5,b7,d2,d4,d6,f3,f5,f7,g2,c8,Ke1'));
  });
});
