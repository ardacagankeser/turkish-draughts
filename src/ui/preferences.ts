/**
 * Display and game preferences, kept apart from the saved game so starting a new game or
 * clearing it never resets them. Everything is validated on load, as in `storage.ts`.
 */

export const THEMES = ['system', 'light', 'dark'] as const;
export const BOARDS = ['wood', 'classic', 'green', 'blue', 'contrast'] as const;
export const PIECE_STYLES = ['classic', 'flat', 'contrast'] as const;
export const ANIMATION_SPEEDS = ['none', 'fast', 'normal', 'slow'] as const;

export type Theme = (typeof THEMES)[number];
export type BoardStyle = (typeof BOARDS)[number];
export type PieceStyle = (typeof PIECE_STYLES)[number];
export type AnimationSpeed = (typeof ANIMATION_SPEEDS)[number];

export interface Preferences {
  readonly theme: Theme;
  readonly board: BoardStyle;
  readonly pieces: PieceStyle;
  readonly coordinates: boolean;
  /** Dots on the squares the selected piece can reach. */
  readonly legalMoves: boolean;
  readonly lastMove: boolean;
  /**
   * How fast moves are shown. Moves always animate unless this is `none`: they show what
   * happened on the board. A system reduced-motion setting only calms the decoration.
   */
  readonly animation: AnimationSpeed;
  /** A move is played only once its piece is clicked a second time (as on chess.com). */
  readonly confirmMoves: boolean;
  /** 0 to 1. */
  readonly volume: number;
  readonly muted: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  board: 'wood',
  pieces: 'classic',
  coordinates: true,
  legalMoves: true,
  lastMove: true,
  animation: 'normal',
  confirmMoves: false,
  volume: 0.7,
  muted: false,
};

const KEY = 'turkish-draughts:preferences';
/** Where the mute toggle was kept before there were preferences. */
const LEGACY_MUTED_KEY = 'turkish-draughts:muted';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.find((option) => option === value) ?? fallback;
}

const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

export function loadPreferences(storage: Storage = globalThis.localStorage): Preferences {
  const defaults = DEFAULT_PREFERENCES;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return { ...defaults, muted: storage.getItem(LEGACY_MUTED_KEY) === 'true' };
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return defaults;
    const volume =
      typeof data.volume === 'number' && data.volume >= 0 && data.volume <= 1
        ? data.volume
        : defaults.volume;
    return {
      theme: oneOf(THEMES, data.theme, defaults.theme),
      board: oneOf(BOARDS, data.board, defaults.board),
      pieces: oneOf(PIECE_STYLES, data.pieces, defaults.pieces),
      coordinates: flag(data.coordinates, defaults.coordinates),
      legalMoves: flag(data.legalMoves, defaults.legalMoves),
      lastMove: flag(data.lastMove, defaults.lastMove),
      animation: oneOf(ANIMATION_SPEEDS, data.animation, defaults.animation),
      confirmMoves: flag(data.confirmMoves, defaults.confirmMoves),
      volume,
      muted: flag(data.muted, defaults.muted),
    };
  } catch {
    return defaults;
  }
}

export function savePreferences(
  preferences: Preferences,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    storage.setItem(KEY, JSON.stringify(preferences));
    storage.removeItem(LEGACY_MUTED_KEY);
  } catch {
    // Not remembered; the defaults are used next time.
  }
}

/**
 * Shows the preferences that are pure styling as attributes on the root element, where
 * the style sheet picks them up: switching needs no re-render.
 */
export function applyPreferences(root: HTMLElement, preferences: Preferences): void {
  const { dataset } = root;
  if (preferences.theme === 'system') delete dataset.theme;
  else dataset.theme = preferences.theme;
  dataset.board = preferences.board;
  dataset.pieces = preferences.pieces;
  dataset.coordinates = preferences.coordinates ? 'on' : 'off';
  dataset.legalMoves = preferences.legalMoves ? 'on' : 'off';
  dataset.lastMove = preferences.lastMove ? 'on' : 'off';
}

const SPEED_SCALE: Record<AnimationSpeed, number> = {
  none: 0,
  fast: 0.6,
  normal: 1,
  slow: 1.6,
};

/** How much longer than normal animations last; 0 turns them off. */
export function animationScale(speed: AnimationSpeed): number {
  return SPEED_SCALE[speed];
}
