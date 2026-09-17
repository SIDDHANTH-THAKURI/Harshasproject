/**
 * Edit recipes.
 *
 * A "template" in the product sense: pacing, transition palette, caption look, music
 * choice and the shape of the energy arc. The director reads these instead of having
 * the rules hard-coded, so adding a new look is a data change.
 */

import { clamp01 } from '../lib/utils';
import type { TransitionType } from './types';

export interface EditStyle {
  id: string;
  name: string;
  blurb: string;
  tags: string[];
  /** Shot length in seconds at the start and end of the video. */
  shotStart: number;
  shotEnd: number;
  shotJitter: number;
  minShot: number;
  /** 1 = snap cuts to quarter notes, 2 = eighths, 4 = sixteenths. */
  beatSubdivision: number;
  transitions: { type: TransitionType; weight: number }[];
  /** Fraction of cuts that get a transition rather than a hard cut. */
  transitionRate: number;
  effectIntensity: number;
  hookTemplate: string;
  captionTemplate: string;
  ctaTemplate: string;
  stickerTemplates: string[];
  lookTemplate?: string;
  music: string[];
  musicGain: number;
  clipAudioGain: number;
  accent: string;
  /** Target engagement at a given point in the timeline, 0..1. */
  energy: (p: number) => number;
}

/** Piecewise-linear curve through control points. */
function curve(points: [number, number][]): (p: number) => number {
  return (p: number) => {
    const x = clamp01(p);
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      if (x >= x0 && x <= x1) {
        const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
        return y0 + (y1 - y0) * t;
      }
    }
    return points[points.length - 1][1];
  };
}

export const EDIT_STYLES: EditStyle[] = [
  {
    id: 'hype-montage',
    name: 'Hype Montage',
    blurb: 'Fast cuts on every beat, punch-ins on the peaks, karaoke captions.',
    tags: ['fast', 'hype', 'fitness', 'travel'],
    shotStart: 1.1,
    shotEnd: 0.62,
    shotJitter: 0.18,
    minShot: 0.45,
    beatSubdivision: 2,
    transitions: [
      { type: 'cut', weight: 5 },
      { type: 'whip', weight: 3 },
      { type: 'flash', weight: 2 },
      { type: 'zoom-punch', weight: 2 },
    ],
    transitionRate: 0.42,
    effectIntensity: 0.9,
    hookTemplate: 'hook-punch-title',
    captionTemplate: 'caption-karaoke-pop',
    ctaTemplate: 'cta-follow',
    stickerTemplates: ['sticker-spark-burst', 'sticker-progress-bar'],
    music: ['hype-trap', 'house-lift', 'neon-drive'],
    musicGain: 0.85,
    clipAudioGain: 0.25,
    accent: '#ff3d81',
    energy: curve([
      [0, 0.97],
      [0.14, 0.6],
      [0.4, 0.78],
      [0.72, 1],
      [0.88, 0.82],
      [1, 0.7],
    ]),
  },
  {
    id: 'trend-remix',
    name: 'Trend Remix',
    blurb: 'Sixteenth-note cuts, glitch transitions, everything on the grid.',
    tags: ['fast', 'glitch', 'gaming', 'music'],
    shotStart: 0.8,
    shotEnd: 0.42,
    shotJitter: 0.12,
    minShot: 0.32,
    beatSubdivision: 4,
    transitions: [
      { type: 'cut', weight: 4 },
      { type: 'glitch', weight: 4 },
      { type: 'flash', weight: 2 },
      { type: 'zoom-punch', weight: 3 },
    ],
    transitionRate: 0.55,
    effectIntensity: 1,
    hookTemplate: 'hook-neon-sign',
    captionTemplate: 'caption-glitch-type',
    ctaTemplate: 'cta-follow',
    stickerTemplates: ['sticker-spark-burst'],
    lookTemplate: 'look-vhs',
    music: ['hype-trap', 'neon-drive'],
    musicGain: 0.9,
    clipAudioGain: 0.15,
    accent: '#22d3ee',
    energy: curve([
      [0, 1],
      [0.12, 0.72],
      [0.5, 0.86],
      [0.8, 1],
      [1, 0.8],
    ]),
  },
  {
    id: 'story-vlog',
    name: 'Story Vlog',
    blurb: 'Breathing room between beats, location tags, softer transitions.',
    tags: ['vlog', 'travel', 'calm'],
    shotStart: 2.4,
    shotEnd: 1.5,
    shotJitter: 0.25,
    minShot: 1,
    beatSubdivision: 1,
    transitions: [
      { type: 'cut', weight: 6 },
      { type: 'dissolve', weight: 3 },
      { type: 'whip', weight: 1 },
    ],
    transitionRate: 0.3,
    effectIntensity: 0.45,
    hookTemplate: 'hook-split-reveal',
    captionTemplate: 'caption-boxed-clean',
    ctaTemplate: 'cta-follow',
    stickerTemplates: ['sticker-progress-bar'],
    lookTemplate: 'look-light-leak',
    music: ['lofi-walk', 'neon-drive'],
    musicGain: 0.6,
    clipAudioGain: 0.55,
    accent: '#7c5cff',
    energy: curve([
      [0, 0.9],
      [0.2, 0.55],
      [0.55, 0.7],
      [0.8, 0.92],
      [1, 0.65],
    ]),
  },
  {
    id: 'clean-explainer',
    name: 'Clean Explainer',
    blurb: 'Longer shots, readable subtitles, nothing flashy in the way.',
    tags: ['explainer', 'saas', 'minimal'],
    shotStart: 2.8,
    shotEnd: 2,
    shotJitter: 0.15,
    minShot: 1.4,
    beatSubdivision: 1,
    transitions: [
      { type: 'cut', weight: 7 },
      { type: 'dissolve', weight: 3 },
    ],
    transitionRate: 0.22,
    effectIntensity: 0.3,
    hookTemplate: 'hook-split-reveal',
    captionTemplate: 'caption-boxed-clean',
    ctaTemplate: 'cta-link-pill',
    stickerTemplates: ['sticker-arrow-scribble', 'sticker-circle-highlight'],
    lookTemplate: 'look-cine-frame',
    music: ['lofi-walk', 'house-lift'],
    musicGain: 0.45,
    clipAudioGain: 0.7,
    accent: '#38bdf8',
    energy: curve([
      [0, 0.85],
      [0.25, 0.6],
      [0.6, 0.68],
      [0.85, 0.85],
      [1, 0.6],
    ]),
  },
  {
    id: 'product-drop',
    name: 'Product Drop',
    blurb: 'Beat-locked reveals, stat counters and a hard CTA at the end.',
    tags: ['product', 'ecommerce', 'ad'],
    shotStart: 1.5,
    shotEnd: 0.9,
    shotJitter: 0.14,
    minShot: 0.6,
    beatSubdivision: 2,
    transitions: [
      { type: 'cut', weight: 5 },
      { type: 'zoom-punch', weight: 4 },
      { type: 'whip', weight: 2 },
      { type: 'flash', weight: 1 },
    ],
    transitionRate: 0.4,
    effectIntensity: 0.8,
    hookTemplate: 'hook-punch-title',
    captionTemplate: 'caption-karaoke-pop',
    ctaTemplate: 'cta-link-pill',
    stickerTemplates: ['sticker-stat-counter', 'sticker-spark-burst'],
    music: ['house-lift', 'hype-trap'],
    musicGain: 0.8,
    clipAudioGain: 0.3,
    accent: '#2fe6a8',
    energy: curve([
      [0, 0.95],
      [0.16, 0.62],
      [0.45, 0.8],
      [0.78, 1],
      [1, 0.88],
    ]),
  },
];

export const styleById = (id: string): EditStyle => EDIT_STYLES.find((s) => s.id === id) ?? EDIT_STYLES[0];
