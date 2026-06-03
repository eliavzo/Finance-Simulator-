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
import { Rng } from '../engine/rng';

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

  const equities: Omit<EquityInstrument, 'id' | 'kind' | 'priceHistory' | 'beta'>[] = [
    { symbol: 'NOVA', name: 'Nova Compute', sector: 'Tech', price: 120, drift: 0.11, vol: 0.34, dividendYield: 0 },
    { symbol: 'QBIT', name: 'Qubit Systems', sector: 'Tech', price: 85, drift: 0.14, vol: 0.42, dividendYield: 0 },
    { symbol: 'MERC', name: 'Mercator Bank', sector: 'Financials', price: 60, drift: 0.07, vol: 0.26, dividendYield: 0.03 },
    { symbol: 'PETRO', name: 'PetroNova', sector: 'Energy', price: 48, drift: 0.05, vol: 0.33, dividendYield: 0.045 },
    { symbol: 'HELI', name: 'Helios Power', sector: 'Energy', price: 32, drift: 0.10, vol: 0.4, dividendYield: 0.01 },
    { symbol: 'MEDI', name: 'MediCore', sector: 'Healthcare', price: 140, drift: 0.08, vol: 0.22, dividendYield: 0.02 },
    { symbol: 'GENE', name: 'GeneTrust', sector: 'Healthcare', price: 72, drift: 0.12, vol: 0.4, dividendYield: 0 },
    { symbol: 'SHOP', name: 'ShopWave', sector: 'Consumer', price: 55, drift: 0.08, vol: 0.28, dividendYield: 0.015 },
    { symbol: 'FORGE', name: 'Forge Industrial', sector: 'Industrials', price: 78, drift: 0.06, vol: 0.26, dividendYield: 0.025 },
  ];
  equities.forEach((e, i) =>
    out.push({
      ...e,
      id: `eq-${i}`,
      kind: 'equity',
      beta: SECTOR_BETA[e.sector],
      priceHistory: [e.price],
    }),
  );

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

const SECTOR_REGIME_TILT: Record<Sector, Record<EconomyState['regime'], number>> = {
  Tech: { expansion: 0.06, peak: -0.02, contraction: -0.1, trough: 0.02 },
  Financials: { expansion: 0.05, peak: 0.0, contraction: -0.08, trough: 0.0 },
  Energy: { expansion: 0.04, peak: 0.03, contraction: -0.06, trough: -0.02 },
  Healthcare: { expansion: 0.02, peak: 0.01, contraction: 0.0, trough: 0.02 },
  Consumer: { expansion: 0.03, peak: -0.01, contraction: -0.05, trough: 0.0 },
  Industrials: { expansion: 0.04, peak: 0.0, contraction: -0.07, trough: 0.0 },
};

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

/** Advance every instrument by one month. */
export function stepMarket(instruments: Instrument[], econ: EconomyState, month: number, rng: Rng): MarketStepResult {
  const swanProb = econ.regime === 'peak' || econ.regime === 'contraction' ? 0.02 : 0.005;
  const blackSwan = rng.chance(swanProb);

  const mDrift = marketDrift(econ);
  const mVol = Math.max(0.08, econ.volIndex / 100);
  const zMkt = rng.normal();
  const marketLogReturn = (mDrift - 0.5 * mVol * mVol) * DT + mVol * Math.sqrt(DT) * zMkt;

  // First pass: everything except options (options need updated underlyings).
  const updated = instruments.map((inst): Instrument => {
    switch (inst.kind) {
      case 'equity': {
        const tilt = SECTOR_REGIME_TILT[inst.sector][econ.regime];
        const zIdio = rng.normal();
        let logRet =
          inst.beta * marketLogReturn +
          (tilt + inst.drift - 0.04) * DT +
          (inst.vol * Math.sqrt(DT)) * zIdio -
          0.5 * inst.vol * inst.vol * DT;
        if (blackSwan) logRet += Math.log(1 - Math.min(0.7, rng.range(0.15, 0.4) * inst.beta));
        const price = Math.max(0.5, inst.price * Math.exp(logRet));
        return { ...inst, price, priceHistory: [...inst.priceHistory, price].slice(-MAX_HISTORY) };
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
  const { price } = blackScholes(opt.optionType, underlyingPrice, opt.strike, t, r, sigma);
  return { ...opt, price, priceHistory: [...opt.priceHistory, price].slice(-MAX_HISTORY) };
}
