import type { Color, GameResult, Move, Square } from '../engine';
import { Game, findMove, moveToNotation, moveToTudafNotation, parseSquare } from '../engine';
import type { AnalysisClient } from '../ai';
import { MATE } from '../ai';
import type { UiPiece } from './pieces';
import { applyMove, piecesFromBoard } from './pieces';
import type { Selection } from './selection';
import { click, jumpedSoFar } from './selection';
import type { BoardLine, Evaluation } from './session';

/** The analysis board keeps thinking about a position for this long, as lichess does. */
const ANALYSIS = { maxDepth: 40, timeMs: 30_000 };

export interface AnalysisSnapshot {
  readonly startFen: string;
  /** The moves of the line being analysed, in landing notation, and as the move list writes them. */
  readonly line: readonly string[];
  readonly moveList: readonly string[];
  /** Moves played to reach the position shown. */
  readonly ply: number;
  /** The position shown. */
  readonly fen: string;
  readonly turn: Color;
  readonly result: GameResult | null;
  readonly pieces: readonly UiPiece[];
  readonly captured: readonly UiPiece[];
  readonly lastMove: Move | null;
  readonly legalMoves: readonly Move[];
  readonly selection: Selection | null;
  readonly ghosts: readonly Square[];
  readonly evaluation: Evaluation | null;
  /** The engine's line from the position shown, in TÜDAF notation. */
  readonly pv: readonly string[];
  /** The engine's first move, drawn as an arrow. */
  readonly bestMove: BoardLine | null;
  readonly flipped: boolean;
}

/**
 * The analysis board: both sides are played freely from any position, and the engine
 * analyses whatever position is shown. Playing a move other than the next one of the line
 * replaces the rest of the line. Framework-free, read via `useSyncExternalStore`.
 */
export class AnalysisSession {
  readonly #analysis: AnalysisClient;
  readonly #listeners = new Set<() => void>();
  #startFen: string;
  #line: string[];
  #moveList: string[] = [];
  #ply: number;
  #game: Game;
  #pieces: UiPiece[];
  #captured: UiPiece[] = [];
  #selection: Selection | null = null;
  #evaluation: Evaluation | null = null;
  #flipped: boolean;
  #snapshot: AnalysisSnapshot;

  /** Throws if the position or a move is not valid. */
  constructor(
    analysis: AnalysisClient,
    fen: string,
    moves: readonly string[],
    ply?: number | null,
  ) {
    this.#analysis = analysis;
    // Validate the whole line first, then show the requested position.
    const full = new Game(fen);
    this.#line = moves.map((move) => moveToNotation(full.play(move)));
    this.#startFen = fen;
    this.#moveList = [...full.moveList];
    this.#ply = Math.max(0, Math.min(this.#line.length, ply ?? this.#line.length));
    this.#game = this.#replay(this.#ply);
    this.#pieces = piecesFromBoard(this.#game.board);
    this.#flipped = new Game(fen).turn === -1;
    this.#snapshot = this.#build();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): AnalysisSnapshot => this.#snapshot;

  readonly start = (): void => {
    this.#analyse();
    this.#emit();
  };

  readonly stop = (): void => {
    this.#analysis.dispose();
  };

  readonly clickSquare = (square: Square): void => {
    if (this.#game.isOver) return;
    const result = click(this.#game.legalMoves, this.#selection, square);
    if (result.type === 'select') {
      this.#selection = result.selection;
      this.#emit();
      return;
    }
    const notation = moveToNotation(result.move);
    // A new move replaces the rest of the line; the next move of the line just steps on.
    if (this.#line[this.#ply] !== notation) {
      this.#line = [...this.#line.slice(0, this.#ply), notation];
      this.#moveList = [...this.#replay(this.#line.length).moveList];
    }
    this.#goTo(this.#ply + 1);
  };

  readonly showPly = (ply: number): void => {
    const target = Math.max(0, Math.min(this.#line.length, Math.trunc(ply)));
    if (target !== this.#ply) this.#goTo(target);
  };

  readonly showPrevious = (): void => {
    this.showPly(this.#ply - 1);
  };

  readonly showNext = (): void => {
    this.showPly(this.#ply + 1);
  };

  readonly showFirst = (): void => {
    this.showPly(0);
  };

  readonly showLast = (): void => {
    this.showPly(this.#line.length);
  };

  /** Drops the moves after the position shown. */
  readonly cutLine = (): void => {
    if (this.#ply === this.#line.length) return;
    this.#line = this.#line.slice(0, this.#ply);
    this.#moveList = this.#moveList.slice(0, this.#ply);
    this.#emit();
  };

  readonly flip = (): void => {
    this.#flipped = !this.#flipped;
    this.#emit();
  };

  /** Steps to `ply`; a single step forward is animated, anything else is redrawn. */
  #goTo(ply: number): void {
    const forward = ply === this.#ply + 1;
    const game = this.#replay(ply);
    const move = game.history.at(-1);
    if (forward && move) {
      const next = applyMove(this.#pieces, move);
      this.#pieces = next.pieces;
      this.#captured = next.captured;
    } else {
      this.#pieces = piecesFromBoard(game.board);
      this.#captured = [];
    }
    this.#game = game;
    this.#ply = ply;
    this.#selection = null;
    this.#analyse();
    this.#emit();
  }

  #replay(ply: number): Game {
    const game = new Game(this.#startFen);
    for (const move of this.#line.slice(0, ply)) game.play(move);
    return game;
  }

  #analyse(): void {
    const result = this.#game.result;
    if (result) {
      this.#analysis.stop();
      const score = result.winner === null ? 0 : result.winner * MATE;
      this.#evaluation = { score, depth: 0, pv: [], final: true };
      return;
    }
    // The previous evaluation stays until the first update, so the bar moves smoothly.
    if (this.#evaluation?.final) this.#evaluation = null;
    const ply = this.#ply;
    this.#analysis.analyse(
      this.#startFen,
      this.#line.slice(0, ply),
      (update) => {
        if (this.#ply !== ply) return;
        this.#evaluation = {
          score: update.score,
          depth: update.depth,
          pv: update.pv,
          final: false,
        };
        this.#emit();
      },
      ANALYSIS,
    );
  }

  /** The engine's line written as the move list writes moves. */
  #pvShown(): string[] {
    const pv = this.#evaluation?.pv ?? [];
    const game = this.#replay(this.#ply);
    const shown: string[] = [];
    for (const notation of pv) {
      try {
        const legal = game.legalMoves;
        const move = findMove(legal, notation);
        shown.push(moveToTudafNotation(move, legal));
        game.play(move);
      } catch {
        break;
      }
    }
    return shown;
  }

  #emit(): void {
    this.#snapshot = this.#build();
    for (const listener of this.#listeners) listener();
  }

  #build(): AnalysisSnapshot {
    const game = this.#game;
    const legalMoves = game.isOver ? [] : game.legalMoves;
    const best = this.#evaluation?.final ? undefined : this.#evaluation?.pv[0];
    const [from, ...path] = best ? best.split(/[x-]/).map(parseSquare) : [];
    return {
      startFen: this.#startFen,
      line: this.#line,
      moveList: this.#moveList,
      ply: this.#ply,
      fen: game.fen(),
      turn: game.turn,
      result: game.result,
      pieces: this.#pieces,
      captured: this.#captured,
      lastMove: game.history.at(-1) ?? null,
      legalMoves,
      selection: this.#selection,
      ghosts: this.#selection ? jumpedSoFar(legalMoves, this.#selection) : [],
      evaluation: this.#evaluation,
      pv: this.#pvShown(),
      bestMove: from === undefined || this.#selection ? null : { from, path },
      flipped: this.#flipped,
    };
  }
}
