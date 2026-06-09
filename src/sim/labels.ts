/**
 * Bilingual labels for the data-model enums (sectors, roles, LP types, ratings,
 * instrument kinds, funding stages). Resolve with `tr(lang, …)` in screens or
 * `g(…)` in engine code.
 */
import { Loc } from '../i18n/lang';
import { CreditRating, FundingStage, InstrumentKind, LPType, Role, Sector } from './types';

export const SECTOR_LABEL: Record<Sector | 'Government', Loc> = {
  Tech: { de: 'Technologie', en: 'Tech' },
  Financials: { de: 'Finanzwerte', en: 'Financials' },
  Energy: { de: 'Energie', en: 'Energy' },
  Healthcare: { de: 'Gesundheit', en: 'Healthcare' },
  Consumer: { de: 'Konsum', en: 'Consumer' },
  Industrials: { de: 'Industrie', en: 'Industrials' },
  Government: { de: 'Staat', en: 'Government' },
};

export const ROLE_LABEL: Record<Role, Loc> = {
  Analyst: { de: 'Analyst', en: 'Analyst' },
  Trader: { de: 'Trader', en: 'Trader' },
  PortfolioManager: { de: 'Portfoliomanager', en: 'Portfolio Manager' },
  Quant: { de: 'Quant', en: 'Quant' },
  RiskManager: { de: 'Risikomanager', en: 'Risk Manager' },
  InvestorRelations: { de: 'Investor Relations', en: 'Investor Relations' },
  COO: { de: 'COO', en: 'COO' },
};

export const LP_TYPE_LABEL: Record<LPType, Loc> = {
  Pension: { de: 'Pensionskasse', en: 'Pension' },
  Endowment: { de: 'Stiftungsfonds', en: 'Endowment' },
  FamilyOffice: { de: 'Family Office', en: 'Family Office' },
  SovereignWealth: { de: 'Staatsfonds', en: 'Sovereign Wealth' },
  FundOfFunds: { de: 'Dachfonds', en: 'Fund of Funds' },
};

export const KIND_LABEL: Record<InstrumentKind, Loc> = {
  equity: { de: 'Aktie', en: 'Equity' },
  bond: { de: 'Anleihe', en: 'Bond' },
  fx: { de: 'Devisen', en: 'FX' },
  commodity: { de: 'Rohstoff', en: 'Commodity' },
  option: { de: 'Option', en: 'Option' },
};

export const KIND_LABEL_PLURAL: Record<InstrumentKind, Loc> = {
  equity: { de: 'Aktien', en: 'Equities' },
  bond: { de: 'Anleihen', en: 'Bonds' },
  fx: { de: 'Devisen', en: 'FX' },
  commodity: { de: 'Rohstoffe', en: 'Commodities' },
  option: { de: 'Optionen', en: 'Options' },
};

export const RATING_LABEL: Record<CreditRating, Loc> = {
  AAA: { de: 'AAA', en: 'AAA' },
  AA: { de: 'AA', en: 'AA' },
  A: { de: 'A', en: 'A' },
  BBB: { de: 'BBB', en: 'BBB' },
  BB: { de: 'BB', en: 'BB' },
  B: { de: 'B', en: 'B' },
};

export const STAGE_LABEL: Record<FundingStage, Loc> = {
  Seed: { de: 'Seed', en: 'Seed' },
  'Series A': { de: 'Serie A', en: 'Series A' },
  'Series B': { de: 'Serie B', en: 'Series B' },
  'Series C': { de: 'Serie C', en: 'Series C' },
  'Pre-IPO': { de: 'Pre-IPO', en: 'Pre-IPO' },
};
