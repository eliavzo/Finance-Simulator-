/**
 * Macro-economic cycle engine.
 *
 * Models the classic four-phase business cycle as a stochastic state machine:
 *
 *   expansion -> peak -> contraction -> trough -> expansion ...
 *
 * Each phase has a typical duration; the probability of transitioning rises
 * the longer we have been in a phase. Phase determines GDP growth, rates,
 * inflation and a sentiment proxy that the market and venture models read.
 */
import { MacroPhase, MacroState } from '../models/types';
import { Rng } from './rng';

export function createMacroState(): MacroState {
  return {
    phase: 'expansion',
    quartersInPhase: 0,
    gdpGrowth: 0.03,
    interestRate: 0.03,
    inflation: 0.02,
    sentiment: 0.3,
  };
}

const NEXT_PHASE: Record<MacroPhase, MacroPhase> = {
  expansion: 'peak',
  peak: 'contraction',
  contraction: 'trough',
  trough: 'expansion',
};

/** Typical length of each phase, in quarters. */
const TYPICAL_DURATION: Record<MacroPhase, number> = {
  expansion: 12,
  peak: 3,
  contraction: 4,
  trough: 3,
};

/** Baseline economic readings for each phase (annualised). */
const PHASE_TARGETS: Record<MacroPhase, { gdp: number; rate: number; inflation: number; sentiment: number }> = {
  expansion: { gdp: 0.035, rate: 0.03, inflation: 0.02, sentiment: 0.5 },
  peak: { gdp: 0.02, rate: 0.055, inflation: 0.045, sentiment: 0.15 },
  contraction: { gdp: -0.025, rate: 0.04, inflation: 0.03, sentiment: -0.6 },
  trough: { gdp: -0.005, rate: 0.015, inflation: 0.01, sentiment: -0.2 },
};

/** Advance the macro state by one quarter, possibly transitioning phase. */
export function stepMacro(macro: MacroState, rng: Rng): MacroState {
  const typical = TYPICAL_DURATION[macro.phase];
  // Hazard rises with time in phase; ~50% per quarter once at typical length.
  const transitionProb = Math.min(0.95, (macro.quartersInPhase / typical) * 0.5);

  let phase = macro.phase;
  let quartersInPhase = macro.quartersInPhase + 1;
  if (macro.quartersInPhase >= 1 && rng.chance(transitionProb)) {
    phase = NEXT_PHASE[macro.phase];
    quartersInPhase = 0;
  }

  // Drift the readings toward the phase target with a little noise so no two
  // expansions look identical.
  const target = PHASE_TARGETS[phase];
  const adapt = (current: number, goal: number, noise: number) =>
    current + (goal - current) * 0.4 + rng.normal(0, noise);

  return {
    phase,
    quartersInPhase,
    gdpGrowth: adapt(macro.gdpGrowth, target.gdp, 0.004),
    interestRate: Math.max(0, adapt(macro.interestRate, target.rate, 0.003)),
    inflation: Math.max(-0.01, adapt(macro.inflation, target.inflation, 0.003)),
    sentiment: Math.max(-1, Math.min(1, adapt(macro.sentiment, target.sentiment, 0.08))),
  };
}

export const PHASE_LABEL: Record<MacroPhase, string> = {
  expansion: 'Expansion',
  peak: 'Hochkonjunktur',
  contraction: 'Kontraktion',
  trough: 'Rezession',
};

export const PHASE_DESCRIPTION: Record<MacroPhase, string> = {
  expansion: 'Wachstum zieht an, Risikoappetit steigt, günstige Finanzierung.',
  peak: 'Überhitzung: hohe Zinsen, teure Bewertungen, erhöhtes Crash-Risiko.',
  contraction: 'Abschwung: fallende Märkte, Down-Rounds, Margin-Druck.',
  trough: 'Bodenbildung: günstige Einstiege, aber schwache Stimmung.',
};
