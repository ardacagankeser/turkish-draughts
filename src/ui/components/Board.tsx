import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Move, Piece, Square } from '../../engine';
import { squareName } from '../../engine';
import type { Timing } from '../animation';
import { GHOST_OPACITY } from '../animation';
import type { Shape } from '../drawing';
import { toggleShape } from '../drawing';
import type { MessageKey } from '../i18n';
import { useI18n } from '../i18n';
import type { UiPiece } from '../pieces';
import type { Selection } from '../selection';
import { destinations, movableSquares, nextSquares } from '../selection';
import type { Premove } from '../session';

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
  /** A move to point at with an arrow: a hint, or the engine's choice in a review. */
  readonly hint: { readonly from: Square; readonly path: readonly Square[] } | null;
  readonly flipped: boolean;
  readonly premove: Premove | null;
  readonly premoveFrom: Square | null;
  readonly premoveTargets: readonly Square[];
  /** Pieces that can be picked up for a premove. */
  readonly premovable: readonly Square[];
  /** Pieces jumped so far in a capture chain being chosen. */
  readonly ghosts: readonly Square[];
  readonly timing: Timing;
  readonly onSquare: (square: Square) => void;
  readonly onCancelPremove: () => void;
  /**
   * Told how many milliseconds the animation of each newly shown move lasts (0 when it is
   * not animated), so the game can wait for the board to be still before the next move.
   */
  readonly onSettle?: (ms: number) => void;
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

const canAnimate = (element: HTMLElement | undefined): element is HTMLElement =>
  element !== undefined && typeof element.animate === 'function';

/** A quiet move slides along its squares in one go. Returns how long it takes. */
function slide(
  element: HTMLElement,
  steps: readonly Square[],
  timing: Timing,
  flipped: boolean,
): number {
  if (steps.length < 2) return 0;
  const duration = timing.slide * (steps.length - 1);
  element.animate(
    steps.map((square) => ({ transform: transform(square, flipped) })),
    { duration, easing: 'ease-in-out' },
  );
  return duration;
}

/**
 * A capture hops from landing square to landing square, pausing on each while the jumped
 * piece flies off.
 */
function hop(
  element: HTMLElement,
  steps: readonly Square[],
  timing: Timing,
  flipped: boolean,
): number {
  const beats = steps.length - 1;
  if (beats < 1) return 0;
  const total = timing.hopStart(beats - 1) + timing.hop;
  const frames: Keyframe[] = [];
  for (let beat = 0; beat < beats; beat++) {
    const from = steps[beat] ?? 0;
    const to = steps[beat + 1] ?? from;
    const start = timing.hopStart(beat);
    frames.push({
      offset: start / total,
      transform: transform(from, flipped),
      easing: 'ease-in-out',
    });
    frames.push({ offset: (start + timing.hop) / total, transform: transform(to, flipped) });
  }
  element.animate(frames, { duration: total });
  return total;
}

/**
 * A jumped piece flies off: it rises, shrinks and fades, starting `delay` ms from now. With
 * reduced motion it only fades. Returns when it is gone.
 */
function flyOff(
  element: HTMLElement,
  square: Square,
  flipped: boolean,
  timing: Timing,
  delay: number,
  from = 1,
): number {
  const at = transform(square, flipped);
  const away = timing.calm ? `${at} scale(1)` : `${at} translateY(-35%) scale(0.6)`;
  element.animate(
    [
      { transform: `${at} scale(1)`, opacity: from },
      { transform: away, opacity: 0 },
    ],
    { delay, duration: timing.vanish, easing: 'ease-in', fill: 'both' },
  );
  return delay + timing.vanish;
}

/**
 * Brings every animation still running on the board to its end, so a new move never plays
 * over an old one (a fast reply, quick browsing, two players moving quickly).
 */
function finishRunning(container: HTMLElement | null): void {
  if (!container || typeof container.getAnimations !== 'function') return;
  for (const animation of container.getAnimations({ subtree: true })) animation.finish();
}

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
  const { premove, premoveFrom, premoveTargets, premovable, ghosts, timing } = props;
  const { t } = useI18n();
  const pieceElements = useRef(new Map<number, HTMLDivElement>());
  const capturedElements = useRef(new Map<number, HTMLDivElement>());
  const squareElements = useRef(new Map<Square, HTMLButtonElement>());
  const squaresElement = useRef<HTMLDivElement>(null);
  const piecesElement = useRef<HTMLDivElement>(null);
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

  // Animate a newly played move; the pieces are already where the move leaves them.
  // Loading a saved game, taking back or starting over changes the position without a move.
  // A capture plays beat by beat: hop to a landing square, then the jumped piece flies off.
  // Steps the player already chose on the board are not replayed (their pieces were faded
  // then, and fly off with the first remaining beat), and a piece dropped one hop away
  // stays there while the jumped piece flies off.
  const previousMoveNumber = useRef(moveNumber);
  const previousSelection = useRef(selection);
  useLayoutEffect(() => {
    const previous = previousMoveNumber.current;
    previousMoveNumber.current = moveNumber;
    if (moveNumber === previous) return;
    finishRunning(piecesElement.current);
    if (!lastMove || moveNumber !== previous + 1 || !timing.enabled) {
      props.onSettle?.(0);
      return;
    }
    const dropped = droppedAt.current === moveNumber;
    const mover = pieces.find((piece) => piece.square === lastMove.to);
    const element = mover ? pieceElements.current.get(mover.id) : undefined;

    // Landing squares already chosen, when the player finished this move on the board
    // (all of them when the move waited for confirmation).
    const chosen = previousSelection.current;
    const done =
      chosen !== null &&
      chosen.from === lastMove.from &&
      chosen.path.length <= lastMove.path.length &&
      chosen.path.every((square, index) => square === lastMove.path[index])
        ? chosen.path.length
        : 0;
    const steps = [lastMove.from, ...lastMove.path].slice(done);
    const beats = steps.length - 1;
    // A piece dropped one hop away is already where it belongs. Dropped on the end of a
    // longer chain, it still hops through every landing square so the capture can be followed.
    const still = dropped && beats <= 1;

    let longest = 0;
    if (!still && canAnimate(element)) {
      longest =
        lastMove.captures.length === 0
          ? slide(element, steps, timing, flipped)
          : hop(element, steps, timing, flipped);
    }
    // The jumped pieces in the order they were captured.
    lastMove.captures.forEach((square, index) => {
      const piece = captured.find((candidate) => candidate.square === square);
      const jumped = piece ? capturedElements.current.get(piece.id) : undefined;
      if (!canAnimate(jumped)) return;
      const delay = still || beats === 0 ? 0 : timing.vanishStart(Math.max(0, index - done));
      const gone = flyOff(jumped, square, flipped, timing, delay, index < done ? GHOST_OPACITY : 1);
      longest = Math.max(longest, gone);
    });
    props.onSettle?.(longest);
    // Only when a new move is played; flipping the board should not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveNumber]);

  // Landing squares chosen by clicking (a capture chain step by step, or a whole move
  // waiting for confirmation) are played the same way: hop, then the jumped piece fades.
  // A single step chosen by dropping the piece there needs no animation.
  useLayoutEffect(() => {
    const before = previousSelection.current;
    previousSelection.current = selection;
    if (!selection || !before || before.from !== selection.from || !moving) return;
    const added = selection.path.length - before.path.length;
    if (added < 1 || pending === undefined || !timing.enabled) return;
    const droppedHere = droppedStep.current === pending;
    droppedStep.current = null;
    if (droppedHere && added === 1) return;
    const element = pieceElements.current.get(moving.id);
    if (!canAnimate(element)) return;
    finishRunning(piecesElement.current);
    const steps = [before.path.at(-1) ?? before.from, ...selection.path.slice(-added)];
    if (!mustCapture) {
      slide(element, steps, timing, flipped);
      return;
    }
    hop(element, steps, timing, flipped);
    ghosts.slice(-added).forEach((square, index) => {
      const jumped = pieces.find((piece) => piece.square === square);
      const ghost = jumped ? pieceElements.current.get(jumped.id) : undefined;
      if (!canAnimate(ghost)) return;
      ghost.animate([{ opacity: 1 }, { opacity: GHOST_OPACITY }], {
        delay: timing.vanishStart(index),
        duration: timing.vanish,
        easing: 'ease-in',
        fill: 'backwards',
      });
    });
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
        // A premove is dropped before the computer's reply, which must still be animated.
        const ownMove = movable.has(current.square) || current.square === pending;
        droppedAt.current = ownMove ? moveNumber + 1 : -1;
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
      <div className="pieces" aria-hidden="true" ref={piecesElement}>
        {captured.map((piece) => (
          <div
            key={`captured-${piece.id}-${moveNumber}`}
            ref={(element) => {
              if (element) capturedElements.current.set(piece.id, element);
              else capturedElements.current.delete(piece.id);
            }}
            className={`piece ${pieceClass(piece.piece)} captured`}
            // Hidden unless the move's animation flies it off.
            style={{ transform: transform(piece.square, flipped) }}
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
