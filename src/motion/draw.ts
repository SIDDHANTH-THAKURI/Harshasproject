/** Canvas drawing + easing helpers used by every motion template. */

import { clamp01 } from '../lib/utils';

export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutElastic = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
};

/** Fade in over `inDur`, hold, fade out over `outDur`. */
export function envelope(t: number, duration: number, inDur = 0.25, outDur = 0.3): number {
  const a = inDur > 0 ? clamp01(t / inDur) : 1;
  const b = outDur > 0 ? clamp01((duration - t) / outDur) : 1;
  return Math.min(easeOutCubic(a), easeOutCubic(b));
}

export function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight: number | string = 800,
  italic = false,
) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px Inter, "Segoe UI", system-ui, sans-serif`;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

export function shadow(ctx: CanvasRenderingContext2D, color: string, blur: number, dy = 0, dx = 0) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = dx;
  ctx.shadowOffsetY = dy;
}

export function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** Greedy word wrap. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}

/** Shrink the font until the whole block fits the given box. */
export function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  weight: number | string,
  maxLines = 3,
  minSize = 28,
): { lines: string[]; size: number } {
  let size = startSize;
  for (let guard = 0; guard < 40; guard++) {
    setFont(ctx, size, weight);
    const lines = wrapText(ctx, text, maxWidth);
    const widest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
    if ((lines.length <= maxLines && widest <= maxWidth) || size <= minSize) {
      return { lines, size };
    }
    size *= 0.93;
  }
  setFont(ctx, minSize, weight);
  return { lines: wrapText(ctx, text, maxWidth), size: minSize };
}

/** Text with an outline + drop shadow so it stays legible over any footage. */
export function punchyText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    shadowColor?: string;
    shadowBlur?: number;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
  } = {},
) {
  const {
    fill = '#ffffff',
    stroke = 'rgba(0,0,0,0.85)',
    strokeWidth = 10,
    shadowColor = 'rgba(0,0,0,0.5)',
    shadowBlur = 24,
    align = 'center',
    baseline = 'middle',
  } = opts;
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (strokeWidth > 0) {
    shadow(ctx, shadowColor, shadowBlur, shadowBlur * 0.25);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    clearShadow(ctx);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function linearGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: [number, string][],
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

export function radialGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: [number, string][],
): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

/** Star / spark shape used by burst stickers. */
export function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points = 4,
  rotation = 0,
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Slight hand-drawn wobble for marker-style stickers. */
export function wobble(rand: (i: number) => number, index: number, amount: number): number {
  return (rand(index) - 0.5) * 2 * amount;
}

export function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength = 0.5) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
