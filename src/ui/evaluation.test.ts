import { describe, expect, it } from 'vitest';
import { MATE } from '../ai';
import { favoured, formatEvaluation, whiteShare } from './evaluation';
import type { Evaluation } from './session';

const live = (score: number): Evaluation => ({ score, depth: 8, pv: [], final: false });
const final = (score: number): Evaluation => ({ score, depth: 0, pv: [], final: true });

describe('evaluation display', () => {
  it('formats evaluations from White’s point of view', () => {
    expect(formatEvaluation(live(0))).toBe('0.0');
    expect(formatEvaluation(live(3))).toBe('0.0');
    expect(formatEvaluation(live(130))).toBe('+1.3');
    expect(formatEvaluation(live(-45))).toBe('−0.5');
    expect(formatEvaluation(live(MATE - 5))).toBe('M3');
    expect(formatEvaluation(live(-(MATE - 5)))).toBe('−M3');
  });

  it('shows the result once the game is over', () => {
    expect(formatEvaluation(final(MATE))).toBe('1–0');
    expect(formatEvaluation(final(-MATE))).toBe('0–1');
    expect(formatEvaluation(final(0))).toBe('½–½');
    expect(whiteShare(final(MATE))).toBe(1);
    expect(whiteShare(final(0))).toBe(0.5);
  });

  it('splits the bar by winning chances', () => {
    expect(whiteShare(null)).toBe(0.5);
    expect(whiteShare(live(0))).toBe(0.5);
    expect(whiteShare(live(200))).toBeGreaterThan(0.5);
    expect(whiteShare(live(200)) + whiteShare(live(-200))).toBeCloseTo(1, 12);
    expect(favoured(live(2))).toBeNull();
    expect(favoured(live(200))).toBe(1);
    expect(favoured(live(-200))).toBe(-1);
  });
});
