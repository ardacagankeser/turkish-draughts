import { describe, expect, it } from 'vitest';
import { parseSquare } from '../engine';
import { MemoryStorage, fakeAi } from '../test/fakes';
import type { Snapshot } from './session';
import { GameSession } from './session';

const sq = parseSquare;

/** Resolves once the snapshot satisfies `predicate` (the AI answers asynchronously). */
function until(
  session: GameSession,
  predicate: (snapshot: Snapshot) => boolean,
): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const check = () => {
      const snapshot = session.getSnapshot();
      if (predicate(snapshot)) {
        unsubscribe();
        clearTimeout(timer);
        resolve(snapshot);
      }
    };
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('timed out'));
    }, 5000);
    const unsubscribe = session.subscribe(check);
    check();
  });
}

function started(human: 1 | -1 = 1, storage = new MemoryStorage()) {
  const session = new GameSession(fakeAi(), storage);
  session.start();
  session.newGame({ human, level: 'medium' });
  return { session, storage };
}

describe('GameSession', () => {
  it('waits for settings before playing', () => {
    const session = new GameSession(fakeAi(), new MemoryStorage());
    expect(session.getSnapshot().settings).toBeNull();
    expect(session.getSnapshot().humanMoves).toEqual([]);
    expect(session.getSnapshot().pieces).toHaveLength(32);
  });

  it('plays the human move, then the AI replies', async () => {
    const { session } = started();
    session.clickSquare(sq('c3'));
    expect(session.getSnapshot().selection).toEqual({ from: sq('c3'), path: [] });
    session.clickSquare(sq('c4'));
    const afterHuman = session.getSnapshot();
    expect(afterHuman.moveList).toEqual(['c3-c4']);
    expect(afterHuman.thinking).toBe(true);
    expect(afterHuman.humanMoves).toEqual([]);

    const afterAi = await until(session, (s) => s.moveList.length === 2);
    expect(afterAi.thinking).toBe(false);
    expect(afterAi.turn).toBe(1);
    expect(afterAi.humanMoves.length).toBeGreaterThan(0);
    expect(afterAi.engine).not.toBeNull();
  });

  it('keeps piece identities across a move and reports it for animation', async () => {
    const { session } = started();
    const before = session.getSnapshot().pieces.find((p) => p.square === sq('c3'));
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    const after = session.getSnapshot();
    expect(after.pieces.find((p) => p.square === sq('c4'))?.id).toBe(before?.id);
    expect(after.lastMove?.from).toBe(sq('c3'));
    await until(session, (s) => !s.thinking);
  });

  it('lets the AI open when the human plays Black', async () => {
    const { session } = started(-1);
    expect(session.getSnapshot().flipped).toBe(true);
    const snapshot = await until(session, (s) => s.moveList.length === 1);
    expect(snapshot.turn).toBe(-1);
    expect(snapshot.canUndo).toBe(false);
  });

  it('takes back the AI reply and the human move together', async () => {
    const { session } = started();
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    await until(session, (s) => s.moveList.length === 2);
    expect(session.getSnapshot().canUndo).toBe(true);
    session.undo();
    const snapshot = session.getSnapshot();
    expect(snapshot.moveList).toEqual([]);
    expect(snapshot.turn).toBe(1);
    expect(snapshot.canUndo).toBe(false);
  });

  it('cancels the AI when a move is taken back while it thinks', () => {
    const { session } = started();
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    expect(session.getSnapshot().thinking).toBe(true);
    session.undo();
    expect(session.getSnapshot().thinking).toBe(false);
    expect(session.getSnapshot().moveList).toEqual([]);
  });

  it('remembers the game between visits', async () => {
    const { session, storage } = started();
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    await until(session, (s) => s.moveList.length === 2);
    session.flip();
    session.stop();

    const restored = new GameSession(fakeAi(), storage).getSnapshot();
    expect(restored.moveList).toHaveLength(2);
    expect(restored.settings).toEqual({ human: 1, level: 'medium' });
    expect(restored.flipped).toBe(true);
  });

  it('ignores corrupt saved data', () => {
    const storage = new MemoryStorage();
    storage.setItem('turkish-draughts:v1', '{"settings":{"human":3},"moves":["z9-z9"]}');
    const snapshot = new GameSession(fakeAi(), storage).getSnapshot();
    expect(snapshot.settings).toBeNull();
    expect(snapshot.moveList).toEqual([]);
  });

  it('suggests a legal move as a hint', async () => {
    const { session } = started();
    session.requestHint();
    const snapshot = await until(session, (s) => s.hint !== null);
    expect(snapshot.humanMoves).toContain(snapshot.hint);
  });

  it('allows two draw offers; the AI accepts in an equal position', async () => {
    const { session } = started();
    session.offerDraw();
    const snapshot = await until(session, (s) => !s.thinking);
    expect(snapshot.drawOffersLeft).toBe(1);
    expect(snapshot.notice).toBe('drawAccepted');
    expect(snapshot.result).toEqual({ winner: null, reason: 'agreement' });
    expect(snapshot.resultId).toBe(1);
  });

  it('treats a finished game as final', async () => {
    const { session, storage } = started();
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    await until(session, (s) => s.moveList.length === 2);
    session.resign();
    const over = session.getSnapshot();
    expect(over.canUndo).toBe(false);

    // None of these may change a finished game.
    session.undo();
    session.offerDraw();
    session.requestHint();
    session.clickSquare(sq('d3'));
    session.resign();
    const after = session.getSnapshot();
    expect(after.moveList).toEqual(over.moveList);
    expect(after.result).toEqual({ winner: -1, reason: 'resignation' });
    expect(after.drawOffersLeft).toBe(2);
    expect(after.thinking).toBe(false);
    expect(after.resultId).toBe(over.resultId);

    // It stays finished after a reload, even though the moves alone do not end it.
    session.stop();
    const reloaded = new GameSession(fakeAi(), storage).getSnapshot();
    expect(reloaded.result).toEqual({ winner: -1, reason: 'resignation' });
    expect(reloaded.canUndo).toBe(false);
    expect(reloaded.humanMoves).toEqual([]);
  });

  it('keeps an agreed draw after a reload', async () => {
    const { session, storage } = started();
    session.offerDraw();
    await until(session, (s) => !s.thinking);
    session.stop();
    const reloaded = new GameSession(fakeAi(), storage).getSnapshot();
    expect(reloaded.result).toEqual({ winner: null, reason: 'agreement' });
  });

  it('ends the game on resignation', () => {
    const { session } = started();
    session.resign();
    const snapshot = session.getSnapshot();
    expect(snapshot.result).toEqual({ winner: -1, reason: 'resignation' });
    expect(snapshot.humanMoves).toEqual([]);
    expect(snapshot.resultId).toBe(1);
  });
});
