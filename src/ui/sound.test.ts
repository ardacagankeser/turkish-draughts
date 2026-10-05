import { describe, expect, it } from 'vitest';
import { timing } from './animation';
import type { GameEvent } from './session';
import type { AudioContextLike } from './sound';
import { SoundPlayer, tonesFor } from './sound';

const move = (overrides: Partial<Extract<GameEvent, { kind: 'move' }>> = {}): GameEvent => ({
  id: 1,
  kind: 'move',
  by: 'human',
  notation: 'c3-c4',
  captures: 0,
  promotes: false,
  damaAlti: false,
  mustCapture: false,
  result: null,
  ...overrides,
});

/** Counts the oscillators started; nothing is actually played. */
function fakeContext(): AudioContextLike & { started: number } {
  const param = {
    value: 0,
    setValueAtTime: () => param,
    exponentialRampToValueAtTime: () => param,
  };
  const node = () => ({ connect: (next: unknown) => next });
  const context = {
    started: 0,
    currentTime: 0,
    state: 'running',
    destination: {} as AudioNode,
    resume: () => Promise.resolve(),
    createGain: () => ({ ...node(), gain: param }) as unknown as GainNode,
    createOscillator: () =>
      ({
        ...node(),
        type: 'sine',
        frequency: param,
        start: () => {
          context.started++;
        },
        stop: () => undefined,
      }) as unknown as OscillatorNode,
  };
  return context;
}

describe('sounds', () => {
  it('ticks once per captured piece, after the move sound', () => {
    expect(tonesFor(move(), 1)).toHaveLength(1);
    const chain = tonesFor(move({ captures: 3 }), 1);
    expect(chain).toHaveLength(4);
    const ticks = chain.slice(1).map((tone) => tone.at);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it('adds a chime for a promotion and a call for dama altı', () => {
    expect(tonesFor(move({ promotes: true }), 1)).toHaveLength(3);
    expect(tonesFor(move({ damaAlti: true }), 1)).toHaveLength(2);
  });

  it('plays different endings for a win, a loss and a draw', () => {
    const end = (winner: 1 | -1 | null): GameEvent => ({
      id: 2,
      kind: 'end',
      result:
        winner === null ? { winner: null, reason: 'agreement' } : { winner, reason: 'resignation' },
    });
    const win = tonesFor(end(1), 1).map((t) => t.frequency);
    const loss = tonesFor(end(-1), 1).map((t) => t.frequency);
    expect(win.at(-1)).toBeGreaterThan(win[0] ?? 0);
    expect(loss.at(-1)).toBeLessThan(loss[0] ?? 0);
    expect(tonesFor(end(null), 1)).toHaveLength(2);
  });

  it('stays silent until unlocked by a gesture, when muted, and at zero volume', () => {
    const context = fakeContext();
    const player = new SoundPlayer(() => context);
    expect(player.play(move(), 1)).toBe(0);
    player.unlock();
    expect(player.play(move({ captures: 2 }), 1)).toBe(3);
    expect(context.started).toBe(3);
    player.setVolume(1, true);
    expect(player.play(move(), 1)).toBe(0);
    player.setVolume(0, false);
    expect(player.play(move(), 1)).toBe(0);
  });

  it('times the capture ticks to the animation speed', () => {
    const computer = move({ by: 'computer', captures: 2 });
    const at = (scale: number) => tonesFor(computer, 1, timing(scale)).map((tone) => tone.at);
    expect(at(1.6)[2]).toBeGreaterThan(at(1)[2] ?? 0);
  });
});
