/** Side to move. The sign matches the sign of that side's pieces. */
export type Color = 1 | -1;
export const WHITE: Color = 1;
export const BLACK: Color = -1;

/** 0 = empty, ±1 = man, ±2 = king. Positive is White, negative is Black. */
export type Piece = -2 | -1 | 0 | 1 | 2;
export const EMPTY = 0;
export const MAN = 1;
export const KING = 2;

/** Square index 0–63: `rank * 8 + file`, where rank 0 is White's back rank and file 0 is the a-file. */
export type Square = number;

export interface Move {
  readonly from: Square;
  readonly to: Square;
  /** Landing squares in order. For a quiet move this is `[to]`. */
  readonly path: readonly Square[];
  /** Captured squares in the order they were jumped. Empty for a quiet move. */
  readonly captures: readonly Square[];
  /** The pieces that stood on `captures`, needed to undo the move. */
  readonly capturedPieces: readonly Piece[];
  /** True when a man ends the move on the far rank and becomes a king. */
  readonly promotes: boolean;
}

export type GameResult =
  | {
      readonly winner: Color;
      readonly reason: 'no-pieces' | 'no-moves' | 'resignation' | 'timeout';
    }
  | {
      readonly winner: null;
      readonly reason: 'one-piece-each' | 'repetition' | 'no-progress';
    };

export const colorOf = (piece: Piece): Color | 0 => Math.sign(piece) as Color | 0;
export const isKing = (piece: Piece): boolean => piece === 2 || piece === -2;
export const opponent = (color: Color): Color => (color === WHITE ? BLACK : WHITE);
export const rankOf = (square: Square): number => square >> 3;
export const fileOf = (square: Square): number => square & 7;
/** The rank on which a man of `color` promotes. */
export const promotionRank = (color: Color): number => (color === WHITE ? 7 : 0);
