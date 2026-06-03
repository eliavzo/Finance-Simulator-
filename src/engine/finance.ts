/**
 * Pure financial math utilities.
 *
 * Everything here is side-effect free and unit tested. Keeping the maths in
 * one place means the engine and the UI compute identical numbers.
 */

/** A dated cash flow. `t` is measured in years from t=0 (can be fractional). */
export interface CashFlow {
  t: number;
  amount: number;
}

/**
 * Net Present Value of a stream of cash flows given an annual discount rate.
 */
export function npv(rate: number, flows: CashFlow[]): number {
  return flows.reduce((acc, { t, amount }) => acc + amount / Math.pow(1 + rate, t), 0);
}

/**
 * Internal Rate of Return solved with a bracketed bisection method.
 *
 * Bisection is slower than Newton-Raphson but cannot diverge, which matters
 * for the messy, sign-changing cash-flow streams a venture fund produces.
 * Returns `NaN` when no sign change exists (e.g. all-negative flows).
 */
export function irr(flows: CashFlow[], guessLow = -0.9999, guessHigh = 10): number {
  if (flows.length < 2) return NaN;

  const fLow = npv(guessLow, flows);
  const fHigh = npv(guessHigh, flows);
  // Need opposite signs to bracket a root.
  if (Number.isNaN(fLow) || Number.isNaN(fHigh) || fLow * fHigh > 0) {
    return NaN;
  }

  let lo = guessLow;
  let hi = guessHigh;
  let mid = 0;
  for (let i = 0; i < 200; i++) {
    mid = (lo + hi) / 2;
    const fMid = npv(mid, flows);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLow * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return mid;
}

/** Arithmetic mean of a sample. */
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Sample standard deviation (n-1 denominator). Returns 0 for <2 samples.
 */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/**
 * Annualised Sharpe ratio computed from a series of *periodic* returns.
 *
 * @param returns        periodic (e.g. quarterly) simple returns
 * @param riskFreeAnnual annualised risk-free rate
 * @param periodsPerYear number of return periods in a year (4 for quarterly)
 */
export function sharpeRatio(
  returns: number[],
  riskFreeAnnual: number,
  periodsPerYear = 4,
): number {
  if (returns.length < 2) return 0;
  const rfPeriodic = riskFreeAnnual / periodsPerYear;
  const excess = returns.map((r) => r - rfPeriodic);
  const sd = stdev(returns);
  if (sd === 0) return 0;
  const periodicSharpe = mean(excess) / sd;
  return periodicSharpe * Math.sqrt(periodsPerYear);
}

/**
 * Maximum drawdown of an equity curve, returned as a positive fraction in
 * [0, 1] (0.30 = peak-to-trough loss of 30%).
 */
export function maxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0;
  let peak = equityCurve[0];
  let maxDd = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

/**
 * Parametric (variance-covariance) one-period Value at Risk.
 *
 * @returns a positive dollar figure representing the loss not expected to be
 *          exceeded with the given confidence over one period.
 */
export function valueAtRisk(
  portfolioValue: number,
  periodicReturns: number[],
  confidence = 0.95,
): number {
  if (periodicReturns.length < 2 || portfolioValue <= 0) return 0;
  const mu = mean(periodicReturns);
  const sigma = stdev(periodicReturns);
  const z = normInv(confidence);
  // Loss quantile: value * (mean - z*sigma). Clamp at 0 (no negative VaR).
  const worstReturn = mu - z * sigma;
  return Math.max(0, -worstReturn * portfolioValue);
}

/**
 * Total Value to Paid-In: (distributions + residual value) / paid-in capital.
 */
export function tvpi(distributions: number, residualValue: number, paidIn: number): number {
  if (paidIn <= 0) return 0;
  return (distributions + residualValue) / paidIn;
}

/**
 * Multiple on Invested Capital. Functionally the same ratio as TVPI for this
 * sim, exposed separately because players reason about them differently
 * (MOIC is typically quoted gross / per-deal).
 */
export function moic(totalValue: number, invested: number): number {
  if (invested <= 0) return 0;
  return totalValue / invested;
}

/**
 * Inverse standard-normal CDF (probit) via the Acklam rational approximation.
 * Accurate to ~1e-9 over (0,1) — plenty for VaR z-scores.
 */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}
