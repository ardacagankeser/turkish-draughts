import type { Board, Color, Piece, Square } from '../engine';
import { Game, KING, MAN, colorOf, promotionRank, rankOf, toFen } from '../engine';

/** What a click on the editor's board does: put down one of the four pieces, or erase. */
export type Tool = Piece;

export const TOOLS: readonly Tool[] = [MAN, KING, -MAN as Piece, -KING as Piece, 0];

/**
 * Puts the tool's piece on `square`, or takes it away when the same piece is already
 * there. A man placed on its promotion rank becomes a king, as it would in a game.
 */
export function place(board: Board, square: Square, tool: Tool): Board {
  const next = board.clone();
  let piece = tool;
  const color = colorOf(piece);
  if (color !== 0 && Math.abs(piece) === MAN && rankOf(square) === promotionRank(color)) {
    piece = (color * KING) as Piece;
  }
  next.set(square, board.get(square) === piece ? 0 : piece);
  return next;
}

export function withTurn(board: Board, turn: Color): Board {
  const next = board.clone();
  next.turn = turn;
  return next;
}

/** Why a position cannot be analysed, if it cannot. */
export type Problem = 'noWhite' | 'noBlack' | 'over';

export function problems(board: Board): Problem[] {
  const found: Problem[] = [];
  if (board.count(1) === 0) found.push('noWhite');
  if (board.count(-1) === 0) found.push('noBlack');
  // For example no legal move for the side to move, or one piece each.
  if (found.length === 0 && new Game(toFen(board)).isOver) found.push('over');
  return found;
}
