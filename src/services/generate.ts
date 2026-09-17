/**
 * "Describe it" — the fallback when the library doesn't have what you want.
 *
 * Mocked, but not fake: the prompt is parsed into an intent (category, style tags,
 * palette, energy, literal text, numbers), every template is scored against it, and
 * the winner is *instantiated with parameters derived from the prompt*. Because motion
 * graphics are code, that produces a real, editable asset immediately.
 *
 * The response shape is what a model-backed endpoint would return, so swapping in a
 * real call later is a change to this file only. When confidence is low the UI offers
 * the (stubbed) generative-video escalation.
 */

import { PALETTES, type Palette } from '../lib/color';
import { sleep, titleCase } from '../lib/utils';
import { MOTION_TEMPLATES, instantiate, type AssetInstance } from '../motion/registry';
import type { MotionCategory, MotionTemplate, ParamValues } from '../motion/types';

export interface PromptIntent {
  category: MotionCategory | null;
  tags: string[];
  palette: Palette | null;
  text: string | null;
  number: number | null;
  energy: 1 | 2 | 3;
  keywords: string[];
}

export interface Candidate {
  template: MotionTemplate;
  asset: AssetInstance;
  score: number;
  reasons: string[];
}

export interface GenerationResult {
  prompt: string;
  intent: PromptIntent;
  primary: Candidate;
  alternates: Candidate[];
  confidence: number;
  /** True when nothing in the library was close, so we composed a variant instead. */
  composed: boolean;
}

const CATEGORY_WORDS: [MotionCategory, string[]][] = [
  ['caption', ['caption', 'captions', 'subtitle', 'subtitles', 'karaoke', 'words', 'talking', 'transcript']],
  ['hook', ['title', 'hook', 'headline', 'intro', 'opener', 'quote', 'countdown', 'card', 'text']],
  ['lower-third', ['lower third', 'name tag', 'nametag', 'location', 'credit', 'chapter', 'tag', 'badge']],
  ['sticker', ['sticker', 'arrow', 'circle', 'highlight', 'burst', 'spark', 'confetti', 'counter', 'stat', 'progress', 'emoji']],
  ['cta', ['cta', 'follow', 'subscribe', 'end card', 'endcard', 'outro', 'link in bio', 'swipe', 'button', 'shop', 'buy']],
  ['background', ['background', 'backdrop', 'gradient', 'particles', 'plate', 'loop']],
  ['look', ['look', 'filter', 'grain', 'vhs', 'leak', 'overlay', 'vignette', 'frame', 'border', 'scanlines']],
];

const HIGH_ENERGY = ['fast', 'hype', 'punchy', 'aggressive', 'loud', 'crazy', 'intense', 'energetic', 'bold', 'slam', 'hard'];
const LOW_ENERGY = ['calm', 'slow', 'soft', 'minimal', 'clean', 'subtle', 'gentle', 'elegant', 'quiet', 'simple'];

function extractQuoted(prompt: string): string | null {
  const quoted = prompt.match(/["“”'']([^"“”'']{2,80})["“”'']/);
  if (quoted) return quoted[1].trim();
  const saying = prompt.match(/\b(?:that says|saying|reading|with the words|text)\s+(.{2,60})$/i);
  if (saying) return saying[1].replace(/["“”'']/g, '').trim();
  return null;
}

export function parsePrompt(prompt: string): PromptIntent {
  const lower = ` ${prompt.toLowerCase().replace(/[^\w\s'"“”-]/g, ' ')} `;
  const words = lower.split(/\s+/).filter((w) => w.length > 2);

  let category: MotionCategory | null = null;
  let bestHits = 0;
  for (const [cat, terms] of CATEGORY_WORDS) {
    const hits = terms.filter((term) => lower.includes(` ${term} `) || lower.includes(`${term}s `)).length;
    if (hits > bestHits) {
      bestHits = hits;
      category = cat;
    }
  }

  const palette = PALETTES.find((p) => p.keywords.some((k) => lower.includes(` ${k}`))) ?? null;
  const energy: 1 | 2 | 3 = HIGH_ENERGY.some((w) => lower.includes(w))
    ? 3
    : LOW_ENERGY.some((w) => lower.includes(w))
      ? 1
      : 2;

  const numberMatch = prompt.match(/\b(\d[\d,]{0,9})\b/);
  const tagVocabulary = new Set(MOTION_TEMPLATES.flatMap((t) => t.tags));
  const tags = [...tagVocabulary].filter((tag) => lower.includes(tag));

  return {
    category,
    tags,
    palette,
    text: extractQuoted(prompt),
    number: numberMatch ? Number(numberMatch[1].replace(/,/g, '')) : null,
    energy,
    keywords: words,
  };
}

function scoreTemplate(template: MotionTemplate, intent: PromptIntent): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (intent.category && template.category === intent.category) {
    score += 3;
    reasons.push(`${intent.category.replace('-', ' ')} asset`);
  } else if (intent.category) {
    score -= 0.8;
  }

  const tagHits = template.tags.filter((t) => intent.tags.includes(t));
  if (tagHits.length) {
    score += tagHits.length * 1.15;
    reasons.push(`style: ${tagHits.join(', ')}`);
  }

  const keywordHits = template.keywords.filter((k) =>
    intent.keywords.some((w) => w === k || (k.length > 4 && w.startsWith(k.slice(0, 4)))),
  );
  if (keywordHits.length) {
    score += Math.min(3, keywordHits.length * 0.8);
    reasons.push(`matches “${keywordHits.slice(0, 3).join('”, “')}”`);
  }

  const nameHits = template.name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => intent.keywords.includes(w));
  if (nameHits.length) score += nameHits.length * 0.9;

  const energyGap = Math.abs(template.energy - intent.energy);
  score += (2 - energyGap) * 0.3;
  if (energyGap === 0) reasons.push(intent.energy === 3 ? 'high energy' : intent.energy === 1 ? 'calm' : 'balanced');

  if (intent.number !== null && template.params.some((p) => p.key === 'value')) {
    score += 1.2;
    reasons.push('takes a number');
  }
  if (intent.text && template.params.some((p) => p.key === 'text' || p.key === 'line' || p.key === 'label')) {
    score += 0.8;
  }

  return { score, reasons };
}

/** Fill a template's parameters from the prompt. */
function paramsFromIntent(template: MotionTemplate, intent: PromptIntent): ParamValues {
  const params: ParamValues = {};
  const has = (key: string) => template.params.find((p) => p.key === key);

  if (intent.palette) {
    if (has('accent')) params.accent = intent.palette.accent;
    if (has('accent2')) params.accent2 = intent.palette.accent2;
    if (has('glow2')) params.glow2 = intent.palette.accent2;
    if (has('tint')) params.tint = intent.palette.accent;
  }

  if (intent.text) {
    const textKey = has('text') ? 'text' : has('line') ? 'line' : has('label') ? 'label' : has('name') ? 'name' : null;
    if (textKey) {
      const spec = has(textKey)!;
      const isUpper = typeof spec.default === 'string' && spec.default === spec.default.toUpperCase();
      params[textKey] = isUpper ? intent.text.toUpperCase() : intent.text;
    }
  }

  if (intent.number !== null) {
    if (has('value')) params.value = intent.number;
    else if (has('from') && intent.number >= 2 && intent.number <= 9) params.from = intent.number;
    else if (has('count')) params.count = Math.max(6, Math.min(40, intent.number));
  }

  // Energy nudges the templates that expose intensity-ish knobs.
  if (intent.energy === 3) {
    if (has('strength')) params.strength = 0.9;
    if (has('count')) params.count = Math.min(40, Number(has('count')!.default) * 1.6);
    if (has('speed')) params.speed = 1.6;
  } else if (intent.energy === 1) {
    if (has('strength')) params.strength = 0.35;
    if (has('opacity')) params.opacity = 0.6;
    if (has('speed')) params.speed = 0.7;
  }

  return params;
}

function nameFor(prompt: string, template: MotionTemplate, composed: boolean): string {
  const cleaned = prompt
    .replace(/["“”'']/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['make', 'create', 'with', 'that', 'some', 'want', 'need', 'the'].includes(w.toLowerCase()))
    .slice(0, 4)
    .join(' ');
  const base = cleaned ? titleCase(cleaned) : template.name;
  return composed ? base : `${base} · ${template.name}`;
}

export interface DescribeOptions {
  onStage?: (stage: string, index: number, total: number) => void;
  /** Set to 0 in tests; the delays exist so the UI can show pipeline stages. */
  latency?: number;
}

const MAX_SCORE = 3 + 1.15 * 2 + 3 + 0.6 + 1.2;

export async function describeAsset(prompt: string, opts: DescribeOptions = {}): Promise<GenerationResult> {
  const latency = opts.latency ?? 1;
  const intent = parsePrompt(prompt);

  const stages = [
    'Reading your prompt',
    `Searching ${MOTION_TEMPLATES.length} motion assets`,
    'Composing a match',
    'Rendering preview',
  ];
  for (let i = 0; i < stages.length; i++) {
    opts.onStage?.(stages[i], i, stages.length);
    await sleep([380, 460, 520, 380][i] * latency);
  }

  const ranked = MOTION_TEMPLATES.map((template) => {
    const { score, reasons } = scoreTemplate(template, intent);
    return { template, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const confidence = Math.max(0, Math.min(1, top.score / MAX_SCORE));
  const composed = confidence < 0.62;

  const toCandidate = (entry: (typeof ranked)[number], asPrimary: boolean): Candidate => {
    const params = paramsFromIntent(entry.template, intent);
    const asset = instantiate(entry.template, {
      params,
      name: asPrimary ? nameFor(prompt, entry.template, composed) : entry.template.name,
      generated: asPrimary,
      prompt: asPrimary ? prompt : undefined,
      matchScore: Math.max(0, Math.min(1, entry.score / MAX_SCORE)),
      matchReasons: entry.reasons,
    });
    return { template: entry.template, asset, score: entry.score, reasons: entry.reasons };
  };

  return {
    prompt,
    intent,
    primary: toCandidate(top, true),
    alternates: ranked.slice(1, 4).map((entry) => toCandidate(entry, false)),
    confidence,
    composed,
  };
}

export interface AiVideoRequest {
  status: 'queued';
  id: string;
  etaSeconds: number;
  creditCost: number;
  message: string;
}

/**
 * Stub for the generative-video escalation: when parametric motion graphics genuinely
 * can't express the prompt, this is where a Veo/Runway-style job would be queued.
 */
export async function requestAiVideo(prompt: string, latency = 1): Promise<AiVideoRequest> {
  await sleep(700 * latency);
  return {
    status: 'queued',
    id: `gen_${Math.random().toString(36).slice(2, 10)}`,
    etaSeconds: 95,
    creditCost: 5,
    message: `Generative video isn't wired up in this build. In production this queues a text-to-video job for “${prompt}” and drops the clip into your library when it lands.`,
  };
}
