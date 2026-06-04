/**
 * v2 simulation data model — "Alpha & Carry: The Firm".
 *
 * A monthly-tick economic simulation of running a fund-management business.
 * Three nested layers:
 *   1. The Economy   — yield curve, FX, credit, regime (exogenous world).
 *   2. The Fund      — LP capital, multi-instrument portfolio, fees & carry.
 *   3. The Firm (GP) — employees, infrastructure, opex; earns fees + carry.
 *
 * All monetary values are plain dollars. Time is measured in months; month 0 is
 * Year 1 / Month 1 (January of year 1).
 */

export const SIM_YEARS = 20;
export const MONTHS_PER_YEAR = 12;
export const TOTAL_MONTHS = SIM_YEARS * MONTHS_PER_YEAR;

/* -------------------------------------------------------------------------- */
/*                                  Economy                                   */
/* -------------------------------------------------------------------------- */

export type Regime = 'expansion' | 'peak' | 'contraction' | 'trough';

/** Investment style chosen at launch; tilts capabilities & edge. */
export type FundThesis = 'quant' | 'macro' | 'longshort' | 'credit' | 'multistrat';

/** Macro backdrop the game opens in. */
export type Scenario = 'normal' | 'boom' | 'precrisis' | 'dotcom' | 'stagflation';

export interface YieldCurveKnot {
  /** Tenor in years (0.25, 1, 2, 5, 10, 30…). */
  tenor: number;
  /** Annual zero rate. */
  rate: number;
}

export interface EconomyState {
  regime: Regime;
  monthsInRegime: number;
  /** Annualised real GDP growth. */
  gdpGrowth: number;
  /** Annualised CPI inflation. */
  inflation: number;
  /** Central-bank policy rate (annual). */
  policyRate: number;
  /** Sovereign zero curve. */
  yieldCurve: YieldCurveKnot[];
  /** Investment-grade credit spread over govvies (annual). */
  igSpread: number;
  /** High-yield credit spread over govvies (annual). */
  hySpread: number;
  /** Implied-vol level proxy (VIX-like), e.g. 18 = 18%. */
  volIndex: number;
  /** Risk sentiment in [-1, 1]. */
  sentiment: number;
  /** USD index level (100 = base); FX pairs quote off this. */
  usdIndex: number;
}

/* -------------------------------------------------------------------------- */
/*                                Instruments                                 */
/* -------------------------------------------------------------------------- */

export type Sector =
  | 'Tech'
  | 'Financials'
  | 'Energy'
  | 'Healthcare'
  | 'Consumer'
  | 'Industrials';

export type InstrumentKind = 'equity' | 'bond' | 'fx' | 'commodity' | 'option';

/** Common fields every tradeable instrument shares. */
interface InstrumentBase {
  id: string;
  kind: InstrumentKind;
  symbol: string;
  name: string;
  /** Current price (per unit / per 100 face for bonds / premium for options). */
  price: number;
  /** Rolling price history (oldest first), bounded length. */
  priceHistory: number[];
}

export interface EquityInstrument extends InstrumentBase {
  kind: 'equity';
  sector: Sector;
  /** Earnings per share (annual) — the fundamental that drives fair value. */
  eps: number;
  /** Expected annual earnings growth. */
  epsGrowth: number;
  /** Profit margin (flavour / quality signal). */
  margin: number;
  /** Model fair value per share, recomputed each month from eps & rates. */
  fairValue: number;
  /** Annualised idiosyncratic volatility. */
  vol: number;
  /** Continuous dividend yield. */
  dividendYield: number;
  /** Sensitivity to the broad market factor. */
  beta: number;
}

export type CreditRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B';

export interface BondInstrument extends InstrumentBase {
  kind: 'bond';
  issuer: string;
  sector: Sector | 'Government';
  couponRate: number;
  /** Constant maturity in years — bonds are modelled as a constant-maturity
   *  index repriced off the curve each month (no settlement/rollover). */
  maturityYears: number;
  faceValue: number;
  rating: CreditRating;
  /** Current yield to maturity (annual). */
  ytm: number;
  couponsPerYear: number;
}

export interface FxInstrument extends InstrumentBase {
  kind: 'fx';
  /** e.g. 'EUR/USD'. price = units of USD per 1 unit of base. */
  base: string;
  quote: string;
  /** Annualised volatility. */
  vol: number;
  /** Carry differential (base rate − quote rate), drives drift. */
  carry: number;
}

export interface CommodityInstrument extends InstrumentBase {
  kind: 'commodity';
  drift: number;
  vol: number;
  /** How strongly it tracks the economic cycle. */
  cyclicality: number;
}

export interface OptionInstrument extends InstrumentBase {
  kind: 'option';
  underlyingId: string;
  optionType: 'call' | 'put';
  strike: number;
  /** Absolute month index of expiry. */
  expiryMonth: number;
  /** Shares per contract (price quoted per share). */
  multiplier: number;
}

export type Instrument =
  | EquityInstrument
  | BondInstrument
  | FxInstrument
  | CommodityInstrument
  | OptionInstrument;

/* -------------------------------------------------------------------------- */
/*                                 Portfolio                                  */
/* -------------------------------------------------------------------------- */

export interface Position {
  id: string;
  instrumentId: string;
  symbol: string;
  kind: InstrumentKind;
  /** Signed quantity: + long, − short. */
  quantity: number;
  /** Average entry price. */
  entryPrice: number;
  /** Leverage applied at open (1 = unlevered). */
  leverage: number;
  /** Equity (margin) the fund posted to open the position. */
  margin: number;
  /** Cumulative financing / borrow cost paid to date. */
  financingPaid: number;
  openedMonth: number;
}

export interface PortfolioState {
  /** Cash held inside the fund available for new positions. */
  cash: number;
  positions: Position[];
  /** Net asset value history (oldest first). */
  navHistory: number[];
  /** Monthly simple returns of the fund book. */
  returnHistory: number[];
  highWaterMark: number;
  marginCalls: number;
}

/* -------------------------------------------------------------------------- */
/*                                  The Firm                                  */
/* -------------------------------------------------------------------------- */

export type Role =
  | 'Analyst'
  | 'Trader'
  | 'PortfolioManager'
  | 'Quant'
  | 'RiskManager'
  | 'InvestorRelations'
  | 'COO';

export interface Employee {
  id: string;
  name: string;
  role: Role;
  /** Skill in [0, 100]. */
  skill: number;
  /** Annual salary (dollars). */
  salary: number;
  /** Morale in [0, 100]; low morale risks attrition & cuts productivity. */
  morale: number;
  hiredMonth: number;
}

/** Upgradeable infrastructure tiers (0 = none). Higher tiers cost more opex. */
export interface Infrastructure {
  /** Market data & research (improves signal quality / sourcing). */
  dataTier: number;
  /** Prime broker (cheaper financing & borrow, more leverage headroom). */
  primeBrokerTier: number;
  /** Quant/tech stack (better risk model & execution, less slippage). */
  quantTier: number;
  /** Office & ops (raises morale capacity / headcount comfort). */
  officeTier: number;
}

export interface FirmState {
  name: string;
  /** Management-company (GP) cash — distinct from fund cash. */
  cash: number;
  employees: Employee[];
  infrastructure: Infrastructure;
  /** Cumulative management fees earned by the GP. */
  feesEarned: number;
  /** Cumulative carried interest crystallised to the GP. */
  carryEarned: number;
}

/* -------------------------------------------------------------------------- */
/*                                   Fund                                     */
/* -------------------------------------------------------------------------- */

export type LPType = 'Pension' | 'Endowment' | 'FamilyOffice' | 'SovereignWealth' | 'FundOfFunds';

export interface LimitedPartner {
  id: string;
  name: string;
  type: LPType;
  /** Total dollars committed to the fund. */
  committed: number;
  /** Dollars actually called/funded so far. */
  called: number;
  /** Dollars distributed back to this LP. */
  distributed: number;
  /** Annual net return this LP expects; chronic underperformance => redemption. */
  expectedReturn: number;
  /** Patience in [0, 1]; lower means quicker to redeem when disappointed. */
  patience: number;
  /** True once the LP has redeemed / wound down. */
  redeemed: boolean;
}

export interface FundState {
  vintageMonth: number;
  /** Total LP commitments. */
  committed: number;
  /** Capital called from LPs to date. */
  called: number;
  /** Distributions paid to LPs to date. */
  distributed: number;
  lps: LimitedPartner[];
  /** Annual management-fee rate (on committed during investment period). */
  mgmtFeeRate: number;
  /** Carried-interest rate over the hurdle. */
  carryRate: number;
  /** Annual preferred return (hurdle) before carry accrues. */
  hurdleRate: number;
  /** High-water mark of fund NAV for carry crystallisation. */
  highWaterMark: number;
  /** Carry accrued but not yet crystallised. */
  accruedCarry: number;
  /** LP-perspective dated cash flows (contributions −, distributions +) in
   *  years from vintage; used for net-IRR. */
  cashflows: { t: number; amount: number }[];
  /** Month index of the last annual performance-fee crystallisation. */
  lastCarryMonth: number;
}

/* -------------------------------------------------------------------------- */
/*                              Accounting / ledger                           */
/* -------------------------------------------------------------------------- */

export type LedgerAccount =
  | 'mgmtFeeRevenue'
  | 'carryRevenue'
  | 'salaries'
  | 'infraOpex'
  | 'financingCost'
  | 'tradingPnLRealized'
  | 'tradingPnLUnrealized'
  | 'couponIncome'
  | 'dividendIncome'
  | 'tax';

export interface LedgerEntry {
  month: number;
  account: LedgerAccount;
  amount: number; // signed: revenue/income +, expense −
  memo?: string;
}

/** A period (monthly) income statement for the GP management company. */
export interface IncomeStatement {
  month: number;
  mgmtFeeRevenue: number;
  carryRevenue: number;
  salaries: number;
  infraOpex: number;
  otherExpense: number;
  tax: number;
  netIncome: number;
}

/** A point-in-time balance sheet (GP + fund consolidated view). */
export interface BalanceSheet {
  month: number;
  // Assets
  fundCash: number;
  firmCash: number;
  positionsValue: number;
  // Liabilities
  borrowings: number;
  accruedCarry: number;
  // Equity
  lpCapital: number;
  gpEquity: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

/* -------------------------------------------------------------------------- */
/*                                Events                                      */
/* -------------------------------------------------------------------------- */

export type SimEventType =
  | 'economy'
  | 'market'
  | 'firm'
  | 'fund'
  | 'risk'
  | 'blackswan'
  | 'info';

export interface SimEvent {
  id: string;
  month: number;
  type: SimEventType;
  title: string;
  description: string;
  impact?: number;
}

/* -------------------------------------------------------------------------- */
/*                          Research & team output                            */
/* -------------------------------------------------------------------------- */

/** A research call on an instrument produced by the analyst/quant team. */
export interface ResearchSignal {
  instrumentId: string;
  symbol: string;
  /** 'overweight' = the team thinks it will outperform (lean long). */
  stance: 'overweight' | 'underweight';
  /** Conviction in [0, 1] — higher with a stronger research team. */
  conviction: number;
  /** Short rationale shown to the player. */
  note: string;
}

/** What the firm's people measurably contributed this month. */
export interface TeamContribution {
  /** Dollars of alpha the book earned from manager skill. */
  alphaPnl: number;
  /** Financing/borrow dollars saved vs. running with no team. */
  financingSaved: number;
  /** Forced liquidations avoided thanks to risk control. */
  marginCallsPrevented: number;
  /** LP commitments raised this month (fundraising). */
  capitalRaised: number;
}

/* -------------------------------------------------------------------------- */
/*                            Objectives / mandates                           */
/* -------------------------------------------------------------------------- */

export type ObjectiveMetric = 'netIrr' | 'tvpi' | 'aum' | 'maxDrawdown' | 'reputation';

export interface Objective {
  id: string;
  title: string;
  description: string;
  metric: ObjectiveMetric;
  target: number;
  /** 'gte' = must reach at least target; 'lte' = must stay at/below target. */
  comparator: 'gte' | 'lte';
  deadlineMonth: number;
  status: 'active' | 'succeeded' | 'failed';
  rewardReputation: number;
  /** LP commitment added on success. */
  rewardCapital: number;
  penaltyReputation: number;
}

export type GameOverReason = 'horizon' | 'insolvency' | 'reputation';

/** A multi-month market crisis. */
export type CrisisType = 'creditCrunch' | 'liquidityFreeze' | 'shortSqueeze' | 'ratesShock';
export interface Crisis {
  type: CrisisType;
  label: string;
  monthsRemaining: number;
  /** Severity in (0, 1]. */
  severity: number;
}

/** Tail-risk hedge / portfolio insurance the player can buy. */
export interface Hedge {
  /** Notional covered; payout scales with this in a crash. */
  notional: number;
  monthsRemaining: number;
}

/** An AI competitor fund. */
export interface RivalFund {
  id: string;
  name: string;
  thesis: FundThesis;
  aum: number;
  /** Skill in [0, 1], drives their alpha. */
  skill: number;
  reputation: number;
  /** Trailing 12-month return for the league table. */
  ytdReturn: number;
  /** Recent monthly returns (oldest first, bounded to 12). */
  monthlyReturns: number[];
}

/** A single instrument's move over the month. */
export interface MarketMover {
  symbol: string;
  kind: InstrumentKind;
  changePct: number;
  price: number;
}

/* -------------------------------------------------------------------------- */
/*                              Decision cards                                 */
/* -------------------------------------------------------------------------- */

/** Numeric effects a decision choice applies. */
export interface DecisionEffect {
  /** GP cash delta. */
  cash?: number;
  /** Fund (portfolio) cash delta. */
  fundCash?: number;
  reputation?: number;
  /** LP commitment added (new sovereign LP). */
  committed?: number;
  /** Delta applied to every employee's morale. */
  morale?: number;
}

export interface DecisionChoice {
  label: string;
  description: string;
  effect: DecisionEffect;
}

export interface DecisionCard {
  id: string;
  title: string;
  body: string;
  choices: DecisionChoice[];
}

/** End-of-month "edition" report summarising everything that changed. */
export interface MonthlyReport {
  month: number;
  enterpriseStart: number;
  enterpriseEnd: number;
  enterpriseChangePct: number;
  fundNav: number;
  fundReturnPct: number;
  gpNetIncome: number;
  contribution: TeamContribution;
  reputationDelta: number;
  regime: Regime;
  regimeChanged: boolean;
  policyRate: number;
  volIndex: number;
  blackSwan: boolean;
  gainers: MarketMover[];
  losers: MarketMover[];
  headlines: { type: SimEventType; title: string; description: string }[];
}

/* -------------------------------------------------------------------------- */
/*                              Whole sim state                               */
/* -------------------------------------------------------------------------- */

export interface SimState {
  month: number;
  started: boolean;
  gameOver: boolean;

  thesis: FundThesis;
  scenario: Scenario;

  economy: EconomyState;
  instruments: Instrument[];
  portfolio: PortfolioState;
  firm: FirmState;
  fund: FundState;

  /** Active multi-month crisis, if any. */
  crisis?: Crisis;
  /** Active tail-risk hedge, if any. */
  hedge?: Hedge;

  /** Reputation in [0, 100]; gates LP capital, talent and deal quality. */
  reputation: number;
  /** Highest reputation ever reached — drives sticky tier perks/unlocks. */
  peakReputation: number;
  /** Unlocked achievement ids with the month they were earned. */
  achievements: { id: string; month: number }[];

  /** AI competitor funds for the league table. */
  rivals: RivalFund[];
  /** Active & resolved LP mandates / objectives. */
  objectives: Objective[];
  /** Why the game ended (set once gameOver is true). */
  gameOverReason?: GameOverReason;
  /** Final score & grade, computed at game over. */
  finalScore?: number;
  finalGrade?: string;

  /** Current research calls from the analyst/quant team. */
  signals: ResearchSignal[];
  /** What the team contributed in the most recent month. */
  lastContribution: TeamContribution;
  /** End-of-month edition report (undefined before the first month elapses). */
  lastReport?: MonthlyReport;
  /** A decision awaiting the player's choice (blocks nothing; shown as a modal). */
  pendingDecision?: DecisionCard;

  /** Recent monthly income statements (most recent first, bounded). */
  incomeStatements: IncomeStatement[];
  /** Recent balance sheets (most recent first, bounded). */
  balanceSheets: BalanceSheet[];
  /** Raw ledger for the current month (cleared each tick after posting). */
  ledger: LedgerEntry[];

  /** Total enterprise equity history (fund equity + GP equity), oldest first. */
  equityHistory: number[];

  events: SimEvent[];
  rngState: number;
}
