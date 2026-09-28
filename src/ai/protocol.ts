import { Game, moveToNotation } from '../engine';
import type { Level } from './levels';
import { LEVEL_OPTIONS, acceptsDraw } from './levels';
import type { Searcher } from './search';

/** Messages from the UI thread to the AI worker. */
export type AiRequest =
  | {
      readonly id: number;
      readonly type: 'move';
      /** Starting position of the game and the moves played since, in landing notation. */
      readonly fen: string;
      readonly moves: readonly string[];
      readonly level: Level;
    }
  | {
      readonly id: number;
      readonly type: 'draw-offer';
      readonly fen: string;
      readonly moves: readonly string[];
      readonly level: Level;
    }
  | { readonly id: number; readonly type: 'new-game' };

/** Messages from the AI worker back to the UI thread. */
export type AiResponse =
  | {
      readonly id: number;
      readonly type: 'move';
      /** The chosen move in landing notation, or `null` if the game is over. */
      readonly move: string | null;
      readonly score: number;
      readonly depth: number;
      readonly nodes: number;
      readonly timeMs: number;
      readonly pv: readonly string[];
    }
  | { readonly id: number; readonly type: 'draw-offer'; readonly accepted: boolean }
  | { readonly id: number; readonly type: 'new-game' }
  | { readonly id: number; readonly type: 'error'; readonly message: string };

function replay(fen: string, moves: readonly string[]): Game {
  const game = new Game(fen);
  for (const move of moves) game.play(move);
  return game;
}

/** Handles one request. Kept free of worker APIs so it can be unit tested. */
export function handleRequest(searcher: Searcher, request: AiRequest): AiResponse {
  const { id } = request;
  try {
    switch (request.type) {
      case 'new-game':
        searcher.tt.clear();
        return { id, type: 'new-game' };
      case 'move': {
        const game = replay(request.fen, request.moves);
        const result = searcher.search(game, LEVEL_OPTIONS[request.level]);
        return {
          id,
          type: 'move',
          move: result.move ? moveToNotation(result.move) : null,
          score: result.score,
          depth: result.depth,
          nodes: result.nodes,
          timeMs: result.timeMs,
          pv: result.pv.map(moveToNotation),
        };
      }
      case 'draw-offer': {
        const game = replay(request.fen, request.moves);
        // Judge the offer with the strongest settings the level allows, without randomness.
        const result = searcher.search(game, { ...LEVEL_OPTIONS[request.level], randomMargin: 0 });
        return { id, type: 'draw-offer', accepted: acceptsDraw(result.score) };
      }
    }
  } catch (error) {
    return { id, type: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
