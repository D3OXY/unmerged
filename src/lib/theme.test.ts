import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast, DEFAULT_PALETTE, derive, paletteOf, parseHex, PRESETS, ROLES, type Colors } from './theme';

const rgb = (hex: string) => parseHex(hex)!;
const surfaces = (colors: Colors) => [colors.bg, colors.panel, colors.elevated].map(rgb);

describe('derive', () => {
  // Seeds no preset uses: a saturated mid-tone accent on a tinted background, both ways round.
  const seeds = [
    { bg: '#fff4d6', accent: '#ffcc00' },
    { bg: '#2a0d3d', accent: '#3a1f8f' },
    { bg: '#ffffff', accent: '#ffffff' },
    { bg: '#000000', accent: '#000000' },
  ];

  it.each(seeds)('keeps text readable on every surface for %o', (seed) => {
    const colors = derive(seed);
    for (const surface of surfaces(colors)) {
      expect(contrast(rgb(colors.fg), surface)).toBeGreaterThanOrEqual(7);
      expect(contrast(rgb(colors.muted), surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(colors.subtle), surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(rgb(colors.accent), rgb(colors.bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the seeds when they are already readable', () => {
    const colors = derive({ bg: '#f7f9fc', accent: '#1a5fd0' });
    expect(colors.bg).toBe('#f7f9fc');
    expect(colors.accent).toBe('#1a5fd0');
  });
});

it('gives every preset all roles in both modes', () => {
  for (const theme of PRESETS) {
    for (const colors of Object.values(paletteOf(theme))) expect(Object.keys(colors).sort()).toEqual([...ROLES].sort());
  }
});

it("matches Unmerged's palette to tokens.css", () => {
  // Vitest blanks CSS imports, even `?raw`; tests run from the project root.
  const tokens = readFileSync('src/ui/tokens.css', 'utf8');
  const block = (selector: string) => {
    const body = tokens.slice(tokens.indexOf(`${selector} {\n  --u-bg`)).split('}')[0]!;
    return Object.fromEntries([...body.matchAll(/--u-([\w-]+): ([^;]+);/g)].map(([, role, value]) => [role, value]));
  };
  expect(block('.u-root')).toEqual(DEFAULT_PALETTE.light);
  expect(block('.u-root.dark')).toEqual(DEFAULT_PALETTE.dark);
});
