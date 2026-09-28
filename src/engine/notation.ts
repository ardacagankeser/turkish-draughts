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
 * Finds the legal move matching `notation`. Accepts the full notation, or just the
 * start and end squares (`h1xf7`, `h1-f7`) when that is unambiguous.
 */
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
    if (matches.length > 1) throw new Error(`Ambiguous move "${notation}"`);
  }
  throw new Error(`Illegal move "${notation}"`);
}
