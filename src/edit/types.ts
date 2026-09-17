/**
 * The edit decision list (EDL).
 *
 * This is the contract between every part of the pipeline: the director writes it,
 * the player and the exporter read it, the UI explains it. A server-side renderer or
 * an LLM pass can be slotted in later without touching anything else.
 */

import type { AssetInstance } from '../motion/registry';

export type TransitionType = 'cut' | 'dissolve' | 'whip' | 'flash' | 'zoom-punch' | 'glitch';

export const TRANSITION_LABELS: Record<TransitionType, string> = {
  cut: 'Hard cut',
  dissolve: 'Dissolve',
  whip: 'Whip pan',
  flash: 'Flash',
  'zoom-punch': 'Zoom punch',
  glitch: 'Glitch slice',
};

export type EffectType = 'none' | 'punch-in' | 'pull-out' | 'drift';

export interface Segment {
  id: string;
  clipId: string;
  /** Source in/out points in the clip's own timeline. */
  srcIn: number;
  srcOut: number;
  /** Position on the output timeline. */
  start: number;
  duration: number;
  speed: number;
  /** Horizontal crop centre 0..1 when the source isn't already 9:16. */
  framing: number;
  effect: { type: EffectType; amount: number; dir: number };
  transitionIn: { type: TransitionType; duration: number };
  /** Engagement score of the moment this segment came from. */
  score: number;
  reason: string;
}

export type OverlayRole = 'hook' | 'caption' | 'sticker' | 'cta' | 'look' | 'background' | 'lower-third';

export interface OverlayPlacement {
  id: string;
  role: OverlayRole;
  asset: AssetInstance;
  start: number;
  duration: number;
  /** Set for captions so the editor can treat them as a script. */
  editableText?: boolean;
  reason?: string;
}

export type DecisionKind =
  | 'hook'
  | 'cut'
  | 'beat'
  | 'effect'
  | 'caption'
  | 'overlay'
  | 'music'
  | 'arc'
  | 'reject';

export interface Decision {
  id: string;
  t: number | null;
  kind: DecisionKind;
  title: string;
  detail: string;
}

export interface EngagementReport {
  overall: number;
  hook: number;
  pacing: number;
  variety: number;
  beatSync: number;
  payoff: number;
  notes: string[];
  /** Predicted attention over the timeline, 0..1 per sample. */
  curve: { t: number; value: number }[];
  risks: { t: number; note: string }[];
}

export interface EditPlan {
  id: string;
  createdAt: number;
  width: number;
  height: number;
  fps: number;
  duration: number;
  styleId: string;
  seed: number;
  segments: Segment[];
  overlays: OverlayPlacement[];
  music: { trackId: string; bpm: number; gain: number; clipGain: number } | null;
  beats: number[];
  decisions: Decision[];
  report: EngagementReport;
  clipIds: string[];
}
