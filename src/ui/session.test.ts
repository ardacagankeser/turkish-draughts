import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSquare } from '../engine';
import type { ReviewPosition, ReviewUpdate, ReviewWorkerLike } from '../ai';
import { ReviewClient } from '../ai';
import { GameArchive, MemoryStore } from './archive';
import { MemoryStorage, fakeAi, fakeAnalysis, fakeReview } from '../test/fakes';
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
  const session = new GameSession(fakeAi(), storage, fakeAnalysis());
  session.start();
  session.newGame({ human, level: 'medium' });
  return { session, storage };
}

describe('GameSession', () => {
  it('waits for settings before playing', () => {
    const session = new GameSession(fakeAi(), new MemoryStorage(), fakeAnalysis());
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

    const restored = new GameSession(fakeAi(), storage, fakeAnalysis()).getSnapshot();
    expect(restored.moveList).toHaveLength(2);
    expect(restored.settings).toEqual({ human: 1, level: 'medium' });
    expect(restored.flipped).toBe(true);
  });

  it('ignores corrupt saved data', () => {
    const storage = new MemoryStorage();
    storage.setItem('turkish-draughts:v1', '{"settings":{"human":3},"moves":["z9-z9"]}');
    const snapshot = new GameSession(fakeAi(), storage, fakeAnalysis()).getSnapshot();
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
    const reloaded = new GameSession(fakeAi(), storage, fakeAnalysis()).getSnapshot();
    expect(reloaded.result).toEqual({ winner: -1, reason: 'resignation' });
    expect(reloaded.canUndo).toBe(false);
    expect(reloaded.humanMoves).toEqual([]);
  });

  it('keeps an agreed draw after a reload', async () => {
    const { session, storage } = started();
    session.offerDraw();
    await until(session, (s) => !s.thinking);
    session.stop();
    const reloaded = new GameSession(fakeAi(), storage, fakeAnalysis()).getSnapshot();
    expect(reloaded.result).toEqual({ winner: null, reason: 'agreement' });
  });

  it("analyses the position live, from White's point of view", async () => {
    const { session } = started();
    const first = await until(session, (s) => (s.evaluation?.depth ?? 0) >= 2);
    expect(first.evaluation?.final).toBe(false);
    // The opening is balanced.
    expect(Math.abs(first.evaluation?.score ?? 999)).toBeLessThan(60);
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    await until(session, (s) => s.moveList.length === 2 && (s.evaluation?.depth ?? 0) >= 2);
  });

  it('can hide the evaluation, which also stops the analysis', async () => {
    const { session, storage } = started();
    await until(session, (s) => s.evaluation !== null);
    session.toggleEvaluation();
    expect(session.getSnapshot().showEvaluation).toBe(false);
    expect(session.getSnapshot().evaluation).toBeNull();
    session.stop();
    expect(new GameSession(fakeAi(), storage, fakeAnalysis()).getSnapshot().showEvaluation).toBe(
      false,
    );
  });

  it('shows the result instead of an evaluation once the game is over', () => {
    const { session } = started();
    session.resign();
    expect(session.getSnapshot().evaluation).toMatchObject({ final: true });
    expect(session.getSnapshot().evaluation?.score).toBeLessThan(0);
    // The bar can still be hidden and shown again after the game.
    session.toggleEvaluation();
    expect(session.getSnapshot().evaluation).toBeNull();
    session.toggleEvaluation();
    expect(session.getSnapshot().evaluation).toMatchObject({ final: true });
  });

  describe('browsing earlier moves', () => {
    async function afterTwoMoves() {
      const setup = started();
      setup.session.clickSquare(sq('c3'));
      setup.session.clickSquare(sq('c4'));
      await until(setup.session, (s) => s.moveList.length === 2 && !s.thinking);
      return setup;
    }

    it('shows an earlier position read-only and steps back to the live one', async () => {
      const { session } = await afterTwoMoves();
      const live = session.getSnapshot();
      session.showFirst();
      const start = session.getSnapshot();
      expect(start.browsing).toBe(true);
      expect(start.moveNumber).toBe(0);
      expect(start.liveMoveNumber).toBe(2);
      expect(start.lastMove).toBeNull();
      expect(start.pieces.some((p) => p.square === sq('c3'))).toBe(true);
      expect(start.humanMoves).toEqual([]);

      // Moves cannot be played on an earlier position.
      session.clickSquare(sq('d3'));
      expect(session.getSnapshot().selection).toBeNull();

      // One step forward keeps the moving piece's identity, so it can be animated.
      const c3 = start.pieces.find((p) => p.square === sq('c3'));
      session.showNext();
      const first = session.getSnapshot();
      expect(first.moveNumber).toBe(1);
      expect(first.lastMove?.to).toBe(sq('c4'));
      expect(first.pieces.find((p) => p.square === sq('c4'))?.id).toBe(c3?.id);

      session.showLive();
      const back = session.getSnapshot();
      expect(back.browsing).toBe(false);
      expect(back.pieces).toBe(live.pieces);
      expect(back.humanMoves.length).toBeGreaterThan(0);
    });

    it('clamps out-of-range requests and ignores no-ops', async () => {
      const { session } = await afterTwoMoves();
      const before = session.getSnapshot();
      session.showNext();
      expect(session.getSnapshot()).toBe(before);
      session.showPly(-5);
      expect(session.getSnapshot().moveNumber).toBe(0);
      session.showPly(99);
      expect(session.getSnapshot().browsing).toBe(false);
    });

    it('keeps the shown position while the computer moves, and counts the new move', async () => {
      const { session } = started();
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      session.showFirst();
      const browsing = await until(session, (s) => s.liveMoveNumber === 2);
      expect(browsing.moveNumber).toBe(0);
      expect(browsing.missedMoves).toBe(1);
      session.showLive();
      expect(session.getSnapshot().missedMoves).toBe(0);
    });

    it('leaves browsing when a move is taken back', async () => {
      const { session } = await afterTwoMoves();
      session.showFirst();
      session.undo();
      expect(session.getSnapshot().browsing).toBe(false);
      expect(session.getSnapshot().moveList).toEqual([]);
    });

    it('analyses earlier positions of a finished game', async () => {
      const { session } = await afterTwoMoves();
      session.resign();
      expect(session.getSnapshot().evaluation?.final).toBe(true);
      session.showPrevious();
      const snapshot = await until(session, (s) => s.evaluation?.final === false);
      expect(snapshot.moveNumber).toBe(1);
    });
  });

  describe('premoves', () => {
    it('queues a move while the computer thinks and plays it if still legal', async () => {
      const { session } = started();
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      expect(session.getSnapshot().premoveEnabled).toBe(true);

      session.clickSquare(sq('h3'));
      expect(session.getSnapshot().premoveFrom).toBe(sq('h3'));
      expect(session.getSnapshot().premoveTargets).toContain(sq('h4'));
      session.clickSquare(sq('h4'));
      expect(session.getSnapshot().premove).toEqual({ from: sq('h3'), to: sq('h4') });

      const afterAi = await until(session, (s) => s.moveList.length >= 2 && !s.thinking);
      // The reply may force a capture, which makes the premove illegal: then it is dropped.
      const legal = afterAi.humanMoves.some((m) => m.from === sq('h3') && m.to === sq('h4'));
      if (legal) {
        const played = await until(session, (s) => s.moveList.length === 3);
        expect(played.moveList[2]).toBe('h3-h4');
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(session.getSnapshot().moveList).toHaveLength(2);
      }
      expect(session.getSnapshot().premove).toBeNull();
    });

    it('can be cancelled, and is dropped when browsing', () => {
      const { session } = started();
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      session.clickSquare(sq('h3'));
      session.clickSquare(sq('h4'));
      session.cancelPremove();
      expect(session.getSnapshot().premove).toBeNull();

      session.clickSquare(sq('h3'));
      session.clickSquare(sq('h4'));
      session.showFirst();
      expect(session.getSnapshot().premove).toBeNull();
      expect(session.getSnapshot().premoveEnabled).toBe(false);
    });

    it('ignores empty squares and opposing pieces when nothing is picked', () => {
      const { session } = started();
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      session.clickSquare(sq('d5'));
      session.clickSquare(sq('e6'));
      expect(session.getSnapshot().premoveFrom).toBeNull();
      expect(session.getSnapshot().premove).toBeNull();
    });
  });

  describe('events, notation and taken pieces', () => {
    it('reports a start, each move with its mover, and the end', async () => {
      const { session } = started();
      expect(session.getSnapshot().event).toMatchObject({ kind: 'start' });
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      expect(session.getSnapshot().event).toMatchObject({
        kind: 'move',
        by: 'human',
        notation: 'c3-c4',
        captures: 0,
      });
      const reply = await until(session, (s) => s.moveList.length === 2);
      expect(reply.event).toMatchObject({ kind: 'move', by: 'computer' });
      session.resign();
      expect(session.getSnapshot().event).toMatchObject({
        kind: 'end',
        result: { reason: 'resignation' },
      });
    });

    it('counts captures and the pieces each side has taken', () => {
      const storage = new MemoryStorage();
      storage.setItem(
        'turkish-draughts:v1',
        JSON.stringify({
          settings: { human: 1, level: 'easy' },
          moves: ['a3-a4', 'b6-b5', 'd3-d4', 'd6-d5'],
        }),
      );
      const session = new GameSession(fakeAi(), storage, fakeAnalysis());
      expect(session.playNotation('d4xb8')).toBe('played');
      const snapshot = session.getSnapshot();
      expect(snapshot.event).toMatchObject({ kind: 'move', captures: 3, promotes: true });
      expect(snapshot.taken.white).toEqual([-1, -1, -1]);
      expect(snapshot.taken.black).toEqual([]);
      session.stop();
    });

    it('rejects illegal notation and moves out of turn', () => {
      const { session } = started();
      expect(session.playNotation('a2-a3')).toBe('illegal');
      expect(session.playNotation('nonsense')).toBe('illegal');
      expect(session.playNotation('c3-c4')).toBe('played');
      expect(session.playNotation('d3-d4')).toBe('not-your-turn');
    });
  });

  it('waits for a second click on the piece when moves must be confirmed', () => {
    const { session } = started();
    session.setConfirmMoves(true);
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    let snapshot = session.getSnapshot();
    expect(snapshot.moveList).toEqual([]);
    expect(snapshot.confirming).toBe(true);
    expect(snapshot.selection).toEqual({ from: sq('c3'), path: [sq('c4')] });

    // Clicking elsewhere takes it back, and that click picks another piece.
    session.clickSquare(sq('d3'));
    snapshot = session.getSnapshot();
    expect(snapshot.confirming).toBe(false);
    expect(snapshot.selection).toEqual({ from: sq('d3'), path: [] });

    session.clickSquare(sq('d4'));
    session.clickSquare(sq('d4'));
    expect(session.getSnapshot().moveList).toEqual(['d3-d4']);

    session.stop();
  });

  it('drops a move waiting for confirmation when confirmation is turned off', () => {
    const { session } = started();
    session.setConfirmMoves(true);
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    session.setConfirmMoves(false);
    expect(session.getSnapshot().selection).toBeNull();
    session.stop();
  });

  describe('clock', () => {
    const minute = { initialMs: 60_000, incrementMs: 5000 };
    const timed = (human: 1 | -1, storage = new MemoryStorage()) => {
      const session = new GameSession(fakeAi(), storage, fakeAnalysis(), () => Date.now());
      session.start();
      session.newGame({ human, level: 'easy', clock: minute });
      return { session, storage };
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('waits for the board before showing the reply, without charging either clock', async () => {
      const { session } = timed(1);
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      // The board animates the player's move for 3 s, longer than the computer thinks.
      session.boardSettles(3000);
      await vi.advanceTimersByTimeAsync(1000);
      let snapshot = session.getSnapshot();
      expect(snapshot.moveList).toEqual(['c3-c4']);
      // The computer has decided: its time stopped, and nobody's runs while it waits.
      expect(snapshot.clock?.running).toBeNull();
      const black = snapshot.clock?.black ?? 0;
      await vi.advanceTimersByTimeAsync(1500);
      expect(session.getSnapshot().clock?.black).toBe(black);
      await vi.advanceTimersByTimeAsync(600);
      snapshot = session.getSnapshot();
      expect(snapshot.moveList).toHaveLength(2);
      // Shown: Black got its increment, and White's time runs from now.
      expect(snapshot.clock).toMatchObject({ running: 1, black: black + 5000 });
      expect(snapshot.clock?.white).toBeGreaterThan(59_800);
      session.stop();
    });

    it('plays a premove once the reply has been seen, at no cost of time', async () => {
      const { session } = timed(1);
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      // While the computer thinks, queue a move with another piece.
      session.clickSquare(sq('a3'));
      session.clickSquare(sq('a4'));
      expect(session.getSnapshot().premove).not.toBeNull();
      await vi.advanceTimersByTimeAsync(600);
      expect(session.getSnapshot().moveList).toHaveLength(2);
      // The board shows the reply for 2 s; the premove waits, and White's time does not run.
      session.boardSettles(2000);
      await vi.advanceTimersByTimeAsync(1500);
      let snapshot = session.getSnapshot();
      expect(snapshot.moveList).toHaveLength(2);
      expect(snapshot.clock?.running).toBeNull();
      await vi.advanceTimersByTimeAsync(600);
      snapshot = session.getSnapshot();
      expect(snapshot.moveList).toHaveLength(3);
      expect(snapshot.moveList[2]).toBe('a3-a4');
      // A premove takes no time, so White just gains the increment.
      expect(snapshot.clock?.white).toBe(65_000);
      session.stop();
    });

    it('loses on time, whatever the position, with a warning at ten seconds', async () => {
      const { session } = timed(-1);
      // The computer's first move is free; then the player's time runs.
      await vi.advanceTimersByTimeAsync(1000);
      expect(session.getSnapshot().moveList).toHaveLength(1);
      expect(session.getSnapshot().clock?.running).toBe(-1);
      await vi.advanceTimersByTimeAsync(50_500);
      expect(session.getSnapshot().event).toMatchObject({ kind: 'lowTime', side: -1 });
      await vi.advanceTimersByTimeAsync(10_000);
      const snapshot = session.getSnapshot();
      expect(snapshot.result).toEqual({ winner: 1, reason: 'timeout' });
      expect(snapshot.event).toMatchObject({ kind: 'end' });
      expect(snapshot.clock?.running).toBeNull();
      session.stop();
    });

    it('adds the increment, pauses while hidden, and is saved with the game', async () => {
      const { session, storage } = timed(1);
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      await vi.advanceTimersByTimeAsync(1000);
      let clock = session.getSnapshot().clock;
      expect(clock?.running).toBe(1);
      // Black spent its thinking time and gained the increment.
      expect(clock?.black).toBeGreaterThan(60_000);

      await vi.advanceTimersByTimeAsync(2000);
      session.setHidden(true);
      await vi.advanceTimersByTimeAsync(30_000);
      clock = session.getSnapshot().clock;
      expect(clock?.paused).toBe(true);
      expect(clock?.white).toBeLessThanOrEqual(58_500);
      expect(clock?.white).toBeGreaterThan(57_000);
      session.stop();

      const restored = new GameSession(fakeAi(), storage, fakeAnalysis(), () => Date.now());
      restored.start();
      const view = restored.getSnapshot().clock;
      expect(view?.white).toBe(clock?.white);
      expect(view?.running).toBe(1);
      restored.stop();
    });

    it('gives the computer less time when its clock runs low', () => {
      const ai = fakeAi();
      const chooseMove = vi.spyOn(ai, 'chooseMove');
      const session = new GameSession(ai, new MemoryStorage(), fakeAnalysis(), () => Date.now());
      session.start();
      session.newGame({ human: 1, level: 'expert', clock: { initialMs: 20_000, incrementMs: 0 } });
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      expect(chooseMove).toHaveBeenLastCalledWith(expect.any(String), ['c3-c4'], 'expert', 800);
      session.stop();
    });
  });

  describe('two players on one device', () => {
    const hotseat = (rotate = false, storage = new MemoryStorage()) => {
      const session = new GameSession(fakeAi(), storage, fakeAnalysis());
      session.start();
      session.newGame({ human: 1, level: 'easy', opponent: 'human', rotate });
      return { session, storage };
    };

    it('lets both sides move, with no computer and no evaluation by default', async () => {
      const { session } = hotseat();
      expect(session.getSnapshot().showEvaluation).toBe(false);
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      // No computer reply comes; Black moves from the same device.
      await new Promise((resolve) => setTimeout(resolve, 600));
      let snapshot = session.getSnapshot();
      expect(snapshot.moveList).toEqual(['c3-c4']);
      expect(snapshot.thinking).toBe(false);
      expect(snapshot.premoveEnabled).toBe(false);
      expect(snapshot.humanMoves.length).toBeGreaterThan(0);
      session.clickSquare(sq('c6'));
      session.clickSquare(sq('c5'));
      snapshot = session.getSnapshot();
      expect(snapshot.moveList).toEqual(['c3-c4', 'c6-c5']);
      expect(snapshot.event).toMatchObject({ kind: 'move', by: 'human', side: -1 });
      session.stop();
    });

    it('takes back one move at a time and turns the board when asked', () => {
      const { session } = hotseat(true);
      expect(session.getSnapshot().flipped).toBe(false);
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      expect(session.getSnapshot().flipped).toBe(true);
      session.undo();
      const snapshot = session.getSnapshot();
      expect(snapshot.moveList).toEqual([]);
      expect(snapshot.flipped).toBe(false);
      session.stop();
    });

    it('agrees a draw at once, and the side to move resigns', () => {
      const { session } = hotseat();
      session.offerDraw();
      expect(session.getSnapshot().result).toEqual({ winner: null, reason: 'agreement' });

      session.newGame({ human: 1, level: 'easy', opponent: 'human' });
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      session.resign();
      expect(session.getSnapshot().result).toEqual({ winner: 1, reason: 'resignation' });
      session.stop();
    });

    it('is remembered between visits', () => {
      const { session, storage } = hotseat(true);
      session.stop();
      const restored = new GameSession(fakeAi(), storage, fakeAnalysis());
      expect(restored.getSnapshot().settings).toMatchObject({ opponent: 'human', rotate: true });
    });

    it('brings the evaluation back for the next game against the computer', () => {
      const { session } = hotseat();
      session.newGame({ human: 1, level: 'easy' });
      expect(session.getSnapshot().showEvaluation).toBe(true);
      session.stop();
    });
  });

  it('reviews a finished game position by position', async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'turkish-draughts:v1',
      JSON.stringify({
        settings: { human: 1, level: 'easy' },
        moves: ['a3-a4', 'b6-b5', 'd3-d4', 'd6-d5'],
        ending: { reason: 'resignation', winner: -1 },
      }),
    );
    const session = new GameSession(fakeAi(), storage, fakeAnalysis(), undefined, fakeReview());
    expect(session.getSnapshot().review).toBeNull();
    session.startReview();
    expect(session.getSnapshot().review).toMatchObject({ done: false, progress: 0 });
    const reviewed = await until(session, (s) => s.review?.done === true);
    expect(reviewed.review?.scores).toHaveLength(5);
    expect(reviewed.review?.scores.every((score) => score !== null)).toBe(true);
    expect(reviewed.review?.moves).toHaveLength(4);
    expect(reviewed.review?.white.accuracy).not.toBeNull();
    // White must capture after d6-d5: the engine's capture is drawn as an arrow.
    session.showPly(4);
    expect(session.getSnapshot().bestMove).toMatchObject({ from: sq('d4') });
    // A new game drops the review.
    session.newGame({ human: 1, level: 'easy' });
    expect(session.getSnapshot().review).toBeNull();
    session.stop();
  });

  describe('learning from mistakes', () => {
    /** A review worker that answers with prepared evaluations instead of searching. */
    const scripted = (scores: number[], best: string[]) =>
      new ReviewClient(() => {
        const worker: ReviewWorkerLike = {
          onmessage: null,
          terminate: () => undefined,
          postMessage: (message) => {
            if (message.type !== 'review') return;
            queueMicrotask(() => {
              scores.forEach((score, index) => {
                const position: ReviewPosition = {
                  id: message.id,
                  type: 'review-position',
                  index,
                  score,
                  depth: 8,
                  best: best[index] ?? null,
                  pv: [],
                  legal: 8,
                  second: null,
                };
                worker.onmessage?.({ data: position } as MessageEvent<ReviewUpdate>);
              });
              worker.onmessage?.({
                data: { id: message.id, type: 'review-done' },
              } as MessageEvent<ReviewUpdate>);
            });
          },
        };
        return worker;
      });

    /** White resigned after a3-a4, which the review calls a blunder (+300 to -500). */
    const reviewed = async () => {
      const storage = new MemoryStorage();
      storage.setItem(
        'turkish-draughts:v1',
        JSON.stringify({
          settings: { human: 1, level: 'easy' },
          moves: ['a3-a4', 'b6-b5'],
          ending: { reason: 'resignation', winner: -1 },
        }),
      );
      const session = new GameSession(
        fakeAi(),
        storage,
        fakeAnalysis(),
        undefined,
        scripted([300, -500, -500], ['c3-c4', 'b6-b5', 'a4-a5']),
      );
      session.startReview();
      await until(session, (s) => s.review?.done === true);
      session.startPractice();
      return session;
    };

    it('replays the mistake and accepts the engine move', async () => {
      const session = await reviewed();
      let snapshot = session.getSnapshot();
      expect(snapshot.practice).toMatchObject({
        status: 'try',
        index: 0,
        total: 1,
        side: 1,
        played: 'a3-a4',
        best: null,
      });
      // Back before the mistake, with White to find a move and nothing given away.
      expect(snapshot.moveNumber).toBe(0);
      expect(snapshot.humanMoves).toHaveLength(8);
      expect(snapshot.bestMove).toBeNull();
      expect(snapshot.evaluation).toBeNull();
      session.clickSquare(sq('c3'));
      session.clickSquare(sq('c4'));
      snapshot = session.getSnapshot();
      expect(snapshot.practice).toMatchObject({ status: 'right', tried: 'c3-c4', best: 'c3-c4' });
      expect(snapshot.moveNumber).toBe(1);
      session.nextPractice();
      expect(session.getSnapshot().practice?.status).toBe('done');
      session.stopPractice();
      expect(session.getSnapshot().practice).toBeNull();
      session.stop();
    });

    it('lets the player try again, or shows the solution', async () => {
      const session = await reviewed();
      // h3-h4 keeps the game level, far from the +300 the best move keeps.
      session.clickSquare(sq('h3'));
      session.clickSquare(sq('h4'));
      expect(session.getSnapshot().practice?.status).toBe('checking');
      const wrong = await until(session, (s) => s.practice?.status === 'wrong');
      expect(wrong.practice?.tried).toBe('h3-h4');
      const again = await until(session, (s) => s.practice?.status === 'try');
      expect(again.moveNumber).toBe(0);
      session.showSolution();
      const shown = session.getSnapshot();
      expect(shown.practice).toMatchObject({ status: 'shown', best: 'c3-c4' });
      expect(shown.bestMove).toMatchObject({ from: sq('c3'), path: [sq('c4')] });
      // Browsing the game ends the practice.
      session.showPly(2);
      expect(session.getSnapshot().practice).toBeNull();
      expect(session.getSnapshot().moveNumber).toBe(2);
      session.stop();
    });
  });

  it('archives a game once, when it ends', async () => {
    const archive = new GameArchive(new MemoryStore());
    const { session, storage } = started();
    session.setArchive(archive);
    session.clickSquare(sq('c3'));
    session.clickSquare(sq('c4'));
    await until(session, (s) => s.moveList.length === 2);
    session.resign();
    expect(archive.getSnapshot()).toHaveLength(1);
    expect(archive.getSnapshot()[0]).toMatchObject({
      moves: ['c3-c4', expect.any(String)],
      result: { winner: -1, reason: 'resignation' },
      opponent: 'computer',
      human: 1,
      level: 'medium',
    });
    expect(archive.getSnapshot()[0]?.durationMs).not.toBeNull();
    session.stop();
    // Reloading the finished game does not archive it again.
    const reloaded = new GameSession(fakeAi(), storage, fakeAnalysis());
    reloaded.setArchive(archive);
    reloaded.start();
    expect(archive.getSnapshot()).toHaveLength(1);
    reloaded.stop();
  });

  it('opens an archived game as the finished game on the board', () => {
    const { session } = started();
    session.openArchived({
      id: 'x',
      endedAt: 1,
      durationMs: null,
      moves: ['c3-c4', 'f6-f5'],
      result: { winner: 1, reason: 'resignation' },
      opponent: 'computer',
      human: -1,
      level: 'hard',
      clock: null,
    });
    const snapshot = session.getSnapshot();
    expect(snapshot.moveList).toEqual(['c3-c4', 'f6-f5']);
    expect(snapshot.result).toEqual({ winner: 1, reason: 'resignation' });
    expect(snapshot.settings).toMatchObject({ human: -1, level: 'hard' });
    expect(snapshot.flipped).toBe(true);
    expect(snapshot.clock).toBeNull();
    session.stop();
  });

  it('reviews only finished games', () => {
    const { session } = started();
    session.startReview();
    expect(session.getSnapshot().review).toBeNull();
    session.stop();
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
