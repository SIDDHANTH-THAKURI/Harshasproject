/** The asset library: every motion template plus helpers to draw an instance of one. */

import { hashString, mulberry32 } from '../lib/utils';
import { BACKGROUND_TEMPLATES } from './templates/backgrounds';
import { STICKER_TEMPLATES } from './templates/stickers';
import { TEXT_TEMPLATES } from './templates/text';
import type { MotionCategory, MotionTemplate, ParamValues } from './types';
import { DESIGN_H, DESIGN_W, paramDefaults } from './types';

export const MOTION_TEMPLATES: MotionTemplate[] = [
  ...TEXT_TEMPLATES,
  ...STICKER_TEMPLATES,
  ...BACKGROUND_TEMPLATES,
];

const byId = new Map(MOTION_TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): MotionTemplate | undefined {
  return byId.get(id);
}

export const ALL_TAGS: string[] = Array.from(new Set(MOTION_TEMPLATES.flatMap((t) => t.tags))).sort();

export const CATEGORIES: MotionCategory[] = [
  'hook',
  'caption',
  'lower-third',
  'sticker',
  'cta',
  'background',
  'look',
];

/** A concrete, placeable copy of a template with its own parameter values. */
export interface AssetInstance {
  instanceId: string;
  templateId: string;
  name: string;
  params: ParamValues;
  duration: number;
  /** Set when the asset came out of the "describe it" flow. */
  generated?: boolean;
  prompt?: string;
  matchScore?: number;
  matchReasons?: string[];
}

export function instantiate(
  template: MotionTemplate,
  overrides: Partial<AssetInstance> = {},
): AssetInstance {
  const base: AssetInstance = {
    instanceId: `${template.id}-${Math.random().toString(36).slice(2, 8)}`,
    templateId: template.id,
    name: template.name,
    params: paramDefaults(template),
    duration: template.duration,
  };
  return {
    ...base,
    ...overrides,
    params: { ...base.params, ...(overrides.params ?? {}) },
  };
}

const randomCache = new Map<string, (i: number) => number>();

/** Stable per-template noise, so a template animates the same way every render. */
function randomFor(id: string): (i: number) => number {
  let fn = randomCache.get(id);
  if (!fn) {
    const values: number[] = [];
    const rng = mulberry32(hashString(id));
    for (let i = 0; i < 512; i++) values.push(rng());
    fn = (i: number) => values[((i % 512) + 512) % 512];
    randomCache.set(id, fn);
  }
  return fn;
}

export interface DrawInstanceOptions {
  /** Output canvas size. The template always draws in 1080x1920 design space. */
  width: number;
  height: number;
  /** Local time in seconds. */
  t: number;
  duration?: number;
  alpha?: number;
}

export function drawInstance(
  ctx: CanvasRenderingContext2D,
  instance: Pick<AssetInstance, 'templateId' | 'params' | 'duration'>,
  opts: DrawInstanceOptions,
): void {
  const template = byId.get(instance.templateId);
  if (!template) return;
  const duration = opts.duration ?? instance.duration ?? template.duration;
  const t = Math.max(0, opts.t);
  if (t > duration) return;

  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.scale(opts.width / DESIGN_W, opts.height / DESIGN_H);
  try {
    template.draw({
      ctx,
      t,
      duration,
      p: duration > 0 ? t / duration : 0,
      w: DESIGN_W,
      h: DESIGN_H,
      params: instance.params,
      rand: randomFor(instance.templateId),
    });
  } catch (err) {
    // A broken template should never take down a render.
    console.error(`[motion] ${instance.templateId} failed to draw`, err);
  }
  ctx.restore();
}
