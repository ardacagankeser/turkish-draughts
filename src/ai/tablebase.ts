import type { Board, Piece } from '../engine';
import { BLACK, WHITE } from '../engine';

/**
 * Endgame tablebase for every position with three pieces: two against one.
 * One against two is looked up through the colour-flipped position.
 *
 * Each material signature, e.g. two white kings against a black man ("KK-M"), is a table of
 * 64³ × 2 bytes indexed by the squares of White's two pieces, Black's piece and the side
 * to move. A byte stores the exact result for the side to move (see `decode`).
 */

type Kind = 'K' | 'M';
export interface Signature {
  readonly name: string;
  readonly white: readonly [Kind, Kind];
  readonly black: Kind;
}

/** Ordered so that a man's promotion only ever leads to a signature earlier in the list. */
export const SIGNATURES: readonly Signature[] = [
  { name: 'KK-K', white: ['K', 'K'], black: 'K' },
  { name: 'KK-M', white: ['K', 'K'], black: 'M' },
  { name: 'KM-K', white: ['K', 'M'], black: 'K' },
  { name: 'KM-M', white: ['K', 'M'], black: 'M' },
  { name: 'MM-K', white: ['M', 'M'], black: 'K' },
  { name: 'MM-M', white: ['M', 'M'], black: 'M' },
];

export const TABLE_SIZE = 64 * 64 * 64 * 2;

/** Byte encoding. */
export const DRAW = 0;
export const INVALID = 255;
const LOSS_BASE = 128;
const MAX_DISTANCE = 126;

export type Outcome =
  { readonly result: 'win' | 'loss'; readonly plies: number } | { readonly result: 'draw' };

export const encodeWin = (plies: number): number => {
  if (plies < 1 || plies > MAX_DISTANCE) throw new Error(`Win distance ${plies} out of range`);
  return plies;
};
export const encodeLoss = (plies: number): number => {
  if (plies < 0 || plies > MAX_DISTANCE) throw new Error(`Loss distance ${plies} out of range`);
  return LOSS_BASE + plies;
};

export function decode(byte: number): Outcome | null {
  if (byte === INVALID) return null;
  if (byte === DRAW) return { result: 'draw' };
  if (byte < LOSS_BASE) return { result: 'win', plies: byte };
  return { result: 'loss', plies: byte - LOSS_BASE };
}

const kindOf = (piece: Piece): Kind => (piece === 2 || piece === -2 ? 'K' : 'M');

/** Signature position and table index of a two-against-one position, White having two. */
export interface Located {
  readonly signature: number;
  readonly index: number;
}

/**
 * Finds the table entry for `board` if it has two white pieces and one black piece.
 * White's pieces are ordered kings first, and by square when they are the same kind.
 */
export function locate(board: Board): Located | null {
  let w0 = -1;
  let w1 = -1;
  let b = -1;
  for (let square = 0; square < 64; square++) {
    const piece = board.get(square);
    if (piece > 0) {
      if (w0 < 0) w0 = square;
      else if (w1 < 0) w1 = square;
      else return null;
    } else if (piece < 0) {
      if (b >= 0) return null;
      b = square;
    }
  }
  if (w1 < 0 || b < 0) return null;
  let first = w0;
  let second = w1;
  // Kings before men; squares ascending within a kind (w0 < w1 already).
  if (kindOf(board.get(w0)) === 'M' && kindOf(board.get(w1)) === 'K') {
    first = w1;
    second = w0;
  }
  const white = `${kindOf(board.get(first))}${kindOf(board.get(second))}`;
  const name = `${white}-${kindOf(board.get(b))}`;
  const signature = SIGNATURES.findIndex((s) => s.name === name);
  if (signature < 0) return null;
  return { signature, index: tableIndex(first, second, b, board.turn === WHITE ? 0 : 1) };
}

export const tableIndex = (w0: number, w1: number, b: number, side: 0 | 1): number =>
  ((w0 * 64 + w1) * 64 + b) * 2 + side;

/** The same position with colours swapped and the board turned around. */
export function flipColours(board: Board): Board {
  const flipped = board.clone();
  for (let square = 0; square < 64; square++) {
    const mirror = (7 - (square >> 3)) * 8 + (square & 7);
    flipped.set(mirror, -board.get(square) as Piece);
  }
  flipped.turn = board.turn === WHITE ? BLACK : WHITE;
  return flipped;
}

export class Tablebase {
  /** All signature tables back to back, in `SIGNATURES` order. */
  readonly data: Uint8Array;

  constructor(data: Uint8Array) {
    if (data.length !== SIGNATURES.length * TABLE_SIZE) {
      throw new Error(
        `Tablebase has ${data.length} bytes, expected ${SIGNATURES.length * TABLE_SIZE}`,
      );
    }
    this.data = data;
  }

  /** The exact result for the side to move, or `null` if the position is not covered. */
  probe(board: Board): Outcome | null {
    const direct = locate(board);
    const located = direct ?? locate(flipColours(board));
    if (!located) return null;
    return decode(this.data[located.signature * TABLE_SIZE + located.index] ?? INVALID);
  }
}
