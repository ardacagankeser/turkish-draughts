import type { Move, Square } from '../engine';
import { Game, moveToNotation } from '../engine';
import type { Exercise, Lesson } from './lessons';
import { EXERCISES } from './lessons';
import type { UiPiece } from './pieces';
import { applyMove, piecesFromBoard } from './pieces';
import type { Selection } from './selection';
import { click, jumpedSoFar, movableSquares } from './selection';

/** How long a wrong move stays on the board before the position comes back. */
export const RETRY_MS = 1200;
const PROGRESS_KEY = 'turkish-draughts:learn';

/** `missed`: a square was clicked that no legal move goes to (dots are hidden). */
export type LearnStatus = 'try' | 'right' | 'wrong' | 'missed';

export interface LearnSnapshot {
  readonly index: number;
  readonly total: number;
  readonly lesson: Lesson;
  readonly exercise: Exercise;
  readonly status: LearnStatus;
  readonly pieces: readonly UiPiece[];
  readonly captured: readonly UiPiece[];
  readonly lastMove: Move | null;
  /** 0 before the move, 1 once it is played (so the board animates it). */
  readonly moveNumber: number;
  readonly legalMoves: readonly Move[];
  readonly selection: Selection | null;
  readonly ghosts: readonly Square[];
  /** Exercises solved so far, kept between visits. */
  readonly solved: ReadonlySet<string>;
}

function loadSolved(storage: Storage): Set<string> {
  try {
    const data: unknown = JSON.parse(storage.getItem(PROGRESS_KEY) ?? '[]');
    return new Set(Array.isArray(data) ? data.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * The rules tutorial: one exercise at a time, on a board that accepts any legal move. The
 * right move solves the exercise; another is shown, then taken back for another try.
 */
export class LearnSession {
  readonly #storage: Storage;
  readonly #listeners = new Set<() => void>();
  #index = 0;
  #game: Game;
  #pieces: UiPiece[];
  #captured: UiPiece[] = [];
  #lastMove: Move | null = null;
  #moveNumber = 0;
  #selection: Selection | null = null;
  #status: LearnStatus = 'try';
  #solved: Set<string>;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #snapshot: LearnSnapshot;

  constructor(storage: Storage = globalThis.localStorage, index = 0) {
    this.#storage = storage;
    this.#solved = loadSolved(storage);
    this.#index = Math.max(0, Math.min(EXERCISES.length - 1, index));
    this.#game = this.#fresh();
    this.#pieces = piecesFromBoard(this.#game.board);
    this.#snapshot = this.#build();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): LearnSnapshot => this.#snapshot;

  readonly stop = (): void => {
    clearTimeout(this.#timer);
  };

  readonly clickSquare = (square: Square): void => {
    if (this.#status !== 'try' && this.#status !== 'missed') return;
    const legal = this.#game.legalMoves;
    const result = click(legal, this.#selection, square);
    if (result.type === 'play') {
      this.#play(result.move);
      return;
    }
    // With the dots hidden, say so when a selected piece is sent where it cannot go.
    const missed =
      this.#selection !== null && result.selection === null && !movableSquares(legal).has(square);
    this.#status = missed ? 'missed' : 'try';
    this.#selection = result.selection;
    this.#emit();
  };

  readonly goTo = (index: number): void => {
    if (index < 0 || index >= EXERCISES.length) return;
    this.#index = index;
    this.#restart();
  };

  readonly next = (): void => {
    this.goTo(this.#index + 1);
  };

  readonly previous = (): void => {
    this.goTo(this.#index - 1);
  };

  readonly retry = (): void => {
    this.#restart();
  };

  #play(move: Move): void {
    const { exercise } = this.#current();
    const notation = moveToNotation(move);
    const right = exercise.accept.length === 0 || exercise.accept.includes(notation);
    const played = this.#game.play(move);
    const next = applyMove(this.#pieces, played);
    this.#pieces = next.pieces;
    this.#captured = next.captured;
    this.#lastMove = played;
    this.#moveNumber = 1;
    this.#selection = null;
    if (right) {
      this.#status = 'right';
      this.#solved.add(exercise.id);
      try {
        this.#storage.setItem(PROGRESS_KEY, JSON.stringify([...this.#solved]));
      } catch {
        // Progress is simply not remembered.
      }
    } else {
      this.#status = 'wrong';
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this.#restart();
      }, RETRY_MS);
    }
    this.#emit();
  }

  #restart(): void {
    clearTimeout(this.#timer);
    this.#game = this.#fresh();
    this.#pieces = piecesFromBoard(this.#game.board);
    this.#captured = [];
    this.#lastMove = null;
    this.#moveNumber = 0;
    this.#selection = null;
    this.#status = 'try';
    this.#emit();
  }

  #current(): { lesson: Lesson; exercise: Exercise } {
    const entry = EXERCISES[this.#index] ?? EXERCISES[0];
    if (!entry) throw new Error('There are no exercises');
    return entry;
  }

  #fresh(): Game {
    return new Game(this.#current().exercise.fen);
  }

  #emit(): void {
    this.#snapshot = this.#build();
    for (const listener of this.#listeners) listener();
  }

  #build(): LearnSnapshot {
    const { lesson, exercise } = this.#current();
    const playing = this.#status === 'try' || this.#status === 'missed';
    const legalMoves = playing ? this.#game.legalMoves : [];
    return {
      index: this.#index,
      total: EXERCISES.length,
      lesson,
      exercise,
      status: this.#status,
      pieces: this.#pieces,
      captured: this.#captured,
      lastMove: this.#lastMove,
      moveNumber: this.#moveNumber,
      legalMoves,
      selection: this.#selection,
      ghosts: this.#selection ? jumpedSoFar(legalMoves, this.#selection) : [],
      solved: new Set(this.#solved),
    };
  }
}
