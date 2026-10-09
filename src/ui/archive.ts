import type { Color, GameResult } from '../engine';
import type { Level } from '../ai';
import { LEVELS } from '../ai';
import type { TimeControl } from './clock';

/** A finished game, kept in the archive. */
export interface ArchivedGame {
  readonly id: string;
  /** When the game ended, in milliseconds since 1970. */
  readonly endedAt: number;
  /** How long it lasted, or `null` if its start is unknown (a game from before the archive). */
  readonly durationMs: number | null;
  /** Moves in landing notation, from the standard starting position. */
  readonly moves: readonly string[];
  readonly result: GameResult;
  /** `human`: two players on one device. */
  readonly opponent: 'computer' | 'human';
  /** The player's side against the computer (White with two players). */
  readonly human: Color;
  readonly level: Level;
  readonly clock: TimeControl | null;
}

/** Where archived games are kept. */
export interface GameStore {
  all(): Promise<ArchivedGame[]>;
  put(game: ArchivedGame): Promise<void>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

/** Keeps games for this visit only: tests, and browsers that block IndexedDB. */
export class MemoryStore implements GameStore {
  readonly #games = new Map<string, ArchivedGame>();

  all(): Promise<ArchivedGame[]> {
    return Promise.resolve([...this.#games.values()]);
  }

  put(game: ArchivedGame): Promise<void> {
    this.#games.set(game.id, game);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.#games.delete(id);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.#games.clear();
    return Promise.resolve();
  }
}

const DATABASE = 'turkish-draughts';
const GAMES = 'games';

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB request failed'));
    };
  });

/** Keeps games in the browser's IndexedDB, so they survive closing the page. */
export class IndexedDbStore implements GameStore {
  readonly #factory: IDBFactory;
  #db: Promise<IDBDatabase> | null = null;

  constructor(factory: IDBFactory = globalThis.indexedDB) {
    this.#factory = factory;
  }

  async all(): Promise<ArchivedGame[]> {
    const records: unknown[] = await this.#run('readonly', (store) => store.getAll());
    return records.filter(isArchivedGame);
  }

  async put(game: ArchivedGame): Promise<void> {
    await this.#run('readwrite', (store) => store.put(game));
  }

  async delete(id: string): Promise<void> {
    await this.#run('readwrite', (store) => store.delete(id));
  }

  async clear(): Promise<void> {
    await this.#run('readwrite', (store) => store.clear());
  }

  async #run<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.#open();
    return request(action(db.transaction(GAMES, mode).objectStore(GAMES)));
  }

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise((resolve, reject) => {
      const open = this.#factory.open(DATABASE, 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore(GAMES, { keyPath: 'id' });
      };
      open.onsuccess = () => {
        resolve(open.result);
      };
      open.onerror = () => {
        reject(open.error ?? new Error('Cannot open IndexedDB'));
      };
    });
    return this.#db;
  }
}

/** Data read back from storage may be old or edited by hand. */
function isArchivedGame(value: unknown): value is ArchivedGame {
  if (typeof value !== 'object' || value === null) return false;
  const game = value as Record<keyof ArchivedGame, unknown>;
  return (
    typeof game.id === 'string' &&
    typeof game.endedAt === 'number' &&
    Array.isArray(game.moves) &&
    typeof game.result === 'object' &&
    game.result !== null &&
    (game.human === 1 || game.human === -1) &&
    LEVELS.some((level) => level === game.level)
  );
}

/** The archive the pages read: newest game first, kept in sync with its store. */
export class GameArchive {
  readonly #store: GameStore;
  readonly #listeners = new Set<() => void>();
  #games: readonly ArchivedGame[] = [];
  #loaded = false;

  constructor(store: GameStore) {
    this.#store = store;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): readonly ArchivedGame[] => this.#games;

  get loaded(): boolean {
    return this.#loaded;
  }

  /** Reads the stored games; a store that cannot be read leaves the archive empty. */
  readonly load = async (): Promise<void> => {
    try {
      this.#set(await this.#store.all());
    } catch {
      this.#set([]);
    }
  };

  readonly add = async (game: ArchivedGame): Promise<void> => {
    this.#set([game, ...this.#games.filter((other) => other.id !== game.id)]);
    try {
      await this.#store.put(game);
    } catch {
      // Not kept beyond this visit.
    }
  };

  readonly remove = async (id: string): Promise<void> => {
    this.#set(this.#games.filter((game) => game.id !== id));
    try {
      await this.#store.delete(id);
    } catch {
      // Already gone from the list.
    }
  };

  readonly clear = async (): Promise<void> => {
    this.#set([]);
    try {
      await this.#store.clear();
    } catch {
      // Already gone from the list.
    }
  };

  #set(games: readonly ArchivedGame[]): void {
    this.#loaded = true;
    this.#games = [...games].sort((a, b) => b.endedAt - a.endedAt);
    for (const listener of this.#listeners) listener();
  }
}

/** The store to use: IndexedDB where the browser has it, otherwise this visit's memory. */
export function defaultStore(): GameStore {
  return typeof indexedDB === 'undefined' ? new MemoryStore() : new IndexedDbStore();
}

// --- Filters and statistics -------------------------------------------------------

export type Outcome = 'win' | 'draw' | 'loss';

/** The result from the player's side; with two players, from White's. */
export function outcomeOf(game: ArchivedGame): Outcome {
  const winner = game.result.winner;
  if (winner === null) return 'draw';
  return winner === game.human ? 'win' : 'loss';
}

export interface ArchiveFilter {
  readonly outcome: Outcome | 'all';
  /** A computer level, two players, or every game. */
  readonly opponent: Level | 'human' | 'all';
}

export function filterGames(games: readonly ArchivedGame[], filter: ArchiveFilter): ArchivedGame[] {
  return games.filter(
    (game) =>
      (filter.outcome === 'all' || outcomeOf(game) === filter.outcome) &&
      (filter.opponent === 'all' ||
        (filter.opponent === 'human'
          ? game.opponent === 'human'
          : game.opponent === 'computer' && game.level === filter.opponent)),
  );
}

export type Tally = Readonly<Record<Outcome, number>>;

export interface Statistics {
  /** Results against the computer, per level (levels never played are left out). */
  readonly levels: readonly { readonly level: Level; readonly tally: Tally }[];
  readonly total: Tally;
  /** The latest results against the computer that are all the same, newest first. */
  readonly streak: { readonly outcome: Outcome; readonly length: number } | null;
  /** The next level, once the last games at a level were all won. */
  readonly suggestion: { readonly from: Level; readonly to: Level } | null;
}

/** Wins in a row at a level after which the next level is suggested. */
export const LEVEL_UP_WINS = 3;

/** Statistics of the games against the computer; `games` are newest first. */
export function statistics(games: readonly ArchivedGame[]): Statistics {
  const computer = games.filter((game) => game.opponent === 'computer');
  const empty = (): Record<Outcome, number> => ({ win: 0, draw: 0, loss: 0 });
  const total = empty();
  const levels = LEVELS.map((level) => {
    const tally = empty();
    for (const game of computer) {
      if (game.level === level) tally[outcomeOf(game)]++;
    }
    return { level, tally };
  }).filter(({ tally }) => tally.win + tally.draw + tally.loss > 0);
  for (const game of computer) total[outcomeOf(game)]++;

  let streak: Statistics['streak'] = null;
  const [latest] = computer;
  if (latest) {
    const outcome = outcomeOf(latest);
    let length = 0;
    for (const game of computer) {
      if (outcomeOf(game) !== outcome) break;
      length++;
    }
    streak = { outcome, length };
  }

  let suggestion: Statistics['suggestion'] = null;
  if (latest) {
    const recent = computer.filter((game) => game.level === latest.level).slice(0, LEVEL_UP_WINS);
    const next = LEVELS[LEVELS.indexOf(latest.level) + 1];
    if (next && recent.length === LEVEL_UP_WINS && recent.every((g) => outcomeOf(g) === 'win')) {
      suggestion = { from: latest.level, to: next };
    }
  }
  return { levels, total, streak, suggestion };
}

/** 4:05, or 1:02:05 past an hour. */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** A fresh identifier for an archived game. */
export function newGameId(): string {
  const crypto = globalThis.crypto as Crypto | undefined;
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
