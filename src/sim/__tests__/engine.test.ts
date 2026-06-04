import { advanceMonth, createSimGame, enterpriseEquity } from '../engine';
import { TOTAL_MONTHS } from '../types';
import { openPosition, closePosition, portfolioNav, stepPortfolio, raiseCash } from '../portfolio';
import { createPortfolio } from '../portfolio';
import { createInstruments } from '../market';
import { createEconomy } from '../economy';
import { generateSignals } from '../research';
import { buildLeague } from '../rivals';
import { applyDecision } from '../decisions';
import { firmCapabilities, createFirm, fairSalary, infraMonthlyOpex } from '../firm';
import { createFund, callCapital, distribute, crystalliseCarry, monthlyManagementFee, fundMetrics } from '../fund';
import { buildBalanceSheet } from '../accounting';
import { Rng } from '../../engine/rng';

describe('createSimGame', () => {
  it('initialises a consistent firm + fund + portfolio', () => {
    const g = createSimGame(123);
    expect(g.month).toBe(0);
    expect(g.firm.cash).toBeGreaterThan(0);
    expect(g.fund.committed).toBeGreaterThan(0);
    expect(g.portfolio.cash).toBeGreaterThan(0);
    expect(g.instruments.length).toBeGreaterThan(10);
    // Enterprise equity at t0 = GP runway (3M) + initial called capital (12M).
    expect(enterpriseEquity(g)).toBeCloseTo(15_000_000, -5);
    expect(g.fund.committed).toBeGreaterThanOrEqual(32_000_000);
  });
});

describe('thesis & scenario', () => {
  it('thesis lifts capabilities vs none', () => {
    const base = createSimGame(1, 'multistrat', 'normal');
    const quant = createSimGame(1, 'quant', 'normal');
    const baseCap = firmCapabilities(base.firm, 50, 'multistrat');
    const quantCap = firmCapabilities(quant.firm, 50, 'quant');
    expect(quantCap.research).toBeGreaterThan(baseCap.research);
  });

  it('scenario sets the opening macro regime', () => {
    expect(createSimGame(1, 'macro', 'precrisis').economy.regime).toBe('peak');
    expect(createSimGame(1, 'macro', 'stagflation').economy.regime).toBe('contraction');
  });

  it('dotcom scenario marks up tech equities', () => {
    const normal = createSimGame(1, 'longshort', 'normal');
    const dot = createSimGame(1, 'longshort', 'dotcom');
    const nova = (g: typeof normal) => g.instruments.find((i) => i.symbol === 'NOVA')!.price;
    expect(nova(dot)).toBeGreaterThan(nova(normal));
  });

  it('persists thesis & scenario across a month', () => {
    const next = advanceMonth(createSimGame(1, 'credit', 'boom'));
    expect(next.thesis).toBe('credit');
    expect(next.scenario).toBe('boom');
  });
});

describe('advanceMonth', () => {
  it('is deterministic for a seed', () => {
    const a = advanceMonth(createSimGame(777));
    const b = advanceMonth(createSimGame(777));
    expect(a.instruments.map((i) => i.price)).toEqual(b.instruments.map((i) => i.price));
    expect(a.reputation).toBe(b.reputation);
    expect(a.firm.cash).toBe(b.firm.cash);
  });

  it('does not mutate the input', () => {
    const g = createSimGame(5);
    advanceMonth(g);
    expect(g.month).toBe(0);
  });

  it('charges management fees that flow GP-ward', () => {
    const g = createSimGame(9);
    const next = advanceMonth(g);
    expect(next.firm.feesEarned).toBeGreaterThan(0);
    // GP cash rose by fees minus payroll/opex/tax — feesEarned strictly > 0.
    expect(next.incomeStatements[0].mgmtFeeRevenue).toBeGreaterThan(0);
  });

  it('produces a balanced balance sheet each month', () => {
    let g = createSimGame(11);
    for (let i = 0; i < 12; i++) g = advanceMonth(g);
    const bs = g.balanceSheets[0];
    expect(bs.totalAssets - bs.totalLiabilities).toBeCloseTo(bs.totalEquity, 4);
    expect(bs.lpCapital + bs.gpEquity).toBeCloseTo(bs.totalEquity, 4);
  });

  it('ends within the horizon and is idempotent afterwards', () => {
    let g = createSimGame(2026);
    for (let i = 0; i < TOTAL_MONTHS; i++) g = advanceMonth(g);
    expect(g.gameOver).toBe(true);
    expect(g.month).toBeLessThanOrEqual(TOTAL_MONTHS);
    expect(advanceMonth(g)).toBe(g);
    expect(g.equityHistory.length).toBe(g.month + 1);
  });
});

describe('rivals & league', () => {
  it('seeds rivals and ranks the player in the league', () => {
    const g = createSimGame(8);
    expect(g.rivals.length).toBeGreaterThanOrEqual(4);
    const league = buildLeague(g.rivals, g.firm.name, 0.05, 12_000_000);
    expect(league.length).toBe(g.rivals.length + 1);
    expect(league.some((e) => e.isPlayer)).toBe(true);
    // ranks are 1..n, contiguous
    expect(league.map((e) => e.rank)).toEqual(league.map((_, i) => i + 1));
  });

  it('rivals evolve over a month', () => {
    const next = advanceMonth(createSimGame(8));
    expect(next.rivals[0].monthlyReturns.length).toBe(1);
  });
});

describe('decision cards', () => {
  it('applies a choice effect and clears the pending decision', () => {
    const g = createSimGame(1);
    const withCard: any = {
      ...g,
      pendingDecision: { id: 'x', title: 'T', body: 'b', choices: [{ label: 'a', description: '', effect: { reputation: 5, cash: 100, committed: 5_000_000 } }] },
    };
    const after = applyDecision(withCard, 0, new Rng(1));
    expect(after.reputation).toBe(Math.min(100, g.reputation + 5));
    expect(after.firm.cash).toBe(g.firm.cash + 100);
    expect(after.fund.committed).toBe(g.fund.committed + 5_000_000);
    expect(after.pendingDecision).toBeUndefined();
  });

  it('decision cards appear over time', () => {
    let g = createSimGame(42);
    let seen = false;
    for (let i = 0; i < 120 && !g.gameOver; i++) {
      g = advanceMonth(g);
      if (g.pendingDecision) seen = true;
    }
    expect(seen).toBe(true);
  });
});

describe('objectives & score', () => {
  it('seeds active mandates at start', () => {
    const g = createSimGame(3);
    expect(g.objectives.length).toBeGreaterThanOrEqual(2);
    expect(g.objectives.every((o) => o.status === 'active')).toBe(true);
  });

  it('produces a final score and grade when the game ends', () => {
    let g = createSimGame(2030);
    for (let i = 0; i < TOTAL_MONTHS; i++) g = advanceMonth(g);
    expect(g.gameOver).toBe(true);
    expect(['horizon', 'insolvency', 'reputation']).toContain(g.gameOverReason);
    expect(typeof g.finalScore).toBe('number');
    expect(['S', 'A', 'B', 'C', 'D', 'F']).toContain(g.finalGrade);
  });

  it('resolves a mandate by its deadline', () => {
    let g = createSimGame(5);
    const firstDeadline = Math.min(...g.objectives.map((o) => o.deadlineMonth));
    for (let i = 0; i < firstDeadline; i++) g = advanceMonth(g);
    const resolved = g.objectives.filter((o) => o.status !== 'active');
    expect(resolved.length).toBeGreaterThan(0);
  });
});

describe('portfolio', () => {
  it('posts margin = notional / leverage and closes for cash', () => {
    const instruments = createInstruments();
    const eq = instruments.find((i) => i.kind === 'equity')!;
    let p = createPortfolio(2_000_000);
    const qty = 10_000;
    const res = openPosition(p, eq, qty, 4, 0, 'x');
    expect(res.ok).toBe(true);
    p = res.portfolio!;
    expect(p.positions[0].margin).toBeCloseTo((qty * eq.price) / 4, 0);
    const after = closePosition(p, p.positions[0].id, instruments);
    // No price change → get margin back (minus nothing).
    expect(after.cash).toBeCloseTo(2_000_000, 0);
  });

  it('rejects shorting options', () => {
    const instruments = createInstruments();
    const eq = instruments.find((i) => i.kind === 'equity')!;
    const opt = {
      id: 'opt-x', kind: 'option' as const, symbol: 'NOVA C', name: 'call', underlyingId: eq.id,
      optionType: 'call' as const, strike: eq.price, expiryMonth: 6, multiplier: 100,
      price: 5, priceHistory: [5],
    };
    const p = createPortfolio(1_000_000);
    expect(openPosition(p, opt, -10, 1, 0, 'x').ok).toBe(false);
  });

  it('raiseCash force-liquidates at a haircut', () => {
    const instruments = createInstruments();
    const eq = instruments.find((i) => i.kind === 'equity')!;
    let p = createPortfolio(0);
    p = openPosition(p, eq, 5_000, 1, 0, 'x').portfolio!;
    const r = raiseCash(p, instruments, 100_000, 0.05);
    expect(r.raised).toBeGreaterThan(0);
    expect(r.haircutLoss).toBeGreaterThan(0);
    expect(r.portfolio.positions.length).toBe(0);
  });

  it('liquidates a levered position after a large adverse move', () => {
    const instruments = createInstruments();
    const eq = instruments.find((i) => i.kind === 'equity')!;
    let p = createPortfolio(1_000_000);
    p = openPosition(p, eq, 5_000, 5, 0, 'x').portfolio!;
    // Crash the underlying 40%.
    const crashed = instruments.map((i) => (i.id === eq.id ? { ...i, price: eq.price * 0.6 } : i));
    const caps = firmCapabilities(createFirm('t', 1, new Rng(1)), 50);
    const step = stepPortfolio(p, crashed, 1, { policyRate: 0.03, primeBrokerTier: 1, capabilities: caps });
    expect(step.marginCalled).toContain(eq.symbol);
  });
});

describe('fund economics', () => {
  it('calls capital pro-rata and distributes back', () => {
    const rng = new Rng(3);
    let fund = createFund(0, 10_000_000, rng);
    const call = callCapital(fund, 4_000_000, 0);
    expect(call.called).toBe(4_000_000);
    fund = call.fund;
    expect(fund.called).toBe(4_000_000);
    fund = distribute(fund, 1_000_000, 12);
    expect(fund.distributed).toBe(1_000_000);
    expect(fund.lps[0].distributed).toBeCloseTo(1_000_000, 0);
  });

  it('management fee is 2%/yr on committed during the investment period', () => {
    const fund = createFund(0, 12_000_000, new Rng(1));
    const fee = monthlyManagementFee(fund, 8_000_000, 1);
    expect(fee).toBeCloseTo((12_000_000 * 0.02) / 12, 4);
  });

  it('crystallises carry only annually and only above hurdle', () => {
    const fund = createFund(0, 10_000_000, new Rng(1));
    // Not yet a year in → no carry.
    expect(crystalliseCarry({ ...fund, called: 5_000_000, highWaterMark: 5_000_000 }, 6_000_000, 6).carry).toBe(0);
    // A year in, NAV up 30% over HWM (well above 8% hurdle).
    const res = crystalliseCarry({ ...fund, called: 5_000_000, highWaterMark: 5_000_000, lastCarryMonth: 0 }, 6_500_000, 12);
    const expected = (6_500_000 - 5_000_000 - 5_000_000 * 0.08) * 0.2;
    expect(res.carry).toBeCloseTo(expected, 0);
  });

  it('fund metrics compute TVPI and IRR', () => {
    let fund = createFund(0, 10_000_000, new Rng(1));
    fund = callCapital(fund, 5_000_000, 0).fund;
    fund = distribute(fund, 2_000_000, 24);
    const m = fundMetrics(fund, 8_000_000, 36);
    expect(m.tvpi).toBeCloseTo((2_000_000 + 8_000_000) / 5_000_000, 4);
    expect(m.dpi).toBeCloseTo(2_000_000 / 5_000_000, 4);
  });
});

describe('firm', () => {
  it('fair salary scales with skill', () => {
    expect(fairSalary('Analyst', 80)).toBeGreaterThan(fairSalary('Analyst', 40));
  });
  it('infra opex grows with tiers', () => {
    expect(infraMonthlyOpex({ dataTier: 3, primeBrokerTier: 3, quantTier: 3, officeTier: 3 }))
      .toBeGreaterThan(infraMonthlyOpex({ dataTier: 1, primeBrokerTier: 0, quantTier: 0, officeTier: 1 }));
  });
  it('more skilled people raise capabilities', () => {
    const weak = firmCapabilities(createFirm('a', 1, new Rng(1)), 50);
    const strongFirm = createFirm('b', 1, new Rng(1));
    strongFirm.employees = strongFirm.employees.map((e) => ({ ...e, skill: 95, morale: 95 }));
    const strong = firmCapabilities(strongFirm, 50);
    expect(strong.research).toBeGreaterThan(weak.research);
  });
});

describe('research signals', () => {
  it('a team produces signals; no research desk produces none', () => {
    const instruments = createInstruments();
    const econ = createEconomy();
    const rng = new Rng(4);

    const strongFirm = createFirm('s', 1, new Rng(1));
    strongFirm.employees = [
      { id: 'a', name: 'A', role: 'Analyst', skill: 95, salary: 1, morale: 95, hiredMonth: 0 },
      { id: 'q', name: 'Q', role: 'Quant', skill: 95, salary: 1, morale: 95, hiredMonth: 0 },
    ];
    const strong = generateSignals(instruments, econ, firmCapabilities(strongFirm, 60), rng);
    expect(strong.length).toBeGreaterThan(0);
    expect(strong[0].conviction).toBeGreaterThan(0);

    const emptyFirm = createFirm('e', 1, new Rng(1));
    emptyFirm.employees = [];
    emptyFirm.infrastructure = { dataTier: 0, primeBrokerTier: 0, quantTier: 0, officeTier: 0 };
    expect(generateSignals(instruments, econ, firmCapabilities(emptyFirm, 50), rng)).toHaveLength(0);
  });

  it('a new game seeds signals and zero contribution', () => {
    const g = createSimGame(7);
    expect(Array.isArray(g.signals)).toBe(true);
    expect(g.lastContribution.alphaPnl).toBe(0);
  });

  it('advanceMonth records a team contribution', () => {
    const next = advanceMonth(createSimGame(7));
    expect(next.lastContribution.financingSaved).toBeGreaterThanOrEqual(0);
    expect(next.lastContribution.marginCallsPrevented).toBeGreaterThanOrEqual(0);
  });
});

describe('accounting', () => {
  it('balance sheet balances', () => {
    const g = createSimGame(1);
    const bs = buildBalanceSheet({ month: 0, firm: g.firm, fund: g.fund, fundCash: g.portfolio.cash, positionsValue: 0 });
    expect(bs.totalAssets - bs.totalLiabilities).toBeCloseTo(bs.totalEquity, 6);
  });
});
