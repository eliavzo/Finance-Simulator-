/**
 * Real-estate pillar: acquire income-producing property, collect monthly net
 * rent, ride the cycle for capital appreciation, and optionally lever with a
 * mortgage. Distinct from the venture book: steady cash yield rather than the
 * power law, but rate-sensitive and illiquid — values fall when rates rise and
 * occupancy slips in downturns, and selling in a panic costs a liquidity haircut.
 */
import { EconomyState, Property, PropertyDeal, PropertyType, RealEstateState } from './types';
import { irr } from '../engine/finance';
import { g } from '../i18n/lang';
import { Rng } from '../engine/rng';

const FIRST = ['Harbor', 'Kingsway', 'Meridian', 'Granite', 'Beacon', 'Crown', 'Cedar', 'Olympia', 'Sterling', 'Park', 'Summit', 'Vanguard', 'Riverside', 'Cornerstone'];
const LAST = ['Tower', 'Plaza', 'Court', 'Yards', 'Exchange', 'Terrace', 'Works', 'Lofts', 'Center', 'House', 'Gardens', 'Wharf'];

const TYPES: PropertyType[] = ['Residential', 'Office', 'Retail', 'Industrial', 'Hotel'];

interface TypeParam {
  capLow: number; capHigh: number;
  /** How strongly value tracks the economic cycle. */
  cyclicality: number;
  /** Sensitivity of value to rising rates. */
  rateSens: number;
  /** Baseline occupancy. */
  occ: number;
}
const PARAM: Record<PropertyType, TypeParam> = {
  Residential: { capLow: 0.04, capHigh: 0.052, cyclicality: 0.4, rateSens: 0.9, occ: 0.95 },
  Office: { capLow: 0.06, capHigh: 0.08, cyclicality: 1.0, rateSens: 1.1, occ: 0.9 },
  Retail: { capLow: 0.065, capHigh: 0.085, cyclicality: 1.1, rateSens: 1.0, occ: 0.88 },
  Industrial: { capLow: 0.055, capHigh: 0.07, cyclicality: 0.8, rateSens: 0.9, occ: 0.93 },
  Hotel: { capLow: 0.075, capHigh: 0.1, cyclicality: 1.5, rateSens: 1.0, occ: 0.82 },
};

let ctr = 0;
function makeName(rng: Rng): string {
  ctr += 1;
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}

export function createRealEstate(): RealEstateState {
  return { deals: [], portfolio: [], totalInvested: 0, totalReturned: 0, cashflows: [] };
}

/** Generate one property on the market; `scale` sizes prices with the fund. */
export function generatePropertyDeal(rng: Rng, scale = 1): PropertyDeal {
  ctr += 1;
  const type = rng.pick(TYPES);
  const p = PARAM[type];
  const sizeMult = Math.max(1, Math.min(4, 1 + (scale - 1) * 0.18));
  const price = rng.range(3_000_000, 12_000_000) * sizeMult;
  return {
    id: `prop-${ctr}-${rng.int(0, 9999)}`,
    name: makeName(rng),
    type,
    price: Math.round(price / 100_000) * 100_000,
    capRate: rng.range(p.capLow, p.capHigh),
    quality: Math.max(0.3, Math.min(0.95, rng.range(0.4, 0.9))),
  };
}

export function refreshPropertyDeals(rng: Rng, scale = 1): PropertyDeal[] {
  return Array.from({ length: rng.int(2, 4) }, () => generatePropertyDeal(rng, scale));
}

export interface REActionResult {
  ok: boolean;
  error?: string;
  re?: RealEstateState;
  /** Cash the fund pays (buy) or receives (sell). */
  cash?: number;
}

/** Acquire a property; with `mortgage`, put 50% down and finance the rest. */
export function buyProperty(re: RealEstateState, dealId: string, month: number, mortgage: boolean): REActionResult {
  const deal = re.deals.find((d) => d.id === dealId);
  if (!deal) return { ok: false, error: g({ de: 'Objekt nicht mehr verfügbar.', en: 'Property no longer available.' }) };
  const debt = mortgage ? deal.price * 0.5 : 0;
  const down = deal.price - debt;
  ctr += 1;
  const prop: Property = {
    id: `re-${month}-${ctr}`,
    name: deal.name,
    type: deal.type,
    status: 'active',
    value: deal.price,
    capRate: deal.capRate,
    quality: deal.quality,
    occupancy: PARAM[deal.type].occ,
    debt,
    invested: down,
    boughtMonth: month,
  };
  return {
    ok: true,
    cash: down,
    re: {
      ...re,
      deals: re.deals.filter((d) => d.id !== dealId),
      portfolio: [...re.portfolio, prop],
      totalInvested: re.totalInvested + down,
      cashflows: [...re.cashflows, { t: month / 12, amount: -down }],
    },
  };
}

/** Sell a property: transaction cost + a liquidity haircut in stressed markets,
 *  net of any outstanding mortgage. */
export function sellProperty(re: RealEstateState, id: string, month: number, volIndex: number): REActionResult {
  const prop = re.portfolio.find((p) => p.id === id);
  if (!prop || prop.status !== 'active') return { ok: false, error: g({ de: 'Objekt nicht aktiv.', en: 'Property not active.' }) };
  const txCost = prop.value * 0.03;
  const liquidityHaircut = volIndex > 25 ? prop.value * 0.05 : 0;
  const proceeds = Math.max(0, prop.value - txCost - liquidityHaircut - prop.debt);
  return {
    ok: true,
    cash: proceeds,
    re: {
      ...re,
      portfolio: re.portfolio.map((p) => (p.id === id ? { ...p, status: 'sold' as const } : p)),
      totalReturned: re.totalReturned + proceeds,
      cashflows: [...re.cashflows, { t: month / 12, amount: proceeds }],
    },
  };
}

export interface RENote {
  kind: 'income' | 'event';
  text: string;
}

export interface REStepResult {
  re: RealEstateState;
  /** Net rent (minus maintenance & mortgage interest) paid to the fund. */
  income: number;
  notes: RENote[];
}

/** Advance the whole property book one month. */
export function stepRealEstate(re: RealEstateState, econ: EconomyState, month: number, rng: Rng, scale = 1): REStepResult {
  const notes: RENote[] = [];
  let income = 0;
  const expansion = econ.regime === 'expansion' || econ.regime === 'peak';
  const contraction = econ.regime === 'contraction';
  const mortgageRate = econ.policyRate + 0.02;

  const portfolio = re.portfolio.map((prop) => {
    if (prop.status !== 'active') return prop;
    const p = PARAM[prop.type];

    // Occupancy drifts toward a regime-dependent target.
    const occTarget = Math.max(0.5, Math.min(0.99, p.occ + (expansion ? 0.03 : 0) - (contraction ? 0.08 : 0) - (1 - prop.quality) * 0.05));
    let occupancy = prop.occupancy + (occTarget - prop.occupancy) * 0.25 + rng.normal(0, 0.015);
    occupancy = Math.max(0.4, Math.min(1, occupancy));

    // Value drift: cycle + sentiment − rate pressure + idiosyncratic noise.
    const cycle = (econ.gdpGrowth - 0.02) * p.cyclicality * 0.5 + econ.sentiment * 0.02;
    const ratePressure = (econ.policyRate - 0.03) * p.rateSens * 0.4;
    const monthlyDrift = cycle / 12 - ratePressure / 12 + (prop.quality - 0.6) * 0.001 + rng.normal(0, 0.012);
    const value = Math.max(100_000, prop.value * (1 + monthlyDrift));

    // Net rent to the fund: cap-rate yield × occupancy − maintenance − interest.
    const grossRent = value * (prop.capRate / 12) * occupancy;
    const maintenance = value * 0.0008;
    const interest = prop.debt * (mortgageRate / 12);
    income += grossRent - maintenance - interest;

    // Occasional flavour events.
    if (rng.chance(0.02)) {
      if (contraction && rng.chance(0.5)) {
        occupancy = Math.max(0.4, occupancy - 0.15);
        notes.push({ kind: 'event', text: g({ de: `${prop.name}: Großmieter zieht aus — Leerstand steigt.`, en: `${prop.name}: anchor tenant leaves — vacancy rises.` }) });
      } else {
        notes.push({ kind: 'event', text: g({ de: `${prop.name}: Mietvertrag verlängert — stabile Erträge.`, en: `${prop.name}: lease renewed — steady income.` }) });
      }
    }
    return { ...prop, value, occupancy };
  });

  return {
    re: { ...re, portfolio, totalReturned: re.totalReturned + Math.max(0, income), deals: refreshPropertyDeals(rng, scale) },
    income,
    notes,
  };
}

/** Equity value of the active book (value net of debt). */
export function realEstateEquity(re: RealEstateState | undefined): number {
  if (!re) return 0;
  return re.portfolio.reduce((a, p) => a + (p.status === 'active' ? Math.max(0, p.value - p.debt) : 0), 0);
}

export function reMetrics(re: RealEstateState | undefined, month: number) {
  const equity = realEstateEquity(re);
  if (!re) return { equity, paidIn: 0, distributions: 0, moic: 0, irr: NaN, activeCount: 0, monthlyIncome: 0 };
  const paidIn = re.totalInvested;
  const totalValue = re.totalReturned + equity;
  const flows = equity > 0 ? [...re.cashflows, { t: month / 12, amount: equity }] : re.cashflows;
  const monthlyIncome = re.portfolio.reduce((a, p) => {
    if (p.status !== 'active') return a;
    return a + p.value * (p.capRate / 12) * p.occupancy - p.value * 0.0008 - p.debt * 0.003;
  }, 0);
  return {
    equity,
    paidIn,
    distributions: re.totalReturned,
    moic: paidIn > 0 ? totalValue / paidIn : 0,
    irr: month >= 12 ? irr(flows) : NaN,
    activeCount: re.portfolio.filter((p) => p.status === 'active').length,
    monthlyIncome,
  };
}
