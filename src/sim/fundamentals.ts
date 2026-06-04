/**
 * Equity fundamentals & valuation.
 *
 * Each stock has earnings (eps) that grow with understandable macro drivers, and
 * a *fair value* derived from those earnings, its growth and the level of
 * interest rates. Prices mean-revert toward fair value, so the game rewards
 * buying what is cheap relative to fundamentals rather than guessing direction.
 */
import { EconomyState, EquityInstrument, Sector } from './types';
import { interpolateCurve } from './quant';

/** A reference 10-year rate used as the discount-rate anchor for equities. */
function longRate(econ: EconomyState): number {
  return interpolateCurve(econ.yieldCurve, 10);
}

/**
 * Fair value per share = eps × a justified P/E.
 *
 * The multiple rises with growth and falls with interest rates — and growth
 * stocks are more rate-sensitive (longer duration), so a rate rise hits high-PE
 * names hardest. Bounded to keep the model stable.
 */
export function equityFairValue(
  eps: number,
  epsGrowth: number,
  rfLong: number,
): number {
  const growthFactor = clamp(1 + (epsGrowth - 0.05) * 5, 0.5, 2.2);
  const rateSensitivity = 3 + epsGrowth * 20; // growth = duration
  const rateFactor = clamp(1 - (rfLong - 0.04) * rateSensitivity, 0.5, 1.6);
  const pe = clamp(15 * growthFactor * rateFactor, 6, 45);
  return Math.max(0.5, eps * pe);
}

/** Convenience: fair value of an instrument under the current economy. */
export function fairValueOf(inst: EquityInstrument, econ: EconomyState): number {
  return equityFairValue(inst.eps, inst.epsGrowth, longRate(econ));
}

/** Valuation gap = fair/price − 1 (positive ⇒ undervalued / cheap). */
export function valuationGap(price: number, fairValue: number): number {
  if (price <= 0) return 0;
  return fairValue / price - 1;
}

/**
 * Expected annual *earnings* growth for a sector given current macro — the
 * legible cause-effect chain the player reasons about.
 */
export function sectorEarningsGrowth(
  inst: EquityInstrument,
  econ: EconomyState,
  oilRel: number,
): number {
  const gdpGap = econ.gdpGrowth - 0.02;
  const rateGap = econ.policyRate - 0.03;
  let g = inst.epsGrowth;
  switch (inst.sector) {
    case 'Financials':
      g += rateGap * 0.8 + gdpGap * 0.6; // banks earn on rates & growth
      break;
    case 'Energy':
      g += (oilRel - 1) * 0.5 + gdpGap * 0.3; // tied to the oil price
      break;
    case 'Tech':
      g += gdpGap * 1.1 + econ.sentiment * 0.03; // cyclical growth (rate hit is via fair value)
      break;
    case 'Consumer':
      g += gdpGap * 0.9 + econ.sentiment * 0.02;
      break;
    case 'Industrials':
      g += gdpGap * 1.0;
      break;
    case 'Healthcare':
      g += 0.005; // defensive, steady
      break;
  }
  if (econ.regime === 'contraction' && inst.sector !== 'Healthcare') g -= 0.04;
  return g;
}

export interface SectorOutlook {
  sector: Sector;
  /** Bias in [-1, 1]; positive = macro tailwind. */
  bias: number;
  driver: string;
}

/** Per-sector macro outlook, for the player to reason from. */
export function sectorOutlooks(econ: EconomyState, oilRel: number): SectorOutlook[] {
  const gdpGap = econ.gdpGrowth - 0.02;
  const rateGap = econ.policyRate - 0.03;
  const rfLong = longRate(econ);
  const rateDrag = (rfLong - 0.04) * 8; // hits long-duration growth
  const sectors: { s: Sector; bias: number; driver: string }[] = [
    { s: 'Financials', bias: rateGap * 8 + gdpGap * 5, driver: 'Zinsen & Wachstum' },
    { s: 'Energy', bias: (oilRel - 1) * 3 + gdpGap * 3, driver: 'Ölpreis' },
    { s: 'Tech', bias: gdpGap * 8 + econ.sentiment * 2 - rateDrag, driver: 'Wachstum & Zinsen' },
    { s: 'Consumer', bias: gdpGap * 7 + econ.sentiment * 2, driver: 'Konsumlaune' },
    { s: 'Industrials', bias: gdpGap * 8 - rateDrag * 0.4, driver: 'Konjunktur' },
    { s: 'Healthcare', bias: 1 - Math.abs(gdpGap) * 4, driver: 'Defensiv' },
  ];
  return sectors.map(({ s, bias, driver }) => ({ sector: s, bias: clamp(bias, -1, 1), driver }));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
