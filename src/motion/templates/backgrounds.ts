/** Full-frame backgrounds and "look" overlays that sit on top of footage. */

import { withAlpha } from '../../lib/color';
import { clamp01 } from '../../lib/utils';
import { envelope, linearGradient, radialGradient, setFont, vignette } from '../draw';
import type { MotionTemplate } from '../types';
import { bool, num, str } from '../types';

export const BACKGROUND_TEMPLATES: MotionTemplate[] = [
  {
    id: 'bg-gradient-flow',
    name: 'Gradient Flow',
    category: 'background',
    description: 'Slow-drifting colour blobs. Use it behind text-only moments.',
    tags: ['minimal', 'calm', 'abstract'],
    keywords: ['gradient', 'background', 'blob', 'mesh', 'abstract', 'plate', 'backdrop', 'smooth'],
    energy: 1,
    duration: 6,
    placement: 'full',
    params: [
      { key: 'accent', label: 'Colour A', kind: 'color', default: '#7c5cff' },
      { key: 'accent2', label: 'Colour B', kind: 'color', default: '#ff3d81' },
      { key: 'base', label: 'Base', kind: 'color', default: '#06060b' },
      { key: 'opacity', label: 'Opacity', kind: 'number', default: 1, min: 0.1, max: 1, step: 0.05 },
    ],
    draw({ ctx, t, w, h, params }) {
      const a = str(params, 'accent', '#7c5cff');
      const b = str(params, 'accent2', '#ff3d81');
      const base = str(params, 'base', '#06060b');
      ctx.save();
      ctx.globalAlpha = num(params, 'opacity', 1);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const blobs: [string, number, number, number][] = [
        [a, 0.3 + Math.sin(t * 0.42) * 0.16, 0.3 + Math.cos(t * 0.31) * 0.14, 0.62],
        [b, 0.72 + Math.cos(t * 0.37) * 0.15, 0.6 + Math.sin(t * 0.29) * 0.16, 0.56],
        [a, 0.5 + Math.sin(t * 0.23 + 2) * 0.22, 0.82 + Math.cos(t * 0.19) * 0.1, 0.48],
      ];
      for (const [color, x, y, r] of blobs) {
        ctx.fillStyle = radialGradient(ctx, w * x, h * y, w * r, [
          [0, withAlpha(color, 0.55)],
          [0.5, withAlpha(color, 0.18)],
          [1, 'rgba(0,0,0,0)'],
        ]);
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = 'source-over';
      vignette(ctx, w, h, 0.45);
      ctx.restore();
    },
  },
  {
    id: 'bg-particle-field',
    name: 'Particle Field',
    category: 'background',
    description: 'Drifting dust with depth. Quiet enough to put copy on top of.',
    tags: ['abstract', 'calm', 'tech'],
    keywords: ['particles', 'dust', 'stars', 'field', 'background', 'space', 'ambient', 'floating'],
    energy: 1,
    duration: 8,
    placement: 'full',
    params: [
      { key: 'accent', label: 'Particle colour', kind: 'color', default: '#9b83ff' },
      { key: 'base', label: 'Base', kind: 'color', default: '#07070e' },
      { key: 'count', label: 'Density', kind: 'number', default: 90, min: 20, max: 220, step: 5 },
      { key: 'opacity', label: 'Opacity', kind: 'number', default: 1, min: 0.1, max: 1, step: 0.05 },
    ],
    draw({ ctx, t, w, h, params, rand }) {
      const accent = str(params, 'accent', '#9b83ff');
      const base = str(params, 'base', '#07070e');
      const count = Math.round(num(params, 'count', 90));
      ctx.save();
      ctx.globalAlpha = num(params, 'opacity', 1);
      ctx.fillStyle = linearGradient(ctx, 0, 0, 0, h, [
        [0, base],
        [1, withAlpha(accent, 0.16)],
      ]);
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < count; i++) {
        const depth = 0.3 + rand(i) * 0.7;
        const x = ((rand(i + 7) + t * 0.012 * depth) % 1) * w;
        const y = ((rand(i + 31) - t * 0.035 * depth) % 1 + 1) % 1 * h;
        const r = 2 + depth * 7;
        ctx.globalAlpha = num(params, 'opacity', 1) * (0.16 + depth * 0.5);
        ctx.fillStyle = radialGradient(ctx, x, y, r * 3, [
          [0, withAlpha(accent, 0.9)],
          [1, 'rgba(0,0,0,0)'],
        ]);
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  },
  {
    id: 'look-vhs',
    name: 'VHS Look',
    category: 'look',
    description: 'Scanlines, tracking band and vignette. Ages footage instantly.',
    tags: ['retro', 'glitch', 'grain'],
    keywords: ['vhs', 'retro', 'scanline', 'tape', 'grain', 'analog', '90s', 'old', 'filter', 'look'],
    energy: 2,
    duration: 8,
    placement: 'full',
    params: [
      { key: 'strength', label: 'Strength', kind: 'number', default: 0.65, min: 0.1, max: 1, step: 0.05 },
      { key: 'tint', label: 'Tint', kind: 'color', default: '#4d7cff' },
      { key: 'timecode', label: 'Timecode', kind: 'toggle', default: true },
    ],
    draw({ ctx, t, w, h, params, rand }) {
      const s = num(params, 'strength', 0.65);
      const tint = str(params, 'tint', '#4d7cff');
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.18 * s;
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      ctx.globalAlpha = 0.16 * s;
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 2.4);

      const bandY = ((t * 0.26) % 1.4 - 0.2) * h;
      ctx.globalAlpha = 0.14 * s;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, bandY, w, 46);
      ctx.globalAlpha = 0.1 * s;
      for (let i = 0; i < 26; i++) {
        const y = bandY + rand(i + Math.floor(t * 8)) * 46;
        ctx.fillStyle = rand(i * 3) > 0.5 ? '#ff3d81' : '#22d3ee';
        ctx.fillRect(rand(i + 3) * w, y, 40 + rand(i + 9) * 160, 3);
      }

      ctx.globalAlpha = 1;
      vignette(ctx, w, h, 0.5 * s);
      if (bool(params, 'timecode', true)) {
        const total = Math.floor(t * 30);
        const tc = `${String(Math.floor(total / 1800)).padStart(2, '0')}:${String(
          Math.floor((total / 30) % 60),
        ).padStart(2, '0')}:${String(total % 30).padStart(2, '0')}`;
        setFont(ctx, 44, 700);
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(tc, w - 60, h * 0.1);
        ctx.textAlign = 'left';
        ctx.fillText('REC ●', 60, h * 0.1);
      }
      ctx.restore();
    },
  },
  {
    id: 'look-light-leak',
    name: 'Light Leak',
    category: 'look',
    description: 'Warm leak that sweeps across the frame. Softens hard cuts.',
    tags: ['warm', 'film', 'calm'],
    keywords: ['light', 'leak', 'flare', 'warm', 'film', 'sun', 'glow', 'look', 'filter', 'analog'],
    energy: 1,
    duration: 6,
    placement: 'full',
    params: [
      { key: 'accent', label: 'Leak colour', kind: 'color', default: '#ff8a3d' },
      { key: 'strength', label: 'Strength', kind: 'number', default: 0.7, min: 0.1, max: 1, step: 0.05 },
      { key: 'speed', label: 'Speed', kind: 'number', default: 1, min: 0.3, max: 2.5, step: 0.1 },
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const accent = str(params, 'accent', '#ff8a3d');
      const s = num(params, 'strength', 0.7);
      const speed = num(params, 'speed', 1);
      const p = clamp01((t * speed) / Math.max(0.5, duration));
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = s * envelope(t, duration, 0.4, 0.5);
      const x = (-0.3 + p * 1.6) * w;
      ctx.fillStyle = radialGradient(ctx, x, h * 0.32, w * 0.9, [
        [0, withAlpha(accent, 0.75)],
        [0.45, withAlpha(accent, 0.25)],
        [1, 'rgba(0,0,0,0)'],
      ]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = radialGradient(ctx, x + w * 0.25, h * 0.66, w * 0.5, [
        [0, 'rgba(255,255,255,0.45)'],
        [1, 'rgba(0,0,0,0)'],
      ]);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  },
  {
    id: 'look-cine-frame',
    name: 'Cine Frame',
    category: 'look',
    description: 'Corner ticks, focus box and a shot label — makes anything feel deliberate.',
    tags: ['minimal', 'editorial', 'clean'],
    keywords: ['frame', 'border', 'cinema', 'viewfinder', 'crosshair', 'label', 'shot', 'look', 'ui'],
    energy: 1,
    duration: 6,
    placement: 'full',
    params: [
      { key: 'label', label: 'Shot label', kind: 'text', default: 'SHOT 01 · 35MM', maxLength: 28 },
      { key: 'accent', label: 'Colour', kind: 'color', default: '#ffffff' },
      { key: 'opacity', label: 'Opacity', kind: 'number', default: 0.8, min: 0.2, max: 1, step: 0.05 },
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const label = str(params, 'label', '');
      const accent = str(params, 'accent', '#ffffff');
      ctx.save();
      ctx.globalAlpha = num(params, 'opacity', 0.8) * envelope(t, duration, 0.3, 0.3);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      const m = w * 0.07;
      const len = w * 0.08;
      const corners: [number, number, number, number][] = [
        [m, m, 1, 1],
        [w - m, m, -1, 1],
        [m, h - m, 1, -1],
        [w - m, h - m, -1, -1],
      ];
      for (const [x, y, sx, sy] of corners) {
        ctx.beginPath();
        ctx.moveTo(x, y + sy * len);
        ctx.lineTo(x, y);
        ctx.lineTo(x + sx * len, y);
        ctx.stroke();
      }
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 26 + Math.sin(t * 2) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2 - 46, h / 2);
      ctx.lineTo(w / 2 - 12, h / 2);
      ctx.moveTo(w / 2 + 12, h / 2);
      ctx.lineTo(w / 2 + 46, h / 2);
      ctx.stroke();
      if (label) {
        ctx.globalAlpha = num(params, 'opacity', 0.8) * envelope(t, duration, 0.3, 0.3);
        setFont(ctx, 36, 600);
        ctx.fillStyle = accent;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '5px';
        ctx.fillText(label.toUpperCase(), m, h - m - 36);
        ctx.letterSpacing = '0px';
      }
      ctx.restore();
    },
  },
];
