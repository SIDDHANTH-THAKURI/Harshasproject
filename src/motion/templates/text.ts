/** Hooks, captions and lower thirds. */

import { readableOn, withAlpha } from '../../lib/color';
import { clamp, clamp01, lerp } from '../../lib/utils';
import {
  clearShadow,
  easeOutBack,
  easeOutExpo,
  envelope,
  fitLines,
  linearGradient,
  punchyText,
  roundRect,
  setFont,
  shadow,
} from '../draw';
import type { MotionTemplate, ParamSpec } from '../types';
import { bool, num, str } from '../types';

const yParam = (def: number): ParamSpec => ({
  key: 'y',
  label: 'Vertical position',
  kind: 'number',
  default: def,
  min: 0.12,
  max: 0.86,
  step: 0.01,
  hint: 'Keep between 0.15 and 0.78 to dodge platform UI',
});

const accentParam = (def = '#7c5cff'): ParamSpec => ({
  key: 'accent',
  label: 'Accent',
  kind: 'color',
  default: def,
});

export const TEXT_TEMPLATES: MotionTemplate[] = [
  {
    id: 'hook-punch-title',
    name: 'Punch Title',
    category: 'hook',
    description: 'Heavy uppercase title that slams in with a shake and an angled accent bar.',
    tags: ['bold', 'punchy', 'viral'],
    keywords: ['title', 'hook', 'headline', 'intro', 'text', 'slam', 'impact', 'opener'],
    energy: 3,
    duration: 2.2,
    placement: 'open',
    params: [
      { key: 'text', label: 'Headline', kind: 'text', default: 'NOBODY TELLS YOU THIS', maxLength: 64 },
      accentParam('#ff3d81'),
      {
        key: 'bar',
        label: 'Accent bar',
        kind: 'select',
        default: 'behind',
        options: [
          { value: 'behind', label: 'Behind text' },
          { value: 'under', label: 'Underline' },
          { value: 'none', label: 'None' },
        ],
      },
      yParam(0.4),
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const text = str(params, 'text', 'HEADLINE').toUpperCase();
      const accent = str(params, 'accent', '#ff3d81');
      const bar = str(params, 'bar', 'behind');
      const cy = h * num(params, 'y', 0.4);
      const inT = clamp01(t / 0.32);
      const scale = lerp(1.32, 1, easeOutExpo(inT));
      const alpha = envelope(t, duration, 0.14, 0.3);
      const shakeAmt = Math.max(0, 1 - t / 0.45);
      const { lines, size } = fitLines(ctx, text, w * 0.82, 132, 900, 3, 48);
      const lineH = size * 1.06;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2 + Math.sin(t * 52) * 7 * shakeAmt, cy + Math.cos(t * 44) * 5 * shakeAmt);
      ctx.scale(scale, scale);
      setFont(ctx, size, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      lines.forEach((line, i) => {
        const y = (i - (lines.length - 1) / 2) * lineH;
        const tw = ctx.measureText(line).width;
        const wipe = clamp01((inT - i * 0.12) / 0.55);
        if (bar === 'behind') {
          ctx.save();
          ctx.translate(0, y);
          ctx.rotate(-0.022);
          ctx.fillStyle = accent;
          const bw = (tw + size * 0.42) * easeOutExpo(wipe);
          roundRect(ctx, -bw / 2, -size * 0.52, bw, size * 1.02, size * 0.1);
          ctx.fill();
          ctx.restore();
        }
        punchyText(ctx, line, 0, y, {
          fill: bar === 'behind' ? readableOn(accent) : '#ffffff',
          strokeWidth: bar === 'behind' ? 0 : size * 0.1,
          shadowBlur: 30,
        });
        if (bar === 'under') {
          ctx.fillStyle = accent;
          const bw = tw * easeOutExpo(wipe);
          roundRect(ctx, -bw / 2, y + size * 0.52, bw, size * 0.13, size * 0.07);
          ctx.fill();
        }
      });
      ctx.restore();
    },
  },
  {
    id: 'hook-neon-sign',
    name: 'Neon Sign',
    category: 'hook',
    description: 'Glowing neon lettering with a flicker-on and a buzzing underline.',
    tags: ['neon', 'glow', 'night'],
    keywords: ['neon', 'glow', 'sign', 'flicker', 'title', 'club', 'cyberpunk', 'retro'],
    energy: 2,
    duration: 2.6,
    placement: 'open',
    params: [
      { key: 'text', label: 'Headline', kind: 'text', default: 'OPEN LATE', maxLength: 40 },
      accentParam('#ff2e88'),
      { key: 'glow2', label: 'Secondary glow', kind: 'color', default: '#22d3ee' },
      yParam(0.42),
    ],
    draw({ ctx, t, duration, w, h, params, rand }) {
      const text = str(params, 'text', 'NEON').toUpperCase();
      const accent = str(params, 'accent', '#ff2e88');
      const glow2 = str(params, 'glow2', '#22d3ee');
      const cy = h * num(params, 'y', 0.42);
      const flickerPhase = clamp01(t / 0.7);
      const flicker =
        flickerPhase < 1
          ? rand(Math.floor(t * 22)) > 0.35 - flickerPhase * 0.35
            ? 1
            : 0.15
          : 0.92 + Math.sin(t * 9) * 0.08;
      const alpha = envelope(t, duration, 0.05, 0.4) * flicker;
      const { lines, size } = fitLines(ctx, text, w * 0.78, 150, 800, 2, 56);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2, cy);
      setFont(ctx, size, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((line, i) => {
        const y = (i - (lines.length - 1) / 2) * size * 1.12;
        shadow(ctx, accent, 46);
        ctx.lineWidth = size * 0.055;
        ctx.strokeStyle = accent;
        ctx.strokeText(line, 0, y);
        shadow(ctx, glow2, 26);
        ctx.strokeStyle = withAlpha(glow2, 0.7);
        ctx.lineWidth = size * 0.02;
        ctx.strokeText(line, 0, y);
        clearShadow(ctx);
        ctx.fillStyle = '#fff6ff';
        ctx.fillText(line, 0, y);
      });
      const uw = w * 0.52 * easeOutExpo(clamp01(t / 0.9));
      shadow(ctx, accent, 34);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-uw / 2, size * 0.92 * lines.length);
      ctx.lineTo(uw / 2, size * 0.92 * lines.length);
      ctx.stroke();
      clearShadow(ctx);
      ctx.restore();
    },
  },
  {
    id: 'hook-split-reveal',
    name: 'Split Reveal',
    category: 'hook',
    description: 'Two panels slide apart to reveal the headline sitting in the gap.',
    tags: ['minimal', 'clean', 'editorial'],
    keywords: ['split', 'reveal', 'slide', 'open', 'title', 'clean', 'minimal', 'intro'],
    energy: 2,
    duration: 2.4,
    placement: 'open',
    params: [
      { key: 'text', label: 'Headline', kind: 'text', default: 'HOW I EDIT IN 60s', maxLength: 48 },
      { key: 'kicker', label: 'Kicker', kind: 'text', default: 'no plugins', maxLength: 28 },
      accentParam('#ffffff'),
      yParam(0.45),
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const text = str(params, 'text', 'HEADLINE').toUpperCase();
      const kicker = str(params, 'kicker', '');
      const accent = str(params, 'accent', '#ffffff');
      const cy = h * num(params, 'y', 0.45);
      const open = easeOutExpo(clamp01(t / 0.6));
      const alpha = envelope(t, duration, 0.1, 0.35);
      const { lines, size } = fitLines(ctx, text, w * 0.8, 116, 900, 3, 48);
      const blockH = lines.length * size * 1.1 + (kicker ? size * 0.75 : 0) + size * 0.5;

      ctx.save();
      ctx.globalAlpha = alpha;
      const gap = blockH * open;
      ctx.fillStyle = 'rgba(6,6,11,0.82)';
      ctx.fillRect(0, cy - blockH / 2 - h, w, h - gap / 2 + blockH / 2);
      ctx.fillRect(0, cy + gap / 2, w, h);
      ctx.fillStyle = accent;
      ctx.fillRect(0, cy - gap / 2 - 5, w, 5);
      ctx.fillRect(0, cy + gap / 2, w, 5);

      ctx.globalAlpha = alpha * clamp01((open - 0.55) / 0.45);
      ctx.translate(w / 2, cy);
      setFont(ctx, size, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const startY = -((lines.length - 1) / 2) * size * 1.1 - (kicker ? size * 0.3 : 0);
      lines.forEach((line, i) => {
        punchyText(ctx, line, 0, startY + i * size * 1.1, { fill: '#ffffff', strokeWidth: 0, shadowBlur: 18 });
      });
      if (kicker) {
        setFont(ctx, size * 0.34, 600);
        ctx.fillStyle = withAlpha(accent, 0.85);
        ctx.letterSpacing = '6px';
        ctx.fillText(kicker.toUpperCase(), 0, startY + lines.length * size * 1.1 + size * 0.18);
        ctx.letterSpacing = '0px';
      }
      ctx.restore();
    },
  },
  {
    id: 'hook-countdown',
    name: 'Countdown Ring',
    category: 'hook',
    description: 'Big 3-2-1 countdown with a sweeping ring and a snap on each beat.',
    tags: ['bold', 'countdown', 'sports'],
    keywords: ['countdown', 'timer', '321', 'three', 'ring', 'start', 'race', 'clock'],
    energy: 3,
    duration: 3,
    placement: 'open',
    params: [
      { key: 'from', label: 'Count from', kind: 'number', default: 3, min: 2, max: 9, step: 1 },
      { key: 'label', label: 'Label', kind: 'text', default: 'LET’S GO', maxLength: 24 },
      accentParam('#2fe6a8'),
      yParam(0.44),
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const from = Math.round(num(params, 'from', 3));
      const accent = str(params, 'accent', '#2fe6a8');
      const label = str(params, 'label', '');
      const cy = h * num(params, 'y', 0.44);
      const step = duration / (from + 0.35);
      const idx = Math.min(from - 1, Math.floor(t / step));
      const local = (t - idx * step) / step;
      const value = from - idx;
      const done = t >= from * step;
      const r = w * 0.26;
      const alpha = envelope(t, duration, 0.08, 0.3);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2, cy);
      ctx.lineWidth = 16;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = accent;
      ctx.lineCap = 'round';
      shadow(ctx, accent, 28);
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (done ? 1 : 1 - local));
      ctx.stroke();
      clearShadow(ctx);

      if (done) {
        const pop = easeOutBack(clamp01((t - from * step) / 0.35));
        ctx.save();
        ctx.scale(pop, pop);
        const { size } = fitLines(ctx, label || 'GO', r * 1.6, r * 0.72, 900, 1, 40);
        punchyText(ctx, (label || 'GO').toUpperCase(), 0, 0, { fill: accent, strokeWidth: size * 0.09 });
        ctx.restore();
      } else {
        const pop = 1 + 0.28 * Math.pow(1 - clamp01(local / 0.3), 2);
        ctx.save();
        ctx.scale(pop, pop);
        setFont(ctx, r * 1.25, 900);
        punchyText(ctx, String(value), 0, r * 0.03, { fill: '#ffffff', strokeWidth: r * 0.08 });
        ctx.restore();
      }
      ctx.restore();
    },
  },
  {
    id: 'caption-karaoke-pop',
    name: 'Karaoke Pop',
    category: 'caption',
    description: 'Word-by-word captions with the active word popping in a highlight box.',
    tags: ['bold', 'viral', 'captions'],
    keywords: ['caption', 'subtitle', 'karaoke', 'word', 'highlight', 'talking', 'tiktok', 'text'],
    energy: 3,
    duration: 3,
    placement: 'any',
    params: [
      {
        key: 'text',
        label: 'Caption',
        kind: 'text',
        default: 'this is where your words land',
        maxLength: 140,
      },
      accentParam('#7c5cff'),
      {
        key: 'style',
        label: 'Highlight',
        kind: 'select',
        default: 'box',
        options: [
          { value: 'box', label: 'Filled box' },
          { value: 'color', label: 'Coloured word' },
          { value: 'scale', label: 'Scale only' },
        ],
      },
      { key: 'caps', label: 'Uppercase', kind: 'toggle', default: true },
      { key: 'perLine', label: 'Words per line', kind: 'number', default: 3, min: 1, max: 5, step: 1 },
      yParam(0.66),
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const caps = bool(params, 'caps', true);
      const raw = str(params, 'text', 'your words here');
      const text = caps ? raw.toUpperCase() : raw;
      const accent = str(params, 'accent', '#7c5cff');
      const style = str(params, 'style', 'box');
      const perLine = clamp(Math.round(num(params, 'perLine', 3)), 1, 5);
      const cy = h * num(params, 'y', 0.66);
      const words = text.split(/\s+/).filter(Boolean);
      if (!words.length) return;
      const per = duration / words.length;
      const idx = clamp(Math.floor(t / per), 0, words.length - 1);
      const chunkStart = Math.floor(idx / perLine) * perLine;
      const chunk = words.slice(chunkStart, chunkStart + perLine);
      const active = idx - chunkStart;
      const local = clamp01((t - idx * per) / Math.min(0.16, per * 0.7));

      let size = 104;
      const maxW = w * 0.84;
      for (let i = 0; i < 24; i++) {
        setFont(ctx, size, 900);
        if (ctx.measureText(chunk.join(' ')).width <= maxW || size <= 44) break;
        size *= 0.94;
      }
      setFont(ctx, size, 900);
      const gap = size * 0.28;
      const widths = chunk.map((word) => ctx.measureText(word).width);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (chunk.length - 1);

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.08, 0.16);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      let x = w / 2 - total / 2;
      chunk.forEach((word, i) => {
        const isActive = i === active;
        const pop = isActive ? 1 + 0.16 * (1 - easeOutExpo(local)) : 1;
        ctx.save();
        ctx.translate(x + widths[i] / 2, cy);
        ctx.scale(pop, pop);
        if (isActive && style === 'box') {
          ctx.fillStyle = accent;
          shadow(ctx, 'rgba(0,0,0,0.45)', 24, 8);
          roundRect(ctx, -widths[i] / 2 - size * 0.16, -size * 0.6, widths[i] + size * 0.32, size * 1.2, size * 0.16);
          ctx.fill();
          clearShadow(ctx);
        }
        const fill =
          isActive && style === 'box' ? readableOn(accent) : isActive && style === 'color' ? accent : '#ffffff';
        punchyText(ctx, word, 0, 0, {
          fill,
          strokeWidth: isActive && style === 'box' ? 0 : size * 0.1,
          shadowBlur: 22,
          align: 'center',
        });
        ctx.restore();
        x += widths[i] + gap;
      });
      ctx.restore();
    },
  },
  {
    id: 'caption-boxed-clean',
    name: 'Clean Subtitle',
    category: 'caption',
    description: 'Understated subtitle in a soft dark box. Reads well over busy footage.',
    tags: ['minimal', 'clean', 'captions'],
    keywords: ['caption', 'subtitle', 'clean', 'minimal', 'box', 'explainer', 'readable', 'text'],
    energy: 1,
    duration: 3,
    placement: 'any',
    params: [
      { key: 'text', label: 'Caption', kind: 'text', default: 'Clean, readable, out of the way.', maxLength: 160 },
      accentParam('#ffffff'),
      { key: 'bg', label: 'Box opacity', kind: 'number', default: 0.62, min: 0, max: 0.9, step: 0.02 },
      yParam(0.7),
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const text = str(params, 'text', '');
      const accent = str(params, 'accent', '#ffffff');
      const bgAlpha = num(params, 'bg', 0.62);
      const cy = h * num(params, 'y', 0.7);
      const appear = easeOutExpo(clamp01(t / 0.3));
      const { lines, size } = fitLines(ctx, text, w * 0.74, 64, 600, 3, 34);
      const lineH = size * 1.32;
      const boxH = lines.length * lineH + size * 0.7;
      const boxW = Math.min(w * 0.86, Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.2);

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.2, 0.25);
      ctx.translate(w / 2, cy + (1 - appear) * 26);
      if (bgAlpha > 0.02) {
        ctx.fillStyle = `rgba(8,8,14,${bgAlpha})`;
        roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, size * 0.42);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      setFont(ctx, size, 600);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = accent;
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lineH);
      });
      ctx.restore();
    },
  },
  {
    id: 'caption-glitch-type',
    name: 'Glitch Type',
    category: 'caption',
    description: 'Typewriter reveal with RGB split and scanlines on the newest characters.',
    tags: ['glitch', 'tech', 'gaming'],
    keywords: ['glitch', 'type', 'typewriter', 'terminal', 'hacker', 'tech', 'gaming', 'caption', 'rgb'],
    energy: 3,
    duration: 2.8,
    placement: 'any',
    params: [
      { key: 'text', label: 'Caption', kind: 'text', default: 'SYSTEM OVERRIDE', maxLength: 90 },
      accentParam('#22d3ee'),
      { key: 'cursor', label: 'Show cursor', kind: 'toggle', default: true },
      yParam(0.62),
    ],
    draw({ ctx, t, duration, w, h, params, rand }) {
      const text = str(params, 'text', '').toUpperCase();
      const accent = str(params, 'accent', '#22d3ee');
      const showCursor = bool(params, 'cursor', true);
      const cy = h * num(params, 'y', 0.62);
      const typeDur = Math.min(duration * 0.55, text.length * 0.045);
      const shown = Math.round(clamp01(t / Math.max(0.2, typeDur)) * text.length);
      const visible = text.slice(0, shown) + (showCursor && Math.floor(t * 3) % 2 === 0 ? '_' : '');
      const { lines, size } = fitLines(ctx, text || ' ', w * 0.8, 82, 800, 3, 36);
      const typedLines = fitLines(ctx, visible || ' ', w * 0.8, size, 800, 3, size).lines;
      const jitter = shown < text.length ? 1 : 0.2;

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.06, 0.2);
      ctx.translate(w / 2, cy);
      setFont(ctx, size, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lineH = size * 1.18;
      typedLines.forEach((line, i) => {
        const y = (i - (lines.length - 1) / 2) * lineH;
        const dx = (rand(Math.floor(t * 30) + i) - 0.5) * 12 * jitter;
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255,0,80,0.75)';
        ctx.fillText(line, dx - 5 * jitter, y);
        ctx.fillStyle = withAlpha(accent, 0.75);
        ctx.fillText(line, dx + 5 * jitter, y);
        ctx.globalCompositeOperation = 'source-over';
        punchyText(ctx, line, dx, y, { fill: '#ffffff', strokeWidth: size * 0.08, shadowBlur: 16 });
      });
      ctx.globalAlpha *= 0.14;
      ctx.fillStyle = '#000';
      const bandH = lineH * typedLines.length + size;
      for (let y = -bandH / 2; y < bandH / 2; y += 6) {
        ctx.fillRect(-w * 0.45, y, w * 0.9, 2);
      }
      ctx.restore();
    },
  },
  {
    id: 'lower-third-slide',
    name: 'Slide Lower Third',
    category: 'lower-third',
    description: 'Name and handle slide in behind a growing accent bar.',
    tags: ['clean', 'editorial', 'creator'],
    keywords: ['lower third', 'name', 'handle', 'intro', 'credit', 'title', 'presenter', 'interview'],
    energy: 1,
    duration: 3.2,
    placement: 'any',
    params: [
      { key: 'name', label: 'Name', kind: 'text', default: 'Harsha Rao', maxLength: 32 },
      { key: 'handle', label: 'Subtitle', kind: 'text', default: 'founder · cutbeat', maxLength: 40 },
      accentParam('#7c5cff'),
      yParam(0.74),
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const name = str(params, 'name', '');
      const handle = str(params, 'handle', '');
      const accent = str(params, 'accent', '#7c5cff');
      const cy = h * num(params, 'y', 0.74);
      const inP = easeOutExpo(clamp01(t / 0.45));
      const outP = easeOutExpo(clamp01((duration - t) / 0.4));
      const reveal = Math.min(inP, outP);
      const x = w * 0.1;

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.1, 0.2);
      ctx.translate(x - (1 - reveal) * w * 0.35, cy);
      setFont(ctx, 72, 800);
      const nameW = ctx.measureText(name).width;
      setFont(ctx, 40, 500);
      const handleW = ctx.measureText(handle).width;
      const boxW = Math.max(nameW, handleW) + 64;

      ctx.fillStyle = 'rgba(8,8,14,0.72)';
      roundRect(ctx, -18, -76, boxW * reveal, 152, 18);
      ctx.fill();
      ctx.fillStyle = accent;
      roundRect(ctx, -18, -76, 10, 152 * reveal, 6);
      ctx.fill();

      ctx.globalAlpha *= clamp01((reveal - 0.35) / 0.4);
      setFont(ctx, 72, 800);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, 22, handle ? -22 : 0);
      if (handle) {
        setFont(ctx, 40, 500);
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.fillText(handle, 22, 34);
      }
      ctx.restore();
    },
  },
  {
    id: 'lower-third-tag',
    name: 'Location Tag',
    category: 'lower-third',
    description: 'Pill tag with a live dot. Good for places, chapters or product names.',
    tags: ['minimal', 'travel', 'clean'],
    keywords: ['tag', 'pill', 'location', 'place', 'chapter', 'label', 'badge', 'travel', 'live'],
    energy: 1,
    duration: 2.6,
    placement: 'any',
    params: [
      { key: 'text', label: 'Label', kind: 'text', default: 'GOA · 6:12 AM', maxLength: 36 },
      accentParam('#2fe6a8'),
      { key: 'align', label: 'Align', kind: 'select', default: 'left', options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ] },
      yParam(0.22),
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const text = str(params, 'text', '');
      const accent = str(params, 'accent', '#2fe6a8');
      const align = str(params, 'align', 'left');
      const cy = h * num(params, 'y', 0.22);
      const pop = easeOutBack(clamp01(t / 0.4));
      setFont(ctx, 44, 700);
      const tw = ctx.measureText(text).width;
      const boxW = tw + 132;
      const cx = align === 'left' ? w * 0.1 + boxW / 2 : align === 'right' ? w * 0.9 - boxW / 2 : w / 2;

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.12, 0.25);
      ctx.translate(cx, cy);
      ctx.scale(pop, pop);
      ctx.fillStyle = 'rgba(10,10,18,0.78)';
      roundRect(ctx, -boxW / 2, -42, boxW, 84, 42);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const pulse = 0.6 + 0.4 * Math.sin(t * 6);
      shadow(ctx, accent, 18 * pulse);
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(-boxW / 2 + 46, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      clearShadow(ctx);
      setFont(ctx, 44, 700);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, -boxW / 2 + 76, 2);
      ctx.restore();
    },
  },
  {
    id: 'hook-quote-card',
    name: 'Quote Card',
    category: 'hook',
    description: 'Editorial quote with a gradient sheet — good for text-only openers.',
    tags: ['editorial', 'minimal', 'elegant'],
    keywords: ['quote', 'card', 'statement', 'text', 'elegant', 'story', 'testimonial', 'review'],
    energy: 1,
    duration: 3,
    placement: 'open',
    pro: true,
    params: [
      {
        key: 'text',
        label: 'Quote',
        kind: 'text',
        default: 'We shipped a whole ad in one coffee break.',
        maxLength: 160,
      },
      { key: 'who', label: 'Attribution', kind: 'text', default: '— beta user, week 1', maxLength: 40 },
      accentParam('#7c5cff'),
      yParam(0.45),
    ],
    draw({ ctx, t, duration, w, h, params }) {
      const text = str(params, 'text', '');
      const who = str(params, 'who', '');
      const accent = str(params, 'accent', '#7c5cff');
      const cy = h * num(params, 'y', 0.45);
      const appear = easeOutExpo(clamp01(t / 0.5));
      const { lines, size } = fitLines(ctx, text, w * 0.7, 88, 700, 4, 40);
      const lineH = size * 1.28;
      const boxH = lines.length * lineH + (who ? size * 1.1 : 0) + size * 1.4;
      const boxW = w * 0.82;

      ctx.save();
      ctx.globalAlpha = envelope(t, duration, 0.18, 0.3);
      ctx.translate(w / 2, cy + (1 - appear) * 30);
      ctx.fillStyle = linearGradient(ctx, -boxW / 2, -boxH / 2, boxW / 2, boxH / 2, [
        [0, 'rgba(14,14,24,0.92)'],
        [1, 'rgba(24,18,44,0.92)'],
      ]);
      roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 36);
      ctx.fill();
      ctx.strokeStyle = withAlpha(accent, 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();

      setFont(ctx, size * 2.4, 900);
      ctx.fillStyle = withAlpha(accent, 0.65);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('“', -boxW / 2 + 40, -boxH / 2 + size * 0.95);

      setFont(ctx, size, 700);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      const top = -boxH / 2 + size * 1.25;
      lines.forEach((line, i) => {
        ctx.globalAlpha = envelope(t, duration, 0.18, 0.3) * clamp01((appear - i * 0.08) / 0.4);
        ctx.fillText(line, 0, top + i * lineH + lineH / 2);
      });
      if (who) {
        ctx.globalAlpha = envelope(t, duration, 0.18, 0.3) * clamp01((appear - 0.4) / 0.4);
        setFont(ctx, size * 0.52, 500);
        ctx.fillStyle = withAlpha(accent, 0.95);
        ctx.fillText(who, 0, top + lines.length * lineH + size * 0.5);
      }
      ctx.restore();
    },
  },
];
