import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Move, Piece, Square } from '../../engine';
import { squareName } from '../../engine';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';
import type { UiPiece } from '../pieces';
import type { Selection } from '../selection';
import { destinations, movableSquares, nextSquares } from '../selection';

/** Milliseconds per step of a move's path. */
export const STEP_MS = 170;

interface BoardProps {
  readonly pieces: readonly UiPiece[];
  readonly captured: readonly UiPiece[];
  readonly lastMove: Move | null;
  readonly moveNumber: number;
  readonly legalMoves: readonly Move[];
  readonly selection: Selection | null;
  readonly hint: Move | null;
  readonly flipped: boolean;
  readonly onSquare: (square: Square) => void;
}

/** Board position of a square in display coordinates (0,0 is the top left corner). */
function toDisplay(square: Square, flipped: boolean): { x: number; y: number } {
  const rank = square >> 3;
  const file = square & 7;
  return flipped ? { x: 7 - file, y: rank } : { x: file, y: 7 - rank };
}

function fromDisplay(x: number, y: number, flipped: boolean): Square {
  return flipped ? y * 8 + (7 - x) : (7 - y) * 8 + x;
}

const PIECE_LABEL: Record<Exclude<Piece, 0>, MessageKey> = {
  1: 'whiteMan',
  2: 'whiteKing',
  [-1]: 'blackMan',
  [-2]: 'blackKing',
};

const transform = (square: Square, flipped: boolean) => {
  const { x, y } = toDisplay(square, flipped);
  return `translate(${x * 100}%, ${y * 100}%)`;
};

export function Board(props: BoardProps) {
  const { pieces, captured, lastMove, moveNumber, legalMoves, selection, hint, flipped } = props;
  const { t } = useI18n();
  const pieceElements = useRef(new Map<number, HTMLDivElement>());
  const squareElements = useRef(new Map<Square, HTMLButtonElement>());
  const [focus, setFocus] = useState<Square>(() => fromDisplay(0, 7, flipped));

  const occupant = useMemo(() => {
    const map = new Map<Square, UiPiece>();
    for (const piece of pieces) map.set(piece.square, piece);
    return map;
  }, [pieces]);

  const movable = useMemo(() => movableSquares(legalMoves), [legalMoves]);
  const mustCapture = (legalMoves[0]?.captures.length ?? 0) > 0;
  const next = useMemo(
    () => (selection ? nextSquares(legalMoves, selection) : new Set<Square>()),
    [legalMoves, selection],
  );
  const finals = useMemo(
    () => (selection ? destinations(legalMoves, selection) : new Set<Square>()),
    [legalMoves, selection],
  );

  // Animate a newly played move along its path; the piece is already on its final square.
  // Loading a saved game, taking back or starting over changes the position without a move.
  const previousMoveNumber = useRef(moveNumber);
  useLayoutEffect(() => {
    const previous = previousMoveNumber.current;
    previousMoveNumber.current = moveNumber;
    if (!lastMove || moveNumber !== previous + 1) return;
    const mover = [...occupant.values()].find((piece) => piece.square === lastMove.to);
    const element = mover ? pieceElements.current.get(mover.id) : undefined;
    if (!element || typeof element.animate !== 'function') return;
    const frames = [lastMove.from, ...lastMove.path].map((square) => ({
      transform: transform(square, flipped),
    }));
    element.animate(frames, { duration: STEP_MS * lastMove.path.length, easing: 'ease-in-out' });
    // Only when a new move is played; flipping the board should not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveNumber]);

  const moveFocus = (event: KeyboardEvent, square: Square) => {
    const { x, y } = toDisplay(square, flipped);
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = delta[event.key];
    if (!step) return;
    event.preventDefault();
    const nx = Math.min(7, Math.max(0, x + step[0]));
    const ny = Math.min(7, Math.max(0, y + step[1]));
    const target = fromDisplay(nx, ny, flipped);
    setFocus(target);
    squareElements.current.get(target)?.focus();
  };

  const squares = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const square = fromDisplay(x, y, flipped);
      const piece = occupant.get(square);
      const classes = ['square'];
      if (lastMove && (square === lastMove.from || square === lastMove.to)) classes.push('last');
      if (selection?.from === square) classes.push('selected');
      if (selection?.path.includes(square)) classes.push('passed');
      if (next.has(square)) classes.push('next');
      else if (finals.has(square)) classes.push('final');
      if (!selection && movable.has(square)) classes.push(mustCapture ? 'must' : 'movable');
      if (hint && (square === hint.from || square === hint.to)) classes.push('hint');
      const name = squareName(square);
      const label = piece
        ? t('squareWith', { square: name, piece: t(PIECE_LABEL[piece.piece as Exclude<Piece, 0>]) })
        : t('square', { square: name });
      squares.push(
        <button
          key={square}
          ref={(element) => {
            if (element) squareElements.current.set(square, element);
            else squareElements.current.delete(square);
          }}
          type="button"
          role="gridcell"
          className={classes.join(' ')}
          aria-label={label}
          aria-selected={selection?.from === square}
          tabIndex={square === focus ? 0 : -1}
          onClick={() => {
            setFocus(square);
            props.onSquare(square);
          }}
          onKeyDown={(event) => {
            moveFocus(event, square);
          }}
        ></button>,
      );
    }
  }

  return (
    <div className="board" role="grid" aria-label={t('board')}>
      <div className="squares">{squares}</div>
      <div className="pieces" aria-hidden="true">
        {captured.map((piece, index) => (
          <div
            key={`captured-${piece.id}-${moveNumber}`}
            className={`piece ${pieceClass(piece.piece)} captured`}
            style={{
              transform: transform(piece.square, flipped),
              // Each captured piece fades as the mover jumps over it.
              animationDelay: `${Math.round(STEP_MS * (index + 0.5))}ms`,
              animationDuration: `${STEP_MS}ms`,
            }}
          />
        ))}
        {pieces.map((piece) => (
          <div
            key={piece.id}
            ref={(element) => {
              if (element) pieceElements.current.set(piece.id, element);
              else pieceElements.current.delete(piece.id);
            }}
            className={`piece ${pieceClass(piece.piece)}`}
            style={{ transform: transform(piece.square, flipped) }}
          />
        ))}
      </div>
      <div className="coords" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => {
          const bottom = squareName(fromDisplay(i, 7, flipped));
          const left = squareName(fromDisplay(0, i, flipped));
          return [
            <span key={`f${i}`} className="coord file" style={{ left: `${(i + 1) * 12.5}%` }}>
              {bottom[0]}
            </span>,
            <span key={`r${i}`} className="coord rank" style={{ top: `${i * 12.5}%` }}>
              {left.slice(1)}
            </span>,
          ];
        })}
      </div>
    </div>
  );
}

const pieceClass = (piece: Piece) =>
  `${piece > 0 ? 'white' : 'black'}${piece === 2 || piece === -2 ? ' king' : ''}`;
