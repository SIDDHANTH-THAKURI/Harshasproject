/** Transition renderers. Each blends two full-frame draw callbacks. */

import { clamp01 } from '../lib/utils';
import type { TransitionType } from '../edit/types';

export type FrameDrawer = (ctx: CanvasRenderingContext2D) => void;

let scratchA: HTMLCanvasElement | null = null;
let scratchB: HTMLCanvasElement | null = null;

function scratch(which: 'a' | 'b', w: number, h: number): CanvasRenderingContext2D {
  let canvas = which === 'a' ? scratchA : scratchB;
  if (!canvas || canvas.width !== w || canvas.height !== h) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    if (which === 'a') scratchA = canvas;
    else scratchB = canvas;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

export function drawTransition(
  ctx: CanvasRenderingContext2D,
  type: TransitionType,
  progress: number,
  drawA: FrameDrawer,
  drawB: FrameDrawer,
  w: number,
  h: number,
  rand: (i: number) => number,
): void {
  const p = clamp01(progress);

  switch (type) {
    case 'dissolve': {
      drawA(ctx);
      ctx.save();
      ctx.globalAlpha = p;
      drawB(ctx);
      ctx.restore();
      return;
    }

    case 'flash': {
      if (p < 0.5) drawA(ctx);
      else drawB(ctx);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,255,255,${Math.sin(p * Math.PI) * 0.92})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return;
    }

    case 'zoom-punch': {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      const sa = 1 + p * 0.35;
      ctx.scale(sa, sa);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = 1 - p * 0.9;
      drawA(ctx);
      ctx.restore();

      ctx.save();
      ctx.translate(w / 2, h / 2);
      const sb = 1.35 - p * 0.35;
      ctx.scale(sb, sb);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = Math.min(1, p * 1.6);
      drawB(ctx);
      ctx.restore();
      return;
    }

    case 'whip': {
      const shift = w * 0.75;
      const blur = Math.sin(p * Math.PI) * 26;
      ctx.save();
      ctx.filter = `blur(${blur.toFixed(1)}px)`;
      ctx.save();
      ctx.translate(-shift * p, 0);
      drawA(ctx);
      ctx.restore();
      ctx.save();
      ctx.translate(shift * (1 - p), 0);
      drawB(ctx);
      ctx.restore();
      ctx.restore();
      ctx.filter = 'none';
      return;
    }

    case 'glitch': {
      const a = scratch('a', w, h);
      const b = scratch('b', w, h);
      drawA(a);
      drawB(b);
      ctx.drawImage(a.canvas, 0, 0);
      const slices = 14;
      for (let i = 0; i < slices; i++) {
        const sliceH = h / slices;
        const y = i * sliceH;
        const show = rand(i + Math.floor(p * 8) * 7) < p * 1.25;
        const offset = (rand(i * 3 + 1) - 0.5) * w * 0.35 * (1 - Math.abs(p - 0.5) * 1.6);
        if (show) {
          ctx.drawImage(b.canvas, 0, y, w, sliceH, offset, y, w, sliceH);
        } else if (Math.abs(p - 0.5) < 0.35) {
          ctx.drawImage(a.canvas, 0, y, w, sliceH, offset * 0.6, y, w, sliceH);
        }
      }
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.22 * Math.sin(p * Math.PI);
      ctx.drawImage(b.canvas, -14, 0);
      ctx.fillStyle = 'rgba(255,0,90,0.25)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return;
    }

    case 'cut':
    default: {
      if (p < 0.5) drawA(ctx);
      else drawB(ctx);
    }
  }
}
