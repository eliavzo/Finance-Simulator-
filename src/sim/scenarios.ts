/**
 * Starting scenarios — the macro backdrop the game opens in.
 *
 * Each scenario sets the initial economy (and, for a couple, tilts starting
 * prices) so a run that begins in a boom feels very different from one that
 * opens on the eve of a crisis or in a tech mania.
 */
import { EconomyState, Instrument, Scenario, YieldCurveKnot } from './types';

export interface ScenarioProfile {
  label: string;
  blurb: string;
}

export const SCENARIOS: Record<Scenario, ScenarioProfile> = {
  normal: { label: 'Normaler Start', blurb: 'Ausgewogene Expansion. Der klassische Einstieg.' },
  boom: { label: 'Hausse', blurb: 'Euphorie: niedrige Zinsen, hohe Stimmung — aber alles ist teuer.' },
  precrisis: { label: 'Am Vorabend der Krise', blurb: 'Überhitzung: hohe Zinsen, inverse Kurve, Crash-Gefahr.' },
  dotcom: { label: 'Tech-Manie', blurb: 'Tech-Aktien sind heiß gelaufen. Reitest du die Blase — oder shortest du sie?' },
  stagflation: { label: 'Stagflation', blurb: 'Hohe Inflation, schwaches Wachstum, Rohstoffe im Aufwind.' },
};

export const SCENARIO_ORDER: Scenario[] = ['normal', 'boom', 'precrisis', 'dotcom', 'stagflation'];

const TENORS = [0.25, 1, 2, 5, 10, 30];

function buildCurve(shortRate: number, termPremium: number, slope: number): YieldCurveKnot[] {
  return TENORS.map((tenor) => {
    const t = Math.log(1 + tenor) / Math.log(1 + 30);
    return { tenor, rate: Math.max(0.001, shortRate + termPremium * t * slope) };
  });
}

/** Build the opening economy for a scenario. */
export function scenarioEconomy(scenario: Scenario): EconomyState {
  const base: EconomyState = {
    regime: 'expansion',
    monthsInRegime: 0,
    gdpGrowth: 0.03,
    inflation: 0.02,
    policyRate: 0.03,
    yieldCurve: buildCurve(0.03, 0.014, 1),
    igSpread: 0.012,
    hySpread: 0.04,
    volIndex: 15,
    sentiment: 0.4,
    usdIndex: 100,
  };

  switch (scenario) {
    case 'boom':
      return { ...base, gdpGrowth: 0.045, inflation: 0.018, policyRate: 0.02, yieldCurve: buildCurve(0.02, 0.016, 1), volIndex: 11, sentiment: 0.75 };
    case 'precrisis':
      return { ...base, regime: 'peak', monthsInRegime: 3, gdpGrowth: 0.02, inflation: 0.045, policyRate: 0.06, yieldCurve: buildCurve(0.06, 0.012, -0.5), igSpread: 0.016, hySpread: 0.05, volIndex: 22, sentiment: 0.1 };
    case 'dotcom':
      return { ...base, gdpGrowth: 0.04, inflation: 0.02, policyRate: 0.035, yieldCurve: buildCurve(0.035, 0.014, 1), volIndex: 20, sentiment: 0.65 };
    case 'stagflation':
      return { ...base, regime: 'contraction', monthsInRegime: 2, gdpGrowth: -0.01, inflation: 0.06, policyRate: 0.05, yieldCurve: buildCurve(0.05, 0.01, 0.4), igSpread: 0.02, hySpread: 0.07, volIndex: 28, sentiment: -0.4 };
    default:
      return base;
  }
}

/** Optionally tilt opening prices/parameters for flavourful scenarios. */
export function applyScenarioToInstruments(scenario: Scenario, instruments: Instrument[]): Instrument[] {
  if (scenario === 'dotcom') {
    return instruments.map((i) => {
      if (i.kind === 'equity' && i.sector === 'Tech') {
        const price = i.price * 1.9;
        return { ...i, price, priceHistory: [price], drift: i.drift + 0.06, vol: i.vol + 0.12 };
      }
      return i;
    });
  }
  if (scenario === 'stagflation') {
    return instruments.map((i) => {
      if (i.kind === 'commodity') {
        const price = i.price * 1.3;
        return { ...i, price, priceHistory: [price] };
      }
      return i;
    });
  }
  return instruments;
}
