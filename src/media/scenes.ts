/**
 * Procedurally drawn sample clips.
 *
 * The app ships no stock footage, so demo "footage" is generated: each scene is a
 * draw function plus a synthesised soundtrack. They are built with real motion and
 * audio peaks (a speed ramp, a wave crash, two firework bursts) so the auto-editor's
 * analysis has something genuine to find rather than staged results.
 */

import { clamp01, smoothstep } from '../lib/utils';
import { bed, hz, noise, tone } from './synth';
import type { Ctx } from './synth';

export interface SceneDef {
  id: string;
  name: string;
  blurb: string;
  duration: number;
  tags: string[];
  /** Where the interesting bits are, used only for the clip strip UI. */
  highlights: number[];
  draw: (ctx: CanvasRenderingContext2D, t: number, w: number, h: number, rand: (i: number) => number) => void;
  audio: (ctx: Ctx, duration: number) => void;
}

/** Cumulative integral of a rate function, sampled so draw() stays cheap. */
function integrate(duration: number, rate: (t: number) => number, hzRate = 120): (t: number) => number {
  const n = Math.ceil(duration * hzRate) + 2;
  const table = new Float64Array(n);
  const dt = 1 / hzRate;
  for (let i = 1; i < n; i++) table[i] = table[i - 1] + rate((i - 0.5) * dt) * dt;
  return (t: number) => {
    const x = Math.max(0, Math.min(duration, t)) * hzRate;
    const i = Math.min(n - 2, Math.floor(x));
    return table[i] + (table[i + 1] - table[i]) * (x - i);
  };
}

function skyGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stops: [number, string][],
): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/* ------------------------------------------------------------------ *
 * 1. Sunset Drive — slow cruise, hard speed ramp at 4s, settle at 9s. *
 * ------------------------------------------------------------------ */

const driveSpeed = (t: number) => 0.85 + 3.4 * smoothstep(3.4, 4.5, t) - 3.4 * smoothstep(8.0, 9.4, t);
const driveDist = integrate(12, driveSpeed);

const sunsetDrive: SceneDef = {
  id: 'scene-sunset-drive',
  name: 'Sunset Drive',
  blurb: 'Synthwave highway. Calm cruise, then a hard speed ramp at 4s.',
  duration: 12,
  tags: ['travel', 'night', 'retro'],
  highlights: [4.6, 6.4],
  draw(ctx, t, w, h, rand) {
    const horizon = h * 0.5;
    const dist = driveDist(t);
    const speed = driveSpeed(t);
    const rush = clamp01((speed - 1.2) / 3);

    skyGradient(ctx, w, h, [
      [0, '#170c30'],
      [0.28, '#3b1454'],
      [0.42, '#8d2a63'],
      [0.48, '#e04a5c'],
      [0.5, '#ff9b42'],
      [0.5001, '#1a0b2e'],
      [1, '#07030f'],
    ]);

    // Sun with the classic sliced look.
    const sunR = w * 0.24;
    const sunY = horizon - sunR * 0.52;
    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, '#ffe36b');
    sunGrad.addColorStop(0.55, '#ff7a3d');
    sunGrad.addColorStop(1, '#ff2e88');
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sunGrad;
    ctx.fillRect(w / 2 - sunR, sunY - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = 'rgba(23,12,48,0.92)';
    for (let i = 0; i < 9; i++) {
      const y = sunY - sunR * 0.1 + i * sunR * 0.16;
      ctx.fillRect(w / 2 - sunR, y, sunR * 2, 3 + i * 2.6);
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(w / 2, sunY, sunR * 0.4, w / 2, sunY, sunR * 2.4);
    glow.addColorStop(0, 'rgba(255,120,80,0.45)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, horizon + 10);
    ctx.restore();

    // Ridge lines.
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer === 0 ? 'rgba(44,16,72,0.95)' : 'rgba(20,8,38,0.98)';
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      const amp = 90 - layer * 34;
      const off = layer * 2.1;
      for (let x = 0; x <= w; x += 20) {
        const n =
          Math.sin(x * 0.004 + off) * amp +
          Math.sin(x * 0.011 + off * 2) * amp * 0.45 +
          Math.sin(x * 0.02 + off * 3) * amp * 0.2;
        ctx.lineTo(x, horizon - Math.abs(n) - layer * 12);
      }
      ctx.lineTo(w, horizon);
      ctx.closePath();
      ctx.fill();
    }

    // Perspective grid ground.
    const yOf = (z: number) => horizon + (h - horizon) / (1 + 0.42 * z);
    const halfOf = (z: number) => 46 + (w * 0.92) / (1 + 0.42 * z);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, w, h - horizon);
    ctx.clip();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,46,136,0.55)';
    const phase = dist % 2;
    for (let k = 0; k < 42; k++) {
      const z = k * 2 - phase;
      if (z < 0) continue;
      const y = yOf(z);
      const half = halfOf(z);
      ctx.globalAlpha = clamp01(1 - k / 34);
      ctx.beginPath();
      ctx.moveTo(w / 2 - half, y);
      ctx.lineTo(w / 2 + half, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = 'rgba(80,220,255,0.6)';
    for (let i = -7; i <= 7; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 46, horizon);
      ctx.lineTo(w / 2 + i * (w * 0.2), h);
      ctx.stroke();
    }
    // Centre line dashes move fastest — the main motion cue.
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#ffe7a8';
    for (let k = 0; k < 26; k++) {
      const z0 = k * 3 - (dist % 3);
      const z1 = z0 + 1.35;
      if (z1 < 0) continue;
      const y0 = yOf(z0);
      const y1 = yOf(z1);
      const wid0 = Math.max(2, halfOf(z0) * 0.035);
      const wid1 = Math.max(2, halfOf(z1) * 0.035);
      ctx.beginPath();
      ctx.moveTo(w / 2 - wid0, y0);
      ctx.lineTo(w / 2 + wid0, y0);
      ctx.lineTo(w / 2 + wid1, y1);
      ctx.lineTo(w / 2 - wid1, y1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Speed streaks while the ramp is on.
    if (rush > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,220,255,${0.5 * rush})`;
      for (let i = 0; i < 40; i++) {
        const a = rand(i) * Math.PI * 2;
        const r0 = 120 + rand(i + 60) * 420;
        const len = (110 + rand(i + 120) * 320) * rush;
        const sx = w / 2 + Math.cos(a) * r0;
        const sy = horizon + 40 + Math.sin(a) * r0 * 0.6;
        ctx.lineWidth = 2 + rand(i + 9) * 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(w / 2 + Math.cos(a) * (r0 + len), horizon + 40 + Math.sin(a) * (r0 + len) * 0.6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Dashboard silhouette for depth.
    ctx.fillStyle = '#05030b';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.86);
    ctx.quadraticCurveTo(w * 0.5, h * 0.78 + Math.sin(t * 1.6) * 6, w, h * 0.86);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,140,0.5)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(w / 2, h * 1.02, w * 0.3, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  },
  audio(ctx, duration) {
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    bed(ctx, master, { dur: duration, gain: 0.05, freq: 520, q: 0.5, lfoRate: 0.12, lfoDepth: 0.03 });
    // Engine drone that follows the speed ramp.
    for (let t = 0; t < duration; t += 0.25) {
      const s = driveSpeed(t);
      tone(ctx, master, {
        type: 'sawtooth',
        freq: 52 + s * 16,
        at: t,
        dur: 0.3,
        gain: 0.05 + s * 0.02,
        env: { attack: 0.08, decay: 0.05, sustain: 1, release: 0.1 },
        filter: { type: 'lowpass', freq: 220 + s * 260, q: 4 },
      });
    }
    noise(ctx, master, {
      at: 4.1,
      dur: 0.7,
      gain: 0.28,
      env: { attack: 0.18, decay: 0.2, sustain: 0.5, release: 0.3 },
      filter: { type: 'bandpass', freq: 400, freqTo: 3800, q: 1.2 },
    });
    for (const at of [5.6, 6.9, 7.8]) {
      noise(ctx, master, {
        at,
        dur: 0.45,
        gain: 0.2,
        env: { attack: 0.06, decay: 0.12, sustain: 0.3, release: 0.2 },
        filter: { type: 'bandpass', freq: 1800, freqTo: 300, q: 2 },
      });
    }
  },
};

/* ------------------------------------------------------- *
 * 2. Wave Break — quiet swell, then a crash just past 5s.  *
 * ------------------------------------------------------- */

const CRASH_AT = 5.4;

const waveBreak: SceneDef = {
  id: 'scene-wave-break',
  name: 'Wave Break',
  blurb: 'Golden-hour surf. One big crest breaks at 5.4s.',
  duration: 10,
  tags: ['nature', 'travel', 'calm'],
  highlights: [5.6],
  draw(ctx, t, w, h, rand) {
    const horizon = h * 0.4;
    skyGradient(ctx, w, h, [
      [0, '#0a2a4d'],
      [0.22, '#2f6f9e'],
      [0.35, '#8fbcd4'],
      [0.4, '#ffc987'],
      [0.4001, '#0d4a6b'],
      [1, '#041824'],
    ]);

    const sunX = w * 0.64;
    const sunY = horizon - h * 0.05;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, w * 0.5);
    g.addColorStop(0, 'rgba(255,225,160,0.95)');
    g.addColorStop(0.15, 'rgba(255,170,90,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon + 40);
    ctx.restore();

    // Sun glitter on the water.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const rowT = rand(i);
      const y = horizon + rowT * rowT * (h - horizon) * 0.7;
      const spread = 40 + rowT * w * 0.35;
      const x = sunX + (rand(i + 200) - 0.5) * spread + Math.sin(t * 2 + i) * 8;
      const a = 0.25 + 0.5 * Math.abs(Math.sin(t * 3 + i * 1.7));
      ctx.fillStyle = `rgba(255,214,150,${a * (1 - rowT * 0.6)})`;
      ctx.fillRect(x, y, 18 + rowT * 44, 3 + rowT * 4);
    }
    ctx.restore();

    const crash = clamp01((t - CRASH_AT) / 1.1);
    const swell = smoothstep(CRASH_AT - 2.2, CRASH_AT, t);

    // Layered swells, nearest one becomes the breaking wave.
    for (let layer = 0; layer < 5; layer++) {
      const depth = layer / 4;
      const baseY = horizon + (h - horizon) * (0.12 + depth * 0.82);
      const amp = 14 + depth * 46 + (layer === 4 ? swell * 240 : swell * 40 * depth);
      const freq = 0.006 - depth * 0.0028;
      const speed = 1.1 + depth * 2.2;
      const shade = 0.12 + depth * 0.2;
      ctx.fillStyle = `rgb(${Math.round(9 + shade * 40)}, ${Math.round(58 + shade * 80)}, ${Math.round(88 + shade * 90)})`;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= w; x += 14) {
        const lift = layer === 4 ? Math.pow(Math.max(0, Math.sin(x * 0.0022 + 0.4)), 2) : 1;
        const y =
          baseY -
          Math.sin(x * freq + t * speed) * amp * lift -
          Math.sin(x * freq * 2.7 + t * speed * 1.6) * amp * 0.3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      // Foam crest line.
      ctx.strokeStyle = `rgba(255,255,255,${0.18 + depth * 0.5})`;
      ctx.lineWidth = 3 + depth * 5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 14) {
        const lift = layer === 4 ? Math.pow(Math.max(0, Math.sin(x * 0.0022 + 0.4)), 2) : 1;
        const y =
          baseY -
          Math.sin(x * freq + t * speed) * amp * lift -
          Math.sin(x * freq * 2.7 + t * speed * 1.6) * amp * 0.3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // The break: spray particles + a wash of white.
    if (crash > 0) {
      const fade = Math.pow(1 - crash, 1.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 220; i++) {
        const a = rand(i) * Math.PI - Math.PI / 2;
        const sp = 120 + rand(i + 33) * 900;
        const x = w * 0.52 + Math.cos(a) * sp * crash + (rand(i + 77) - 0.5) * 180;
        const y =
          h * 0.72 - Math.abs(Math.sin(a)) * sp * crash * 1.15 + crash * crash * 900 * rand(i + 120);
        const r = 3 + rand(i + 9) * 13;
        ctx.fillStyle = `rgba(255,255,255,${fade * (0.3 + rand(i + 5) * 0.6)})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = `rgba(233,246,255,${fade * 0.5})`;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.74);
      for (let x = 0; x <= w; x += 22) {
        ctx.lineTo(x, h * 0.74 + Math.sin(x * 0.01 + t * 4) * 26 + crash * 120);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    // Gulls.
    ctx.strokeStyle = 'rgba(20,30,45,0.7)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const gx = ((rand(i + 400) + t * (0.02 + i * 0.006)) % 1.2 - 0.1) * w;
      const gy = horizon - 120 - i * 70 + Math.sin(t * 1.2 + i) * 14;
      const flap = Math.sin(t * 5 + i * 2) * 10;
      ctx.beginPath();
      ctx.moveTo(gx - 22, gy + flap);
      ctx.quadraticCurveTo(gx, gy - 8, gx + 22, gy + flap);
      ctx.stroke();
    }
  },
  audio(ctx, duration) {
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    bed(ctx, master, { dur: duration, gain: 0.12, freq: 700, q: 0.4, lfoRate: 0.18, lfoDepth: 0.07 });
    bed(ctx, master, { dur: duration, gain: 0.06, freq: 180, q: 0.5, lfoRate: 0.09, lfoDepth: 0.04 });
    noise(ctx, master, {
      at: CRASH_AT - 0.35,
      dur: 2.4,
      gain: 0.55,
      env: { attack: 0.35, decay: 0.5, sustain: 0.45, release: 1.1 },
      filter: { type: 'lowpass', freq: 5200, freqTo: 420, q: 0.8 },
    });
    tone(ctx, master, {
      type: 'sine',
      freq: 90,
      freqTo: 38,
      at: CRASH_AT - 0.2,
      dur: 0.9,
      gain: 0.3,
      env: { attack: 0.05, decay: 0.3, sustain: 0.3, release: 0.5 },
    });
    for (const at of [1.4, 3.1, 8.2]) {
      tone(ctx, master, {
        type: 'triangle',
        freq: 1500,
        freqTo: 900,
        at,
        dur: 0.18,
        gain: 0.08,
        env: { attack: 0.01, decay: 0.06, sustain: 0.2, release: 0.1 },
      });
    }
  },
};

/* ---------------------------------------------------------- *
 * 3. City Lights — skyline, two firework bursts, confetti.    *
 * ---------------------------------------------------------- */

const BURSTS = [2.7, 7.2];

const cityLights: SceneDef = {
  id: 'scene-city-lights',
  name: 'City Lights',
  blurb: 'Rooftop skyline with two firework bursts at 2.7s and 7.2s.',
  duration: 11,
  tags: ['city', 'night', 'party'],
  highlights: [2.9, 7.4],
  draw(ctx, t, w, h, rand) {
    skyGradient(ctx, w, h, [
      [0, '#05061a'],
      [0.45, '#0d1436'],
      [0.72, '#1b2450'],
      [1, '#2a1f3f'],
    ]);

    // Stars.
    for (let i = 0; i < 120; i++) {
      const x = rand(i) * w;
      const y = rand(i + 300) * h * 0.6;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + i));
      ctx.fillStyle = `rgba(255,255,255,${0.35 * tw})`;
      ctx.fillRect(x, y, 2.5, 2.5);
    }

    // Firework bursts.
    for (let b = 0; b < BURSTS.length; b++) {
      const bt = t - BURSTS[b];
      if (bt < -0.4 || bt > 3) continue;
      const cx = w * (b === 0 ? 0.36 : 0.66);
      const cy = h * (b === 0 ? 0.3 : 0.24);
      if (bt < 0) {
        // Rising tracer.
        const rise = clamp01(1 + bt / 0.4);
        ctx.fillStyle = 'rgba(255,220,150,0.9)';
        ctx.beginPath();
        ctx.arc(cx, h * 0.8 - (h * 0.8 - cy) * rise, 6, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const p = clamp01(bt / 2.4);
      const fade = Math.pow(1 - p, 1.8);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (bt < 0.25) {
        const flash = 1 - bt / 0.25;
        const fg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.9);
        fg.addColorStop(0, `rgba(255,240,200,${0.55 * flash})`);
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, w, h);
      }
      const hueA = b === 0 ? [255, 90, 160] : [120, 200, 255];
      const hueB = b === 0 ? [255, 220, 120] : [190, 140, 255];
      for (let i = 0; i < 160; i++) {
        const a = (i / 160) * Math.PI * 2 + rand(i + b * 31) * 0.4;
        const sp = (240 + rand(i + 60) * 420) * (0.6 + rand(i + b) * 0.6);
        const dist = sp * Math.pow(p, 0.55);
        const x = cx + Math.cos(a) * dist;
        const y = cy + Math.sin(a) * dist + p * p * 420;
        const col = i % 3 === 0 ? hueB : hueA;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${fade * 0.9})`;
        ctx.lineWidth = 4 - p * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(a) * 26, y - Math.sin(a) * 26);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Skyline.
    const skyline = (baseY: number, seedOff: number, color: string, lit: boolean) => {
      ctx.fillStyle = color;
      let x = -40;
      let i = seedOff;
      while (x < w + 40) {
        const bw = 60 + rand(i) * 150;
        const bh = 140 + rand(i + 17) * 620;
        ctx.fillRect(x, baseY - bh, bw, bh + 200);
        if (lit) {
          for (let wy = baseY - bh + 24; wy < baseY - 30; wy += 34) {
            for (let wx = x + 14; wx < x + bw - 18; wx += 28) {
              const k = Math.floor(wx + wy);
              const on = rand(k % 500) > 0.42;
              if (!on) continue;
              const flick = rand((k * 7) % 500) > 0.97 ? Math.abs(Math.sin(t * 9 + k)) : 1;
              ctx.fillStyle = `rgba(255,214,140,${0.5 * flick})`;
              ctx.fillRect(wx, wy, 11, 16);
            }
          }
          ctx.fillStyle = color;
        }
        x += bw + 10 + rand(i + 33) * 26;
        i += 3;
      }
    };
    skyline(h * 0.74, 700, '#0a0f24', false);
    skyline(h * 0.82, 40, '#05070f', true);

    // Street light trails.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const lane = i % 4;
      const y = h * 0.86 + lane * 28;
      const dir = lane % 2 === 0 ? 1 : -1;
      const speed = 220 + lane * 90;
      const x = (((t * speed * dir + rand(i) * 2200) % (w + 700)) + w + 700) % (w + 700) - 350;
      const col = dir > 0 ? '255,190,120' : '255,90,110';
      const grad = ctx.createLinearGradient(x - 260 * dir, y, x + 60 * dir, y);
      grad.addColorStop(0, `rgba(${col},0)`);
      grad.addColorStop(1, `rgba(${col},0.75)`);
      ctx.fillStyle = grad;
      ctx.fillRect(Math.min(x - 260 * dir, x + 60 * dir), y, 320, 9);
    }
    ctx.restore();

    // Confetti after the second burst.
    const conf = t - BURSTS[1] - 0.3;
    if (conf > 0) {
      const fade = clamp01(1 - conf / 4);
      for (let i = 0; i < 90; i++) {
        const x = rand(i + 11) * w + Math.sin(t * 1.6 + i) * 40;
        const y = ((rand(i + 55) * 0.4 + conf * (0.12 + rand(i) * 0.14)) % 1.2 - 0.1) * h;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (2 + rand(i + 3) * 4) + i);
        ctx.fillStyle = [`rgba(255,90,160,${fade})`, `rgba(120,200,255,${fade})`, `rgba(255,220,120,${fade})`][i % 3];
        ctx.fillRect(-9, -5, 18, 10);
        ctx.restore();
      }
    }
  },
  audio(ctx, duration) {
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    bed(ctx, master, { dur: duration, gain: 0.05, freq: 380, q: 0.4, lfoRate: 0.22, lfoDepth: 0.02 });
    for (const at of BURSTS) {
      tone(ctx, master, {
        type: 'sine',
        freq: 160,
        freqTo: 34,
        at,
        dur: 0.8,
        gain: 0.5,
        env: { attack: 0.004, decay: 0.25, sustain: 0.25, release: 0.6 },
      });
      noise(ctx, master, {
        at,
        dur: 1.6,
        gain: 0.32,
        env: { attack: 0.005, decay: 0.35, sustain: 0.18, release: 0.9 },
        filter: { type: 'lowpass', freq: 4200, freqTo: 500, q: 0.7 },
      });
      for (let i = 0; i < 26; i++) {
        noise(ctx, master, {
          at: at + 0.25 + i * 0.045 + (i % 3) * 0.02,
          dur: 0.07,
          gain: 0.1,
          env: { attack: 0.002, decay: 0.03, sustain: 0.1, release: 0.05 },
          filter: { type: 'bandpass', freq: 3200 + (i % 5) * 900, q: 3 },
        });
      }
    }
    // Faint crowd cheer after each burst.
    for (const at of BURSTS) {
      noise(ctx, master, {
        at: at + 0.3,
        dur: 2.2,
        gain: 0.12,
        env: { attack: 0.4, decay: 0.6, sustain: 0.5, release: 1 },
        filter: { type: 'bandpass', freq: 1100, q: 0.9 },
      });
    }
    tone(ctx, master, {
      type: 'triangle',
      freq: hz(50),
      at: 0,
      dur: duration,
      gain: 0.03,
      env: { attack: 1, decay: 1, sustain: 1, release: 1 },
      filter: { type: 'lowpass', freq: 300 },
    });
  },
};

export const SCENES: SceneDef[] = [sunsetDrive, waveBreak, cityLights];

export const sceneById = (id: string): SceneDef | undefined => SCENES.find((s) => s.id === id);
