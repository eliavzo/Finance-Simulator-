/**
 * Reputation tiers and the perks they unlock.
 *
 * Perks are gated by the *peak* reputation ever reached, so progression is
 * sticky — a temporary dip doesn't re-lock your leverage or LP access. Higher
 * standing unlocks more leverage, options trading, top-tier infrastructure and
 * access to more demanding (larger) LP types.
 */
import { LPType } from './types';

export type Tier = 'boutique' | 'rising' | 'established' | 'titan';

export const TIER_ORDER: Tier[] = ['boutique', 'rising', 'established', 'titan'];

export const TIER_THRESHOLD: Record<Tier, number> = {
  boutique: 0,
  rising: 55,
  established: 70,
  titan: 85,
};

export const TIER_LABEL: Record<Tier, string> = {
  boutique: 'Boutique',
  rising: 'Aufstrebend',
  established: 'Etabliert',
  titan: 'Titan',
};

export interface TierPerks {
  tier: Tier;
  label: string;
  maxLeverage: number;
  allowOptions: boolean;
  maxInfraTier: number;
  lpTypes: LPType[];
  /** Reputation needed for the next tier, if any. */
  nextTier?: Tier;
  nextAt?: number;
}

const PERKS: Record<Tier, Omit<TierPerks, 'tier' | 'label' | 'nextTier' | 'nextAt'>> = {
  boutique: { maxLeverage: 2, allowOptions: false, maxInfraTier: 1, lpTypes: ['Pension', 'FamilyOffice'] },
  rising: { maxLeverage: 3, allowOptions: true, maxInfraTier: 2, lpTypes: ['Pension', 'FamilyOffice', 'Endowment', 'FundOfFunds'] },
  established: { maxLeverage: 4, allowOptions: true, maxInfraTier: 3, lpTypes: ['Pension', 'FamilyOffice', 'Endowment', 'FundOfFunds', 'SovereignWealth'] },
  titan: { maxLeverage: 5, allowOptions: true, maxInfraTier: 3, lpTypes: ['Pension', 'FamilyOffice', 'Endowment', 'FundOfFunds', 'SovereignWealth'] },
};

export function tierForReputation(rep: number): Tier {
  if (rep >= TIER_THRESHOLD.titan) return 'titan';
  if (rep >= TIER_THRESHOLD.established) return 'established';
  if (rep >= TIER_THRESHOLD.rising) return 'rising';
  return 'boutique';
}

/** Perks for a given (peak) reputation. */
export function tierPerks(peakReputation: number): TierPerks {
  const tier = tierForReputation(peakReputation);
  const idx = TIER_ORDER.indexOf(tier);
  const nextTier = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : undefined;
  return {
    tier,
    label: TIER_LABEL[tier],
    ...PERKS[tier],
    nextTier,
    nextAt: nextTier ? TIER_THRESHOLD[nextTier] : undefined,
  };
}
