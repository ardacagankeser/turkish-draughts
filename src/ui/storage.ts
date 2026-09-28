import type { Color } from '../engine';
import type { Level } from '../ai';
import { LEVELS } from '../ai';

export interface Settings {
  readonly human: Color;
  readonly level: Level;
}

/** What is kept between visits: the game in progress and a few preferences. */
export interface SavedState {
  readonly settings: Settings | null;
  /** Moves of the current game in landing notation. */
  readonly moves: readonly string[];
  readonly drawOffers: number;
  readonly flipped: boolean;
}

const KEY = 'turkish-draughts:v1';
const LANGUAGE_KEY = 'turkish-draughts:language';

export const EMPTY_STATE: SavedState = {
  settings: null,
  moves: [],
  drawOffers: 0,
  flipped: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function parseSettings(value: unknown): Settings | null {
  if (!isRecord(value)) return null;
  const { human, level } = value;
  if (human !== 1 && human !== -1) return null;
  const known = LEVELS.find((candidate) => candidate === level);
  return known ? { human, level: known } : null;
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
      drawOffers: typeof data.drawOffers === 'number' ? data.drawOffers : 0,
      flipped: data.flipped === true,
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
