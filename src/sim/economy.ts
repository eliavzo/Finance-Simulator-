/**
 * Macro-economic engine (monthly).
 *
 * Drives a four-phase regime as a stochastic state machine and, from it, a full
 * set of conditions the market reads: GDP, inflation, the policy rate, a
 * sovereign yield curve (which can invert near the cycle top), credit spreads,
 * an implied-vol index and risk sentiment.
 */
import { EconomyState, Regime, YieldCurveKnot } from './types';
import { Loc } from '../i18n/lang';
import { Rng } from '../engine/rng';

const TENORS = [0.25, 1, 2, 5, 10, 30];

export function createEconomy(): EconomyState {
  const policyRate = 0.03;
  return {
    regime: 'expansion',
    monthsInRegime: 0,
    gdpGrowth: 0.03,
    inflation: 0.02,
    policyRate,
    yieldCurve: buildCurve(policyRate, 0.012, 'expansion'),
    igSpread: 0.012,
    hySpread: 0.04,
    volIndex: 15,
    sentiment: 0.4,
    usdIndex: 100,
  };
}

const NEXT: Record<Regime, Regime> = {
  expansion: 'peak',
  peak: 'contraction',
  contraction: 'trough',
  trough: 'expansion',
};

/** Typical regime length in months. */
const DURATION: Record<Regime, number> = {
  expansion: 40,
  peak: 8,
  contraction: 12,
  trough: 8,
};

const TARGET: Record<Regime, { gdp: number; infl: number; policy: number; term: number; ig: number; hy: number; vol: number; sent: number }> = {
  expansion: { gdp: 0.035, infl: 0.022, policy: 0.03, term: 0.014, ig: 0.011, hy: 0.035, vol: 14, sent: 0.5 },
  peak: { gdp: 0.018, infl: 0.04, policy: 0.06, term: -0.004, ig: 0.016, hy: 0.05, vol: 20, sent: 0.1 },
  contraction: { gdp: -0.02, infl: 0.03, policy: 0.045, term: 0.006, ig: 0.03, hy: 0.09, vol: 34, sent: -0.6 },
  trough: { gdp: -0.004, infl: 0.012, policy: 0.012, term: 0.018, ig: 0.022, hy: 0.07, vol: 24, sent: -0.15 },
};

/**
 * Build a yield curve from a short rate, a 10y term premium and a regime-driven
 * slope. Near the peak the curve flattens / inverts.
 */
function buildCurve(shortRate: number, termPremium: number, regime: Regime): YieldCurveKnot[] {
  const slope = regime === 'peak' ? -0.5 : regime === 'contraction' ? 0.3 : 1;
  return TENORS.map((tenor) => {
    const t = Math.log(1 + tenor) / Math.log(1 + 30); // 0..1 across the curve
    const rate = Math.max(0.001, shortRate + termPremium * t * slope);
    return { tenor, rate };
  });
}

export interface EconomyStepResult {
  economy: EconomyState;
  regimeChanged: boolean;
}

/** Advance the economy by one month. */
export function stepEconomy(econ: EconomyState, rng: Rng, volTargetMult = 1): EconomyStepResult {
  const typical = DURATION[econ.regime];
  const hazard = Math.min(0.9, (econ.monthsInRegime / typical) * 0.25);
  let regime = econ.regime;
  let monthsInRegime = econ.monthsInRegime + 1;
  let regimeChanged = false;
  if (econ.monthsInRegime >= 2 && rng.chance(hazard)) {
    regime = NEXT[econ.regime];
    monthsInRegime = 0;
    regimeChanged = true;
  }

  const target = TARGET[regime];
  // Mean-revert toward the regime target with monthly noise (smaller than the
  // old quarterly engine since steps are 3× more frequent).
  const adapt = (cur: number, goal: number, noise: number, speed = 0.15) =>
    cur + (goal - cur) * speed + rng.normal(0, noise);

  const policyRate = Math.max(0, adapt(econ.policyRate, target.policy, 0.0015));
  const termPremium = target.term;

  return {
    economy: {
      regime,
      monthsInRegime,
      gdpGrowth: adapt(econ.gdpGrowth, target.gdp, 0.002),
      inflation: Math.max(-0.01, adapt(econ.inflation, target.infl, 0.0015)),
      policyRate,
      yieldCurve: buildCurve(policyRate, termPremium, regime),
      igSpread: Math.max(0.003, adapt(econ.igSpread, target.ig, 0.0015)),
      hySpread: Math.max(0.015, adapt(econ.hySpread, target.hy, 0.004)),
      volIndex: Math.max(8, adapt(econ.volIndex, target.vol * volTargetMult, 1.2, 0.2)),
      sentiment: Math.max(-1, Math.min(1, adapt(econ.sentiment, target.sent, 0.05))),
      usdIndex: Math.max(60, adapt(econ.usdIndex, 100 + econ.policyRate * 200, 0.8)),
    },
    regimeChanged,
  };
}

export const REGIME_LABEL: Record<Regime, Loc> = {
  expansion: { de: 'Expansion', en: 'Expansion' },
  peak: { de: 'Hochkonjunktur', en: 'Peak' },
  contraction: { de: 'Kontraktion', en: 'Contraction' },
  trough: { de: 'Rezession', en: 'Trough' },
};

export const REGIME_DESC: Record<Regime, Loc> = {
  expansion: {
    de: 'Wachstum, Risikoappetit, steile Zinskurve, günstige Finanzierung.',
    en: 'Growth, risk appetite, a steep yield curve, cheap financing.',
  },
  peak: {
    de: 'Überhitzung: hohe Zinsen, flache/inverse Kurve, Crash-Risiko steigt.',
    en: 'Overheating: high rates, a flat/inverted curve, rising crash risk.',
  },
  contraction: {
    de: 'Abschwung: fallende Märkte, weite Spreads, hohe Vola.',
    en: 'Downturn: falling markets, wide spreads, high volatility.',
  },
  trough: {
    de: 'Bodenbildung: niedrige Zinsen, günstige Einstiege, schwache Stimmung.',
    en: 'Bottoming out: low rates, cheap entries, weak sentiment.',
  },
};
