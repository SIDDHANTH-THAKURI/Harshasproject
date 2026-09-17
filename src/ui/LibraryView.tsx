import { useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, Plus, Search, Sparkles, Wand2, X, Zap } from 'lucide-react';
import { CATEGORIES, MOTION_TEMPLATES, instantiate, type AssetInstance } from '../motion/registry';
import { CATEGORY_LABELS, paramDefaults, type MotionCategory } from '../motion/types';
import { describeAsset, requestAiVideo, type GenerationResult } from '../services/generate';
import { useStore } from '../state/store';
import { cn } from '../lib/utils';
import { Button, Chip, EmptyState, Panel } from './components';
import { AssetPreview } from './preview';

function AssetCard({
  asset,
  label,
  badge,
  onOpen,
}: {
  asset: AssetInstance;
  label: string;
  badge?: string;
  onOpen: () => void;
}) {
  const picked = useStore((s) => s.picked.some((a) => a.templateId === asset.templateId));
  const addAsset = useStore((s) => s.addAsset);
  const [hover, setHover] = useState(false);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-ink-850 transition-all duration-200',
        picked ? 'border-brand-500/70 shadow-lg shadow-brand-500/10' : 'border-white/8 hover:border-white/20',
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button onClick={onOpen} className="block w-full cursor-pointer text-left">
        <div className="relative aspect-9/16 bg-black">
          <AssetPreview instance={asset} backdropSeed={asset.templateId.length} playing={hover} />
          {badge && (
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500 backdrop-blur">
              {badge}
            </span>
          )}
          {!hover && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-ink-200 backdrop-blur">
              hover to play
            </span>
          )}
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{asset.name}</div>
          <div className="truncate text-[11px] text-ink-400">{label}</div>
        </div>
        <button
          onClick={() => addAsset(asset)}
          title={picked ? 'Remove from project' : 'Add to project'}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition',
            picked
              ? 'border-brand-500/60 bg-brand-500/20 text-white'
              : 'border-white/10 bg-white/5 text-ink-300 hover:text-white',
          )}
        >
          {picked ? <Check size={15} /> : <Plus size={15} />}
        </button>
      </div>
    </div>
  );
}

function DescribeBox() {
  const [prompt, setPrompt] = useState('');
  const [stage, setStage] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const addAsset = useStore((s) => s.addAsset);
  const addGenerated = useStore((s) => s.addGenerated);
  const inspect = useStore((s) => s.inspect);
  const notify = useStore((s) => s.notify);

  const examples = [
    'neon countdown that says "3 2 1 GO"',
    'minimal white subtitle for a talking head',
    'hand drawn arrow pointing at the product',
    'stat counter showing 12400 orders',
    'retro vhs filter with timecode',
  ];

  const run = async (text: string) => {
    if (!text.trim() || stage) return;
    setResult(null);
    setAiNote(null);
    try {
      const res = await describeAsset(text, { onStage: (s) => setStage(s) });
      setResult(res);
      addGenerated(res.primary.asset);
    } catch (err) {
      notify((err as Error).message, 'warn');
    } finally {
      setStage(null);
    }
  };

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Wand2 size={16} className="text-brand-400" />
          Can’t find it? Describe it.
          <span className="ml-auto rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-300">
            generates an editable asset
          </span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run(prompt)}
              placeholder="e.g. glitchy title card that says “SOLD OUT” in neon pink"
              className="w-full rounded-xl border border-white/10 bg-ink-900/80 py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-ink-400 focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <Button variant="primary" onClick={() => run(prompt)} disabled={!!stage || !prompt.trim()}>
            {stage ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {stage ? 'Working' : 'Generate'}
          </Button>
        </div>

        {!result && !stage && (
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setPrompt(ex);
                  void run(ex);
                }}
                className="rounded-full border border-white/8 bg-white/3 px-2.5 py-1 text-[11px] text-ink-300 transition hover:border-white/20 hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {stage && (
          <div className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3.5 py-3 text-sm text-ink-200">
            <Loader2 size={15} className="animate-spin text-brand-400" />
            {stage}
            <span className="shimmer ml-auto h-1.5 w-24 rounded-full bg-white/5" />
          </div>
        )}

        {result && (
          <div className="animate-fade-up rounded-2xl border border-white/10 bg-ink-900/60 p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="w-32 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
                <div className="aspect-9/16">
                  <AssetPreview instance={result.primary.asset} backdropSeed={3} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="truncate text-base font-bold text-white">{result.primary.asset.name}</h4>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      result.composed ? 'bg-amber-500/20 text-amber-500' : 'bg-mint-500/20 text-mint-500',
                    )}
                  >
                    {Math.round(result.confidence * 100)}% match
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-300">
                  {result.composed
                    ? 'Nothing in the library matched closely, so this is the nearest template recomposed with your prompt’s wording, colours and energy.'
                    : 'Matched an existing asset and filled it in from your prompt.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    result.intent.category && `category: ${result.intent.category}`,
                    result.intent.palette && `palette: ${result.intent.palette.name}`,
                    result.intent.text && `text: “${result.intent.text}”`,
                    result.intent.number !== null && `number: ${result.intent.number}`,
                    `energy: ${['', 'calm', 'medium', 'high'][result.intent.energy]}`,
                    ...result.primary.reasons.slice(0, 2),
                  ]
                    .filter(Boolean)
                    .map((chip) => (
                      <span
                        key={String(chip)}
                        className="rounded-full border border-white/10 bg-white/4 px-2 py-0.5 text-[11px] text-ink-300"
                      >
                        {chip}
                      </span>
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      addAsset(result.primary.asset);
                      notify(`${result.primary.asset.name} added`);
                    }}
                  >
                    <Plus size={14} /> Add to project
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => inspect(result.primary.asset)}>
                    Customise
                  </Button>
                  {result.composed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const res = await requestAiVideo(result.prompt);
                        setAiNote(res.message);
                      }}
                    >
                      <Sparkles size={14} /> Try generative video · 5 credits
                    </Button>
                  )}
                </div>
                {aiNote && (
                  <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {aiNote}
                  </p>
                )}
              </div>
            </div>

            {result.alternates.length > 0 && (
              <div className="mt-4 border-t border-white/8 pt-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
                  Other close matches
                </div>
                <div className="flex gap-2">
                  {result.alternates.map((alt) => (
                    <button
                      key={alt.asset.instanceId}
                      onClick={() => inspect(alt.asset)}
                      className="flex flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/3 p-2 text-left transition hover:border-white/20"
                    >
                      <div className="h-12 w-7 shrink-0 overflow-hidden rounded-md bg-black">
                        <AssetPreview instance={alt.asset} playing={false} backdropSeed={1} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white">{alt.asset.name}</div>
                        <div className="truncate text-[10px] text-ink-400">{alt.reasons[0] ?? 'related'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

export function LibraryView() {
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const category = useStore((s) => s.category);
  const setCategory = useStore((s) => s.setCategory);
  const tags = useStore((s) => s.tags);
  const toggleTag = useStore((s) => s.toggleTag);
  const clearFilters = useStore((s) => s.clearFilters);
  const picked = useStore((s) => s.picked);
  const generated = useStore((s) => s.generated);
  const inspect = useStore((s) => s.inspect);
  const setView = useStore((s) => s.setView);

  const visibleTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of MOTION_TEMPLATES) for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag]) => tag);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOTION_TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (tags.length && !tags.every((tag) => t.tags.includes(tag))) return false;
      if (!q) return true;
      const haystack = `${t.name} ${t.description} ${t.tags.join(' ')} ${t.keywords.join(' ')}`.toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });
  }, [query, category, tags]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-4 px-8 pt-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Templates & motion graphics</h1>
            <p className="mt-1 text-sm text-ink-300">
              {MOTION_TEMPLATES.length} assets, all drawn in code — previews are live, and every parameter
              stays editable after you add it.
            </p>
          </div>
          <Button variant="primary" onClick={() => setView('clips')}>
            Next: add clips <ArrowRight size={16} />
          </Button>
        </div>

        <DescribeBox />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search captions, arrows, countdowns, looks…"
              className="w-full rounded-xl border border-white/10 bg-ink-900/70 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-ink-400 focus:border-brand-500/60"
            />
          </div>
          <Chip active={category === 'all'} onClick={() => setCategory('all')}>
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c as MotionCategory]}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">Style</span>
          {visibleTags.map((tag) => (
            <Chip key={tag} active={tags.includes(tag)} onClick={() => toggleTag(tag)}>
              {tag}
            </Chip>
          ))}
          {(tags.length > 0 || query || category !== 'all') && (
            <button
              onClick={clearFilters}
              className="ml-1 flex items-center gap-1 text-[11px] font-semibold text-ink-400 hover:text-white"
            >
              <X size={12} /> clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-8 pb-28">
        {generated.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-300">
              <Sparkles size={14} className="text-brand-400" /> Generated for you
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              {generated.map((asset) => (
                <AssetCard
                  key={asset.instanceId}
                  asset={asset}
                  label={asset.prompt ? `“${asset.prompt.slice(0, 28)}…”` : 'generated'}
                  badge="new"
                  onOpen={() => inspect(asset)}
                />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState icon={<Search size={28} />} title="Nothing matches those filters">
            Try the describe box above — it will compose the closest asset from your wording.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((template) => {
              const asset = instantiate(template, { params: paramDefaults(template) });
              return (
                <AssetCard
                  key={template.id}
                  asset={asset}
                  label={CATEGORY_LABELS[template.category]}
                  badge={template.pro ? 'pro' : undefined}
                  onOpen={() => inspect(asset)}
                />
              );
            })}
          </div>
        )}
      </div>

      {picked.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-6">
          <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-white/10 bg-ink-800/95 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="flex -space-x-2">
              {picked.slice(0, 5).map((a) => (
                <div
                  key={a.instanceId}
                  className="h-10 w-6 overflow-hidden rounded-md border border-white/15 bg-black"
                  title={a.name}
                >
                  <AssetPreview instance={a} playing={false} backdropSeed={2} />
                </div>
              ))}
            </div>
            <div className="text-sm">
              <div className="font-semibold text-white">{picked.length} assets in this project</div>
              <div className="text-xs text-ink-400">The auto-editor places them on the strongest moments.</div>
            </div>
            <Button variant="primary" size="sm" onClick={() => setView('clips')}>
              Continue <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
