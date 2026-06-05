/**
 * Multi-instrument market simulation (monthly).
 *
 * Equities co-move through a shared market factor (so a portfolio of names has
 * real systematic risk), plus sector tilts and idiosyncratic noise. Bonds are
 * constant-maturity indices repriced off the yield curve + a rating spread. FX
 * and commodities follow GBM with carry / cyclicality drifts. Options are
 * repriced from their underlying with Black-Scholes. Rare Black-Swan months
 * apply a multiplicative crash.
 */
import {
  BondInstrument,
  CreditRating,
  EconomyState,
  EquityInstrument,
  Instrument,
  OptionInstrument,
  Sector,
} from './types';
import { blackScholes, bondPrice, interpolateCurve } from './quant';
import { equityFairValue, sectorEarningsGrowth } from './fundamentals';
import { Rng } from '../engine/rng';

/** Neutral long rate used to size starting earnings so stocks open near fair. */
const RF0 = 0.044;

const DT = 1 / 12;
const MAX_HISTORY = 120;

const RATING_SPREAD: Record<CreditRating, number> = {
  AAA: 0.002,
  AA: 0.004,
  A: 0.008,
  BBB: 0.014,
  BB: 0.03,
  B: 0.055,
};

const SECTOR_BETA: Record<Sector, number> = {
  Tech: 1.4,
  Financials: 1.2,
  Energy: 1.3,
  Healthcare: 0.7,
  Consumer: 0.9,
  Industrials: 1.1,
};

/** Build the full tradeable universe. */
export function createInstruments(): Instrument[] {
  const out: Instrument[] = [];

  const equities: { symbol: string; name: string; sector: Sector; price: number; epsGrowth: number; margin: number; vol: number; dividendYield: number }[] = [
    { symbol: 'NOVA', name: 'Nova Compute', sector: 'Tech', price: 120, epsGrowth: 0.16, margin: 0.22, vol: 0.30, dividendYield: 0 },
    { symbol: 'QBIT', name: 'Qubit Systems', sector: 'Tech', price: 85, epsGrowth: 0.18, margin: 0.18, vol: 0.36, dividendYield: 0 },
    { symbol: 'MERC', name: 'Mercator Bank', sector: 'Financials', price: 60, epsGrowth: 0.05, margin: 0.28, vol: 0.24, dividendYield: 0.03 },
    { symbol: 'PETRO', name: 'PetroNova', sector: 'Energy', price: 48, epsGrowth: 0.04, margin: 0.16, vol: 0.30, dividendYield: 0.045 },
    { symbol: 'HELI', name: 'Helios Power', sector: 'Energy', price: 32, epsGrowth: 0.10, margin: 0.12, vol: 0.36, dividendYield: 0.01 },
    { symbol: 'MEDI', name: 'MediCore', sector: 'Healthcare', price: 140, epsGrowth: 0.06, margin: 0.25, vol: 0.20, dividendYield: 0.02 },
    { symbol: 'GENE', name: 'GeneTrust', sector: 'Healthcare', price: 72, epsGrowth: 0.13, margin: 0.15, vol: 0.34, dividendYield: 0 },
    { symbol: 'SHOP', name: 'ShopWave', sector: 'Consumer', price: 55, epsGrowth: 0.07, margin: 0.10, vol: 0.26, dividendYield: 0.015 },
    { symbol: 'FORGE', name: 'Forge Industrial', sector: 'Industrials', price: 78, epsGrowth: 0.06, margin: 0.14, vol: 0.24, dividendYield: 0.025 },
  ];
  equities.forEach((e, i) => {
    // Size starting eps so the opening price equals fair value.
    const pe0 = equityFairValue(1, e.epsGrowth, RF0);
    const eps = e.price / pe0;
    out.push({
      id: `eq-${i}`,
      kind: 'equity',
      symbol: e.symbol,
      name: e.name,
      sector: e.sector,
      price: e.price,
      eps,
      epsGrowth: e.epsGrowth,
      margin: e.margin,
      fairValue: e.price,
      vol: e.vol,
      dividendYield: e.dividendYield,
      beta: SECTOR_BETA[e.sector],
      priceHistory: [e.price],
    });
  });

  const bonds: { symbol: string; name: string; issuer: string; sector: BondInstrument['sector']; coupon: number; mat: number; rating: CreditRating }[] = [
    { symbol: 'UST2Y', name: '2Y Treasury', issuer: 'Treasury', sector: 'Government', coupon: 0.03, mat: 2, rating: 'AAA' },
    { symbol: 'UST10Y', name: '10Y Treasury', issuer: 'Treasury', sector: 'Government', coupon: 0.035, mat: 10, rating: 'AAA' },
    { symbol: 'IGCORP', name: 'IG Corp 7Y', issuer: 'Blue Chip Inc', sector: 'Industrials', coupon: 0.05, mat: 7, rating: 'BBB' },
    { symbol: 'HYCORP', name: 'HY Corp 5Y', issuer: 'Levered Co', sector: 'Consumer', coupon: 0.08, mat: 5, rating: 'B' },
  ];
  bonds.forEach((b, i) => {
    const price = bondPrice(b.coupon, b.coupon, b.mat, 2, 100);
    out.push({
      id: `bd-${i}`,
      kind: 'bond',
      symbol: b.symbol,
      name: b.name,
      issuer: b.issuer,
      sector: b.sector,
      couponRate: b.coupon,
      maturityYears: b.mat,
      faceValue: 100,
      rating: b.rating,
      ytm: b.coupon,
      couponsPerYear: 2,
      price,
      priceHistory: [price],
    });
  });

  const fx: { symbol: string; base: string; quote: string; price: number; vol: number; carry: number }[] = [
    { symbol: 'EUR/USD', base: 'EUR', quote: 'USD', price: 1.1, vol: 0.09, carry: -0.01 },
    { symbol: 'USD/JPY', base: 'USD', quote: 'JPY', price: 110, vol: 0.1, carry: 0.02 },
    { symbol: 'GBP/USD', base: 'GBP', quote: 'USD', price: 1.3, vol: 0.1, carry: -0.005 },
  ];
  fx.forEach((f, i) =>
    out.push({ id: `fx-${i}`, kind: 'fx', name: f.symbol, ...f, priceHistory: [f.price] }),
  );

  const commodities: { symbol: string; name: string; price: number; drift: number; vol: number; cyclicality: number }[] = [
    { symbol: 'OIL', name: 'Crude Oil', price: 75, drift: 0.03, vol: 0.35, cyclicality: 1.4 },
    { symbol: 'GOLD', name: 'Gold', price: 1900, drift: 0.04, vol: 0.16, cyclicality: -0.6 },
  ];
  commodities.forEach((c, i) =>
    out.push({ id: `cm-${i}`, kind: 'commodity', ...c, priceHistory: [c.price] }),
  );

  return out;
}

export interface MarketStepResult {
  instruments: Instrument[];
  blackSwan: boolean;
}

/** Annualised expected market-factor drift implied by current conditions. */
export function marketDrift(econ: EconomyState): number {
  return (
    0.04 +
    econ.sentiment * 0.07 +
    (econ.gdpGrowth - 0.02) * 1.2 -
    (econ.policyRate - 0.03) * 0.6
  );
}

/**
 * The model's *expected* annualised return for an instrument under current
 * conditions (before noise). This is the ground truth research signals try to
 * estimate — a strong team sees it clearly, a weak one mostly sees noise.
 * Returns null for instruments without a clean directional view (options).
 */
export function expectedAnnualReturn(inst: Instrument, econ: EconomyState): number | null {
  switch (inst.kind) {
    case 'equity': {
      // Fundamentals: convergence of price to fair value + dividend carry.
      const rfLong = interpolateCurve(econ.yieldCurve, 10);
      const fair = equityFairValue(inst.eps, inst.epsGrowth, rfLong);
      const gap = Math.log(fair / inst.price);
      return 0.1 * gap * 12 + inst.dividendYield;
    }
    case 'commodity':
      return inst.drift + inst.cyclicality * (econ.gdpGrowth - 0.02) * 1.5;
    case 'fx':
      return inst.carry;
    case 'bond':
      // Carry minus a small expected mean-reversion of yields; broadly the YTM.
      return inst.ytm - 0.02;
    default:
      return null;
  }
}

/** Advance every instrument by one month. `extraEquityShock` is an additional
 *  monthly log-return applied to equities (e.g. a crisis sell-off or squeeze). */
export function stepMarket(instruments: Instrument[], econ: EconomyState, month: number, rng: Rng, extraEquityShock = 0, swanProbMult = 1): MarketStepResult {
  const swanProb = (econ.regime === 'peak' || econ.regime === 'contraction' ? 0.015 : 0.004) * swanProbMult;
  const blackSwan = rng.chance(swanProb);

  const mDrift = marketDrift(econ);
  const mVol = Math.max(0.08, econ.volIndex / 100);
  const zMkt = rng.normal();
  const marketLogReturn = (mDrift - 0.5 * mVol * mVol) * DT + mVol * Math.sqrt(DT) * zMkt;
  const rfLong = interpolateCurve(econ.yieldCurve, 10);
  const oil = instruments.find((i) => i.kind === 'commodity' && i.symbol === 'OIL')?.price ?? 75;
  const oilRel = oil / 75;

  // First pass: everything except options (options need updated underlyings).
  const updated = instruments.map((inst): Instrument => {
    switch (inst.kind) {
      case 'equity': {
        // 1. Earnings evolve with macro drivers (+ noise / occasional surprise).
        const gAnnual = sectorEarningsGrowth(inst, econ, oilRel);
        const surprise = rng.chance(0.05) ? rng.range(-0.06, 0.08) : 0;
        const eps = Math.max(0.01, inst.eps * (1 + gAnnual / 12 + rng.normal(0, 0.012) + surprise));
        // 2. Fair value follows earnings & rates.
        const fair = equityFairValue(eps, inst.epsGrowth, rfLong);
        // 3. Price mean-reverts toward fair value, plus a modest market factor.
        const logGap = Math.log(fair / inst.price);
        const zIdio = rng.normal();
        let logRet =
          0.1 * logGap +
          inst.beta * marketLogReturn * 0.4 +
          inst.vol * Math.sqrt(DT) * zIdio * 0.7 +
          extraEquityShock * inst.beta;
        if (blackSwan) logRet += Math.log(1 - Math.min(0.6, rng.range(0.12, 0.32) * inst.beta));
        const price = Math.max(0.5, inst.price * Math.exp(logRet));
        return { ...inst, eps, fairValue: fair, price, priceHistory: [...inst.priceHistory, price].slice(-MAX_HISTORY) };
      }
      case 'bond': {
        const baseRate = interpolateCurve(econ.yieldCurve, inst.maturityYears);
        const spread = RATING_SPREAD[inst.rating] + (inst.rating === 'B' || inst.rating === 'BB' ? econ.hySpread - 0.04 : econ.igSpread - 0.012);
        const ytm = Math.max(0.001, baseRate + spread);
        let price = bondPrice(ytm, inst.couponRate, inst.maturityYears, inst.couponsPerYear, inst.faceValue);
        if (blackSwan && inst.rating !== 'AAA') price *= 1 - rng.range(0.03, 0.1);
        return { ...inst, ytm, price, priceHistory: [...inst.priceHistory, price].slice(-MAX_HISTORY) };
      }
      case 'fx': {
        const z = rng.normal();
        const logRet = (inst.carry - 0.5 * inst.vol * inst.vol) * DT + inst.vol * Math.sqrt(DT) * z;
        const price = Math.max(0.0001, inst.price * Math.exp(logRet));
        return { ...inst, price, priceHistory: [...inst.priceHistory, price].slice(-MAX_HISTORY) };
      }
      case 'commodity': {
        const z = rng.normal();
        const drift = inst.drift + inst.cyclicality * (econ.gdpGrowth - 0.02) * 1.5;
        let logRet = (drift - 0.5 * inst.vol * inst.vol) * DT + inst.vol * Math.sqrt(DT) * z;
        if (blackSwan) logRet += Math.log(1 - Math.min(0.6, rng.range(0.1, 0.35) * Math.max(0.2, inst.cyclicality)));
        const price = Math.max(0.5, inst.price * Math.exp(logRet));
        return { ...inst, price, priceHistory: [...inst.priceHistory, price].slice(-MAX_HISTORY) };
      }
      default:
        return inst;
    }
  });

  // Second pass: reprice options off the freshly-updated underlyings.
  const priceById = new Map(updated.map((i) => [i.id, i.price]));
  const final = updated.map((inst): Instrument => {
    if (inst.kind !== 'option') return inst;
    return repriceOption(inst, priceById.get(inst.underlyingId) ?? 0, econ, month, updated);
  });

  return { instruments: final, blackSwan };
}

/** Reprice a single option from its underlying & current conditions. */
export function repriceOption(
  opt: OptionInstrument,
  underlyingPrice: number,
  econ: EconomyState,
  month: number,
  universe: Instrument[],
): OptionInstrument {
  const t = Math.max(0, (opt.expiryMonth - month) / 12);
  const underlying = universe.find((i) => i.id === opt.underlyingId);
  const baseVol = underlying && underlying.kind === 'equity' ? underlying.vol : 0.3;
  const sigma = Math.max(0.1, baseVol * (econ.volIndex / 16));
  const r = interpolateCurve(econ.yieldCurve, Math.max(0.08, t));
  const { price: perShare } = blackScholes(opt.optionType, underlyingPrice, opt.strike, t, r, sigma);
  // Quote per contract so the portfolio's generic |qty|·price notional holds.
  const price = perShare * opt.multiplier;
  return { ...opt, price, priceHistory: [...opt.priceHistory, price].slice(-MAX_HISTORY) };
}
