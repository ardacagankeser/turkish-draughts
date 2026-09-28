import type { Board } from '../engine';
import { WHITE } from '../engine';

export const MAN_VALUE = 100;
export const KING_VALUE = 330;

/**
 * Bonus for a man by how far it has advanced, indexed by ranks from its own back rank.
 * Men start on steps 1–2; step 6 is the rank just before promotion ("dama altı").
 */
const ADVANCE = [0, 0, 2, 6, 12, 22, 40, 0] as const;

/** Extra bonus for a man one step from promotion with the promotion square free. */
const PROMOTION_THREAT = 35;

/**
 * Static evaluation in centipawn-like units, from the point of view of the side to move.
 * Positions with captures pending are never evaluated (the search resolves them first),
 * so only quiet features are scored.
 */
export function evaluate(board: Board): number {
  let white = 0;
  let black = 0;
  let whitePieces = 0;
  let blackPieces = 0;

  for (let square = 0; square < 64; square++) {
    const piece = board.get(square);
    if (piece === 0) continue;
    const rank = square >> 3;
    let value: number;
    if (piece === 1 || piece === -1) {
      const steps = piece === 1 ? rank : 7 - rank;
      value = MAN_VALUE + (ADVANCE[steps] ?? 0);
      if (steps === 6 && board.get(square + piece * 8) === 0) value += PROMOTION_THREAT;
    } else {
      value = KING_VALUE;
    }
    if (piece > 0) {
      white += value;
      whitePieces++;
    } else {
      black += value;
      blackPieces++;
    }
  }

  // When ahead, trading down is good: the lead is worth more as the board empties.
  const pieces = whitePieces + blackPieces;
  const lead = white - black;
  const tradeBonus = Math.trunc((lead * (32 - pieces)) / 64);

  const score = lead + tradeBonus;
  return board.turn === WHITE ? score : -score;
}
