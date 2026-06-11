import { lpSentiment } from '../fund';
import { LimitedPartner } from '../types';

const lp = (over: Partial<LimitedPartner> = {}): LimitedPartner => ({
  id: 'x', name: 'n', type: 'Pension', committed: 1e7, called: 1e7, distributed: 0,
  expectedReturn: 0.08, patience: 0.85, redeemed: false, ...over,
});

describe('LP sentiment is market-relative', () => {
  it('beating the index in a down market keeps pressure low', () => {
    // Index -15% (drawdown ~15%), fund -8% (drawdown ~18%, beating the index).
    const s = lpSentiment(lp(), -0.08, -0.15, 0.18, 0.15);
    expect(s.pressure).toBeLessThan(0.03);
    expect(s.mood).not.toBe('critical');
  });

  it('lagging the market builds redemption pressure', () => {
    const beat = lpSentiment(lp(), -0.08, -0.15, 0.18, 0.15);
    const lag = lpSentiment(lp({ patience: 0.5 }), -0.20, -0.05, 0.25, 0.05);
    expect(lag.pressure).toBeGreaterThan(beat.pressure * 2);
    expect(lag.mood).toBe('critical');
  });

  it('matching the market exactly is content', () => {
    // Same return and same drawdown as the index → no excess, no shortfall.
    const s = lpSentiment(lp(), 0.05, 0.05, 0.1, 0.1);
    expect(s.pressure).toBeLessThan(0.01);
    expect(s.mood).toBe('happy');
  });

  it('a patient LP redeems less readily than an impatient one', () => {
    const patient = lpSentiment(lp({ patience: 0.95 }), -0.3, -0.05, 0.35, 0.05);
    const jumpy = lpSentiment(lp({ patience: 0.4 }), -0.3, -0.05, 0.35, 0.05);
    expect(jumpy.pressure).toBeGreaterThan(patient.pressure);
  });
});
