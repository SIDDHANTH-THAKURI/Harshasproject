/**
 * Offline audio mix for a plan: music bed + ducked clip audio.
 *
 * The preview player and the exporter share the mix, so preview audio is sample-exact
 * with the file you download.
 */

import type { EditPlan } from '../edit/types';
import type { ClipSource } from '../media/clip';
import { getMusicBuffer } from '../media/music';

export async function buildMix(
  plan: EditPlan,
  sources: Map<string, ClipSource>,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.duration * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 3;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  master.connect(comp).connect(ctx.destination);

  if (plan.music) {
    try {
      const buffer = await getMusicBuffer(plan.music.trackId);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = plan.music.gain;
      // Short fade-out at the end so the track doesn't get chopped off.
      gain.gain.setValueAtTime(plan.music.gain, Math.max(0, plan.duration - 0.8));
      gain.gain.linearRampToValueAtTime(0.0001, plan.duration);
      src.connect(gain).connect(master);
      src.start(0, 0, Math.min(buffer.duration, plan.duration));
    } catch (err) {
      console.warn('[audio] music render failed', err);
    }
  }

  const clipGain = plan.music?.clipGain ?? 0.8;
  if (clipGain > 0.01) {
    for (const segment of plan.segments) {
      const source = sources.get(segment.clipId);
      const buffer = source?.audioBuffer;
      if (!buffer) continue;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = segment.speed;
      const gain = ctx.createGain();
      const fade = Math.min(0.045, segment.duration / 3);
      gain.gain.setValueAtTime(0.0001, segment.start);
      gain.gain.linearRampToValueAtTime(clipGain, segment.start + fade);
      gain.gain.setValueAtTime(clipGain, segment.start + segment.duration - fade);
      gain.gain.linearRampToValueAtTime(0.0001, segment.start + segment.duration);
      src.connect(gain).connect(master);
      const offset = Math.min(segment.srcIn, Math.max(0, buffer.duration - 0.05));
      src.start(segment.start, offset, Math.min(segment.duration * segment.speed, buffer.duration - offset));
    }
  }

  return ctx.startRendering();
}
