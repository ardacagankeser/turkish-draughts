import type { Color, GameResult, Move, Piece, Square } from '../engine';
import {
  AmbiguousMoveError,
  Game,
  INITIAL_FEN,
  MAX_DRAW_OFFERS,
  findMove,
  isKing,
  moveToNotation,
  moveToTudafNotation,
  opponent,
  parseSquare,
  rankOf,
} from '../engine';
import type { AiClient, Level } from '../ai';
import type { ReviewPosition } from '../ai';
import { AnalysisClient, LEVEL_OPTIONS, MATE, ReviewClient, winningChances } from '../ai';
import type { ArchivedGame } from './archive';
import { newGameId } from './archive';
import type { ReviewedMove, SideSummary } from './review';
import { INACCURACY, judgeMoves, summarise } from './review';
import type { ClockView } from './clock';
import { Clock, LOW_TIME_MS, aiBudget } from './clock';
import type { UiPiece } from './pieces';
import { applyMove, piecesFromBoard } from './pieces';
import type { Selection } from './selection';
import { candidates, click, jumpedSoFar, premoveMoves } from './selection';
import type { Settings } from './storage';
import { load, save } from './storage';

/** The AI never answers faster than this, so its move can be seen arriving. */
export const MIN_AI_DELAY_MS = 450;
/** A queued premove is played this long after the opponent's move, so both can be seen. */
export const PREMOVE_DELAY_MS = 180;

/** A move queued while the computer thinks, played if it is legal once it is our turn. */
export interface Premove {
  readonly from: Square;
  readonly to: Square;
}
const NOTICE_MS = 2200;
const HINT_LEVEL: Level = 'hard';

export type Notice = 'drawAccepted' | 'drawDeclined' | 'dama' | 'damaAlti';

/**
 * Something that just happened, for sounds and screen-reader announcements. `id` grows
 * with every event, so a listener reacts once per event.
 */
export type GameEvent =
  | { readonly id: number; readonly kind: 'start' }
  | {
      readonly id: number;
      readonly kind: 'move';
      readonly by: 'human' | 'computer';
      /** The side that moved. */
      readonly side: Color;
      /** TÜDAF notation, as in the move list. */
      readonly notation: string;
      readonly captures: number;
      readonly promotes: boolean;
      /** A man reached the rank before promotion ("dama altı", a TÜDAF courtesy call). */
      readonly damaAlti: boolean;
      /** After this move the human must capture. */
      readonly mustCapture: boolean;
      /** Set when this move ended the game. */
      readonly result: GameResult | null;
    }
  | { readonly id: number; readonly kind: 'end'; readonly result: GameResult }
  /** `side`'s clock has just dropped under ten seconds. */
  | { readonly id: number; readonly kind: 'lowTime'; readonly side: Color };

/** Outcome of typing a move in notation. */
export type NotationResult = 'played' | 'illegal' | 'ambiguous' | 'not-your-turn';

/** The live evaluation of the position shown, always from White's point of view. */
export interface Evaluation {
  readonly score: number;
  readonly depth: number;
  readonly pv: readonly string[];
  /** The game is over and `score` is its result (±MATE for a win, 0 for a draw). */
  readonly final: boolean;
}

/** Everything the UI renders, as one immutable value per change. */
export interface Snapshot {
  readonly settings: Settings | null;
  readonly pieces: readonly UiPiece[];
  /** Pieces captured by the last move, kept for the fly-off animation. */
  readonly captured: readonly UiPiece[];
  readonly lastMove: Move | null;
  /** Number of moves played to reach the position shown. */
  readonly moveNumber: number;
  /** Moves in the live game; larger than `moveNumber` while browsing earlier moves. */
  readonly liveMoveNumber: number;
  /** True while an earlier position is shown; the board is then read-only. */
  readonly browsing: boolean;
  /** Moves played in the live game since the player started browsing. */
  readonly missedMoves: number;
  readonly turn: Color;
  readonly result: GameResult | null;
  /** Increases every time a game ends, so a game-over dialog can be shown once per ending. */
  readonly resultId: number;
  readonly humanMoves: readonly Move[];
  readonly selection: Selection | null;
  /** The selection is a whole move, waiting for a second click to be played. */
  readonly confirming: boolean;
  /** The last square clicked ends several capture chains; the player must pick the way. */
  readonly ambiguous: boolean;
  readonly thinking: boolean;
  readonly hint: Move | null;
  readonly moveList: readonly string[];
  readonly drawOffersLeft: number;
  readonly notice: Notice | null;
  readonly evaluation: Evaluation | null;
  readonly showEvaluation: boolean;
  readonly flipped: boolean;
  readonly canUndo: boolean;
  /** Premoves can be queued now: the computer is thinking in the live game. */
  readonly premoveEnabled: boolean;
  readonly premove: Premove | null;
  /** The piece picked for a premove, and where it could go. */
  readonly premoveFrom: Square | null;
  readonly premoveTargets: readonly Square[];
  /** Pieces that can be picked for a premove (they have a legal move right now). */
  readonly premovable: readonly Square[];
  /** Pieces jumped by the part of a capture chain chosen so far (shown as ghosts). */
  readonly ghosts: readonly Square[];
  /** Pieces each side has taken, up to the position shown. */
  readonly taken: { readonly white: readonly Piece[]; readonly black: readonly Piece[] };
  readonly event: GameEvent | null;
  /** Both clocks, in a timed game. */
  readonly clock: ClockView | null;
  /** The computer's review of the finished game, once asked for. */
  readonly review: GameReview | null;
  /** In a reviewed game, the engine's choice in the position shown. */
  readonly bestMove: BoardLine | null;
  readonly practice: Practice | null;
}

/** Where the player stands in "Learn from your mistakes". */
export type PracticeStatus = 'try' | 'checking' | 'right' | 'good' | 'wrong' | 'shown' | 'done';

/** "Learn from your mistakes" (lichess): replay each mistake and look for a better move. */
export interface Practice {
  readonly status: PracticeStatus;
  /** Which mistake, from 0, and how many there are. */
  readonly index: number;
  readonly total: number;
  /** The side to find a move for, and the mistake it made, in TÜDAF notation. */
  readonly side: Color;
  readonly played: string;
  /** The player's latest try. */
  readonly tried: string | null;
  /** The engine's choice; only given once found or shown. */
  readonly best: string | null;
}

/** How long a wrong try stays on the board before the position comes back. */
export const PRACTICE_RETRY_MS = 1200;
const REVEALED: readonly PracticeStatus[] = ['right', 'good', 'shown'];

/** A line on the board: a start square and its landing squares. */
export interface BoardLine {
  readonly from: Square;
  readonly path: readonly Square[];
}

export interface GameReview {
  readonly done: boolean;
  /** Share of the positions evaluated so far, from 0 to 1. */
  readonly progress: number;
  /** Evaluation (White's point of view) after each number of moves; `null` until reached. */
  readonly scores: readonly (number | null)[];
  /** The engine's choice in each position, in TÜDAF notation as in the move list. */
  readonly bestMoves: readonly (string | null)[];
  readonly moves: readonly ReviewedMove[];
  readonly white: SideSummary;
  readonly black: SideSummary;
}

type Listener = () => void;

/** An earlier position shown while browsing the moves of the game. */
interface View {
  readonly ply: number;
  readonly pieces: UiPiece[];
  readonly captured: UiPiece[];
  readonly lastMove: Move | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/**
 * A game against the computer, or between two players on one device: the rules engine,
 * the AI worker, and UI state such as the selection and animations. Framework-free; React reads it via `useSyncExternalStore`.
 */
export class GameSession {
  readonly #ai: AiClient;
  readonly #analysis: AnalysisClient;
  readonly #storage: Storage;
  readonly #listeners = new Set<Listener>();

  #game: Game;
  #settings: Settings | null;
  #pieces: UiPiece[];
  #captured: UiPiece[] = [];
  #lastMove: Move | null;
  /** The position shown while browsing earlier moves; `null` shows the live game. */
  #view: View | null = null;
  #missedMoves = 0;
  #selection: Selection | null = null;
  #confirmMoves = false;
  #ambiguous = false;
  #premove: Premove | null = null;
  #premoveFrom: Square | null = null;
  #premoveTimer: ReturnType<typeof setTimeout> | undefined;
  #event: GameEvent | null = null;
  #eventId = 0;
  #thinking = false;
  #hint: Move | null = null;
  #drawOffers: number;
  #notice: Notice | null = null;
  #noticeTimer: ReturnType<typeof setTimeout> | undefined;
  #evaluation: Evaluation | null = null;
  #showEvaluation: boolean;
  #flipped: boolean;
  #resultId = 0;
  /** When the game began (wall-clock time), for its duration in the archive. */
  #startedAt: number | null;
  /** Where finished games are kept; set by the app. */
  #archive: { add(game: ArchivedGame): Promise<void> } | null = null;
  readonly #now: () => number;
  /** When the board will have finished animating the move it shows (see `boardSettles`). */
  #settledAt = 0;
  readonly #reviewer: ReviewClient;
  #review: {
    positions: (ReviewPosition | undefined)[];
    /** The engine's choice in TÜDAF notation, filled in as positions arrive. */
    bestMoves: (string | null)[];
    done: boolean;
  } | null = null;
  #practice: {
    items: ReviewedMove[];
    index: number;
    status: PracticeStatus;
    /** The position before the mistake, where the player looks for a better move. */
    game: Game | null;
    tried: string | null;
    timer: ReturnType<typeof setTimeout> | undefined;
    token: number;
  } | null = null;
  /** Rebuilt only when the review changes, not on every snapshot. */
  #reviewSnapshot: GameReview | null = null;
  #clock: Clock | null = null;
  #flagTimer: ReturnType<typeof setTimeout> | undefined;
  #lowTimeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Bumped whenever the position changes under a pending AI request. */
  #token = 0;
  #snapshot: Snapshot;

  constructor(
    ai: AiClient,
    storage: Storage = globalThis.localStorage,
    analysis: AnalysisClient = new AnalysisClient(),
    now: () => number = () => performance.now(),
    reviewer: ReviewClient = new ReviewClient(),
  ) {
    this.#now = now;
    this.#reviewer = reviewer;
    this.#ai = ai;
    this.#analysis = analysis;
    this.#storage = storage;
    const saved = load(storage);
    this.#game = new Game();
    try {
      for (const move of saved.moves) this.#game.play(move);
    } catch {
      this.#game = new Game();
    }
    // Endings that the moves alone do not reproduce.
    if (saved.ending) restoreEnding(this.#game, saved.ending);
    this.#settings = saved.settings;
    this.#startedAt = saved.startedAt;
    const control = saved.settings?.clock;
    if (control) this.#clock = new Clock(control, now, saved.clock ?? undefined);
    this.#drawOffers = saved.drawOffers;
    this.#flipped = saved.flipped;
    this.#showEvaluation = saved.showEvaluation;
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
    // A saved timed game resumes with the side to move's time running.
    if (this.#clock && !this.#game.isOver && this.#game.history.length > 0) {
      this.#clock.run(this.#game.turn);
    }
    this.#refreshEvaluation();
    this.#emit();
    this.#maybeAiMove();
  };

  /** Stops background work; the session can be started again. */
  readonly stop = (): void => {
    this.#token++;
    this.#ai.dispose();
    this.#analysis.dispose();
    this.#reviewer.dispose();
    clearTimeout(this.#premoveTimer);
    clearTimeout(this.#noticeTimer);
    clearTimeout(this.#flagTimer);
    clearTimeout(this.#lowTimeTimer);
    this.#thinking = false;
  };

  /**
   * The board says how long the animation of the move it just showed lasts. The computer's
   * reply and a queued premove wait until then, so a move never plays over another.
   */
  readonly boardSettles = (ms: number): void => {
    this.#settledAt = this.#now() + ms;
  };

  /** Where finished games are kept from now on. */
  readonly setArchive = (archive: { add(game: ArchivedGame): Promise<void> } | null): void => {
    this.#archive = archive;
  };

  /**
   * Shows an archived game as the current, finished game (for its review). It replaces the
   * game on the board, so the app asks first if one is in progress.
   */
  readonly openArchived = (archived: ArchivedGame): void => {
    let game: Game;
    try {
      game = new Game();
      for (const move of archived.moves) game.play(move);
      restoreEnding(game, archived.result);
    } catch {
      return;
    }
    if (!game.isOver) return;
    this.#cancelAi();
    this.#stopReview();
    this.#game = game;
    this.#settings = {
      human: archived.human,
      level: archived.level,
      clock: archived.clock,
      ...(archived.opponent === 'human' ? { opponent: 'human' as const } : {}),
    };
    // The game is over: no clock runs, and it is not archived a second time.
    this.#clock = null;
    this.#startedAt = null;
    this.#drawOffers = 0;
    this.#evaluation = null;
    this.#flipped = archived.human === -1;
    this.#setNotice(null);
    this.#resultId++;
    this.#reset();
  };

  /** Pauses the clocks while the page is hidden, as players expect against the computer. */
  readonly setHidden = (hidden: boolean): void => {
    if (!this.#clock || this.#clock.paused === hidden) return;
    this.#clock.setPaused(hidden);
    this.#save();
    this.#emit();
  };

  // --- Actions ----------------------------------------------------------------

  readonly clickSquare = (square: Square): void => {
    if (this.#practice) {
      this.#practiceClick(square);
      return;
    }
    if (this.#canPremove()) {
      this.#premoveClick(square);
      return;
    }
    if (!this.#canPlay()) return;
    const awaiting = this.#awaitingConfirmation();
    if (awaiting) {
      if (square === awaiting.to) {
        this.#commit(awaiting);
        return;
      }
      // Any other click takes the move back and counts as a fresh click.
      this.#selection = null;
    }
    const result = click(this.#game.legalMoves, this.#selection, square);
    this.#ambiguous = result.type === 'select' && result.ambiguous === true;
    if (result.type === 'play' && this.#confirmMoves) {
      // Show the whole move and wait for its piece to be clicked again.
      this.#selection = { from: result.move.from, path: result.move.path };
      this.#emit();
    } else if (result.type === 'play') this.#commit(result.move);
    else {
      this.#selection = result.selection;
      this.#emit();
    }
  };

  /** With confirmation on, a move chosen on the board waits for a second click. */
  readonly setConfirmMoves = (on: boolean): void => {
    this.#confirmMoves = on;
    if (!on && this.#awaitingConfirmation()) {
      this.#selection = null;
      this.#emit();
    }
  };

  readonly newGame = (settings: Settings): void => {
    this.#cancelAi();
    this.#stopReview();
    this.#game = new Game();
    this.#clock = settings.clock ? new Clock(settings.clock, this.#now) : null;
    this.#startedAt = Date.now();
    this.#drawOffers = 0;
    this.#evaluation = null;
    // Two players see no evaluation by default; it comes back for the next computer game.
    const wasHotseat = this.#settings?.opponent === 'human';
    this.#settings = settings;
    if (this.#hotseat()) this.#showEvaluation = false;
    else if (wasHotseat) this.#showEvaluation = true;
    this.#flipped = this.#hotseat() ? false : settings.human === -1;
    this.#setNotice(null);
    this.#event = { id: ++this.#eventId, kind: 'start' };
    void this.#ai.newGame().catch(() => undefined);
    this.#reset();
  };

  /**
   * Plays a move typed in landing notation (`c3-c4`, `d4xd6xb6`), or just its start and end
   * squares when that is unambiguous (`d4xb8`).
   */
  readonly playNotation = (text: string): NotationResult => {
    if (!this.#canPlay()) return 'not-your-turn';
    let move: Move;
    try {
      move = findMove(this.#game.legalMoves, text);
    } catch (error) {
      return error instanceof AmbiguousMoveError ? 'ambiguous' : 'illegal';
    }
    this.#commit(move);
    return 'played';
  };

  /**
   * Takes back the last move pair, or with two players the last move. A finished game is
   * final and cannot be taken back.
   */
  readonly undo = (): void => {
    if (this.#game.isOver) return;
    this.#cancelAi();
    const human = this.#settings?.human ?? 1;
    if (this.#hotseat()) {
      if (this.#game.history.length > 0) this.#game.undo();
    } else {
      // Take back the AI's reply and the human's move, back to the human's turn.
      while (this.#game.history.length > 0) {
        this.#game.undo();
        if (this.#game.turn === human) break;
      }
    }
    this.#rotate();
    this.#clock?.run(this.#game.history.length > 0 ? this.#game.turn : null);
    this.#reset();
  };

  readonly requestHint = (): void => {
    if (!this.#canPlay()) return;
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
    if (!settings || !this.#humanToMove()) return;
    // Two players at one device agree there and then (the panel asks to confirm).
    if (this.#hotseat()) {
      this.#cancelAi();
      this.#game.agreeDraw();
      this.#endNow();
      return;
    }
    if (this.#drawOffers >= MAX_DRAW_OFFERS) return;
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
          this.#clock?.stop();
          this.#finished();
          if (this.#game.result)
            this.#event = { id: ++this.#eventId, kind: 'end', result: this.#game.result };
          this.#refreshEvaluation();
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
    // With two players, the side to move resigns.
    this.#game.resign(this.#hotseat() ? this.#game.turn : this.#settings.human);
    this.#endNow();
  };

  /** Records an ending that is not a move: a resignation or an agreed draw. */
  readonly #endNow = (): void => {
    this.#clock?.stop();
    this.#selection = null;
    this.#finished();
    if (this.#game.result)
      this.#event = { id: ++this.#eventId, kind: 'end', result: this.#game.result };
    this.#refreshEvaluation();
    this.#save();
    this.#emit();
  };

  /**
   * Reviews the finished game: the engine evaluates every position, then each move is
   * judged and each side gets an accuracy. Results arrive position by position.
   */
  readonly startReview = (): void => {
    if (!this.#game.isOver || this.#review) return;
    const moves = this.#moves();
    this.#review = {
      positions: new Array<ReviewPosition | undefined>(moves.length + 1),
      bestMoves: new Array<string | null>(moves.length + 1).fill(null),
      done: false,
    };
    this.#updateReview();
    this.#emit();
    this.#reviewer.review(
      INITIAL_FEN,
      moves,
      (position) => {
        if (!this.#review) return;
        this.#review.positions[position.index] = position;
        this.#review.bestMoves[position.index] = this.#tudaf(moves, position);
        this.#updateReview();
        this.#emit();
      },
      () => {
        if (!this.#review) return;
        this.#review.done = true;
        this.#updateReview();
        this.#emit();
      },
    );
  };

  /**
   * Starts "Learn from your mistakes" on a reviewed game: the player's mistakes and blunders
   * (both sides' with two players), one at a time.
   */
  readonly startPractice = (): void => {
    const review = this.#reviewSnapshot;
    if (!review?.done || this.#practice) return;
    const human = this.#settings?.human ?? 1;
    const hotseat = this.#hotseat();
    const items = review.moves.filter(
      (move) =>
        (move.judgement === 'mistake' || move.judgement === 'blunder') &&
        (hotseat || move.side === human),
    );
    this.#practice = {
      items,
      index: 0,
      status: 'done',
      game: null,
      tried: null,
      timer: undefined,
      token: 0,
    };
    this.#analysis.stop();
    this.#evaluation = null;
    this.#practiceGo(0);
  };

  /** Goes on to the next mistake. */
  readonly nextPractice = (): void => {
    if (this.#practice) this.#practiceGo(this.#practice.index + 1);
  };

  /** Shows the engine's move on the position before the mistake. */
  readonly showSolution = (): void => {
    const practice = this.#practice;
    const item = practice?.items[practice.index];
    if (!practice || !item || practice.status === 'done') return;
    clearTimeout(practice.timer);
    practice.token++;
    practice.status = 'shown';
    this.#view = this.#positionAt(item.ply);
    this.#selection = null;
    this.#emit();
  };

  /** Leaves the practice; the board stays on the position before the mistake. */
  readonly stopPractice = (): void => {
    const practice = this.#practice;
    if (!practice) return;
    const item = practice.items[practice.index];
    this.#endPractice();
    if (item) this.#view = this.#positionAt(item.ply);
    this.#refreshEvaluation();
    this.#emit();
  };

  /** The moves of the game in landing notation, for the analysis board. */
  readonly landingMoves = (): string[] => this.#moves();

  /** Clears a queued premove and a premove being picked. */
  readonly cancelPremove = (): void => {
    if (this.#premove === null && this.#premoveFrom === null) return;
    this.#premove = null;
    this.#premoveFrom = null;
    this.#emit();
  };

  // --- Browsing earlier moves ----------------------------------------------------

  /**
   * Shows the position after `ply` moves; the number of moves in the game shows the live
   * position again. Stepping forward by one move animates it; other jumps do not.
   */
  readonly showPly = (ply: number): void => {
    const length = this.#game.history.length;
    const target = Math.max(0, Math.min(length, Math.trunc(ply)));
    // Browsing ends the practice; its position may not be one of the game's.
    const practising = this.#endPractice();
    const current = this.#view?.ply ?? length;
    if (target === current && !practising) return;
    const move = this.#game.history[current];
    if (target === length) {
      this.#view = null;
      this.#missedMoves = 0;
    } else if (this.#view && target === current + 1 && move && !practising) {
      const next = applyMove(this.#view.pieces, move);
      this.#view = { ply: target, pieces: next.pieces, captured: next.captured, lastMove: move };
    } else {
      this.#view = this.#positionAt(target);
    }
    this.#selection = null;
    this.#hint = null;
    // A premove belongs to the live position; browsing drops it.
    this.#premove = null;
    this.#premoveFrom = null;
    this.#refreshEvaluation();
    this.#emit();
  };

  readonly showPrevious = (): void => {
    this.showPly(this.#displayedPly() - 1);
  };

  readonly showNext = (): void => {
    this.showPly(this.#displayedPly() + 1);
  };

  readonly showFirst = (): void => {
    this.showPly(0);
  };

  readonly showLive = (): void => {
    this.showPly(this.#game.history.length);
  };

  /** Shows or hides the evaluation bar; hidden, the analysis does not run at all. */
  readonly toggleEvaluation = (): void => {
    this.#showEvaluation = !this.#showEvaluation;
    this.#refreshEvaluation();
    this.#save();
    this.#emit();
  };

  readonly flip = (): void => {
    this.#flipped = !this.#flipped;
    this.#save();
    this.#emit();
  };

  // --- Internals ----------------------------------------------------------------

  /** Two players share the device; there is no AI side. */
  #hotseat(): boolean {
    return this.#settings?.opponent === 'human';
  }

  /** With two players and rotation on, the side to move sits at the bottom. */
  #rotate(): void {
    if (this.#hotseat() && this.#settings?.rotate) this.#flipped = this.#game.turn === -1;
  }

  #humanToMove(): boolean {
    return (
      this.#settings !== null &&
      !this.#thinking &&
      !this.#game.isOver &&
      (this.#hotseat() || this.#game.turn === this.#settings.human)
    );
  }

  /** The human may move: it is their turn in the live game and the live position is shown. */
  #canPlay(): boolean {
    return this.#humanToMove() && this.#view === null;
  }

  /** While the computer thinks, clicks pick a premove instead of a move. */
  #canPremove(): boolean {
    const settings = this.#settings;
    return (
      settings !== null &&
      !this.#hotseat() &&
      this.#thinking &&
      this.#view === null &&
      !this.#game.isOver &&
      this.#game.turn !== settings.human
    );
  }

  /** Legal moves for the human in the current position, as candidates for a premove. */
  #premoveMoves(): Move[] {
    return premoveMoves(this.#game.board, this.#settings?.human ?? 1);
  }

  #premoveClick(square: Square): void {
    const moves = this.#premoveMoves();
    const from = this.#premoveFrom;
    const movable = moves.some((move) => move.from === square);
    if (from !== null && moves.some((move) => move.from === from && move.to === square)) {
      this.#premove = { from, to: square };
      this.#premoveFrom = null;
    } else if (movable && square !== from) {
      this.#premoveFrom = square;
      this.#premove = null;
    } else {
      // Clicking the picked piece again, or anywhere else, cancels.
      this.#premoveFrom = null;
      this.#premove = null;
    }
    this.#emit();
  }

  /** Plays the queued premove if it is legal now; otherwise it is dropped silently. */
  #tryPremove(): void {
    const premove = this.#premove;
    this.#premoveFrom = null;
    if (!premove) return;
    this.#premove = null;
    if (!this.#canPlay()) return;
    const matching = this.#game.legalMoves.filter(
      (move) => move.from === premove.from && move.to === premove.to,
    );
    const [move] = matching;
    if (matching.length !== 1 || !move) return;
    const ply = this.#game.history.length;
    const human = this.#game.turn;
    // A premove costs no time (as on lichess): the player's clock stops at once, though the
    // move waits for the computer's move to be seen.
    this.#clock?.hold(human);
    clearTimeout(this.#premoveTimer);
    const play = () => {
      const wait = this.#settledAt - this.#now();
      if (wait > 0) {
        this.#premoveTimer = setTimeout(play, wait);
        return;
      }
      if (this.#canPlay() && this.#game.history.length === ply) {
        this.#commit(move);
        return;
      }
      // Dropped after all: the player's time runs again.
      if (this.#clock?.held === human && !this.#game.isOver) {
        this.#clock.run(human);
        this.#emit();
      }
    };
    this.#premoveTimer = setTimeout(play, PREMOVE_DELAY_MS);
  }

  #displayedPly(): number {
    return this.#view?.ply ?? this.#game.history.length;
  }

  #positionAt(ply: number): View {
    const game = new Game();
    const history = this.#game.history;
    for (let i = 0; i < ply; i++) {
      const move = history[i];
      if (move) game.play(move);
    }
    return {
      ply,
      pieces: piecesFromBoard(game.board),
      captured: [],
      lastMove: history[ply - 1] ?? null,
    };
  }

  #moves(): string[] {
    return this.#game.history.map(moveToNotation);
  }

  /** The move the selection completes, when it waits for confirmation. */
  #awaitingConfirmation(): Move | null {
    const selection = this.#selection;
    if (!selection || selection.path.length === 0) return null;
    return (
      candidates(this.#game.legalMoves, selection).find(
        (move) => move.path.length === selection.path.length,
      ) ?? null
    );
  }

  #commit(move: Move): void {
    // A move made after the flag fell does not count.
    if (this.#clock?.flagged()) {
      this.#timeOut();
      return;
    }
    const mover = this.#game.turn;
    const played = this.#game.play(move);
    if (this.#game.isOver) this.#clock?.stop();
    else this.#clock?.moved(mover);
    const landed = this.#game.board.get(played.to);
    const damaAlti =
      !isKing(landed) && rankOf(played.to) === (mover === 1 ? 6 : 1) && !played.promotes;
    const next = applyMove(this.#pieces, played);
    this.#pieces = next.pieces;
    this.#captured = next.captured;
    this.#lastMove = played;
    this.#selection = null;
    this.#hint = null;
    if (!this.#view) this.#rotate();
    if (played.promotes && !this.#view) this.#setNotice('dama');
    else if (damaAlti && !this.#view) this.#setNotice('damaAlti');
    const nextMoves = this.#game.isOver ? [] : this.#game.legalMoves;
    this.#event = {
      id: ++this.#eventId,
      kind: 'move',
      by: this.#hotseat() || mover === this.#settings?.human ? 'human' : 'computer',
      side: mover,
      notation: this.#game.moveList.at(-1) ?? '',
      captures: played.captures.length,
      promotes: played.promotes,
      damaAlti,
      mustCapture:
        (this.#hotseat() || this.#game.turn === this.#settings?.human) &&
        (nextMoves[0]?.captures.length ?? 0) > 0,
      result: this.#game.result,
    };
    if (this.#game.isOver) this.#finished();
    // While browsing, the shown position (and its analysis) stays; the move is counted.
    if (this.#view) this.#missedMoves++;
    else this.#refreshEvaluation();
    this.#save();
    // The computer's move: play a queued premove if it is still legal.
    if (played === this.#game.history.at(-1) && this.#canPlay()) this.#tryPremove();
    this.#emit();
    this.#maybeAiMove();
  }

  /** Rebuilds the board without animation (new game, undo). */
  #reset(): void {
    clearTimeout(this.#premoveTimer);
    this.#premove = null;
    this.#premoveFrom = null;
    this.#view = null;
    this.#missedMoves = 0;
    this.#pieces = piecesFromBoard(this.#game.board);
    this.#captured = [];
    this.#lastMove = this.#game.history.at(-1) ?? null;
    this.#selection = null;
    this.#hint = null;
    this.#refreshEvaluation();
    this.#save();
    this.#emit();
    this.#maybeAiMove();
  }

  /**
   * Restarts the live analysis for the current position. A finished game shows its result;
   * with the bar hidden (or no game yet) nothing is analysed.
   */
  #refreshEvaluation(): void {
    // Practice runs its own analysis of the player's tries.
    if (this.#practice) return;
    // Hidden means hidden, also once the game is over.
    if (!this.#showEvaluation || !this.#settings) {
      this.#analysis.stop();
      this.#evaluation = null;
      return;
    }
    // An earlier position of a finished game is analysed like any other.
    const result = this.#view ? null : this.#game.result;
    if (result) {
      this.#analysis.stop();
      const score = result.winner === null ? 0 : result.winner * MATE;
      this.#evaluation = { score, depth: 0, pv: [], final: true };
      return;
    }
    // The previous evaluation stays until the first update, so the bar moves smoothly.
    if (this.#evaluation?.final) this.#evaluation = null;
    const shown = this.#moves().slice(0, this.#displayedPly());
    this.#analysis.analyse(INITIAL_FEN, shown, (update) => {
      this.#evaluation = { score: update.score, depth: update.depth, pv: update.pv, final: false };
      this.#emit();
    });
  }

  #maybeAiMove(): void {
    const settings = this.#settings;
    if (
      !settings ||
      this.#hotseat() ||
      this.#thinking ||
      this.#game.isOver ||
      this.#game.turn === settings.human
    ) {
      return;
    }
    const token = ++this.#token;
    this.#setThinking(true);
    // With a clock the AI spends its own time; it never thinks longer than its level.
    const clock = this.#clock;
    const timeMs = clock
      ? aiBudget(
          clock.remaining(this.#game.turn),
          clock.control,
          LEVEL_OPTIONS[settings.level].timeMs ?? Infinity,
        )
      : undefined;
    const ai = this.#game.turn;
    const decided = this.#ai
      .chooseMove(INITIAL_FEN, this.#moves(), settings.level, timeMs)
      .then((response) => {
        // The computer's time stops as soon as it has decided, even if its move waits for
        // the board to finish showing the player's move.
        if (token === this.#token && response.move) {
          if (this.#clock?.flagged()) this.#timeOut();
          else this.#clock?.hold(ai);
          this.#emit();
        }
        return response;
      });
    Promise.all([decided, sleep(MIN_AI_DELAY_MS)])
      .then(async ([response]) => {
        if (token !== this.#token) return;
        const wait = this.#settledAt - this.#now();
        if (wait > 0) await sleep(wait);
        if (token !== this.#token || this.#game.isOver) return;
        this.#thinking = false;
        if (!response.move) {
          this.#emit();
          return;
        }
        this.#commit(findMove(this.#game.legalMoves, response.move));
      })
      .catch((error: unknown) => {
        this.#failed(token, error);
      });
  }

  /** The game has just ended: a new result to show, and a game for the archive. */
  #finished(): void {
    this.#resultId++;
    const result = this.#game.result;
    const settings = this.#settings;
    if (!result || !settings || !this.#archive) return;
    const endedAt = Date.now();
    void this.#archive.add({
      id: newGameId(),
      endedAt,
      durationMs: this.#startedAt === null ? null : Math.max(0, endedAt - this.#startedAt),
      moves: this.#moves(),
      result,
      opponent: settings.opponent === 'human' ? 'human' : 'computer',
      human: settings.human,
      level: settings.level,
      clock: settings.clock ?? null,
    });
  }

  /** The side to move has run out of time: it loses, whatever the position (TÜDAF 1g). */
  #timeOut(): void {
    const loser = this.#clock?.flagged();
    if (!this.#clock || !loser || this.#game.isOver) return;
    this.#cancelAi();
    this.#selection = null;
    this.#premove = null;
    this.#premoveFrom = null;
    this.#game.timeout(loser);
    this.#clock.stop();
    this.#finished();
    if (this.#game.result) {
      this.#event = { id: ++this.#eventId, kind: 'end', result: this.#game.result };
    }
    this.#refreshEvaluation();
    this.#save();
    this.#emit();
  }

  /** Wakes up when the running side's flag falls, and when it gets low on time. */
  #scheduleClock(): void {
    clearTimeout(this.#flagTimer);
    clearTimeout(this.#lowTimeTimer);
    const clock = this.#clock;
    const side = clock?.running;
    if (!clock || !side || clock.paused || this.#game.isOver) return;
    const left = clock.remaining(side);
    this.#flagTimer = setTimeout(() => {
      this.#timeOut();
    }, left + 1);
    if (left > LOW_TIME_MS) {
      this.#lowTimeTimer = setTimeout(() => {
        this.#event = { id: ++this.#eventId, kind: 'lowTime', side };
        this.#emit();
      }, left - LOW_TIME_MS);
    }
  }

  /** The engine's choice for a reviewed position, written as the move list writes moves. */
  #tudaf(moves: readonly string[], position: ReviewPosition): string | null {
    if (!position.best) return null;
    try {
      const game = new Game();
      for (const move of moves.slice(0, position.index)) game.play(move);
      const legal = game.legalMoves;
      return moveToTudafNotation(findMove(legal, position.best), legal);
    } catch {
      return position.best;
    }
  }

  /** Ends the practice, if any; says whether there was one. */
  #endPractice(): boolean {
    const practice = this.#practice;
    if (!practice) return false;
    clearTimeout(practice.timer);
    this.#practice = null;
    this.#selection = null;
    return true;
  }

  #practiceGo(index: number): void {
    const practice = this.#practice;
    if (!practice) return;
    clearTimeout(practice.timer);
    practice.token++;
    practice.index = index;
    practice.tried = null;
    const item = practice.items[index];
    if (!item) {
      practice.status = 'done';
      practice.game = null;
      this.#emit();
      return;
    }
    const game = new Game();
    for (const move of this.#game.history.slice(0, item.ply)) game.play(move);
    practice.game = game;
    practice.status = 'try';
    this.#view = this.#positionAt(item.ply);
    this.#selection = null;
    this.#emit();
  }

  #practiceClick(square: Square): void {
    const practice = this.#practice;
    const game = practice?.game;
    if (!practice || !game || practice.status !== 'try') return;
    const result = click(game.legalMoves, this.#selection, square);
    if (result.type === 'play') this.#practiceMove(result.move);
    else {
      this.#selection = result.selection;
      this.#emit();
    }
  }

  /** Shows the player's try on the board, then judges it against the engine's choice. */
  #practiceMove(move: Move): void {
    const practice = this.#practice;
    const game = practice?.game;
    const item = practice?.items[practice.index];
    const before = item ? this.#review?.positions[item.ply] : undefined;
    if (!practice || !game || !item || !before || !this.#view) return;
    practice.tried = moveToTudafNotation(move, game.legalMoves);
    const next = applyMove(this.#view.pieces, move);
    this.#view = {
      ply: item.ply + 1,
      pieces: next.pieces,
      captured: next.captured,
      lastMove: move,
    };
    this.#selection = null;
    const landing = moveToNotation(move);
    if (landing === item.best) {
      practice.status = 'right';
      this.#emit();
      return;
    }
    practice.status = 'checking';
    this.#emit();

    const token = ++practice.token;
    const judge = (score: number) => {
      if (this.#practice !== practice || practice.token !== token) return;
      const side = item.side;
      const loss = side * winningChances(before.score) - side * winningChances(score);
      if (loss < INACCURACY) {
        practice.status = 'good';
        this.#emit();
        return;
      }
      practice.status = 'wrong';
      this.#emit();
      practice.timer = setTimeout(() => {
        if (this.#practice !== practice || practice.token !== token) return;
        practice.status = 'try';
        this.#view = this.#positionAt(item.ply);
        this.#emit();
      }, PRACTICE_RETRY_MS);
    };

    const after = new Game();
    for (const played of this.#game.history.slice(0, item.ply)) after.play(played);
    after.play(landing);
    if (after.isOver) {
      const winner = after.result?.winner ?? null;
      judge(winner === null ? 0 : winner * MATE);
      return;
    }
    this.#analysis.analyse(
      INITIAL_FEN,
      [...this.#moves().slice(0, item.ply), landing],
      (update) => {
        if (update.done) judge(update.score);
      },
      { timeMs: 900, maxDepth: 14 },
    );
  }

  #stopReview(): void {
    this.#endPractice();
    if (!this.#review) return;
    this.#reviewer.stop();
    this.#review = null;
    this.#reviewSnapshot = null;
  }

  #updateReview(): void {
    const review = this.#review;
    if (!review) {
      this.#reviewSnapshot = null;
      return;
    }
    const { positions } = review;
    const moves = judgeMoves(positions, this.#moves());
    const evaluated = positions.filter((position) => position !== undefined).length;
    this.#reviewSnapshot = {
      done: review.done,
      progress: review.done ? 1 : evaluated / positions.length,
      scores: Array.from(positions, (position) => position?.score ?? null),
      bestMoves: [...review.bestMoves],
      moves,
      white: summarise(moves, 1),
      black: summarise(moves, -1),
    };
  }

  #practiceSnapshot(): Practice | null {
    const practice = this.#practice;
    if (!practice) return null;
    const item = practice.items[practice.index];
    const revealed = REVEALED.includes(practice.status);
    return {
      status: practice.status,
      index: practice.index,
      total: practice.items.length,
      side: item?.side ?? 1,
      played: item ? (this.#game.moveList[item.ply] ?? item.played) : '',
      tried: practice.tried,
      best: item && revealed ? (this.#review?.bestMoves[item.ply] ?? item.best) : null,
    };
  }

  /** The engine's choice in the position shown, once the review has reached it. */
  #bestMove(): BoardLine | null {
    // While practising, the answer stays hidden until it is found or asked for.
    const practice = this.#practice;
    if (practice) {
      const item = practice.items[practice.index];
      if (!item || practice.status !== 'shown') return null;
      return this.#line(this.#review?.positions[item.ply]?.best);
    }
    return this.#line(this.#review?.positions[this.#displayedPly()]?.best);
  }

  #line(notation: string | null | undefined): BoardLine | null {
    if (!notation) return null;
    const [from, ...path] = notation.split(/[x-]/).map(parseSquare);
    return from === undefined ? null : { from, path };
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
    const result = this.#game.result;
    const ending =
      result &&
      (result.reason === 'resignation' ||
        result.reason === 'agreement' ||
        result.reason === 'timeout')
        ? { reason: result.reason, winner: result.winner }
        : null;
    save(
      {
        settings: this.#settings,
        moves: this.#moves(),
        ending,
        drawOffers: this.#drawOffers,
        flipped: this.#flipped,
        showEvaluation: this.#showEvaluation,
        clock: this.#clock
          ? { white: this.#clock.remaining(1), black: this.#clock.remaining(-1) }
          : null,
        startedAt: this.#startedAt,
      },
      this.#storage,
    );
  }

  #emit(): void {
    this.#scheduleClock();
    this.#snapshot = this.#build();
    for (const listener of this.#listeners) listener();
  }

  /** Pieces taken by each side in the moves up to the position shown. White moves first. */
  #taken(): Snapshot['taken'] {
    const white: Piece[] = [];
    const black: Piece[] = [];
    this.#game.history.slice(0, this.#displayedPly()).forEach((move, i) => {
      (i % 2 === 0 ? white : black).push(...move.capturedPieces);
    });
    return { white, black };
  }

  #build(): Snapshot {
    const game = this.#game;
    const human = this.#settings?.human ?? 1;
    const practice = this.#practice;
    // While practising, the player moves in the position before the mistake.
    const humanMoves =
      practice?.status === 'try' && practice.game
        ? practice.game.legalMoves
        : this.#canPlay()
          ? game.legalMoves
          : [];
    const view = this.#view;
    // The human has a move to take back once they have played at least once; with two
    // players, any move can be taken back.
    const humanPlies = this.#hotseat()
      ? game.history.length
      : human === 1
        ? Math.ceil(game.history.length / 2)
        : Math.floor(game.history.length / 2);
    return {
      settings: this.#settings,
      pieces: view?.pieces ?? this.#pieces,
      captured: view?.captured ?? this.#captured,
      lastMove: view ? view.lastMove : this.#lastMove,
      moveNumber: view?.ply ?? game.history.length,
      liveMoveNumber: game.history.length,
      browsing: view !== null && practice === null,
      missedMoves: this.#missedMoves,
      turn: game.turn,
      result: game.result,
      resultId: this.#resultId,
      humanMoves,
      selection: this.#selection,
      confirming: this.#awaitingConfirmation() !== null,
      ambiguous: this.#ambiguous && this.#selection !== null,
      thinking: this.#thinking,
      hint: this.#hint,
      moveList: game.moveList,
      drawOffersLeft: MAX_DRAW_OFFERS - this.#drawOffers,
      notice: this.#notice,
      // The evaluation would give the answer away while practising.
      evaluation: practice ? null : this.#evaluation,
      showEvaluation: this.#showEvaluation,
      flipped: this.#flipped,
      canUndo: this.#settings !== null && !game.isOver && humanPlies > 0,
      premoveEnabled: this.#canPremove(),
      premove: this.#premove,
      premoveFrom: this.#premoveFrom,
      premoveTargets:
        this.#premoveFrom === null
          ? []
          : this.#premoveMoves()
              .filter((move) => move.from === this.#premoveFrom)
              .map((move) => move.to),
      premovable: this.#canPremove()
        ? [...new Set(this.#premoveMoves().map((move) => move.from))]
        : [],
      ghosts:
        this.#selection && humanMoves.length > 0 ? jumpedSoFar(humanMoves, this.#selection) : [],
      taken: this.#taken(),
      event: this.#event,
      clock: this.#clock?.view() ?? null,
      review: this.#reviewSnapshot,
      bestMove: this.#bestMove(),
      practice: this.#practiceSnapshot(),
    };
  }
}

/** Replays an ending the moves alone do not reproduce: a resignation, a draw or a lost clock. */
function restoreEnding(
  game: Game,
  ending: { readonly reason: string; readonly winner: Color | null },
): void {
  if (game.isOver) return;
  if (ending.reason === 'agreement') game.agreeDraw();
  else if (ending.winner !== null) {
    const loser = opponent(ending.winner);
    if (ending.reason === 'resignation') game.resign(loser);
    else if (ending.reason === 'timeout') game.timeout(loser);
  }
}
