import { describe, expect, it } from 'vitest';
import { Game, moveToNotation, parseSquare } from '../engine';
import { MemoryStorage } from '../test/fakes';
import { MESSAGES } from './i18n';
import { LearnSession } from './learn-session';
import { EXERCISES, LESSONS } from './lessons';

describe('lessons', () => {
  it.each(EXERCISES.map(({ exercise }) => [exercise.id, exercise] as const))(
    '%s is a live position whose answers are legal',
    (_, exercise) => {
      const game = new Game(exercise.fen);
      expect(game.isOver).toBe(false);
      const legal = game.legalMoves.map(moveToNotation);
      for (const move of exercise.accept) expect(legal).toContain(move);
      for (const key of [exercise.task, exercise.rule]) {
        expect(MESSAGES.en[key]).toBeTruthy();
        expect(MESSAGES.tr[key]).toBeTruthy();
      }
    },
  );

  it('asks for a choice where it says "the one the rules allow"', () => {
    // The majority rule leaves one capture although two pieces could start one.
    const most = EXERCISES.find(({ exercise }) => exercise.id === 'capturing-most')?.exercise;
    expect(most && new Game(most.fen).legalMoves.map(moveToNotation)).toEqual(['c2xc4xc6']);
  });

  it('has unique exercise ids', () => {
    const ids = LESSONS.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

const sq = parseSquare;

describe('learn session', () => {
  it('solves an exercise with the right move and remembers it', () => {
    const storage = new MemoryStorage();
    const session = new LearnSession(storage);
    expect(session.getSnapshot().exercise.id).toBe('moving-forward');
    session.clickSquare(sq('d3'));
    session.clickSquare(sq('d4'));
    expect(session.getSnapshot()).toMatchObject({ status: 'right', moveNumber: 1 });
    expect(session.getSnapshot().legalMoves).toEqual([]);
    expect(new LearnSession(storage).getSnapshot().solved.has('moving-forward')).toBe(true);
  });

  it('shows a wrong move, then puts the position back', async () => {
    const session = new LearnSession(new MemoryStorage());
    session.clickSquare(sq('d3'));
    session.clickSquare(sq('e3'));
    expect(session.getSnapshot().status).toBe('wrong');
    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(session.getSnapshot()).toMatchObject({ status: 'try', moveNumber: 0 });
    session.stop();
  });

  it('says so when a piece is sent where it cannot go', () => {
    const session = new LearnSession(new MemoryStorage());
    session.clickSquare(sq('d3'));
    session.clickSquare(sq('d6'));
    expect(session.getSnapshot().status).toBe('missed');
  });

  it('moves between exercises', () => {
    const session = new LearnSession(new MemoryStorage());
    session.next();
    expect(session.getSnapshot().exercise.id).toBe('moving-sideways');
    session.previous();
    session.previous();
    expect(session.getSnapshot().index).toBe(0);
    session.goTo(EXERCISES.length - 1);
    expect(session.getSnapshot().exercise.id).toBe('tudaf-10');
  });
});
