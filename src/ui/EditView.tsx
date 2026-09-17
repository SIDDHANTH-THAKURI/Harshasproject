import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Eye,
  EyeOff,
  Gauge,
  Info,
  Pause,
  Play,
  RefreshCw,
  Scissors,
  Shuffle,
} from 'lucide-react';
import { styleById } from '../edit/styles';
import { TRANSITION_LABELS, type Decision, type EditPlan } from '../edit/types';
import { cn, formatTime } from '../lib/utils';
import { musicById } from '../media/music';
import { PreviewPlayer } from '../render/player';
import { useStore } from '../state/store';
import { Button, Panel, Stat } from './components';

const CLIP_COLORS = ['#7c5cff', '#ff3d81', '#2fe6a8', '#ffb020', '#38bdf8'];

function useClipColors(plan: EditPlan): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    plan.clipIds.forEach((id, i) => map.set(id, CLIP_COLORS[i % CLIP_COLORS.length]));
    return map;
  }, [plan]);
}

function Timeline({
  plan,
  time,
  onSeek,
  colors,
  nameOf,
}: {
  plan: EditPlan;
  time: number;
  onSeek: (t: number) => void;
  colors: Map<string, string>;
  nameOf: (clipId: string) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(t / plan.duration) * 100}%`;

  const handle = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    onSeek(((e.clientX - rect.left) / rect.width) * plan.duration);
  };

  const captions = plan.overlays.filter((o) => o.role === 'caption');
  const graphics = plan.overlays.filter((o) => o.role !== 'caption' && o.role !== 'look');

  return (
    <div className="select-none">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        <span>Timeline</span>
        <span className="tabular-nums">
          {formatTime(time)} / {formatTime(plan.duration)}
        </span>
      </div>
      <div
        ref={ref}
        onClick={handle}
        className="relative cursor-pointer rounded-xl border border-white/8 bg-ink-900/70 p-2"
      >
        {/* beat grid */}
        <div className="pointer-events-none absolute inset-x-2 inset-y-0">
          {plan.beats
            .filter((b) => b <= plan.duration)
            .map((b, i) => (
              <div
                key={b}
                className={cn('absolute top-0 bottom-0 w-px', i % 4 === 0 ? 'bg-white/14' : 'bg-white/6')}
                style={{ left: pct(b) }}
              />
            ))}
        </div>

        {/* video track */}
        <div className="relative h-11">
          {plan.segments.map((seg, i) => (
            <div
              key={seg.id}
              title={`Shot ${i + 1} · ${nameOf(seg.clipId)} @ ${seg.srcIn.toFixed(1)}s · score ${Math.round(seg.score * 100)}`}
              className="absolute top-0 flex h-full items-end overflow-hidden rounded-md border border-black/40 px-1.5 pb-1"
              style={{
                left: pct(seg.start),
                width: `calc(${pct(seg.duration)} - 2px)`,
                background: `linear-gradient(180deg, ${colors.get(seg.clipId) ?? '#7c5cff'}55, ${
                  colors.get(seg.clipId) ?? '#7c5cff'
                }22)`,
                borderLeft: `3px solid ${colors.get(seg.clipId) ?? '#7c5cff'}`,
              }}
            >
              <span className="truncate text-[10px] font-bold text-white/80">
                {seg.transitionIn.type !== 'cut' ? `${seg.transitionIn.type} · ` : ''}
                {Math.round(seg.score * 100)}
              </span>
            </div>
          ))}
        </div>

        {/* graphics track */}
        <div className="relative mt-1 h-5">
          {graphics.map((o) => (
            <div
              key={o.id}
              title={`${o.asset.name} (${o.role})`}
              className="absolute top-0 h-full overflow-hidden rounded border border-brand-400/40 bg-brand-500/25 px-1 text-[9px] font-semibold leading-5 text-white/85"
              style={{ left: pct(o.start), width: `calc(${pct(o.duration)} - 2px)` }}
            >
              <span className="truncate">{o.asset.name}</span>
            </div>
          ))}
        </div>

        {/* caption track */}
        <div className="relative mt-1 h-5">
          {captions.map((o) => (
            <div
              key={o.id}
              title={String(o.asset.params.text ?? '')}
              className="absolute top-0 h-full overflow-hidden rounded border border-mint-500/40 bg-mint-500/20 px-1 text-[9px] leading-5 text-white/85"
              style={{ left: pct(o.start), width: `calc(${pct(o.duration)} - 2px)` }}
            >
              <span className="truncate">{String(o.asset.params.text ?? '')}</span>
            </div>
          ))}
        </div>

        {/* playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white"
          style={{ left: `calc(${pct(time)} + 8px)` }}
        >
          <div className="absolute -left-1.5 -top-1 h-2.5 w-2.5 rotate-45 bg-white" />
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-400">
        {plan.clipIds.map((id) => (
          <span key={id} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: colors.get(id) }} />
            {nameOf(id)}
          </span>
        ))}
        <span className="ml-auto">click to scrub · space to play</span>
      </div>
    </div>
  );
}

function AttentionCurve({ plan }: { plan: EditPlan }) {
  const points = plan.report.curve;
  const path = useMemo(() => {
    if (!points.length) return '';
    return points
      .map((p, i) => {
        const x = (p.t / plan.duration) * 100;
        const y = 100 - p.value * 100;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [points, plan.duration]);

  return (
    <div className="relative h-20 w-full overflow-hidden rounded-xl border border-white/8 bg-ink-900/70">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="att" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="58" x2="100" y2="58" stroke="rgba(255,255,255,0.12)" strokeDasharray="2 2" strokeWidth="0.4" />
        <path d={`${path} L100,100 L0,100 Z`} fill="url(#att)" />
        <path d={path} fill="none" stroke="#9b83ff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute left-2 top-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
        predicted attention
      </span>
      {plan.report.risks.map((risk) => (
        <div
          key={risk.t}
          title={risk.note}
          className="absolute bottom-1 h-3 w-3 -translate-x-1/2 rounded-full border border-amber-500 bg-amber-500/40"
          style={{ left: `${(risk.t / plan.duration) * 100}%` }}
        />
      ))}
    </div>
  );
}

const DECISION_ICON: Record<Decision['kind'], typeof Scissors> = {
  hook: Gauge,
  cut: Scissors,
  beat: Gauge,
  effect: Shuffle,
  caption: Info,
  overlay: Info,
  music: Gauge,
  arc: Gauge,
  reject: AlertTriangle,
};

export function EditView() {
  const plan = useStore((s) => s.plan);
  const sources = useStore((s) => s.sources);
  const buildEdit = useStore((s) => s.buildEdit);
  const build = useStore((s) => s.build);
  const setModal = useStore((s) => s.setModal);
  const billing = useStore((s) => s.billing);
  const project = useStore((s) => s.project);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PreviewPlayer | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [safeZones, setSafeZones] = useState(false);
  const [tab, setTab] = useState<'why' | 'score'>('why');

  useEffect(() => {
    if (!plan || !canvasRef.current) return;
    const player = new PreviewPlayer(canvasRef.current, plan, sources(), {
      onTime: setTime,
      onPlayState: setPlaying,
      safeZones,
      watermark: billing.tier === 'free',
    });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
    // Rebuild the player whenever the plan changes.
  }, [plan, sources, billing.tier]);

  useEffect(() => {
    playerRef.current?.setOptions({ safeZones, watermark: billing.tier === 'free' });
  }, [safeZones, billing.tier]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('input, textarea')) {
        e.preventDefault();
        playerRef.current?.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const colors = useClipColors(plan ?? ({ clipIds: [] } as unknown as EditPlan));
  const clips = useStore((s) => s.clips);
  const nameOf = (clipId: string) => clips.find((c) => c.id === clipId)?.name ?? clipId;

  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <Panel className="max-w-md p-8 text-center">
          <h2 className="text-lg font-bold text-white">No cut yet</h2>
          <p className="mt-2 text-sm text-ink-300">
            Add a couple of clips and run the auto-editor — the result lands here with a breakdown of every
            decision it made.
          </p>
          <Button className="mt-4" variant="primary" onClick={() => useStore.getState().setView('clips')}>
            Go to clips
          </Button>
        </Panel>
      </div>
    );
  }

  const style = styleById(plan.styleId);
  const track = plan.music ? musicById(plan.music.trackId) : null;
  const report = plan.report;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-6 overflow-y-auto px-8 py-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:overflow-hidden">
      <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <div className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
          <canvas ref={canvasRef} width={540} height={960} className="aspect-9/16 w-full" />
          <button
            onClick={() => playerRef.current?.toggle()}
            className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/20"
          >
            {!playing && (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur animate-pulse-ring">
                <Play size={26} className="ml-1 text-white" fill="white" />
              </span>
            )}
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] items-center gap-2">
          <Button size="sm" onClick={() => playerRef.current?.toggle()}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSafeZones((v) => !v)} title="Show platform-safe zones">
            {safeZones ? <EyeOff size={15} /> : <Eye size={15} />} Safe zones
          </Button>
          <span className="ml-auto text-xs tabular-nums text-ink-400">
            {formatTime(time)} / {formatTime(plan.duration)}
          </span>
        </div>

        <div className="mx-auto w-full max-w-[380px] space-y-2">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => setModal('export')}
          >
            <Download size={16} /> Export & publish
          </Button>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={build.active}
              onClick={() => void buildEdit({ reseed: true })}
            >
              <Shuffle size={14} /> New variation
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={build.active}
              onClick={() => void buildEdit()}
            >
              <RefreshCw size={14} /> Rebuild
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{project.title}</h1>
            <p className="mt-0.5 text-sm text-ink-300">
              {style.name} · {plan.segments.length} shots · {plan.duration.toFixed(1)}s
              {track ? ` · ${track.name} at ${track.bpm} BPM` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Engagement</div>
              <div
                className={cn(
                  'text-3xl font-black tabular-nums',
                  report.overall >= 75 ? 'text-mint-500' : report.overall >= 55 ? 'text-amber-500' : 'text-red-400',
                )}
              >
                {report.overall}
              </div>
            </div>
          </div>
        </div>

        <Timeline
          plan={plan}
          time={time}
          onSeek={(t) => playerRef.current?.seek(t)}
          colors={colors}
          nameOf={nameOf}
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Hook" value={report.hook} tone={report.hook >= 70 ? 'good' : 'warn'} />
          <Stat label="Pacing" value={report.pacing} tone={report.pacing >= 70 ? 'good' : 'warn'} />
          <Stat label="Beat sync" value={report.beatSync} suffix="%" tone={report.beatSync >= 70 ? 'good' : 'warn'} />
          <Stat label="Variety" value={report.variety} tone={report.variety >= 60 ? 'good' : 'warn'} />
          <Stat label="Payoff" value={report.payoff} tone={report.payoff >= 60 ? 'good' : 'warn'} />
        </div>

        <AttentionCurve plan={plan} />

        <div className="flex gap-2">
          {(['why', 'score'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition',
                tab === t ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-ink-200',
              )}
            >
              {t === 'why' ? `Why this cut (${plan.decisions.length})` : 'Notes & risks'}
            </button>
          ))}
        </div>

        {tab === 'why' ? (
          <div className="space-y-1.5 pb-8">
            {plan.decisions.map((d) => {
              const Icon = DECISION_ICON[d.kind] ?? Info;
              return (
                <button
                  key={d.id}
                  onClick={() => d.t !== null && playerRef.current?.seek(d.t)}
                  className="flex w-full gap-3 rounded-xl border border-white/6 bg-white/2 p-3 text-left transition hover:border-white/15"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-white">{d.title}</span>
                      {d.t !== null && (
                        <span className="text-[11px] tabular-nums text-ink-500">@ {d.t.toFixed(2)}s</span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-300">{d.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {report.notes.map((note) => (
              <div key={note} className="flex gap-2.5 rounded-xl border border-white/8 bg-white/2 p-3">
                <Check size={15} className="mt-0.5 shrink-0 text-mint-500" />
                <p className="text-sm text-ink-200">{note}</p>
              </div>
            ))}
            {report.risks.map((risk) => (
              <button
                key={risk.t}
                onClick={() => playerRef.current?.seek(risk.t)}
                className="flex w-full gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3 text-left"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-sm text-amber-100/90">{risk.note}</p>
              </button>
            ))}
            <div className="rounded-xl border border-white/8 bg-white/2 p-3 text-xs leading-relaxed text-ink-400">
              Transitions in this cut:{' '}
              {[...new Set(plan.segments.map((s) => s.transitionIn.type))]
                .map((t) => TRANSITION_LABELS[t])
                .join(', ')}
              . Shot scores come from motion, audio spikes, focus and exposure; the attention curve decays
              between cuts and lifts when a graphic or a peak lands.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
