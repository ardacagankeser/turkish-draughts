import type { Board, Move, Piece, Square } from '../engine';

/** A piece with a stable identity, so the board can animate it from square to square. */
export interface UiPiece {
  readonly id: number;
  readonly square: Square;
  readonly piece: Piece;
}

let nextId = 1;

/** Fresh identities for every piece on `board` (after loading or undoing). */
export function piecesFromBoard(board: Board): UiPiece[] {
  const pieces: UiPiece[] = [];
  for (let square = 0; square < 64; square++) {
    const piece = board.get(square);
    if (piece !== 0) pieces.push({ id: nextId++, square, piece });
  }
  return pieces;
}

/** Applies `move`: the moving piece keeps its identity, captured pieces are returned separately. */
export function applyMove(
  pieces: readonly UiPiece[],
  move: Move,
): { pieces: UiPiece[]; captured: UiPiece[] } {
  const capturedSquares = new Set(move.captures);
  const captured: UiPiece[] = [];
  const next: UiPiece[] = [];
  for (const piece of pieces) {
    if (piece.square === move.from) {
      const promoted = move.promotes ? ((piece.piece * 2) as Piece) : piece.piece;
      next.push({ ...piece, square: move.to, piece: promoted });
    } else if (capturedSquares.has(piece.square)) {
      captured.push(piece);
    } else {
      next.push(piece);
    }
  }
  return { pieces: next, captured };
}
