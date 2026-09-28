import { Board } from './board';
import { parseSquare, squareName } from './notation';
import type { Color, Piece } from './types';
import { BLACK, KING, MAN, WHITE, colorOf, isKing } from './types';

/**
 * Positions use the draughts FEN convention: side to move, then each side's pieces,
 * with `K` marking kings. For example `W:Wa2,b2,Kc4:Bd6,Ke8`.
 */
export const INITIAL_FEN =
  'W:Wa2,b2,c2,d2,e2,f2,g2,h2,a3,b3,c3,d3,e3,f3,g3,h3:Ba6,b6,c6,d6,e6,f6,g6,h6,a7,b7,c7,d7,e7,f7,g7,h7';

const COLOR_CODES: Record<string, Color> = { W: WHITE, B: BLACK };

export function parseFen(fen: string): Board {
  const [turnCode, ...sections] = fen.trim().split(':');
  const turn = COLOR_CODES[turnCode?.toUpperCase() ?? ''];
  if (turn === undefined || sections.length !== 2) throw new Error(`Invalid FEN: "${fen}"`);

  const board = new Board(undefined, turn);
  const sidesSeen = new Set<Color>();
  for (const section of sections) {
    const color = COLOR_CODES[section.charAt(0).toUpperCase()];
    if (color === undefined || sidesSeen.has(color)) throw new Error(`Invalid FEN: "${fen}"`);
    sidesSeen.add(color);

    for (const token of section.slice(1).split(',')) {
      const name = token.trim();
      if (name === '') continue;
      const king = name.charAt(0).toUpperCase() === 'K';
      const square = parseSquare(king ? name.slice(1) : name);
      if (board.get(square) !== 0) throw new Error(`Square ${name} is listed twice`);
      board.set(square, (color * (king ? KING : MAN)) as Piece);
    }
  }
  return board;
}

export function toFen(board: Board): string {
  const pieces = (color: Color): string => {
    const tokens: string[] = [];
    for (let square = 0; square < 64; square++) {
      const piece = board.get(square);
      if (colorOf(piece) === color) tokens.push(`${isKing(piece) ? 'K' : ''}${squareName(square)}`);
    }
    return tokens.join(',');
  };
  return `${board.turn === WHITE ? 'W' : 'B'}:W${pieces(WHITE)}:B${pieces(BLACK)}`;
}
