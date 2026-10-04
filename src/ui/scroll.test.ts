import { describe, expect, it } from 'vitest';
import { revealWithin } from './scroll';

/** An element whose layout box is given, since jsdom does no layout. */
function box(top: number, bottom: number, scrollTop = 0) {
  return {
    scrollTop,
    getBoundingClientRect: () => ({ top, bottom }) as DOMRect,
  } as unknown as HTMLElement;
}

describe('revealWithin', () => {
  it('scrolls the container, never the page, to show an element below or above', () => {
    const list = box(100, 300, 50);
    revealWithin(list, box(320, 340));
    expect(list.scrollTop).toBe(90);
    revealWithin(list, box(60, 80));
    expect(list.scrollTop).toBe(50);
  });

  it('leaves an element that is already visible alone', () => {
    const list = box(100, 300, 20);
    revealWithin(list, box(150, 170));
    expect(list.scrollTop).toBe(20);
  });
});
