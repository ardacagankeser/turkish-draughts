import type { Square } from '../engine';

/** Colours for drawings, chosen with modifier keys as on lichess. */
export type Brush = 'green' | 'red' | 'blue' | 'yellow';

/** An arrow from one square to another, or a circle when `from === to`. */
export interface Shape {
  readonly from: Square;
  readonly to: Square;
  readonly brush: Brush;
}

/** Right-click: green; with Shift red, Alt blue, Ctrl (or Cmd) yellow. */
export function brushFor(modifiers: {
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): Brush {
  if (modifiers.ctrlKey || modifiers.metaKey) return 'yellow';
  if (modifiers.shiftKey) return 'red';
  if (modifiers.altKey) return 'blue';
  return 'green';
}

/**
 * Adds a shape, or removes it if the same shape is drawn again. Drawing over an existing
 * shape with another colour recolours it.
 */
export function toggleShape(shapes: readonly Shape[], shape: Shape): Shape[] {
  const same = (s: Shape) => s.from === shape.from && s.to === shape.to;
  const existing = shapes.find(same);
  const others = shapes.filter((s) => !same(s));
  if (existing?.brush === shape.brush) return others;
  return [...others, shape];
}
