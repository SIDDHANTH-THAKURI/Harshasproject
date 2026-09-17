/**
 * Real-time preview player.
 *
 * Video frames come from per-segment readers (a canvas for generated clips, a <video>
 * element for uploads); audio is the pre-rendered offline mix, which also acts as the
 * master clock so picture and sound can't drift.
 */

import type { EditPlan } from '../edit/types';
import type { ClipSource, FrameReader } from '../media/clip';
import { audioContext } from '../media/synth';
import { buildMix } from './audioMix';
import { decodeSize, renderPlanFrame, resolveFrame } from './compositor';

interface CachedReader {
  reader: FrameReader;
  lastUsed: number;
}

export interface PlayerOptions {
  safeZones?: boolean;
  watermark?: boolean;
  onTime?: (t: number) => void;
  onPlayState?: (playing: boolean) => void;
  onEnded?: () => void;
}

const MAX_READERS = 6;

export class PreviewPlayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private plan: EditPlan;
  private sources: Map<string, ClipSource>;
  private readers = new Map<string, CachedReader>();
  private raf = 0;
  private playing = false;
  private position = 0;
  private startedAt = 0;
  private mix: AudioBuffer | null = null;
  private mixToken = 0;
  private node: AudioBufferSourceNode | null = null;
  private opts: PlayerOptions;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    plan: EditPlan,
    sources: Map<string, ClipSource>,
    opts: PlayerOptions = {},
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.plan = plan;
    this.sources = sources;
    this.opts = opts;
    void this.prepareAudio();
    this.renderAt(0);
  }

  private async prepareAudio(): Promise<void> {
    const token = ++this.mixToken;
    try {
      const mix = await buildMix(this.plan, this.sources);
      if (token === this.mixToken && !this.disposed) this.mix = mix;
    } catch (err) {
      console.warn('[player] audio mix failed', err);
    }
  }

  setPlan(plan: EditPlan): void {
    const wasPlaying = this.playing;
    this.pause();
    this.plan = plan;
    for (const { reader } of this.readers.values()) reader.release();
    this.readers.clear();
    this.mix = null;
    void this.prepareAudio();
    this.position = Math.min(this.position, plan.duration);
    this.renderAt(this.position);
    if (wasPlaying) this.play();
  }

  setOptions(opts: Partial<PlayerOptions>): void {
    this.opts = { ...this.opts, ...opts };
    if (!this.playing) this.renderAt(this.position);
  }

  get duration(): number {
    return this.plan.duration;
  }

  get currentTime(): number {
    return this.position;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  private readerFor(segmentId: string, clipId: string): FrameReader | null {
    const hit = this.readers.get(segmentId);
    if (hit) {
      hit.lastUsed = performance.now();
      return hit.reader;
    }
    const source = this.sources.get(clipId);
    if (!source) return null;
    const box = decodeSize(source.width, source.height, this.canvas.width, this.canvas.height);
    const reader = source.createReader(box.width, box.height);
    this.readers.set(segmentId, { reader, lastUsed: performance.now() });

    if (this.readers.size > MAX_READERS) {
      const entries = [...this.readers.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [id, entry] of entries.slice(0, this.readers.size - MAX_READERS)) {
        entry.reader.release();
        this.readers.delete(id);
      }
    }
    return reader;
  }

  private renderAt(t: number): void {
    const spec = resolveFrame(this.plan, t);
    const frames = new Map<string, CanvasImageSource | null>();
    for (const slot of spec.slots) {
      const reader = this.readerFor(slot.segment.id, slot.segment.clipId);
      if (!reader) continue;
      reader.update(slot.srcTime, this.playing, slot.segment.speed);
      frames.set(slot.segment.id, reader.frame());
    }

    // Pre-roll the next shot so cuts don't stutter on uploaded footage.
    const upcoming = this.plan.segments.find((s) => s.start > t && s.start - t < 0.8);
    if (upcoming && !spec.slots.some((s) => s.segment.id === upcoming.id)) {
      this.readerFor(upcoming.id, upcoming.clipId)?.update(upcoming.srcIn, false, 1);
    }

    renderPlanFrame(this.ctx, this.plan, t, frames, {
      width: this.canvas.width,
      height: this.canvas.height,
      safeZones: this.opts.safeZones,
      watermark: this.opts.watermark,
    });
    this.opts.onTime?.(t);
  }

  private tick = (): void => {
    if (!this.playing) return;
    const ctx = audioContext();
    const t = ctx.currentTime - this.startedAt;
    if (t >= this.plan.duration) {
      this.position = this.plan.duration;
      this.renderAt(this.plan.duration - 0.001);
      this.pause();
      this.opts.onEnded?.();
      return;
    }
    this.position = Math.max(0, t);
    this.renderAt(this.position);
    this.raf = requestAnimationFrame(this.tick);
  };

  play(): void {
    if (this.playing || this.disposed) return;
    const ctx = audioContext();
    void ctx.resume();
    if (this.position >= this.plan.duration - 0.05) this.position = 0;
    this.playing = true;
    this.startedAt = ctx.currentTime - this.position;

    if (this.mix) {
      const node = ctx.createBufferSource();
      node.buffer = this.mix;
      node.connect(ctx.destination);
      node.start(0, this.position);
      this.node = node;
    }
    this.opts.onPlayState?.(true);
    this.raf = requestAnimationFrame(this.tick);
  }

  pause(): void {
    if (!this.playing) {
      cancelAnimationFrame(this.raf);
      return;
    }
    this.playing = false;
    cancelAnimationFrame(this.raf);
    if (this.node) {
      try {
        this.node.stop();
      } catch {
        /* already stopped */
      }
      this.node.disconnect();
      this.node = null;
    }
    for (const { reader } of this.readers.values()) reader.update(this.position, false, 1);
    this.opts.onPlayState?.(false);
    this.renderAt(this.position);
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(t: number): void {
    const target = Math.max(0, Math.min(this.plan.duration - 0.001, t));
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.position = target;
    this.renderAt(target);
    if (wasPlaying) this.play();
  }

  /** Re-render the current frame (after an overlay edit, for example). */
  refresh(): void {
    if (!this.playing) this.renderAt(this.position);
  }

  dispose(): void {
    this.disposed = true;
    this.pause();
    for (const { reader } of this.readers.values()) reader.release();
    this.readers.clear();
  }
}
