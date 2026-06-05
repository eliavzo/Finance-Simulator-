/**
 * Private-equity / buyout pillar: acquire whole companies with leverage,
 * improve them operationally, and exit for a profit.
 *
 * Value is created through the classic PE "bridge": EBITDA growth (revenue ×
 * margin), multiple expansion (quality + a friendly market) and de-leveraging
 * (free cash flow and pay-downs lift equity value). Too much debt in a downturn
 * leads to distress and a wipe-out.
 */
import { BuyoutTarget, EconomyState, PortfolioCompany, Regime, Sector } from './types';
import { Rng } from '../engine/rng';

const FIRST = ['Atlas', 'Granite', 'Summit', 'Harbor', 'Vantage', 'Crown', 'Pioneer', 'Beacon', 'Cardinal', 'Magnolia', 'Titan', 'Apex', 'Sterling', 'Cobalt', 'Verde'];
const LAST = ['Industries', 'Logistics', 'Foods', 'Health', 'Components', 'Systems', 'Packaging', 'Services', 'Materials', 'Retail', 'Devices', 'Brands'];
const SECTORS: Sector[] = ['Tech', 'Healthcare', 'Consumer', 'Industrials', 'Energy', 'Financials'];

let nameCtr = 0;
function makeName(rng: Rng): string {
  nameCtr += 1;
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}

/** Base EV/EBITDA multiple by sector. */
const SECTOR_MULTIPLE: Record<Sector, number> = {
  Tech: 12,
  Healthcare: 11,
  Consumer: 9,
  Industrials: 8.5,
  Financials: 8,
  Energy: 7,
};

const REGIME_MULT: Record<Regime, number> = {
  expansion: 1.1,
  peak: 1.05,
  contraction: 0.78,
  trough: 0.85,
};

/** LBO debt interest rate. */
export function debtRate(econ: EconomyState): number {
  return econ.policyRate + 0.04;
}

export function ebitdaOf(c: PortfolioCompany | BuyoutTarget): number {
  return c.revenue * c.ebitdaMargin;
}

/** Current EV/EBITDA exit multiple given quality & macro. */
export function exitMultiple(sector: Sector, quality: number, econ: EconomyState): number {
  const base = SECTOR_MULTIPLE[sector];
  const qualityMult = 0.85 + 0.3 * quality;
  const m = base * REGIME_MULT[econ.regime] * qualityMult * (1 + econ.sentiment * 0.05);
  return Math.max(4, Math.min(18, m));
}

export function enterpriseValue(c: PortfolioCompany, econ: EconomyState): number {
  return ebitdaOf(c) * exitMultiple(c.sector, c.quality, econ);
}

export function equityValue(c: PortfolioCompany, econ: EconomyState): number {
  return Math.max(0, enterpriseValue(c, econ) - c.debt);
}

export function createBuyouts(): { targets: BuyoutTarget[]; companies: PortfolioCompany[] } {
  return { targets: [], companies: [] };
}

/** Generate a fresh acquisition target. `small` keeps it affordable early. */
export function generateTarget(rng: Rng, econ: EconomyState, small = false): BuyoutTarget {
  nameCtr += 1;
  const sector = rng.pick(SECTORS);
  // Small targets are affordable from the start; larger ones are aspirational.
  const revenue = small ? rng.range(6_000_000, 22_000_000) : 20_000_000 + Math.pow(rng.next(), 2) * 130_000_000;
  const ebitdaMargin = rng.range(0.1, 0.28);
  const growthRate = rng.range(-0.02, 0.14);
  const quality = rng.range(0.3, 0.8);
  // Asking multiple ≈ fair exit multiple ± a bit (you can over- or underpay).
  const askingMultiple = exitMultiple(sector, quality, econ) * rng.range(0.85, 1.12);
  return {
    id: `tgt-${nameCtr}-${rng.int(0, 9999)}`,
    name: makeName(rng),
    sector,
    revenue,
    ebitdaMargin,
    growthRate,
    quality,
    askingMultiple,
  };
}

export function refreshTargets(rng: Rng, econ: EconomyState, reputation: number): BuyoutTarget[] {
  const count = rng.int(2, reputation > 60 ? 4 : 3);
  // Always include at least one small, affordable target.
  const list = [generateTarget(rng, econ, true)];
  for (let i = 1; i < count; i++) list.push(generateTarget(rng, econ, false));
  return list;
}

export interface BuyResult {
  ok: boolean;
  error?: string;
  company?: PortfolioCompany;
  equity?: number;
}

/**
 * Buy a target with a chosen leverage fraction (0–0.7 of EV as debt). Returns
 * the new company and the equity cash required.
 */
export function buyCompany(target: BuyoutTarget, leverageFrac: number, month: number): BuyResult {
  const ev = ebitdaOf(target) * target.askingMultiple;
  const lev = Math.max(0, Math.min(0.7, leverageFrac));
  const debt = ev * lev;
  const equity = ev - debt;
  const company: PortfolioCompany = {
    id: `co-${month}-${nameCtr++}`,
    name: target.name,
    sector: target.sector,
    revenue: target.revenue,
    ebitdaMargin: target.ebitdaMargin,
    growthRate: target.growthRate,
    quality: target.quality,
    entryMultiple: target.askingMultiple,
    debt,
    equityInvested: equity,
    acquiredMonth: month,
    distressMonths: 0,
  };
  return { ok: true, company, equity };
}

export interface CompanyStep {
  company: PortfolioCompany | null; // null = defaulted (removed)
  defaulted: boolean;
}

/** Advance one company by a month: organic growth, debt service, distress. */
export function stepCompany(c: PortfolioCompany, econ: EconomyState, rng: Rng): CompanyStep {
  const macro = (econ.gdpGrowth - 0.02) * 0.4 + econ.sentiment * 0.01;
  const revenue = Math.max(1_000_000, c.revenue * (1 + c.growthRate / 12 + macro / 12 + rng.normal(0, 0.01)));
  // Margins & quality drift gently.
  const ebitdaMargin = Math.max(0.03, Math.min(0.5, c.ebitdaMargin + rng.normal(0, 0.003)));
  const quality = Math.max(0, Math.min(1, c.quality + rng.normal(0, 0.01)));

  const ebitda = revenue * ebitdaMargin;
  const interest = c.debt * debtRate(econ);
  // Free cash flow services debt; surplus de-levers automatically.
  const fcf = ebitda * 0.6 - interest;
  let debt = c.debt;
  if (fcf > 0) debt = Math.max(0, debt - fcf / 12);
  else debt = debt - fcf / 12; // negative fcf adds to debt

  // Distress builds while free cash flow can't cover debt service.
  let distressMonths = c.distressMonths;
  if (fcf < 0) distressMonths += 1;
  else distressMonths = Math.max(0, distressMonths - 1);

  const updated: PortfolioCompany = { ...c, revenue, ebitdaMargin, quality, debt };

  // Default: prolonged distress or debt far above enterprise value.
  const ev = enterpriseValue(updated, econ);
  if (distressMonths >= 6 || debt > ev * 1.25) {
    return { company: null, defaulted: true };
  }
  return { company: { ...updated, distressMonths }, defaulted: false };
}

/* ----------------------------- Operational levers ------------------------ */

export interface ActionResult {
  ok: boolean;
  error?: string;
  company?: PortfolioCompany;
  cost?: number;
  addedDebt?: number;
}

/** One-off restructuring: raise margin, slightly slow growth. */
export function cutCosts(c: PortfolioCompany): ActionResult {
  const cost = c.revenue * 0.12;
  if (c.ebitdaMargin >= 0.45) return { ok: false, error: 'Marge bereits am Maximum.' };
  return {
    ok: true,
    cost,
    company: { ...c, ebitdaMargin: Math.min(0.45, c.ebitdaMargin + 0.04), growthRate: Math.max(-0.05, c.growthRate - 0.01), equityInvested: c.equityInvested + cost },
  };
}

/** Invest in growth: raise the growth rate. */
export function investGrowth(c: PortfolioCompany): ActionResult {
  const cost = c.revenue * 0.18;
  if (c.growthRate >= 0.3) return { ok: false, error: 'Wachstum bereits am Maximum.' };
  return {
    ok: true,
    cost,
    company: { ...c, growthRate: Math.min(0.3, c.growthRate + 0.04), quality: Math.min(1, c.quality + 0.02), equityInvested: c.equityInvested + cost },
  };
}

/** Bolt-on acquisition: grow revenue ~30% (cash-funded). */
export function addOn(c: PortfolioCompany): ActionResult {
  const cost = c.revenue * 0.4;
  return {
    ok: true,
    cost,
    company: { ...c, revenue: c.revenue * 1.3, quality: Math.min(1, c.quality + 0.03), equityInvested: c.equityInvested + cost },
  };
}

/** Pay down LBO debt with fund cash. */
export function payDownDebt(c: PortfolioCompany, amount: number): ActionResult {
  if (amount <= 0) return { ok: false, error: 'Betrag muss positiv sein.' };
  const pay = Math.min(amount, c.debt);
  if (pay <= 0) return { ok: false, error: 'Keine Schulden vorhanden.' };
  return { ok: true, cost: pay, company: { ...c, debt: c.debt - pay, equityInvested: c.equityInvested + pay } };
}

/** Exit proceeds (equity value, small friction; IPO premium in good markets). */
export function exitProceeds(c: PortfolioCompany, econ: EconomyState): number {
  const eq = equityValue(c, econ);
  const ipoBonus = econ.regime === 'expansion' || econ.regime === 'peak' ? 1.05 : 0.98;
  return eq * ipoBonus;
}

/** MOIC of a still-held company (equity value / total equity invested). */
export function companyMoic(c: PortfolioCompany, econ: EconomyState): number {
  return c.equityInvested > 0 ? equityValue(c, econ) / c.equityInvested : 0;
}
