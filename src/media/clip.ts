/**
 * Clip sources.
 *
 * Two implementations behind one interface:
 *  - `ProceduralClip` draws a generated scene (the bundled demo footage).
 *  - `FileClip` wraps an uploaded video: mediabunny decodes frames for analysis and
 *    export, while a plain <video> element drives real-time preview.
 *
 * Nothing is uploaded anywhere — decode, analyse, render and encode all happen locally.
 */

import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';
import { hashString, mulberry32, nextTick } from '../lib/utils';
import { DESIGN_H, DESIGN_W } from '../motion/types';
import { sceneById, type SceneDef } from './scenes';
import { audioContext, makeOfflineCtx } from './synth';

export type ClipKind = 'sample' | 'upload';

export interface FrameReader {
  /** Nudge the reader toward `srcTime`; cheap to call every frame. */
  update(srcTime: number, playing: boolean, rate: number): void;
  frame(): CanvasImageSource | null;
  release(): void;
}

export interface ExportReader {
  next(): Promise<CanvasImageSource | null>;
  close(): Promise<void>;
}

export interface ClipSource {
  id: string;
  name: string;
  kind: ClipKind;
  duration: number;
  width: number;
  height: number;
  audioBuffer: AudioBuffer | null;
  /** Pull low-res frames for analysis. The image is only valid inside the callback. */
  sampleFrames(
    times: number[],
    width: number,
    height: number,
    onFrame: (index: number, image: CanvasImageSource | null) => void,
  ): Promise<void>;
  createReader(width: number, height: number): FrameReader;
  createExportReader(times: number[], width: number, height: number): ExportReader;
  dispose(): void;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(width));
  c.height = Math.max(2, Math.round(height));
  return c;
}

/* ------------------------------- procedural ------------------------------- */

export class ProceduralClip implements ClipSource {
  readonly kind = 'sample' as const;
  readonly id: string;
  readonly name: string;
  readonly duration: number;
  readonly width = DESIGN_W;
  readonly height = DESIGN_H;
  audioBuffer: AudioBuffer | null = null;
  readonly scene: SceneDef;
  private rand: (i: number) => number;

  constructor(scene: SceneDef) {
    this.scene = scene;
    this.id = scene.id;
    this.name = scene.name;
    this.duration = scene.duration;
    const values: number[] = [];
    const rng = mulberry32(hashString(scene.id));
    for (let i = 0; i < 1024; i++) values.push(rng());
    this.rand = (i: number) => values[((i % 1024) + 1024) % 1024];
  }

  static async create(sceneId: string): Promise<ProceduralClip> {
    const scene = sceneById(sceneId);
    if (!scene) throw new Error(`Unknown scene ${sceneId}`);
    const clip = new ProceduralClip(scene);
    const ctx = makeOfflineCtx(scene.duration);
    scene.audio(ctx, scene.duration);
    clip.audioBuffer = await ctx.startRendering();
    return clip;
  }

  /** Draw the scene straight into any 2D context sized to the design aspect. */
  drawInto(ctx: CanvasRenderingContext2D, t: number, width: number, height: number): void {
    ctx.save();
    ctx.scale(width / DESIGN_W, height / DESIGN_H);
    this.scene.draw(ctx, Math.max(0, Math.min(this.duration, t)), DESIGN_W, DESIGN_H, this.rand);
    ctx.restore();
  }

  async sampleFrames(
    times: number[],
    width: number,
    height: number,
    onFrame: (index: number, image: CanvasImageSource | null) => void,
  ): Promise<void> {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    for (let i = 0; i < times.length; i++) {
      this.drawInto(ctx, times[i], canvas.width, canvas.height);
      onFrame(i, canvas);
      // Yield regularly so analysing three clips doesn't lock up the page.
      if (i % 5 === 4) await nextTick();
    }
  }

  createReader(width: number, height: number): FrameReader {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    let drawnAt = -1;
    return {
      update: (srcTime) => {
        if (Math.abs(srcTime - drawnAt) < 1e-4) return;
        drawnAt = srcTime;
        this.drawInto(ctx, srcTime, canvas.width, canvas.height);
      },
      frame: () => (drawnAt >= 0 ? canvas : null),
      release: () => {},
    };
  }

  createExportReader(times: number[], width: number, height: number): ExportReader {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    let i = 0;
    return {
      next: async () => {
        if (i >= times.length) return null;
        this.drawInto(ctx, times[i++], canvas.width, canvas.height);
        return canvas;
      },
      close: async () => {},
    };
  }

  dispose(): void {}
}

/* ---------------------------------- file ---------------------------------- */

export class FileClip implements ClipSource {
  readonly kind = 'upload' as const;
  readonly id: string;
  readonly name: string;
  duration = 0;
  width = 0;
  height = 0;
  audioBuffer: AudioBuffer | null = null;
  /** Kept alive for the lifetime of the clip: the demuxer backs every sink we create. */
  readonly input: Input;
  private objectUrl: string;
  private videoTrack: Awaited<ReturnType<Input['getVideoTracks']>>[number] | null = null;
  private readers: HTMLVideoElement[] = [];

  private constructor(id: string, name: string, input: Input, objectUrl: string) {
    this.id = id;
    this.name = name;
    this.input = input;
    this.objectUrl = objectUrl;
  }

  static async create(file: File, id: string): Promise<FileClip> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    const clip = new FileClip(id, file.name.replace(/\.[^.]+$/, ''), input, URL.createObjectURL(file));
    const tracks = await input.getVideoTracks();
    const track = tracks[0];
    if (!track) throw new Error('No video track found in that file.');
    if (!(await track.canDecode())) throw new Error('This browser cannot decode that video codec.');
    clip.videoTrack = track;
    clip.width = track.displayWidth;
    clip.height = track.displayHeight;
    clip.duration = await input.computeDuration();

    try {
      const bytes = await file.arrayBuffer();
      clip.audioBuffer = await audioContext().decodeAudioData(bytes);
    } catch {
      clip.audioBuffer = null; // Silent clip, or a codec the browser won't decode.
    }
    return clip;
  }

  async sampleFrames(
    times: number[],
    width: number,
    height: number,
    onFrame: (index: number, image: CanvasImageSource | null) => void,
  ): Promise<void> {
    if (!this.videoTrack) return;
    const sink = new CanvasSink(this.videoTrack, { width, height, fit: 'cover', poolSize: 2 });
    let i = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      onFrame(i, wrapped ? wrapped.canvas : null);
      i++;
    }
    for (; i < times.length; i++) onFrame(i, null);
  }

  createReader(_width: number, _height: number): FrameReader {
    const video = document.createElement('video');
    video.src = this.objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    this.readers.push(video);
    let wanted = 0;

    return {
      update: (srcTime, playing, rate) => {
        wanted = srcTime;
        if (video.readyState < 1) return;
        if (playing) {
          if (Math.abs(video.playbackRate - rate) > 0.01) video.playbackRate = rate;
          if (video.paused) void video.play().catch(() => {});
          if (Math.abs(video.currentTime - wanted) > 0.22) video.currentTime = wanted;
        } else {
          if (!video.paused) video.pause();
          if (Math.abs(video.currentTime - wanted) > 0.04) video.currentTime = wanted;
        }
      },
      frame: () => (video.readyState >= 2 ? video : null),
      release: () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
        this.readers = this.readers.filter((v) => v !== video);
      },
    };
  }

  createExportReader(times: number[], width: number, height: number): ExportReader {
    if (!this.videoTrack) {
      return { next: async () => null, close: async () => {} };
    }
    const sink = new CanvasSink(this.videoTrack, { width, height, fit: 'cover', poolSize: 2 });
    const iterator = sink.canvasesAtTimestamps(times)[Symbol.asyncIterator]();
    return {
      next: async () => {
        const res = await iterator.next();
        if (res.done || !res.value) return null;
        return res.value.canvas;
      },
      close: async () => {
        await iterator.return?.();
      },
    };
  }

  dispose(): void {
    for (const video of this.readers) {
      video.pause();
      video.removeAttribute('src');
    }
    this.readers = [];
    URL.revokeObjectURL(this.objectUrl);
  }
}

/** First frame (or a frame at `t`) as a data URL, for clip thumbnails. */
export async function grabThumbnail(clip: ClipSource, t: number, width = 220): Promise<string> {
  const height = Math.round((width * 16) / 9);
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  await clip.sampleFrames([Math.min(t, Math.max(0, clip.duration - 0.05))], width, height, (_, image) => {
    if (image) {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#12121e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  });
  return canvas.toDataURL('image/jpeg', 0.7);
}
