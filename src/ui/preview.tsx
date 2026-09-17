/** Live canvas previews for library assets, driven by one shared rAF ticker. */

import { useEffect, useRef } from 'react';
import { hashString, mulberry32 } from '../lib/utils';
import { SCENES } from '../media/scenes';
import { drawInstance, type AssetInstance } from '../motion/registry';
import { cn } from '../lib/utils';

type Tick = (nowMs: number) => void;

const subscribers = new Set<Tick>();
let rafId = 0;

function loop(now: number) {
  for (const fn of subscribers) fn(now);
  rafId = subscribers.size ? requestAnimationFrame(loop) : 0;
}

export function subscribeTick(fn: Tick): () => void {
  subscribers.add(fn);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}

const randCache = new Map<string, (i: number) => number>();
function sceneRand(id: string): (i: number) => number {
  let fn = randCache.get(id);
  if (!fn) {
    const rng = mulberry32(hashString(id));
    const values = Array.from({ length: 1024 }, () => rng());
    fn = (i: number) => values[((i % 1024) + 1024) % 1024];
    randCache.set(id, fn);
  }
  return fn;
}

const backdrops = new Map<string, HTMLCanvasElement>();

/** A still frame of a generated scene, cached, used as "footage" behind asset previews. */
export function getBackdrop(seed: number, width: number, height: number): HTMLCanvasElement {
  const scene = SCENES[Math.abs(seed) % SCENES.length];
  const key = `${scene.id}:${width}x${height}`;
  const hit = backdrops.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.save();
  ctx.scale(width / 1080, height / 1920);
  scene.draw(ctx, scene.highlights[0] ?? 1, 1080, 1920, sceneRand(scene.id));
  ctx.restore();
  // Knock the footage back so graphics stay readable in a small card.
  ctx.fillStyle = 'rgba(6,6,11,0.32)';
  ctx.fillRect(0, 0, width, height);
  backdrops.set(key, canvas);
  return canvas;
}

export function AssetPreview({
  instance,
  className,
  backdropSeed = 0,
  playing = true,
  fps = 24,
  showBackdrop = true,
}: {
  instance: Pick<AssetInstance, 'templateId' | 'params' | 'duration'>;
  className?: string;
  backdropSeed?: number;
  playing?: boolean;
  fps?: number;
  showBackdrop?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef(instance);
  instanceRef.current = instance;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameAt = 0;
    const start = performance.now();
    const interval = 1000 / fps;

    const render = (now: number) => {
      if (playing && now - frameAt < interval) return;
      frameAt = now;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(2, Math.round(rect.width * dpr));
      const h = Math.max(2, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (showBackdrop) {
        ctx.drawImage(getBackdrop(backdropSeed, 216, 384), 0, 0, w, h);
      } else {
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, w, h);
      }
      const current = instanceRef.current;
      const duration = current.duration || 2.5;
      const t = playing ? ((now - start) / 1000) % duration : duration * 0.45;
      drawInstance(ctx, current, { width: w, height: h, t, duration });
    };

    render(performance.now());
    if (!playing) return;
    return subscribeTick(render);
  }, [playing, fps, backdropSeed, showBackdrop, instance.templateId]);

  return <canvas ref={ref} className={cn('h-full w-full', className)} />;
}
