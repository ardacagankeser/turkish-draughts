import type { SearchOptions } from './search';

export type Level = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

export const LEVELS: readonly Level[] = ['beginner', 'easy', 'medium', 'hard', 'expert'];

/**
 * Search settings per level. The lower levels are weakened by shallow search and by
 * choosing randomly among moves that are nearly as good as the best one.
 */
export const LEVEL_OPTIONS: Readonly<Record<Level, SearchOptions>> = {
  beginner: { maxDepth: 1, timeMs: 300, randomMargin: 150 },
  easy: { maxDepth: 3, timeMs: 500, randomMargin: 50 },
  medium: { maxDepth: 6, timeMs: 1000, randomMargin: 15 },
  hard: { timeMs: 1500 },
  expert: { timeMs: 4000 },
};

/** How far ahead (a quarter of a man) the AI must be to turn a draw down. */
export const DRAW_MARGIN = 25;

/**
 * Whether the AI accepts a draw offer, given its own evaluation of the position
 * (from its point of view). It accepts unless it is clearly better.
 */
export function acceptsDraw(score: number): boolean {
  return score < DRAW_MARGIN;
}
