/**
 * Export: render every frame offline and mux an MP4 in the browser.
 *
 * WebCodecs does the encoding (hardware where available), so this usually runs faster
 * than real time and never leaves the machine. No server, no upload, no queue.
 */

import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
} from 'mediabunny';
import type { EditPlan } from '../edit/types';
import type { ClipSource, ExportReader } from '../media/clip';
import { buildMix } from './audioMix';
import { decodeSize, renderPlanFrame, resolveFrame, segmentFrameTimes } from './compositor';

export interface ExportOptions {
  width: number;
  height: number;
  fps?: number;
  watermark?: boolean;
  onProgress?: (fraction: number, stage: string) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  frames: number;
  elapsedMs: number;
}

export function isExportSupported(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

export async function exportPlan(
  plan: EditPlan,
  sources: Map<string, ClipSource>,
  opts: ExportOptions,
): Promise<ExportResult> {
  if (!isExportSupported()) {
    throw new Error(
      'This browser has no WebCodecs video encoder. Chrome, Edge or Safari 17+ can export; Firefox support is still partial.',
    );
  }
  const started = performance.now();
  const fps = opts.fps ?? plan.fps ?? 30;
  const { width, height } = opts;
  const report = opts.onProgress ?? (() => {});

  report(0.02, 'Mixing audio');
  const mix = await buildMix(plan, sources);

  const videoCodec = await getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width, height });
  if (!videoCodec) throw new Error('No hardware or software video encoder is available in this browser.');
  const audioCodec = await getFirstEncodableAudioCodec(['aac', 'opus']);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    quality: width >= 1080 ? QUALITY_HIGH : QUALITY_MEDIUM,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_MEDIUM });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  if (audioSource) await audioSource.add(mix);

  // One reader per segment, each fed the exact source timestamps it will be asked for.
  report(0.06, 'Decoding clips');
  const timesBySegment = segmentFrameTimes(plan, fps);
  const readers = new Map<string, ExportReader>();
  for (const segment of plan.segments) {
    const source = sources.get(segment.clipId);
    const times = timesBySegment.get(segment.id);
    if (!source || !times?.length) continue;
    const box = decodeSize(source.width, source.height, width, height);
    readers.set(segment.id, source.createExportReader(times, box.width, box.height));
  }

  const totalFrames = Math.round(plan.duration * fps);
  const lastFrame = new Map<string, CanvasImageSource | null>();

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (opts.signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      const t = i / fps;
      const spec = resolveFrame(plan, t);
      const frames = new Map<string, CanvasImageSource | null>();
      for (const slot of spec.slots) {
        const reader = readers.get(slot.segment.id);
        const frame = reader ? await reader.next() : null;
        // Hold the previous frame if a decoder runs dry at a clip boundary.
        const image = frame ?? lastFrame.get(slot.segment.id) ?? null;
        lastFrame.set(slot.segment.id, image);
        frames.set(slot.segment.id, image);
      }

      renderPlanFrame(ctx, plan, t, frames, {
        width,
        height,
        watermark: opts.watermark,
        safeZones: false,
      });
      await videoSource.add(t, 1 / fps);

      if (i % 5 === 0 || i === totalFrames - 1) {
        report(0.08 + (i / totalFrames) * 0.88, `Rendering frame ${i + 1} of ${totalFrames}`);
      }
    }

    report(0.97, 'Writing MP4');
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    for (const reader of readers.values()) await reader.close().catch(() => {});
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('Export produced no data.');
  const mimeType = await output.getMimeType().catch(() => 'video/mp4');
  report(1, 'Done');

  return {
    blob: new Blob([buffer], { type: mimeType }),
    mimeType,
    frames: totalFrames,
    elapsedMs: performance.now() - started,
  };
}
