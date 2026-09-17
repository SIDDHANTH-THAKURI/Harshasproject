/** Colour helpers for the motion-graphics renderer. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const int = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(int)) return { r: 255, g: 255, b: 255 };
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mixHex(hex, '#ffffff', amount) : mixHex(hex, '#000000', -amount);
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Black or white, whichever stays readable on the given background. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.55 ? '#08080f' : '#ffffff';
}

export interface Palette {
  id: string;
  name: string;
  accent: string;
  accent2: string;
  ink: string;
  keywords: string[];
}

/** Named palettes, also used by the prompt parser to recolour generated assets. */
export const PALETTES: Palette[] = [
  {
    id: 'electric',
    name: 'Electric Violet',
    accent: '#7c5cff',
    accent2: '#ff3d81',
    ink: '#ffffff',
    keywords: ['electric', 'violet', 'purple', 'default'],
  },
  {
    id: 'neon',
    name: 'Neon Pink',
    accent: '#ff2e88',
    accent2: '#22d3ee',
    ink: '#ffffff',
    keywords: ['neon', 'pink', 'magenta', 'cyberpunk', 'glow', 'rave'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    accent: '#ff8a3d',
    accent2: '#ffd43d',
    ink: '#1a0d05',
    keywords: ['sunset', 'orange', 'warm', 'golden', 'gold', 'summer', 'beach'],
  },
  {
    id: 'mint',
    name: 'Mint Fresh',
    accent: '#2fe6a8',
    accent2: '#38bdf8',
    ink: '#04231a',
    keywords: ['mint', 'green', 'fresh', 'fitness', 'health', 'money'],
  },
  {
    id: 'mono',
    name: 'Mono',
    accent: '#ffffff',
    accent2: '#9ca3af',
    ink: '#000000',
    keywords: ['mono', 'monochrome', 'black', 'white', 'minimal', 'clean', 'luxury'],
  },
  {
    id: 'retro',
    name: 'Retro Pop',
    accent: '#ffcc00',
    accent2: '#ff5252',
    ink: '#1a1200',
    keywords: ['retro', 'vintage', '80s', '90s', 'pop', 'comic', 'yellow', 'red'],
  },
  {
    id: 'ice',
    name: 'Ice Blue',
    accent: '#38bdf8',
    accent2: '#a78bfa',
    ink: '#041726',
    keywords: ['ice', 'blue', 'cool', 'tech', 'corporate', 'saas', 'winter'],
  },
];

export const paletteById = (id: string): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0];
