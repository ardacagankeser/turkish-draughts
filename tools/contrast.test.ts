/**
 * WCAG AA contrast (4.5:1 for normal text) for the colour pairs the interface uses, in both
 * themes, read straight from the design tokens in src/ui/styles.css.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(import.meta.dirname, '../src/ui/styles.css'), 'utf8');

const HEX = '#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}';

/** Colour tokens of the main `:root` block, as `--name: #hex` or `light-dark(#hex, #hex)`. */
function themes(): { light: Record<string, string>; dark: Record<string, string> } {
  const start = css.indexOf(':root {');
  const block = css.slice(start, css.indexOf('}', start));
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  const pattern = new RegExp(
    String.raw`--([\w-]+):\s*(?:light-dark\((${HEX}),\s*(${HEX})\)|(${HEX}));`,
    'g',
  );
  for (const [, name, lightValue, darkValue, both] of block.matchAll(pattern)) {
    if (!name) continue;
    const forLight = lightValue ?? both;
    const forDark = darkValue ?? both;
    if (forLight) light[name] = forLight;
    if (forDark) dark[name] = forDark;
  }
  return { light, dark };
}

const { light, dark } = themes();

function luminance(hex: string): number {
  // #abc is short for #aabbcc.
  const full =
    hex.length === 4 ? [1, 2, 3].map((i) => hex.charAt(i).repeat(2)).join('') : hex.slice(1);
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

const PAIRS: [string, string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['text-muted', 'surface-2'],
  ['accent-text', 'accent'],
  ['accent', 'surface'],
  ['danger', 'surface'],
  ['danger-text', 'danger'],
];

describe('colour contrast', () => {
  it('reads the tokens of both themes', () => {
    expect(Object.keys(light).length).toBeGreaterThan(10);
    expect(dark.surface).not.toBe(light.surface);
  });

  for (const [theme, colours] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const [fg, bg] of PAIRS) {
      it(`${theme}: ${fg} on ${bg} meets WCAG AA`, () => {
        const a = colours[fg];
        const b = colours[bg];
        expect(a, fg).toBeDefined();
        expect(b, bg).toBeDefined();
        expect(contrast(a ?? '', b ?? '')).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
