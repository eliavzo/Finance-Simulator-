import {
  createVC,
  generateDeal,
  refreshDeals,
  investInDeal,
  stepStartup,
  followOn,
  supportStartup,
  vcMetrics,
  holdingValue,
} from '../vc';
import { createEconomy } from '../economy';
import { createSimGame, advanceMonth } from '../engine';
import { Startup, VCState } from '../types';
import { Rng } from '../../engine/rng';

const econ = createEconomy();

describe('venture deals & investing', () => {
  it('generates deals', () => {
    expect(refreshDeals(new Rng(1), 50).length).toBeGreaterThan(0);
  });

  it('deal sizes scale up with fund scale', () => {
    const avg = (scale: number) => {
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        const d = generateDeal(new Rng(i + scale * 1000), 50, scale);
        sum += d.preMoney + d.roundSize;
      }
      return sum / 200;
    };
    expect(avg(10)).toBeGreaterThan(avg(1) * 3);
  });

  it('a larger fund sees more later-stage deals', () => {
    const lateFrac = (scale: number) => {
      let late = 0;
      for (let i = 0; i < 300; i++) {
        const d = generateDeal(new Rng(i + scale * 777), 50, scale);
        if (d.stage === 'Series B' || d.stage === 'Series C' || d.stage === 'Pre-IPO') late++;
      }
      return late / 300;
    };
    expect(lateFrac(10)).toBeGreaterThan(lateFrac(1));
  });

  it('ownership = cheque / post-money', () => {
    let vc = createVC();
    vc = { ...vc, deals: [generateDeal(new Rng(3), 50)] };
    const deal = vc.deals[0];
    const res = investInDeal(vc, deal.id, deal.roundSize, 0);
    expect(res.ok).toBe(true);
    const su = res.vc!.portfolio[0];
    expect(su.ownership).toBeCloseTo(deal.roundSize / (deal.preMoney + deal.roundSize), 6);
    expect(res.vc!.totalInvested).toBe(deal.roundSize);
  });

  it('rejects investing more than the round', () => {
    let vc = createVC();
    vc = { ...vc, deals: [generateDeal(new Rng(4), 50)] };
    const d = vc.deals[0];
    expect(investInDeal(vc, d.id, d.roundSize * 2, 0).ok).toBe(false);
  });
});

describe('startup evolution', () => {
  const seed = (over: Partial<Startup> = {}): Startup => ({
    id: 's', name: 'Co', sector: 'Tech', stage: 'Seed', status: 'active',
    revenue: 1_000_000, growthRate: 0.3, burnRate: 200_000, runwayCash: 2_000_000,
    postMoney: 10_000_000, ownership: 0.1, totalInvested: 1_000_000, support: 0,
    health: 0.7, foundedMonth: 0, ...over,
  });

  it('raises a new round when runway is low and health is fine', () => {
    const low = seed({ runwayCash: 100_000, health: 0.7 });
    // Try several seeds; a raise (or exit/fail) should occur — at minimum the
    // low-runway healthy startup tends to raise.
    let raised = false;
    for (let i = 0; i < 30 && !raised; i++) {
      const out = stepStartup(low, econ, 12, new Rng(i));
      if (out.startup.raising) raised = true;
    }
    expect(raised).toBe(true);
  });

  it('follow-on restores ownership and costs the pro-rata', () => {
    const raising = seed({ ownership: 0.05, raising: { proRata: 2_000_000, ownershipIfFollow: 0.1, stage: 'Series A' } });
    const vc: VCState = { ...createVC(), portfolio: [raising], totalInvested: 1_000_000 };
    const res = followOn(vc, 's', 6);
    expect(res.ok).toBe(true);
    expect(res.vc!.portfolio[0].ownership).toBe(0.1);
    expect(res.cost).toBe(2_000_000);
  });

  it('support raises the support level and costs cash', () => {
    const vc: VCState = { ...createVC(), portfolio: [seed()] };
    const res = supportStartup(vc, 's', 1);
    expect(res.vc!.portfolio[0].support).toBeGreaterThan(0);
    expect(res.cost!).toBeGreaterThan(0);
  });

  it('a mature, healthy startup can exit', () => {
    let exited = false;
    for (let i = 0; i < 80 && !exited; i++) {
      const out = stepStartup(seed({ stage: 'Series C', health: 0.85 }), { ...econ, regime: 'expansion' }, 40, new Rng(i));
      if (out.startup.status === 'exited' && out.proceeds > 0) exited = true;
    }
    expect(exited).toBe(true);
  });
});

describe('vc metrics & engine', () => {
  it('tvpi reflects invested vs value', () => {
    let vc = createVC();
    vc = { ...vc, deals: [generateDeal(new Rng(9), 50)] };
    const d = vc.deals[0];
    vc = investInDeal(vc, d.id, 1_000_000, 0).vc!;
    const m = vcMetrics(vc, 6);
    expect(m.paidIn).toBe(1_000_000);
    expect(m.residual).toBeCloseTo(holdingValue(vc.portfolio[0]), 0);
  });

  it('new games seed deals; advanceMonth carries the vc book', () => {
    const g = createSimGame(2);
    expect(g.vc.deals.length).toBeGreaterThan(0);
    const next = advanceMonth(g);
    expect(Array.isArray(next.vc.portfolio)).toBe(true);
    expect(next.vc.deals.length).toBeGreaterThan(0);
  });
});
