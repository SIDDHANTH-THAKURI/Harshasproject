/**
 * How "engaging" gets measured.
 *
 * Short-form retention mostly comes down to five things we can actually compute from
 * an EDL: does the first second earn attention, does the cut rhythm match the style,
 * do cuts land on the music, is there visual variety, and does the end pay off. The
 * attention curve is a decay model — every cut, overlay and audio hit refreshes it.
 */

import { clamp01, mean } from '../lib/utils';
import type { ClipAnalysis } from '../analysis/analyze';
import type { EditStyle } from './styles';
import type { EditPlan, EngagementReport, OverlayPlacement, Segment } from './types';

const BEAT_TOLERANCE = 0.07;

interface ScoreInput {
  segments: Segment[];
  overlays: OverlayPlacement[];
  beats: number[];
  duration: number;
  style: EditStyle;
  analyses: Map<string, ClipAnalysis>;
  hasMusic: boolean;
  /** How many clips were available — variety is relative to what we had to work with. */
  clipCount: number;
}

function distinctCount<T>(items: T[]): number {
  return new Set(items).size;
}

/** Shannon entropy normalised to 0..1, used as a variety measure. */
function entropy(values: string[]): number {
  if (values.length <= 1) return 0;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let h = 0;
  for (const c of counts.values()) {
    const p = c / values.length;
    h -= p * Math.log2(p);
  }
  const max = Math.log2(Math.max(2, counts.size));
  return clamp01(h / max);
}

export function buildReport(input: ScoreInput): EngagementReport {
  const { segments, overlays, beats, duration, style, analyses, hasMusic } = input;
  const notes: string[] = [];

  // --- Hook: the first 1.5 seconds decide everything.
  const first = segments[0];
  const hookOverlay = overlays.find((o) => o.role === 'hook' && o.start < 1.2);
  let hook = first ? first.score * 0.62 : 0;
  if (hookOverlay) hook += 0.2;
  const firstAnalysis = first ? analyses.get(first.clipId) : undefined;
  if (first && firstAnalysis) {
    const idx = Math.round(first.srcIn * 6);
    const punch = Math.max(firstAnalysis.motion[idx] ?? 0, firstAnalysis.onset[idx] ?? 0);
    hook += punch * 0.18;
  }
  hook = clamp01(hook);
  if (hook < 0.55) notes.push('Hook is soft — try a louder opening moment or a bolder title card.');

  // --- Pacing: cuts per second against the style's own target.
  const targetShot = (style.shotStart + style.shotEnd) / 2;
  const actualShot = segments.length ? duration / segments.length : duration;
  const pacing = clamp01(1 - Math.min(1, Math.abs(actualShot - targetShot) / Math.max(0.35, targetShot)));
  if (pacing < 0.6) {
    notes.push(
      actualShot > targetShot
        ? 'Shots run long for this style — shorten the target length or add another clip.'
        : 'Cuts are faster than the style intends; shots may read as choppy.',
    );
  }

  // --- Beat sync: how many cuts land on the grid.
  const cuts = segments.slice(1).map((s) => s.start);
  const onBeat = cuts.filter((t) => beats.some((b) => Math.abs(b - t) <= BEAT_TOLERANCE));
  const beatSync = hasMusic && cuts.length ? onBeat.length / cuts.length : 0.5;

  // --- Variety: different clips, different effects, different transitions.
  const clipVariety = clamp01(distinctCount(segments.map((s) => s.clipId)) / Math.max(1, input.clipCount));
  const effectVariety = entropy(segments.map((s) => s.effect.type));
  const transitionVariety = entropy(segments.map((s) => s.transitionIn.type));
  const repeats = segments.filter((s, i) => i > 0 && segments[i - 1].clipId === s.clipId).length;
  const repeatPenalty = segments.length > 1 ? repeats / (segments.length - 1) : 0;
  const variety = clamp01(clipVariety * 0.4 + effectVariety * 0.3 + transitionVariety * 0.3 - repeatPenalty * 0.25);
  if (repeatPenalty > 0.5) notes.push('The same clip plays back-to-back a lot — add more footage for real variety.');

  // --- Payoff: does the back third still have energy, and is there a CTA?
  const tail = segments.filter((s) => s.start > duration * 0.66);
  const tailEnergy = tail.length ? mean(tail.map((s) => s.score)) : 0;
  const hasCta = overlays.some((o) => o.role === 'cta');
  const payoff = clamp01(tailEnergy * 0.7 + (hasCta ? 0.3 : 0));
  if (!hasCta) notes.push('No end card — viewers who make it to the end have nowhere to go.');

  // --- Attention curve: decays between events, jumps on cuts / overlays / peaks.
  const curve: { t: number; value: number }[] = [];
  const risks: { t: number; note: string }[] = [];
  const step = 0.25;
  let riskStart: number | null = null;

  for (let t = 0; t <= duration + 1e-6; t += step) {
    const seg = segments.find((s) => t >= s.start && t < s.start + s.duration) ?? segments[segments.length - 1];
    if (!seg) break;
    const sinceCut = t - seg.start;
    const freshness = Math.exp(-sinceCut / Math.max(0.9, targetShot * 1.6));
    const overlayLive = overlays.some((o) => o.role !== 'look' && t >= o.start && t < o.start + o.duration);
    const analysis = analyses.get(seg.clipId);
    const srcT = seg.srcIn + (t - seg.start) * seg.speed;
    const idx = Math.round(srcT * 6);
    const localMotion = analysis?.motion[idx] ?? 0.4;
    const value = clamp01(
      0.34 * seg.score + 0.28 * freshness + 0.16 * (overlayLive ? 1 : 0.25) + 0.22 * localMotion,
    );
    curve.push({ t, value });

    if (value < 0.42) {
      if (riskStart === null) riskStart = t;
    } else if (riskStart !== null) {
      if (t - riskStart >= 1) {
        risks.push({
          t: riskStart,
          note: `${riskStart.toFixed(1)}s–${t.toFixed(1)}s runs flat. Cut sooner, or put a caption or sticker here.`,
        });
      }
      riskStart = null;
    }
  }
  if (riskStart !== null && duration - riskStart >= 1) {
    risks.push({ t: riskStart, note: `${riskStart.toFixed(1)}s–${duration.toFixed(1)}s runs flat before the end.` });
  }

  const overall = clamp01(hook * 0.3 + pacing * 0.2 + beatSync * 0.15 + variety * 0.2 + payoff * 0.15);
  if (!notes.length) notes.push('Strong cut — hook, rhythm and payoff all line up.');

  return {
    overall: Math.round(overall * 100),
    hook: Math.round(hook * 100),
    pacing: Math.round(pacing * 100),
    variety: Math.round(variety * 100),
    beatSync: Math.round(beatSync * 100),
    payoff: Math.round(payoff * 100),
    notes,
    curve,
    risks: risks.slice(0, 4),
  };
}

/** Recompute a report for an existing plan (used after manual tweaks). */
export function rescore(
  plan: EditPlan,
  style: EditStyle,
  analyses: Map<string, ClipAnalysis>,
): EngagementReport {
  return buildReport({
    segments: plan.segments,
    overlays: plan.overlays,
    beats: plan.beats,
    duration: plan.duration,
    style,
    analyses,
    hasMusic: !!plan.music,
    clipCount: plan.clipIds.length,
  });
}
