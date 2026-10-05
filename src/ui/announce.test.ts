import { describe, expect, it } from 'vitest';
import { describeEvent } from './announce';
import { translator } from './i18n';
import type { GameEvent } from './session';

const t = translator('en');
const tr = translator('tr');

describe('screen reader announcements', () => {
  it('says who moved, what was captured, and what comes next', () => {
    const event: GameEvent = {
      id: 1,
      kind: 'move',
      by: 'computer',
      side: -1,
      notation: 'd6xd4',
      captures: 1,
      promotes: false,
      damaAlti: false,
      mustCapture: true,
      result: null,
    };
    expect(describeEvent(event, 1, t)).toBe(
      'Computer played d6xd4. Captured 1. You must capture. Take the most pieces possible.',
    );
    expect(describeEvent(event, 1, tr)).toBe(
      'Bilgisayar d6xd4 oynadı. 1 taş alındı. Taş almak zorunlu. En çok taşı alan hamleyi yapın.',
    );
  });

  it('announces promotion, dama altı, the start and the result', () => {
    const base = {
      id: 2,
      kind: 'move',
      by: 'human',
      side: 1,
      notation: 'f7-f8',
      captures: 0,
      mustCapture: false,
      result: null,
    } as const;
    expect(describeEvent({ ...base, promotes: true, damaAlti: false }, 1, t)).toBe(
      'You played f7-f8. The man became a king.',
    );
    expect(describeEvent({ ...base, promotes: false, damaAlti: true }, 1, t)).toContain(
      'Dama altı',
    );
    expect(describeEvent({ id: 3, kind: 'start' }, -1, t)).toBe('New game. You play Black.');
    expect(
      describeEvent({ id: 4, kind: 'end', result: { winner: -1, reason: 'resignation' } }, 1, t),
    ).toBe('You lose. By resignation.');
  });
});
