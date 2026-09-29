import { mateIn, winningChances } from '../ai';
import type { Evaluation } from './session';

/** White's share of the evaluation bar, from 0 (Black winning) to 1 (White winning). */
export function whiteShare(evaluation: Evaluation | null): number {
  if (!evaluation) return 0.5;
  if (evaluation.final) return evaluation.score > 0 ? 1 : evaluation.score < 0 ? 0 : 0.5;
  return (winningChances(evaluation.score) + 1) / 2;
}

/**
 * Short label from White's point of view: `+1.3`, `−0.4`, `0.0`, `M3` (White mates in 3),
 * `−M3` (Black mates in 3), or the result once the game is over.
 */
export function formatEvaluation(evaluation: Evaluation): string {
  if (evaluation.final) {
    return evaluation.score > 0 ? '1–0' : evaluation.score < 0 ? '0–1' : '½–½';
  }
  const mate = mateIn(evaluation.score);
  if (mate !== null) return mate > 0 ? `M${mate}` : `−M${-mate}`;
  const pieces = evaluation.score / 100;
  if (Math.abs(pieces) < 0.05) return '0.0';
  return `${pieces > 0 ? '+' : '−'}${Math.abs(pieces).toFixed(1)}`;
}

/** Which side the evaluation favours, or `null` when it is (about) equal. */
export function favoured(evaluation: Evaluation): 1 | -1 | null {
  const share = whiteShare(evaluation);
  if (Math.abs(share - 0.5) < 0.02) return null;
  return share > 0.5 ? 1 : -1;
}
