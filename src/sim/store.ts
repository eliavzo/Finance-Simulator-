/**
 * v2 global store (Zustand) + AsyncStorage persistence.
 *
 * Holds the canonical {@link SimState} and wires player intent (advance the
 * month, trade, hire/fire, upgrade infrastructure, call capital) to the pure
 * engine transitions. A small non-persisted hiring-candidate pool lives
 * alongside the game so the Firm screen has stable rows to hire from.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  Employee,
  FundThesis,
  Infrastructure,
  Instrument,
  OptionInstrument,
  Role,
  Scenario,
  SimState,
} from './types';
import { advanceMonth, createSimGame } from './engine';
import { applyDecision } from './decisions';
import { closePosition, openPosition } from './portfolio';
import { callCapital } from './fund';
import { firmCapabilities, generateCandidate, upgradeCost, MAX_TIER, fairSalary } from './firm';
import { blackScholes, interpolateCurve } from './quant';
import { Rng } from '../engine/rng';

const STORAGE_KEY = 'alpha-carry/sim-v2';

const memoryFallback = new Map<string, string>();
const safeStorage = {
  getItem: async (k: string) => {
    try {
      return await AsyncStorage.getItem(k);
    } catch {
      return memoryFallback.get(k) ?? null;
    }
  },
  setItem: async (k: string, v: string) => {
    try {
      await AsyncStorage.setItem(k, v);
    } catch {
      memoryFallback.set(k, v);
    }
  },
  removeItem: async (k: string) => {
    try {
      await AsyncStorage.removeItem(k);
    } catch {
      memoryFallback.delete(k);
    }
  },
};

export interface ActionResult {
  ok: boolean;
  error?: string;
}

let uiCounter = 0;
const uiRng = new Rng((Date.now() >>> 0) ^ 0x9e3779b9);

interface SimStore {
  game: SimState | null;
  hydrated: boolean;
  /** Non-persisted pool of hire candidates, keyed by role. */
  candidates: Record<string, Employee[]>;
  /** Month whose edition report should be shown (null = none pending). */
  pendingReportMonth: number | null;

  newGame: (opts?: { seed?: number; thesis?: FundThesis; scenario?: Scenario }) => void;
  /** Wipe the current run and return to the front page. */
  resetGame: () => void;
  nextMonth: () => void;
  /** Dismiss the monthly edition report overlay. */
  dismissReport: () => void;
  /** Resolve the pending decision card by choosing an option. */
  resolveDecision: (choiceIndex: number) => void;

  trade: (instrumentId: string, signedQuantity: number, leverage: number) => ActionResult;
  closeTrade: (positionId: string) => ActionResult;
  /** Create & buy a call/put: strikeOffsetPct e.g. +0.05 = 5% OTM call. */
  buyOption: (
    underlyingId: string,
    optionType: 'call' | 'put',
    strikeOffsetPct: number,
    monthsToExpiry: number,
    contracts: number,
  ) => ActionResult;

  refreshCandidates: (role: Role) => void;
  hire: (candidate: Employee) => ActionResult;
  fire: (employeeId: string) => ActionResult;
  upgrade: (track: keyof Infrastructure) => ActionResult;

  callLpCapital: (amount: number) => ActionResult;
}

export const useSimStore = create<SimStore>()(
  persist(
    (set, get) => ({
      game: null,
      hydrated: false,
      candidates: {},
      pendingReportMonth: null,

      newGame: (opts) =>
        set({
          game: createSimGame(opts?.seed, opts?.thesis, opts?.scenario),
          candidates: {},
          pendingReportMonth: null,
        }),

      resetGame: () => set({ game: null, candidates: {}, pendingReportMonth: null }),

      nextMonth: () => {
        const { game } = get();
        if (!game || game.gameOver) return;
        const next = advanceMonth(game);
        set({ game: next, pendingReportMonth: next.month });
      },

      dismissReport: () => set({ pendingReportMonth: null }),

      resolveDecision: (choiceIndex) => {
        const { game } = get();
        if (!game || !game.pendingDecision) return;
        set({ game: applyDecision(game, choiceIndex, uiRng) });
      },

      trade: (instrumentId, signedQuantity, leverage) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein Spiel.' };
        const inst = game.instruments.find((i) => i.id === instrumentId);
        if (!inst) return { ok: false, error: 'Instrument nicht gefunden.' };
        uiCounter += 1;
        const res = openPosition(game.portfolio, inst, signedQuantity, leverage, game.month, String(uiCounter));
        if (!res.ok || !res.portfolio) return { ok: false, error: res.error };
        set({ game: { ...game, portfolio: res.portfolio } });
        return { ok: true };
      },

      closeTrade: (positionId) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein Spiel.' };
        set({ game: { ...game, portfolio: closePosition(game.portfolio, positionId, game.instruments) } });
        return { ok: true };
      },

      buyOption: (underlyingId, optionType, strikeOffsetPct, monthsToExpiry, contracts) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein Spiel.' };
        const underlying = game.instruments.find((i) => i.id === underlyingId);
        if (!underlying || underlying.kind !== 'equity') {
          return { ok: false, error: 'Optionen nur auf Aktien.' };
        }
        if (contracts <= 0) return { ok: false, error: 'Anzahl Kontrakte muss positiv sein.' };
        const multiplier = 100;
        const strike = Math.max(1, Math.round(underlying.price * (1 + strikeOffsetPct)));
        const expiryMonth = game.month + Math.max(1, monthsToExpiry);
        const t = monthsToExpiry / 12;
        const sigma = Math.max(0.1, underlying.vol * (game.economy.volIndex / 16));
        const r = interpolateCurve(game.economy.yieldCurve, Math.max(0.08, t));
        const perShare = blackScholes(optionType, underlying.price, strike, t, r, sigma).price;
        const price = Math.max(0.01, perShare) * multiplier;

        uiCounter += 1;
        const opt: OptionInstrument = {
          id: `opt-${game.month}-${uiCounter}`,
          kind: 'option',
          symbol: `${underlying.symbol} ${optionType === 'call' ? 'C' : 'P'}${strike}`,
          name: `${underlying.symbol} ${optionType} ${strike}`,
          underlyingId,
          optionType,
          strike,
          expiryMonth,
          multiplier,
          price,
          priceHistory: [price],
        };

        const cost = contracts * price;
        if (cost > game.portfolio.cash) return { ok: false, error: 'Nicht genug Cash für die Prämie.' };

        const instruments: Instrument[] = [...game.instruments, opt];
        uiCounter += 1;
        const res = openPosition(game.portfolio, opt, contracts, 1, game.month, String(uiCounter));
        if (!res.ok || !res.portfolio) return { ok: false, error: res.error };
        set({ game: { ...game, instruments, portfolio: res.portfolio } });
        return { ok: true };
      },

      refreshCandidates: (role) => {
        const { game, candidates } = get();
        if (!game) return;
        const pool = Array.from({ length: 3 }, () => generateCandidate(role, game.reputation, uiRng, game.month));
        set({ candidates: { ...candidates, [role]: pool } });
      },

      hire: (candidate) => {
        const { game, candidates } = get();
        if (!game) return { ok: false, error: 'Kein Spiel.' };
        // One-off recruiting fee = 20% of first-year salary.
        const fee = candidate.salary * 0.2;
        if (fee > game.firm.cash) return { ok: false, error: 'Nicht genug GP-Cash für die Einstellungsgebühr.' };
        const firm = {
          ...game.firm,
          cash: game.firm.cash - fee,
          employees: [...game.firm.employees, { ...candidate, hiredMonth: game.month, morale: 75 }],
        };
        const pool = (candidates[candidate.role] ?? []).filter((c) => c.id !== candidate.id);
        set({ game: { ...game, firm }, candidates: { ...candidates, [candidate.role]: pool } });
        return { ok: true };
      },

      fire: (employeeId) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein Spiel.' };
        const firm = { ...game.firm, employees: game.firm.employees.filter((e) => e.id !== employeeId) };
        set({ game: { ...game, firm } });
        return { ok: true };
      },

      upgrade: (track) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein Spiel.' };
        const tier = game.firm.infrastructure[track];
        if (tier >= MAX_TIER) return { ok: false, error: 'Bereits maximale Stufe.' };
        const cost = upgradeCost(track, tier);
        if (cost > game.firm.cash) return { ok: false, error: 'Nicht genug GP-Cash.' };
        const firm = {
          ...game.firm,
          cash: game.firm.cash - cost,
          infrastructure: { ...game.firm.infrastructure, [track]: tier + 1 },
        };
        set({ game: { ...game, firm } });
        return { ok: true };
      },

      callLpCapital: (amount) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein Spiel.' };
        if (amount <= 0) return { ok: false, error: 'Betrag muss positiv sein.' };
        const res = callCapital(game.fund, amount, game.month);
        if (res.called <= 0) return { ok: false, error: 'Kein abrufbares Kapital mehr.' };
        set({
          game: {
            ...game,
            fund: res.fund,
            portfolio: { ...game.portfolio, cash: game.portfolio.cash + res.called },
          },
        });
        return { ok: true };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ game: state.game }),
      onRehydrateStorage: () => () => {
        useSimStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Convenience selector for capabilities (used by several screens). */
export function useCapabilities() {
  const game = useSimStore((s) => s.game);
  if (!game) return null;
  return firmCapabilities(game.firm, game.reputation, game.thesis);
}

export { fairSalary };
