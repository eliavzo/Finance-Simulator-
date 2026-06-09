/**
 * Fund thesis (investment style) chosen at launch.
 *
 * Each thesis tilts the firm's capabilities, the sharpness of its research and
 * its financing edge — so a Quant shop, a Global-Macro fund and a Credit
 * specialist play quite differently from the same starting capital.
 */
import { FundThesis } from './types';
import { Loc } from '../i18n/lang';

export interface ThesisProfile {
  label: Loc;
  blurb: Loc;
  /** Flat capability add-ons (0-1 scale) from the house style. */
  cap: { research: number; execution: number; risk: number; fundraising: number; capacity: number };
  /** Multiplier on research signal noise (<1 = sharper calls). */
  signalNoiseMult: number;
  /** Annualised financing/borrow discount (cheaper leverage/shorts). */
  financingBonus: number;
}

export const THESES: Record<FundThesis, ThesisProfile> = {
  quant: {
    label: { de: 'Quant', en: 'Quant' },
    blurb: {
      de: 'Modellgetrieben. Schärfere Signale, starke Research- & Execution-Basis.',
      en: 'Model-driven. Sharper signals, a strong research & execution base.',
    },
    cap: { research: 0.1, execution: 0.08, risk: 0.04, fundraising: 0, capacity: 1 },
    signalNoiseMult: 0.55,
    financingBonus: 0.001,
  },
  macro: {
    label: { de: 'Global Macro', en: 'Global Macro' },
    blurb: {
      de: 'Top-down auf Zinsen, FX & Rohstoffe. Liest Zyklen früh, breite Sicht.',
      en: 'Top-down on rates, FX & commodities. Reads cycles early, broad view.',
    },
    cap: { research: 0.06, execution: 0.03, risk: 0.06, fundraising: 0.02, capacity: 1 },
    signalNoiseMult: 0.8,
    financingBonus: 0.001,
  },
  longshort: {
    label: { de: 'Long/Short Equity', en: 'Long/Short Equity' },
    blurb: {
      de: 'Aktien-Stockpicking mit Hebel. Günstigere Leihe, mehr Alpha am Buch.',
      en: 'Equity stock-picking with leverage. Cheaper borrow, more alpha on the book.',
    },
    cap: { research: 0.07, execution: 0.06, risk: 0.02, fundraising: 0, capacity: 2 },
    signalNoiseMult: 0.7,
    financingBonus: 0.004,
  },
  credit: {
    label: { de: 'Credit', en: 'Credit' },
    blurb: {
      de: 'Anleihen & Kredit. Sehr günstige Finanzierung, starkes Risikomanagement.',
      en: 'Bonds & credit. Very cheap financing, strong risk management.',
    },
    cap: { research: 0.05, execution: 0.04, risk: 0.08, fundraising: 0.02, capacity: 1 },
    signalNoiseMult: 0.85,
    financingBonus: 0.005,
  },
  multistrat: {
    label: { de: 'Multi-Strategy', en: 'Multi-Strategy' },
    blurb: {
      de: 'Breit aufgestellt. Ausgewogene Boni und mehr Positions-Kapazität.',
      en: 'Broadly diversified. Balanced bonuses and more position capacity.',
    },
    cap: { research: 0.04, execution: 0.04, risk: 0.04, fundraising: 0.03, capacity: 3 },
    signalNoiseMult: 0.85,
    financingBonus: 0.002,
  },
};

export const THESIS_ORDER: FundThesis[] = ['multistrat', 'quant', 'longshort', 'macro', 'credit'];
