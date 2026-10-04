import { describe, expect, it } from 'vitest';
import { brushFor, toggleShape } from './drawing';

const none = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false };

describe('board drawings', () => {
  it('picks the colour from the modifier keys, as on lichess', () => {
    expect(brushFor(none)).toBe('green');
    expect(brushFor({ ...none, shiftKey: true })).toBe('red');
    expect(brushFor({ ...none, altKey: true })).toBe('blue');
    expect(brushFor({ ...none, ctrlKey: true })).toBe('yellow');
    expect(brushFor({ ...none, metaKey: true, shiftKey: true })).toBe('yellow');
  });

  it('toggles a shape, and recolours it when drawn in another colour', () => {
    const arrow = { from: 12, to: 28, brush: 'green' } as const;
    const added = toggleShape([], arrow);
    expect(added).toEqual([arrow]);
    expect(toggleShape(added, arrow)).toEqual([]);
    expect(toggleShape(added, { ...arrow, brush: 'red' })).toEqual([{ ...arrow, brush: 'red' }]);
    const circle = { from: 5, to: 5, brush: 'blue' } as const;
    expect(toggleShape(added, circle)).toEqual([arrow, circle]);
  });
});
