import { describe, expect, it } from 'vitest';
import { BOARD_SIZE } from '.';

describe('engine', () => {
  it('uses an 8x8 board', () => {
    expect(BOARD_SIZE).toBe(8);
  });
});
