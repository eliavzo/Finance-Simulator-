/**
 * Fund economics: LP capital, management fees, the carry waterfall, capital
 * calls, distributions and fundraising.
 *
 * The fund charges a `mgmtFeeRate` (annual, accrued monthly) and earns
 * `carryRate` over a `hurdleRate` preferred return, crystallised annually
 * against a high-water mark (a clean blend of HF performance-fee and PE
 * waterfall mechanics).
 */
import { FundState, LimitedPartner, LPType } from './types';
import { irr } from '../engine/finance';
import { Rng } from '../engine/rng';

const LP_NAMES: Record<LPType, string[]> = {
  Pension: ['State Teachers Pension', 'Ironworkers Retirement', 'Nordic Pension'],
  Endowment: ['Ivy Endowment', 'Tech Institute Fund', 'Museum Trust'],
  FamilyOffice: ['Vanderlay Family Office', 'Mehta Holdings', 'Osei Capital'],
  SovereignWealth: ['Gulf Sovereign Fund', 'Pacific Reserve Authority'],
  FundOfFunds: ['Cornerstone FoF', 'Meridian Multi-Manager'],
};

const LP_PROFILE: Record<LPType, { expectedReturn: number; patience: number }> = {
  Pension: { expectedReturn: 0.08, patience: 0.85 },
  Endowment: { expectedReturn: 0.1, patience: 0.8 },
  FamilyOffice: { expectedReturn: 0.12, patience: 0.6 },
  SovereignWealth: { expectedReturn: 0.07, patience: 0.9 },
  FundOfFunds: { expectedReturn: 0.13, patience: 0.5 },
};

let lpCounter = 0;

export function createLP(type: LPType, committed: number, rng: Rng): LimitedPartner {
  lpCounter += 1;
  const prof = LP_PROFILE[type];
  return {
    id: `lp-${lpCounter}`,
    name: rng.pick(LP_NAMES[type]),
    type,
    committed,
    called: 0,
    distributed: 0,
    expectedReturn: prof.expectedReturn,
    patience: prof.patience,
    redeemed: false,
  };
}

/** Anchor commitment from the founder's own family office at launch. */
export function createFund(vintageMonth: number, anchorCommitment: number, rng: Rng): FundState {
  const lps = [createLP('FamilyOffice', anchorCommitment, rng)];
  return {
    vintageMonth,
    committed: anchorCommitment,
    called: 0,
    distributed: 0,
    lps,
    mgmtFeeRate: 0.02,
    carryRate: 0.2,
    hurdleRate: 0.08,
    highWaterMark: 0,
    accruedCarry: 0,
    cashflows: [],
    lastCarryMonth: vintageMonth,
  };
}

export function uncalledCapital(fund: FundState): number {
  return Math.max(0, fund.committed - fund.called);
}

/* ----------------------------- Capital calls ----------------------------- */

export interface CallResult {
  fund: FundState;
  /** Cash actually called (≤ requested, ≤ uncalled). */
  called: number;
}

/**
 * Call `amount` of capital from LPs pro-rata to their uncalled commitments.
 * Returns the cash to add to the fund's investable balance.
 */
export function callCapital(fund: FundState, amount: number, month: number): CallResult {
  const available = uncalledCapital(fund);
  const called = Math.min(amount, available);
  if (called <= 0) return { fund, called: 0 };

  const lps = fund.lps.map((lp) => {
    if (lp.redeemed) return lp;
    const lpUncalled = lp.committed - lp.called;
    const share = available > 0 ? lpUncalled / available : 0;
    return { ...lp, called: lp.called + called * share };
  });

  return {
    fund: {
      ...fund,
      called: fund.called + called,
      lps,
      cashflows: [...fund.cashflows, { t: (month - fund.vintageMonth) / 12, amount: -called }],
    },
    called,
  };
}

/* ----------------------------- Distributions ----------------------------- */

/** Distribute `amount` of cash back to LPs pro-rata to called capital. */
export function distribute(fund: FundState, amount: number, month: number): FundState {
  if (amount <= 0 || fund.called <= 0) return fund;
  const lps = fund.lps.map((lp) => {
    const share = lp.called / fund.called;
    return { ...lp, distributed: lp.distributed + amount * share };
  });
  return {
    ...fund,
    distributed: fund.distributed + amount,
    lps,
    cashflows: [...fund.cashflows, { t: (month - fund.vintageMonth) / 12, amount }],
  };
}

/* ------------------------------ Management fee ---------------------------- */

/**
 * Monthly management fee. Charged on committed capital during the 5-year
 * investment period, then on NAV thereafter.
 */
export function monthlyManagementFee(fund: FundState, fundNav: number, month: number): number {
  const investmentPeriodOver = month - fund.vintageMonth > 60;
  const base = investmentPeriodOver ? fundNav : fund.committed;
  return (base * fund.mgmtFeeRate) / 12;
}

/* --------------------------------- Carry --------------------------------- */

export interface CarryResult {
  fund: FundState;
  /** Carry crystallised to the GP this step (0 unless it's the anniversary). */
  carry: number;
}

/**
 * Annual carried-interest crystallisation. Once every 12 months, charge
 * `carryRate` on the NAV gain above the high-water mark in excess of the
 * `hurdleRate` preferred return. The crystallised carry is paid out of fund NAV.
 */
export function crystalliseCarry(fund: FundState, fundNav: number, month: number): CarryResult {
  if (month - fund.lastCarryMonth < 12) return { fund, carry: 0 };

  const hwm = fund.highWaterMark || fund.called || fundNav;
  const gain = fundNav - hwm;
  const preferred = hwm * fund.hurdleRate;
  const carryBase = Math.max(0, gain - preferred);
  const carry = carryBase * fund.carryRate;

  return {
    fund: {
      ...fund,
      highWaterMark: Math.max(hwm, fundNav - carry),
      lastCarryMonth: month,
    },
    carry,
  };
}

/* ------------------------------ Fundraising ------------------------------- */

export interface FundMetrics {
  paidIn: number;
  distributions: number;
  nav: number;
  dpi: number;
  rvpi: number;
  tvpi: number;
  /** Net IRR to LPs (annualised); NaN until there are sign-changing flows. */
  netIrr: number;
}

export function fundMetrics(fund: FundState, fundNav: number, month: number): FundMetrics {
  const paidIn = fund.called;
  const elapsedMonths = month - fund.vintageMonth;
  const flows = [...fund.cashflows, { t: elapsedMonths / 12, amount: fundNav }];
  // Annualised IRR is not meaningful in the first year (sub-year annualisation
  // explodes); report NaN so the UI shows "—" until there's a real track record.
  const netIrr = elapsedMonths >= 12 ? irr(flows) : NaN;
  return {
    paidIn,
    distributions: fund.distributed,
    nav: fundNav,
    dpi: paidIn > 0 ? fund.distributed / paidIn : 0,
    rvpi: paidIn > 0 ? fundNav / paidIn : 0,
    tvpi: paidIn > 0 ? (fund.distributed + fundNav) / paidIn : 0,
    netIrr,
  };
}

/**
 * Offer new LP commitments based on track record and fundraising capability.
 * Returns the new LP if one commits this month, else null.
 */
export function tryRaiseCapital(
  fund: FundState,
  metrics: FundMetrics,
  fundraisingCapability: number,
  reputation: number,
  rng: Rng,
): LimitedPartner | null {
  // Strong TVPI / IRR + reputation + IR capability attract inbound LPs.
  const trackRecord = Number.isFinite(metrics.netIrr) ? Math.max(0, metrics.netIrr) : metrics.tvpi > 1 ? 0.1 : 0;
  const appetite = fundraisingCapability * 0.6 + (reputation - 50) / 200 + trackRecord;
  const monthlyProb = Math.max(0, Math.min(0.25, appetite * 0.15));
  if (!rng.chance(monthlyProb)) return null;

  const types: LPType[] = ['Pension', 'Endowment', 'FamilyOffice', 'SovereignWealth', 'FundOfFunds'];
  const type = rng.pick(types);
  // Ticket size scales with reputation & track record.
  const base = 5_000_000 + reputation * 200_000;
  const ticket = Math.round((base * rng.range(0.6, 1.8) * (1 + trackRecord)) / 1_000_000) * 1_000_000;
  return createLP(type, Math.max(2_000_000, ticket), rng);
}
