/**
 * Venture-capital book mechanics.
 *
 * Generates seed-stage deal flow, evolves each portfolio company every quarter
 * (growth, burn, fund-raising, failure, exit) and tracks the cash flows the
 * IRR / TVPI / MOIC calculations rely on.
 */
import {
  AssetSector,
  CapTableEntry,
  FundingStage,
  MacroState,
  Startup,
  VCFundState,
} from '../models/types';
import { CashFlow, irr, moic, tvpi } from './finance';
import { Rng } from './rng';

const SECTORS: AssetSector[] = ['Tech', 'Healthcare', 'Consumer', 'Energy', 'Financials', 'Industrials'];

const STAGE_ORDER: FundingStage[] = ['Seed', 'Series A', 'Series B', 'Series C', 'Pre-IPO'];

/** Parameters per stage: typical valuation band and round size band. */
const STAGE_PARAMS: Record<
  FundingStage,
  { valLow: number; valHigh: number; roundLow: number; roundHigh: number; baseGrowth: number }
> = {
  Seed: { valLow: 4_000_000, valHigh: 12_000_000, roundLow: 1_000_000, roundHigh: 3_000_000, baseGrowth: 0.18 },
  'Series A': { valLow: 15_000_000, valHigh: 40_000_000, roundLow: 4_000_000, roundHigh: 10_000_000, baseGrowth: 0.14 },
  'Series B': { valLow: 50_000_000, valHigh: 120_000_000, roundLow: 12_000_000, roundHigh: 30_000_000, baseGrowth: 0.10 },
  'Series C': { valLow: 150_000_000, valHigh: 400_000_000, roundLow: 30_000_000, roundHigh: 80_000_000, baseGrowth: 0.07 },
  'Pre-IPO': { valLow: 500_000_000, valHigh: 1_500_000_000, roundLow: 80_000_000, roundHigh: 200_000_000, baseGrowth: 0.05 },
};

const FIRST = ['Nimbus', 'Vertex', 'Lumen', 'Cobalt', 'Aether', 'Strato', 'Pulse', 'Quanta', 'Helix', 'Orbit', 'Forge', 'Synth', 'Atlas', 'Nova', 'Echo', 'Vela'];
const LAST = ['AI', 'Bio', 'Labs', 'Health', 'Pay', 'Grid', 'Logistics', 'Robotics', 'Cloud', 'Foods', 'Energy', 'Security', 'Analytics', 'Mobility'];

let nameCounter = 0;

function makeName(rng: Rng): string {
  nameCounter += 1;
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}

export function createVCFund(startingCash: number): VCFundState {
  return {
    cash: startingCash,
    portfolio: [],
    totalInvested: 0,
    totalReturned: 0,
    dealFlow: [],
  };
}

/**
 * Generate a fresh seed/early-stage company available for investment. Higher
 * reputation surfaces stronger founders (better growth, lower burn).
 */
export function generateDeal(rng: Rng, quarter: number, reputation: number): Startup {
  // Reputation in [0,100] -> quality bonus in roughly [-0.02, +0.06].
  const repBonus = (reputation - 50) / 100 * 0.08;
  // Mostly seed deals, occasionally a hotter Series A is shopped to you.
  const stage: FundingStage = rng.chance(0.75) ? 'Seed' : 'Series A';
  const params = STAGE_PARAMS[stage];
  const valuation = rng.range(params.valLow, params.valHigh);
  const revenue = valuation * rng.range(0.05, 0.2);
  const burnRate = revenue * rng.range(0.3, 0.8);

  return {
    id: `startup-${quarter}-${nameCounter}-${rng.int(0, 9999)}`,
    name: makeName(rng),
    sector: rng.pick(SECTORS),
    stage,
    status: 'active',
    valuation,
    revenue,
    burnRate,
    runwayCash: burnRate * rng.range(4, 8),
    health: Math.min(0.95, Math.max(0.4, rng.range(0.55, 0.85) + repBonus)),
    growthRate: params.baseGrowth + repBonus + rng.normal(0, 0.03),
    capTable: [],
    totalInvested: 0,
    ownership: 0,
    foundedQuarter: quarter,
  };
}

/** Refresh the slate of available deals for the new quarter. */
export function refreshDealFlow(rng: Rng, quarter: number, reputation: number): Startup[] {
  // 2-4 deals; better reputation = more inbound.
  const count = rng.int(2, reputation > 60 ? 4 : 3);
  return Array.from({ length: count }, () => generateDeal(rng, quarter, reputation));
}

export interface InvestResult {
  ok: boolean;
  error?: string;
  state?: VCFundState;
}

/**
 * Invest `amount` into a deal currently in `dealFlow`, moving it into the
 * portfolio with a fresh cap-table entry.
 */
export function investInDeal(
  vc: VCFundState,
  dealId: string,
  amount: number,
  quarter: number,
): InvestResult {
  const deal = vc.dealFlow.find((d) => d.id === dealId);
  if (!deal) return { ok: false, error: 'Deal nicht mehr verfügbar.' };
  if (amount <= 0) return { ok: false, error: 'Investitionsbetrag muss positiv sein.' };
  if (amount > vc.cash) return { ok: false, error: 'Nicht genug Dry Powder.' };

  const preMoney = deal.valuation;
  const postMoney = preMoney + amount;
  const ownership = amount / postMoney;

  const entry: CapTableEntry = {
    quarter,
    stage: deal.stage,
    invested: amount,
    preMoneyValuation: preMoney,
    ownership,
  };

  const invested: Startup = {
    ...deal,
    valuation: postMoney,
    runwayCash: deal.runwayCash + amount,
    capTable: [entry],
    totalInvested: amount,
    ownership,
  };

  return {
    ok: true,
    state: {
      ...vc,
      cash: vc.cash - amount,
      totalInvested: vc.totalInvested + amount,
      portfolio: [...vc.portfolio, invested],
      dealFlow: vc.dealFlow.filter((d) => d.id !== dealId),
    },
  };
}

/** Current value of the fund's stake in a single company. */
export function startupHoldingValue(s: Startup): number {
  if (s.status !== 'active') return 0;
  return s.valuation * s.ownership;
}

export interface StartupStepOutcome {
  startup: Startup;
  /** Cash returned to the fund this quarter (exits). */
  proceeds: number;
  /** Optional dilution: a follow-on round the fund chose not to join. */
  note?: string;
}

/**
 * Evolve one company by a quarter. The macro phase tilts growth and failure
 * odds. Companies can: grow, raise a new round (diluting the fund unless it
 * follows on — here modelled as automatic small dilution), fail, or exit.
 */
export function stepStartup(s: Startup, macro: MacroState, rng: Rng, quarter: number): StartupStepOutcome {
  if (s.status !== 'active') return { startup: s, proceeds: 0 };

  // Macro tilt: expansion boosts growth & exits, contraction raises failure.
  const macroGrowth = macro.sentiment * 0.05 + (macro.gdpGrowth - 0.02);
  const growth = s.growthRate + macroGrowth + rng.normal(0, 0.06);

  let valuation = Math.max(s.valuation * (1 + growth), 100_000);
  let revenue = Math.max(s.revenue * (1 + growth * 0.8), 0);
  let runwayCash = s.runwayCash - s.burnRate;

  // Health drifts with performance.
  let health = Math.min(1, Math.max(0, s.health + growth * 0.5 - 0.02 + rng.normal(0, 0.05)));
  if (runwayCash < 0) health -= 0.25; // ran out of money

  // --- Failure check -------------------------------------------------------
  const failureBase = 0.03;
  const failureProb =
    failureBase +
    Math.max(0, 0.5 - health) * 0.3 +
    (macro.phase === 'contraction' ? 0.04 : 0) +
    (runwayCash < 0 ? 0.15 : 0);
  if (rng.chance(failureProb)) {
    return {
      startup: { ...s, status: 'failed', valuation: 0, health: 0, exit: { type: 'Writedown', quarter, proceeds: 0 } },
      proceeds: 0,
      note: `${s.name} ist gescheitert (Total Loss).`,
    };
  }

  // --- Exit check ----------------------------------------------------------
  // Mature, healthy, high-stage companies can exit via IPO or M&A.
  const stageIdx = STAGE_ORDER.indexOf(s.stage);
  const exitReadiness = stageIdx / (STAGE_ORDER.length - 1);
  const exitProb =
    exitReadiness * 0.08 +
    Math.max(0, health - 0.6) * 0.1 +
    (macro.phase === 'expansion' || macro.phase === 'peak' ? 0.03 : 0);
  if (stageIdx >= 1 && rng.chance(exitProb)) {
    const ipo = rng.chance(0.4 + exitReadiness * 0.3) && (macro.phase === 'expansion' || macro.phase === 'peak');
    const exitType = ipo ? 'IPO' : 'M&A';
    // IPOs price at a premium; M&A around current mark.
    const multiple = ipo ? rng.range(1.3, 2.2) : rng.range(0.8, 1.6);
    const exitValuation = valuation * multiple;
    const proceeds = exitValuation * s.ownership;
    return {
      startup: {
        ...s,
        status: 'exited',
        valuation: exitValuation,
        exit: { type: exitType, quarter, proceeds },
      },
      proceeds,
      note: `${s.name}: ${exitType}-Exit für $${(proceeds / 1e6).toFixed(1)}M.`,
    };
  }

  // --- Optional new financing round (dilution) -----------------------------
  let stage = s.stage;
  let ownership = s.ownership;
  let note: string | undefined;
  if (runwayCash < s.burnRate && stageIdx < STAGE_ORDER.length - 1 && health > 0.45) {
    // Raises an up-round; the fund doesn't follow on -> modest dilution.
    stage = STAGE_ORDER[stageIdx + 1];
    const params = STAGE_PARAMS[stage];
    valuation = Math.max(valuation, params.valLow);
    const dilution = rng.range(0.1, 0.25);
    ownership = ownership * (1 - dilution);
    runwayCash = params.roundLow; // new cash from other investors
    note = `${s.name} raised ${stage} (Verwässerung ${(dilution * 100).toFixed(0)}%).`;
  }

  return {
    startup: { ...s, stage, valuation, revenue, runwayCash, health, ownership },
    proceeds: 0,
    note,
  };
}

export interface VCStepResult {
  state: VCFundState;
  notes: string[];
  proceeds: number;
}

/** Advance the whole venture book one quarter. */
export function stepVCFund(vc: VCFundState, macro: MacroState, rng: Rng, quarter: number): VCStepResult {
  const notes: string[] = [];
  let proceedsTotal = 0;

  const portfolio = vc.portfolio.map((s) => {
    const out = stepStartup(s, macro, rng, quarter);
    if (out.proceeds > 0) proceedsTotal += out.proceeds;
    if (out.note) notes.push(out.note);
    return out.startup;
  });

  return {
    state: {
      ...vc,
      cash: vc.cash + proceedsTotal,
      totalReturned: vc.totalReturned + proceedsTotal,
      portfolio,
    },
    notes,
    proceeds: proceedsTotal,
  };
}

/* -------------------------------------------------------------------------- */
/*                              VC analytics                                  */
/* -------------------------------------------------------------------------- */

/** Residual (unrealised) value of all still-active holdings. */
export function vcResidualValue(vc: VCFundState): number {
  return vc.portfolio.reduce((acc, s) => acc + startupHoldingValue(s), 0);
}

/**
 * Build the dated cash-flow series for the venture book: each investment is a
 * negative flow at its quarter, each exit a positive flow, and the current
 * residual value is booked as a terminal inflow at `currentQuarter`.
 */
export function vcCashFlows(vc: VCFundState, currentQuarter: number): CashFlow[] {
  const flows: CashFlow[] = [];
  for (const s of vc.portfolio) {
    for (const entry of s.capTable) {
      flows.push({ t: entry.quarter / 4, amount: -entry.invested });
    }
    if (s.exit) {
      flows.push({ t: s.exit.quarter / 4, amount: s.exit.proceeds });
    }
  }
  const residual = vcResidualValue(vc);
  if (residual > 0) {
    flows.push({ t: currentQuarter / 4, amount: residual });
  }
  return flows.sort((a, b) => a.t - b.t);
}

export function vcMetrics(vc: VCFundState, currentQuarter: number) {
  const residual = vcResidualValue(vc);
  const paidIn = vc.totalInvested;
  const totalValue = vc.totalReturned + residual;
  return {
    irr: irr(vcCashFlows(vc, currentQuarter)),
    tvpi: tvpi(vc.totalReturned, residual, paidIn),
    moic: moic(totalValue, paidIn),
    residualValue: residual,
    nav: vc.cash + residual,
  };
}
