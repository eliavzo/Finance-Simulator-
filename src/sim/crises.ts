/**
 * Multi-month crises and tail-risk hedging.
 *
 * Crises persist for several months, elevating volatility and dragging (or, for
 * a short squeeze, ripping) markets — punishing un-hedged leverage. A hedge
 * bought beforehand costs a monthly premium but pays out during crises and
 * Black-Swan months.
 */
import { Crisis, CrisisType, EconomyState } from './types';
import { Loc, g } from '../i18n/lang';
import { Rng } from '../engine/rng';

const TENORS = [0.25, 1, 2, 5, 10, 30];

export const CRISIS_LABEL: Record<CrisisType, Loc> = {
  creditCrunch: { de: 'Kreditklemme', en: 'Credit Crunch' },
  liquidityFreeze: { de: 'Liquiditätsschock', en: 'Liquidity Freeze' },
  shortSqueeze: { de: 'Short Squeeze', en: 'Short Squeeze' },
  ratesShock: { de: 'Zinsschock', en: 'Rates Shock' },
};

export const CRISIS_DESC: Record<CrisisType, Loc> = {
  creditCrunch: {
    de: 'Kredit trocknet aus: Spreads explodieren, Aktien fallen, Finanzierung wird teuer.',
    en: 'Credit dries up: spreads blow out, equities fall, financing gets expensive.',
  },
  liquidityFreeze: {
    de: 'Märkte frieren ein: Notverkäufe sind teuer, LPs werden nervös.',
    en: 'Markets freeze: forced sales are costly, LPs grow nervous.',
  },
  shortSqueeze: {
    de: 'Eine brutale Rally jagt Short-Seller aus ihren Positionen.',
    en: 'A brutal rally forces short-sellers out of their positions.',
  },
  ratesShock: {
    de: 'Zinsen schießen nach oben: Anleihen und Wachstumsaktien leiden.',
    en: 'Rates spike: bonds and growth equities suffer.',
  },
};

/** Try to start a crisis this month (only one at a time). */
export function maybeTriggerCrisis(econ: EconomyState, hasActive: boolean, rng: Rng, probMult = 1): Crisis | undefined {
  if (hasActive) return undefined;
  const base = (econ.regime === 'peak' || econ.regime === 'contraction' ? 0.04 : 0.012) * probMult;
  if (!rng.chance(base)) return undefined;
  const types: CrisisType[] = ['creditCrunch', 'liquidityFreeze', 'shortSqueeze', 'ratesShock'];
  const type = rng.pick(types);
  return {
    type,
    label: g(CRISIS_LABEL[type]),
    monthsRemaining: rng.int(3, 6),
    severity: rng.range(0.5, 1),
  };
}

/** Apply a crisis's distortions to the economy for the month. */
export function applyCrisisToEconomy(econ: EconomyState, crisis: Crisis): EconomyState {
  const s = crisis.severity;
  let e: EconomyState = { ...econ, volIndex: econ.volIndex + s * 22 };
  switch (crisis.type) {
    case 'creditCrunch':
      e = { ...e, sentiment: Math.max(-1, econ.sentiment - 0.4 * s), igSpread: econ.igSpread + 0.01 * s, hySpread: econ.hySpread + 0.04 * s };
      break;
    case 'liquidityFreeze':
      e = { ...e, sentiment: Math.max(-1, econ.sentiment - 0.3 * s) };
      break;
    case 'shortSqueeze':
      e = { ...e, sentiment: Math.min(1, econ.sentiment + 0.3 * s) };
      break;
    case 'ratesShock': {
      const policyRate = econ.policyRate + 0.02 * s;
      const yieldCurve = TENORS.map((tenor) => {
        const t = Math.log(1 + tenor) / Math.log(1 + 30);
        return { tenor, rate: Math.max(0.001, policyRate + 0.01 * t) };
      });
      e = { ...e, policyRate, yieldCurve, sentiment: Math.max(-1, econ.sentiment - 0.2 * s) };
      break;
    }
  }
  return e;
}

/** Extra monthly equity log-return imposed by a crisis (negative = sell-off). */
export function crisisEquityShock(crisis: Crisis | undefined): number {
  if (!crisis) return 0;
  switch (crisis.type) {
    case 'creditCrunch':
      return -0.035 * crisis.severity;
    case 'liquidityFreeze':
      return -0.02 * crisis.severity;
    case 'ratesShock':
      return -0.02 * crisis.severity;
    case 'shortSqueeze':
      return 0.05 * crisis.severity; // a rally that punishes shorts
  }
}

/** Hedge payout this month given a crash/crisis context. */
export function hedgePayout(notional: number, blackSwan: boolean, crisis: Crisis | undefined): number {
  if (!blackSwan && !crisis) return 0;
  const sev = crisis ? crisis.severity : 0.7;
  const rate = (blackSwan ? 0.25 : 0) + sev * 0.25;
  return notional * rate;
}

export const HEDGE_MONTHLY_PREMIUM = 0.005; // 0.5% of notional per month
