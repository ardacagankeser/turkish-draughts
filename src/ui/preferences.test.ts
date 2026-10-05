// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../test/fakes';
import {
  DEFAULT_PREFERENCES,
  animationScale,
  applyPreferences,
  loadPreferences,
  savePreferences,
} from './preferences';

describe('preferences', () => {
  it('starts from the defaults and remembers changes', () => {
    const storage = new MemoryStorage();
    expect(loadPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
    const changed = { ...DEFAULT_PREFERENCES, board: 'green', volume: 0.3 } as const;
    savePreferences(changed, storage);
    expect(loadPreferences(storage)).toEqual(changed);
  });

  it('replaces unknown or broken values with the defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'turkish-draughts:preferences',
      JSON.stringify({ theme: 'neon', board: 'blue', volume: 7, coordinates: 'yes', muted: true }),
    );
    expect(loadPreferences(storage)).toEqual({
      ...DEFAULT_PREFERENCES,
      board: 'blue',
      muted: true,
    });
    storage.setItem('turkish-draughts:preferences', '{not json');
    expect(loadPreferences(storage)).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps the mute toggle saved before preferences existed', () => {
    const storage = new MemoryStorage();
    storage.setItem('turkish-draughts:muted', 'true');
    expect(loadPreferences(storage).muted).toBe(true);
    savePreferences(loadPreferences(storage), storage);
    expect(storage.getItem('turkish-draughts:muted')).toBeNull();
    expect(loadPreferences(storage).muted).toBe(true);
  });

  it('shows the styling preferences as attributes on the root element', () => {
    const root = document.createElement('html');
    applyPreferences(root, { ...DEFAULT_PREFERENCES, theme: 'dark', coordinates: false });
    expect(root.dataset).toMatchObject({
      theme: 'dark',
      board: 'wood',
      pieces: 'classic',
      coordinates: 'off',
      legalMoves: 'on',
      lastMove: 'on',
    });
    applyPreferences(root, DEFAULT_PREFERENCES);
    expect(root.dataset.theme).toBeUndefined();
  });

  it('scales the animations by speed, and turns them off only when asked', () => {
    expect(animationScale('normal')).toBe(1);
    expect(animationScale('fast')).toBeLessThan(1);
    expect(animationScale('slow')).toBeGreaterThan(1);
    expect(animationScale('none')).toBe(0);
  });

  it('reads the old automatic speed as normal', () => {
    const storage = new MemoryStorage();
    storage.setItem('turkish-draughts:preferences', JSON.stringify({ animation: 'auto' }));
    expect(loadPreferences(storage).animation).toBe('normal');
  });
});
