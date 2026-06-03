/**
 * Global game store (Zustand) with AsyncStorage persistence.
 *
 * The store holds the canonical {@link GameState} and exposes the player
 * actions (open/close positions, invest, advance the quarter, draw LP capital,
 * rebalance cash). All heavy logic lives in the engine; the store just wires
 * player intent to engine transitions and persists the result.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { GameState, PositionSide } from '../models/types';
import { advanceQuarter, createNewGame } from '../engine/gameEngine';
import { closePosition, openPosition } from '../engine/hedgefund';
import { investInDeal } from '../engine/vc';

const STORAGE_KEY = 'alpha-carry/save-v1';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface GameStore {
  game: GameState | null;
  /** Hydration flag so the UI can show a splash until persistence resolves. */
  hydrated: boolean;

  newGame: (seed?: number) => void;
  nextQuarter: () => void;

  openHedgePosition: (
    assetId: string,
    side: PositionSide,
    notional: number,
    leverage: number,
  ) => ActionResult;
  closeHedgePosition: (positionId: string) => ActionResult;

  investVC: (dealId: string, amount: number) => ActionResult;

  /** Move cash between the hedge fund and venture books (synergy lever). */
  transferCash: (from: 'hedge' | 'vc', amount: number) => ActionResult;
  /** Draw uncalled LP capital, allocating it to the chosen book. */
  drawLpCapital: (amount: number, to: 'hedge' | 'vc') => ActionResult;
}

let posIdCounter = 0;

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      hydrated: false,

      newGame: (seed) => set({ game: createNewGame(seed) }),

      nextQuarter: () => {
        const { game } = get();
        if (!game || game.gameOver) return;
        set({ game: advanceQuarter(game) });
      },

      openHedgePosition: (assetId, side, notional, leverage) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein aktives Spiel.' };
        const asset = game.assets.find((a) => a.id === assetId);
        if (!asset) return { ok: false, error: 'Asset nicht gefunden.' };
        posIdCounter += 1;
        const res = openPosition(
          game.hedgeFund,
          asset,
          side,
          notional,
          leverage,
          game.quarter,
          String(posIdCounter),
        );
        if (!res.ok || !res.state) return { ok: false, error: res.error };
        set({ game: { ...game, hedgeFund: res.state } });
        return { ok: true };
      },

      closeHedgePosition: (positionId) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein aktives Spiel.' };
        const pos = game.hedgeFund.positions.find((p) => p.id === positionId);
        if (!pos) return { ok: false, error: 'Position nicht gefunden.' };
        const price = game.assets.find((a) => a.id === pos.assetId)?.price ?? pos.entryPrice;
        const hf = closePosition(game.hedgeFund, positionId, price);
        set({ game: { ...game, hedgeFund: hf } });
        return { ok: true };
      },

      investVC: (dealId, amount) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein aktives Spiel.' };
        const res = investInDeal(game.vc, dealId, amount, game.quarter);
        if (!res.ok || !res.state) return { ok: false, error: res.error };
        set({ game: { ...game, vc: res.state } });
        return { ok: true };
      },

      transferCash: (from, amount) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein aktives Spiel.' };
        if (amount <= 0) return { ok: false, error: 'Betrag muss positiv sein.' };
        if (from === 'hedge') {
          if (amount > game.hedgeFund.cash) return { ok: false, error: 'Nicht genug HF-Cash.' };
          set({
            game: {
              ...game,
              hedgeFund: { ...game.hedgeFund, cash: game.hedgeFund.cash - amount },
              vc: { ...game.vc, cash: game.vc.cash + amount },
            },
          });
        } else {
          if (amount > game.vc.cash) return { ok: false, error: 'Nicht genug VC-Cash.' };
          set({
            game: {
              ...game,
              vc: { ...game.vc, cash: game.vc.cash - amount },
              hedgeFund: { ...game.hedgeFund, cash: game.hedgeFund.cash + amount },
            },
          });
        }
        return { ok: true };
      },

      drawLpCapital: (amount, to) => {
        const { game } = get();
        if (!game) return { ok: false, error: 'Kein aktives Spiel.' };
        if (amount <= 0) return { ok: false, error: 'Betrag muss positiv sein.' };
        if (amount > game.lpCapitalAvailable) {
          return { ok: false, error: 'Mehr als das abrufbare LP-Kapital.' };
        }
        const remaining = game.lpCapitalAvailable - amount;
        if (to === 'hedge') {
          set({
            game: {
              ...game,
              lpCapitalAvailable: remaining,
              hedgeFund: { ...game.hedgeFund, cash: game.hedgeFund.cash + amount },
            },
          });
        } else {
          set({
            game: {
              ...game,
              lpCapitalAvailable: remaining,
              vc: { ...game.vc, cash: game.vc.cash + amount },
            },
          });
        }
        return { ok: true };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ game: state.game }),
      onRehydrateStorage: () => (state) => {
        // Flip the hydration flag once persistence has loaded (or failed).
        useGameStore.setState({ hydrated: true });
        return state;
      },
    },
  ),
);
