import { useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { CREDIT_PACKS, TIERS, checkoutPack, checkoutTier } from '../services/billing';
import { cn } from '../lib/utils';
import { useStore } from '../state/store';
import { Button, Modal } from './components';

export function PricingModal() {
  const open = useStore((s) => s.modal === 'pricing');
  const setModal = useStore((s) => s.setModal);
  const billing = useStore((s) => s.billing);
  const setBilling = useStore((s) => s.setBilling);
  const notify = useStore((s) => s.notify);
  const [busy, setBusy] = useState<string | null>(null);

  const buyTier = async (id: string) => {
    setBusy(id);
    const res = await checkoutTier(billing, id as 'free' | 'creator' | 'pro');
    setBilling(res.state);
    notify(res.message);
    setBusy(null);
  };

  return (
    <Modal
      open={open}
      onClose={() => setModal(null)}
      wide
      title="Plans & credits"
      subtitle="Test mode — checkout is stubbed, nothing is charged. Balances live in this browser."
    >
      <div className="grid gap-3 md:grid-cols-3">
        {TIERS.map((tier) => {
          const current = billing.tier === tier.id;
          return (
            <div
              key={tier.id}
              className={cn(
                'flex flex-col rounded-2xl border p-4',
                tier.highlight ? 'border-brand-500/60 bg-brand-500/8' : 'border-white/8 bg-white/2',
              )}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{tier.name}</h3>
                {tier.highlight && (
                  <span className="rounded-full bg-brand-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-400">
                    popular
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{tier.price}</span>
                <span className="text-xs text-ink-400">{tier.cadence}</span>
              </div>
              <p className="mt-1 text-xs text-ink-400">{tier.blurb}</p>
              <ul className="mt-3 flex-1 space-y-1.5">
                {tier.perks.map((perk) => (
                  <li key={perk} className="flex gap-2 text-xs text-ink-200">
                    <Check size={13} className="mt-0.5 shrink-0 text-mint-500" />
                    {perk}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                variant={current ? 'outline' : tier.highlight ? 'primary' : 'default'}
                disabled={current || busy !== null}
                onClick={() => void buyTier(tier.id)}
              >
                {busy === tier.id ? <Loader2 size={15} className="animate-spin" /> : null}
                {current ? 'Current plan' : `Switch to ${tier.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-300">
          <Sparkles size={14} className="text-brand-400" /> Pay per video
        </h3>
        <p className="mt-1 text-xs text-ink-400">
          One credit renders one video. Generative-video jobs cost 5 credits when that lands.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              disabled={busy !== null}
              onClick={async () => {
                setBusy(pack.id);
                const res = await checkoutPack(billing, pack);
                setBilling(res.state);
                notify(res.message);
                setBusy(null);
              }}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-white/2 p-3 text-left transition hover:border-white/20 disabled:opacity-50"
            >
              <div>
                <div className="text-sm font-bold text-white">{pack.credits} credits</div>
                {pack.note && <div className="text-[10px] font-semibold uppercase text-mint-500">{pack.note}</div>}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-200">
                {busy === pack.id && <Loader2 size={14} className="animate-spin" />}
                {pack.price}
              </div>
            </button>
          ))}
        </div>
      </div>

      {billing.ledger.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-300">Recent activity</h3>
          <div className="mt-2 space-y-1">
            {billing.ledger.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex justify-between rounded-lg bg-white/2 px-3 py-1.5 text-xs">
                <span className="text-ink-300">{entry.reason}</span>
                <span className={entry.delta >= 0 ? 'text-mint-500' : 'text-ink-400'}>
                  {entry.delta >= 0 ? '+' : ''}
                  {entry.delta}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
