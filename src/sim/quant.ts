/**
 * Quantitative pricing & risk math for the v2 simulation.
 *
 * Pure, side-effect-free and unit-tested. Covers the building blocks the
 * multi-instrument market needs: the normal distribution, Black-Scholes option
 * pricing with Greeks, fixed-income pricing (price/yield/duration) off a yield
 * curve, and a parametric portfolio VaR from a covariance matrix.
 */

/** Standard normal probability density. */
export function normPdf(x: number): number {
  return Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
}

/**
 * Standard normal cumulative distribution via the Abramowitz-Stegun 7.1.26
 * rational approximation (|error| < 7.5e-8).
 */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

export type OptionType = 'call' | 'put';

export interface Greeks {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

/**
 * Black-Scholes-Merton European option price and Greeks.
 *
 * @param type  'call' | 'put'
 * @param S     spot price of the underlying
 * @param K     strike
 * @param t     time to expiry in years (>0)
 * @param r     continuously-compounded annual risk-free rate
 * @param sigma annualised volatility
 * @param q     continuous dividend yield (default 0)
 *
 * Greeks are quoted in conventional units: vega per 1.00 (100%) vol, theta and
 * rho per 1.00 (i.e. per year / per 100% rate) — callers scale as needed.
 */
export function blackScholes(
  type: OptionType,
  S: number,
  K: number,
  t: number,
  r: number,
  sigma: number,
  q = 0,
): Greeks {
  // Guard against degenerate inputs (expired / zero-vol): fall back to
  // discounted intrinsic value with delta of 0/±1.
  if (t <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    const intrinsic = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
    const delta = type === 'call' ? (S > K ? 1 : 0) : S < K ? -1 : 0;
    return { price: intrinsic, delta, gamma: 0, vega: 0, theta: 0, rho: 0 };
  }

  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const discR = Math.exp(-r * t);
  const discQ = Math.exp(-q * t);
  const Nd1 = normCdf(d1);
  const Nd2 = normCdf(d2);
  const nd1 = normPdf(d1);

  if (type === 'call') {
    const price = S * discQ * Nd1 - K * discR * Nd2;
    return {
      price,
      delta: discQ * Nd1,
      gamma: (discQ * nd1) / (S * sigma * sqrtT),
      vega: S * discQ * nd1 * sqrtT,
      theta:
        (-(S * discQ * nd1 * sigma) / (2 * sqrtT) -
          r * K * discR * Nd2 +
          q * S * discQ * Nd1),
      rho: K * t * discR * Nd2,
    };
  }
  const Nnd1 = normCdf(-d1);
  const Nnd2 = normCdf(-d2);
  const price = K * discR * Nnd2 - S * discQ * Nnd1;
  return {
    price,
    delta: -discQ * Nnd1,
    gamma: (discQ * nd1) / (S * sigma * sqrtT),
    vega: S * discQ * nd1 * sqrtT,
    theta:
      (-(S * discQ * nd1 * sigma) / (2 * sqrtT) +
        r * K * discR * Nnd2 -
        q * S * discQ * Nnd1),
    rho: -K * t * discR * Nnd2,
  };
}

/* -------------------------------------------------------------------------- */
/*                               Fixed income                                 */
/* -------------------------------------------------------------------------- */

/**
 * Clean price of a fixed-coupon bond per 100 face, discounting each cash flow
 * at `ytm` (annual, with `freq` coupons per year).
 *
 * @param ytm           annual yield to maturity
 * @param couponRate    annual coupon rate (e.g. 0.05)
 * @param yearsToMat    years to maturity
 * @param freq          coupons per year (default 2)
 * @param face          face value (default 100)
 */
export function bondPrice(
  ytm: number,
  couponRate: number,
  yearsToMat: number,
  freq = 2,
  face = 100,
): number {
  const n = Math.max(1, Math.round(yearsToMat * freq));
  const c = (couponRate * face) / freq;
  const y = ytm / freq;
  let price = 0;
  for (let i = 1; i <= n; i++) {
    price += c / Math.pow(1 + y, i);
  }
  price += face / Math.pow(1 + y, n);
  return price;
}

/**
 * Modified duration (price sensitivity to a 1.00 change in yield), computed by
 * central finite difference on {@link bondPrice}.
 */
export function bondModifiedDuration(
  ytm: number,
  couponRate: number,
  yearsToMat: number,
  freq = 2,
  face = 100,
): number {
  const h = 1e-4;
  const up = bondPrice(ytm + h, couponRate, yearsToMat, freq, face);
  const down = bondPrice(ytm - h, couponRate, yearsToMat, freq, face);
  const base = bondPrice(ytm, couponRate, yearsToMat, freq, face);
  if (base === 0) return 0;
  return -(up - down) / (2 * h) / base;
}

/**
 * Linearly interpolate an annual zero rate off a yield curve given as
 * (tenorYears, rate) knots sorted ascending. Flat extrapolation past the ends.
 */
export function interpolateCurve(curve: { tenor: number; rate: number }[], t: number): number {
  if (curve.length === 0) return 0;
  if (t <= curve[0].tenor) return curve[0].rate;
  const last = curve[curve.length - 1];
  if (t >= last.tenor) return last.rate;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (t <= b.tenor) {
      const w = (t - a.tenor) / (b.tenor - a.tenor);
      return a.rate + w * (b.rate - a.rate);
    }
  }
  return last.rate;
}

/* -------------------------------------------------------------------------- */
/*                                 Risk                                       */
/* -------------------------------------------------------------------------- */

/**
 * Parametric portfolio VaR from per-position dollar exposures and an asset
 * covariance matrix of returns. Returns a positive dollar loss at the given
 * confidence over one period (matching the covariance period).
 *
 * @param exposures  signed dollar exposure per asset (long +, short -)
 * @param cov        N×N covariance matrix of per-period asset returns
 * @param z          z-score for the confidence (e.g. 1.645 for 95%)
 */
export function parametricVaR(exposures: number[], cov: number[][], z: number): number {
  const n = exposures.length;
  if (n === 0) return 0;
  // Portfolio variance = wᵀ Σ w  (w in dollar terms => variance in $²).
  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += exposures[i] * (cov[i]?.[j] ?? 0) * exposures[j];
    }
  }
  if (variance <= 0) return 0;
  return z * Math.sqrt(variance);
}
