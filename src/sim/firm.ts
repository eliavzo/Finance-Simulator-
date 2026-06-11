/**
 * The management company (GP): people and infrastructure.
 *
 * Headcount and infrastructure produce *capabilities* — research edge, trading
 * execution, risk control, fundraising reach and operational capacity — which
 * feed back into investing performance and the fund's ability to raise and
 * deploy capital. People cost salaries, get demoralised when the firm is
 * over-stretched or unprofitable, and quit if morale collapses.
 */
import { Employee, FirmState, FundThesis, Infrastructure, Role } from './types';
import { THESES } from './thesis';
import { Rng } from '../engine/rng';

/* ------------------------------ Salaries --------------------------------- */

/** Base annual salary per role at skill 50; scales with skill. */
const ROLE_BASE_SALARY: Record<Role, number> = {
  Analyst: 120_000,
  Trader: 180_000,
  PortfolioManager: 350_000,
  Quant: 250_000,
  RiskManager: 220_000,
  InvestorRelations: 200_000,
  COO: 300_000,
};

export const ROLE_LABEL: Record<Role, string> = {
  Analyst: 'Analyst',
  Trader: 'Trader',
  PortfolioManager: 'Portfolio Manager',
  Quant: 'Quant',
  RiskManager: 'Risk Manager',
  InvestorRelations: 'Investor Relations',
  COO: 'COO',
};

/** Fair market salary for a role at a given skill level. */
export function fairSalary(role: Role, skill: number): number {
  return Math.round((ROLE_BASE_SALARY[role] * (0.5 + skill / 100)) / 1000) * 1000;
}

/* --------------------------- Infrastructure ------------------------------ */

/** Monthly opex for each infrastructure tier (index = tier level). */
const INFRA_MONTHLY_COST = {
  dataTier: [0, 8_000, 25_000, 60_000],
  primeBrokerTier: [0, 5_000, 15_000, 40_000],
  quantTier: [0, 12_000, 35_000, 90_000],
  officeTier: [0, 10_000, 30_000, 70_000],
} as const;

export const MAX_TIER = 3;

export function infraMonthlyOpex(infra: Infrastructure): number {
  return (
    INFRA_MONTHLY_COST.dataTier[infra.dataTier] +
    INFRA_MONTHLY_COST.primeBrokerTier[infra.primeBrokerTier] +
    INFRA_MONTHLY_COST.quantTier[infra.quantTier] +
    INFRA_MONTHLY_COST.officeTier[infra.officeTier]
  );
}

/** One-time cost to upgrade an infrastructure track to the next tier. */
export function upgradeCost(track: keyof Infrastructure, currentTier: number): number {
  const next = currentTier + 1;
  if (next > MAX_TIER) return Infinity;
  return INFRA_MONTHLY_COST[track][next] * 12; // ~1 year of opex up front
}

/* ------------------------------- Setup ----------------------------------- */

const FIRST_NAMES = ['Alex', 'Sam', 'Jordan', 'Riley', 'Morgan', 'Casey', 'Taylor', 'Jamie', 'Devon', 'Quinn', 'Avery', 'Reese', 'Rowan', 'Sky', 'Lane'];
const LAST_NAMES = ['Cohen', 'Nakamura', 'Schmidt', 'Okafor', 'Rossi', 'Patel', 'Larsson', 'Dubois', 'Ivanov', 'Khan', 'Meyer', 'Costa', 'Wong', 'Abadi', 'Haller', 'Mbeki', 'Lindqvist', 'Moreau', 'Tanaka', 'Novak'];

let empCounter = 0;
// Rotate through surnames so colleagues don't share a last name by accident.
let surnameCursor = -1;
function makeName(rng: Rng): string {
  if (surnameCursor < 0) surnameCursor = rng.int(0, LAST_NAMES.length - 1);
  surnameCursor = (surnameCursor + 1 + rng.int(0, 3)) % LAST_NAMES.length;
  return `${rng.pick(FIRST_NAMES)} ${LAST_NAMES[surnameCursor]}`;
}

export function createEmployee(role: Role, skill: number, rng: Rng, month: number): Employee {
  empCounter += 1;
  return {
    id: `emp-${month}-${empCounter}`,
    name: makeName(rng),
    role,
    skill,
    salary: fairSalary(role, skill),
    morale: 75,
    hiredMonth: month,
  };
}

export function createFirm(name: string, startingCash: number, rng: Rng): FirmState {
  return {
    name,
    cash: startingCash,
    employees: [
      createEmployee('Analyst', 55, rng, 0),
      createEmployee('Trader', 60, rng, 0),
    ],
    infrastructure: { dataTier: 1, primeBrokerTier: 1, quantTier: 0, officeTier: 1 },
    feesEarned: 0,
    carryEarned: 0,
  };
}

/* ---------------------------- Capabilities ------------------------------- */

export interface FirmCapabilities {
  /** Research edge in [0, 1] — adds alpha, improves deal/signal quality. */
  research: number;
  /** Execution in [0, 1] — cuts slippage & financing cost. */
  execution: number;
  /** Risk control in [0, 1] — dampens tail losses, fewer margin calls. */
  risk: number;
  /** Fundraising reach in [0, 1] — scales LP capital raised. */
  fundraising: number;
  /** Max number of open positions the team can run well. */
  capacityPositions: number;
  /** Monthly alpha applied to the book from manager skill (can be negative). */
  monthlyAlpha: number;
}

const ROLE_OF = (emps: Employee[], role: Role) => emps.filter((e) => e.role === role);

/** Effective contribution of a set of employees (skill × morale), with
 *  diminishing returns so the 5th analyst adds less than the 1st. */
function teamScore(emps: Employee[]): number {
  const contribution = emps.reduce((acc, e) => acc + (e.skill / 100) * (0.4 + (0.6 * e.morale) / 100), 0);
  return 1 - Math.exp(-0.7 * contribution);
}

export function firmCapabilities(firm: FirmState, reputation: number, thesis?: FundThesis): FirmCapabilities {
  const e = firm.employees;
  const infra = firm.infrastructure;
  const t = thesis ? THESES[thesis].cap : { research: 0, execution: 0, risk: 0, fundraising: 0, capacity: 0 };

  const research = Math.min(1, teamScore([...ROLE_OF(e, 'Analyst'), ...ROLE_OF(e, 'Quant')]) * 0.8 + infra.dataTier * 0.06 + t.research);
  const execution = Math.min(1, teamScore([...ROLE_OF(e, 'Trader'), ...ROLE_OF(e, 'Quant')]) * 0.8 + infra.quantTier * 0.07 + t.execution);
  const risk = Math.min(1, teamScore([...ROLE_OF(e, 'RiskManager'), ...ROLE_OF(e, 'Quant')]) * 0.85 + infra.quantTier * 0.05 + t.risk);
  const fundraising = Math.min(1, teamScore(ROLE_OF(e, 'InvestorRelations')) * 0.7 + reputation / 200 + t.fundraising);

  const pmCount = ROLE_OF(e, 'PortfolioManager').length;
  const cooCount = ROLE_OF(e, 'COO').length;
  const capacityPositions = 3 + pmCount * 4 + ROLE_OF(e, 'Trader').length * 2 + cooCount * 3 + infra.officeTier * 2 + t.capacity;

  // Alpha: research & execution add edge; weak/empty teams bleed.
  const monthlyAlpha = (research * 0.004 + execution * 0.002 - 0.001) ;

  return { research, execution, risk, fundraising, capacityPositions, monthlyAlpha };
}

/* ------------------------------- Monthly --------------------------------- */

export function monthlyPayroll(firm: FirmState): number {
  return firm.employees.reduce((acc, e) => acc + e.salary, 0) / 12;
}

export interface FirmStepContext {
  /** Number of open positions (for capacity / morale). */
  openPositions: number;
  /** Whether the firm was profitable this month. */
  profitable: boolean;
  /** Current reputation. */
  reputation: number;
}

export interface FirmStepResult {
  firm: FirmState;
  departures: Employee[];
  payroll: number;
  infraOpex: number;
}

/**
 * Update morale and process attrition for the month. Morale drifts toward a
 * target set by workload (positions vs capacity), profitability and reputation.
 */
export function stepFirm(firm: FirmState, ctx: FirmStepContext, rng: Rng): FirmStepResult {
  const caps = firmCapabilities(firm, ctx.reputation);
  const overloaded = ctx.openPositions > caps.capacityPositions;
  const overloadRatio = caps.capacityPositions > 0 ? ctx.openPositions / caps.capacityPositions : 1;

  const departures: Employee[] = [];
  const survivors: Employee[] = [];

  for (const emp of firm.employees) {
    // Target morale: high when not overloaded, profitable, good reputation.
    let target = 80;
    if (overloaded) target -= Math.min(40, (overloadRatio - 1) * 60);
    if (!ctx.profitable) target -= 12;
    target += (ctx.reputation - 50) * 0.2;
    target = Math.max(10, Math.min(95, target));

    const morale = Math.max(0, Math.min(100, emp.morale + (target - emp.morale) * 0.25 + rng.normal(0, 3)));

    // Attrition: chance rises sharply as morale falls below 40.
    const quitProb = morale < 40 ? (40 - morale) / 100 : 0.01;
    if (rng.chance(quitProb)) {
      departures.push({ ...emp, morale });
    } else {
      survivors.push({ ...emp, morale });
    }
  }

  return {
    firm: { ...firm, employees: survivors },
    departures,
    payroll: monthlyPayroll(firm),
    infraOpex: infraMonthlyOpex(firm.infrastructure),
  };
}

/**
 * Generate a hiring candidate for a role. Talent level scales with reputation:
 * a no-name shop attracts mediocre applicants, a renowned house draws stars.
 */
export function generateCandidate(role: Role, reputation: number, rng: Rng, month: number): Employee {
  // Mean skill tracks reputation (~40 at rep 30, ~52 at 50, ~72 at 85, ~80 at 100).
  const mean = 25 + reputation * 0.55;
  const skill = Math.max(20, Math.min(98, Math.round(rng.normal(mean, 9))));
  return createEmployee(role, skill, rng, month);
}
