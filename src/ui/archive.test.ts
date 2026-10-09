import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { ArchivedGame } from './archive';
import {
  GameArchive,
  IndexedDbStore,
  MemoryStore,
  filterGames,
  formatDuration,
  outcomeOf,
  statistics,
} from './archive';

let next = 0;
/** A finished game; `winner` is from White's side, the player plays White unless told. */
const game = (overrides: Partial<ArchivedGame> = {}): ArchivedGame => ({
  id: `game-${++next}`,
  endedAt: 1_000_000 + next,
  durationMs: 60_000,
  moves: ['c3-c4'],
  result: { winner: 1, reason: 'resignation' },
  opponent: 'computer',
  human: 1,
  level: 'easy',
  clock: null,
  ...overrides,
});

describe('archive storage', () => {
  it('keeps games in IndexedDB across store instances', async () => {
    const factory = new IDBFactory();
    const first = new IndexedDbStore(factory);
    const kept = game();
    await first.put(kept);
    await first.put(game());
    const second = new IndexedDbStore(factory);
    expect(await second.all()).toHaveLength(2);
    await second.delete(kept.id);
    expect((await second.all()).map((g) => g.id)).not.toContain(kept.id);
    await second.clear();
    expect(await second.all()).toEqual([]);
  });

  it('skips records that are not games', async () => {
    const factory = new IDBFactory();
    const store = new IndexedDbStore(factory);
    await store.put({ id: 'broken' } as unknown as ArchivedGame);
    await store.put(game());
    expect(await store.all()).toHaveLength(1);
  });

  it('lists the newest game first and follows additions and deletions', async () => {
    const archive = new GameArchive(new MemoryStore());
    const older = game({ endedAt: 10 });
    const newer = game({ endedAt: 20 });
    await archive.add(older);
    await archive.add(newer);
    expect(archive.getSnapshot().map((g) => g.id)).toEqual([newer.id, older.id]);
    await archive.remove(newer.id);
    expect(archive.getSnapshot()).toEqual([older]);
    await archive.clear();
    expect(archive.getSnapshot()).toEqual([]);
  });

  it('starts empty when the store cannot be read', async () => {
    const archive = new GameArchive({
      all: () => Promise.reject(new Error('blocked')),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    });
    await archive.load();
    expect(archive.loaded).toBe(true);
    expect(archive.getSnapshot()).toEqual([]);
  });
});

describe('archive statistics', () => {
  it("reads results from the player's side", () => {
    expect(outcomeOf(game())).toBe('win');
    expect(outcomeOf(game({ human: -1 }))).toBe('loss');
    expect(outcomeOf(game({ result: { winner: null, reason: 'agreement' } }))).toBe('draw');
  });

  it('filters by result and opponent', () => {
    const games = [
      game(),
      game({ result: { winner: -1, reason: 'no-pieces' } }),
      game({ level: 'hard' }),
      game({ opponent: 'human' }),
    ];
    expect(filterGames(games, { outcome: 'loss', opponent: 'all' })).toHaveLength(1);
    expect(filterGames(games, { outcome: 'all', opponent: 'hard' })).toHaveLength(1);
    expect(filterGames(games, { outcome: 'all', opponent: 'human' })).toHaveLength(1);
    expect(filterGames(games, { outcome: 'win', opponent: 'easy' })).toHaveLength(1);
  });

  it('counts results per level, the streak, and suggests the next level', () => {
    const loss = { winner: -1, reason: 'no-pieces' } as const;
    // Newest first: three wins at Easy after a loss; a two-player game does not count.
    const games = [
      game({ opponent: 'human', result: loss }),
      game(),
      game(),
      game(),
      game({ result: loss }),
      game({ level: 'medium', result: { winner: null, reason: 'agreement' } }),
    ];
    const stats = statistics(games);
    expect(stats.levels).toEqual([
      { level: 'easy', tally: { win: 3, draw: 0, loss: 1 } },
      { level: 'medium', tally: { win: 0, draw: 1, loss: 0 } },
    ]);
    expect(stats.total).toEqual({ win: 3, draw: 1, loss: 1 });
    expect(stats.streak).toEqual({ outcome: 'win', length: 3 });
    expect(stats.suggestion).toEqual({ from: 'easy', to: 'medium' });
    // Not after two wins, and never past the top level.
    expect(statistics(games.slice(2)).suggestion).toBeNull();
    expect(
      statistics([game({ level: 'expert' }), game({ level: 'expert' }), game({ level: 'expert' })])
        .suggestion,
    ).toBeNull();
    expect(statistics([]).streak).toBeNull();
  });

  it('formats durations', () => {
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});
