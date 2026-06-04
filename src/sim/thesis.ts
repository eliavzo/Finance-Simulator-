/**
 * Fund thesis (investment style) chosen at launch.
 *
 * Each thesis tilts the firm's capabilities, the sharpness of its research and
 * its financing edge — so a Quant shop, a Global-Macro fund and a Credit
 * specialist play quite differently from the same starting capital.
 */
import { FundThesis } from './types';

export interface ThesisProfile {
  label: string;
  blurb: string;
  /** Flat capability add-ons (0-1 scale) from the house style. */
  cap: { research: number; execution: number; risk: number; fundraising: number; capacity: number };
  /** Multiplier on research signal noise (<1 = sharper calls). */
  signalNoiseMult: number;
  /** Annualised financing/borrow discount (cheaper leverage/shorts). */
  financingBonus: number;
}

export const THESES: Record<FundThesis, ThesisProfile> = {
  quant: {
    label: 'Quant',
    blurb: 'Modellgetrieben. Schärfere Signale, starke Research- & Execution-Basis.',
    cap: { research: 0.1, execution: 0.08, risk: 0.04, fundraising: 0, capacity: 1 },
    signalNoiseMult: 0.55,
    financingBonus: 0.001,
  },
  macro: {
    label: 'Global Macro',
    blurb: 'Top-down auf Zinsen, FX & Rohstoffe. Liest Zyklen früh, breite Sicht.',
    cap: { research: 0.06, execution: 0.03, risk: 0.06, fundraising: 0.02, capacity: 1 },
    signalNoiseMult: 0.8,
    financingBonus: 0.001,
  },
  longshort: {
    label: 'Long/Short Equity',
    blurb: 'Aktien-Stockpicking mit Hebel. Günstigere Leihe, mehr Alpha am Buch.',
    cap: { research: 0.07, execution: 0.06, risk: 0.02, fundraising: 0, capacity: 2 },
    signalNoiseMult: 0.7,
    financingBonus: 0.004,
  },
  credit: {
    label: 'Credit',
    blurb: 'Anleihen & Kredit. Sehr günstige Finanzierung, starkes Risikomanagement.',
    cap: { research: 0.05, execution: 0.04, risk: 0.08, fundraising: 0.02, capacity: 1 },
    signalNoiseMult: 0.85,
    financingBonus: 0.005,
  },
  multistrat: {
    label: 'Multi-Strategy',
    blurb: 'Breit aufgestellt. Ausgewogene Boni und mehr Positions-Kapazität.',
    cap: { research: 0.04, execution: 0.04, risk: 0.04, fundraising: 0.03, capacity: 3 },
    signalNoiseMult: 0.85,
    financingBonus: 0.002,
  },
};

export const THESIS_ORDER: FundThesis[] = ['multistrat', 'quant', 'longshort', 'macro', 'credit'];
