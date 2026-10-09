import { describe, expect, it } from 'vitest';
import { Clock, aiBudget, formatTime, shownTime } from './clock';

const control = { initialMs: 60_000, incrementMs: 2000 };

function manualClock() {
  let time = 1000;
  const clock = new Clock(control, () => time);
  return {
    clock,
    advance: (ms: number) => {
      time += ms;
    },
    now: () => time,
  };
}

describe('clock', () => {
  it("leaves White's first move free, then runs Black's time", () => {
    const { clock, advance } = manualClock();
    advance(5000);
    expect(clock.running).toBeNull();
    clock.moved(1);
    expect(clock.remaining(1)).toBe(60_000);
    expect(clock.running).toBe(-1);
    advance(3000);
    expect(clock.remaining(-1)).toBe(57_000);
  });

  it('adds the increment after every timed move', () => {
    const { clock, advance } = manualClock();
    clock.moved(1);
    advance(4000);
    clock.moved(-1);
    expect(clock.remaining(-1)).toBe(58_000);
    advance(1000);
    clock.moved(1);
    expect(clock.remaining(1)).toBe(61_000);
  });

  it('stops counting while paused', () => {
    const { clock, advance } = manualClock();
    clock.moved(1);
    advance(1000);
    clock.setPaused(true);
    advance(30_000);
    expect(clock.remaining(-1)).toBe(59_000);
    clock.setPaused(false);
    advance(1000);
    expect(clock.remaining(-1)).toBe(58_000);
  });

  it("holds a decided move: nobody's time runs until it is shown", () => {
    const { clock, advance } = manualClock();
    clock.moved(1);
    advance(2000);
    clock.hold(-1);
    expect(clock.running).toBeNull();
    expect(clock.held).toBe(-1);
    advance(5000);
    expect(clock.remaining(-1)).toBe(58_000);
    expect(clock.remaining(1)).toBe(60_000);
    // Shown: the held side still gets its increment, and the other side's time starts.
    clock.moved(-1);
    expect(clock.remaining(-1)).toBe(60_000);
    expect(clock.running).toBe(1);
    expect(clock.held).toBeNull();
    // Holding a side whose time is not running does nothing.
    clock.hold(-1);
    expect(clock.running).toBe(1);
  });

  it('reports the side that ran out of time', () => {
    const { clock, advance } = manualClock();
    clock.moved(1);
    advance(59_999);
    expect(clock.flagged()).toBeNull();
    advance(1);
    expect(clock.flagged()).toBe(-1);
    expect(clock.remaining(-1)).toBe(0);
  });

  it('gives the view the UI counts down from', () => {
    const { clock, advance, now } = manualClock();
    clock.moved(1);
    const view = clock.view();
    advance(2500);
    expect(shownTime(view, -1, now())).toBe(57_500);
    expect(shownTime(view, 1, now())).toBe(60_000);
  });

  it('formats the time as lichess does', () => {
    expect(formatTime(45 * 60_000)).toBe('45:00');
    expect(formatTime(61_200)).toBe('1:02');
    expect(formatTime(10_000)).toBe('0:10');
    expect(formatTime(9_470)).toBe('9.4');
    expect(formatTime(0)).toBe('0.0');
    expect(formatTime(3_725_000)).toBe('1:02:05');
  });

  it('lets the AI think less as its time runs out, never longer than its level', () => {
    expect(aiBudget(180_000, { initialMs: 180_000, incrementMs: 2000 }, 1500)).toBe(1500);
    expect(aiBudget(10_000, { initialMs: 180_000, incrementMs: 0 }, 1500)).toBe(400);
    expect(aiBudget(100, { initialMs: 180_000, incrementMs: 2000 }, 1500)).toBe(50);
  });
});
