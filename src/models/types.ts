/**
 * Core data models for "Alpha & Carry".
 *
 * The simulation runs for {@link TOTAL_QUARTERS} quarters (20 years). Every
 * value denominated in money is stored in plain dollars (not thousands /
 * millions) so the finance math stays unambiguous.
 */

export const TOTAL_YEARS = 20;
export const QUARTERS_PER_YEAR = 4;
export const TOTAL_QUARTERS = TOTAL_YEARS * QUARTERS_PER_YEAR;
export const STARTING_CAPITAL = 10_000_000;

/* -------------------------------------------------------------------------- */
/*                                Macro engine                                */
/* -------------------------------------------------------------------------- */

/** The four phases of the business cycle. */
export type MacroPhase = 'expansion' | 'peak' | 'contraction' | 'trough';

export interface MacroState {
  phase: MacroPhase;
  /** How many quarters the economy has spent in the current phase. */
  quartersInPhase: number;
  /** Annualised GDP growth proxy, e.g. 0.03 = 3%. */
  gdpGrowth: number;
  /** Annualised policy rate, e.g. 0.05 = 5%. */
  interestRate: number;
  /** Annualised inflation, e.g. 0.02 = 2%. */
  inflation: number;
  /** Market sentiment in [-1, 1]; drives drift & volatility. */
  sentiment: number;
}

/* -------------------------------------------------------------------------- */
/*                               Hedge fund                                   */
/* -------------------------------------------------------------------------- */

export type AssetSector =
  | 'Tech'
  | 'Financials'
  | 'Energy'
  | 'Healthcare'
  | 'Consumer'
  | 'Industrials';

/** A tradeable instrument the hedge fund can take positions in. */
export interface MarketAsset {
  id: string;
  ticker: string;
  name: string;
  sector: AssetSector;
  price: number;
  /** Annualised drift used by the GBM simulation. */
  drift: number;
  /** Annualised volatility used by the GBM simulation. */
  volatility: number;
  /** Rolling history of quarterly closing prices (oldest first). */
  priceHistory: number[];
}

export type PositionSide = 'long' | 'short';

export interface HedgePosition {
  id: string;
  assetId: string;
  ticker: string;
  side: PositionSide;
  /** Number of shares (always positive; side encodes direction). */
  shares: number;
  /** Average entry price per share. */
  entryPrice: number;
  /** Leverage multiplier applied to this position (1-5x). */
  leverage: number;
  /** Equity (margin) the fund posted to open the position. */
  margin: number;
  openedQuarter: number;
}

export interface HedgeFundState {
  /** Uninvested cash available to the hedge fund book. */
  cash: number;
  positions: HedgePosition[];
  /** Quarterly net asset value history (oldest first). */
  navHistory: number[];
  /** Quarterly simple returns of the book (oldest first). */
  returnHistory: number[];
  /** Highest NAV ever reached — used for drawdown calculations. */
  highWaterMark: number;
  /** Count of margin calls suffered so far (for scoring / flavour). */
  marginCalls: number;
}

/* -------------------------------------------------------------------------- */
/*                                Venture                                     */
/* -------------------------------------------------------------------------- */

export type FundingStage = 'Seed' | 'Series A' | 'Series B' | 'Series C' | 'Pre-IPO';

export type StartupStatus = 'active' | 'exited' | 'failed';

export type ExitType = 'IPO' | 'M&A' | 'Acquihire' | 'Writedown';

export interface CapTableEntry {
  /** Quarter the investment was made. */
  quarter: number;
  stage: FundingStage;
  /** Dollars the fund put in for this entry. */
  invested: number;
  /** Pre-money valuation at the time of the round. */
  preMoneyValuation: number;
  /** Ownership fraction acquired by this specific cheque (0-1). */
  ownership: number;
}

export interface Startup {
  id: string;
  name: string;
  sector: AssetSector;
  stage: FundingStage;
  status: StartupStatus;
  /** Current post-money valuation. */
  valuation: number;
  /** Annualised revenue proxy used for growth/health. */
  revenue: number;
  /** Quarterly burn rate (cash out the door). */
  burnRate: number;
  /** Cash the company has in the bank. */
  runwayCash: number;
  /** Health score in [0, 1]; low health risks failure. */
  health: number;
  /** Quarterly growth rate of valuation/revenue. */
  growthRate: number;
  /** Every cheque the fund has written into this company. */
  capTable: CapTableEntry[];
  /** Total dollars the fund has invested across all rounds. */
  totalInvested: number;
  /** Aggregate fully-diluted ownership the fund holds (0-1). */
  ownership: number;
  foundedQuarter: number;
  /** Set when status becomes 'exited' or 'failed'. */
  exit?: {
    type: ExitType;
    quarter: number;
    /** Gross proceeds returned to the fund from this exit. */
    proceeds: number;
  };
}

export interface VCFundState {
  /** Uninvested dry powder available to the venture book. */
  cash: number;
  portfolio: Startup[];
  /** Cumulative dollars deployed across the life of the fund. */
  totalInvested: number;
  /** Cumulative dollars returned via exits (distributions). */
  totalReturned: number;
  /** Deals currently available to invest in this quarter. */
  dealFlow: Startup[];
}

/* -------------------------------------------------------------------------- */
/*                            Events & reputation                             */
/* -------------------------------------------------------------------------- */

export type GameEventType = 'macro' | 'hedge' | 'vc' | 'blackswan' | 'reputation' | 'info';

export interface GameEvent {
  id: string;
  quarter: number;
  type: GameEventType;
  title: string;
  description: string;
  /** Money impact of the event, if any (positive = gain). */
  impact?: number;
}

/* -------------------------------------------------------------------------- */
/*                               Whole game                                   */
/* -------------------------------------------------------------------------- */

export interface GameState {
  /** Current quarter index, 0-based. quarter 0 = Y1 Q1. */
  quarter: number;
  started: boolean;
  gameOver: boolean;

  macro: MacroState;
  assets: MarketAsset[];
  hedgeFund: HedgeFundState;
  vc: VCFundState;

  /** Reputation in [0, 100]; gates deal quality and LP capital. */
  reputation: number;
  /** Uncalled LP capital the family office can still draw on. */
  lpCapitalAvailable: number;

  /** Combined equity (HF NAV + VC NAV + uninvested) history, oldest first. */
  totalEquityHistory: number[];

  events: GameEvent[];

  /** Deterministic PRNG seed state so runs are reproducible & persistable. */
  rngState: number;
}

/** Aggregate, derived metrics surfaced on the dashboard / charts. */
export interface PortfolioMetrics {
  totalEquity: number;
  hedgeFundNav: number;
  vcNav: number;
  cash: number;
  /** Annualised Sharpe ratio of the hedge fund book. */
  sharpe: number;
  /** Max drawdown of the hedge fund book in [0, 1]. */
  maxDrawdown: number;
  /** 95% one-quarter Value at Risk of the hedge fund book (dollars). */
  var95: number;
  /** Net IRR of the venture book (annualised fraction). */
  vcIrr: number;
  /** Total Value to Paid-In of the venture book. */
  tvpi: number;
  /** Multiple on Invested Capital (realised + unrealised) of the venture book. */
  moic: number;
}
