import { create } from 'zustand';
import type { ClipAnalysis } from '../analysis/analyze';
import { analyzeClip } from '../analysis/analyze';
import { directEdit } from '../edit/director';
import { styleById } from '../edit/styles';
import type { EditPlan } from '../edit/types';
import { uid } from '../lib/utils';
import { FileClip, ProceduralClip, grabThumbnail, type ClipSource } from '../media/clip';
import { SCENES } from '../media/scenes';
import type { AssetInstance } from '../motion/registry';
import type { ParamValues } from '../motion/types';
import { loadBilling, saveBilling, type BillingState } from '../services/billing';

export type View = 'library' | 'clips' | 'edit' | 'export';
export type ModalKind = null | 'pricing' | 'export' | 'asset';

export interface ClipEntry {
  id: string;
  name: string;
  kind: 'sample' | 'upload';
  source: ClipSource | null;
  analysis: ClipAnalysis | null;
  thumbnail: string | null;
  status: 'loading' | 'analysing' | 'ready' | 'error';
  progress: number;
  error?: string;
  selected: boolean;
  blurb?: string;
}

export interface ProjectSettings {
  title: string;
  styleId: string;
  trackId: string;
  targetDuration: number;
  script: string;
  hookText: string;
  ctaText: string;
  accent: string;
  captionsEnabled: boolean;
  seed: number;
}

interface BuildState {
  active: boolean;
  stage: string;
  progress: number;
  error: string | null;
}

interface StoreState {
  view: View;
  modal: ModalKind;
  inspectedAsset: AssetInstance | null;
  toast: { id: string; text: string; tone: 'ok' | 'warn' } | null;

  query: string;
  category: string;
  tags: string[];
  picked: AssetInstance[];
  generated: AssetInstance[];

  clips: ClipEntry[];
  samplesLoaded: boolean;

  project: ProjectSettings;
  plan: EditPlan | null;
  build: BuildState;

  billing: BillingState;

  setView: (view: View) => void;
  setModal: (modal: ModalKind) => void;
  inspect: (asset: AssetInstance | null) => void;
  notify: (text: string, tone?: 'ok' | 'warn') => void;

  setQuery: (q: string) => void;
  setCategory: (c: string) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;

  addAsset: (asset: AssetInstance) => void;
  removeAsset: (instanceId: string) => void;
  updateAssetParams: (instanceId: string, params: ParamValues) => void;
  addGenerated: (asset: AssetInstance) => void;

  loadSamples: () => Promise<void>;
  addFiles: (files: File[]) => Promise<void>;
  removeClip: (id: string) => void;
  toggleClip: (id: string) => void;

  setProject: (patch: Partial<ProjectSettings>) => void;
  buildEdit: (opts?: { reseed?: boolean }) => Promise<void>;
  updateOverlayText: (overlayId: string, text: string) => void;

  setBilling: (state: BillingState) => void;
  sources: () => Map<string, ClipSource>;
}

const DEFAULT_SCRIPT =
  'Everyone says you need a plugin stack to edit like this. You do not. Pick a look, drop three clips, hit auto-edit. The cut lands on the beat every time.';

export const useStore = create<StoreState>((set, get) => ({
  view: 'library',
  modal: null,
  inspectedAsset: null,
  toast: null,

  query: '',
  category: 'all',
  tags: [],
  picked: [],
  generated: [],

  clips: [],
  samplesLoaded: false,

  project: {
    title: 'Untitled reel',
    styleId: 'hype-montage',
    trackId: 'hype-trap',
    targetDuration: 20,
    script: DEFAULT_SCRIPT,
    hookText: 'NO PLUGINS. NO SETUP.',
    ctaText: 'FOLLOW FOR PART 2',
    accent: '#ff3d81',
    captionsEnabled: true,
    seed: 7,
  },
  plan: null,
  build: { active: false, stage: '', progress: 0, error: null },

  billing: loadBilling(),

  setView: (view) => set({ view }),
  setModal: (modal) => set({ modal }),
  inspect: (inspectedAsset) => set({ inspectedAsset, modal: inspectedAsset ? 'asset' : null }),
  notify: (text, tone = 'ok') => {
    const id = uid('toast');
    set({ toast: { id, text, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 3600);
  },

  setQuery: (query) => set({ query }),
  setCategory: (category) => set({ category }),
  toggleTag: (tag) =>
    set((s) => ({ tags: s.tags.includes(tag) ? s.tags.filter((t) => t !== tag) : [...s.tags, tag] })),
  clearFilters: () => set({ query: '', category: 'all', tags: [] }),

  addAsset: (asset) =>
    set((s) =>
      s.picked.some((a) => a.templateId === asset.templateId)
        ? { picked: s.picked.filter((a) => a.templateId !== asset.templateId) }
        : { picked: [...s.picked, asset] },
    ),
  removeAsset: (instanceId) => set((s) => ({ picked: s.picked.filter((a) => a.instanceId !== instanceId) })),
  updateAssetParams: (instanceId, params) =>
    set((s) => ({
      picked: s.picked.map((a) => (a.instanceId === instanceId ? { ...a, params: { ...a.params, ...params } } : a)),
      generated: s.generated.map((a) =>
        a.instanceId === instanceId ? { ...a, params: { ...a.params, ...params } } : a,
      ),
      inspectedAsset:
        s.inspectedAsset?.instanceId === instanceId
          ? { ...s.inspectedAsset, params: { ...s.inspectedAsset.params, ...params } }
          : s.inspectedAsset,
    })),
  addGenerated: (asset) => set((s) => ({ generated: [asset, ...s.generated].slice(0, 12) })),

  loadSamples: async () => {
    if (get().samplesLoaded) return;
    set({ samplesLoaded: true });
    const entries: ClipEntry[] = SCENES.map((scene) => ({
      id: scene.id,
      name: scene.name,
      kind: 'sample' as const,
      source: null,
      analysis: null,
      thumbnail: null,
      status: 'loading' as const,
      progress: 0,
      selected: true,
      blurb: scene.blurb,
    }));
    set((s) => ({ clips: [...entries, ...s.clips] }));

    for (const scene of SCENES) {
      try {
        const clip = await ProceduralClip.create(scene.id);
        set((s) => ({
          clips: s.clips.map((c) => (c.id === scene.id ? { ...c, source: clip, status: 'analysing' } : c)),
        }));
        const thumbnail = await grabThumbnail(clip, scene.highlights[0] ?? 1);
        const analysis = await analyzeClip(clip, {
          onProgress: (p) =>
            set((s) => ({ clips: s.clips.map((c) => (c.id === scene.id ? { ...c, progress: p } : c)) })),
        });
        set((s) => ({
          clips: s.clips.map((c) =>
            c.id === scene.id ? { ...c, analysis, thumbnail, status: 'ready', progress: 1 } : c,
          ),
        }));
      } catch (err) {
        set((s) => ({
          clips: s.clips.map((c) =>
            c.id === scene.id ? { ...c, status: 'error', error: (err as Error).message } : c,
          ),
        }));
      }
    }
  },

  addFiles: async (files) => {
    for (const file of files) {
      const id = uid('clip');
      set((s) => ({
        clips: [
          ...s.clips,
          {
            id,
            name: file.name.replace(/\.[^.]+$/, ''),
            kind: 'upload',
            source: null,
            analysis: null,
            thumbnail: null,
            status: 'loading',
            progress: 0,
            selected: true,
          },
        ],
      }));
      try {
        const clip = await FileClip.create(file, id);
        set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, source: clip, status: 'analysing' } : c)) }));
        const thumbnail = await grabThumbnail(clip, Math.min(1, clip.duration * 0.2));
        const analysis = await analyzeClip(clip, {
          onProgress: (p) => set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, progress: p } : c)) })),
        });
        set((s) => ({
          clips: s.clips.map((c) => (c.id === id ? { ...c, analysis, thumbnail, status: 'ready', progress: 1 } : c)),
        }));
      } catch (err) {
        set((s) => ({
          clips: s.clips.map((c) => (c.id === id ? { ...c, status: 'error', error: (err as Error).message } : c)),
        }));
        get().notify((err as Error).message, 'warn');
      }
    }
  },

  removeClip: (id) => {
    const clip = get().clips.find((c) => c.id === id);
    clip?.source?.dispose();
    set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }));
  },

  toggleClip: (id) =>
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)) })),

  setProject: (patch) => set((s) => ({ project: { ...s.project, ...patch } })),

  buildEdit: async (opts = {}) => {
    const state = get();
    const ready = state.clips.filter((c) => c.selected && c.status === 'ready' && c.analysis);
    if (!ready.length) {
      set({ build: { active: false, stage: '', progress: 0, error: 'Add at least one clip first.' } });
      state.notify('Add at least one clip first.', 'warn');
      return;
    }
    const seed = opts.reseed ? Math.floor(Math.random() * 100000) : state.project.seed;
    set({ build: { active: true, stage: 'Reading clip analysis', progress: 0.15, error: null }, project: { ...state.project, seed } });

    try {
      await new Promise((r) => setTimeout(r, 220));
      set({ build: { active: true, stage: 'Scoring moments', progress: 0.42, error: null } });
      await new Promise((r) => setTimeout(r, 260));
      set({ build: { active: true, stage: 'Laying cuts on the beat grid', progress: 0.68, error: null } });

      const plan = directEdit({
        analyses: ready.map((c) => c.analysis!),
        style: styleById(state.project.styleId),
        trackId: state.project.trackId,
        targetDuration: state.project.targetDuration,
        assets: state.picked,
        script: state.project.script,
        hookText: state.project.hookText,
        ctaText: state.project.ctaText,
        accent: state.project.accent,
        seed,
        captionsEnabled: state.project.captionsEnabled,
      });

      await new Promise((r) => setTimeout(r, 200));
      set({ build: { active: false, stage: 'Done', progress: 1, error: null }, plan, view: 'edit' });
    } catch (err) {
      set({ build: { active: false, stage: '', progress: 0, error: (err as Error).message } });
      get().notify((err as Error).message, 'warn');
    }
  },

  updateOverlayText: (overlayId, text) =>
    set((s) => {
      if (!s.plan) return {};
      return {
        plan: {
          ...s.plan,
          overlays: s.plan.overlays.map((o) =>
            o.id === overlayId ? { ...o, asset: { ...o.asset, params: { ...o.asset.params, text } } } : o,
          ),
        },
      };
    }),

  setBilling: (billing) => {
    saveBilling(billing);
    set({ billing });
  },

  sources: () => {
    const map = new Map<string, ClipSource>();
    for (const clip of get().clips) if (clip.source) map.set(clip.id, clip.source);
    return map;
  },
}));
