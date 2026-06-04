/**
 * The fund's trading book.
 *
 * Holds leveraged long/short positions across every instrument kind, accrues
 * financing & borrow costs and coupon/dividend income each month, applies the
 * firm's skill (alpha) and risk-control effects, processes margin calls and
 * option expiries, and produces the NAV / return series that risk and
 * accounting consume.
 */
import {
  Instrument,
  PortfolioState,
  Position,
} from './types';
import { FirmCapabilities } from './firm';

export function createPortfolio(cash: number): PortfolioState {
  return {
    cash,
    positions: [],
    navHistory: [cash],
    returnHistory: [],
    highWaterMark: cash,
    marginCalls: 0,
  };
}

const findInstrument = (instruments: Instrument[], id: string) => instruments.find((i) => i.id === id);

/** Mark-to-market P/L of a position at `price`. */
export function positionPnl(pos: Position, price: number): number {
  return pos.quantity * (price - pos.entryPrice) - pos.financingPaid;
}

/** Notional (gross) exposure of a position at `price`. */
export function positionNotional(pos: Position, price: number): number {
  return Math.abs(pos.quantity) * price;
}

/** Liquidation equity of a position = posted margin + P/L. */
export function positionEquity(pos: Position, price: number): number {
  return pos.margin + positionPnl(pos, price);
}

export interface OpenResult {
  ok: boolean;
  error?: string;
  portfolio?: PortfolioState;
}

/**
 * Open a position. `signedQuantity` encodes direction. Options must be bought
 * long and fully paid (leverage 1). Margin posted = notional / leverage.
 */
export function openPosition(
  portfolio: PortfolioState,
  inst: Instrument,
  signedQuantity: number,
  leverage: number,
  month: number,
  idSuffix: string,
): OpenResult {
  if (signedQuantity === 0) return { ok: false, error: 'Menge darf nicht null sein.' };
  if (inst.kind === 'option' && signedQuantity < 0) {
    return { ok: false, error: 'Optionen können nur long gekauft werden.' };
  }
  const effLev = inst.kind === 'option' ? 1 : leverage;
  if (effLev < 1 || effLev > 5) return { ok: false, error: 'Hebel muss zwischen 1x und 5x liegen.' };

  const notional = Math.abs(signedQuantity) * inst.price;
  const margin = notional / effLev;
  if (margin > portfolio.cash) return { ok: false, error: 'Nicht genug Cash für die Margin.' };

  const position: Position = {
    id: `pos-${month}-${idSuffix}`,
    instrumentId: inst.id,
    symbol: inst.symbol,
    kind: inst.kind,
    quantity: signedQuantity,
    entryPrice: inst.price,
    leverage: effLev,
    margin,
    financingPaid: 0,
    openedMonth: month,
  };
  return {
    ok: true,
    portfolio: { ...portfolio, cash: portfolio.cash - margin, positions: [...portfolio.positions, position] },
  };
}

/** Close a position at the current instrument price. */
export function closePosition(portfolio: PortfolioState, positionId: string, instruments: Instrument[]): PortfolioState {
  const pos = portfolio.positions.find((p) => p.id === positionId);
  if (!pos) return portfolio;
  const price = findInstrument(instruments, pos.instrumentId)?.price ?? pos.entryPrice;
  const proceeds = Math.max(0, positionEquity(pos, price));
  return {
    ...portfolio,
    cash: portfolio.cash + proceeds,
    positions: portfolio.positions.filter((p) => p.id !== positionId),
  };
}

/** Total NAV of the book at current prices. */
export function portfolioNav(portfolio: PortfolioState, instruments: Instrument[]): number {
  const value = portfolio.positions.reduce((acc, p) => {
    const price = findInstrument(instruments, p.instrumentId)?.price ?? p.entryPrice;
    return acc + Math.max(0, positionEquity(p, price));
  }, 0);
  return portfolio.cash + value;
}

/** Gross and net dollar exposure of the book. */
export function exposures(portfolio: PortfolioState, instruments: Instrument[]): { gross: number; net: number; longs: number; shorts: number } {
  let longs = 0;
  let shorts = 0;
  for (const p of portfolio.positions) {
    const price = findInstrument(instruments, p.instrumentId)?.price ?? p.entryPrice;
    const notional = p.quantity * price; // signed
    if (notional >= 0) longs += notional;
    else shorts += notional;
  }
  return { gross: longs - shorts, net: longs + shorts, longs, shorts };
}

export interface PortfolioStepContext {
  policyRate: number;
  primeBrokerTier: number;
  capabilities: FirmCapabilities;
  /** Annualised financing/borrow discount from the fund thesis. */
  financingBonus?: number;
}

export interface PortfolioStepResult {
  portfolio: PortfolioState;
  marginCalled: string[];
  financingCost: number;
  income: number;
  alphaPnl: number;
  /** Financing/borrow dollars saved this month vs running with no team. */
  financingSaved: number;
  /** Positions that would have been margin-called without risk control. */
  marginCallsPrevented: number;
}

/**
 * Advance the book one month against fresh prices: accrue financing/borrow
 * costs and coupon/dividend income, apply the firm's alpha, auto-settle expired
 * options, run margin calls (risk capability widens the buffer), and append the
 * NAV / return points.
 */
export function stepPortfolio(
  portfolio: PortfolioState,
  instruments: Instrument[],
  month: number,
  ctx: PortfolioStepContext,
): PortfolioStepResult {
  const { policyRate, primeBrokerTier, capabilities } = ctx;
  const thesisBonus = ctx.financingBonus ?? 0;
  const financingRate = Math.max(0.005, policyRate + 0.01 - primeBrokerTier * 0.002 - capabilities.execution * 0.004 - thesisBonus);
  const shortBorrowRate = Math.max(0.003, 0.006 + 0.012 * (1 - capabilities.execution) - thesisBonus);
  // Baseline rates with *no* execution capability — used to measure what the
  // trading team saved this month.
  const baseFinancingRate = Math.max(0.005, policyRate + 0.01 - primeBrokerTier * 0.002);
  const baseShortRate = Math.max(0.003, 0.006 + 0.012);
  // No-team margin maintenance threshold; risk control lowers the live one.
  const baseMaintenanceRatio = 0.25;
  const maintenanceRatio = baseMaintenanceRatio * (1 - capabilities.risk * 0.5);

  let cash = portfolio.cash;
  let financingTotal = 0;
  let financingBaseline = 0;
  let incomeTotal = 0;
  let marginCalls = portfolio.marginCalls;
  let marginCallsPrevented = 0;
  const marginCalled: string[] = [];
  const survivors: Position[] = [];

  for (const pos of portfolio.positions) {
    const inst = findInstrument(instruments, pos.instrumentId);
    if (!inst) {
      survivors.push(pos);
      continue;
    }
    const price = inst.price;
    const notional = positionNotional(pos, price);

    // --- Financing / borrow cost ---
    let monthCost = 0;
    let monthCostBaseline = 0;
    if (pos.quantity > 0) {
      const borrowed = Math.max(0, notional - pos.margin);
      monthCost += (borrowed * financingRate) / 12;
      monthCostBaseline += (borrowed * baseFinancingRate) / 12;
    } else {
      monthCost += (notional * shortBorrowRate) / 12;
      monthCostBaseline += (notional * baseShortRate) / 12;
    }
    financingBaseline += monthCostBaseline;
    // --- Coupon / dividend income (long receives, short pays) ---
    let monthIncome = 0;
    if (inst.kind === 'bond') {
      monthIncome += (pos.quantity * inst.faceValue * inst.couponRate) / 12;
    } else if (inst.kind === 'equity') {
      monthIncome += (pos.quantity * price * inst.dividendYield) / 12;
    }

    financingTotal += monthCost;
    incomeTotal += monthIncome;
    const updated: Position = { ...pos, financingPaid: pos.financingPaid + monthCost - monthIncome };

    // --- Option expiry auto-settlement ---
    if (inst.kind === 'option' && month >= inst.expiryMonth) {
      cash += Math.max(0, positionEquity(updated, price));
      continue;
    }

    // --- Margin call ---
    const equity = positionEquity(updated, price);
    if (pos.quantity !== 0 && equity <= updated.margin * maintenanceRatio) {
      cash += Math.max(0, equity);
      marginCalls += 1;
      marginCalled.push(updated.symbol);
    } else {
      // Survived — but would it have been called without risk control?
      if (pos.quantity !== 0 && equity <= updated.margin * baseMaintenanceRatio) {
        marginCallsPrevented += 1;
      }
      survivors.push(updated);
    }
  }

  // Idle cash earns the money-market (policy) rate.
  const moneyMarket = Math.max(0, cash) * (policyRate / 12);
  incomeTotal += moneyMarket;

  // Cash flows from income/financing settle to the cash balance.
  cash += incomeTotal - financingTotal;

  // --- Firm alpha on gross exposure (manager skill) ---
  const gross = survivors.reduce((acc, p) => {
    const price = findInstrument(instruments, p.instrumentId)?.price ?? p.entryPrice;
    return acc + positionNotional(p, price);
  }, 0);
  const alphaPnl = capabilities.monthlyAlpha * gross;
  cash += alphaPnl;

  const positionsValue = survivors.reduce((acc, p) => {
    const price = findInstrument(instruments, p.instrumentId)?.price ?? p.entryPrice;
    return acc + Math.max(0, positionEquity(p, price));
  }, 0);
  const nav = cash + positionsValue;
  const prevNav = portfolio.navHistory[portfolio.navHistory.length - 1] ?? nav;
  const ret = prevNav > 0 ? nav / prevNav - 1 : 0;

  return {
    portfolio: {
      cash,
      positions: survivors,
      marginCalls,
      navHistory: [...portfolio.navHistory, nav],
      returnHistory: [...portfolio.returnHistory, ret],
      highWaterMark: Math.max(portfolio.highWaterMark, nav),
    },
    marginCalled,
    financingCost: financingTotal,
    income: incomeTotal,
    alphaPnl,
    financingSaved: Math.max(0, financingBaseline - financingTotal),
    marginCallsPrevented,
  };
}
