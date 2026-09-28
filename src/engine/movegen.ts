import type { Board } from './board';
import type { Color, Move, Piece, Square } from './types';
import { EMPTY, WHITE, colorOf, fileOf, isKing, promotionRank, rankOf } from './types';

export type Direction = 0 | 1 | 2 | 3;
export const NORTH: Direction = 0;
export const SOUTH: Direction = 1;
export const EAST: Direction = 2;
export const WEST: Direction = 3;

const ALL_DIRECTIONS: readonly Direction[] = [NORTH, SOUTH, EAST, WEST];
const WHITE_MAN_DIRECTIONS: readonly Direction[] = [NORTH, EAST, WEST];
const BLACK_MAN_DIRECTIONS: readonly Direction[] = [SOUTH, EAST, WEST];

/** `STEPS[dir * 64 + square]` is the neighbouring square in `dir`, or -1 off the board. */
const STEPS = new Int8Array(4 * 64);
for (let square = 0; square < 64; square++) {
  const rank = rankOf(square);
  const file = fileOf(square);
  STEPS[NORTH * 64 + square] = rank < 7 ? square + 8 : -1;
  STEPS[SOUTH * 64 + square] = rank > 0 ? square - 8 : -1;
  STEPS[EAST * 64 + square] = file < 7 ? square + 1 : -1;
  STEPS[WEST * 64 + square] = file > 0 ? square - 1 : -1;
}

export const step = (dir: Direction, square: Square): Square => STEPS[dir * 64 + square] ?? -1;

/** North <-> South, East <-> West. */
const reverse = (dir: Direction): Direction => (dir ^ 1) as Direction;

const manDirections = (color: Color): readonly Direction[] =>
  color === WHITE ? WHITE_MAN_DIRECTIONS : BLACK_MAN_DIRECTIONS;

/**
 * All legal moves for the side to move.
 *
 * Captures are mandatory and only the chains that capture the most pieces are legal.
 * Chains that capture the same set of pieces and end on the same square lead to the
 * same position, so only one of them is returned.
 */
export function generateMoves(board: Board): Move[] {
  const captures = generateCaptures(board);
  return captures.length > 0 ? captures : generateQuietMoves(board);
}

export function generateQuietMoves(board: Board): Move[] {
  const side = board.turn;
  const moves: Move[] = [];
  for (let from = 0; from < 64; from++) {
    const piece = board.get(from);
    if (colorOf(piece) !== side) continue;
    if (isKing(piece)) {
      for (const dir of ALL_DIRECTIONS) {
        for (let to = step(dir, from); to >= 0 && board.get(to) === EMPTY; to = step(dir, to)) {
          moves.push(quietMove(from, to, false));
        }
      }
    } else {
      for (const dir of manDirections(side)) {
        const to = step(dir, from);
        if (to >= 0 && board.get(to) === EMPTY) {
          moves.push(quietMove(from, to, rankOf(to) === promotionRank(side)));
        }
      }
    }
  }
  return moves;
}

const quietMove = (from: Square, to: Square, promotes: boolean): Move => ({
  from,
  to,
  path: [to],
  captures: [],
  capturedPieces: [],
  promotes,
});

interface CaptureSearch {
  readonly board: Board;
  readonly side: Color;
  from: Square;
  piece: Piece;
  readonly path: Square[];
  readonly captures: Square[];
  readonly capturedPieces: Piece[];
  readonly found: Move[];
  readonly seen: Set<string>;
  longest: number;
}

/** The longest capture chains available to the side to move (empty if there are none). */
export function generateCaptures(board: Board): Move[] {
  const search: CaptureSearch = {
    board,
    side: board.turn,
    from: 0,
    piece: EMPTY,
    path: [],
    captures: [],
    capturedPieces: [],
    found: [],
    seen: new Set(),
    longest: 1,
  };
  for (let from = 0; from < 64; from++) {
    const piece = board.get(from);
    if (colorOf(piece) !== board.turn) continue;
    search.from = from;
    search.piece = piece;
    // Lift the moving piece so it neither blocks its own path nor gets in the way.
    board.set(from, EMPTY);
    extendChain(search, from, null);
    board.set(from, piece);
  }
  return search.found;
}

/**
 * Depth-first search over capture chains from `at`. Captured pieces are removed as
 * they are jumped (and restored on the way back), so a piece cannot be jumped twice
 * and a removed piece can open a line later in the same chain.
 */
function extendChain(search: CaptureSearch, at: Square, lastDir: Direction | null): void {
  const { board, side } = search;
  const king = isKing(search.piece);
  let extended = false;

  for (const dir of king ? ALL_DIRECTIONS : manDirections(side)) {
    // A king may not turn back 180° between two jumps. A man never could: the square
    // behind it is the one it just captured, which is now empty.
    if (lastDir !== null && dir === reverse(lastDir)) continue;

    let target = step(dir, at);
    if (king) while (target >= 0 && board.get(target) === EMPTY) target = step(dir, target);
    if (target < 0) continue;
    const victim = board.get(target);
    if (colorOf(victim) !== -side) continue;

    let landing = step(dir, target);
    if (landing < 0 || board.get(landing) !== EMPTY) continue;

    board.set(target, EMPTY);
    search.captures.push(target);
    search.capturedPieces.push(victim);
    // A man lands directly behind the victim; a king on any empty square beyond it.
    do {
      extended = true;
      search.path.push(landing);
      extendChain(search, landing, dir);
      search.path.pop();
      landing = king ? step(dir, landing) : -1;
    } while (landing >= 0 && board.get(landing) === EMPTY);
    search.captures.pop();
    search.capturedPieces.pop();
    board.set(target, victim);
  }

  if (!extended && search.captures.length > 0) recordChain(search, at);
}

function recordChain(search: CaptureSearch, to: Square): void {
  const length = search.captures.length;
  if (length < search.longest) return;
  if (length > search.longest) {
    search.longest = length;
    search.found.length = 0;
    search.seen.clear();
  }
  const key = `${search.from}:${to}:${[...search.captures].sort((a, b) => a - b).join(',')}`;
  if (search.seen.has(key)) return;
  search.seen.add(key);

  // A man that reaches the far rank mid-chain keeps capturing as a man and is
  // promoted only once the move is over (TÜDAF rule 5).
  const promotes = !isKing(search.piece) && rankOf(to) === promotionRank(search.side);
  search.found.push({
    from: search.from,
    to,
    path: [...search.path],
    captures: [...search.captures],
    capturedPieces: [...search.capturedPieces],
    promotes,
  });
}

/** Number of leaf nodes `depth` plies deep. Used to verify move generation. */
export function perft(board: Board, depth: number): number {
  if (depth === 0) return 1;
  const moves = generateMoves(board);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    board.make(move);
    nodes += perft(board, depth - 1);
    board.unmake(move);
  }
  return nodes;
}
