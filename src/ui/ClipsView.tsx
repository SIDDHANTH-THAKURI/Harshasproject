import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Film,
  Loader2,
  Music,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import type { ClipAnalysis } from '../analysis/analyze';
import { EDIT_STYLES } from '../edit/styles';
import { MUSIC_TRACKS } from '../media/music';
import { cn, formatDuration } from '../lib/utils';
import { useStore, type ClipEntry } from '../state/store';
import { Button, Chip, Field, Panel, ProgressBar, TextInput, Toggle } from './components';

/** Motion / audio signals for a clip, with the picked highlights marked. */
function SignalStrip({ analysis, height = 46 }: { analysis: ClipAnalysis; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(2, rect.width * dpr);
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const n = analysis.motion.length;
    const x = (i: number) => (i / Math.max(1, n - 1)) * w;

    // Audio energy as bars behind the motion line.
    ctx.fillStyle = 'rgba(124,92,255,0.28)';
    for (let i = 0; i < n; i++) {
      const barH = analysis.audio[i] * h * 0.85;
      ctx.fillRect(x(i), h - barH, Math.max(1, w / n - 1), barH);
    }

    ctx.strokeStyle = '#2fe6a8';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const y = h - analysis.motion[i] * h * 0.9 - 2;
      if (i === 0) ctx.moveTo(x(i), y);
      else ctx.lineTo(x(i), y);
    }
    ctx.stroke();

    for (const moment of analysis.moments.slice(0, 3)) {
      const px = (moment.start / analysis.duration) * w;
      const pw = (moment.duration / analysis.duration) * w;
      ctx.fillStyle = 'rgba(255,61,129,0.18)';
      ctx.fillRect(px, 0, pw, h);
      ctx.fillStyle = '#ff3d81';
      ctx.fillRect(px, 0, 2 * dpr, h);
    }
  }, [analysis, height]);

  return <canvas ref={ref} style={{ height }} className="w-full rounded-lg bg-black/40" />;
}

function ClipCard({ clip }: { clip: ClipEntry }) {
  const toggleClip = useStore((s) => s.toggleClip);
  const removeClip = useStore((s) => s.removeClip);

  return (
    <div
      className={cn(
        'flex gap-3 rounded-2xl border p-3 transition',
        clip.selected ? 'border-brand-500/50 bg-brand-500/5' : 'border-white/8 bg-white/2',
      )}
    >
      <button
        onClick={() => toggleClip(clip.id)}
        className="relative h-24 w-[54px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black"
      >
        {clip.thumbnail ? (
          <img src={clip.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-500">
            <Film size={18} />
          </div>
        )}
        {!clip.selected && <div className="absolute inset-0 bg-black/65" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{clip.name}</span>
          <span className="rounded-full bg-white/6 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-400">
            {clip.kind === 'sample' ? 'demo' : 'yours'}
          </span>
          <button
            onClick={() => removeClip(clip.id)}
            className="ml-auto rounded-md p-1 text-ink-500 transition hover:bg-white/8 hover:text-red-300"
            title="Remove clip"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {clip.status === 'ready' && clip.analysis ? (
          <>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-400">
              <span>{formatDuration(clip.analysis.duration)}</span>
              <span>·</span>
              <span>{clip.analysis.moments.length} moments found</span>
              <span>·</span>
              <span className="text-mint-500">peak {Math.round(clip.analysis.peak * 100)}</span>
              {!clip.analysis.hasAudio && <span className="text-amber-500">· silent</span>}
            </div>
            <div className="mt-1.5">
              <SignalStrip analysis={clip.analysis} />
            </div>
          </>
        ) : clip.status === 'error' ? (
          <p className="mt-2 text-xs text-red-300">{clip.error}</p>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-ink-300">
              <Loader2 size={13} className="animate-spin text-brand-400" />
              {clip.status === 'loading' ? 'Decoding…' : 'Analysing motion, audio and focus…'}
            </div>
            <ProgressBar value={clip.status === 'loading' ? 0.15 : 0.2 + clip.progress * 0.8} />
            {clip.blurb && <p className="text-[11px] text-ink-500">{clip.blurb}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClipsView() {
  const clips = useStore((s) => s.clips);
  const addFiles = useStore((s) => s.addFiles);
  const loadSamples = useStore((s) => s.loadSamples);
  const project = useStore((s) => s.project);
  const setProject = useStore((s) => s.setProject);
  const buildEdit = useStore((s) => s.buildEdit);
  const build = useStore((s) => s.build);
  const picked = useStore((s) => s.picked);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ready = clips.filter((c) => c.selected && c.status === 'ready');
  const busy = clips.some((c) => c.status === 'loading' || c.status === 'analysing');

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-6 overflow-y-auto px-8 py-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:overflow-hidden">
      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Clips</h1>
          <p className="mt-1 text-sm text-ink-300">
            Everything is decoded and analysed locally — nothing uploads. Drop your own footage in, or use the
            generated demo clips.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('video/'));
            if (files.length) void addFiles(files);
          }}
          className={cn(
            'flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center transition',
            dragging ? 'border-brand-500 bg-brand-500/10' : 'border-white/12 bg-white/2',
          )}
        >
          <Upload size={22} className="text-ink-400" />
          <div>
            <div className="text-sm font-semibold text-white">Drop video files here</div>
            <div className="mt-0.5 text-xs text-ink-400">MP4, MOV or WebM · 2–3 clips is plenty</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              Choose files
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void loadSamples()}>
              <Sparkles size={14} /> Load demo clips
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              if (files.length) void addFiles(files);
              e.target.value = '';
            }}
          />
        </div>

        <div className="space-y-3">
          {clips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      </div>

      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <Panel className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-300">
            <Wand2 size={14} className="text-brand-400" /> Edit recipe
          </h2>
          <div className="mt-3 space-y-2">
            {EDIT_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() =>
                  setProject({
                    styleId: style.id,
                    trackId: style.music[0],
                    accent: style.accent,
                  })
                }
                className={cn(
                  'w-full rounded-xl border p-3 text-left transition',
                  project.styleId === style.id
                    ? 'border-brand-500/60 bg-brand-500/10'
                    : 'border-white/8 bg-white/2 hover:border-white/20',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{style.name}</span>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: style.accent }}
                  />
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    {style.shotStart.toFixed(1)}s → {style.shotEnd.toFixed(1)}s cuts
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-400">{style.blurb}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-300">
            <Music size={14} className="text-brand-400" /> Soundtrack & length
          </h2>

          <div className="grid grid-cols-2 gap-2">
            {MUSIC_TRACKS.map((track) => (
              <button
                key={track.id}
                onClick={() => setProject({ trackId: track.id })}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition',
                  project.trackId === track.id
                    ? 'border-brand-500/60 bg-brand-500/10'
                    : 'border-white/8 bg-white/2 hover:border-white/20',
                )}
              >
                <div className="text-xs font-bold text-white">{track.name}</div>
                <div className="text-[10px] text-ink-400">
                  {track.genre} · {track.bpm} BPM
                </div>
              </button>
            ))}
          </div>

          <Field label="Target length">
            <div className="flex gap-2">
              {[15, 20, 30, 45].map((d) => (
                <Chip key={d} active={project.targetDuration === d} onClick={() => setProject({ targetDuration: d })}>
                  {d}s
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Hook text" hint="first 2 seconds">
            <TextInput value={project.hookText} onChange={(v) => setProject({ hookText: v })} maxLength={64} />
          </Field>

          <Field label="Caption script" hint="timed to the beat grid">
            <textarea
              value={project.script}
              onChange={(e) => setProject({ script: e.target.value })}
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-ink-400 focus:border-brand-500/70"
            />
          </Field>

          <div className="flex items-center justify-between">
            <Toggle
              checked={project.captionsEnabled}
              onChange={(v) => setProject({ captionsEnabled: v })}
              label="Auto-place captions"
            />
          </div>

          <Field label="End card text">
            <TextInput value={project.ctaText} onChange={(v) => setProject({ ctaText: v })} maxLength={32} />
          </Field>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between text-xs text-ink-400">
            <span className="flex items-center gap-1.5">
              <Activity size={13} /> {ready.length} clip{ready.length === 1 ? '' : 's'} ready
            </span>
            <span>{picked.length} assets picked</span>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-3 w-full"
            disabled={!ready.length || build.active || busy}
            onClick={() => void buildEdit()}
          >
            {build.active ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
            {build.active ? build.stage : 'Auto-edit'}
          </Button>
          {build.active && <ProgressBar value={build.progress} className="mt-3" />}
          {build.error && <p className="mt-2 text-xs text-red-300">{build.error}</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            Picks the strongest moment as the hook, arranges the rest along an energy arc, snaps every cut to
            the beat grid, then places your assets on the peaks.
          </p>
        </Panel>
      </div>
    </div>
  );
}
