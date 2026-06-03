/**
 * Hedge-fund book mechanics: position valuation, leverage, margin calls and
 * the per-quarter mark-to-market that produces the NAV / return series the
 * Sharpe and drawdown calculations consume.
 */
import {
  HedgeFundState,
  HedgePosition,
  MarketAsset,
  PositionSide,
} from '../models/types';
import { maxDrawdown, sharpeRatio, valueAtRisk } from './finance';

/** Force-close threshold: when position equity falls below this fraction of
 *  posted margin the broker issues a margin call and liquidates. */
const MAINTENANCE_MARGIN_RATIO = 0.25;

export function createHedgeFund(startingCash: number): HedgeFundState {
  return {
    cash: startingCash,
    positions: [],
    navHistory: [startingCash],
    returnHistory: [],
    highWaterMark: startingCash,
    marginCalls: 0,
  };
}

/** Mark-to-market profit/loss of a single position at `price`. */
export function positionPnl(pos: HedgePosition, price: number): number {
  const direction = pos.side === 'long' ? 1 : -1;
  return direction * pos.shares * (price - pos.entryPrice);
}

/** Liquidation value of a position = posted margin + current P/L. */
export function positionEquity(pos: HedgePosition, price: number): number {
  return pos.margin + positionPnl(pos, price);
}

/** Current notional exposure (gross) at `price`. */
export function positionNotional(pos: HedgePosition, price: number): number {
  return pos.shares * price;
}

export interface OpenPositionResult {
  ok: boolean;
  error?: string;
  state?: HedgeFundState;
}

/**
 * Open a leveraged long/short position. The fund posts `notional / leverage`
 * as margin from its cash balance.
 */
export function openPosition(
  hf: HedgeFundState,
  asset: MarketAsset,
  side: PositionSide,
  notional: number,
  leverage: number,
  quarter: number,
  idSuffix: string,
): OpenPositionResult {
  if (leverage < 1 || leverage > 5) {
    return { ok: false, error: 'Hebel muss zwischen 1x und 5x liegen.' };
  }
  if (notional <= 0) {
    return { ok: false, error: 'Positionsgröße muss positiv sein.' };
  }
  const margin = notional / leverage;
  if (margin > hf.cash) {
    return { ok: false, error: 'Nicht genug Cash für die geforderte Margin.' };
  }
  const shares = notional / asset.price;
  const position: HedgePosition = {
    id: `pos-${quarter}-${idSuffix}`,
    assetId: asset.id,
    ticker: asset.ticker,
    side,
    shares,
    entryPrice: asset.price,
    leverage,
    margin,
    openedQuarter: quarter,
  };
  return {
    ok: true,
    state: {
      ...hf,
      cash: hf.cash - margin,
      positions: [...hf.positions, position],
    },
  };
}

/** Close a position at `price`, returning margin + P/L to cash. */
export function closePosition(
  hf: HedgeFundState,
  positionId: string,
  price: number,
): HedgeFundState {
  const pos = hf.positions.find((p) => p.id === positionId);
  if (!pos) return hf;
  const proceeds = Math.max(0, positionEquity(pos, price));
  return {
    ...hf,
    cash: hf.cash + proceeds,
    positions: hf.positions.filter((p) => p.id !== positionId),
  };
}

/** Total NAV of the hedge-fund book at current prices. */
export function hedgeFundNav(hf: HedgeFundState, assets: MarketAsset[]): number {
  const priceOf = (assetId: string) => assets.find((a) => a.id === assetId)?.price ?? 0;
  const positionsValue = hf.positions.reduce(
    (acc, p) => acc + Math.max(0, positionEquity(p, priceOf(p.assetId))),
    0,
  );
  return hf.cash + positionsValue;
}

export interface HedgeStepResult {
  state: HedgeFundState;
  marginCalledTickers: string[];
}

/**
 * Mark the book to market for the new quarter's prices, liquidate any
 * positions that breached maintenance margin, and append NAV / return points.
 */
export function stepHedgeFund(hf: HedgeFundState, assets: MarketAsset[]): HedgeStepResult {
  const priceOf = (assetId: string) => assets.find((a) => a.id === assetId)?.price ?? 0;

  let cash = hf.cash;
  let marginCalls = hf.marginCalls;
  const marginCalledTickers: string[] = [];
  const survivors: HedgePosition[] = [];

  for (const pos of hf.positions) {
    const price = priceOf(pos.assetId);
    const equity = positionEquity(pos, price);
    if (equity <= pos.margin * MAINTENANCE_MARGIN_RATIO) {
      // Margin call: liquidate, return whatever equity is left (>= 0).
      cash += Math.max(0, equity);
      marginCalls += 1;
      marginCalledTickers.push(pos.ticker);
    } else {
      survivors.push(pos);
    }
  }

  const positionsValue = survivors.reduce(
    (acc, p) => acc + Math.max(0, positionEquity(p, priceOf(p.assetId))),
    0,
  );
  const nav = cash + positionsValue;

  const prevNav = hf.navHistory[hf.navHistory.length - 1] ?? nav;
  const ret = prevNav > 0 ? nav / prevNav - 1 : 0;

  return {
    state: {
      cash,
      positions: survivors,
      marginCalls,
      navHistory: [...hf.navHistory, nav],
      returnHistory: [...hf.returnHistory, ret],
      highWaterMark: Math.max(hf.highWaterMark, nav),
    },
    marginCalledTickers,
  };
}

/** Convenience bundle of the hedge-fund risk metrics for the UI. */
export function hedgeFundRiskMetrics(hf: HedgeFundState, riskFreeAnnual: number) {
  const nav = hf.navHistory[hf.navHistory.length - 1] ?? 0;
  return {
    sharpe: sharpeRatio(hf.returnHistory, riskFreeAnnual, 4),
    maxDrawdown: maxDrawdown(hf.navHistory),
    var95: valueAtRisk(nav, hf.returnHistory, 0.95),
  };
}
