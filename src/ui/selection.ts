import type { Move, Piece, Square } from '../engine';

/**
 * Click-to-move state. A move is chosen by picking a piece and then its destination.
 * When several capture chains reach the same destination, the player picks the landing
 * squares one by one instead (`path` holds the ones chosen so far).
 */
export interface Selection {
  readonly from: Square;
  readonly path: readonly Square[];
}

export type ClickResult =
  | { readonly type: 'select'; readonly selection: Selection | null }
  | { readonly type: 'play'; readonly move: Move };

/** Moves still possible for the current selection. */
export function candidates(moves: readonly Move[], selection: Selection): Move[] {
  return moves.filter(
    (move) =>
      move.from === selection.from && selection.path.every((square, i) => move.path[i] === square),
  );
}

/** Squares the player can click next: the next landing square of every candidate. */
export function nextSquares(moves: readonly Move[], selection: Selection): Set<Square> {
  const squares = new Set<Square>();
  for (const move of candidates(moves, selection)) {
    const next = move.path[selection.path.length];
    if (next !== undefined) squares.add(next);
  }
  return squares;
}

/** Final destinations of the candidates. */
export function destinations(moves: readonly Move[], selection: Selection): Set<Square> {
  return new Set(candidates(moves, selection).map((move) => move.to));
}

/** Squares holding a piece that has at least one legal move. */
export function movableSquares(moves: readonly Move[]): Set<Square> {
  return new Set(moves.map((move) => move.from));
}

export function click(
  moves: readonly Move[],
  selection: Selection | null,
  square: Square,
): ClickResult {
  const movable = movableSquares(moves);
  const reselect = (): ClickResult => ({
    type: 'select',
    selection: movable.has(square) ? { from: square, path: [] } : null,
  });

  if (!selection) return reselect();
  // Clicking the selected piece again deselects it. Mid-chain the start square is a
  // valid landing square (a king may loop back to it), so it is handled below.
  if (square === selection.from && selection.path.length === 0) {
    return { type: 'select', selection: null };
  }

  const options = candidates(moves, selection);

  // Shortcut: clicking a destination that only one candidate reaches plays it at once,
  // unless the square is also the next landing square of another chain.
  const step = selection.path.length;
  const reaching = options.filter((move) => move.to === square);
  const [only] = reaching;
  if (
    reaching.length === 1 &&
    only &&
    !options.some((move) => move !== only && move.path[step] === square)
  ) {
    return { type: 'play', move: only };
  }

  // Otherwise advance along the chain one landing square at a time.
  const following = options.filter((move) => move.path[step] === square);
  if (following.length > 0) {
    const path = [...selection.path, square];
    // All legal captures take the same number of pieces, so their paths are equally long:
    // once the path is complete it identifies exactly one move.
    const complete = following.find((move) => move.path.length === path.length);
    if (complete) return { type: 'play', move: complete };
    return { type: 'select', selection: { from: selection.from, path } };
  }

  return reselect();
}

/**
 * Squares a piece could be premoved to while the opponent thinks, as on lichess: its
 * movement pattern on an empty board (one or two steps forward or sideways for a man,
 * covering captures; its whole rank and file for a king). Whether the premove is legal is
 * only known after the opponent's move, when it is checked against the legal moves.
 */
export function premoveTargets(piece: Piece, from: Square): Set<Square> {
  const targets = new Set<Square>();
  const rank = from >> 3;
  const file = from & 7;
  const add = (r: number, f: number) => {
    if (r >= 0 && r < 8 && f >= 0 && f < 8) targets.add(r * 8 + f);
  };
  if (piece === 2 || piece === -2) {
    for (let i = 0; i < 8; i++) {
      if (i !== rank) add(i, file);
      if (i !== file) add(rank, i);
    }
    return targets;
  }
  const forward = piece > 0 ? 1 : -1;
  for (const steps of [1, 2]) {
    add(rank + forward * steps, file);
    add(rank, file + steps);
    add(rank, file - steps);
  }
  return targets;
}

/** Pieces already jumped by the part of a capture chain chosen so far, shown as ghosts. */
export function jumpedSoFar(moves: readonly Move[], selection: Selection): Square[] {
  if (selection.path.length === 0) return [];
  // Landing squares fix the captured pieces: the same prefix means the same captures.
  return candidates(moves, selection)[0]?.captures.slice(0, selection.path.length) ?? [];
}
