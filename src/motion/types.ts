/**
 * Motion graphics are *code*, not video files.
 *
 * Every template is a pure draw function over a fixed 1080x1920 design space plus a
 * typed parameter list. That makes previews free (draw at any size), makes generated
 * assets editable after the fact (text stays text), and lets the "describe it" flow
 * produce a real asset by choosing a template and filling in parameters.
 */

export const DESIGN_W = 1080;
export const DESIGN_H = 1920;

export type ParamKind = 'text' | 'color' | 'select' | 'number' | 'toggle';

export interface ParamSpec {
  key: string;
  label: string;
  kind: ParamKind;
  default: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  maxLength?: number;
  hint?: string;
}

export type ParamValues = Record<string, string | number | boolean>;

export interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  /** Local time within the asset, in seconds. */
  t: number;
  /** Total length of this instance, in seconds. */
  duration: number;
  /** Normalised progress 0..1. */
  p: number;
  w: number;
  h: number;
  params: ParamValues;
  /** Deterministic noise in 0..1, stable for a given index. */
  rand: (index: number) => number;
}

export type MotionCategory =
  | 'hook'
  | 'caption'
  | 'lower-third'
  | 'sticker'
  | 'cta'
  | 'background'
  | 'look';

export const CATEGORY_LABELS: Record<MotionCategory, string> = {
  hook: 'Hooks & titles',
  caption: 'Captions',
  'lower-third': 'Lower thirds',
  sticker: 'Stickers & emphasis',
  cta: 'End cards & CTAs',
  background: 'Backgrounds',
  look: 'Looks & overlays',
};

export interface MotionTemplate {
  id: string;
  name: string;
  category: MotionCategory;
  description: string;
  /** Style tags, surfaced as filters and used by the prompt matcher. */
  tags: string[];
  /** Extra words the matcher should associate with this template. */
  keywords: string[];
  /** 1 = calm, 2 = medium, 3 = high energy. */
  energy: 1 | 2 | 3;
  /** Natural length in seconds. */
  duration: number;
  /** Where the auto-editor likes to place this asset. */
  placement: 'open' | 'peak' | 'any' | 'close' | 'full';
  pro?: boolean;
  params: ParamSpec[];
  draw: (a: DrawArgs) => void;
}

export function paramDefaults(tpl: MotionTemplate): ParamValues {
  const out: ParamValues = {};
  for (const p of tpl.params) out[p.key] = p.default;
  return out;
}

export const str = (p: ParamValues, key: string, fallback = ''): string => {
  const v = p[key];
  return typeof v === 'string' ? v : fallback;
};

export const num = (p: ParamValues, key: string, fallback = 0): number => {
  const v = p[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};

export const bool = (p: ParamValues, key: string, fallback = false): boolean => {
  const v = p[key];
  return typeof v === 'boolean' ? v : fallback;
};
