import { useEffect } from 'react';
import { Check, Clapperboard, Coins, Download, Film, LayoutGrid, Wand2 } from 'lucide-react';
import { cn } from './lib/utils';
import { useStore, type View } from './state/store';
import { AssetInspector } from './ui/AssetInspector';
import { Button, Modal } from './ui/components';
import { ClipsView } from './ui/ClipsView';
import { EditView } from './ui/EditView';
import { ExportModal } from './ui/ExportModal';
import { LibraryView } from './ui/LibraryView';
import { PricingModal } from './ui/PricingModal';

const STEPS: { id: View; label: string; icon: typeof LayoutGrid; hint: string }[] = [
  { id: 'library', label: 'Library', icon: LayoutGrid, hint: 'Pick templates & graphics' },
  { id: 'clips', label: 'Clips', icon: Film, hint: 'Add footage, set the recipe' },
  { id: 'edit', label: 'Auto-edit', icon: Wand2, hint: 'Review the cut' },
];

function Rail() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const picked = useStore((s) => s.picked);
  const clips = useStore((s) => s.clips);
  const plan = useStore((s) => s.plan);

  const done: Record<View, boolean> = {
    library: picked.length > 0,
    clips: clips.some((c) => c.status === 'ready' && c.selected),
    edit: !!plan,
    export: false,
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/6 bg-ink-900/60 px-3 py-4">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-hot-500 shadow-lg shadow-brand-500/30">
          <Clapperboard size={18} className="text-white" />
        </span>
        <div>
          <div className="text-sm font-black tracking-tight text-white">Cutbeat</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">AI reels, zero setup</div>
        </div>
      </div>

      <nav className="space-y-1">
        {STEPS.map((step, i) => {
          const active = view === step.id;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => setView(step.id)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                active ? 'bg-white/8 text-white' : 'text-ink-300 hover:bg-white/4 hover:text-ink-100',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
                  active
                    ? 'border-brand-500/60 bg-brand-500/20 text-white'
                    : done[step.id]
                      ? 'border-mint-500/40 bg-mint-500/15 text-mint-500'
                      : 'border-white/10 bg-white/4 text-ink-400',
                )}
              >
                {done[step.id] && !active ? <Check size={13} /> : <Icon size={14} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{step.label}</span>
                <span className="block truncate text-[11px] text-ink-500">{step.hint}</span>
              </span>
              <span className="ml-auto text-[10px] font-bold text-ink-600">{i + 1}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 px-1 text-[11px] leading-relaxed text-ink-500">
        <p className="rounded-xl border border-white/6 bg-white/2 p-3">
          Decode, analyse, render and encode all happen on this machine. No plugins, no uploads, no render
          queue.
        </p>
      </div>
    </aside>
  );
}

function Header() {
  const project = useStore((s) => s.project);
  const setProject = useStore((s) => s.setProject);
  const billing = useStore((s) => s.billing);
  const setModal = useStore((s) => s.setModal);
  const plan = useStore((s) => s.plan);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/6 px-6">
      <input
        value={project.title}
        onChange={(e) => setProject({ title: e.target.value })}
        className="min-w-0 max-w-64 flex-1 rounded-lg bg-transparent px-2 py-1 text-sm font-semibold text-white outline-none transition hover:bg-white/5 focus:bg-white/8"
      />
      <span className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] font-semibold text-ink-300">
        9:16 · {project.targetDuration}s
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setModal('pricing')}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-bold text-ink-100 transition hover:border-white/25"
        >
          <Coins size={13} className="text-amber-500" />
          {billing.tier === 'pro' ? 'Unlimited' : `${billing.credits} credits`}
        </button>
        <Button size="sm" variant="primary" disabled={!plan} onClick={() => setModal('export')}>
          <Download size={14} /> Export
        </Button>
      </div>
    </header>
  );
}

function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-fade-up rounded-xl border px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur',
        toast.tone === 'warn'
          ? 'border-amber-500/40 bg-amber-500/15 text-amber-100'
          : 'border-white/12 bg-ink-800/95 text-white',
      )}
    >
      {toast.text}
    </div>
  );
}

export default function App() {
  const view = useStore((s) => s.view);
  const loadSamples = useStore((s) => s.loadSamples);
  const inspectedAsset = useStore((s) => s.inspectedAsset);
  const modal = useStore((s) => s.modal);
  const inspect = useStore((s) => s.inspect);

  useEffect(() => {
    void loadSamples();
  }, [loadSamples]);

  return (
    <div className="flex h-full bg-ink-950 grid-backdrop">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="relative min-h-0 flex-1">
          {view === 'library' && <LibraryView />}
          {view === 'clips' && <ClipsView />}
          {view === 'edit' && <EditView />}
        </main>
      </div>

      <ExportModal />
      <PricingModal />
      <Modal
        open={modal === 'asset' && !!inspectedAsset}
        onClose={() => inspect(null)}
        title={inspectedAsset?.name ?? 'Asset'}
        subtitle="Every parameter is live — the preview redraws as you type."
        wide
      >
        {inspectedAsset && <AssetInspector asset={inspectedAsset} />}
      </Modal>
      <Toast />
    </div>
  );
}
