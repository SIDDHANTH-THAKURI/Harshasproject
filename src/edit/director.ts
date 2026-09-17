/**
 * The auto-edit engine.
 *
 * Hybrid by design: deterministic signal analysis picks *where* the good moments are
 * and the music grid decides *when* cuts land, while the rules below decide the shape
 * of the story — hook first, breather, build, peak, payoff. Every decision is logged
 * so the UI can explain the cut instead of presenting a black box.
 *
 * An LLM pass would slot in at `chooseMoment` (semantic ranking of moments) and at
 * `buildCaptions` (writing the words) without changing the EDL contract.
 */

import type { ClipAnalysis, Moment } from '../analysis/analyze';
import { clamp, clamp01, lerp, mulberry32, nearestIn, uid } from '../lib/utils';
import { beatGrid, musicById } from '../media/music';
import { getTemplate, instantiate, type AssetInstance } from '../motion/registry';
import { DESIGN_H, DESIGN_W } from '../motion/types';
import { buildReport } from './score';
import type { EditStyle } from './styles';
import type {
  Decision,
  EditPlan,
  OverlayPlacement,
  Segment,
  TransitionType,
} from './types';

export interface DirectInput {
  analyses: ClipAnalysis[];
  style: EditStyle;
  trackId: string | null;
  targetDuration: number;
  /** Assets the user picked in the library. */
  assets: AssetInstance[];
  script: string;
  hookText: string;
  ctaText: string;
  accent: string;
  seed: number;
  captionsEnabled: boolean;
  fps?: number;
}

const MAX_TRANSITION = 0.28;

function nextBeatAfter(beats: number[], t: number): number {
  for (const b of beats) if (b > t + 1e-4) return b;
  return t;
}

function weightedPick<T extends { weight: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

interface Used {
  clipId: string;
  from: number;
  to: number;
}

function overlapRatio(a: Used, from: number, to: number): number {
  const start = Math.max(a.from, from);
  const end = Math.min(a.to, to);
  return Math.max(0, end - start) / Math.max(0.001, to - from);
}

export function directEdit(input: DirectInput): EditPlan {
  const {
    analyses,
    style,
    targetDuration,
    assets,
    script,
    hookText,
    ctaText,
    accent,
    seed,
    captionsEnabled,
  } = input;
  const fps = input.fps ?? 30;
  const rng = mulberry32(seed);
  const decisions: Decision[] = [];
  const note = (kind: Decision['kind'], t: number | null, title: string, detail: string) =>
    decisions.push({ id: uid('dec'), kind, t, title, detail });

  const track = input.trackId ? musicById(input.trackId) : null;
  const bpm = track?.bpm ?? 120;
  const beats = beatGrid(bpm, targetDuration + 6, style.beatSubdivision);
  const analysisById = new Map(analyses.map((a) => [a.clipId, a]));

  if (track) {
    note(
      'music',
      null,
      `${track.name} · ${bpm} BPM`,
      `Cut points snap to a ${style.beatSubdivision === 1 ? 'quarter' : style.beatSubdivision === 2 ? 'eighth' : 'sixteenth'}-note grid (${(60 / bpm / style.beatSubdivision).toFixed(2)}s apart), so every edit lands with the track.`,
    );
  }

  /* ---------------------------- pick the shots ---------------------------- */

  const pool: Moment[] = analyses.flatMap((a) => a.moments);
  const best = pool.reduce((m, c) => (c.score > m.score ? c : m), pool[0]);
  const topScore = best?.score ?? 1;
  const used: Used[] = [];
  const clipUsage = new Map<string, number>();
  const segments: Segment[] = [];

  const chooseMoment = (
    slotStart: number,
    shotLen: number,
    prevClipId: string | null,
    isHook: boolean,
  ): Moment | null => {
    const p = clamp01(slotStart / targetDuration);
    const target = style.energy(p);
    let bestPick: { moment: Moment; fit: number } | null = null;

    for (const moment of pool) {
      const analysis = analysisById.get(moment.clipId);
      if (!analysis) continue;
      const srcIn = clamp(
        moment.start + (moment.duration - shotLen) * 0.3,
        0,
        Math.max(0, analysis.duration - shotLen),
      );
      const srcOut = srcIn + shotLen;
      if (srcOut > analysis.duration + 1e-3) continue;

      const reuse = used
        .filter((u) => u.clipId === moment.clipId)
        .reduce((max, u) => Math.max(max, overlapRatio(u, srcIn, srcOut)), 0);
      if (reuse > 0.34) continue;

      const norm = topScore > 0 ? moment.score / topScore : moment.score;
      let fit = isHook ? norm : 1 - Math.abs(norm - target) * 0.9;
      fit += norm * 0.25;
      if (!isHook && prevClipId === moment.clipId && analyses.length > 1) fit -= 0.3;
      fit -= (clipUsage.get(moment.clipId) ?? 0) * 0.04;
      fit -= reuse * 0.5;

      if (!bestPick || fit > bestPick.fit) bestPick = { moment, fit };
    }
    return bestPick?.moment ?? null;
  };

  let cursor = 0;
  let guard = 0;
  while (cursor < targetDuration - 0.12 && guard++ < 120) {
    const p = cursor / targetDuration;
    const base = lerp(style.shotStart, style.shotEnd, p) * (1 + (rng() - 0.5) * style.shotJitter);
    let end = nearestIn(beats, cursor + base);
    if (end - cursor < style.minShot) end = nextBeatAfter(beats, cursor + style.minShot * 0.9);
    if (end > targetDuration - 0.18) end = targetDuration;
    const shotLen = Math.max(style.minShot * 0.8, end - cursor);

    const prevClipId = segments.length ? segments[segments.length - 1].clipId : null;
    const moment = chooseMoment(cursor, shotLen, prevClipId, segments.length === 0);
    if (!moment) break;
    const analysis = analysisById.get(moment.clipId)!;
    const srcIn = clamp(
      moment.start + (moment.duration - shotLen) * 0.3,
      0,
      Math.max(0, analysis.duration - shotLen),
    );

    const scoreNorm = topScore > 0 ? moment.score / topScore : moment.score;
    const effectRoll = rng();
    const effect: Segment['effect'] =
      scoreNorm > 0.72 || segments.length === 0
        ? { type: 'punch-in', amount: 0.05 + 0.07 * style.effectIntensity, dir: rng() > 0.5 ? 1 : -1 }
        : effectRoll > 0.55
          ? { type: 'drift', amount: 0.03 + 0.04 * style.effectIntensity, dir: rng() > 0.5 ? 1 : -1 }
          : { type: 'pull-out', amount: 0.04 + 0.05 * style.effectIntensity, dir: 1 };

    let transition: { type: TransitionType; duration: number } = { type: 'cut', duration: 0 };
    if (segments.length > 0) {
      const prev = segments[segments.length - 1];
      const delta = Math.abs(scoreNorm - (topScore > 0 ? prev.score / topScore : prev.score));
      const wantsTransition = rng() < style.transitionRate + delta * 0.3;
      if (wantsTransition) {
        const options = style.transitions.filter((t) => t.type !== 'cut');
        const pick = weightedPick(options.length ? options : style.transitions, rng);
        const dur = Math.min(MAX_TRANSITION, shotLen * 0.35, prev.duration * 0.35);
        transition = { type: pick.type, duration: Math.max(0.08, dur) };
      }
    }

    const segment: Segment = {
      id: uid('seg'),
      clipId: moment.clipId,
      srcIn,
      srcOut: srcIn + shotLen,
      start: cursor,
      duration: shotLen,
      speed: 1,
      framing: moment.framing,
      effect,
      transitionIn: transition,
      score: moment.score,
      reason: moment.reasons.length ? moment.reasons.join(', ') : 'best remaining moment',
    };
    segments.push(segment);
    used.push({ clipId: moment.clipId, from: srcIn, to: srcIn + shotLen });
    clipUsage.set(moment.clipId, (clipUsage.get(moment.clipId) ?? 0) + 1);

    if (segments.length === 1) {
      note(
        'hook',
        0,
        'Opened on the strongest moment',
        `“${analysis.name}” at ${srcIn.toFixed(1)}s scored ${Math.round(moment.score * 100)}/100 — ${segment.reason}. The payoff sits ${(moment.duration * 0.3).toFixed(1)}s in, so it lands before anyone can scroll.`,
      );
    } else {
      note(
        'cut',
        cursor,
        `Cut ${segments.length} · ${shotLen.toFixed(2)}s`,
        `“${analysis.name}” at ${srcIn.toFixed(1)}s (${Math.round(moment.score * 100)}/100${segment.reason ? `, ${segment.reason}` : ''}). Target energy here is ${Math.round(style.energy(p) * 100)}%.`,
      );
    }
    if (transition.type !== 'cut') {
      note(
        'effect',
        cursor,
        `${transition.type} transition`,
        `Energy jump between shots, so the cut gets a ${transition.duration.toFixed(2)}s ${transition.type}.`,
      );
    }
    cursor = end;
  }

  if (!segments.length) {
    throw new Error('Not enough usable footage to build an edit.');
  }

  // Land exactly on the target length.
  const last = segments[segments.length - 1];
  last.duration = Math.max(0.3, targetDuration - last.start);
  last.srcOut = last.srcIn + last.duration;
  const duration = last.start + last.duration;

  const beatsHit = segments.slice(1).filter((s) => beats.some((b) => Math.abs(b - s.start) < 0.07)).length;
  note(
    'beat',
    null,
    `${beatsHit}/${Math.max(1, segments.length - 1)} cuts on the beat`,
    `Shot lengths ride the style curve (${style.shotStart.toFixed(1)}s → ${style.shotEnd.toFixed(1)}s) and then snap to the nearest beat.`,
  );
  note(
    'arc',
    null,
    'Energy arc applied',
    'Hook peaks immediately, drops for a breather, then climbs to the biggest moment around 75% before the payoff.',
  );

  /* ------------------------------- overlays ------------------------------- */

  const overlays: OverlayPlacement[] = [];
  const place = (
    templateId: string,
    role: OverlayPlacement['role'],
    start: number,
    params: Record<string, string | number | boolean>,
    reason: string,
    durationOverride?: number,
  ) => {
    const template = getTemplate(templateId);
    if (!template) return;
    const asset = instantiate(template, { params });
    const dur = durationOverride ?? template.duration;
    overlays.push({
      id: uid('ov'),
      role,
      asset: { ...asset, duration: dur },
      start: clamp(start, 0, Math.max(0, duration - 0.2)),
      duration: Math.min(dur, duration - clamp(start, 0, duration)),
      editableText: role === 'caption',
      reason,
    });
  };

  // Style look (grain, leak, frame) runs the whole way.
  const userLook = assets.find((a) => getTemplate(a.templateId)?.category === 'look');
  const lookId = userLook?.templateId ?? style.lookTemplate;
  if (lookId) {
    const template = getTemplate(lookId);
    if (template) {
      overlays.push({
        id: uid('ov'),
        role: 'look',
        asset: { ...instantiate(template, { params: userLook?.params }), duration },
        start: 0,
        duration,
        reason: 'Style look, applied across the whole cut.',
      });
      note('overlay', null, `${template.name} look`, `${style.name} applies this across the full ${duration.toFixed(1)}s.`);
    }
  }

  // Hook title.
  const userHook = assets.find((a) => getTemplate(a.templateId)?.category === 'hook');
  const hookTemplateId = userHook?.templateId ?? style.hookTemplate;
  if (hookText.trim()) {
    const hookTemplate = getTemplate(hookTemplateId);
    const params: Record<string, string | number | boolean> = { ...(userHook?.params ?? {}) };
    if (hookTemplate?.params.some((p) => p.key === 'text')) params.text = hookText;
    if (hookTemplate?.params.some((p) => p.key === 'accent') && !userHook) params.accent = accent;
    const hookDur = Math.min(hookTemplate?.duration ?? 2.2, duration * 0.35);
    place(hookTemplateId, 'hook', 0.12, params, 'Hook text over the opening shot.', hookDur);
    note(
      'overlay',
      0.12,
      'Hook card on the first shot',
      `"${hookText}" holds for ${hookDur.toFixed(1)}s — long enough to read, short enough to stay out of the way.`,
    );
  }

  // Captions from the script, timed to beats.
  if (captionsEnabled && script.trim()) {
    const captionTemplateId =
      assets.find((a) => getTemplate(a.templateId)?.category === 'caption')?.templateId ?? style.captionTemplate;
    const userCaption = assets.find((a) => a.templateId === captionTemplateId);
    const cues = splitScript(script);
    let t = Math.max(0.3, hookText.trim() ? Math.min(2.4, duration * 0.3) : 0.3);
    const endLimit = duration - 1.2;
    let placed = 0;
    for (const cue of cues) {
      if (t >= endLimit) break;
      const words = cue.split(/\s+/).length;
      const wanted = clamp(words * 0.36, 1.1, 3.4);
      let cueEnd = nearestIn(beats, t + wanted);
      if (cueEnd - t < 0.9) cueEnd = nextBeatAfter(beats, t + 0.9);
      cueEnd = Math.min(cueEnd, endLimit + 0.8);
      const params: Record<string, string | number | boolean> = {
        ...(userCaption?.params ?? {}),
        text: cue,
      };
      if (!userCaption) params.accent = accent;
      place(captionTemplateId, 'caption', t, params, 'Script line, beat-timed.', cueEnd - t);
      t = cueEnd + 0.06;
      placed++;
    }
    if (placed) {
      note(
        'caption',
        null,
        `${placed} caption cues`,
        `Script split into ${placed} lines and stretched to beat boundaries. Words sit at 66% height, clear of the platform UI.`,
      );
    }
  }

  // Stickers land on the best moments.
  const peakSegments = [...segments].sort((a, b) => b.score - a.score).slice(0, 2);
  const userStickers = assets.filter((a) => {
    const cat = getTemplate(a.templateId)?.category;
    return cat === 'sticker' || cat === 'lower-third' || cat === 'background';
  });
  const stickerIds = userStickers.length
    ? userStickers.map((a) => a.templateId)
    : style.stickerTemplates.slice(0, 1);

  stickerIds.forEach((id, i) => {
    const template = getTemplate(id);
    if (!template) return;
    const user = userStickers.find((a) => a.templateId === id);
    const params: Record<string, string | number | boolean> = { ...(user?.params ?? {}) };
    if (!user && template.params.some((p) => p.key === 'accent')) params.accent = accent;

    if (template.placement === 'full') {
      place(id, 'sticker', 0, params, 'Runs the full length.', duration);
      note('overlay', 0, `${template.name}`, 'Pinned across the whole video.');
      return;
    }
    const target = peakSegments[i % Math.max(1, peakSegments.length)];
    const at = target ? target.start + Math.min(0.15, target.duration * 0.2) : duration * 0.5;
    place(id, template.category === 'lower-third' ? 'lower-third' : 'sticker', at, params, 'Dropped on a peak moment.');
    note(
      'overlay',
      at,
      `${template.name} at ${at.toFixed(1)}s`,
      `Placed on the ${Math.round((target?.score ?? 0) * 100)}/100 moment so the graphic hits with the footage.`,
    );
  });

  // End card.
  const userCta = assets.find((a) => getTemplate(a.templateId)?.category === 'cta');
  const ctaTemplateId = userCta?.templateId ?? style.ctaTemplate;
  if (ctaText.trim()) {
    const ctaTemplate = getTemplate(ctaTemplateId);
    const ctaDur = Math.min(ctaTemplate?.duration ?? 2.6, duration * 0.3);
    const params: Record<string, string | number | boolean> = { ...(userCta?.params ?? {}) };
    if (ctaTemplate?.params.some((p) => p.key === 'line')) params.line = ctaText;
    else if (ctaTemplate?.params.some((p) => p.key === 'text')) params.text = ctaText;
    if (!userCta && ctaTemplate?.params.some((p) => p.key === 'accent')) params.accent = accent;
    place(ctaTemplateId, 'cta', duration - ctaDur, params, 'End card.', ctaDur);
    note(
      'overlay',
      duration - ctaDur,
      'End card',
      `"${ctaText}" appears with ${ctaDur.toFixed(1)}s left, while the last shot is still moving.`,
    );
  }

  /* -------------------------------- wrap up ------------------------------- */

  const report = buildReport({
    segments,
    overlays,
    beats,
    duration,
    style,
    analyses: analysisById,
    hasMusic: !!track,
    clipCount: analyses.length,
  });

  return {
    id: uid('plan'),
    createdAt: Date.now(),
    width: DESIGN_W,
    height: DESIGN_H,
    fps,
    duration,
    styleId: style.id,
    seed,
    segments,
    overlays,
    music: track ? { trackId: track.id, bpm, gain: style.musicGain, clipGain: style.clipAudioGain } : null,
    beats,
    decisions,
    report,
    clipIds: analyses.map((a) => a.clipId),
  };
}

/** Break a script into caption-sized cues (max ~6 words). */
export function splitScript(script: string, maxWords = 6): string[] {
  const phrases = script
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const cues: string[] = [];
  for (const phrase of phrases) {
    const words = phrase.replace(/[.]+$/, '').split(/\s+/);
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords).join(' ');
      if (chunk) cues.push(chunk);
    }
  }
  return cues;
}
