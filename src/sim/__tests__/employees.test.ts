import { effectiveness, createEmployee, firmCapabilities, stepFirm, createFirm } from '../firm';
import { spawnRival } from '../rivals';
import { Rng } from '../../engine/rng';
import { Employee, FirmState } from '../types';

const emp = (over: Partial<Employee> = {}): Employee => ({ id: 'e1', name: 'X Y', role: 'Analyst', skill: 60, salary: 100000, morale: 80, hiredMonth: 0, ...over });

describe('employee depth', () => {
  it('traits scale output effectiveness', () => {
    expect(effectiveness(emp({ traits: [] }))).toBe(1);
    expect(effectiveness(emp({ traits: ['star'] }))).toBeCloseTo(1.25, 6);
    expect(effectiveness(emp({ traits: ['loyal'] }))).toBeLessThan(1);
  });

  it('createEmployee sometimes assigns traits', () => {
    const rng = new Rng(3);
    let withTraits = 0;
    for (let i = 0; i < 40; i++) if ((createEmployee('Analyst', 80, rng, 0).traits ?? []).length > 0) withTraits++;
    expect(withTraits).toBeGreaterThan(0);
    expect(withTraits).toBeLessThan(40);
  });

  it('a mentor lifts team capabilities', () => {
    const base: FirmState = { ...createFirm('A', 1e6, new Rng(1)), employees: [emp({ id: 'a', traits: [] })] };
    const withMentor: FirmState = { ...base, employees: [emp({ id: 'a', traits: [] }), emp({ id: 'm', traits: ['mentor'] })] };
    expect(firmCapabilities(withMentor, 50).research).toBeGreaterThan(firmCapabilities(base, 50).research);
  });

  it('employees gain skill over a month', () => {
    let firm: FirmState = { ...createFirm('A', 1e6, new Rng(1)), employees: [emp({ id: 'a', skill: 50, morale: 85, traits: [] })] };
    // run until a survivor (morale high => almost always survives)
    let grew = false;
    for (let s = 0; s < 5 && !grew; s++) {
      const res = stepFirm(firm, { openPositions: 1, profitable: true, reputation: 60 }, new Rng(s + 1));
      if (res.firm.employees.length > 0) grew = res.firm.employees[0].skill > 50;
    }
    expect(grew).toBe(true);
  });

  it('spawnRival builds a breakaway from a founder name', () => {
    const r = spawnRival('Dana Okafor', 80, new Rng(2));
    expect(r.name).toBe('Okafor Capital');
    expect(r.skill).toBeCloseTo(0.8, 6);
  });
});
