import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Instagram, Loader2, Lock, Youtube, Zap } from 'lucide-react';
import { exportPlan, isExportSupported } from '../render/exporter';
import { canExport, spend, tierDef } from '../services/billing';
import { cn, formatBytes } from '../lib/utils';
import { useStore } from '../state/store';
import { Button, Modal, ProgressBar } from './components';

const PRESETS = [
  { id: '720', label: '720p', width: 720, height: 1280, note: 'fast · every plan' },
  { id: '1080', label: '1080p', width: 1080, height: 1920, note: 'crisp · Creator+' },
  { id: '4k', label: '4K', width: 2160, height: 3840, note: 'Pro only', pro: true },
];

export function ExportModal() {
  const open = useStore((s) => s.modal === 'export');
  const setModal = useStore((s) => s.setModal);
  const plan = useStore((s) => s.plan);
  const sources = useStore((s) => s.sources);
  const billing = useStore((s) => s.billing);
  const setBilling = useStore((s) => s.setBilling);
  const notify = useStore((s) => s.notify);
  const project = useStore((s) => s.project);

  // Default to the best resolution this plan actually allows.
  const [presetId, setPresetId] = useState(() =>
    tierDef(useStore.getState().billing.tier).maxResolution >= 1080 ? '1080' : '720',
  );
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; size: number; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[1];
  const tier = tierDef(billing.tier);
  const locked = preset.height > tier.maxResolution * (16 / 9);
  const gate = canExport(billing, preset.height);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setBusy(false);
      setProgress(0);
      setError(null);
    }
  }, [open]);

  const run = async () => {
    if (!plan) return;
    if (locked) {
      setModal('pricing');
      return;
    }
    if (!gate.ok) {
      notify(gate.reason ?? 'Not enough credits', 'warn');
      setModal('pricing');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const out = await exportPlan(plan, sources(), {
        width: preset.width,
        height: preset.height,
        fps: plan.fps,
        watermark: tier.watermark,
        signal: controller.signal,
        onProgress: (p, s) => {
          setProgress(p);
          setStage(s);
        },
      });
      const url = URL.createObjectURL(out.blob);
      setResult({ url, size: out.blob.size, ms: out.elapsedMs });
      if (gate.cost > 0) setBilling(spend(billing, gate.cost, `Export ${preset.label}`));
      notify(`Rendered ${out.frames} frames in ${(out.elapsedMs / 1000).toFixed(1)}s`);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const supported = isExportSupported();

  return (
    <Modal
      open={open}
      onClose={() => setModal(null)}
      title="Export"
      subtitle="Rendered frame-by-frame in this browser with WebCodecs. Nothing is uploaded."
    >
      {!supported && (
        <div className="mb-4 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          This browser has no WebCodecs encoder. Chrome, Edge or Safari 17+ can export this project.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {PRESETS.map((p) => {
          const isLocked = p.height > tier.maxResolution * (16 / 9);
          return (
            <button
              key={p.id}
              onClick={() => setPresetId(p.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                presetId === p.id ? 'border-brand-500/60 bg-brand-500/10' : 'border-white/8 bg-white/2 hover:border-white/20',
              )}
            >
              <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                {p.label}
                {isLocked && <Lock size={12} className="text-amber-500" />}
              </div>
              <div className="text-[11px] text-ink-400">
                {p.width}×{p.height} · {p.note}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/8 bg-white/2 px-4 py-3 text-sm">
        <div>
          <div className="font-semibold text-white">
            {gate.cost === 0 ? 'Included in Pro' : `${gate.cost} credit${gate.cost > 1 ? 's' : ''}`}
          </div>
          <div className="text-xs text-ink-400">
            {billing.credits} credits left · {tier.name} plan
            {tier.watermark ? ' · watermark on' : ' · no watermark'}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setModal('pricing')}>
          <Zap size={14} /> Upgrade
        </Button>
      </div>

      {busy && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-ink-200">
            <Loader2 size={15} className="animate-spin text-brand-400" />
            {stage}
          </div>
          <ProgressBar value={progress} />
          <button className="text-xs text-ink-400 hover:text-white" onClick={() => abortRef.current?.abort()}>
            Cancel
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-mint-500">
            <Check size={16} /> Rendered in {(result.ms / 1000).toFixed(1)}s · {formatBytes(result.size)}
          </div>
          <video
            src={result.url}
            controls
            playsInline
            className="mx-auto max-h-80 rounded-xl border border-white/10 bg-black"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                const a = document.createElement('a');
                a.href = result.url;
                a.download = `${project.title.replace(/\s+/g, '-').toLowerCase()}.mp4`;
                a.click();
              }}
            >
              <Download size={16} /> Download MP4
            </Button>
            {[
              { name: 'TikTok', icon: Zap },
              { name: 'Reels', icon: Instagram },
              { name: 'Shorts', icon: Youtube },
            ].map(({ name, icon: Icon }) => (
              <Button
                key={name}
                variant="outline"
                onClick={() => notify(`Publishing to ${name} needs an account connection — not wired up in this build.`, 'warn')}
              >
                <Icon size={15} /> {name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!result && !busy && (
        <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!plan || !supported} onClick={() => void run()}>
          <Download size={18} /> Render {preset.label}
        </Button>
      )}
    </Modal>
  );
}
