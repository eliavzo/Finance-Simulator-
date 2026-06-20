import { mutatorParams, mutatorScoreMult, MUTATORS } from '../mutators';
import { createSimGame } from '../engine';

describe('mutators', () => {
  it('default params are neutral', () => {
    const p = mutatorParams([]);
    expect(p.startCapitalMult).toBe(1);
    expect(p.crisisMult).toBe(1);
    expect(p.longOnly).toBe(false);
    expect(p.noHedge).toBe(false);
    expect(p.scoreMult).toBe(1);
  });

  it('flags map to params and score multiplies', () => {
    const p = mutatorParams(['lean', 'volatile', 'longonly', 'nohedge', 'impatient']);
    expect(p.startCapitalMult).toBe(0.5);
    expect(p.crisisMult).toBeGreaterThan(1);
    expect(p.redemptionMult).toBeGreaterThan(1);
    expect(p.longOnly).toBe(true);
    expect(p.noHedge).toBe(true);
    expect(p.scoreMult).toBeGreaterThan(1.8);
  });

  it('every mutator has a positive score multiplier', () => {
    for (const m of MUTATORS) expect(m.scoreMult).toBeGreaterThan(1);
  });

  it('"lean" roughly halves starting commitments', () => {
    const normal = createSimGame(1, 'multistrat', 'normal', 'A', undefined, []);
    const lean = createSimGame(1, 'multistrat', 'normal', 'A', undefined, ['lean']);
    expect(lean.fund.committed).toBeLessThan(normal.fund.committed * 0.6);
    expect(lean.mutators).toEqual(['lean']);
  });

  it('mutatorScoreMult is the product over active ids', () => {
    expect(mutatorScoreMult(['lean'])).toBeCloseTo(1.2, 6);
  });
});
