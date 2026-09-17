import { Check, Plus, Sparkles } from 'lucide-react';
import { PALETTES } from '../lib/color';
import { getTemplate, type AssetInstance } from '../motion/registry';
import type { ParamSpec } from '../motion/types';
import { useStore } from '../state/store';
import { Button, Field, Slider, TextInput, Toggle } from './components';
import { AssetPreview } from './preview';

function ParamControl({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  switch (spec.kind) {
    case 'text':
      return (
        <TextInput
          value={String(value ?? '')}
          maxLength={spec.maxLength}
          onChange={onChange}
          placeholder={String(spec.default)}
        />
      );
    case 'color':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value ?? '#ffffff')}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
          />
          <div className="flex flex-wrap gap-1.5">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                title={p.name}
                onClick={() => onChange(p.accent)}
                className="h-6 w-6 rounded-md border border-white/15 transition hover:scale-110"
                style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})` }}
              />
            ))}
          </div>
        </div>
      );
    case 'number':
      return (
        <div className="flex items-center gap-3">
          <Slider
            value={Number(value ?? spec.default)}
            min={spec.min ?? 0}
            max={spec.max ?? 1}
            step={spec.step ?? 0.01}
            onChange={onChange}
          />
          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-ink-300">
            {Number(value ?? spec.default).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-wrap gap-1.5">
          {spec.options?.map((o) => (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                value === o.value
                  ? 'border-brand-500/60 bg-brand-500/20 text-white'
                  : 'border-white/10 bg-white/4 text-ink-300 hover:text-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    case 'toggle':
      return <Toggle checked={Boolean(value)} onChange={onChange} label={Boolean(value) ? 'On' : 'Off'} />;
    default:
      return null;
  }
}

export function AssetInspector({ asset }: { asset: AssetInstance }) {
  const template = getTemplate(asset.templateId);
  const picked = useStore((s) => s.picked);
  const addAsset = useStore((s) => s.addAsset);
  const updateAssetParams = useStore((s) => s.updateAssetParams);
  const notify = useStore((s) => s.notify);
  const isPicked = picked.some((a) => a.templateId === asset.templateId);
  if (!template) return null;

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="aspect-9/16">
            <AssetPreview instance={asset} backdropSeed={asset.templateId.length} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {template.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/6 px-2 py-1 text-[11px] font-semibold text-ink-300">
              {tag}
            </span>
          ))}
        </div>
        {asset.generated && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 text-xs text-ink-200">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-400" />
            <span>
              Generated from “{asset.prompt}”. Everything below stays editable — the asset is code, not a
              baked video file.
            </span>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-ink-300">{template.description}</p>
        <div className="mt-4 space-y-4">
          {template.params.map((spec) => (
            <Field key={spec.key} label={spec.label} hint={spec.hint}>
              <ParamControl
                spec={spec}
                value={asset.params[spec.key]}
                onChange={(v) => updateAssetParams(asset.instanceId, { [spec.key]: v })}
              />
            </Field>
          ))}
        </div>
        <div className="mt-6 flex gap-2">
          <Button
            variant={isPicked ? 'outline' : 'primary'}
            onClick={() => {
              addAsset(asset);
              notify(isPicked ? `${asset.name} removed` : `${asset.name} added to the project`);
            }}
          >
            {isPicked ? <Check size={16} /> : <Plus size={16} />}
            {isPicked ? 'In this project' : 'Add to project'}
          </Button>
        </div>
      </div>
    </div>
  );
}
