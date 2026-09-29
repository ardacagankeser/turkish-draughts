import { describe, expect, it } from 'vitest';
import { INITIAL_FEN } from '../engine';
import { FakeAnalysisWorker } from '../test/fakes';
import type { AnalysisUpdate } from './analysis';
import { analyse } from './analysis';
import { AnalysisClient } from './analysis-client';
import { MATE, Searcher } from './search';
import { WIN_CURVE_K, expectedScore, winningChances } from './winning-chances';

const request = (fen: string, maxDepth = 4) =>
  ({ id: 1, type: 'analyse', fen, moves: [], maxDepth, timeMs: 5000 }) as const;

describe('winningChances', () => {
  it('is 0 for an equal position and symmetric', () => {
    expect(winningChances(0)).toBe(0);
    for (const score of [50, 100, 330, 1000]) {
      expect(winningChances(-score)).toBeCloseTo(-winningChances(score), 12);
    }
  });

  it('grows with the evaluation and stays inside (-1, 1)', () => {
    const values = [0, 50, 100, 200, 400, 800, 5000].map((s) => winningChances(s));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1] ?? 0);
    }
    expect(values.at(-1)).toBeLessThan(1);
  });

  it('ranks forced wins above any evaluation, nearer ones higher', () => {
    const inThree = winningChances(MATE - 5);
    const inNine = winningChances(MATE - 17);
    expect(inThree).toBeGreaterThan(inNine);
    expect(inNine).toBeGreaterThan(winningChances(5000));
    expect(winningChances(-(MATE - 5))).toBeCloseTo(-inThree, 12);
  });

  it('turns an evaluation into an expected score', () => {
    expect(expectedScore(0)).toBe(0.5);
    // One man up is a clear advantage with the calibrated curve.
    expect(expectedScore(100)).toBeCloseTo(1 / (1 + Math.exp(-WIN_CURVE_K * 100)), 12);
  });
});

describe('analyse', () => {
  it('reports every depth, White’s point of view, and ends with a final update', async () => {
    const updates: AnalysisUpdate[] = [];
    // Black to move, but White is winning: the score must still be positive.
    await analyse(
      new Searcher(16),
      request('B:WKa1,Kh1:Bd4', 6),
      (u) => updates.push(u),
      () => true,
    );
    expect(updates.length).toBeGreaterThan(1);
    expect(updates.at(-1)?.done).toBe(true);
    expect(updates.every((u) => u.score > 0)).toBe(true);
    const depths = updates.filter((u) => !u.done).map((u) => u.depth);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it('stops once superseded', async () => {
    const updates: AnalysisUpdate[] = [];
    let current = true;
    await analyse(
      new Searcher(16),
      request(INITIAL_FEN, 10),
      (u) => {
        updates.push(u);
        if (u.depth === 2) current = false;
      },
      () => current,
    );
    expect(updates.map((u) => u.depth)).toEqual([1, 2]);
  });

  it('does nothing for a finished game', async () => {
    const updates: AnalysisUpdate[] = [];
    await analyse(
      new Searcher(16),
      request('W:WKa1:Bh8'),
      (u) => updates.push(u),
      () => true,
    );
    expect(updates).toEqual([]);
  });
});

describe('AnalysisClient', () => {
  it('only reports updates for the latest analysis', async () => {
    const worker = new FakeAnalysisWorker();
    const client = new AnalysisClient(() => worker);
    const first: AnalysisUpdate[] = [];
    const second: AnalysisUpdate[] = [];
    client.analyse(INITIAL_FEN, [], (u) => first.push(u));
    client.analyse(INITIAL_FEN, ['c3-c4'], (u) => second.push(u));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(first).toEqual([]);
    expect(second.at(-1)?.done).toBe(true);
    client.stop();
    expect(worker.requests.at(-1)?.type).toBe('stop');
    client.dispose();
    expect(worker.terminated).toBe(true);
  });
});
