import type { Color, Game, Move } from '../engine';
import { moveToNotation, moveToTudafNotation } from '../engine';
import type { Outcome, Tablebase } from '../ai';

/** The part of the tablebase the analysis board needs; tests pass a fake. */
export type Probe = Pick<Tablebase, 'probe'>;

export interface TablebaseMove {
  /** As the move list writes it (TÜDAF), and in landing notation to play it. */
  readonly notation: string;
  readonly landing: string;
  /** The exact result for the side making the move, or `null` if it is not covered. */
  readonly outcome: Outcome | null;
}

export interface TablebaseInfo {
  /** The exact result for the side to move. */
  readonly outcome: Outcome | null;
  readonly turn: Color;
  /** Every legal move, best first: the quickest wins, draws, then the slowest losses. */
  readonly moves: readonly TablebaseMove[];
}

/** Positions with this many pieces or fewer are in the tablebase. */
export const TABLEBASE_PIECES = 3;

/** Win and loss distances are kept in plies; people count moves. */
export const movesOf = (plies: number): number => Math.ceil(plies / 2);

/** The result for the side that just moved, from the position after its move. */
function outcomeAfter(tablebase: Probe, after: Game, mover: Color): Outcome | null {
  const result = after.result;
  if (result) {
    if (result.winner === null) return { result: 'draw' };
    return { result: result.winner === mover ? 'win' : 'loss', plies: 1 };
  }
  const reply = tablebase.probe(after.board);
  if (!reply) return null;
  if (reply.result === 'draw') return reply;
  // The opponent's win is our loss one ply later, and the other way round.
  return { result: reply.result === 'win' ? 'loss' : 'win', plies: reply.plies + 1 };
}

const rank = (outcome: Outcome | null): number => {
  if (!outcome) return 1e6;
  if (outcome.result === 'win') return outcome.plies;
  if (outcome.result === 'draw') return 1000;
  return 2000 + (500 - outcome.plies);
};

/**
 * What the tablebase says about a position and each of its moves, like the lichess
 * tablebase panel; `null` for positions with more pieces, or a finished game.
 */
export function tablebaseInfo(
  tablebase: Probe,
  position: Game,
  after: (move: Move) => Game,
): TablebaseInfo | null {
  const board = position.board;
  if (position.isOver || board.count(1) + board.count(-1) > TABLEBASE_PIECES) return null;
  const turn = position.turn;
  const legal = position.legalMoves;
  const moves = legal.map((move) => ({
    notation: moveToTudafNotation(move, legal),
    landing: moveToNotation(move),
    outcome: outcomeAfter(tablebase, after(move), turn),
  }));
  moves.sort((a, b) => rank(a.outcome) - rank(b.outcome));
  return { outcome: tablebase.probe(board), turn, moves };
}
