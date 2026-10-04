import type { Color, GameResult, Move, Square } from '../engine';
import {
  Game,
  INITIAL_FEN,
  MAX_DRAW_OFFERS,
  colorOf,
  findMove,
  moveToNotation,
  opponent,
} from '../engine';
import type { AiClient, Level } from '../ai';
import { AnalysisClient, MATE } from '../ai';
import type { UiPiece } from './pieces';
import { applyMove, piecesFromBoard } from './pieces';
import type { Selection } from './selection';
import { click, jumpedSoFar, premoveTargets } from './selection';
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

export type Notice = 'drawAccepted' | 'drawDeclined' | 'dama';

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
  /** Pieces captured by the last move, kept for the fade-out animation. */
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
  /** Pieces jumped by the part of a capture chain chosen so far (shown as ghosts). */
  readonly ghosts: readonly Square[];
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
 * A game against the computer: the rules engine, the AI worker, and UI state such as
 * the selection and animations. Framework-free; React reads it via `useSyncExternalStore`.
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
  #premove: Premove | null = null;
  #premoveFrom: Square | null = null;
  #premoveTimer: ReturnType<typeof setTimeout> | undefined;
  #thinking = false;
  #hint: Move | null = null;
  #drawOffers: number;
  #notice: Notice | null = null;
  #noticeTimer: ReturnType<typeof setTimeout> | undefined;
  #evaluation: Evaluation | null = null;
  #showEvaluation: boolean;
  #flipped: boolean;
  #resultId = 0;
  /** Bumped whenever the position changes under a pending AI request. */
  #token = 0;
  #snapshot: Snapshot;

  constructor(
    ai: AiClient,
    storage: Storage = globalThis.localStorage,
    analysis: AnalysisClient = new AnalysisClient(),
  ) {
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
    const ending = saved.ending;
    if (ending && !this.#game.isOver) {
      if (ending.reason === 'agreement') this.#game.agreeDraw();
      else if (ending.winner !== null) {
        const loser = opponent(ending.winner);
        if (ending.reason === 'resignation') this.#game.resign(loser);
        else this.#game.timeout(loser);
      }
    }
    this.#settings = saved.settings;
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
    this.#refreshEvaluation();
    this.#emit();
    this.#maybeAiMove();
  };

  /** Stops background work; the session can be started again. */
  readonly stop = (): void => {
    this.#token++;
    this.#ai.dispose();
    this.#analysis.dispose();
    clearTimeout(this.#premoveTimer);
    clearTimeout(this.#noticeTimer);
    this.#thinking = false;
  };

  // --- Actions ----------------------------------------------------------------

  readonly clickSquare = (square: Square): void => {
    if (this.#canPremove()) {
      this.#premoveClick(square);
      return;
    }
    if (!this.#canPlay()) return;
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
    this.#evaluation = null;
    this.#flipped = settings.human === -1;
    this.#setNotice(null);
    void this.#ai.newGame().catch(() => undefined);
    this.#reset();
  };

  /** Takes back the last move pair. A finished game is final and cannot be taken back. */
  readonly undo = (): void => {
    if (this.#game.isOver) return;
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
    this.#game.resign(this.#settings.human);
    this.#resultId++;
    this.#refreshEvaluation();
    this.#save();
    this.#emit();
  };

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
    const current = this.#view?.ply ?? length;
    if (target === current) return;
    const move = this.#game.history[current];
    if (target === length) {
      this.#view = null;
      this.#missedMoves = 0;
    } else if (this.#view && target === current + 1 && move) {
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

  #humanToMove(): boolean {
    return (
      this.#settings !== null &&
      !this.#thinking &&
      !this.#game.isOver &&
      this.#game.turn === this.#settings.human
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
      this.#thinking &&
      this.#view === null &&
      !this.#game.isOver &&
      this.#game.turn !== settings.human
    );
  }

  #premoveClick(square: Square): void {
    const human = this.#settings?.human ?? 1;
    const board = this.#game.board;
    const own = colorOf(board.get(square)) === human;
    const from = this.#premoveFrom;
    if (from !== null && square !== from && premoveTargets(board.get(from), from).has(square)) {
      this.#premove = { from, to: square };
      this.#premoveFrom = null;
    } else if (own && square !== from) {
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
    clearTimeout(this.#premoveTimer);
    this.#premoveTimer = setTimeout(() => {
      if (this.#canPlay() && this.#game.history.length === ply) this.#commit(move);
    }, PREMOVE_DELAY_MS);
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

  #commit(move: Move): void {
    const played = this.#game.play(move);
    const next = applyMove(this.#pieces, played);
    this.#pieces = next.pieces;
    this.#captured = next.captured;
    this.#lastMove = played;
    this.#selection = null;
    this.#hint = null;
    if (played.promotes && !this.#view) this.#setNotice('dama');
    if (this.#game.isOver) this.#resultId++;
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
    const humanMoves = this.#canPlay() ? game.legalMoves : [];
    const view = this.#view;
    // The human has a move to take back once they have played at least once.
    const humanPlies =
      human === 1 ? Math.ceil(game.history.length / 2) : Math.floor(game.history.length / 2);
    return {
      settings: this.#settings,
      pieces: view?.pieces ?? this.#pieces,
      captured: view?.captured ?? this.#captured,
      lastMove: view ? view.lastMove : this.#lastMove,
      moveNumber: view?.ply ?? game.history.length,
      liveMoveNumber: game.history.length,
      browsing: view !== null,
      missedMoves: this.#missedMoves,
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
      evaluation: this.#evaluation,
      showEvaluation: this.#showEvaluation,
      flipped: this.#flipped,
      canUndo: this.#settings !== null && !game.isOver && humanPlies > 0,
      premoveEnabled: this.#canPremove(),
      premove: this.#premove,
      premoveFrom: this.#premoveFrom,
      premoveTargets:
        this.#premoveFrom === null
          ? []
          : [...premoveTargets(game.board.get(this.#premoveFrom), this.#premoveFrom)],
      ghosts:
        this.#selection && humanMoves.length > 0 ? jumpedSoFar(humanMoves, this.#selection) : [],
    };
  }
}
