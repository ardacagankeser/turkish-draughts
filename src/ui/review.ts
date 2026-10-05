import type { Color } from '../engine';
import type { ReviewPosition } from '../ai';
import { winningChances } from '../ai';
import type { MessageKey } from './i18n';

/**
 * How a move is judged after the game, the lichess way: by how much it lowered the winning
 * chances (from -1 to 1) of the player who made it.
 */
export type Judgement = 'blunder' | 'mistake' | 'inaccuracy' | 'best' | 'only' | 'good' | 'forced';

export const BLUNDER = 0.3;
export const MISTAKE = 0.2;
export const INACCURACY = 0.1;

export interface ReviewedMove {
  /** Index of the move in the game (0 is White's first move). */
  readonly ply: number;
  readonly side: Color;
  readonly played: string;
  /** The engine's choice in the position before the move. */
  readonly best: string | null;
  readonly judgement: Judgement;
  /** Winning chances lost by the mover, from 0 to 2. */
  readonly loss: number;
  /** Lichess move accuracy, 0 to 100; `null` for a forced move. */
  readonly accuracy: number | null;
}

export const judgementKey = (judgement: Judgement): MessageKey => `judgement.${judgement}`;

export const SYMBOLS: Partial<Record<Judgement, string>> = {
  blunder: '??',
  mistake: '?',
  inaccuracy: '?!',
  only: '!',
};

/** Winning chances of `side`, from an evaluation in White's point of view. */
const chancesFor = (score: number, side: Color) => side * winningChances(score);

/** Lichess move accuracy from the drop in win percentage (0 to 100) of the mover. */
export function moveAccuracy(winPercentDrop: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * Math.max(0, winPercentDrop)) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

/**
 * Judges every move whose positions before and after have been evaluated. `positions[i]`
 * is the position after `i` moves; White moves first.
 */
export function judgeMoves(
  positions: readonly (ReviewPosition | undefined)[],
  moves: readonly string[],
): ReviewedMove[] {
  const judged: ReviewedMove[] = [];
  moves.forEach((played, ply) => {
    const before = positions[ply];
    const after = positions[ply + 1];
    if (!before || !after) return;
    const side: Color = ply % 2 === 0 ? 1 : -1;
    const best = before.best;
    if (before.legal <= 1) {
      judged.push({ ply, side, played, best, judgement: 'forced', loss: 0, accuracy: null });
      return;
    }
    if (played === best) {
      // Every other move would have thrown the game away: an only move.
      const only =
        before.second !== null &&
        chancesFor(before.score, side) - chancesFor(before.second, side) >= BLUNDER;
      judged.push({
        ply,
        side,
        played,
        best,
        judgement: only ? 'only' : 'best',
        loss: 0,
        accuracy: 100,
      });
      return;
    }
    const loss = Math.max(0, chancesFor(before.score, side) - chancesFor(after.score, side));
    const judgement: Judgement =
      loss >= BLUNDER
        ? 'blunder'
        : loss >= MISTAKE
          ? 'mistake'
          : loss >= INACCURACY
            ? 'inaccuracy'
            : 'good';
    // Win percentage is 50 + 50 × winning chances, so a loss of chances is 50× in percent.
    judged.push({ ply, side, played, best, judgement, loss, accuracy: moveAccuracy(loss * 50) });
  });
  return judged;
}

export interface SideSummary {
  /** Average move accuracy, or `null` before any move of this side is judged. */
  readonly accuracy: number | null;
  readonly counts: Readonly<Record<Judgement, number>>;
}

/** Accuracy and the number of moves of each kind, for one side. Forced moves do not count. */
export function summarise(moves: readonly ReviewedMove[], side: Color): SideSummary {
  const counts: Record<Judgement, number> = {
    blunder: 0,
    mistake: 0,
    inaccuracy: 0,
    best: 0,
    only: 0,
    good: 0,
    forced: 0,
  };
  let total = 0;
  let judged = 0;
  for (const move of moves) {
    if (move.side !== side) continue;
    counts[move.judgement]++;
    if (move.accuracy === null) continue;
    total += move.accuracy;
    judged++;
  }
  return { accuracy: judged > 0 ? total / judged : null, counts };
}
