import { maybeOpportunity, payoffMultiple } from '../opportunities';
import { createSimGame, advanceMonth } from '../engine';
import { SimState } from '../types';
import { Rng } from '../../engine/rng';

describe('special opportunities', () => {
  it('offers nothing when cash is tiny', () => {
    expect(maybeOpportunity(60, 5, 100, new Rng(1))).toBeUndefined();
  });

  it('block trades have a tight payoff band', () => {
    for (let i = 0; i < 50; i++) {
      const m = payoffMultiple('block', 50, new Rng(i));
      expect(m).toBeGreaterThanOrEqual(0.95);
      expect(m).toBeLessThanOrEqual(1.4);
    }
  });

  it('new games start with no special holdings', () => {
    expect(createSimGame(1).specialHoldings).toEqual([]);
  });

  it('a matured holding resolves into cash and is removed', () => {
    const g = createSimGame(2);
    const cashBefore = g.portfolio.cash;
    const withHolding: SimState = {
      ...g,
      specialHoldings: [{ id: 'h1', type: 'block', title: 'Block-Trade', invested: 2_000_000, investedMonth: 0, resolveMonth: 1 }],
    };
    const next = advanceMonth(withHolding);
    expect(next.specialHoldings.length).toBe(0);
    // Block trade pays 0.95x–1.4x, so cash should reflect roughly the proceeds.
    expect(next.portfolio.cash).toBeGreaterThan(cashBefore - 2_000_000 + 1_000_000);
  });
});
