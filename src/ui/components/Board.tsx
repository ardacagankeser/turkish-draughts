import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Move, Piece, Square } from '../../engine';
import { squareName } from '../../engine';
import type { Shape } from '../drawing';
import { toggleShape } from '../drawing';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';
import type { UiPiece } from '../pieces';
import type { Selection } from '../selection';
import { destinations, movableSquares, nextSquares } from '../selection';
import type { Premove } from '../session';

/** Milliseconds per step of a move's path. */
export const STEP_MS = 170;
/** Pointer travel (px) before a press on a piece becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;
const DRAWING_COLOUR = '#15781b';
const HINT_COLOUR = '#1f6feb';
/** Modifier keys alone do not mean the player is navigating with the keyboard. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

interface BoardProps {
  readonly pieces: readonly UiPiece[];
  readonly captured: readonly UiPiece[];
  readonly lastMove: Move | null;
  readonly moveNumber: number;
  readonly legalMoves: readonly Move[];
  readonly selection: Selection | null;
  readonly hint: Move | null;
  readonly flipped: boolean;
  readonly premove: Premove | null;
  readonly premoveFrom: Square | null;
  readonly premoveTargets: readonly Square[];
  /** Pieces that can be picked up for a premove. */
  readonly premovable: readonly Square[];
  /** Pieces jumped so far in a capture chain being chosen. */
  readonly ghosts: readonly Square[];
  readonly onSquare: (square: Square) => void;
  readonly onCancelPremove: () => void;
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

interface Press {
  readonly pointerId: number;
  readonly square: Square;
  readonly startX: number;
  readonly startY: number;
  /** The press started on a piece that may move (or be premoved). */
  readonly draggable: boolean;
  /** The piece was already selected, so a click (not a drag) deselects it. */
  readonly wasSelected: boolean;
  dragging: boolean;
}

export function Board(props: BoardProps) {
  const { pieces, captured, lastMove, moveNumber, legalMoves, selection, hint, flipped } = props;
  const { premove, premoveFrom, premoveTargets, premovable, ghosts } = props;
  const { t } = useI18n();
  const pieceElements = useRef(new Map<number, HTMLDivElement>());
  const squareElements = useRef(new Map<Square, HTMLButtonElement>());
  const squaresElement = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const drawingFrom = useRef<Square | null>(null);
  /** The move number reached by a drop, and the chain step reached by a drop. */
  const droppedAt = useRef(-1);
  const droppedStep = useRef<Square | null>(null);
  const [focus, setFocus] = useState<Square>(() => fromDisplay(0, 7, flipped));
  const [keyboard, setKeyboard] = useState(false);
  const [drag, setDrag] = useState<{ id: number; x: number; y: number } | null>(null);
  // Drawings belong to a position: a new move hides them.
  const [drawings, setDrawings] = useState<{ moveNumber: number; shapes: Shape[] }>({
    moveNumber,
    shapes: [],
  });
  const shapes = drawings.moveNumber === moveNumber ? drawings.shapes : [];

  // While a capture chain is chosen step by step, the moving piece is shown (faded) on the
  // last landing square chosen, not on its starting square.
  const moving = selection ? pieces.find((piece) => piece.square === selection.from) : undefined;
  const pending = selection && selection.path.length > 0 ? selection.path.at(-1) : undefined;
  const shownSquare = (piece: UiPiece) =>
    piece === moving && pending !== undefined ? pending : piece.square;

  // Pieces by the square they are shown on (cheap: at most 32 pieces).
  const occupant = new Map<Square, UiPiece>();
  for (const piece of pieces) occupant.set(shownSquare(piece), piece);

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
  const premoveTargetSet = useMemo(() => new Set(premoveTargets), [premoveTargets]);
  const premovableSet = useMemo(() => new Set(premovable), [premovable]);
  const ghostSet = useMemo(() => new Set(ghosts), [ghosts]);

  const draggable = (square: Square): boolean =>
    movable.has(square) || premovableSet.has(square) || square === pending;

  // Animate a newly played move along its path; the piece is already on its final square.
  // Loading a saved game, taking back or starting over changes the position without a move.
  // A dropped quiet move is already where it belongs; a capture always hops from its
  // starting square through every landing square, however it was played.
  const previousMoveNumber = useRef(moveNumber);
  useLayoutEffect(() => {
    const previous = previousMoveNumber.current;
    previousMoveNumber.current = moveNumber;
    if (!lastMove || moveNumber !== previous + 1) return;
    if (droppedAt.current === moveNumber && lastMove.captures.length === 0) return;
    const mover = pieces.find((piece) => piece.square === lastMove.to);
    const element = mover ? pieceElements.current.get(mover.id) : undefined;
    if (!element || typeof element.animate !== 'function') return;
    const frames = [lastMove.from, ...lastMove.path].map((square) => ({
      transform: transform(square, flipped),
    }));
    element.animate(frames, { duration: STEP_MS * lastMove.path.length, easing: 'ease-in-out' });
    // Only when a new move is played; flipping the board should not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveNumber]);

  // A step of a capture chain chosen by clicking hops to the new landing square; a step
  // chosen by dropping the piece there needs no animation.
  const previousSelection = useRef(selection);
  useLayoutEffect(() => {
    const before = previousSelection.current;
    previousSelection.current = selection;
    if (!selection || !before || before.from !== selection.from || !moving) return;
    if (selection.path.length !== before.path.length + 1 || pending === undefined) return;
    if (droppedStep.current === pending) {
      droppedStep.current = null;
      return;
    }
    const element = pieceElements.current.get(moving.id);
    if (!element || typeof element.animate !== 'function') return;
    const start = before.path.at(-1) ?? before.from;
    element.animate(
      [{ transform: transform(start, flipped) }, { transform: transform(pending, flipped) }],
      { duration: STEP_MS, easing: 'ease-in-out' },
    );
    // Only when the chain advances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  /** The square under a pointer, or `null` off the board. */
  const squareAt = (event: { clientX: number; clientY: number; target: EventTarget | null }) => {
    const rect = squaresElement.current?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * 8);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * 8);
      return x >= 0 && x < 8 && y >= 0 && y < 8 ? fromDisplay(x, y, flipped) : null;
    }
    // No layout (tests): fall back to the element the event happened on.
    const cell = event.target instanceof Element ? event.target.closest('[data-square]') : null;
    return cell ? Number(cell.getAttribute('data-square')) : null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    setKeyboard(false);
    const square = squareAt(event);
    if (square === null) return;
    if (event.button === 2) {
      // Right button: draw, and drop any premove (as on lichess).
      drawingFrom.current = square;
      if (premove || premoveFrom !== null) props.onCancelPremove();
      return;
    }
    if (event.button !== 0) return;
    if (shapes.length > 0) setDrawings({ moveNumber, shapes: [] });
    const canDrag = draggable(square);
    const wasSelected =
      square === pending ||
      (selection?.from === square && selection.path.length === 0) ||
      premoveFrom === square;
    // Pick the piece up at once, so its destinations show while dragging.
    if (canDrag && !wasSelected) props.onSquare(square);
    press.current = {
      pointerId: event.pointerId,
      square,
      startX: event.clientX,
      startY: event.clientY,
      draggable: canDrag,
      wasSelected,
      dragging: false,
    };
    if (canDrag && typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = press.current;
    if (!current?.draggable || current.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (!current.dragging && distance < DRAG_THRESHOLD) return;
    current.dragging = true;
    const rect = squaresElement.current?.getBoundingClientRect();
    const piece = occupant.get(current.square);
    if (!rect || rect.width === 0 || !piece) return;
    // Centre the piece under the pointer, in square units.
    setDrag({
      id: piece.id,
      x: ((event.clientX - rect.left) / rect.width) * 8 - 0.5,
      y: ((event.clientY - rect.top) / rect.height) * 8 - 0.5,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = squareAt(event);
    if (event.button === 2) {
      const from = drawingFrom.current;
      drawingFrom.current = null;
      if (from === null || target === null) return;
      setDrawings({ moveNumber, shapes: toggleShape(shapes, { from, to: target }) });
      return;
    }
    const current = press.current;
    press.current = null;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.dragging) {
      setDrag(null);
      if (target !== null && target !== current.square) {
        droppedAt.current = moveNumber + 1;
        droppedStep.current = target;
        props.onSquare(target);
      }
      return;
    }
    // A click: a picked-up piece was already selected on press; clicking it again deselects.
    if (current.draggable) {
      if (current.wasSelected) props.onSquare(current.square);
    } else if (target === current.square) {
      props.onSquare(current.square);
    }
  };

  const onPointerCancel = () => {
    press.current = null;
    drawingFrom.current = null;
    setDrag(null);
  };

  const moveFocus = (event: KeyboardEvent, square: Square) => {
    if (!MODIFIER_KEYS.has(event.key)) setKeyboard(true);
    if (event.key === 'Escape') {
      props.onCancelPremove();
      return;
    }
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
      if (premoveFrom === square) classes.push('premove-from');
      if (premoveTargetSet.has(square)) classes.push('premove-target');
      if (premove && (square === premove.from || square === premove.to)) classes.push('premove');
      if (draggable(square)) classes.push('draggable');
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
          data-square={square}
          className={classes.join(' ')}
          aria-label={label}
          aria-selected={selection?.from === square || premoveFrom === square}
          tabIndex={square === focus ? 0 : -1}
          onClick={(event) => {
            setFocus(square);
            // Mouse and touch are handled by the pointer events; this is the keyboard.
            if (event.detail === 0) props.onSquare(square);
          }}
          onKeyDown={(event) => {
            moveFocus(event, square);
          }}
          onKeyUp={(event) => {
            // Tabbing onto the board: the key goes up on the square that took the focus.
            if (event.key === 'Tab') setKeyboard(true);
          }}
        ></button>,
      );
    }
  }

  const centre = (square: Square) => {
    const { x, y } = toDisplay(square, flipped);
    return { x: x + 0.5, y: y + 0.5 };
  };

  const arrow = (points: Square[], colour: string, key: string, opacity = 0.75) => {
    const coords = points.map(centre);
    const last = coords.at(-1);
    const before = coords.at(-2);
    if (!last || !before) return null;
    // Stop the line short of the target centre so the head ends inside the square.
    const dx = last.x - before.x;
    const dy = last.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const end = { x: last.x - (dx / length) * 0.3, y: last.y - (dy / length) * 0.3 };
    const line = [...coords.slice(0, -1), end].map((p) => `${p.x},${p.y}`).join(' ');
    return (
      <polyline
        key={key}
        points={line}
        fill="none"
        stroke={colour}
        strokeWidth={0.16}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
        markerEnd={`url(#head-${colour.slice(1)})`}
      />
    );
  };

  return (
    <div className={`board${keyboard ? ' keyboard' : ''}`} role="grid" aria-label={t('board')}>
      <div
        ref={squaresElement}
        className="squares"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(event) => {
          event.preventDefault();
        }}
      >
        {squares}
      </div>
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
        {pieces.map((piece) => {
          const dragged = drag !== null && drag.id === piece.id ? drag : null;
          const shown = shownSquare(piece);
          const faded = ghostSet.has(piece.square) || (piece === moving && pending !== undefined);
          return (
            <div
              key={piece.id}
              ref={(element) => {
                if (element) pieceElements.current.set(piece.id, element);
                else pieceElements.current.delete(piece.id);
              }}
              className={`piece ${pieceClass(piece.piece)}${dragged ? ' dragging' : ''}${
                faded && !dragged ? ' ghost' : ''
              }`}
              style={{
                // The scale goes inside the transform, after the translation, so a dragged
                // piece stays centred under the pointer.
                transform: dragged
                  ? `translate(${dragged.x * 100}%, ${dragged.y * 100}%) scale(1.12)`
                  : transform(shown, flipped),
              }}
            />
          );
        })}
      </div>
      <svg className="drawings" viewBox="0 0 8 8" aria-hidden="true">
        <defs>
          {[DRAWING_COLOUR, HINT_COLOUR].map((colour) => (
            <marker
              key={colour}
              id={`head-${colour.slice(1)}`}
              orient="auto"
              markerWidth="3"
              markerHeight="3"
              refX="1.4"
              refY="1.5"
            >
              <path d="M0,0 L3,1.5 L0,3 Z" fill={colour} />
            </marker>
          ))}
        </defs>
        {hint && arrow([hint.from, ...hint.path], HINT_COLOUR, 'hint', 0.85)}
        {shapes.map((shape) => {
          const key = `${shape.from}-${shape.to}`;
          if (shape.from !== shape.to) return arrow([shape.from, shape.to], DRAWING_COLOUR, key);
          const { x, y } = centre(shape.from);
          return (
            <circle
              key={key}
              cx={x}
              cy={y}
              r={0.44}
              fill="none"
              stroke={DRAWING_COLOUR}
              strokeWidth={0.08}
              opacity={0.8}
            />
          );
        })}
      </svg>
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
