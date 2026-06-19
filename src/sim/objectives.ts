/**
 * LP mandates / objectives and the end-of-game score.
 *
 * LPs hand the manager targets (a net-IRR hurdle, an AUM goal, a drawdown cap …)
 * with a deadline. Hitting them brings reputation and fresh capital; missing
 * them costs reputation. At the end of the run everything is rolled into a
 * single score and grade.
 */
import { Objective, ObjectiveMetric, SimState } from './types';
import { maxDrawdown } from '../engine/finance';
import { difficultyParams, DEFAULT_DIFFICULTY } from './difficulty';
import { fundMetrics } from './fund';
import { portfolioNav } from './portfolio';
import { Lang, Loc, tr, getLang } from '../i18n/lang';
import { Rng } from '../engine/rng';

export const METRIC_LABEL: Record<ObjectiveMetric, Loc> = {
  netIrr: { de: 'Netto-IRR', en: 'Net IRR' },
  tvpi: { de: 'TVPI', en: 'TVPI' },
  aum: { de: 'Fonds-NAV', en: 'Fund NAV' },
  maxDrawdown: { de: 'Max Drawdown', en: 'Max Drawdown' },
  reputation: { de: 'Reputation', en: 'Reputation' },
};

/** Mandate title by metric (titles map 1:1 to a metric). */
export const OBJECTIVE_TITLE: Record<ObjectiveMetric, Loc> = {
  netIrr: { de: 'Renditeziel', en: 'Return Target' },
  aum: { de: 'Wachstumsziel', en: 'Growth Target' },
  tvpi: { de: 'Multiple-Ziel', en: 'Multiple Target' },
  maxDrawdown: { de: 'Risiko-Limit', en: 'Risk Limit' },
  reputation: { de: 'Standing-Ziel', en: 'Standing Target' },
};

let objCounter = 0;

interface Template {
  metric: ObjectiveMetric;
  comparator: 'gte' | 'lte';
  /** target generator given difficulty 0..1 */
  target: (d: number) => number;
  months: number;
}

const TEMPLATES: Template[] = [
  { metric: 'netIrr', comparator: 'gte', target: (d) => 0.08 + d * 0.08, months: 36 },
  { metric: 'aum', comparator: 'gte', target: (d) => 20_000_000 + d * 40_000_000, months: 48 },
  { metric: 'tvpi', comparator: 'gte', target: (d) => 1.3 + d * 0.5, months: 48 },
  { metric: 'maxDrawdown', comparator: 'lte', target: (d) => 0.25 - d * 0.1, months: 36 },
  { metric: 'reputation', comparator: 'gte', target: (d) => 60 + d * 25, months: 36 },
];

/** Build a fresh mandate, scaled by reputation (higher rep ⇒ tougher asks). */
export function generateObjective(rng: Rng, month: number, reputation: number): Objective {
  objCounter += 1;
  const tpl = rng.pick(TEMPLATES);
  const difficulty = Math.max(0, Math.min(1, (reputation - 40) / 60 + rng.range(-0.1, 0.2)));
  const target = tpl.target(difficulty);
  const rewardReputation = 4 + Math.round(difficulty * 6);
  const rewardCapital = tpl.metric === 'maxDrawdown' ? 8_000_000 : Math.round((10_000_000 + difficulty * 25_000_000) / 1e6) * 1e6;
  const penaltyReputation = 5 + Math.round(difficulty * 5);

  return {
    id: `obj-${month}-${objCounter}`,
    title: tr(getLang(), OBJECTIVE_TITLE[tpl.metric]),
    description: describe(tpl.metric, tpl.comparator, target, getLang()),
    metric: tpl.metric,
    target,
    comparator: tpl.comparator,
    deadlineMonth: month + tpl.months,
    status: 'active',
    rewardReputation,
    rewardCapital,
    penaltyReputation,
  };
}

function describe(metric: ObjectiveMetric, comparator: 'gte' | 'lte', target: number, lang: Lang): string {
  const v = formatMetric(metric, target);
  return comparator === 'gte' ? `${tr(lang, METRIC_LABEL[metric])} ≥ ${v}` : `${tr(lang, METRIC_LABEL[metric])} ≤ ${v}`;
}

/** Localised title & description for an objective (re-derivable at render). */
export function localizedObjective(obj: Objective, lang: Lang): { title: string; description: string } {
  return {
    title: tr(lang, OBJECTIVE_TITLE[obj.metric]),
    description: describe(obj.metric, obj.comparator, obj.target, lang),
  };
}

export function formatMetric(metric: ObjectiveMetric, value: number): string {
  switch (metric) {
    case 'netIrr':
      return `${(value * 100).toFixed(0)}%`;
    case 'maxDrawdown':
      return `${(value * 100).toFixed(0)}%`;
    case 'tvpi':
      return `${value.toFixed(2)}x`;
    case 'aum':
      return `$${(value / 1e6).toFixed(0)}M`;
    case 'reputation':
      return value.toFixed(0);
  }
}

/** Current value of a metric for objective evaluation / progress display. */
export function metricValue(state: SimState, metric: ObjectiveMetric): number {
  const nav = portfolioNav(state.portfolio, state.instruments);
  switch (metric) {
    case 'netIrr': {
      const m = fundMetrics(state.fund, nav, state.month);
      return Number.isFinite(m.netIrr) ? m.netIrr : 0;
    }
    case 'tvpi':
      return fundMetrics(state.fund, nav, state.month).tvpi;
    case 'aum':
      return nav;
    case 'maxDrawdown':
      return maxDrawdown(state.portfolio.navHistory);
    case 'reputation':
      return state.reputation;
  }
}

export function isMet(obj: Objective, value: number): boolean {
  return obj.comparator === 'gte' ? value >= obj.target : value <= obj.target;
}

/** Progress toward an objective in [0, 1] for the UI. */
export function objectiveProgress(obj: Objective, value: number): number {
  if (obj.comparator === 'gte') {
    return obj.target > 0 ? Math.max(0, Math.min(1, value / obj.target)) : 1;
  }
  // lte: full when at/under target, falls off as you exceed it.
  return Math.max(0, Math.min(1, 1 - Math.max(0, value - obj.target) / Math.max(0.0001, obj.target)));
}

/* --------------------------------- Score --------------------------------- */

export interface FinalScore {
  score: number;
  grade: string;
}

export function computeScore(state: SimState): FinalScore {
  const start = state.equityHistory[0] ?? 1;
  const enterprise = state.firm.cash + portfolioNav(state.portfolio, state.instruments);
  const growth = enterprise / Math.max(1, start) - 1;
  const m = fundMetrics(state.fund, portfolioNav(state.portfolio, state.instruments), state.month);
  const irr = Number.isFinite(m.netIrr) ? m.netIrr : 0;
  const dd = maxDrawdown(state.portfolio.navHistory);
  const objSucceeded = state.objectives.filter((o) => o.status === 'succeeded').length;

  let score =
    Math.max(-50, growth * 150) +
    Math.max(-60, Math.min(120, irr * 300)) +
    state.reputation * 2 +
    objSucceeded * 40 +
    ((state.fund.generation ?? 1) - 1) * 35 -
    dd * 120;

  if (state.gameOverReason === 'insolvency' || state.gameOverReason === 'reputation' || state.gameOverReason === 'collapse') score -= 150;
  // Harder difficulty multiplies the score (and easier shrinks it).
  score *= difficultyParams(state.difficulty ?? DEFAULT_DIFFICULTY).scoreMult;
  score = Math.max(0, Math.round(score));

  const grade = score >= 620 ? 'S' : score >= 460 ? 'A' : score >= 320 ? 'B' : score >= 190 ? 'C' : score >= 90 ? 'D' : 'F';
  return { score, grade };
}
