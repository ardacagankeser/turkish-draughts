import { describe, expect, it } from 'vitest';
import { INITIAL_FEN } from '../engine';
import { parseRoute, routeHash } from './route';

describe('routes', () => {
  it('plays by default', () => {
    expect(parseRoute('')).toEqual({ page: 'play' });
    expect(parseRoute('#/')).toEqual({ page: 'play' });
    expect(parseRoute('#/nowhere')).toEqual({ page: 'play' });
  });

  it('reads the analysis board and the editor', () => {
    expect(parseRoute('#/analysis')).toEqual({
      page: 'analysis',
      fen: INITIAL_FEN,
      moves: [],
      ply: null,
    });
    expect(parseRoute('#/analysis?fen=W:Wc3:Bc6&moves=c3-c4,c6-c5&ply=1')).toEqual({
      page: 'analysis',
      fen: 'W:Wc3:Bc6',
      moves: ['c3-c4', 'c6-c5'],
      ply: 1,
    });
    expect(parseRoute('#/analysis?ply=-2')).toMatchObject({ ply: null });
    expect(parseRoute('#/editor?fen=B:Wa3:Bh6')).toEqual({ page: 'editor', fen: 'B:Wa3:Bh6' });
  });

  it('writes readable hashes that read back the same', () => {
    const route = {
      page: 'analysis',
      fen: 'W:Wc3,Kd4:Bc6',
      moves: ['c3-c4', 'c6-c5'],
      ply: 2,
    } as const;
    const hash = routeHash(route);
    expect(hash).toBe('#/analysis?fen=W:Wc3,Kd4:Bc6&moves=c3-c4,c6-c5&ply=2');
    expect(parseRoute(hash)).toEqual(route);
    expect(routeHash({ page: 'analysis', fen: INITIAL_FEN, moves: [], ply: null })).toBe(
      '#/analysis',
    );
    expect(routeHash({ page: 'play' })).toBe('#/');
  });
});
