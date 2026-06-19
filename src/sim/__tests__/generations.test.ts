import { createSimGame, successorInfo, raiseSuccessor } from '../engine';
import { Rng } from '../../engine/rng';
import { SimState } from '../types';

function mature(): SimState {
  const g = createSimGame(4, 'multistrat', 'normal');
  // 4 years in, strong book, good standing.
  return {
    ...g,
    month: 48,
    reputation: 65,
    fund: { ...g.fund, vintageMonth: 0, called: 12_000_000, committed: 30_000_000 },
    portfolio: { ...g.portfolio, cash: 18_000_000 },
  };
}

describe('fund generations', () => {
  it('a young fund cannot raise a successor', () => {
    const g = createSimGame(4);
    const info = successorInfo(g);
    expect(info.eligible).toBe(false);
    expect(info.reason).toBe('young');
  });

  it('a mature, well-performing fund is eligible for a bigger successor', () => {
    const g = mature();
    const info = successorInfo(g);
    expect(info.eligible).toBe(true);
    expect(info.nextGen).toBe(2);
    expect(info.newCommitted).toBeGreaterThan(g.fund.committed);
  });

  it('raiseSuccessor launches a larger Fund II and resets the book', () => {
    const g = mature();
    const before = g.fund.committed;
    const next = raiseSuccessor(g, new Rng(1));
    expect(next.fund.generation).toBe(2);
    expect(next.fund.committed).toBeGreaterThan(before);
    expect(next.fund.vintageMonth).toBe(g.month);
    expect(next.reputation).toBeGreaterThan(g.reputation);
    // Fresh book: positions cleared, cash = new called.
    expect(next.portfolio.positions.length).toBe(0);
    expect(next.fund.mgmtFeeRate).toBeGreaterThanOrEqual(g.fund.mgmtFeeRate);
  });

  it('is a no-op when not eligible', () => {
    const g = createSimGame(4);
    expect(raiseSuccessor(g, new Rng(1))).toBe(g);
  });
});
