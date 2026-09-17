/**
 * Monetisation stub.
 *
 * Credits and tiers live in localStorage and checkout is faked. The shape is what a
 * real backend would expose (balance, ledger, checkout session), so wiring Stripe is a
 * matter of replacing these four functions — the gating logic in the UI stays put.
 *
 * Note for later: credit balance must become server-authoritative before launch.
 * Anything client-side is a suggestion, not a paywall.
 */

import { sleep } from '../lib/utils';

export type Tier = 'free' | 'creator' | 'pro';

export interface TierDef {
  id: Tier;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  perks: string[];
  maxResolution: 720 | 1080 | 2160;
  watermark: boolean;
  monthlyCredits: number;
  highlight?: boolean;
}

export const TIERS: TierDef[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    blurb: 'Kick the tyres. Watermarked 720p exports.',
    perks: ['3 export credits / month', '720p exports', 'Cutbeat watermark', 'Full template library'],
    maxResolution: 720,
    watermark: true,
    monthlyCredits: 3,
  },
  {
    id: 'creator',
    name: 'Creator',
    price: '$12',
    cadence: 'per month',
    blurb: 'For people posting a few times a week.',
    perks: ['30 export credits / month', '1080p exports', 'No watermark', 'Describe-it generation', 'Brand colours'],
    maxResolution: 1080,
    watermark: false,
    monthlyCredits: 30,
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    cadence: 'per month',
    blurb: 'Agencies and anyone shipping daily.',
    perks: [
      'Unlimited exports',
      '4K exports',
      'Priority generative video',
      'Pro-only templates',
      'Publish to TikTok / YouTube / Reels',
    ],
    maxResolution: 2160,
    watermark: false,
    monthlyCredits: 999,
  },
];

export interface CreditPack {
  id: string;
  credits: number;
  price: string;
  note?: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack-10', credits: 10, price: '$9' },
  { id: 'pack-50', credits: 50, price: '$39', note: 'Best value' },
  { id: 'pack-200', credits: 200, price: '$129' },
];

export interface LedgerEntry {
  id: string;
  at: number;
  delta: number;
  reason: string;
}

export interface BillingState {
  tier: Tier;
  credits: number;
  ledger: LedgerEntry[];
}

const KEY = 'cutbeat.billing.v1';

export const tierDef = (tier: Tier): TierDef => TIERS.find((t) => t.id === tier) ?? TIERS[0];

export function loadBilling(): BillingState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BillingState;
      if (parsed && typeof parsed.credits === 'number') return parsed;
    }
  } catch {
    /* ignore corrupt state */
  }
  return {
    tier: 'free',
    credits: 3,
    ledger: [{ id: 'seed', at: Date.now(), delta: 3, reason: 'Free plan monthly credits' }],
  };
}

export function saveBilling(state: BillingState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage disabled — the session still works, it just won't persist */
  }
}

/** What an export costs, by output height. */
export function exportCost(height: number): number {
  if (height >= 2160) return 3;
  if (height >= 1920) return 1;
  return 1;
}

export function canExport(state: BillingState, height: number): { ok: boolean; cost: number; reason?: string } {
  const cost = exportCost(height);
  const def = tierDef(state.tier);
  if (height > def.maxResolution * (16 / 9) && height > def.maxResolution) {
    return { ok: false, cost, reason: `${def.name} exports up to ${def.maxResolution}p. Upgrade for higher.` };
  }
  if (state.tier === 'pro') return { ok: true, cost: 0 };
  if (state.credits < cost) {
    return { ok: false, cost, reason: `You need ${cost} credit${cost > 1 ? 's' : ''} and have ${state.credits}.` };
  }
  return { ok: true, cost };
}

export function spend(state: BillingState, amount: number, reason: string): BillingState {
  if (amount <= 0) return state;
  return {
    ...state,
    credits: Math.max(0, state.credits - amount),
    ledger: [{ id: `l_${Date.now()}`, at: Date.now(), delta: -amount, reason }, ...state.ledger].slice(0, 25),
  };
}

export interface CheckoutResult {
  ok: true;
  state: BillingState;
  message: string;
}

/** Fake Stripe. Resolves after a beat and grants the purchase locally. */
export async function checkoutPack(state: BillingState, pack: CreditPack): Promise<CheckoutResult> {
  await sleep(900);
  return {
    ok: true,
    message: `${pack.credits} credits added (test mode — no payment taken).`,
    state: {
      ...state,
      credits: state.credits + pack.credits,
      ledger: [
        { id: `l_${Date.now()}`, at: Date.now(), delta: pack.credits, reason: `Bought ${pack.id}` },
        ...state.ledger,
      ].slice(0, 25),
    },
  };
}

export async function checkoutTier(state: BillingState, tier: Tier): Promise<CheckoutResult> {
  await sleep(900);
  const def = tierDef(tier);
  const credits = tier === 'pro' ? state.credits : state.credits + def.monthlyCredits;
  return {
    ok: true,
    message: `You're on ${def.name} (test mode — no payment taken).`,
    state: {
      ...state,
      tier,
      credits,
      ledger: [
        { id: `l_${Date.now()}`, at: Date.now(), delta: credits - state.credits, reason: `Switched to ${def.name}` },
        ...state.ledger,
      ].slice(0, 25),
    },
  };
}
