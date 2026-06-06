import { analyzeRun, EMPTY_ANALYTICS } from '../analysis';
import { createSimGame, advanceMonth } from '../engine';
import { SimState, RunAnalytics } from '../types';

const withAnalytics = (over: Partial<RunAnalytics>): RunAnalytics => ({ ...EMPTY_ANALYTICS, months: 120, ...over });

describe('run analysis', () => {
  it('returns a structured report for a fresh game', () => {
    const r = analyzeRun(createSimGame(1));
    expect(typeof r.profile).toBe('string');
    expect(r.metrics.length).toBeGreaterThan(5);
  });

  it('flags chronic over-leverage and many margin calls as weaknesses', () => {
    const g = createSimGame(2);
    const state: SimState = {
      ...g,
      portfolio: { ...g.portfolio, marginCalls: 4 },
      analytics: withAnalytics({ grossLevSum: 120 * 3, monthsOverLev: 90, maxGrossLev: 4.5 }),
    };
    const r = analyzeRun(state);
    expect(r.weaknesses.some((f) => /übergehebelt/i.test(f.title))).toBe(true);
    expect(r.weaknesses.some((f) => /Margin Calls/i.test(f.title))).toBe(true);
  });

  it('explains an insolvency failure via GP economics', () => {
    const g = createSimGame(3);
    const state: SimState = { ...g, gameOverReason: 'insolvency', analytics: withAnalytics({ gpProfitMonths: 20 }) };
    const r = analyzeRun(state);
    expect(r.failure).toBeTruthy();
    expect(r.failure!).toMatch(/GP|profitabel|Kostenbasis/i);
  });

  it('rewards value discipline as a strength', () => {
    const g = createSimGame(4);
    const state: SimState = { ...g, analytics: withAnalytics({ valuationGapSum: 0.1 * 100, valuationSamples: 100 }) };
    const r = analyzeRun(state);
    expect(r.strengths.some((f) => /Value/i.test(f.title))).toBe(true);
  });

  it('no failure text when the horizon is reached', () => {
    const g = createSimGame(5);
    const state: SimState = { ...g, gameOverReason: 'horizon', analytics: withAnalytics({}) };
    expect(analyzeRun(state).failure).toBeUndefined();
  });

  it('accumulates analytics over advanced months', () => {
    let g = createSimGame(6);
    for (let i = 0; i < 6; i++) g = advanceMonth(g);
    expect(g.analytics.months).toBe(6);
    expect(g.analytics.cashQuoteSum).toBeGreaterThan(0);
  });
});
