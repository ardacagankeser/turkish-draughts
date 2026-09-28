import type { Color, Move, Piece, Square } from './types';
import { BLACK, EMPTY, KING, MAN, WHITE, colorOf, opponent } from './types';

export const SQUARE_COUNT = 64;

/** Mutable board with in-place make/unmake, suitable for search. */
export class Board {
  readonly squares: Int8Array;
  turn: Color;

  constructor(squares: Int8Array = new Int8Array(SQUARE_COUNT), turn: Color = WHITE) {
    if (squares.length !== SQUARE_COUNT) throw new Error('A board needs exactly 64 squares');
    this.squares = squares;
    this.turn = turn;
  }

  /** The standard starting position: men on ranks 2–3 (White) and 6–7 (Black). */
  static initial(): Board {
    const board = new Board();
    for (let square = 8; square < 24; square++) board.set(square, (WHITE * MAN) as Piece);
    for (let square = 40; square < 56; square++) board.set(square, (BLACK * MAN) as Piece);
    return board;
  }

  get(square: Square): Piece {
    return (this.squares[square] ?? EMPTY) as Piece;
  }

  set(square: Square, piece: Piece): void {
    this.squares[square] = piece;
  }

  clone(): Board {
    return new Board(this.squares.slice(), this.turn);
  }

  count(color: Color): number {
    let total = 0;
    for (const piece of this.squares) if (colorOf(piece as Piece) === color) total++;
    return total;
  }

  /** Applies a move generated for this position. */
  make(move: Move): void {
    const piece = this.get(move.from);
    this.set(move.from, EMPTY);
    for (const square of move.captures) this.set(square, EMPTY);
    this.set(move.to, move.promotes ? ((this.turn * KING) as Piece) : piece);
    this.turn = opponent(this.turn);
  }

  /** Reverts `move`, which must be the last move applied with `make`. */
  unmake(move: Move): void {
    this.turn = opponent(this.turn);
    const piece = move.promotes ? ((this.turn * MAN) as Piece) : this.get(move.to);
    this.set(move.to, EMPTY);
    move.captures.forEach((square, i) => {
      this.set(square, move.capturedPieces[i] ?? EMPTY);
    });
    this.set(move.from, piece);
  }

  /** A compact key identifying the position (placement and side to move). */
  key(): string {
    return `${this.turn}:${this.squares.join(',')}`;
  }
}
