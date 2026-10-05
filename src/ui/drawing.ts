import type { Square } from '../engine';

/** An arrow from one square to another, or a circle when `from === to`. */
export interface Shape {
  readonly from: Square;
  readonly to: Square;
}

/** Adds a shape, or removes it if the same shape is drawn again. */
export function toggleShape(shapes: readonly Shape[], shape: Shape): Shape[] {
  const same = (s: Shape) => s.from === shape.from && s.to === shape.to;
  return shapes.some(same) ? shapes.filter((s) => !same(s)) : [...shapes, shape];
}
