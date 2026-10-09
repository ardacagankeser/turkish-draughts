import type { Color } from '../engine';
import type { Level } from '../ai';
import { LEVELS } from '../ai';
import type { TimeControl } from './clock';

export interface Settings {
  /** The side the player takes; with two players, the side at the bottom at the start. */
  readonly human: Color;
  readonly level: Level;
  /** The time control; untimed when missing or `null`. */
  readonly clock?: TimeControl | null;
  /** `human`: two players share the device (no AI). Missing means against the computer. */
  readonly opponent?: 'computer' | 'human';
  /** With two players, turn the board to the side to move after every move. */
  readonly rotate?: boolean;
}

/** Time left on each side's clock when the game was saved. */
export interface SavedClock {
  readonly white: number;
  readonly black: number;
}

/**
 * How a game ended when the result cannot be recomputed from the moves:
 * a resignation, an agreed draw or a lost clock.
 */
export interface Ending {
  readonly reason: 'resignation' | 'agreement' | 'timeout';
  readonly winner: Color | null;
}

/** What is kept between visits: the game in progress and a few preferences. */
export interface SavedState {
  readonly settings: Settings | null;
  /** Moves of the current game in landing notation. */
  readonly moves: readonly string[];
  readonly ending: Ending | null;
  readonly drawOffers: number;
  readonly flipped: boolean;
  readonly showEvaluation: boolean;
  readonly clock: SavedClock | null;
  /** When the game began (milliseconds since 1970), for its duration in the archive. */
  readonly startedAt: number | null;
}

const KEY = 'turkish-draughts:v1';
const LANGUAGE_KEY = 'turkish-draughts:language';

export const EMPTY_STATE: SavedState = {
  settings: null,
  moves: [],
  ending: null,
  drawOffers: 0,
  flipped: false,
  showEvaluation: true,
  clock: null,
  startedAt: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function parseTimeControl(value: unknown): TimeControl | null {
  if (!isRecord(value)) return null;
  const { initialMs, incrementMs } = value;
  return isTime(initialMs) && initialMs > 0 && isTime(incrementMs)
    ? { initialMs, incrementMs }
    : null;
}

function parseSettings(value: unknown): Settings | null {
  if (!isRecord(value)) return null;
  const { human, level } = value;
  if (human !== 1 && human !== -1) return null;
  const known = LEVELS.find((candidate) => candidate === level);
  if (!known) return null;
  const clock = parseTimeControl(value.clock);
  return {
    human,
    level: known,
    ...(clock ? { clock } : {}),
    ...(value.opponent === 'human'
      ? { opponent: 'human' as const, rotate: value.rotate === true }
      : {}),
  };
}

function parseClock(value: unknown): SavedClock | null {
  if (!isRecord(value)) return null;
  const { white, black } = value;
  return isTime(white) && isTime(black) ? { white, black } : null;
}

function parseEnding(value: unknown): Ending | null {
  if (!isRecord(value)) return null;
  const { reason, winner } = value;
  if (reason === 'agreement') return { reason, winner: null };
  if ((reason === 'resignation' || reason === 'timeout') && (winner === 1 || winner === -1)) {
    return { reason, winner };
  }
  return null;
}

/**
 * Reads the saved state. Storage may be missing or throw (private browsing, blocked
 * cookies), and the data may be stale or edited by hand, so everything is validated.
 */
export function load(storage: Storage = globalThis.localStorage): SavedState {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return EMPTY_STATE;
    return {
      settings: parseSettings(data.settings),
      moves: Array.isArray(data.moves)
        ? data.moves.filter((move): move is string => typeof move === 'string')
        : [],
      ending: parseEnding(data.ending),
      drawOffers: typeof data.drawOffers === 'number' ? data.drawOffers : 0,
      flipped: data.flipped === true,
      showEvaluation: data.showEvaluation !== false,
      clock: parseClock(data.clock),
      startedAt: typeof data.startedAt === 'number' ? data.startedAt : null,
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function save(state: SavedState, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or storage full: the game simply is not remembered.
  }
}

export function loadLanguage(storage: Storage = globalThis.localStorage): string | null {
  try {
    return storage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLanguage(language: string, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Not remembered; the browser language is used next time.
  }
}
