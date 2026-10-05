import { describe, expect, it } from 'vitest';
import { toggleShape } from './drawing';

describe('board drawings', () => {
  it('adds a shape, and removes it when the same shape is drawn again', () => {
    const arrow = { from: 12, to: 28 };
    const added = toggleShape([], arrow);
    expect(added).toEqual([arrow]);
    expect(toggleShape(added, arrow)).toEqual([]);
    const circle = { from: 5, to: 5 };
    expect(toggleShape(added, circle)).toEqual([arrow, circle]);
  });
});
