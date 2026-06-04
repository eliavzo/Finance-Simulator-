import { maybeTriggerCrisis, applyCrisisToEconomy, crisisEquityShock, hedgePayout } from '../crises';
import { createEconomy } from '../economy';
import { Crisis } from '../types';
import { Rng } from '../../engine/rng';

const crisis = (over: Partial<Crisis> = {}): Crisis => ({ type: 'creditCrunch', label: 'X', monthsRemaining: 4, severity: 0.8, ...over });

describe('crises', () => {
  it('never triggers while one is active', () => {
    expect(maybeTriggerCrisis(createEconomy(), true, new Rng(1))).toBeUndefined();
  });

  it('raises the vol index when applied', () => {
    const econ = createEconomy();
    expect(applyCrisisToEconomy(econ, crisis()).volIndex).toBeGreaterThan(econ.volIndex);
  });

  it('a rates shock lifts the policy rate', () => {
    const econ = createEconomy();
    expect(applyCrisisToEconomy(econ, crisis({ type: 'ratesShock' })).policyRate).toBeGreaterThan(econ.policyRate);
  });

  it('credit crunch sells off equities, short squeeze rallies them', () => {
    expect(crisisEquityShock(crisis({ type: 'creditCrunch' }))).toBeLessThan(0);
    expect(crisisEquityShock(crisis({ type: 'shortSqueeze' }))).toBeGreaterThan(0);
    expect(crisisEquityShock(undefined)).toBe(0);
  });

  it('hedge pays out in a crash, nothing in calm', () => {
    expect(hedgePayout(10_000_000, true, undefined)).toBeGreaterThan(0);
    expect(hedgePayout(10_000_000, false, crisis())).toBeGreaterThan(0);
    expect(hedgePayout(10_000_000, false, undefined)).toBe(0);
  });
});
