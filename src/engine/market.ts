/**
 * Equity market simulation.
 *
 * Prices follow Geometric Brownian Motion. Each quarter is one time step of
 * length dt = 0.25 years. Macro conditions tilt the per-asset drift and scale
 * volatility, and rare Black-Swan shocks apply a multiplicative crash.
 */
import { AssetSector, MacroState, MarketAsset } from '../models/types';
import { Rng } from './rng';

const DT = 0.25; // one quarter, in years
const MAX_HISTORY = 80; // 20 years of quarters

interface AssetSeed {
  ticker: string;
  name: string;
  sector: AssetSector;
  price: number;
  drift: number;
  volatility: number;
}

const ASSET_SEEDS: AssetSeed[] = [
  { ticker: 'NOVA', name: 'Nova Compute', sector: 'Tech', price: 120, drift: 0.12, volatility: 0.38 },
  { ticker: 'QBIT', name: 'Qubit Systems', sector: 'Tech', price: 85, drift: 0.15, volatility: 0.45 },
  { ticker: 'MERC', name: 'Mercator Bank', sector: 'Financials', price: 60, drift: 0.07, volatility: 0.26 },
  { ticker: 'AEGS', name: 'Aegis Capital', sector: 'Financials', price: 95, drift: 0.08, volatility: 0.30 },
  { ticker: 'PETRO', name: 'PetroNova', sector: 'Energy', price: 48, drift: 0.05, volatility: 0.34 },
  { ticker: 'HELI', name: 'Helios Power', sector: 'Energy', price: 32, drift: 0.10, volatility: 0.40 },
  { ticker: 'MEDI', name: 'MediCore', sector: 'Healthcare', price: 140, drift: 0.09, volatility: 0.24 },
  { ticker: 'GENE', name: 'GeneTrust', sector: 'Healthcare', price: 72, drift: 0.13, volatility: 0.42 },
  { ticker: 'SHOP', name: 'ShopWave', sector: 'Consumer', price: 55, drift: 0.08, volatility: 0.29 },
  { ticker: 'FORGE', name: 'Forge Industrial', sector: 'Industrials', price: 78, drift: 0.06, volatility: 0.27 },
];

/** Build the initial set of tradeable assets. */
export function createAssets(): MarketAsset[] {
  return ASSET_SEEDS.map((s, i) => ({
    id: `asset-${i}`,
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    price: s.price,
    drift: s.drift,
    volatility: s.volatility,
    priceHistory: [s.price],
  }));
}

/**
 * Sector sensitivity to macro phases. Multiplies the macro drift adjustment so
 * e.g. Energy is cyclical while Healthcare is defensive.
 */
const SECTOR_BETA: Record<AssetSector, number> = {
  Tech: 1.4,
  Financials: 1.2,
  Energy: 1.3,
  Healthcare: 0.6,
  Consumer: 0.9,
  Industrials: 1.1,
};

function macroDriftAdjustment(macro: MacroState, sector: AssetSector): number {
  // Sentiment + growth push drift up; high rates drag it down.
  const base = macro.sentiment * 0.10 + (macro.gdpGrowth - 0.02) * 1.5 - (macro.interestRate - 0.03) * 0.8;
  return base * SECTOR_BETA[sector];
}

function macroVolScale(macro: MacroState): number {
  // Contraction / trough are more volatile; expansion calmer.
  switch (macro.phase) {
    case 'expansion':
      return 0.85;
    case 'peak':
      return 1.0;
    case 'contraction':
      return 1.6;
    case 'trough':
      return 1.3;
  }
}

export interface MarketStepResult {
  assets: MarketAsset[];
  blackSwan: boolean;
}

/**
 * Advance every asset by one quarter. Returns new asset objects (immutably)
 * plus whether a Black-Swan event fired this quarter.
 */
export function stepMarket(assets: MarketAsset[], macro: MacroState, rng: Rng): MarketStepResult {
  // Black-Swan probability is small and elevated near the cycle top/contraction.
  const swanProb = macro.phase === 'peak' || macro.phase === 'contraction' ? 0.06 : 0.015;
  const blackSwan = rng.chance(swanProb);

  const next = assets.map((asset) => {
    const driftAdj = macroDriftAdjustment(macro, asset.sector);
    const mu = asset.drift + driftAdj;
    const sigma = Math.max(0.05, asset.volatility * macroVolScale(macro));

    // GBM exact step: S_{t+dt} = S_t * exp((mu - sigma^2/2)dt + sigma*sqrt(dt)*Z)
    const z = rng.normal();
    let nextPrice = asset.price * Math.exp((mu - (sigma * sigma) / 2) * DT + sigma * Math.sqrt(DT) * z);

    if (blackSwan) {
      // 25%-55% crash, hit cyclical sectors harder.
      const severity = rng.range(0.25, 0.55) * (0.6 + 0.4 * SECTOR_BETA[asset.sector]);
      nextPrice *= 1 - Math.min(0.8, severity);
    }

    nextPrice = Math.max(0.5, nextPrice);
    const history = [...asset.priceHistory, nextPrice].slice(-MAX_HISTORY);

    return { ...asset, price: nextPrice, priceHistory: history };
  });

  return { assets: next, blackSwan };
}
