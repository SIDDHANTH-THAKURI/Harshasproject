/**
 * Synthesised music beds.
 *
 * Every track is generated from a known BPM, so the auto-editor gets an exact beat
 * grid for free — no tempo detection needed to snap cuts to the music.
 */

import { hz, makeOfflineCtx, makeReverb, noise, tone } from './synth';
import type { Ctx } from './synth';

export interface MusicTrack {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  energy: 1 | 2 | 3;
  mood: string[];
  /** Bar index where the track opens up; used to line up the peak of the edit. */
  dropBar: number;
  build: (ctx: Ctx, duration: number) => void;
}

export const MUSIC_DURATION = 48;

interface Voices {
  master: GainNode;
  verb: GainNode;
}

function makeBus(ctx: Ctx): Voices {
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3.4;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  master.connect(comp).connect(ctx.destination);

  const verbSend = ctx.createGain();
  verbSend.gain.value = 0.32;
  verbSend.connect(makeReverb(ctx, 1.8, 3.6)).connect(master);
  return { master, verb: verbSend };
}

const kick = (ctx: Ctx, v: Voices, at: number, gain = 0.85) => {
  tone(ctx, v.master, {
    type: 'sine',
    freq: 165,
    freqTo: 44,
    at,
    dur: 0.3,
    gain,
    env: { attack: 0.002, decay: 0.07, sustain: 0.22, release: 0.16 },
  });
  noise(ctx, v.master, {
    at,
    dur: 0.03,
    gain: gain * 0.35,
    env: { attack: 0.001, decay: 0.01, sustain: 0.1, release: 0.02 },
    filter: { type: 'lowpass', freq: 2200 },
  });
};

const sub = (ctx: Ctx, v: Voices, at: number, dur: number, midi: number, gain = 0.5) => {
  tone(ctx, v.master, {
    type: 'sine',
    freq: hz(midi),
    at,
    dur,
    gain,
    env: { attack: 0.01, decay: 0.08, sustain: 0.85, release: 0.1 },
    filter: { type: 'lowpass', freq: 220, q: 1 },
  });
};

const snare = (ctx: Ctx, v: Voices, at: number, gain = 0.5) => {
  noise(ctx, v.master, {
    at,
    dur: 0.16,
    gain,
    env: { attack: 0.002, decay: 0.06, sustain: 0.2, release: 0.12 },
    filter: { type: 'bandpass', freq: 1900, q: 0.9 },
  });
  noise(ctx, v.verb, {
    at,
    dur: 0.14,
    gain: gain * 0.5,
    env: { attack: 0.002, decay: 0.05, sustain: 0.2, release: 0.1 },
    filter: { type: 'highpass', freq: 900 },
  });
  tone(ctx, v.master, {
    type: 'triangle',
    freq: 210,
    freqTo: 150,
    at,
    dur: 0.09,
    gain: gain * 0.5,
    env: { attack: 0.002, decay: 0.04, sustain: 0.1, release: 0.06 },
  });
};

const clap = (ctx: Ctx, v: Voices, at: number, gain = 0.45) => {
  for (let i = 0; i < 3; i++) {
    noise(ctx, v.master, {
      at: at + i * 0.011,
      dur: 0.09,
      gain: gain * (1 - i * 0.2),
      env: { attack: 0.001, decay: 0.03, sustain: 0.15, release: 0.09 },
      filter: { type: 'bandpass', freq: 1500, q: 1.4 },
    });
  }
  noise(ctx, v.verb, {
    at,
    dur: 0.12,
    gain: gain * 0.4,
    env: { attack: 0.002, decay: 0.05, sustain: 0.2, release: 0.14 },
    filter: { type: 'highpass', freq: 1200 },
  });
};

const hat = (ctx: Ctx, v: Voices, at: number, gain = 0.18, open = false) => {
  noise(ctx, v.master, {
    at,
    dur: open ? 0.19 : 0.035,
    gain,
    env: { attack: 0.001, decay: open ? 0.09 : 0.015, sustain: 0.25, release: open ? 0.12 : 0.03 },
    filter: { type: 'highpass', freq: 7600 },
  });
};

const chord = (
  ctx: Ctx,
  v: Voices,
  at: number,
  dur: number,
  notes: number[],
  gain = 0.12,
  type: OscillatorType = 'sawtooth',
  cutoff = 1500,
) => {
  for (const n of notes) {
    for (const det of [-7, 7]) {
      tone(ctx, v.master, {
        type,
        freq: hz(n),
        at,
        dur,
        gain: gain / notes.length,
        detune: det,
        env: { attack: 0.02, decay: 0.12, sustain: 0.75, release: 0.35 },
        filter: { type: 'lowpass', freq: cutoff, q: 1.2 },
      });
    }
  }
  tone(ctx, v.verb, {
    type,
    freq: hz(notes[0] + 12),
    at,
    dur,
    gain: gain * 0.3,
    env: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },
    filter: { type: 'lowpass', freq: cutoff * 1.4 },
  });
};

const pluck = (ctx: Ctx, v: Voices, at: number, midi: number, gain = 0.16) => {
  tone(ctx, v.master, {
    type: 'triangle',
    freq: hz(midi),
    at,
    dur: 0.18,
    gain,
    env: { attack: 0.003, decay: 0.07, sustain: 0.2, release: 0.18 },
    filter: { type: 'lowpass', freq: 3200 },
  });
};

const riser = (ctx: Ctx, v: Voices, at: number, dur: number, gain = 0.2) => {
  noise(ctx, v.master, {
    at,
    dur,
    gain,
    env: { attack: dur * 0.9, decay: 0.05, sustain: 0.9, release: 0.2 },
    filter: { type: 'bandpass', freq: 500, freqTo: 7000, q: 1.6 },
  });
};

/** Walks bars/beats and hands them to a per-bar callback. */
function sequence(
  bpm: number,
  duration: number,
  perBar: (bar: number, barAt: number, beat: number) => void,
): void {
  const beat = 60 / bpm;
  const bar = beat * 4;
  const bars = Math.ceil(duration / bar);
  for (let i = 0; i < bars; i++) perBar(i, i * bar, beat);
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'neon-drive',
    name: 'Neon Drive',
    genre: 'Synthwave',
    bpm: 118,
    energy: 2,
    mood: ['night', 'retro', 'cruise', 'moody'],
    dropBar: 4,
    build(ctx, duration) {
      const v = makeBus(ctx);
      const prog = [
        [45, 52, 57, 64],
        [41, 48, 53, 60],
        [43, 50, 55, 62],
        [40, 47, 52, 59],
      ];
      sequence(this.bpm, duration, (bar, at, beat) => {
        const notes = prog[bar % prog.length];
        const open = bar >= this.dropBar;
        chord(ctx, v, at, beat * 3.7, notes.map((n) => n + 12), open ? 0.13 : 0.08, 'sawtooth', open ? 2400 : 1200);
        for (let b = 0; b < 4; b++) {
          kick(ctx, v, at + b * beat, 0.8);
          if (b % 2 === 1) snare(ctx, v, at + b * beat, open ? 0.42 : 0.3);
          for (let s = 0; s < 2; s++) hat(ctx, v, at + b * beat + s * beat * 0.5, s ? 0.14 : 0.09, s === 1 && open);
          sub(ctx, v, at + b * beat, beat * 0.9, notes[0] - 12, 0.42);
          if (open && b === 3) pluck(ctx, v, at + b * beat + beat * 0.5, notes[3] + 12, 0.14);
        }
        if (bar === this.dropBar - 1) riser(ctx, v, at, beat * 4, 0.22);
      });
    },
  },
  {
    id: 'hype-trap',
    name: 'Hype Trap',
    genre: 'Trap',
    bpm: 140,
    energy: 3,
    mood: ['hype', 'aggressive', 'gym', 'drop'],
    dropBar: 4,
    build(ctx, duration) {
      const v = makeBus(ctx);
      const roots = [40, 40, 43, 38];
      sequence(this.bpm, duration, (bar, at, beat) => {
        const root = roots[bar % roots.length];
        const open = bar >= this.dropBar;
        const step = beat / 4;
        kick(ctx, v, at, 0.95);
        kick(ctx, v, at + beat * 1.75, 0.75);
        kick(ctx, v, at + beat * 2.5, 0.7);
        clap(ctx, v, at + beat * 2, 0.5);
        if (open) clap(ctx, v, at + beat * 3.75, 0.3);
        sub(ctx, v, at, beat * 1.6, root - 12, 0.6);
        sub(ctx, v, at + beat * 2.5, beat * 1.4, root - 12 + (bar % 2 ? 3 : 0), 0.5);
        for (let s = 0; s < 16; s++) {
          const roll = open && bar % 4 === 3 && s >= 12;
          if (roll) {
            for (let r = 0; r < 3; r++) hat(ctx, v, at + s * step + r * (step / 3), 0.12);
          } else if (s % 2 === 0 || s % 3 === 0) {
            hat(ctx, v, at + s * step, s % 4 === 0 ? 0.2 : 0.11);
          }
        }
        chord(ctx, v, at, beat * 2, [root + 12, root + 15, root + 19], open ? 0.1 : 0.06, 'square', 1800);
        if (bar === this.dropBar - 1) riser(ctx, v, at + beat * 2, beat * 2, 0.26);
      });
    },
  },
  {
    id: 'lofi-walk',
    name: 'Lofi Walk',
    genre: 'Lo-fi',
    bpm: 84,
    energy: 1,
    mood: ['calm', 'warm', 'vlog', 'chill'],
    dropBar: 8,
    build(ctx, duration) {
      const v = makeBus(ctx);
      const prog = [
        [48, 52, 55, 59],
        [45, 48, 52, 55],
        [50, 53, 57, 60],
        [43, 47, 50, 54],
      ];
      sequence(this.bpm, duration, (bar, at, beat) => {
        const notes = prog[bar % prog.length];
        chord(ctx, v, at, beat * 3.6, notes, 0.1, 'triangle', 900);
        kick(ctx, v, at, 0.55);
        kick(ctx, v, at + beat * 2.5, 0.42);
        snare(ctx, v, at + beat * 2, 0.26);
        for (let s = 0; s < 8; s++) {
          if (s % 2 === 0) hat(ctx, v, at + s * (beat / 2), 0.06);
        }
        sub(ctx, v, at, beat * 2, notes[0] - 12, 0.32);
        sub(ctx, v, at + beat * 2, beat * 2, notes[1] - 12, 0.26);
        pluck(ctx, v, at + beat * 1.5, notes[3] + 12, 0.1);
        pluck(ctx, v, at + beat * 3.25, notes[2] + 12, 0.08);
        noise(ctx, v.master, {
          at,
          dur: beat * 4,
          gain: 0.015,
          env: { attack: 0.5, decay: 0.5, sustain: 1, release: 0.5 },
          filter: { type: 'bandpass', freq: 3000, q: 0.5 },
        });
      });
    },
  },
  {
    id: 'house-lift',
    name: 'House Lift',
    genre: 'House',
    bpm: 124,
    energy: 3,
    mood: ['upbeat', 'product', 'bright', 'dance'],
    dropBar: 4,
    build(ctx, duration) {
      const v = makeBus(ctx);
      const prog = [
        [50, 53, 57],
        [48, 52, 55],
        [45, 48, 52],
        [46, 50, 53],
      ];
      sequence(this.bpm, duration, (bar, at, beat) => {
        const notes = prog[bar % prog.length];
        const open = bar >= this.dropBar;
        for (let b = 0; b < 4; b++) {
          kick(ctx, v, at + b * beat, 0.9);
          hat(ctx, v, at + b * beat + beat * 0.5, open ? 0.22 : 0.14, true);
          if (b % 2 === 1) clap(ctx, v, at + b * beat, 0.42);
          sub(ctx, v, at + b * beat + beat * 0.5, beat * 0.45, notes[0] - 12, 0.45);
        }
        for (let s = 0; s < 8; s++) {
          if (open && s % 2 === 0) pluck(ctx, v, at + s * (beat / 2), notes[s % notes.length] + 12, 0.12);
        }
        chord(ctx, v, at, beat * 3.6, notes.map((n) => n + 12), open ? 0.12 : 0.07, 'sawtooth', open ? 2600 : 1100);
        if (bar === this.dropBar - 1) riser(ctx, v, at + beat * 2, beat * 2, 0.24);
      });
    },
  },
];

export const musicById = (id: string): MusicTrack | undefined => MUSIC_TRACKS.find((t) => t.id === id);

const buffers = new Map<string, Promise<AudioBuffer>>();

/** Render (and cache) a track to an AudioBuffer. */
export function getMusicBuffer(trackId: string): Promise<AudioBuffer> {
  const existing = buffers.get(trackId);
  if (existing) return existing;
  const track = musicById(trackId);
  if (!track) return Promise.reject(new Error(`Unknown track ${trackId}`));
  const promise = (async () => {
    const ctx = makeOfflineCtx(MUSIC_DURATION);
    track.build(ctx, MUSIC_DURATION);
    return ctx.startRendering();
  })();
  buffers.set(trackId, promise);
  return promise;
}

/** Absolute beat times for a track, used for cut snapping. */
export function beatGrid(bpm: number, duration: number, subdivision = 1): number[] {
  const step = 60 / bpm / subdivision;
  const out: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) out.push(Number(t.toFixed(4)));
  return out;
}
