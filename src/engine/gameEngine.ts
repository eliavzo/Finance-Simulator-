/**
 * Top-level game engine.
 *
 * Owns the canonical {@link GameState}, the rules for creating a new game, and
 * the master `advanceQuarter` transition that steps the macro engine, market,
 * hedge fund and venture book in the correct order and reconciles reputation,
 * LP capital, events and the combined equity series.
 */
import {
  GameEvent,
  GameState,
  STARTING_CAPITAL,
  TOTAL_QUARTERS,
} from '../models/types';
import { createAssets, stepMarket } from './market';
import { createMacroState, PHASE_LABEL, stepMacro } from './macro';
import {
  createHedgeFund,
  hedgeFundNav,
  stepHedgeFund,
} from './hedgefund';
import {
  createVCFund,
  refreshDealFlow,
  stepVCFund,
  vcResidualValue,
} from './vc';
import {
  clampReputation,
  lpCapitalForReputation,
  reputationDelta,
  STARTING_REPUTATION,
} from './reputation';
import { Rng } from './rng';

let eventCounter = 0;
function makeEvent(quarter: number, ev: Omit<GameEvent, 'id' | 'quarter'>): GameEvent {
  eventCounter += 1;
  return { id: `ev-${quarter}-${eventCounter}`, quarter, ...ev };
}

/** Human-readable label for a 0-based quarter index, e.g. "J3 Q2". */
export function quarterLabel(quarter: number): string {
  const year = Math.floor(quarter / 4) + 1;
  const q = (quarter % 4) + 1;
  return `J${year} Q${q}`;
}

/** Split starting capital: half to each book is a sane default the player can rebalance. */
export function createNewGame(seed = Date.now()): GameState {
  eventCounter = 0;
  const rng = new Rng(seed);
  const macro = createMacroState();
  const assets = createAssets();

  const hfCash = STARTING_CAPITAL * 0.5;
  const vcCash = STARTING_CAPITAL * 0.5;

  const vc = createVCFund(vcCash);
  vc.dealFlow = refreshDealFlow(rng, 0, STARTING_REPUTATION);

  return {
    quarter: 0,
    started: true,
    gameOver: false,
    macro,
    assets,
    hedgeFund: createHedgeFund(hfCash),
    vc,
    reputation: STARTING_REPUTATION,
    lpCapitalAvailable: 0,
    totalEquityHistory: [STARTING_CAPITAL],
    events: [
      makeEvent(0, {
        type: 'info',
        title: 'Family Office gegründet',
        description: `Du startest mit $${(STARTING_CAPITAL / 1e6).toFixed(0)}M über 20 Jahre. Viel Erfolg, Allocator.`,
      }),
    ],
    rngState: rng.getState(),
  };
}

/** Total combined equity across both books and uninvested cash. */
export function totalEquity(state: GameState): number {
  const hfNav = hedgeFundNav(state.hedgeFund, state.assets);
  const vcNav = state.vc.cash + vcResidualValue(state.vc);
  return hfNav + vcNav;
}

/**
 * Advance the simulation by one quarter and return a *new* GameState. Pure with
 * respect to the input (does not mutate `state`).
 */
export function advanceQuarter(state: GameState): GameState {
  if (state.gameOver) return state;

  const rng = new Rng(state.rngState);
  const newQuarter = state.quarter + 1;
  const events: GameEvent[] = [];

  const equityBefore = totalEquity(state);

  // 1. Macro engine ---------------------------------------------------------
  const prevPhase = state.macro.phase;
  const macro = stepMacro(state.macro, rng);
  if (macro.phase !== prevPhase) {
    events.push(
      makeEvent(newQuarter, {
        type: 'macro',
        title: `Konjunkturwende: ${PHASE_LABEL[macro.phase]}`,
        description: `Die Wirtschaft tritt in die Phase "${PHASE_LABEL[macro.phase]}" ein. BIP ${(macro.gdpGrowth * 100).toFixed(1)}%, Zins ${(macro.interestRate * 100).toFixed(1)}%.`,
      }),
    );
  }

  // 2. Market simulation ----------------------------------------------------
  const { assets, blackSwan } = stepMarket(state.assets, macro, rng);
  if (blackSwan) {
    events.push(
      makeEvent(newQuarter, {
        type: 'blackswan',
        title: '🦢 Black-Swan-Ereignis!',
        description: 'Ein extremer Schock erschüttert die Märkte. Kurse brechen ein, Hebelpositionen sind in Gefahr.',
      }),
    );
  }

  // 3. Hedge fund mark-to-market & margin calls -----------------------------
  const hfStep = stepHedgeFund(state.hedgeFund, assets);
  if (hfStep.marginCalledTickers.length > 0) {
    events.push(
      makeEvent(newQuarter, {
        type: 'hedge',
        title: 'Margin Call',
        description: `Zwangsliquidation: ${hfStep.marginCalledTickers.join(', ')}. Hebel kann tödlich sein.`,
      }),
    );
  }

  // 4. Venture book evolution ----------------------------------------------
  const vcStep = stepVCFund(state.vc, macro, rng, newQuarter);
  let exits = 0;
  let failures = 0;
  for (const note of vcStep.notes) {
    const isExit = note.includes('Exit');
    const isFail = note.includes('gescheitert');
    if (isExit) exits += 1;
    if (isFail) failures += 1;
    events.push(
      makeEvent(newQuarter, {
        type: 'vc',
        title: isExit ? 'VC Exit' : isFail ? 'Portfolio-Verlust' : 'Finanzierungsrunde',
        description: note,
      }),
    );
  }

  // Refresh deal flow for the new quarter using post-step reputation later;
  // use current reputation as the gate (updated below for next round).
  let vc = vcStep.state;

  // 5. Reputation & LP capital ---------------------------------------------
  const intermediate: GameState = {
    ...state,
    quarter: newQuarter,
    macro,
    assets,
    hedgeFund: hfStep.state,
    vc,
  };
  const equityAfter = totalEquity(intermediate);
  const quarterReturn = equityBefore > 0 ? equityAfter / equityBefore - 1 : 0;

  const repDelta = reputationDelta({
    quarterReturn,
    marginCalls: hfStep.marginCalledTickers.length,
    exits,
    failures,
    blackSwanSurvived: blackSwan,
  });
  const reputation = clampReputation(state.reputation + repDelta);
  const lpCapitalAvailable = lpCapitalForReputation(reputation);
  if (lpCapitalAvailable > state.lpCapitalAvailable) {
    events.push(
      makeEvent(newQuarter, {
        type: 'reputation',
        title: 'LP-Kapital freigeschaltet',
        description: `Deine Reputation (${reputation.toFixed(0)}) zieht Investoren an: $${(lpCapitalAvailable / 1e6).toFixed(1)}M abrufbares LP-Kapital.`,
      }),
    );
  }

  // Now refresh deal flow with the updated reputation.
  vc = { ...vc, dealFlow: refreshDealFlow(rng, newQuarter, reputation) };

  const gameOver = newQuarter >= TOTAL_QUARTERS;
  if (gameOver) {
    events.push(
      makeEvent(newQuarter, {
        type: 'info',
        title: 'Spielende',
        description: `Nach 20 Jahren schließt das Family Office mit $${(equityAfter / 1e6).toFixed(1)}M Gesamtvermögen.`,
      }),
    );
  }

  return {
    ...intermediate,
    vc,
    reputation,
    lpCapitalAvailable,
    gameOver,
    totalEquityHistory: [...state.totalEquityHistory, equityAfter],
    // Keep the most recent ~40 events to bound persisted size.
    events: [...events, ...state.events].slice(0, 60),
    rngState: rng.getState(),
  };
}
