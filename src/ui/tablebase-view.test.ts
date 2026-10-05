import { describe, expect, it } from 'vitest';
import type { Board, Move } from '../engine';
import { Game, INITIAL_FEN, parseSquare } from '../engine';
import { fakeAnalysis } from '../test/fakes';
import { AnalysisSession } from './analysis-session';
import type { Probe } from './tablebase-view';
import { movesOf, tablebaseInfo } from './tablebase-view';

const sq = parseSquare;

/** Pretends that Black, to move with a white man on c4, loses in 4 plies; all else draws. */
const fake: Probe = {
  probe: (board: Board) =>
    board.turn === -1 && board.get(sq('c4')) === 1
      ? { result: 'loss', plies: 4 }
      : { result: 'draw' },
};

const after = (fen: string) => (move: Move) => {
  const game = new Game(fen);
  game.play(move);
  return game;
};

describe('tablebase panel', () => {
  it('ranks every move by its exact result, quickest win first', () => {
    const fen = 'W:Wc3,f3:Bh6';
    const info = tablebaseInfo(fake, new Game(fen), after(fen));
    expect(info?.turn).toBe(1);
    expect(info?.outcome).toEqual({ result: 'draw' });
    // c3-c4 leaves Black lost in 4 plies: a win in 5 for White.
    expect(info?.moves[0]).toEqual({
      notation: 'c3-c4',
      landing: 'c3-c4',
      outcome: { result: 'win', plies: 5 },
    });
    expect(info?.moves.slice(1).every((move) => move.outcome?.result === 'draw')).toBe(true);
  });

  it('scores a move that ends the game by the result', () => {
    const fen = 'W:Wc3,a2:Bc4';
    const info = tablebaseInfo(fake, new Game(fen), after(fen));
    expect(info?.moves).toEqual([
      { notation: 'c3xc4', landing: 'c3xc5', outcome: { result: 'win', plies: 1 } },
    ]);
  });

  it('has nothing to say with more than three pieces', () => {
    expect(tablebaseInfo(fake, new Game(INITIAL_FEN), after(INITIAL_FEN))).toBeNull();
  });

  it('counts moves, not plies', () => {
    expect(movesOf(1)).toBe(1);
    expect(movesOf(5)).toBe(3);
  });

  it('loads the tablebase once, when the board first gets down to three pieces', async () => {
    let loads = 0;
    const load = () => {
      loads++;
      return Promise.resolve(fake);
    };
    const session = new AnalysisSession(fakeAnalysis(), 'W:Wc3,f3:Bh6', [], null, load);
    expect(session.getSnapshot().tablebase).toEqual({ status: 'loading' });
    await Promise.resolve();
    await Promise.resolve();
    const ready = session.getSnapshot().tablebase;
    expect(ready?.status).toBe('ready');
    session.playMove('c3-c4');
    expect(session.getSnapshot().line).toEqual(['c3-c4']);
    expect(session.getSnapshot().tablebase?.status).toBe('ready');
    expect(loads).toBe(1);

    const full = new AnalysisSession(fakeAnalysis(), INITIAL_FEN, [], null, load);
    expect(full.getSnapshot().tablebase).toBeNull();
    expect(loads).toBe(1);
  });

  it('says so when the tablebase cannot be loaded', async () => {
    const session = new AnalysisSession(fakeAnalysis(), 'W:Wc3,f3:Bh6', [], null, () =>
      Promise.resolve(null),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(session.getSnapshot().tablebase).toEqual({ status: 'unavailable' });
  });
});
