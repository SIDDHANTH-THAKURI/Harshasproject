/**
 * The compositor: turns an EDL plus decoded frames into one output frame.
 *
 * Pure and time-addressable — the preview player and the exporter call exactly the
 * same function, so what you see really is what gets rendered.
 */

import type { EditPlan, Segment, TransitionType } from '../edit/types';
import { clamp, clamp01, hashString, mulberry32 } from '../lib/utils';
import { drawInstance } from '../motion/registry';
import { drawTransition } from './transitions';

export interface FrameSlot {
  segment: Segment;
  srcTime: number;
  role: 'A' | 'B';
}

export interface FrameSpec {
  slots: FrameSlot[];
  transition: { type: TransitionType; progress: number } | null;
}

const srcTimeOf = (segment: Segment, t: number): number =>
  Math.max(0, segment.srcIn + (t - segment.start) * segment.speed);

/** Which segments (one, or two mid-transition) are on screen at time `t`. */
export function resolveFrame(plan: EditPlan, t: number): FrameSpec {
  const { segments } = plan;
  if (!segments.length) return { slots: [], transition: null };

  let index = segments.findIndex((s) => t >= s.start && t < s.start + s.duration);
  if (index === -1) index = t < segments[0].start ? 0 : segments.length - 1;
  const current = segments[index];

  // Transition into the current segment (we're just past the cut).
  const inTr = current.transitionIn;
  if (index > 0 && inTr.duration > 0) {
    const from = current.start - inTr.duration / 2;
    if (t >= from && t <= from + inTr.duration) {
      const prev = segments[index - 1];
      return {
        slots: [
          { segment: prev, srcTime: srcTimeOf(prev, t), role: 'A' },
          { segment: current, srcTime: srcTimeOf(current, t), role: 'B' },
        ],
        transition: { type: inTr.type, progress: clamp01((t - from) / inTr.duration) },
      };
    }
  }

  // Transition into the next segment (we're just before the cut).
  const next = segments[index + 1];
  if (next && next.transitionIn.duration > 0) {
    const from = next.start - next.transitionIn.duration / 2;
    if (t >= from && t <= from + next.transitionIn.duration) {
      return {
        slots: [
          { segment: current, srcTime: srcTimeOf(current, t), role: 'A' },
          { segment: next, srcTime: srcTimeOf(next, t), role: 'B' },
        ],
        transition: { type: next.transitionIn.type, progress: clamp01((t - from) / next.transitionIn.duration) },
      };
    }
  }

  return { slots: [{ segment: current, srcTime: srcTimeOf(current, t), role: 'A' }], transition: null };
}

/** Frames every segment needs, per output frame index — used to drive export readers. */
export function segmentFrameTimes(plan: EditPlan, fps: number): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const frames = Math.round(plan.duration * fps);
  for (let i = 0; i < frames; i++) {
    const spec = resolveFrame(plan, i / fps);
    for (const slot of spec.slots) {
      const list = out.get(slot.segment.id) ?? [];
      list.push(slot.srcTime);
      out.set(slot.segment.id, list);
    }
  }
  return out;
}

export interface RenderOptions {
  width: number;
  height: number;
  /** Draw the platform-UI safe zones (preview only). */
  safeZones?: boolean;
  watermark?: boolean;
  /** Hide overlays, e.g. while scrubbing the raw footage. */
  overlays?: boolean;
}

/** Cover-fit a frame into the output box, with the crop biased to the action. */
function drawCovered(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  segment: Segment,
  progress: number,
  w: number,
  h: number,
): void {
  const iw =
    (image as HTMLVideoElement).videoWidth ||
    (image as HTMLCanvasElement).width ||
    (image as HTMLImageElement).naturalWidth ||
    w;
  const ih =
    (image as HTMLVideoElement).videoHeight ||
    (image as HTMLCanvasElement).height ||
    (image as HTMLImageElement).naturalHeight ||
    h;
  if (!iw || !ih) return;

  const { type, amount, dir } = segment.effect;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  if (type === 'punch-in') scale = 1 + amount * progress;
  else if (type === 'pull-out') scale = 1 + amount * (1 - progress);
  else if (type === 'drift') {
    scale = 1 + amount;
    panX = (progress - 0.5) * amount * 1.6 * dir;
    panY = (progress - 0.5) * amount * 0.4;
  }

  const cover = Math.max(w / iw, h / ih) * scale;
  const dw = iw * cover;
  const dh = ih * cover;
  // framing 0..1 picks which part of a too-wide frame survives the 9:16 crop.
  const slackX = dw - w;
  const slackY = dh - h;
  const dx = -slackX * clamp(segment.framing, 0, 1) + panX * w;
  const dy = -slackY * 0.5 + panY * h;
  ctx.drawImage(image, dx, dy, dw, dh);
}

function drawSafeZones(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.05, h * 0.12, w * 0.9, h * 0.66);
  ctx.fillStyle = 'rgba(255,61,129,0.12)';
  ctx.fillRect(0, 0, w, h * 0.12);
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `600 ${Math.round(h * 0.016)}px Inter, sans-serif`;
  ctx.fillText('platform UI', w * 0.05, h * 0.105);
  ctx.fillText('caption / CTA zone', w * 0.05, h * 0.8);
  ctx.restore();
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.82;
  const fs = Math.round(h * 0.022);
  ctx.font = `800 ${fs}px Inter, sans-serif`;
  const text = 'made with Cutbeat';
  const tw = ctx.measureText(text).width;
  const pad = fs * 0.7;
  ctx.fillStyle = 'rgba(8,8,14,0.55)';
  ctx.beginPath();
  ctx.roundRect(w - tw - pad * 3.4, h - fs * 3.4, tw + pad * 2.4, fs * 2, fs);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w - tw - pad * 2.2, h - fs * 2.05);
  ctx.restore();
}

const planRandom = new Map<string, (i: number) => number>();
function randomFor(planId: string): (i: number) => number {
  let fn = planRandom.get(planId);
  if (!fn) {
    const rng = mulberry32(hashString(planId));
    const values = Array.from({ length: 256 }, () => rng());
    fn = (i: number) => values[((i % 256) + 256) % 256];
    planRandom.set(planId, fn);
  }
  return fn;
}

/**
 * Render one frame of the plan.
 * `frames` maps segment id -> decoded image for this instant.
 */
export function renderPlanFrame(
  ctx: CanvasRenderingContext2D,
  plan: EditPlan,
  t: number,
  frames: Map<string, CanvasImageSource | null>,
  opts: RenderOptions,
): void {
  const { width: w, height: h } = opts;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const spec = resolveFrame(plan, t);
  const drawerFor = (slot: FrameSlot) => (target: CanvasRenderingContext2D) => {
    const image = frames.get(slot.segment.id);
    if (!image) {
      target.fillStyle = '#0b0b14';
      target.fillRect(0, 0, w, h);
      return;
    }
    const progress = clamp01((t - slot.segment.start) / Math.max(0.001, slot.segment.duration));
    drawCovered(target, image, slot.segment, progress, w, h);
  };

  if (spec.transition && spec.slots.length === 2) {
    drawTransition(
      ctx,
      spec.transition.type,
      spec.transition.progress,
      drawerFor(spec.slots[0]),
      drawerFor(spec.slots[1]),
      w,
      h,
      randomFor(plan.id),
    );
  } else if (spec.slots.length) {
    drawerFor(spec.slots[0])(ctx);
  }

  if (opts.overlays !== false) {
    for (const overlay of plan.overlays) {
      if (t < overlay.start || t > overlay.start + overlay.duration) continue;
      ctx.save();
      drawInstance(ctx, overlay.asset, {
        width: w,
        height: h,
        t: t - overlay.start,
        duration: overlay.duration,
      });
      ctx.restore();
    }
  }

  if (opts.watermark) drawWatermark(ctx, w, h);
  if (opts.safeZones) drawSafeZones(ctx, w, h);
}

/** Decode box for a source so the compositor still has crop slack to work with. */
export function decodeSize(
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
): { width: number; height: number } {
  if (!srcW || !srcH) return { width: outW, height: outH };
  const srcAspect = srcW / srcH;
  const outAspect = outW / outH;
  if (srcAspect > outAspect) {
    return { width: Math.round(outH * srcAspect), height: outH };
  }
  return { width: outW, height: Math.round(outW / srcAspect) };
}
