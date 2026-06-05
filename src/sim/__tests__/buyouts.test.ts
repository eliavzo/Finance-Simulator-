import {
  ebitdaOf,
  exitMultiple,
  buyCompany,
  cutCosts,
  payDownDebt,
  stepCompany,
  equityValue,
  enterpriseValue,
} from '../buyouts';
import { createEconomy } from '../economy';
import { createSimGame, advanceMonth, buyoutEquityValue } from '../engine';
import { BuyoutTarget, PortfolioCompany, SimState } from '../types';

const target = (over: Partial<BuyoutTarget> = {}): BuyoutTarget => ({
  id: 't', name: 'Co', sector: 'Industrials', revenue: 50_000_000, ebitdaMargin: 0.2, growthRate: 0.05, quality: 0.6, askingMultiple: 8, ...over,
});

describe('buyout valuation', () => {
  it('ebitda = revenue × margin', () => {
    expect(ebitdaOf(target())).toBeCloseTo(10_000_000, 0);
  });

  it('exit multiples are higher in expansion than contraction', () => {
    const econ = createEconomy();
    const up = exitMultiple('Tech', 0.7, { ...econ, regime: 'expansion' });
    const down = exitMultiple('Tech', 0.7, { ...econ, regime: 'contraction' });
    expect(up).toBeGreaterThan(down);
  });
});

describe('buying with leverage', () => {
  it('splits enterprise value into debt and equity', () => {
    const res = buyCompany(target(), 0.6, 0);
    const ev = 10_000_000 * 8;
    expect(res.company!.debt).toBeCloseTo(ev * 0.6, 0);
    expect(res.equity).toBeCloseTo(ev * 0.4, 0);
  });

  it('caps leverage at 70%', () => {
    const res = buyCompany(target(), 0.95, 0);
    const ev = 10_000_000 * 8;
    expect(res.company!.debt).toBeCloseTo(ev * 0.7, 0);
  });
});

describe('operational levers', () => {
  const c = buyCompany(target(), 0.5, 0).company!;
  it('cost cutting raises margin and counts as invested capital', () => {
    const r = cutCosts(c);
    expect(r.company!.ebitdaMargin).toBeGreaterThan(c.ebitdaMargin);
    expect(r.company!.equityInvested).toBeGreaterThan(c.equityInvested);
    expect(r.cost!).toBeGreaterThan(0);
  });
  it('debt paydown reduces debt', () => {
    const r = payDownDebt(c, 5_000_000);
    expect(r.company!.debt).toBeCloseTo(c.debt - 5_000_000, 0);
  });
});

describe('company evolution & distress', () => {
  const econ = createEconomy();
  it('a sound, low-debt company keeps positive equity', () => {
    let c: PortfolioCompany | null = buyCompany(target({ growthRate: 0.08 }), 0.2, 0).company!;
    for (let i = 0; i < 24 && c; i++) c = stepCompany(c, econ, new (require('../../engine/rng').Rng)(i)).company;
    expect(c).not.toBeNull();
    expect(equityValue(c!, econ)).toBeGreaterThan(0);
  });

  it('an over-levered company in a downturn can default', () => {
    const { Rng } = require('../../engine/rng');
    const bad = { ...econ, regime: 'contraction' as const, gdpGrowth: -0.03, policyRate: 0.07 };
    // Heavy debt, weak margin/growth.
    let c: PortfolioCompany | null = buyCompany(target({ ebitdaMargin: 0.08, growthRate: -0.05 }), 0.7, 0).company!;
    let defaulted = false;
    for (let i = 0; i < 36 && c; i++) {
      const r = stepCompany(c, bad, new Rng(i + 100));
      if (r.defaulted) { defaulted = true; break; }
      c = r.company;
    }
    expect(defaulted).toBe(true);
  });

  it('equity value equals enterprise value minus debt', () => {
    const c = buyCompany(target(), 0.5, 0).company!;
    expect(equityValue(c, econ)).toBeCloseTo(Math.max(0, enterpriseValue(c, econ) - c.debt), 0);
  });
});

describe('engine integration', () => {
  it('seeds targets including an affordable one, and owned companies count in enterprise', () => {
    const g = createSimGame(5);
    expect(g.buyouts.targets.length).toBeGreaterThan(0);
    expect(g.buyouts.companies).toEqual([]);
    const co = buyCompany(target({ growthRate: 0.06 }), 0.4, 0).company!;
    const withCo: SimState = { ...g, buyouts: { targets: [], companies: [co] } };
    expect(buyoutEquityValue(withCo)).toBeGreaterThan(0);
    const next = advanceMonth(withCo);
    // company evolved (revenue changed) and the book is carried forward.
    expect(next.buyouts.companies.length).toBe(1);
    expect(next.buyouts.companies[0].revenue).not.toBe(co.revenue);
  });
});
