import type { Board, Move, Piece, Square } from '../engine';

/**
 * Zobrist hashing with two independent 32-bit halves (`hi`, `lo`), giving a 64-bit key
 * without BigInt. `lo` indexes the transposition table and `hi` verifies the entry.
 */
const PIECE_KINDS = 5; // pieces -2..2 map to 0..4; index 2 (empty) is never used
const KEYS_HI = new Int32Array(PIECE_KINDS * 64);
const KEYS_LO = new Int32Array(PIECE_KINDS * 64);
export const SIDE_HI = 0x5bd1e995 | 0;
export const SIDE_LO = 0x27d4eb2f | 0;

// splitmix32, seeded so hashes are identical in every run and in every worker.
let state = 0x9e3779b9;
function next(): number {
  state = (state + 0x9e3779b9) | 0;
  let z = state;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) | 0;
}
for (let i = 0; i < PIECE_KINDS * 64; i++) {
  KEYS_HI[i] = next();
  KEYS_LO[i] = next();
}

const index = (piece: Piece, square: Square): number => (piece + 2) * 64 + square;
const keyHi = (piece: Piece, square: Square): number => KEYS_HI[index(piece, square)] ?? 0;
const keyLo = (piece: Piece, square: Square): number => KEYS_LO[index(piece, square)] ?? 0;

export interface Hash {
  hi: number;
  lo: number;
}

/** The full hash of a position (placement and side to move). */
export function hashBoard(board: Board): Hash {
  let hi = 0;
  let lo = 0;
  for (let square = 0; square < 64; square++) {
    const piece = board.get(square);
    if (piece === 0) continue;
    hi ^= keyHi(piece, square);
    lo ^= keyLo(piece, square);
  }
  if (board.turn === -1) {
    hi ^= SIDE_HI;
    lo ^= SIDE_LO;
  }
  return { hi, lo };
}

/**
 * The XOR difference `move` makes to the hash. It must be computed before the move is
 * made. Because XOR is its own inverse, the same delta also undoes the move.
 */
export function moveDelta(board: Board, move: Move, out: Hash): void {
  const piece = board.get(move.from);
  const landed = move.promotes ? ((piece * 2) as Piece) : piece;
  let hi = keyHi(piece, move.from) ^ keyHi(landed, move.to) ^ SIDE_HI;
  let lo = keyLo(piece, move.from) ^ keyLo(landed, move.to) ^ SIDE_LO;
  for (let i = 0; i < move.captures.length; i++) {
    const square = move.captures[i] ?? 0;
    const victim = move.capturedPieces[i] ?? 0;
    hi ^= keyHi(victim, square);
    lo ^= keyLo(victim, square);
  }
  out.hi = hi;
  out.lo = lo;
}
