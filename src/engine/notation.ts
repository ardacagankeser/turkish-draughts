import type { Move, Square } from './types';
import { fileOf, rankOf } from './types';

const FILES = 'abcdefgh';

/** `0` -> `a1`, `63` -> `h8`. */
export function squareName(square: Square): string {
  return `${FILES.charAt(fileOf(square))}${rankOf(square) + 1}`;
}

/** `a1` -> `0`. Throws on anything that is not a square name. */
export function parseSquare(name: string): Square {
  const match = /^([a-h])([1-8])$/.exec(name.trim().toLowerCase());
  if (!match?.[1] || !match[2]) throw new Error(`Invalid square: "${name}"`);
  return (Number(match[2]) - 1) * 8 + FILES.indexOf(match[1]);
}

/**
 * Quiet moves are written `d3-d4`. Captures list the start square and every
 * landing square: `f3xf5xd5`.
 */
export function moveToNotation(move: Move): string {
  if (move.captures.length === 0) return `${squareName(move.from)}-${squareName(move.to)}`;
  return [move.from, ...move.path].map(squareName).join('x');
}

/**
 * The notation used in the TÜDAF rulebook: the start square followed by every
 * captured square (`f3xf4xe5`). That alone does not say where a king stops after its
 * last capture, so when another legal move in `legalMoves` captures the same pieces
 * from the same square, the landing square is appended: `h1xh6→h8`.
 */
export function moveToTudafNotation(move: Move, legalMoves: readonly Move[]): string {
  if (move.captures.length === 0) return moveToNotation(move);
  const text = [move.from, ...move.captures].map(squareName).join('x');
  const captured = new Set(move.captures);
  const ambiguous = legalMoves.some(
    (other) =>
      other.from === move.from &&
      other.to !== move.to &&
      other.captures.length === captured.size &&
      other.captures.every((square) => captured.has(square)),
  );
  return ambiguous ? `${text}→${squareName(move.to)}` : text;
}

/**
 * Finds the legal move matching `notation`. Accepts the full notation, or just the
 * start and end squares (`h1xf7`, `h1-f7`) when that is unambiguous.
 */
/** Thrown by `findMove` when only the start and end squares were given and several moves fit. */
export class AmbiguousMoveError extends Error {
  constructor(notation: string) {
    super(`Ambiguous move "${notation}"`);
    this.name = 'AmbiguousMoveError';
  }
}

export function findMove(moves: readonly Move[], notation: string): Move {
  const wanted = notation.trim().toLowerCase();
  const exact = moves.find((move) => moveToNotation(move) === wanted);
  if (exact) return exact;

  const squares = wanted.split(/[x-]/);
  if (squares.length === 2 && squares[0] && squares[1]) {
    const from = parseSquare(squares[0]);
    const to = parseSquare(squares[1]);
    const matches = moves.filter((move) => move.from === from && move.to === to);
    if (matches.length === 1 && matches[0]) return matches[0];
    if (matches.length > 1) throw new AmbiguousMoveError(notation);
  }
  throw new Error(`Illegal move "${notation}"`);
}
