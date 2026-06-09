/**
 * Starting scenarios — the macro backdrop the game opens in.
 *
 * Each scenario sets the initial economy (and, for a couple, tilts starting
 * prices) so a run that begins in a boom feels very different from one that
 * opens on the eve of a crisis or in a tech mania.
 */
import { EconomyState, Instrument, Scenario, YieldCurveKnot } from './types';
import { Loc } from '../i18n/lang';

export interface ScenarioProfile {
  label: Loc;
  blurb: Loc;
}

export const SCENARIOS: Record<Scenario, ScenarioProfile> = {
  normal: {
    label: { de: 'Normaler Start', en: 'Normal Start' },
    blurb: { de: 'Ausgewogene Expansion. Der klassische Einstieg.', en: 'A balanced expansion. The classic opening.' },
  },
  boom: {
    label: { de: 'Hausse', en: 'Boom' },
    blurb: { de: 'Euphorie: niedrige Zinsen, hohe Stimmung — aber alles ist teuer.', en: 'Euphoria: low rates, high sentiment — but everything is expensive.' },
  },
  precrisis: {
    label: { de: 'Am Vorabend der Krise', en: 'On the Eve of Crisis' },
    blurb: { de: 'Überhitzung: hohe Zinsen, inverse Kurve, Crash-Gefahr.', en: 'Overheating: high rates, an inverted curve, crash risk.' },
  },
  dotcom: {
    label: { de: 'Tech-Manie', en: 'Tech Mania' },
    blurb: { de: 'Tech-Aktien sind heiß gelaufen. Reitest du die Blase — oder shortest du sie?', en: 'Tech stocks have run hot. Do you ride the bubble — or short it?' },
  },
  stagflation: {
    label: { de: 'Stagflation', en: 'Stagflation' },
    blurb: { de: 'Hohe Inflation, schwaches Wachstum, Rohstoffe im Aufwind.', en: 'High inflation, weak growth, commodities on the rise.' },
  },
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
        // Prices detached from fundamentals — overvalued and primed to revert.
        const price = i.price * 1.9;
        return { ...i, price, priceHistory: [price], epsGrowth: i.epsGrowth + 0.04, vol: i.vol + 0.1 };
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
