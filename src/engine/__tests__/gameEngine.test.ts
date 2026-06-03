import { advanceQuarter, createNewGame, totalEquity } from '../gameEngine';
import { openPosition, stepHedgeFund } from '../hedgefund';
import { investInDeal } from '../vc';
import { TOTAL_QUARTERS, STARTING_CAPITAL } from '../../models/types';
import { Rng } from '../rng';

describe('rng determinism', () => {
  it('same seed produces the same sequence', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('state can be snapshotted and resumed', () => {
    const a = new Rng(7);
    a.next();
    a.next();
    const snap = a.getState();
    const expected = a.next();
    const resumed = new Rng(snap);
    expect(resumed.next()).toBe(expected);
  });
});

describe('createNewGame', () => {
  it('starts with the correct capital split and deal flow', () => {
    const g = createNewGame(123);
    expect(g.quarter).toBe(0);
    expect(g.started).toBe(true);
    expect(g.gameOver).toBe(false);
    expect(g.hedgeFund.cash + g.vc.cash).toBeCloseTo(STARTING_CAPITAL, 0);
    expect(totalEquity(g)).toBeCloseTo(STARTING_CAPITAL, 0);
    expect(g.vc.dealFlow.length).toBeGreaterThan(0);
  });
});

describe('advanceQuarter', () => {
  it('is deterministic for a given seed', () => {
    const g1 = advanceQuarter(createNewGame(999));
    const g2 = advanceQuarter(createNewGame(999));
    expect(g1.assets.map((a) => a.price)).toEqual(g2.assets.map((a) => a.price));
    expect(g1.reputation).toBe(g2.reputation);
  });

  it('does not mutate the input state', () => {
    const g = createNewGame(5);
    const beforeQuarter = g.quarter;
    advanceQuarter(g);
    expect(g.quarter).toBe(beforeQuarter);
  });

  it('reaches game over after the full horizon', () => {
    let g = createNewGame(2024);
    for (let i = 0; i < TOTAL_QUARTERS; i++) {
      g = advanceQuarter(g);
    }
    expect(g.quarter).toBe(TOTAL_QUARTERS);
    expect(g.gameOver).toBe(true);
    // Advancing again is a no-op.
    expect(advanceQuarter(g)).toBe(g);
  });

  it('appends one point to the equity history per quarter', () => {
    let g = createNewGame(1);
    const initialLen = g.totalEquityHistory.length;
    g = advanceQuarter(g);
    expect(g.totalEquityHistory.length).toBe(initialLen + 1);
  });
});

describe('hedge fund leverage & margin', () => {
  it('posts margin = notional / leverage', () => {
    const g = createNewGame(3);
    const asset = g.assets[0];
    const res = openPosition(g.hedgeFund, asset, 'long', 1_000_000, 4, 0, 'x');
    expect(res.ok).toBe(true);
    const pos = res.state!.positions[0];
    expect(pos.margin).toBeCloseTo(250_000, 0);
    expect(res.state!.cash).toBeCloseTo(g.hedgeFund.cash - 250_000, 0);
  });

  it('rejects leverage outside 1-5x', () => {
    const g = createNewGame(3);
    const asset = g.assets[0];
    expect(openPosition(g.hedgeFund, asset, 'long', 1_000_000, 6, 0, 'x').ok).toBe(false);
  });

  it('liquidates a position that breaches maintenance margin', () => {
    const g = createNewGame(3);
    const asset = { ...g.assets[0], price: 100 };
    const assets = [asset, ...g.assets.slice(1)];
    // Open a 5x long, then crash the price 50% -> wipes out the margin.
    const opened = openPosition(g.hedgeFund, asset, 'long', 1_000_000, 5, 0, 'x').state!;
    const crashed = assets.map((a) => (a.id === asset.id ? { ...a, price: 50 } : a));
    const stepped = stepHedgeFund(opened, crashed);
    expect(stepped.marginCalledTickers).toContain(asset.ticker);
    expect(stepped.state.positions.length).toBe(0);
  });
});

describe('vc investing', () => {
  it('records ownership and reduces dry powder', () => {
    const g = createNewGame(8);
    const deal = g.vc.dealFlow[0];
    const res = investInDeal(g.vc, deal.id, 1_000_000, 0);
    expect(res.ok).toBe(true);
    const company = res.state!.portfolio[0];
    expect(company.totalInvested).toBe(1_000_000);
    expect(company.ownership).toBeGreaterThan(0);
    expect(company.ownership).toBeLessThan(1);
    expect(res.state!.cash).toBeCloseTo(g.vc.cash - 1_000_000, 0);
  });

  it('rejects an over-budget cheque', () => {
    const g = createNewGame(8);
    const deal = g.vc.dealFlow[0];
    expect(investInDeal(g.vc, deal.id, g.vc.cash + 1, 0).ok).toBe(false);
  });
});
