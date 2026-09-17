/** Stickers, emphasis marks and end cards. */

import { readableOn, withAlpha } from '../../lib/color';
import { clamp01, lerp } from '../../lib/utils';
import {
  clearShadow,
  easeOutBack,
  easeOutCubic,
  easeOutExpo,
  envelope,
  fitLines,
  radialGradient,
  roundRect,
  setFont,
  shadow,
  starPath,
  wobble,
} from '../draw';
import type { MotionTemplate } from '../types';
import { bool, num, str } from '../types';

export const STICKER_TEMPLATES: MotionTemplate[] = [
  {
    id: 'sticker-arrow-scribble',
    name: 'Scribble Arrow',
    category: 'sticker',
    description: 'Hand-drawn arrow that draws itself in and wiggles. Points at whatever matters.',
    tags: ['handdrawn', 'punchy', 'tutorial'],
    keywords: ['arrow', 'point', 'scribble', 'draw', 'highlight', 'this', 'look', 'tutorial', 'marker'],
    energy: 2,
    duration: 1.8,
    placement: 'peak',
    params: [
      { key: 'accent', label: 'Colour', kind: 'color', default: '#ffcc00' },
      {
        key: 'dir',
        label: 'Points',
        kind: 'select',
        default: 'down',
        options: [
          { value: 'down', label: 'Down' },
          { value: 'up', label: 'Up' },
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
      },
      { key: 'x', label: 'Horizontal position', kind: 'number', default: 0.5, min: 0.1, max: 0.9, step: 0.01 },
      { key: 'y', label: 'Vertical position', kind: 'number', default: 0.5, min: 0.12, max: 0.86, step: 0.01 },
      { key: 'scale', label: 'Size', kind: 'number', default: 1, min: 0.5, max: 1.8, step: 0.05 },
    ],
    draw({ ctx, t, duration, w, h, params, rand }) {
      const accent = str(params, 'accent', '#ffcc00');
      const dir = str(params, 'dir', 'down');
      const cx = w * num(params, 'x', 0.5);
      const cy = h * num(params, 'y', 0.5);
      const scale = num(params, 'scale', 1);
      const grow = easeOutCubic(clamp01(t / 0.55));
      const rot = { down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[dir] ?? 0;
      const len = 330 * scale;

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.1, 0.3);
      ctx.translate(cx, cy);
      ctx.rotate(rot + Math.sin(t * 5) * 0.035);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 20 * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      shadow(ctx, 'rgba(0,0,0,0.5)', 18, 6);

      const steps = 34;
      const upto = Math.max(1, Math.floor(steps * grow));
      ctx.beginPath();
      for (let i = 0; i <= upto; i++) {
        const s = i / steps;
        const x = Math.sin(s * Math.PI * 1.4) * 70 * scale + wobble(rand, i, 5 * scale);
        const y = -len / 2 + s * len + wobble(rand, i + 40, 4 * scale);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (grow > 0.82) {
        const headP = clamp01((grow - 0.82) / 0.18);
        const tipX = Math.sin(Math.PI * 1.4) * 70 * scale;
        const tipY = len / 2;
        ctx.beginPath();
        ctx.moveTo(tipX - 62 * scale * headP, tipY - 70 * scale * headP);
        ctx.lineTo(tipX, tipY);
        ctx.lineTo(tipX + 78 * scale * headP, tipY - 52 * scale * headP);
        ctx.stroke();
      }
      clearShadow(ctx);
      ctx.restore();
    },
  },
  {
    id: 'sticker-circle-highlight',
    name: 'Marker Circle',
    category: 'sticker',
    description: 'Marker loop drawn around a detail, with a second scruffy pass.',
    tags: ['handdrawn', 'tutorial', 'minimal'],
    keywords: ['circle', 'highlight', 'marker', 'ring', 'emphasis', 'focus', 'annotate', 'this'],
    energy: 2,
    duration: 2,
    placement: 'peak',
    params: [
      { key: 'accent', label: 'Colour', kind: 'color', default: '#ff3d81' },
      { key: 'x', label: 'Horizontal position', kind: 'number', default: 0.5, min: 0.1, max: 0.9, step: 0.01 },
      { key: 'y', label: 'Vertical position', kind: 'number', default: 0.45, min: 0.12, max: 0.86, step: 0.01 },
      { key: 'rx', label: 'Width', kind: 'number', default: 0.34, min: 0.12, max: 0.6, step: 0.01 },
      { key: 'ry', label: 'Height', kind: 'number', default: 0.13, min: 0.05, max: 0.4, step: 0.01 },
    ],
    draw({ ctx, t, duration, w, h, params, rand }) {
      const accent = str(params, 'accent', '#ff3d81');
      const cx = w * num(params, 'x', 0.5);
      const cy = h * num(params, 'y', 0.45);
      const rx = w * num(params, 'rx', 0.34);
      const ry = h * num(params, 'ry', 0.13);
      const draw1 = easeOutCubic(clamp01(t / 0.5));
      const draw2 = easeOutCubic(clamp01((t - 0.28) / 0.55));

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.08, 0.35);
      ctx.translate(cx, cy);
      ctx.rotate(-0.06);
      ctx.strokeStyle = accent;
      ctx.lineCap = 'round';
      shadow(ctx, 'rgba(0,0,0,0.45)', 16, 5);

      const pass = (progress: number, width: number, offset: number, alpha: number) => {
        if (progress <= 0) return;
        ctx.globalAlpha = envelope(t, duration, 0.08, 0.35) * alpha;
        ctx.lineWidth = width;
        ctx.beginPath();
        const steps = 60;
        const total = Math.PI * 2 * 1.08;
        for (let i = 0; i <= steps * progress; i++) {
          const a = -0.5 + (i / steps) * total;
          const x = Math.cos(a) * (rx + wobble(rand, i + offset, 9));
          const y = Math.sin(a) * (ry + wobble(rand, i + offset + 90, 7));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      pass(draw1, 16, 0, 1);
      pass(draw2, 10, 200, 0.55);
      clearShadow(ctx);
      ctx.restore();
    },
  },
  {
    id: 'sticker-spark-burst',
    name: 'Spark Burst',
    category: 'sticker',
    description: 'Sparks fly out of a flash. Drop it on the moment that hits hardest.',
    tags: ['punchy', 'hype', 'celebration'],
    keywords: ['burst', 'spark', 'confetti', 'explode', 'hit', 'impact', 'celebrate', 'wow', 'particles'],
    energy: 3,
    duration: 1.4,
    placement: 'peak',
    params: [
      { key: 'accent', label: 'Colour', kind: 'color', default: '#ffcc00' },
      { key: 'accent2', label: 'Second colour', kind: 'color', default: '#ff3d81' },
      { key: 'count', label: 'Sparks', kind: 'number', default: 18, min: 6, max: 40, step: 1 },
      { key: 'x', label: 'Horizontal position', kind: 'number', default: 0.5, min: 0.05, max: 0.95, step: 0.01 },
      { key: 'y', label: 'Vertical position', kind: 'number', default: 0.45, min: 0.08, max: 0.92, step: 0.01 },
    ],
    draw({ ctx, t, duration, w, h, params, rand }) {
      const accent = str(params, 'accent', '#ffcc00');
      const accent2 = str(params, 'accent2', '#ff3d81');
      const count = Math.round(num(params, 'count', 18));
      const cx = w * num(params, 'x', 0.5);
      const cy = h * num(params, 'y', 0.45);
      const p = clamp01(t / duration);
      const out = easeOutExpo(p);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = 'lighter';
      const flash = Math.pow(1 - clamp01(t / 0.22), 2);
      if (flash > 0.01) {
        ctx.fillStyle = radialGradient(ctx, 0, 0, w * 0.35, [
          [0, withAlpha('#ffffff', 0.9 * flash)],
          [0.4, withAlpha(accent, 0.5 * flash)],
          [1, 'rgba(0,0,0,0)'],
        ]);
        ctx.fillRect(-w, -h, w * 2, h * 2);
      }
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rand(i) * 0.5;
        const dist = lerp(40, w * (0.22 + rand(i + 50) * 0.3), out);
        const size = (16 + rand(i + 99) * 26) * (1 - p * 0.55);
        const alpha = Math.pow(1 - p, 1.6);
        ctx.save();
        ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist * 0.92);
        ctx.rotate(angle + t * 4);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i % 3 === 0 ? accent2 : accent;
        shadow(ctx, i % 3 === 0 ? accent2 : accent, 26);
        starPath(ctx, 0, 0, size, size * 0.32, 4, 0);
        ctx.fill();
        ctx.restore();
      }
      clearShadow(ctx);
      ctx.restore();
    },
  },
  {
    id: 'sticker-progress-bar',
    name: 'Retention Bar',
    category: 'sticker',
    description: 'Thin progress bar pinned to the top — the classic "stay to the end" trick.',
    tags: ['minimal', 'utility', 'retention'],
    keywords: ['progress', 'bar', 'timer', 'retention', 'loading', 'top', 'watch', 'time'],
    energy: 1,
    duration: 8,
    placement: 'full',
    params: [
      { key: 'accent', label: 'Colour', kind: 'color', default: '#2fe6a8' },
      { key: 'y', label: 'Vertical position', kind: 'number', default: 0.06, min: 0.02, max: 0.95, step: 0.01 },
      { key: 'thick', label: 'Thickness', kind: 'number', default: 12, min: 4, max: 28, step: 1 },
      { key: 'ticks', label: 'Chapter ticks', kind: 'toggle', default: true },
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const accent = str(params, 'accent', '#2fe6a8');
      const y = h * num(params, 'y', 0.06);
      const thick = num(params, 'thick', 12);
      const ticks = bool(params, 'ticks', true);
      const p = clamp01(t / duration);
      const margin = w * 0.06;
      const barW = w - margin * 2;

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.3, 0.3);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(ctx, margin, y, barW, thick, thick / 2);
      ctx.fill();
      if (ticks) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 1; i < 4; i++) {
          ctx.fillRect(margin + (barW * i) / 4 - 1.5, y - 3, 3, thick + 6);
        }
      }
      shadow(ctx, accent, 22);
      ctx.fillStyle = accent;
      roundRect(ctx, margin, y, Math.max(thick, barW * p), thick, thick / 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(margin + barW * p, y + thick / 2, thick * 0.92, 0, Math.PI * 2);
      ctx.fill();
      clearShadow(ctx);
      ctx.restore();
    },
  },
  {
    id: 'sticker-stat-counter',
    name: 'Stat Counter',
    category: 'sticker',
    description: 'Number that counts up inside a chip. Sales, followers, days — any proof point.',
    tags: ['bold', 'product', 'data'],
    keywords: ['stat', 'counter', 'number', 'count', 'metric', 'sales', 'followers', 'revenue', 'proof'],
    energy: 2,
    duration: 2.4,
    placement: 'peak',
    params: [
      { key: 'value', label: 'Value', kind: 'number', default: 12400, min: 0, max: 10000000, step: 1 },
      { key: 'prefix', label: 'Prefix', kind: 'text', default: '+', maxLength: 6 },
      { key: 'suffix', label: 'Suffix', kind: 'text', default: '', maxLength: 6 },
      { key: 'label', label: 'Label', kind: 'text', default: 'ORDERS THIS WEEK', maxLength: 32 },
      { key: 'accent', label: 'Colour', kind: 'color', default: '#2fe6a8' },
      { key: 'y', label: 'Vertical position', kind: 'number', default: 0.34, min: 0.12, max: 0.86, step: 0.01 },
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const value = num(params, 'value', 0);
      const prefix = str(params, 'prefix', '');
      const suffix = str(params, 'suffix', '');
      const label = str(params, 'label', '');
      const accent = str(params, 'accent', '#2fe6a8');
      const cy = h * num(params, 'y', 0.34);
      const p = easeOutExpo(clamp01(t / (duration * 0.6)));
      const shown = Math.round(value * p);
      const text = `${prefix}${shown.toLocaleString('en-US')}${suffix}`;
      const pop = easeOutBack(clamp01(t / 0.38));

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.12, 0.3);
      ctx.translate(w / 2, cy);
      ctx.scale(pop, pop);
      const { size } = fitLines(ctx, text, w * 0.66, 148, 900, 1, 60);
      setFont(ctx, size, 900);
      const tw = ctx.measureText(text).width;
      setFont(ctx, size * 0.26, 700);
      const lw = label ? ctx.measureText(label).width : 0;
      const boxW = Math.max(tw, lw) + size * 0.7;
      const boxH = size * (label ? 1.72 : 1.3);

      ctx.fillStyle = 'rgba(8,8,14,0.78)';
      roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, size * 0.22);
      ctx.fill();
      ctx.strokeStyle = withAlpha(accent, 0.55);
      ctx.lineWidth = 3;
      ctx.stroke();

      setFont(ctx, size, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      shadow(ctx, withAlpha(accent, 0.6), 26);
      ctx.fillStyle = accent;
      ctx.fillText(text, 0, label ? -size * 0.26 : 0);
      clearShadow(ctx);
      if (label) {
        setFont(ctx, size * 0.26, 700);
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.letterSpacing = '4px';
        ctx.fillText(label, 0, size * 0.52);
        ctx.letterSpacing = '0px';
      }
      ctx.restore();
    },
  },
  {
    id: 'cta-follow',
    name: 'Follow Card',
    category: 'cta',
    description: 'End card with avatar, handle and a pulsing follow button.',
    tags: ['creator', 'bold', 'cta'],
    keywords: ['follow', 'cta', 'end card', 'outro', 'subscribe', 'part 2', 'handle', 'profile'],
    energy: 2,
    duration: 2.8,
    placement: 'close',
    params: [
      { key: 'handle', label: 'Handle', kind: 'text', default: '@cutbeat', maxLength: 24 },
      { key: 'line', label: 'Line', kind: 'text', default: 'FOLLOW FOR PART 2', maxLength: 32 },
      { key: 'accent', label: 'Colour', kind: 'color', default: '#7c5cff' },
      { key: 'y', label: 'Vertical position', kind: 'number', default: 0.5, min: 0.2, max: 0.8, step: 0.01 },
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const handle = str(params, 'handle', '@you');
      const line = str(params, 'line', '').toUpperCase();
      const accent = str(params, 'accent', '#7c5cff');
      const cy = h * num(params, 'y', 0.5);
      const pop = easeOutBack(clamp01(t / 0.45));
      const pulse = 1 + Math.sin(t * 5.2) * 0.035;

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.12, 0.3);
      ctx.translate(w / 2, cy);
      ctx.scale(pop, pop);

      const r = 96;
      ctx.fillStyle = radialGradient(ctx, 0, -230, r * 1.6, [
        [0, withAlpha(accent, 0.55)],
        [1, 'rgba(0,0,0,0)'],
      ]);
      ctx.fillRect(-w / 2, -430, w, 400);
      ctx.beginPath();
      ctx.arc(0, -230, r, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      setFont(ctx, r, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = readableOn(accent);
      ctx.fillText((handle.replace('@', '')[0] ?? 'C').toUpperCase(), 0, -226);

      setFont(ctx, 62, 700);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(handle, 0, -96);

      const bw = 520 * pulse;
      const bh = 132 * pulse;
      shadow(ctx, withAlpha(accent, 0.75), 40, 12);
      ctx.fillStyle = accent;
      roundRect(ctx, -bw / 2, 10, bw, bh, bh / 2);
      ctx.fill();
      clearShadow(ctx);
      const { size } = fitLines(ctx, line || 'FOLLOW', bw * 0.84, 56, 900, 1, 28);
      setFont(ctx, size, 900);
      ctx.fillStyle = readableOn(accent);
      ctx.fillText(line || 'FOLLOW', 0, 10 + bh / 2);

      const ring = (t % 1.6) / 1.6;
      ctx.globalAlpha *= (1 - ring) * 0.55;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      roundRect(ctx, -bw / 2 - 30 * ring, 10 - 30 * ring, bw + 60 * ring, bh + 60 * ring, (bh + 60 * ring) / 2);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'cta-link-pill',
    name: 'Link In Bio',
    category: 'cta',
    description: 'Pill button with a shine sweep and a nudging arrow.',
    tags: ['product', 'clean', 'cta'],
    keywords: ['link', 'bio', 'shop', 'buy', 'swipe', 'cta', 'button', 'offer', 'sale'],
    energy: 2,
    duration: 2.6,
    placement: 'close',
    params: [
      { key: 'text', label: 'Button text', kind: 'text', default: 'LINK IN BIO', maxLength: 26 },
      { key: 'sub', label: 'Sub-line', kind: 'text', default: '30% off ends tonight', maxLength: 40 },
      { key: 'accent', label: 'Colour', kind: 'color', default: '#ffffff' },
      { key: 'y', label: 'Vertical position', kind: 'number', default: 0.72, min: 0.2, max: 0.86, step: 0.01 },
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const text = str(params, 'text', 'LINK IN BIO').toUpperCase();
      const sub = str(params, 'sub', '');
      const accent = str(params, 'accent', '#ffffff');
      const cy = h * num(params, 'y', 0.72);
      const pop = easeOutBack(clamp01(t / 0.4));
      const bob = Math.sin(t * 4) * 8;

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.12, 0.28);
      ctx.translate(w / 2, cy);
      ctx.scale(pop, pop);

      setFont(ctx, 58, 900);
      const tw = ctx.measureText(text).width;
      const bw = tw + 190;
      const bh = 142;
      ctx.fillStyle = accent;
      shadow(ctx, 'rgba(0,0,0,0.5)', 34, 14);
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
      ctx.fill();
      clearShadow(ctx);

      ctx.save();
      roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2);
      ctx.clip();
      const sweep = ((t % 1.8) / 1.8) * (bw + 300) - 150;
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.translate(-bw / 2 + sweep, 0);
      ctx.rotate(-0.4);
      ctx.fillRect(-40, -bh, 80, bh * 2);
      ctx.restore();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      setFont(ctx, 58, 900);
      ctx.fillStyle = readableOn(accent);
      ctx.fillText(text, -26, 2);
      ctx.beginPath();
      ctx.moveTo(tw / 2 + 24, -18);
      ctx.lineTo(tw / 2 + 62, 2);
      ctx.lineTo(tw / 2 + 24, 22);
      ctx.closePath();
      ctx.fill();

      if (sub) {
        setFont(ctx, 42, 600);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        shadow(ctx, 'rgba(0,0,0,0.6)', 18, 4);
        ctx.fillText(sub, 0, bh / 2 + 52 + bob * 0.3);
        clearShadow(ctx);
      }
      ctx.restore();
    },
  },
];
