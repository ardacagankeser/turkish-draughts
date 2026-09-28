import type { Color, GameResult, Move, Square } from '../engine';
import { Game, INITIAL_FEN, MAX_DRAW_OFFERS, findMove, moveToNotation, opponent } from '../engine';
import type { AiClient, Level } from '../ai';
import type { UiPiece } from './pieces';
import { applyMove, piecesFromBoard } from './pieces';
import type { Selection } from './selection';
import { click } from './selection';
import type { Settings } from './storage';
import { load, save } from './storage';

/** The AI never answers faster than this, so its move can be seen arriving. */
export const MIN_AI_DELAY_MS = 450;
const NOTICE_MS = 2200;
const HINT_LEVEL: Level = 'hard';

export type Notice = 'drawAccepted' | 'drawDeclined' | 'dama';

export interface EngineInfo {
  readonly depth: number;
  readonly score: number;
}

/** Everything the UI renders, as one immutable value per change. */
export interface Snapshot {
  readonly settings: Settings | null;
  readonly pieces: readonly UiPiece[];
  /** Pieces captured by the last move, kept for the fade-out animation. */
  readonly captured: readonly UiPiece[];
  readonly lastMove: Move | null;
  readonly moveNumber: number;
  readonly turn: Color;
  readonly result: GameResult | null;
  /** Increases every time a game ends, so a game-over dialog can be shown once per ending. */
  readonly resultId: number;
  readonly humanMoves: readonly Move[];
  readonly selection: Selection | null;
  readonly thinking: boolean;
  readonly hint: Move | null;
  readonly moveList: readonly string[];
  readonly drawOffersLeft: number;
  readonly notice: Notice | null;
  readonly engine: EngineInfo | null;
  readonly flipped: boolean;
  readonly canUndo: boolean;
}

type Listener = () => void;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/**
 * A game against the computer: the rules engine, the AI worker, and UI state such as
 * the selection and animations. Framework-free; React reads it via `useSyncExternalStore`.
 */
export class GameSession {
  readonly #ai: AiClient;
  readonly #storage: Storage;
  readonly #listeners = new Set<Listener>();

  #game: Game;
  #settings: Settings | null;
  #pieces: UiPiece[];
  #captured: UiPiece[] = [];
  #lastMove: Move | null;
  #selection: Selection | null = null;
  #thinking = false;
  #hint: Move | null = null;
  #drawOffers: number;
  #notice: Notice | null = null;
  #noticeTimer: ReturnType<typeof setTimeout> | undefined;
  #engine: EngineInfo | null = null;
  #flipped: boolean;
  #resultId = 0;
  /** Bumped whenever the position changes under a pending AI request. */
  #token = 0;
  #snapshot: Snapshot;

  constructor(ai: AiClient, storage: Storage = globalThis.localStorage) {
    this.#ai = ai;
    this.#storage = storage;
    const saved = load(storage);
    this.#game = new Game();
    try {
      for (const move of saved.moves) this.#game.play(move);
    } catch {
      this.#game = new Game();
    }
    this.#settings = saved.settings;
    this.#drawOffers = saved.drawOffers;
    this.#flipped = saved.flipped;
    this.#pieces = piecesFromBoard(this.#game.board);
    this.#lastMove = this.#game.history.at(-1) ?? null;
    if (this.#game.isOver) this.#resultId = 1;
    this.#snapshot = this.#build();
  }

  // --- useSyncExternalStore -------------------------------------------------

  readonly subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): Snapshot => this.#snapshot;

  /** Starts the AI if it is its turn (after loading a saved game, for instance). */
  readonly start = (): void => {
    this.#maybeAiMove();
  };

  /** Stops background work; the session can be started again. */
  readonly stop = (): void => {
    this.#token++;
    this.#ai.dispose();
    clearTimeout(this.#noticeTimer);
    this.#thinking = false;
  };

  // --- Actions ----------------------------------------------------------------

  readonly clickSquare = (square: Square): void => {
    if (!this.#humanToMove()) return;
    const result = click(this.#game.legalMoves, this.#selection, square);
    if (result.type === 'play') this.#commit(result.move);
    else {
      this.#selection = result.selection;
      this.#emit();
    }
  };

  readonly newGame = (settings: Settings): void => {
    this.#cancelAi();
    this.#game = new Game();
    this.#settings = settings;
    this.#drawOffers = 0;
    this.#engine = null;
    this.#flipped = settings.human === -1;
    this.#setNotice(null);
    void this.#ai.newGame().catch(() => undefined);
    this.#reset();
  };

  readonly undo = (): void => {
    this.#cancelAi();
    const human = this.#settings?.human ?? 1;
    // Take back the AI's reply and the human's move, back to the human's turn.
    while (this.#game.history.length > 0) {
      this.#game.undo();
      if (this.#game.turn === human) break;
    }
    this.#reset();
  };

  readonly requestHint = (): void => {
    if (!this.#humanToMove()) return;
    const token = this.#token;
    this.#setThinking(true);
    this.#ai
      .chooseMove(INITIAL_FEN, this.#moves(), HINT_LEVEL)
      .then((response) => {
        if (token !== this.#token) return;
        this.#thinking = false;
        this.#hint = response.move ? findMove(this.#game.legalMoves, response.move) : null;
        this.#emit();
      })
      .catch((error: unknown) => {
        this.#failed(token, error);
      });
  };

  readonly offerDraw = (): void => {
    const settings = this.#settings;
    if (!settings || !this.#humanToMove() || this.#drawOffers >= MAX_DRAW_OFFERS) return;
    const token = this.#token;
    this.#drawOffers++;
    this.#setThinking(true);
    this.#ai
      .offerDraw(INITIAL_FEN, this.#moves(), settings.level, opponent(settings.human))
      .then((accepted) => {
        if (token !== this.#token) return;
        this.#thinking = false;
        if (accepted) {
          this.#game.agreeDraw();
          this.#resultId++;
        }
        this.#setNotice(accepted ? 'drawAccepted' : 'drawDeclined');
        this.#save();
        this.#emit();
      })
      .catch((error: unknown) => {
        this.#failed(token, error);
      });
  };

  readonly resign = (): void => {
    if (!this.#settings || this.#game.isOver) return;
    this.#cancelAi();
    this.#game.resign(this.#settings.human);
    this.#resultId++;
    this.#emit();
  };

  readonly flip = (): void => {
    this.#flipped = !this.#flipped;
    this.#save();
    this.#emit();
  };

  // --- Internals ----------------------------------------------------------------

  #humanToMove(): boolean {
    return (
      this.#settings !== null &&
      !this.#thinking &&
      !this.#game.isOver &&
      this.#game.turn === this.#settings.human
    );
  }

  #moves(): string[] {
    return this.#game.history.map(moveToNotation);
  }

  #commit(move: Move): void {
    const played = this.#game.play(move);
    const next = applyMove(this.#pieces, played);
    this.#pieces = next.pieces;
    this.#captured = next.captured;
    this.#lastMove = played;
    this.#selection = null;
    this.#hint = null;
    if (played.promotes) this.#setNotice('dama');
    if (this.#game.isOver) this.#resultId++;
    this.#save();
    this.#emit();
    this.#maybeAiMove();
  }

  /** Rebuilds the board without animation (new game, undo). */
  #reset(): void {
    this.#pieces = piecesFromBoard(this.#game.board);
    this.#captured = [];
    this.#lastMove = this.#game.history.at(-1) ?? null;
    this.#selection = null;
    this.#hint = null;
    this.#save();
    this.#emit();
    this.#maybeAiMove();
  }

  #maybeAiMove(): void {
    const settings = this.#settings;
    if (!settings || this.#thinking || this.#game.isOver || this.#game.turn === settings.human) {
      return;
    }
    const token = ++this.#token;
    this.#setThinking(true);
    Promise.all([
      this.#ai.chooseMove(INITIAL_FEN, this.#moves(), settings.level),
      sleep(MIN_AI_DELAY_MS),
    ])
      .then(([response]) => {
        if (token !== this.#token) return;
        this.#thinking = false;
        if (!response.move) {
          this.#emit();
          return;
        }
        this.#engine = { depth: response.depth, score: response.score };
        this.#commit(findMove(this.#game.legalMoves, response.move));
      })
      .catch((error: unknown) => {
        this.#failed(token, error);
      });
  }

  #cancelAi(): void {
    this.#token++;
    if (this.#thinking) this.#ai.cancel();
    this.#thinking = false;
  }

  #failed(token: number, error: unknown): void {
    if (token === this.#token) this.#setThinking(false);
    if (!isAbort(error)) console.error(error);
  }

  #setThinking(thinking: boolean): void {
    this.#thinking = thinking;
    this.#emit();
  }

  #setNotice(notice: Notice | null): void {
    clearTimeout(this.#noticeTimer);
    this.#notice = notice;
    if (notice) {
      this.#noticeTimer = setTimeout(() => {
        this.#notice = null;
        this.#emit();
      }, NOTICE_MS);
    }
  }

  #save(): void {
    save(
      {
        settings: this.#settings,
        moves: this.#moves(),
        drawOffers: this.#drawOffers,
        flipped: this.#flipped,
      },
      this.#storage,
    );
  }

  #emit(): void {
    this.#snapshot = this.#build();
    for (const listener of this.#listeners) listener();
  }

  #build(): Snapshot {
    const game = this.#game;
    const human = this.#settings?.human ?? 1;
    const humanMoves = this.#humanToMove() ? game.legalMoves : [];
    // The human has a move to take back once they have played at least once.
    const humanPlies =
      human === 1 ? Math.ceil(game.history.length / 2) : Math.floor(game.history.length / 2);
    return {
      settings: this.#settings,
      pieces: this.#pieces,
      captured: this.#captured,
      lastMove: this.#lastMove,
      moveNumber: game.history.length,
      turn: game.turn,
      result: game.result,
      resultId: this.#resultId,
      humanMoves,
      selection: this.#selection,
      thinking: this.#thinking,
      hint: this.#hint,
      moveList: game.moveList,
      drawOffersLeft: MAX_DRAW_OFFERS - this.#drawOffers,
      notice: this.#notice,
      engine: this.#engine,
      flipped: this.#flipped,
      canUndo: this.#settings !== null && humanPlies > 0,
    };
  }
}
