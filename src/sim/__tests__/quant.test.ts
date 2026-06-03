import {
  normCdf,
  blackScholes,
  bondPrice,
  bondModifiedDuration,
  interpolateCurve,
  parametricVaR,
} from '../quant';

describe('normCdf', () => {
  it('matches known values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.645)).toBeCloseTo(0.95, 3);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 3);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
  });
});

describe('blackScholes', () => {
  // Classic textbook case: S=100,K=100,t=1,r=5%,sigma=20% -> call ~10.4506.
  it('prices an ATM call correctly', () => {
    const c = blackScholes('call', 100, 100, 1, 0.05, 0.2);
    expect(c.price).toBeCloseTo(10.4506, 3);
    expect(c.delta).toBeGreaterThan(0.5);
    expect(c.delta).toBeLessThan(0.7);
  });

  it('prices the put consistently via put-call parity', () => {
    const S = 100;
    const K = 100;
    const t = 1;
    const r = 0.05;
    const call = blackScholes('call', S, K, t, r, 0.2).price;
    const put = blackScholes('put', S, K, t, r, 0.2).price;
    // C - P = S - K e^{-rt}
    expect(call - put).toBeCloseTo(S - K * Math.exp(-r * t), 4);
  });

  it('put delta is negative and gamma/vega positive', () => {
    const p = blackScholes('put', 100, 100, 1, 0.05, 0.2);
    expect(p.delta).toBeLessThan(0);
    expect(p.gamma).toBeGreaterThan(0);
    expect(p.vega).toBeGreaterThan(0);
  });

  it('handles expiry with intrinsic value', () => {
    expect(blackScholes('call', 120, 100, 0, 0.05, 0.2).price).toBe(20);
    expect(blackScholes('put', 80, 100, 0, 0.05, 0.2).price).toBe(20);
  });
});

describe('bond pricing', () => {
  it('prices at par when coupon equals yield', () => {
    expect(bondPrice(0.05, 0.05, 10, 2, 100)).toBeCloseTo(100, 4);
  });

  it('is below par when yield exceeds coupon (discount)', () => {
    expect(bondPrice(0.07, 0.05, 10, 2, 100)).toBeLessThan(100);
  });

  it('is above par when yield is below coupon (premium)', () => {
    expect(bondPrice(0.03, 0.05, 10, 2, 100)).toBeGreaterThan(100);
  });

  it('modified duration is positive and longer maturities are more sensitive', () => {
    const d5 = bondModifiedDuration(0.05, 0.05, 5);
    const d20 = bondModifiedDuration(0.05, 0.05, 20);
    expect(d5).toBeGreaterThan(0);
    expect(d20).toBeGreaterThan(d5);
  });
});

describe('interpolateCurve', () => {
  const curve = [
    { tenor: 0.25, rate: 0.02 },
    { tenor: 2, rate: 0.03 },
    { tenor: 10, rate: 0.04 },
  ];
  it('interpolates between knots', () => {
    expect(interpolateCurve(curve, 6)).toBeCloseTo(0.03 + (0.04 - 0.03) * (6 - 2) / (10 - 2), 6);
  });
  it('flat-extrapolates beyond the ends', () => {
    expect(interpolateCurve(curve, 0.1)).toBe(0.02);
    expect(interpolateCurve(curve, 30)).toBe(0.04);
  });
});

describe('parametricVaR', () => {
  it('aggregates a diagonal covariance like the single-asset formula', () => {
    // Two uncorrelated assets, each $1M, vol 10% per period.
    const exposures = [1_000_000, 1_000_000];
    const cov = [
      [0.01, 0],
      [0, 0.01],
    ];
    const z = 1.645;
    const expected = z * Math.sqrt(1_000_000 ** 2 * 0.01 + 1_000_000 ** 2 * 0.01);
    expect(parametricVaR(exposures, cov, z)).toBeCloseTo(expected, 0);
  });

  it('a long/short hedge reduces VaR when correlated', () => {
    const cov = [
      [0.04, 0.038],
      [0.038, 0.04],
    ];
    const hedged = parametricVaR([1_000_000, -1_000_000], cov, 1.645);
    const naked = parametricVaR([1_000_000, 0], cov, 1.645);
    expect(hedged).toBeLessThan(naked);
  });
});
