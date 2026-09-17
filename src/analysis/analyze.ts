/**
 * Clip analysis: turn a clip into signals the auto-editor can reason about.
 *
 * Everything here is deterministic signal processing — no model calls. Frames are
 * sampled at 6fps and reduced to motion, motion centroid (used for smart cropping),
 * sharpness, brightness and histogram novelty; audio is reduced to an energy envelope
 * plus onset strength. Candidate "moments" are then scored and non-max suppressed.
 */

import type { ClipSource } from '../media/clip';
import { clamp, clamp01, mean, sliceMax, sliceMean } from '../lib/utils';

export const SAMPLE_FPS = 6;
const AW = 96;
const AH = 170;
const HIST_BINS = 4; // per channel -> 64 buckets

export interface MomentBreakdown {
  motion: number;
  audio: number;
  novelty: number;
  sharpness: number;
  exposure: number;
}

export interface Moment {
  id: string;
  clipId: string;
  /** Source in-point, seconds. */
  start: number;
  duration: number;
  /** 0..1 engagement estimate. */
  score: number;
  breakdown: MomentBreakdown;
  reasons: string[];
  /** Horizontal centre of interest, 0..1, used when cropping to 9:16. */
  framing: number;
}

export interface ClipAnalysis {
  clipId: string;
  /** Human-readable clip name, so the decision log can talk about "Wave Break". */
  name: string;
  duration: number;
  times: number[];
  motion: number[];
  motionX: number[];
  sharpness: number[];
  brightness: number[];
  novelty: number[];
  audio: number[];
  onset: number[];
  sceneCuts: number[];
  moments: Moment[];
  /** Best moment score in this clip. */
  peak: number;
  hasAudio: boolean;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = clamp(Math.floor(sorted.length * p), 0, sorted.length - 1);
  return sorted[idx];
}

function normalise(values: number[], softMaxPercentile = 0.92): number[] {
  const top = Math.max(1e-6, percentile(values, softMaxPercentile));
  return values.map((v) => clamp01(v / top));
}

/** Audio energy + onset strength resampled onto the frame time grid. */
function analyseAudio(buffer: AudioBuffer | null, times: number[]): { energy: number[]; onset: number[] } {
  const energy = new Array(times.length).fill(0);
  const onset = new Array(times.length).fill(0);
  if (!buffer) return { energy, onset };

  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const raw: number[] = [];
  for (let i = 0; i < times.length; i++) {
    const from = Math.max(0, Math.floor((times[i] - 0.5 / SAMPLE_FPS) * sr));
    const to = Math.min(data.length, Math.floor((times[i] + 0.5 / SAMPLE_FPS) * sr));
    let sum = 0;
    let n = 0;
    for (let s = from; s < to; s += 2) {
      sum += data[s] * data[s];
      n++;
    }
    raw.push(n ? Math.sqrt(sum / n) : 0);
  }

  const normalisedEnergy = normalise(raw, 0.95);
  // Onset = energy rising above its recent local average.
  for (let i = 0; i < raw.length; i++) {
    const past = sliceMean(normalisedEnergy, i - 4, i - 1);
    onset[i] = clamp01((normalisedEnergy[i] - past) * 2.2);
    energy[i] = normalisedEnergy[i];
  }
  return { energy, onset };
}

export interface AnalyzeOptions {
  onProgress?: (fraction: number) => void;
}

export async function analyzeClip(clip: ClipSource, opts: AnalyzeOptions = {}): Promise<ClipAnalysis> {
  const duration = clip.duration;
  const count = Math.max(2, Math.floor(duration * SAMPLE_FPS));
  const times: number[] = [];
  for (let i = 0; i < count; i++) times.push(Math.min(duration - 1 / 60, i / SAMPLE_FPS));

  const canvas = document.createElement('canvas');
  canvas.width = AW;
  canvas.height = AH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const rawMotion: number[] = [];
  const motionX: number[] = [];
  const sharpness: number[] = [];
  const brightness: number[] = [];
  const rawNovelty: number[] = [];

  let prevGray: Float32Array | null = null;
  let prevHist: Float32Array | null = null;

  await clip.sampleFrames(times, AW, AH, (index, image) => {
    if (!image) {
      rawMotion.push(0);
      motionX.push(0.5);
      sharpness.push(0);
      brightness.push(0);
      rawNovelty.push(0);
      return;
    }
    ctx.drawImage(image, 0, 0, AW, AH);
    const { data } = ctx.getImageData(0, 0, AW, AH);
    const gray = new Float32Array(AW * AH);
    const hist = new Float32Array(HIST_BINS ** 3);
    let bright = 0;

    for (let i = 0, px = 0; i < data.length; i += 4, px++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[px] = lum;
      bright += lum;
      const bin =
        Math.min(HIST_BINS - 1, (r * HIST_BINS) >> 8) * HIST_BINS * HIST_BINS +
        Math.min(HIST_BINS - 1, (g * HIST_BINS) >> 8) * HIST_BINS +
        Math.min(HIST_BINS - 1, (b * HIST_BINS) >> 8);
      hist[bin] += 1;
    }
    brightness.push(bright / (AW * AH) / 255);

    // Laplacian energy ~ focus / detail.
    let edge = 0;
    for (let y = 1; y < AH - 1; y++) {
      for (let x = 1; x < AW - 1; x++) {
        const i = y * AW + x;
        edge += Math.abs(4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - AW] - gray[i + AW]);
      }
    }
    sharpness.push(edge / ((AW - 2) * (AH - 2)) / 64);

    if (prevGray) {
      let diffSum = 0;
      let weightedX = 0;
      for (let y = 0; y < AH; y++) {
        for (let x = 0; x < AW; x++) {
          const i = y * AW + x;
          const d = Math.abs(gray[i] - prevGray[i]);
          diffSum += d;
          weightedX += d * x;
        }
      }
      rawMotion.push(diffSum / (AW * AH) / 255);
      motionX.push(diffSum > 1e-3 ? clamp01(weightedX / diffSum / AW) : 0.5);
    } else {
      rawMotion.push(0);
      motionX.push(0.5);
    }

    if (prevHist) {
      let chi = 0;
      const total = AW * AH;
      for (let i = 0; i < hist.length; i++) {
        const a = hist[i] / total;
        const b = prevHist[i] / total;
        const denom = a + b;
        if (denom > 1e-6) chi += ((a - b) * (a - b)) / denom;
      }
      rawNovelty.push(clamp01(chi * 1.6));
    } else {
      rawNovelty.push(0);
    }

    prevGray = gray;
    prevHist = hist;
    if (index % 6 === 0) opts.onProgress?.(index / times.length);
  });

  opts.onProgress?.(1);

  const motion = normalise(rawMotion, 0.94);
  const novelty = normalise(rawNovelty, 0.96);
  const sharpNorm = normalise(sharpness, 0.9);
  const { energy, onset } = analyseAudio(clip.audioBuffer, times);

  const sceneCuts: number[] = [];
  for (let i = 1; i < novelty.length; i++) {
    if (novelty[i] > 0.62 && motion[i] > 0.45 && (sceneCuts.length === 0 || times[i] - sceneCuts[sceneCuts.length - 1] > 0.7)) {
      sceneCuts.push(times[i]);
    }
  }

  const moments = findMoments({
    clipId: clip.id,
    times,
    motion,
    motionX,
    novelty,
    sharpness: sharpNorm,
    brightness,
    onset,
    sceneCuts,
    duration,
    hasAudio: !!clip.audioBuffer,
  });

  return {
    clipId: clip.id,
    name: clip.name,
    duration,
    times,
    motion,
    motionX,
    sharpness: sharpNorm,
    brightness,
    novelty,
    audio: energy,
    onset,
    sceneCuts,
    moments,
    peak: moments.length ? moments[0].score : 0,
    hasAudio: !!clip.audioBuffer,
  };
}

interface MomentInput {
  clipId: string;
  times: number[];
  motion: number[];
  motionX: number[];
  novelty: number[];
  sharpness: number[];
  brightness: number[];
  onset: number[];
  sceneCuts: number[];
  duration: number;
  hasAudio: boolean;
}

const WINDOW = 1.4;
const HOP = 0.25;

/**
 * Weights for the engagement score. Tuned so that "something is moving, it's in
 * focus, and the soundtrack spikes" beats "pretty but static".
 */
export const MOMENT_WEIGHTS = {
  motion: 0.34,
  audio: 0.2,
  novelty: 0.14,
  sharpness: 0.18,
  exposure: 0.14,
};

function findMoments(input: MomentInput): Moment[] {
  const { times, motion, motionX, novelty, sharpness, brightness, onset, duration } = input;
  const idxAt = (t: number) => clamp(Math.round(t * SAMPLE_FPS), 0, times.length - 1);
  const candidates: Moment[] = [];
  const window = Math.min(WINDOW, Math.max(0.6, duration * 0.35));

  for (let start = 0; start + window <= duration + 1e-3; start += HOP) {
    const a = idxAt(start);
    const b = idxAt(start + window);
    const mMotion = sliceMean(motion, a, b);
    const mAudio = input.hasAudio ? sliceMax(onset, a, b) * 0.65 + sliceMean(input.onset, a, b) * 0.35 : 0.25;
    const mNovelty = sliceMax(novelty, a, b);
    const mSharp = sliceMean(sharpness, a, b);
    const mBright = sliceMean(brightness, a, b);
    const exposure = clamp01(1 - Math.abs(mBright - 0.52) * 2.4);

    let score =
      MOMENT_WEIGHTS.motion * mMotion +
      MOMENT_WEIGHTS.audio * mAudio +
      MOMENT_WEIGHTS.novelty * mNovelty +
      MOMENT_WEIGHTS.sharpness * mSharp +
      MOMENT_WEIGHTS.exposure * exposure;

    const reasons: string[] = [];
    if (mMotion > 0.55) reasons.push(`strong movement (${Math.round(mMotion * 100)}%)`);
    if (mAudio > 0.5) reasons.push('audio spike');
    if (mNovelty > 0.55) reasons.push('the frame changes');
    if (mSharp > 0.6) reasons.push('sharp detail');

    if (mBright < 0.14) {
      score -= 0.22;
      reasons.push('underexposed');
    }
    if (mSharp < 0.16) {
      score -= 0.18;
      reasons.push('soft focus');
    }
    if (mMotion < 0.06) {
      score -= 0.12;
      reasons.push('static shot');
    }
    // A hard cut in the middle of a shot reads as a mistake.
    const cutInside = input.sceneCuts.some((c) => c > start + 0.25 && c < start + window - 0.2);
    if (cutInside) score -= 0.14;

    candidates.push({
      id: `${input.clipId}@${start.toFixed(2)}`,
      clipId: input.clipId,
      start,
      duration: window,
      score: clamp01(score),
      breakdown: {
        motion: mMotion,
        audio: mAudio,
        novelty: mNovelty,
        sharpness: mSharp,
        exposure,
      },
      reasons,
      framing: clamp(mean(motionX.slice(a, Math.max(a + 1, b))), 0.28, 0.72),
    });
  }

  // Non-max suppression so we get distinct highlights rather than 20 neighbours.
  const picked: Moment[] = [];
  for (const cand of [...candidates].sort((x, y) => y.score - x.score)) {
    if (picked.some((p) => Math.abs(p.start - cand.start) < window * 0.62)) continue;
    picked.push(cand);
    if (picked.length >= 14) break;
  }
  return picked.sort((a, b) => b.score - a.score);
}
