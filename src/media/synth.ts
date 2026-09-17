/**
 * Tiny Web Audio synth toolkit.
 *
 * The app ships no audio files: sample-clip soundtracks and the music library are
 * rendered offline with these helpers, which also means every track has an exact,
 * known BPM for beat-synced cutting.
 */

export type Ctx = OfflineAudioContext | AudioContext;

let noiseCache: { ctx: Ctx; buffer: AudioBuffer } | null = null;

/** 2 seconds of white noise, reused for every noise voice. */
export function noiseBuffer(ctx: Ctx): AudioBuffer {
  if (noiseCache && noiseCache.ctx === ctx) return noiseCache.buffer;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 2147483648 - 1) * 0.9;
  }
  noiseCache = { ctx, buffer: buf };
  return buf;
}

/** Exponential-ish impulse response for a cheap reverb send. */
export function makeReverb(ctx: Ctx, seconds = 1.6, decay = 3.2): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 9871;
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const n = seed / 2147483648 - 1;
      data[i] = n * Math.pow(1 - i / len, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

export interface EnvOptions {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  peak?: number;
}

export function envGain(ctx: Ctx, at: number, dur: number, opts: EnvOptions = {}): GainNode {
  const { attack = 0.005, decay = 0.08, sustain = 0.6, release = 0.12, peak = 1 } = opts;
  const g = ctx.createGain();
  const t0 = Math.max(0, at);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.linearRampToValueAtTime(peak * sustain, t0 + attack + decay);
  const end = t0 + Math.max(dur, attack + decay);
  g.gain.setValueAtTime(Math.max(0.0001, peak * sustain), end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + release);
  return g;
}

export interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  freqTo?: number;
  at: number;
  dur: number;
  gain?: number;
  detune?: number;
  env?: EnvOptions;
  filter?: { type: BiquadFilterType; freq: number; freqTo?: number; q?: number };
}

export function tone(ctx: Ctx, dest: AudioNode, o: ToneOptions): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, o.at);
  if (o.freqTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), o.at + o.dur);
  }
  if (o.detune) osc.detune.setValueAtTime(o.detune, o.at);

  const g = envGain(ctx, o.at, o.dur, { peak: o.gain ?? 0.3, ...(o.env ?? {}) });
  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.freq, o.at);
    if (o.filter.freqTo !== undefined) {
      f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.freqTo), o.at + o.dur);
    }
    if (o.filter.q) f.Q.value = o.filter.q;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  osc.start(o.at);
  osc.stop(o.at + o.dur + (o.env?.release ?? 0.12) + 0.05);
}

export interface NoiseOptions {
  at: number;
  dur: number;
  gain?: number;
  env?: EnvOptions;
  filter?: { type: BiquadFilterType; freq: number; freqTo?: number; q?: number };
  playbackRate?: number;
}

export function noise(ctx: Ctx, dest: AudioNode, o: NoiseOptions): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  if (o.playbackRate) src.playbackRate.value = o.playbackRate;
  const g = envGain(ctx, o.at, o.dur, { peak: o.gain ?? 0.2, ...(o.env ?? {}) });
  let node: AudioNode = src;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.freq, o.at);
    if (o.filter.freqTo !== undefined) {
      f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.freqTo), o.at + o.dur);
    }
    f.Q.value = o.filter.q ?? 1;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  src.start(o.at);
  src.stop(o.at + o.dur + (o.env?.release ?? 0.12) + 0.05);
}

/** Steady bed of filtered noise (wind, surf, room tone) with a slow level LFO. */
export function bed(
  ctx: Ctx,
  dest: AudioNode,
  o: { dur: number; gain: number; freq: number; q?: number; lfoRate?: number; lfoDepth?: number },
): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = o.freq;
  f.Q.value = o.q ?? 0.7;
  const g = ctx.createGain();
  g.gain.value = o.gain;
  if (o.lfoRate) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = o.lfoDepth ?? o.gain * 0.5;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start(0);
    lfo.stop(o.dur);
  }
  src.connect(f).connect(g).connect(dest);
  src.start(0);
  src.stop(o.dur);
}

/** Midi note number -> Hz. */
export const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export function makeOfflineCtx(duration: number, channels = 2, sampleRate = 44100): OfflineAudioContext {
  return new OfflineAudioContext(channels, Math.ceil(duration * sampleRate), sampleRate);
}

let sharedCtx: AudioContext | null = null;

/** One shared realtime context for previewing audio. */
export function audioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}
