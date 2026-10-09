// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Move } from '../../engine';
import { Game } from '../../engine';
import { NORMAL_TIMING } from '../animation';
import { applyMove, piecesFromBoard } from '../pieces';
import { Board } from './Board';

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

const NONE: readonly never[] = [];

describe('Board', () => {
  it('tells how long each new move animates, and finishes the last one first', () => {
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate;
    // White must capture three pieces after these moves.
    const game = new Game();
    for (const move of ['a3-a4', 'b6-b5', 'd3-d4', 'd6-d5']) game.play(move);
    const before = piecesFromBoard(game.board);
    const capture: Move = game.play('d4xd6xb6xb8');
    const after = applyMove(before, capture);
    const onSettle = vi.fn();
    const props = {
      legalMoves: NONE,
      selection: null,
      hint: null,
      flipped: false,
      premove: null,
      premoveFrom: null,
      premoveTargets: NONE,
      premovable: NONE,
      ghosts: NONE,
      timing: NORMAL_TIMING,
      onSquare: () => undefined,
      onCancelPremove: () => undefined,
      onSettle,
    };
    const { rerender } = render(
      <Board {...props} pieces={before} captured={NONE} lastMove={null} moveNumber={4} />,
    );
    expect(onSettle).not.toHaveBeenCalled();
    rerender(
      <Board
        {...props}
        pieces={after.pieces}
        captured={after.captured}
        lastMove={capture}
        moveNumber={5}
      />,
    );
    // Three beats: the last jumped piece is gone when the last beat ends.
    expect(onSettle).toHaveBeenLastCalledWith(NORMAL_TIMING.vanishStart(2) + NORMAL_TIMING.vanish);
    // Jumping elsewhere in the game is not animated.
    rerender(
      <Board {...props} pieces={after.pieces} captured={NONE} lastMove={capture} moveNumber={9} />,
    );
    expect(onSettle).toHaveBeenLastCalledWith(0);
  });
});
