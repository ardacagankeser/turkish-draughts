import { describe, expect, it } from 'vitest';
import { INITIAL_FEN, parseSquare } from '../engine';
import { fakeAnalysis } from '../test/fakes';
import type { AnalysisSnapshot } from './analysis-session';
import { AnalysisSession } from './analysis-session';

const sq = parseSquare;

const board = (moves: string[] = [], ply?: number) =>
  new AnalysisSession(fakeAnalysis(), INITIAL_FEN, moves, ply);

function until(
  session: AnalysisSession,
  predicate: (snapshot: AnalysisSnapshot) => boolean,
): Promise<AnalysisSnapshot> {
  return new Promise((resolve) => {
    const check = () => {
      const snapshot = session.getSnapshot();
      if (!predicate(snapshot)) return;
      unsubscribe();
      resolve(snapshot);
    };
    const unsubscribe = session.subscribe(check);
    check();
  });
}

describe('analysis board', () => {
  it('plays both sides', () => {
    const session = board();
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    session.clickSquare(sq('f6'));
    session.clickSquare(sq('f5'));
    const snapshot = session.getSnapshot();
    expect(snapshot.line).toEqual(['c3-c4', 'f6-f5']);
    expect(snapshot.ply).toBe(2);
    expect(snapshot.turn).toBe(1);
  });

  it('steps through the line, and a new move replaces the rest of it', () => {
    const session = board(['c3-c4', 'f6-f5', 'c4-c5'], 1);
    expect(session.getSnapshot().ply).toBe(1);
    // The next move of the line just steps on.
    session.clickSquare(sq('f6'));
    session.clickSquare(sq('f5'));
    expect(session.getSnapshot().line).toEqual(['c3-c4', 'f6-f5', 'c4-c5']);
    session.showPrevious();
    session.clickSquare(sq('a6'));
    session.clickSquare(sq('a5'));
    expect(session.getSnapshot().line).toEqual(['c3-c4', 'a6-a5']);
    session.showFirst();
    expect(session.getSnapshot().fen).toBe(INITIAL_FEN);
    session.showLast();
    session.showPly(1);
    session.cutLine();
    expect(session.getSnapshot().line).toEqual(['c3-c4']);
  });

  it('starts from any position, and refuses an invalid one', () => {
    const session = new AnalysisSession(fakeAnalysis(), 'B:Wc3:Bc6,e6', []);
    expect(session.getSnapshot()).toMatchObject({ turn: -1, flipped: true });
    expect(() => new AnalysisSession(fakeAnalysis(), 'nonsense', [])).toThrow();
    expect(() => board(['c3-c5'])).toThrow();
  });

  it('analyses the position shown and points at the best move', async () => {
    const session = board(['a3-a4', 'b6-b5', 'd3-d4', 'd6-d5']);
    session.start();
    const analysed = await until(session, (s) => (s.evaluation?.depth ?? 0) >= 2);
    // White must capture with d4.
    expect(analysed.bestMove).toMatchObject({ from: sq('d4') });
    expect(analysed.pv[0]).toBe('d4xd5xc6xb7');
    session.stop();
  });
});
