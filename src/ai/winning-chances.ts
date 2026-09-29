import { mateIn } from './search';

/**
 * Steepness of the evaluation-to-winning-chance curve, fitted by maximum likelihood to
 * 33,004 positions from 240 engine self-play games (`npm run calibrate`, see docs/AI.md).
 * Lichess fitted 0.00368 for chess; Turkish draughts comes out slightly steeper.
 */
export const WIN_CURVE_K = 0.004;

/** Evaluations beyond this are treated as decisive rather than scaled further. */
const CLAMP = 2000;

/**
 * Winning chances for White in [-1, 1], from an evaluation in White's point of view.
 * Same shape as lichess (`2 / (1 + e^(-k·s)) - 1`); a forced win in `n` moves maps close
 * to ±1, nearer wins closer.
 */
export function winningChances(score: number, k: number = WIN_CURVE_K): number {
  const mate = mateIn(score);
  if (mate !== null) {
    const moves = Math.min(10, Math.abs(mate));
    // Past the clamp, so mates always outrank evaluations; nearer mates rank higher.
    const equivalent = (CLAMP + (10 - moves) * 100) * Math.sign(mate);
    return 2 / (1 + Math.exp(-k * equivalent)) - 1;
  }
  const clamped = Math.max(-CLAMP, Math.min(CLAMP, score));
  return 2 / (1 + Math.exp(-k * clamped)) - 1;
}

/** Expected score for White (1 win, 0.5 draw, 0 loss) predicted by the curve. */
export const expectedScore = (score: number, k: number = WIN_CURVE_K): number =>
  (winningChances(score, k) + 1) / 2;
