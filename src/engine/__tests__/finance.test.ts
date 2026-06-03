import {
  irr,
  npv,
  sharpeRatio,
  maxDrawdown,
  valueAtRisk,
  tvpi,
  moic,
  mean,
  stdev,
  normInv,
  CashFlow,
} from '../finance';

describe('npv & irr', () => {
  it('npv discounts future flows', () => {
    const flows: CashFlow[] = [
      { t: 0, amount: -100 },
      { t: 1, amount: 110 },
    ];
    expect(npv(0.1, flows)).toBeCloseTo(0, 6);
    expect(npv(0, flows)).toBeCloseTo(10, 6);
  });

  it('irr recovers a known rate', () => {
    // -100 now, +121 in two years => 10% IRR.
    const flows: CashFlow[] = [
      { t: 0, amount: -100 },
      { t: 2, amount: 121 },
    ];
    expect(irr(flows)).toBeCloseTo(0.1, 4);
  });

  it('irr handles a multi-flow venture stream', () => {
    const flows: CashFlow[] = [
      { t: 0, amount: -1000 },
      { t: 1, amount: -500 },
      { t: 3, amount: 200 },
      { t: 5, amount: 2500 },
    ];
    const r = irr(flows);
    // Sanity: NPV at the solved rate is ~0.
    expect(npv(r, flows)).toBeCloseTo(0, 3);
  });

  it('irr returns NaN with no sign change', () => {
    expect(Number.isNaN(irr([{ t: 0, amount: -1 }, { t: 1, amount: -1 }]))).toBe(true);
  });
});

describe('statistics', () => {
  it('mean and stdev', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });

  it('normInv is the probit function', () => {
    expect(normInv(0.5)).toBeCloseTo(0, 6);
    expect(normInv(0.975)).toBeCloseTo(1.959964, 4);
    expect(normInv(0.95)).toBeCloseTo(1.644854, 4);
  });
});

describe('risk metrics', () => {
  it('sharpe annualises a quarterly series', () => {
    const returns = [0.03, 0.02, 0.04, 0.01, 0.03];
    const s = sharpeRatio(returns, 0.0, 4);
    expect(s).toBeGreaterThan(0);
  });

  it('sharpe is 0 for constant returns (no vol)', () => {
    expect(sharpeRatio([0.02, 0.02, 0.02], 0, 4)).toBe(0);
  });

  it('maxDrawdown finds peak-to-trough', () => {
    expect(maxDrawdown([100, 120, 90, 110, 60, 80])).toBeCloseTo((120 - 60) / 120, 6);
    expect(maxDrawdown([100, 110, 120])).toBe(0);
  });

  it('valueAtRisk is a positive loss figure', () => {
    const returns = [0.05, -0.03, 0.02, -0.04, 0.01, -0.06];
    const v = valueAtRisk(1_000_000, returns, 0.95);
    expect(v).toBeGreaterThan(0);
  });
});

describe('venture multiples', () => {
  it('tvpi combines distributions and residual', () => {
    expect(tvpi(500, 1500, 1000)).toBe(2);
    expect(tvpi(0, 0, 0)).toBe(0);
  });

  it('moic is total value over invested', () => {
    expect(moic(3000, 1000)).toBe(3);
    expect(moic(100, 0)).toBe(0);
  });
});
