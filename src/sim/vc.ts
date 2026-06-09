/**
 * Venture-capital / startup pillar: back early-stage companies, help them grow,
 * follow on through funding rounds, and ride the power law to IPO/M&A exits.
 *
 * Startups grow (or burn out) every month. When runway runs low a healthy one
 * raises an up-round (you dilute unless you follow on pro-rata); a weak one
 * fails and the investment is lost. A few become rockets and return many times
 * the cheque. Operational support nudges growth and survival.
 */
import { EconomyState, FundingStage, Sector, Startup, StartupDeal, VCState } from './types';
import { irr } from '../engine/finance';
import { g } from '../i18n/lang';
import { Rng } from '../engine/rng';

/** A localised venture note plus a stable kind so the engine can categorise it. */
export interface VCNote {
  kind: 'exit' | 'fail' | 'round';
  text: string;
}

const FIRST = ['Nimbus', 'Vertex', 'Lumen', 'Cobalt', 'Aether', 'Strato', 'Pulse', 'Quanta', 'Helix', 'Orbit', 'Synth', 'Atlas', 'Echo', 'Vela', 'Flux', 'Nova', 'Cortex', 'Sol'];
const LAST = ['AI', 'Bio', 'Labs', 'Health', 'Pay', 'Grid', 'Logistics', 'Robotics', 'Cloud', 'Foods', 'Energy', 'Security', 'Analytics', 'Mobility', 'Works', 'Data'];
const SECTORS: Sector[] = ['Tech', 'Healthcare', 'Consumer', 'Energy', 'Financials', 'Industrials'];

const STAGES: FundingStage[] = ['Seed', 'Series A', 'Series B', 'Series C', 'Pre-IPO'];

interface StageParam {
  preLow: number; preHigh: number;
  roundLow: number; roundHigh: number;
  growthLow: number; growthHigh: number;
}
const STAGE: Record<FundingStage, StageParam> = {
  Seed: { preLow: 3_000_000, preHigh: 12_000_000, roundLow: 1_000_000, roundHigh: 3_000_000, growthLow: 0.2, growthHigh: 0.5 },
  'Series A': { preLow: 15_000_000, preHigh: 40_000_000, roundLow: 4_000_000, roundHigh: 10_000_000, growthLow: 0.15, growthHigh: 0.35 },
  'Series B': { preLow: 50_000_000, preHigh: 120_000_000, roundLow: 12_000_000, roundHigh: 30_000_000, growthLow: 0.1, growthHigh: 0.25 },
  'Series C': { preLow: 150_000_000, preHigh: 400_000_000, roundLow: 30_000_000, roundHigh: 80_000_000, growthLow: 0.07, growthHigh: 0.18 },
  'Pre-IPO': { preLow: 500_000_000, preHigh: 1_500_000_000, roundLow: 80_000_000, roundHigh: 200_000_000, growthLow: 0.05, growthHigh: 0.12 },
};

let ctr = 0;
function makeName(rng: Rng): string {
  ctr += 1;
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}

export function createVC(): VCState {
  return { deals: [], portfolio: [], totalInvested: 0, totalReturned: 0, cashflows: [] };
}

/**
 * Generate a startup raising a round. Higher reputation surfaces stronger teams;
 * `scale` (the fund's size relative to its start) shifts deals toward bigger,
 * later-stage rounds so investing stays meaningful as the fund grows.
 */
export function generateDeal(rng: Rng, reputation: number, scale = 1): StartupDeal {
  ctr += 1;
  // Fund maturity (0 = small/new, 1 = large) biases the stage upward.
  const maturity = Math.max(0, Math.min(1, (scale - 1) / 7));
  const idx = Math.max(0, Math.min(STAGES.length - 1, Math.round(maturity * 3 + rng.range(-0.8, 1.2))));
  const stage = STAGES[idx];
  const p = STAGE[stage];
  // Gentle within-stage size growth with fund scale.
  const sizeMult = Math.max(1, Math.min(2.5, 1 + (scale - 1) * 0.12));
  const preMoney = rng.range(p.preLow, p.preHigh) * sizeMult;
  const roundSize = rng.range(p.roundLow, p.roundHigh) * sizeMult;
  const revenue = preMoney * rng.range(0.03, 0.18);
  const repBonus = (reputation - 50) / 100 * 0.2;
  return {
    id: `deal-${ctr}-${rng.int(0, 9999)}`,
    name: makeName(rng),
    sector: rng.pick(SECTORS),
    stage,
    preMoney,
    roundSize,
    revenue,
    growthRate: rng.range(p.growthLow, p.growthHigh),
    burnRate: roundSize / rng.range(12, 20), // ~12-20 months runway
    quality: Math.max(0.2, Math.min(0.95, rng.range(0.4, 0.85) + repBonus)),
  };
}

export function refreshDeals(rng: Rng, reputation: number, scale = 1): StartupDeal[] {
  const count = rng.int(2, reputation > 60 ? 4 : 3);
  return Array.from({ length: count }, () => generateDeal(rng, reputation, scale));
}

export interface InvestResult {
  ok: boolean;
  error?: string;
  vc?: VCState;
  amount?: number;
}

/** Invest `amount` into a deal (co-investing in its round). */
export function investInDeal(vc: VCState, dealId: string, amount: number, month: number): InvestResult {
  const deal = vc.deals.find((d) => d.id === dealId);
  if (!deal) return { ok: false, error: g({ de: 'Deal nicht mehr verfügbar.', en: 'Deal no longer available.' }) };
  if (amount <= 0) return { ok: false, error: g({ de: 'Betrag muss positiv sein.', en: 'Amount must be positive.' }) };
  if (amount > deal.roundSize) return { ok: false, error: g({ de: 'Mehr als die Rundengröße.', en: 'More than the round size.' }) };

  const postMoney = deal.preMoney + deal.roundSize;
  const ownership = amount / postMoney;
  ctr += 1;
  const startup: Startup = {
    id: `su-${month}-${ctr}`,
    name: deal.name,
    sector: deal.sector,
    stage: deal.stage,
    status: 'active',
    revenue: deal.revenue,
    growthRate: deal.growthRate,
    burnRate: deal.burnRate,
    runwayCash: deal.roundSize,
    postMoney,
    ownership,
    totalInvested: amount,
    support: 0,
    health: Math.max(0.3, Math.min(0.9, 0.5 + deal.quality * 0.3)),
    foundedMonth: month,
  };
  return {
    ok: true,
    amount,
    vc: {
      ...vc,
      deals: vc.deals.filter((d) => d.id !== dealId),
      portfolio: [...vc.portfolio, startup],
      totalInvested: vc.totalInvested + amount,
      cashflows: [...vc.cashflows, { t: month / 12, amount: -amount }],
    },
  };
}

/* ------------------------------ Monthly step ----------------------------- */

export interface StartupStepOutcome {
  startup: Startup;
  /** Cash returned to the fund this month (exit proceeds). */
  proceeds: number;
  note?: VCNote;
}

function nextStage(stage: FundingStage): FundingStage {
  const i = STAGES.indexOf(stage);
  return STAGES[Math.min(STAGES.length - 1, i + 1)];
}

/** Evolve one startup by a month. */
export function stepStartup(s: Startup, econ: EconomyState, month: number, rng: Rng): StartupStepOutcome {
  if (s.status !== 'active') return { startup: s, proceeds: 0 };

  // Growth: organic + macro + operational support, with venture-scale noise.
  const macro = (econ.gdpGrowth - 0.02) * 0.4 + econ.sentiment * 0.06;
  const monthlyGrowth = s.growthRate / 12 + macro / 12 + s.support * 0.012 + rng.normal(0, 0.04);
  const postMoney = Math.max(250_000, s.postMoney * (1 + monthlyGrowth));
  const revenue = Math.max(0, s.revenue * (1 + monthlyGrowth * 0.8));
  const runwayCash = s.runwayCash - s.burnRate;
  let health = Math.max(0, Math.min(1, s.health + monthlyGrowth * 1.5 - 0.01 + s.support * 0.01 + rng.normal(0, 0.03)));
  if (runwayCash < s.burnRate * 3) health -= 0.04;

  const base: Startup = { ...s, postMoney, revenue, runwayCash, health, raising: undefined };

  // --- Exit check (mature, healthy companies) ---
  const stageIdx = STAGES.indexOf(s.stage);
  const exitReadiness = stageIdx / (STAGES.length - 1);
  const goodMarket = econ.regime === 'expansion' || econ.regime === 'peak';
  const exitProb = exitReadiness * 0.05 + Math.max(0, health - 0.6) * 0.08 + (goodMarket ? 0.02 : 0);
  if (stageIdx >= 2 && health > 0.55 && rng.chance(exitProb)) {
    const ipo = goodMarket && rng.chance(0.45 + exitReadiness * 0.3);
    const multiple = ipo ? rng.range(1.4, 2.6) : rng.range(0.9, 1.8);
    const exitValuation = postMoney * multiple;
    const proceeds = exitValuation * s.ownership;
    return {
      startup: { ...base, status: 'exited', postMoney: exitValuation, exit: { type: ipo ? 'IPO' : 'M&A', month, proceeds } },
      proceeds,
      note: { kind: 'exit', text: g({ de: `${s.name}: ${ipo ? 'IPO' : 'M&A'}-Exit für $${(proceeds / 1e6).toFixed(1)}M.`, en: `${s.name}: ${ipo ? 'IPO' : 'M&A'} exit for $${(proceeds / 1e6).toFixed(1)}M.` }) },
    };
  }

  // --- Failure check ---
  const failBase = 0.015 + Math.max(0, 0.5 - health) * 0.25 + (runwayCash <= 0 ? 0.25 : 0) + (econ.regime === 'contraction' ? 0.02 : 0);
  if (rng.chance(failBase)) {
    return { startup: { ...base, status: 'failed', postMoney: 0, health: 0, exit: undefined }, proceeds: 0, note: { kind: 'fail', text: g({ de: `${s.name} ist gescheitert (Totalverlust).`, en: `${s.name} has failed (total loss).` }) } };
  }

  // --- New financing round when runway is low ---
  if (runwayCash < s.burnRate * 2 && stageIdx < STAGES.length - 1 && health > 0.4) {
    const newStage = nextStage(s.stage);
    const p = STAGE[newStage];
    // Up-round: valuation steps up with health.
    const stepUp = rng.range(1.3, 1.3 + health);
    const newPost = Math.max(postMoney * stepUp, p.preLow);
    const roundSize = rng.range(p.roundLow, p.roundHigh);
    const dilution = roundSize / (newPost + roundSize);
    const ownershipIfFollow = s.ownership; // maintain by pro-rata
    const proRata = s.ownership * roundSize;
    return {
      startup: {
        ...base,
        stage: newStage,
        postMoney: newPost + roundSize,
        runwayCash: runwayCash + roundSize,
        ownership: s.ownership * (1 - dilution),
        raising: { proRata, ownershipIfFollow, stage: newStage },
      },
      proceeds: 0,
      note: { kind: 'round', text: g({ de: `${s.name} hat eine ${newStage}-Runde aufgenommen — Verwässerung ${(dilution * 100).toFixed(0)}% (Folge-Investment möglich).`, en: `${s.name} raised a ${newStage} round — dilution ${(dilution * 100).toFixed(0)}% (follow-on available).` }) },
    };
  }

  return { startup: base, proceeds: 0 };
}

export interface VCStepResult {
  vc: VCState;
  proceeds: number;
  notes: VCNote[];
}

/** Advance the whole venture book one month. `scale` sizes new deal flow. */
export function stepVC(vc: VCState, econ: EconomyState, month: number, rng: Rng, reputation: number, scale = 1): VCStepResult {
  const notes: VCNote[] = [];
  let proceeds = 0;
  const cashflows = [...vc.cashflows];

  const portfolio = vc.portfolio.map((s) => {
    const out = stepStartup(s, econ, month, rng);
    if (out.proceeds > 0) {
      proceeds += out.proceeds;
      cashflows.push({ t: month / 12, amount: out.proceeds });
    }
    if (out.note) notes.push(out.note);
    return out.startup;
  });

  return {
    vc: {
      ...vc,
      portfolio,
      totalReturned: vc.totalReturned + proceeds,
      cashflows,
      deals: refreshDeals(rng, reputation, scale),
    },
    proceeds,
    notes,
  };
}

/* ------------------------------ Player levers ---------------------------- */

export interface ActionResult {
  ok: boolean;
  error?: string;
  vc?: VCState;
  cost?: number;
}

/** Follow on pro-rata while a startup is raising, to keep your ownership. */
export function followOn(vc: VCState, startupId: string, month: number): ActionResult {
  const s = vc.portfolio.find((x) => x.id === startupId);
  if (!s || !s.raising) return { ok: false, error: g({ de: 'Keine offene Runde.', en: 'No open round.' }) };
  const cost = s.raising.proRata;
  const updated: Startup = {
    ...s,
    ownership: s.raising.ownershipIfFollow,
    totalInvested: s.totalInvested + cost,
    runwayCash: s.runwayCash + cost,
    raising: undefined,
  };
  return {
    ok: true,
    cost,
    vc: {
      ...vc,
      portfolio: vc.portfolio.map((x) => (x.id === startupId ? updated : x)),
      totalInvested: vc.totalInvested + cost,
      cashflows: [...vc.cashflows, { t: month / 12, amount: -cost }],
    },
  };
}

/** Operational support: boosts growth & survival for a cost. */
export function supportStartup(vc: VCState, startupId: string, month: number): ActionResult {
  const s = vc.portfolio.find((x) => x.id === startupId);
  if (!s || s.status !== 'active') return { ok: false, error: g({ de: 'Startup nicht aktiv.', en: 'Startup not active.' }) };
  if (s.support >= 1) return { ok: false, error: g({ de: 'Maximale Unterstützung erreicht.', en: 'Maximum support reached.' }) };
  const cost = Math.max(250_000, s.postMoney * 0.01);
  const updated: Startup = { ...s, support: Math.min(1, s.support + 0.15), health: Math.min(1, s.health + 0.05), totalInvested: s.totalInvested + cost };
  return {
    ok: true,
    cost,
    vc: {
      ...vc,
      portfolio: vc.portfolio.map((x) => (x.id === startupId ? updated : x)),
      totalInvested: vc.totalInvested + cost,
      cashflows: [...vc.cashflows, { t: month / 12, amount: -cost }],
    },
  };
}

/* -------------------------------- Metrics -------------------------------- */

export function holdingValue(s: Startup): number {
  return s.status === 'active' ? s.postMoney * s.ownership : 0;
}

export function vcResidualValue(vc: VCState): number {
  return vc.portfolio.reduce((a, s) => a + holdingValue(s), 0);
}

export function vcMetrics(vc: VCState, month: number) {
  const residual = vcResidualValue(vc);
  const paidIn = vc.totalInvested;
  const totalValue = vc.totalReturned + residual;
  const flows = residual > 0 ? [...vc.cashflows, { t: month / 12, amount: residual }] : vc.cashflows;
  // Annualised IRR is not meaningful in year one (sub-year annualisation explodes).
  const netIrr = month >= 12 ? irr(flows) : NaN;
  return {
    residual,
    paidIn,
    distributions: vc.totalReturned,
    tvpi: paidIn > 0 ? totalValue / paidIn : 0,
    moic: paidIn > 0 ? totalValue / paidIn : 0,
    irr: netIrr,
    activeCount: vc.portfolio.filter((s) => s.status === 'active').length,
  };
}
