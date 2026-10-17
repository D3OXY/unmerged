/**
 * Color themes. A theme is a light and a dark palette of the `--u-*` roles in `src/ui/tokens.css`. Presets and
 * custom themes alike are grown from two seed colors per mode, a background and an accent: surfaces step off
 * the background, and every text color is solved for contrast against them, so any pair of seeds stays
 * readable (adapted from T3 Code's palette engine). Unmerged's own theme is hand-tuned instead.
 */

/** The `--u-*` variables a palette sets, in tokens.css order. */
export const ROLES = ['bg', 'panel', 'elevated', 'hover', 'border', 'border-strong', 'fg', 'muted', 'subtle', 'accent', 'accent-fg', 'green', 'red', 'yellow', 'purple', 'blue'] as const;

export type Role = (typeof ROLES)[number];
export type Colors = Record<Role, string>;
export type Mode = 'light' | 'dark';
export type Palette = Record<Mode, Colors>;

/** The two colors, as `#rrggbb`, a mode's palette is grown from. */
export type Seeds = { bg: string; accent: string };

/** A preset or a custom theme. Only Unmerged's has hand-tuned `colors`; the rest derive them from `seeds`. */
export type Theme = { id: string; name: string; seeds: Record<Mode, Seeds>; colors?: Palette };

/** Unmerged's own palette, identical to tokens.css (a test keeps them in step). */
export const DEFAULT_PALETTE: Palette = {
  light: {
    bg: '#fcfcfd',
    panel: '#ffffff',
    elevated: '#f4f5f8',
    hover: 'rgb(0 0 0 / 0.035)',
    border: 'rgb(0 0 0 / 0.08)',
    'border-strong': 'rgb(0 0 0 / 0.14)',
    fg: '#1b1c1f',
    muted: '#62666d',
    subtle: '#6b6f76',
    accent: '#5e6ad2',
    'accent-fg': '#ffffff',
    green: '#2f9e6b',
    red: '#d93f3f',
    yellow: '#c48a00',
    purple: '#8250df',
    blue: '#1f7ae0',
  },
  dark: {
    bg: '#08090a',
    panel: '#0f1011',
    elevated: '#18191b',
    hover: 'rgb(255 255 255 / 0.04)',
    border: 'rgb(255 255 255 / 0.075)',
    'border-strong': 'rgb(255 255 255 / 0.13)',
    fg: '#f7f8f8',
    muted: '#8a8f98',
    subtle: '#7e828a',
    accent: '#7170ff',
    'accent-fg': '#ffffff',
    green: '#4cb782',
    red: '#eb5757',
    yellow: '#f2c94c',
    purple: '#a371f7',
    blue: '#4ea7fc',
  },
};

export const DEFAULT_THEME_ID = 'unmerged';

export const PRESETS: readonly Theme[] = [
  { id: DEFAULT_THEME_ID, name: 'Unmerged', seeds: { light: { bg: '#fcfcfd', accent: '#5e6ad2' }, dark: { bg: '#08090a', accent: '#7170ff' } }, colors: DEFAULT_PALETTE },
  { id: 'graphite', name: 'Graphite', seeds: { light: { bg: '#fafafa', accent: '#3f3f46' }, dark: { bg: '#0b0b0c', accent: '#d4d4d8' } } },
  { id: 'paper', name: 'Paper', seeds: { light: { bg: '#f7f3ea', accent: '#a0522d' }, dark: { bg: '#1a1714', accent: '#d9a066' } } },
  { id: 'grove', name: 'Grove', seeds: { light: { bg: '#f8faf7', accent: '#2f8a57' }, dark: { bg: '#0a0f0c', accent: '#4cc38a' } } },
  { id: 'ocean', name: 'Ocean', seeds: { light: { bg: '#f7f9fc', accent: '#1f6feb' }, dark: { bg: '#0a0e15', accent: '#4c9aff' } } },
  { id: 'ember', name: 'Ember', seeds: { light: { bg: '#fcf9f6', accent: '#d9480f' }, dark: { bg: '#120d0a', accent: '#f76b15' } } },
  { id: 'iris', name: 'Iris', seeds: { light: { bg: '#faf8fd', accent: '#7c3aed' }, dark: { bg: '#0e0b15', accent: '#a78bfa' } } },
];

/** The theme with this id among the presets and custom themes; Unmerged's if it's gone. */
export function findTheme(id: string, custom: readonly Theme[]): Theme {
  return PRESETS.find((theme) => theme.id === id) ?? custom.find((theme) => theme.id === id) ?? PRESETS[0]!;
}

export function paletteOf(theme: Theme): Palette {
  return theme.colors ?? { light: derive(theme.seeds.light), dark: derive(theme.seeds.dark) };
}

/** Sets a palette's `--u-*` variables on `element`, over the stylesheet's defaults. */
export function paintPalette(element: HTMLElement, colors: Colors) {
  for (const role of ROLES) element.style.setProperty(`--u-${role}`, colors[role]);
}

type Rgb = { r: number; g: number; b: number };
type Oklch = { l: number; c: number; h: number };

/** Grows a mode's palette from its seeds; which way surfaces and text go follows the background's lightness. */
export function derive(seeds: Seeds): Colors {
  const bgRgb = parseHex(seeds.bg) ?? { r: 252, g: 252, b: 253 };
  const bg = toOklch(bgRgb);
  const accentSeed = toOklch(parseHex(seeds.accent) ?? { r: 94, g: 106, b: 210 });
  const dark = luminance(bgRgb) < 0.179;
  const toward = dark ? 1 : -1;
  const status = DEFAULT_PALETTE[dark ? 'dark' : 'light'];

  // Light themes raise panels toward white and sink elevated surfaces; dark ones lift both.
  const surface = (delta: number) => fromOklch({ ...bg, l: clamp(bg.l + delta) });
  const panel = surface(dark ? 0.035 : 0.012);
  const elevated = surface(dark ? 0.075 : -0.022);
  const surfaces = [bgRgb, panel, elevated];

  // Text carries a trace of the accent's hue, solved to AAA; muted and subtle are the quietest mixes of it
  // that still clear their floor on every surface (subtle is the 4.5:1 floor).
  const fg = fromOklch(solve({ l: dark ? 0.97 : 0.2, c: Math.min(0.012, accentSeed.c * 0.1), h: accentSeed.h }, surfaces, 7, toward));
  const quieter = (floor: number) => quietest(fg, bgRgb, surfaces, floor);
  const accent = fromOklch(solve(accentSeed, [bgRgb, panel], 4.5, toward));
  const overlay = (alpha: number) => `rgb(${fg.r} ${fg.g} ${fg.b} / ${alpha})`;
  const readable = (color: string) => toHex(fromOklch(solve(toOklch(parseHex(color)!), [bgRgb], 3, toward)));

  return {
    bg: toHex(bgRgb),
    panel: toHex(panel),
    elevated: toHex(elevated),
    hover: overlay(dark ? 0.04 : 0.035),
    border: overlay(dark ? 0.075 : 0.08),
    'border-strong': overlay(dark ? 0.13 : 0.14),
    fg: toHex(fg),
    muted: toHex(quieter(5.4)),
    subtle: toHex(quieter(4.6)),
    accent: toHex(accent),
    // White on the accent unless it's too light for it, as on most dark themes' accents.
    'accent-fg': contrast(accent, WHITE) >= 3.5 ? '#ffffff' : toHex(fromOklch({ l: 0.18, c: 0.01, h: accentSeed.h })),
    green: readable(status.green),
    red: readable(status.red),
    yellow: readable(status.yellow),
    purple: readable(status.purple),
    blue: readable(status.blue),
  };
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** `#rgb` or `#rrggbb`, or null. */
export function parseHex(hex: string): Rgb | null {
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const digits = match[1]!.length === 3 ? [...match[1]!].map((d) => d + d).join('') : match[1]!;
  const n = Number.parseInt(digits, 16);
  return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

const toLinear = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (channel: number) => Math.round(clamp(channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055) * 255);

function toOklch(rgb: Rgb): Oklch {
  const [r, g, b] = [toLinear(rgb.r), toLinear(rgb.g), toLinear(rgb.b)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, c: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180) / Math.PI };
}

/** Linear sRGB, unclamped: channels outside 0–1 are out of gamut. */
function linearOf({ l: L, c, h }: Oklch) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

/** To sRGB, lowering chroma (keeping lightness and hue) until the color fits. */
function fromOklch(color: Oklch): Rgb {
  const fits = (c: number) => linearOf({ ...color, c }).every((channel) => channel >= -0.0001 && channel <= 1.0001);
  let c = color.c;
  if (!fits(c)) {
    let low = 0;
    for (let step = 0; step < 16; step++) {
      const mid = (low + c) / 2;
      if (fits(mid)) low = mid;
      else c = mid;
    }
    c = low;
  }
  const [r, g, b] = linearOf({ ...color, c }).map(fromLinear);
  return { r: r!, g: g!, b: b! };
}

function luminance({ r, g, b }: Rgb) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrast(a: Rgb, b: Rgb) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const worstContrast = (color: Rgb, against: Rgb[]) => Math.min(...against.map((surface) => contrast(color, surface)));

/** `color`, moved toward light (`toward` 1) or dark (-1) only as far as it takes to reach `floor` on every surface. */
function solve(color: Oklch, against: Rgb[], floor: number, toward: 1 | -1): Oklch {
  if (worstContrast(fromOklch(color), against) >= floor) return color;
  let [near, far] = [color.l, toward === 1 ? 1 : 0];
  for (let step = 0; step < 20; step++) {
    const mid = (near + far) / 2;
    if (worstContrast(fromOklch({ ...color, l: mid }), against) >= floor) far = mid;
    else near = mid;
  }
  return { ...color, l: far };
}

/** The furthest mix of `fg` into `bg` that still reaches `floor` on every surface. */
function quietest(fg: Rgb, bg: Rgb, against: Rgb[], floor: number): Rgb {
  const mix = (t: number) => ({ r: fg.r + (bg.r - fg.r) * t, g: fg.g + (bg.g - fg.g) * t, b: fg.b + (bg.b - fg.b) * t });
  let [low, high] = [0, 1];
  for (let step = 0; step < 16; step++) {
    const mid = (low + high) / 2;
    if (worstContrast(mix(mid), against) >= floor) low = mid;
    else high = mid;
  }
  const { r, g, b } = mix(low);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}
