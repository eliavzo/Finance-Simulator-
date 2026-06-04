import { equityFairValue, valuationGap, sectorEarningsGrowth } from '../fundamentals';
import { expectedAnnualReturn, createInstruments } from '../market';
import { createEconomy } from '../economy';
import { EquityInstrument } from '../types';

describe('equity fair value', () => {
  it('rises with growth', () => {
    const low = equityFairValue(1, 0.04, 0.04);
    const high = equityFairValue(1, 0.14, 0.04);
    expect(high).toBeGreaterThan(low);
  });

  it('falls when rates rise', () => {
    const cheapRates = equityFairValue(1, 0.1, 0.03);
    const dearRates = equityFairValue(1, 0.1, 0.06);
    expect(dearRates).toBeLessThan(cheapRates);
  });

  it('growth stocks are more rate-sensitive than value stocks', () => {
    const growthDrop = equityFairValue(1, 0.16, 0.03) - equityFairValue(1, 0.16, 0.06);
    const valueDrop = equityFairValue(1, 0.04, 0.03) - equityFairValue(1, 0.04, 0.06);
    expect(growthDrop).toBeGreaterThan(valueDrop);
  });

  it('valuationGap is positive when cheap', () => {
    expect(valuationGap(80, 100)).toBeCloseTo(0.25, 6);
    expect(valuationGap(120, 100)).toBeLessThan(0);
  });
});

describe('expected return tracks valuation', () => {
  const econ = createEconomy();
  const base = createInstruments().find((i) => i.symbol === 'MERC') as EquityInstrument;

  it('undervalued ⇒ positive expected return, overvalued ⇒ negative', () => {
    const cheap = { ...base, price: base.price * 0.7 }; // 30% below where it was (fair)
    const dear = { ...base, price: base.price * 1.4 };
    expect(expectedAnnualReturn(cheap, econ)!).toBeGreaterThan(0);
    expect(expectedAnnualReturn(dear, econ)!).toBeLessThan(0);
  });
});

describe('macro earnings drivers', () => {
  const econ = createEconomy();
  const fin = createInstruments().find((i) => i.symbol === 'MERC') as EquityInstrument;

  it('financials earn more when rates are higher', () => {
    const lowRates = sectorEarningsGrowth(fin, { ...econ, policyRate: 0.02 }, 1);
    const highRates = sectorEarningsGrowth(fin, { ...econ, policyRate: 0.06 }, 1);
    expect(highRates).toBeGreaterThan(lowRates);
  });

  it('energy earnings rise with the oil price', () => {
    const energy = createInstruments().find((i) => i.symbol === 'PETRO') as EquityInstrument;
    expect(sectorEarningsGrowth(energy, econ, 1.4)).toBeGreaterThan(sectorEarningsGrowth(energy, econ, 0.8));
  });
});
