import type { Color } from '../engine';

/** A time control: minutes per side plus a Fischer increment added after every move. */
export interface TimeControl {
  readonly initialMs: number;
  readonly incrementMs: number;
}

const MINUTE = 60_000;
const SECOND = 1000;

/** The presets offered in the new-game dialog, by name (`null` is an untimed game). */
export const TIME_CONTROLS: readonly { readonly id: string; readonly control: TimeControl }[] = [
  { id: '3+2', control: { initialMs: 3 * MINUTE, incrementMs: 2 * SECOND } },
  { id: '5+3', control: { initialMs: 5 * MINUTE, incrementMs: 3 * SECOND } },
  { id: '10+5', control: { initialMs: 10 * MINUTE, incrementMs: 5 * SECOND } },
  { id: '15+10', control: { initialMs: 15 * MINUTE, incrementMs: 10 * SECOND } },
  // TÜDAF tournament play: 45 minutes per player, no increment (tournament rule 1c).
  { id: 'tudaf', control: { initialMs: 45 * MINUTE, incrementMs: 0 } },
];

/** Under this much time the clock turns red and a warning sounds. */
export const LOW_TIME_MS = 10 * SECOND;

/** What the UI needs to draw both clocks; the running one counts down from `since`. */
export interface ClockView {
  readonly control: TimeControl;
  /** Milliseconds left for each side when `since` was taken. */
  readonly white: number;
  readonly black: number;
  /** The side whose time is running, or `null` before the first move and after the end. */
  readonly running: Color | null;
  /** The clock is paused (the tab is hidden); `running` keeps the side to move. */
  readonly paused: boolean;
  /** `performance.now()` when the running side's time was last updated. */
  readonly since: number;
}

/**
 * A two-sided chess clock. It never counts ticks: the running side's time is the time it
 * had when it started, minus the time elapsed since, read from an injectable `now()`.
 * White's first move is free; the clock starts with Black's time once it has been played.
 */
export class Clock {
  readonly control: TimeControl;
  readonly #now: () => number;
  #white: number;
  #black: number;
  #running: Color | null = null;
  /** The side whose move is decided but not shown yet (see `hold`). */
  #held: Color | null = null;
  #paused = false;
  #since: number;

  constructor(
    control: TimeControl,
    now: () => number = () => performance.now(),
    remaining?: { readonly white: number; readonly black: number },
  ) {
    this.control = control;
    this.#now = now;
    this.#white = remaining?.white ?? control.initialMs;
    this.#black = remaining?.black ?? control.initialMs;
    this.#since = now();
  }

  /** Milliseconds `color` has left now (never below 0). */
  remaining(color: Color): number {
    const stored = color === 1 ? this.#white : this.#black;
    const elapsed = color === this.#running && !this.#paused ? this.#now() - this.#since : 0;
    return Math.max(0, stored - elapsed);
  }

  get running(): Color | null {
    return this.#running;
  }

  get paused(): boolean {
    return this.#paused;
  }

  /** The side that ran out of time, if any. */
  flagged(): Color | null {
    return this.#running !== null && this.remaining(this.#running) === 0 ? this.#running : null;
  }

  /** `color` has just moved: its time stops, gains the increment, and the opponent's runs. */
  moved(color: Color): void {
    const wasRunning = this.#running === color || this.#held === color;
    this.#settle();
    this.#held = null;
    if (wasRunning) this.#add(color, this.control.incrementMs);
    this.#running = color === 1 ? -1 : 1;
  }

  /**
   * `color` has decided its move, which waits for the board to finish animating the last
   * one: its time stops now, and neither side's runs until `moved` shows the move.
   */
  hold(color: Color): void {
    if (this.#running !== color) return;
    this.#settle();
    this.#running = null;
    this.#held = color;
  }

  /** The side whose decided move has not been shown yet. */
  get held(): Color | null {
    return this.#held;
  }

  /** Runs `color`'s time (after a take-back, or when a saved game is resumed). */
  run(color: Color | null): void {
    this.#settle();
    this.#held = null;
    this.#running = color;
  }

  /** Stops both clocks for good (the game is over). */
  stop(): void {
    this.run(null);
  }

  /** Pauses or resumes the running side's time, keeping whose turn it is. */
  setPaused(paused: boolean): void {
    if (paused === this.#paused) return;
    this.#settle();
    this.#paused = paused;
  }

  view(): ClockView {
    this.#settle();
    return {
      control: this.control,
      white: this.#white,
      black: this.#black,
      running: this.#running,
      paused: this.#paused,
      since: this.#since,
    };
  }

  /** Folds the time elapsed so far into the running side's remaining time. */
  #settle(): void {
    const now = this.#now();
    if (this.#running !== null && !this.#paused) {
      this.#add(this.#running, -(now - this.#since));
    }
    this.#since = now;
  }

  #add(color: Color, ms: number): void {
    if (color === 1) this.#white = Math.max(0, this.#white + ms);
    else this.#black = Math.max(0, this.#black + ms);
  }
}

/** The time `view` shows for `color` at `now`. */
export function shownTime(view: ClockView, color: Color, now: number): number {
  const stored = color === 1 ? view.white : view.black;
  const running = view.running === color && !view.paused;
  return Math.max(0, stored - (running ? Math.max(0, now - view.since) : 0));
}

/** 5:03, or 9.4 under ten seconds (as on lichess). Hours show as 1:05:03. */
export function formatTime(ms: number): string {
  if (ms < LOW_TIME_MS) return (Math.floor(ms / 100) / 10).toFixed(1);
  const total = Math.ceil(ms / SECOND);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** The AI's thinking time with a clock: about a 25th of what it has left, plus the increment. */
export function aiBudget(remaining: number, control: TimeControl, levelMs: number): number {
  const budget = remaining / 25 + control.incrementMs * 0.8;
  // Never slower than the level allows, never more than half of what is left.
  return Math.max(20, Math.min(levelMs, budget, remaining / 2));
}
