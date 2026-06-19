/**
 * v2 master engine: builds a new game and advances the simulation one month,
 * stepping the economy, market, trading book, fund economics (fees/carry),
 * firm (payroll/morale/attrition), fundraising, taxes, reputation and the
 * financial statements — in that order — and returning a fresh SimState.
 */
import {
  IncomeStatement,
  Instrument,
  LedgerEntry,
  LPType,
  MarketMover,
  MonthlyReport,
  SimEvent,
  SimState,
  TOTAL_MONTHS,
} from './types';
import { Rng } from '../engine/rng';
import { g, getLang } from '../i18n/lang';
import { ROLE_LABEL, LP_TYPE_LABEL } from './labels';
import { REGIME_LABEL, stepEconomy } from './economy';
import { createInstruments, stepMarket } from './market';
import { THESES } from './thesis';
import { scenarioEconomy, applyScenarioToInstruments } from './scenarios';
import { generateObjective, metricValue, isMet, computeScore, localizedObjective } from './objectives';
import { createRivals, stepRivals, buildLeague, trailingReturn, playerRankFraction } from './rivals';
import { maybeDecision, buildLpMeeting, buildChain } from './decisions';
import { maybeOpportunity, payoffMultiple, OPP_LABEL } from './opportunities';
import { createVC, refreshDeals, stepVC, vcResidualValue } from './vc';
import { createRealEstate, refreshPropertyDeals, stepRealEstate, realEstateEquity } from './realestate';
import { maybeTriggerCrisis, applyCrisisToEconomy, crisisEquityShock, hedgePayout, HEDGE_MONTHLY_PREMIUM, CRISIS_DESC } from './crises';
import { tierPerks } from './tiers';
import { ACHIEVEMENTS, evaluateAchievements } from './achievements';
import { maxDrawdown } from '../engine/finance';
import { difficultyParams, DEFAULT_DIFFICULTY } from './difficulty';
import { DifficultyConfig, FundThesis, GameOverReason, Scenario } from './types';
import { createPortfolio, portfolioNav, stepPortfolio, raiseCash, exposures } from './portfolio';
import { EMPTY_ANALYTICS } from './analysis';
import { RunAnalytics } from './types';
import { createFirm, firmCapabilities, stepFirm } from './firm';
import {
  createFund,
  crystalliseCarry,
  fundMetrics,
  monthlyManagementFee,
  tryRaiseCapital,
} from './fund';
import { buildBalanceSheet, buildIncomeStatement } from './accounting';
import { createLP } from './fund';
import { generateSignals } from './research';
import { TeamContribution } from './types';

const NO_CONTRIBUTION: TeamContribution = {
  alphaPnl: 0,
  financingSaved: 0,
  marginCallsPrevented: 0,
  capitalRaised: 0,
};

// Founder personal capital: GP operating runway + an anchor LP commitment.
const GP_RUNWAY = 3_000_000;
const ANCHOR_COMMITMENT = 7_000_000;
// Seed LPs that come in at launch alongside the founder (track-record-free,
// reputation-50 institutions willing to back a first-time fund).
const INITIAL_CALL = 12_000_000;
const TAX_RATE = 0.25;

let evCounter = 0;
function ev(month: number, e: Omit<SimEvent, 'id' | 'month'>): SimEvent {
  evCounter += 1;
  return { id: `e-${month}-${evCounter}`, month, ...e };
}

export function monthLabel(month: number): string {
  const year = Math.floor(month / 12) + 1;
  const m = (month % 12) + 1;
  return `J${year} M${String(m).padStart(2, '0')}`;
}

export function createSimGame(
  seed = Date.now(),
  thesis: FundThesis = 'multistrat',
  scenario: Scenario = 'normal',
  officeName = 'Family Office',
  difficulty: DifficultyConfig = DEFAULT_DIFFICULTY,
): SimState {
  evCounter = 0;
  const rng = new Rng(seed);
  const dp = difficultyParams(difficulty);
  const economy = scenarioEconomy(scenario);
  const instruments = applyScenarioToInstruments(scenario, createInstruments());
  const firm = createFirm(officeName.trim() || 'Family Office', GP_RUNWAY * dp.startCapitalMult, rng);

  let fund = createFund(0, ANCHOR_COMMITMENT * dp.startCapitalMult, rng);
  // Leaner fees on harder difficulties.
  fund = { ...fund, mgmtFeeRate: fund.mgmtFeeRate * dp.feeMult, carryRate: fund.carryRate * dp.feeMult };
  // Two seed LPs join at launch, so the fund has enough AUM for fees to
  // support a lean team through the J-curve.
  const seedLPs = [createLP('Endowment', 12_000_000 * dp.startCapitalMult, rng), createLP('Pension', 13_000_000 * dp.startCapitalMult, rng)];
  const committed = ANCHOR_COMMITMENT * dp.startCapitalMult + seedLPs.reduce((a, l) => a + l.committed, 0);
  const called = Math.min(INITIAL_CALL * dp.startCapitalMult, committed);
  fund = {
    ...fund,
    committed,
    called,
    highWaterMark: called,
    lps: [...fund.lps, ...seedLPs].map((lp) => ({ ...lp, called: called * (lp.committed / committed) })),
    cashflows: [{ t: 0, amount: -called }],
  };
  const portfolio = createPortfolio(called);

  const enterprise = firm.cash + portfolioNav(portfolio, instruments);
  const caps0 = firmCapabilities(firm, 50, thesis);
  const signals0 = generateSignals(instruments, economy, caps0, rng, THESES[thesis].signalNoiseMult);

  // The recurring nemesis: the most skilled rival at launch.
  const rivals0 = createRivals(rng);
  const nemesis = rivals0.reduce((a, b) => (b.skill > a.skill ? b : a), rivals0[0]);

  return {
    month: 0,
    started: true,
    gameOver: false,
    thesis,
    scenario,
    difficulty,
    economy,
    instruments,
    portfolio,
    firm,
    fund,
    reputation: 50,
    peakReputation: 50,
    analytics: EMPTY_ANALYTICS,
    achievements: [],
    specialHoldings: [],
    vc: { ...createVC(), deals: refreshDeals(rng, 50) },
    realEstate: { ...createRealEstate(), deals: refreshPropertyDeals(rng, 1) },
    rivals: rivals0,
    nemesisId: nemesis?.id,
    lastDecisionIds: [],
    pendingChains: [],
    objectives: [generateObjective(rng, 0, 50), generateObjective(rng, 0, 50)],
    signals: signals0,
    lastContribution: NO_CONTRIBUTION,
    incomeStatements: [],
    balanceSheets: [],
    ledger: [],
    equityHistory: [enterprise],
    benchmarkHistory: [100],
    fundDeadMonths: 0,
    chronicle: [],
    events: [
      ev(0, {
        type: 'info',
        title: g({ de: `${firm.name} gegründet`, en: `${firm.name} founded` }),
        description: g({
          de: `GP-Runway $${(GP_RUNWAY / 1e6).toFixed(1)}M · Fund committed $${(committed / 1e6).toFixed(0)}M (davon $${(called / 1e6).toFixed(0)}M abgerufen). Baue Track-Record auf, um mehr LP-Kapital zu raisen.`,
          en: `GP runway $${(GP_RUNWAY / 1e6).toFixed(1)}M · Fund committed $${(committed / 1e6).toFixed(0)}M (of which $${(called / 1e6).toFixed(0)}M called). Build a track record to raise more LP capital.`,
        }),
      }),
    ],
    rngState: rng.getState(),
  };
}

/** Total enterprise equity = GP cash + fund NAV + venture + real-estate equity. */
export function enterpriseEquity(state: SimState): number {
  return state.firm.cash + portfolioNav(state.portfolio, state.instruments) + vcResidualValue(state.vc) + realEstateEquity(state.realEstate);
}

/** Equal-weight average one-month return across listed equities. */
function equityMarketReturn(instruments: Instrument[]): number {
  let sum = 0;
  let n = 0;
  for (const inst of instruments) {
    if (inst.kind !== 'equity') continue;
    const h = inst.priceHistory;
    if (h.length < 2 || h[h.length - 2] <= 0) continue;
    sum += inst.price / h[h.length - 2] - 1;
    n += 1;
  }
  return n > 0 ? sum / n : 0;
}

/** Trailing n-month return of an index level series (NaN if too short). */
export function benchmarkTrailing(levels: number[] | undefined, n = 12): number {
  if (!levels || levels.length < n + 1) return NaN;
  const a = levels[levels.length - 1 - n];
  return a > 0 ? levels[levels.length - 1] / a - 1 : NaN;
}

/* ----------------------------- Fund generations ------------------------- */

export const MAX_FUND_GENERATION = 4;

export interface SuccessorInfo {
  eligible: boolean;
  /** Reason code when not eligible: 'maxgen' | 'young' | 'track' | 'rep' | 'late'. */
  reason?: string;
  nextGen: number;
  /** Committed capital the successor fund would raise. */
  newCommitted: number;
}

/** Can the player close this fund and raise a larger successor? */
export function successorInfo(state: SimState): SuccessorInfo {
  const fund = state.fund;
  const gen = fund.generation ?? 1;
  const nav = portfolioNav(state.portfolio, state.instruments);
  const m = fundMetrics(fund, nav, state.month);
  const monthsRun = state.month - fund.vintageMonth;
  const mult = Math.min(3.2, 1.6 + Math.max(0, m.tvpi - 1) * 0.8 + Math.max(0, (state.reputation - 55) / 100));
  const newCommitted = Math.max(fund.committed, Math.round((fund.committed * mult) / 1e6) * 1e6);
  let reason: string | undefined;
  if (gen >= MAX_FUND_GENERATION) reason = 'maxgen';
  else if (monthsRun < 36) reason = 'young';
  else if (!(m.tvpi >= 1.2)) reason = 'track';
  else if (state.reputation < 55) reason = 'rep';
  else if (state.month > TOTAL_MONTHS - 36) reason = 'late';
  return { eligible: !reason, reason, nextGen: gen + 1, newCommitted };
}

/**
 * Close the current fund and launch a larger successor: realise the book, pay
 * the GP a final carry on gains above the high-water mark, then start a fresh,
 * bigger fund (new LPs, slightly richer terms) — the long-run progression
 * ladder. The GP (cash, team, infra, reputation) and the venture book carry over.
 */
export function raiseSuccessor(state: SimState, rng: Rng): SimState {
  const info = successorInfo(state);
  if (!info.eligible) return state;
  const fund = state.fund;
  const nav = portfolioNav(state.portfolio, state.instruments);
  const gen = (fund.generation ?? 1) + 1;

  // Final carry to the GP on gains above the high-water mark.
  const finalCarry = Math.max(0, nav - fund.highWaterMark) * fund.carryRate;
  const firm = { ...state.firm, cash: state.firm.cash + finalCarry, carryEarned: state.firm.carryEarned + finalCarry };

  // Terms improve with track record.
  const mgmtFeeRate = Math.min(0.025, fund.mgmtFeeRate + 0.0025);
  const carryRate = Math.min(0.25, fund.carryRate + 0.01);
  const committed = info.newCommitted;
  const called = Math.round((committed * 0.4) / 1e6) * 1e6;

  // Fresh LP base spread across institution types.
  const types: LPType[] = ['SovereignWealth', 'Endowment', 'Pension', 'FundOfFunds'];
  const lps = types.map((t) => {
    const lp = createLP(t, Math.round(committed / types.length / 1e6) * 1e6, rng);
    return { ...lp, called: Math.round(called / types.length) };
  });

  const newFund = {
    ...fund,
    generation: gen,
    vintageMonth: state.month,
    committed,
    called,
    distributed: 0,
    lps,
    mgmtFeeRate,
    carryRate,
    highWaterMark: called,
    accruedCarry: 0,
    cashflows: [{ t: state.month / 12, amount: -called }],
    lastCarryMonth: state.month,
  };

  const portfolio = createPortfolio(called);
  const reputation = Math.min(100, state.reputation + 5);
  const ev0 = ev(state.month, {
    type: 'fund',
    title: g({ de: `Fund ${roman(gen)} aufgelegt`, en: `Fund ${roman(gen)} Launched` }),
    description: g({
      de: `Track-Record überzeugt: $${(committed / 1e6).toFixed(0)}M Commitments eingeworben${finalCarry > 1000 ? ` · $${(finalCarry / 1e6).toFixed(1)}M Final-Carry` : ''}.`,
      en: `Track record pays off: raised $${(committed / 1e6).toFixed(0)}M in commitments${finalCarry > 1000 ? ` · $${(finalCarry / 1e6).toFixed(1)}M final carry` : ''}.`,
    }),
  });

  return {
    ...state,
    firm,
    fund: newFund,
    portfolio,
    reputation,
    peakReputation: Math.max(state.peakReputation ?? reputation, reputation),
    fundDeadMonths: 0,
    events: [ev0, ...state.events].slice(0, 80),
  };
}

function roman(n: number): string {
  return ['0', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n);
}

/** Biggest one-month price moves across tradeable instruments (excl. options). */
function computeMovers(instruments: Instrument[]): { gainers: MarketMover[]; losers: MarketMover[] } {
  const moves: MarketMover[] = [];
  for (const inst of instruments) {
    if (inst.kind === 'option') continue;
    const h = inst.priceHistory;
    if (h.length < 2) continue;
    const prev = h[h.length - 2];
    if (prev <= 0) continue;
    moves.push({ symbol: inst.symbol, kind: inst.kind, changePct: inst.price / prev - 1, price: inst.price });
  }
  const sorted = [...moves].sort((a, b) => b.changePct - a.changePct);
  return {
    gainers: sorted.filter((m) => m.changePct > 0).slice(0, 3),
    losers: sorted.filter((m) => m.changePct < 0).slice(-3).reverse(),
  };
}

export function advanceMonth(state: SimState): SimState {
  if (state.gameOver) return state;

  const rng = new Rng(state.rngState);
  const dp = difficultyParams(state.difficulty ?? DEFAULT_DIFFICULTY);
  const month = state.month + 1;
  const events: SimEvent[] = [];
  const ledger: LedgerEntry[] = [];
  const post = (account: LedgerEntry['account'], amount: number, memo?: string) =>
    ledger.push({ month, account, amount, memo });

  // 1. Economy ---------------------------------------------------------------
  const stepped = stepEconomy(state.economy, rng, dp.volMult);
  const regimeChanged = stepped.regimeChanged;
  if (regimeChanged) {
    events.push(ev(month, {
      type: 'economy',
      title: g({ de: `Konjunkturwende: ${g(REGIME_LABEL[stepped.economy.regime])}`, en: `Regime shift: ${g(REGIME_LABEL[stepped.economy.regime])}` }),
      description: g({
        de: `BIP ${(stepped.economy.gdpGrowth * 100).toFixed(1)}%, Leitzins ${(stepped.economy.policyRate * 100).toFixed(1)}%.`,
        en: `GDP ${(stepped.economy.gdpGrowth * 100).toFixed(1)}%, policy rate ${(stepped.economy.policyRate * 100).toFixed(1)}%.`,
      }),
    }));
  }

  // 1b. Crisis lifecycle -----------------------------------------------------
  let crisis = state.crisis ? { ...state.crisis, monthsRemaining: state.crisis.monthsRemaining - 1 } : undefined;
  if (crisis && crisis.monthsRemaining <= 0) {
    events.push(ev(month, { type: 'economy', title: g({ de: `${crisis.label} überstanden`, en: `${crisis.label} weathered` }), description: g({ de: 'Die Märkte beruhigen sich.', en: 'Markets are calming down.' }) }));
    crisis = undefined;
  }
  if (!crisis) {
    const newCrisis = maybeTriggerCrisis(stepped.economy, false, rng, dp.crisisProbMult);
    if (newCrisis) {
      crisis = newCrisis;
      events.push(ev(month, { type: 'blackswan', title: g({ de: `⚠ ${crisis.label} (${crisis.monthsRemaining} Monate)`, en: `⚠ ${crisis.label} (${crisis.monthsRemaining} months)` }), description: g(CRISIS_DESC[crisis.type]) }));
    }
  }
  // Difficulty already raised the vol *target* in stepEconomy (stable, mean-
  // reverting); a crisis adds a transient spike on top that reverts afterwards.
  const economy = crisis ? applyCrisisToEconomy(stepped.economy, crisis) : stepped.economy;

  // 2. Market ----------------------------------------------------------------
  const { instruments, blackSwan } = stepMarket(state.instruments, economy, month, rng, crisisEquityShock(crisis), dp.swanProbMult);
  if (blackSwan) {
    events.push(ev(month, { type: 'blackswan', title: g({ de: '🦢 Black Swan', en: '🦢 Black Swan' }), description: g({ de: 'Ein extremer Schock erschüttert die Märkte – gehebelte Positionen sind in Gefahr.', en: 'An extreme shock rocks the markets — leveraged positions are at risk.' }) }));
  }

  // 2b. Benchmark index (equal-weight equities) -------------------------------
  const prevBench = state.benchmarkHistory ?? [100];
  const benchLevel = prevBench[prevBench.length - 1] * (1 + equityMarketReturn(instruments));
  const benchmarkHistory = [...prevBench, benchLevel].slice(-TOTAL_MONTHS - 1);
  const bench12 = benchmarkTrailing(benchmarkHistory, 12);

  // 3. Trading book ----------------------------------------------------------
  const capabilities = firmCapabilities(state.firm, state.reputation, state.thesis);
  const pStep = stepPortfolio(state.portfolio, instruments, month, {
    policyRate: economy.policyRate,
    primeBrokerTier: state.firm.infrastructure.primeBrokerTier,
    capabilities,
    financingBonus: THESES[state.thesis].financingBonus,
    volIndex: economy.volIndex,
  });
  let portfolio = pStep.portfolio;
  if (pStep.financingCost) post('financingCost', -pStep.financingCost);
  if (pStep.income) post('couponIncome', pStep.income);
  if (pStep.marginCalled.length > 0) {
    events.push(ev(month, { type: 'risk', title: g({ de: 'Margin Call', en: 'Margin Call' }), description: g({ de: `Zwangsliquidation: ${pStep.marginCalled.join(', ')}.`, en: `Forced liquidation: ${pStep.marginCalled.join(', ')}.` }) }));
  }

  // 3b. Hedge: pay the monthly premium, collect a payout in crashes/crises ----
  let hedge = state.hedge;
  if (hedge) {
    const premium = hedge.notional * HEDGE_MONTHLY_PREMIUM;
    if (portfolio.cash < premium) {
      // Can't fund the premium — the policy lapses instead of overdrawing the fund.
      events.push(ev(month, { type: 'risk', title: g({ de: 'Absicherung verfallen', en: 'Hedge lapsed' }), description: g({ de: 'Die Prämie konnte nicht gezahlt werden — der Schutz erlischt.', en: 'The premium could not be paid — the cover lapses.' }) }));
      hedge = undefined;
    } else {
      let cash = portfolio.cash - premium;
      const payout = hedgePayout(hedge.notional, blackSwan, crisis);
      if (payout > 0) {
        cash += payout;
        events.push(ev(month, { type: 'risk', title: g({ de: 'Absicherung greift', en: 'Hedge pays out' }), description: g({ de: `Hedge zahlt $${(payout / 1e6).toFixed(1)}M aus.`, en: `Hedge pays $${(payout / 1e6).toFixed(1)}M.` }) }));
      }
      portfolio = { ...portfolio, cash };
      const rem = hedge.monthsRemaining - 1;
      hedge = rem > 0 ? { ...hedge, monthsRemaining: rem } : undefined;
    }
  }

  // 3c. Resolve matured special opportunities --------------------------------
  let specialHoldings = state.specialHoldings ?? [];
  const resolving = specialHoldings.filter((h) => month >= h.resolveMonth);
  if (resolving.length > 0) {
    let cashAdd = 0;
    for (const h of resolving) {
      const mult = payoffMultiple(h.type, state.reputation, rng);
      const proceeds = h.invested * mult;
      cashAdd += proceeds;
      events.push(ev(month, {
        type: 'fund',
        title: g({ de: `${g(OPP_LABEL[h.type])} realisiert`, en: `${g(OPP_LABEL[h.type])} realised` }),
        description: `${h.title}: $${(h.invested / 1e6).toFixed(1)}M → $${(proceeds / 1e6).toFixed(1)}M (${mult.toFixed(2)}×).`,
      }));
    }
    portfolio = { ...portfolio, cash: portfolio.cash + cashAdd };
    specialHoldings = specialHoldings.filter((h) => month < h.resolveMonth);
  }

  // 3d. Venture book: startups grow, raise, fail or exit ---------------------
  // Deal flow scales with the fund's size so investing stays meaningful later.
  const vcScale = Math.max(1, Math.min(12, portfolioNav(portfolio, instruments) / 15_000_000));
  const vcStep = stepVC(state.vc, economy, month, rng, state.reputation, vcScale);
  const vc = vcStep.vc;
  if (vcStep.proceeds > 0) {
    portfolio = { ...portfolio, cash: portfolio.cash + vcStep.proceeds };
  }
  for (const note of vcStep.notes) {
    const title =
      note.kind === 'exit'
        ? g({ de: 'Startup-Exit', en: 'Startup Exit' })
        : note.kind === 'fail'
          ? g({ de: 'Startup gescheitert', en: 'Startup Failed' })
          : g({ de: 'Finanzierungsrunde', en: 'Funding Round' });
    events.push(ev(month, { type: 'fund', title, description: note.text }));
  }

  // 3e. Real-estate book: net rent to the fund, value drift, occupancy. --------
  const reScale = Math.max(1, Math.min(10, portfolioNav(portfolio, instruments) / 15_000_000));
  const reStep = stepRealEstate(state.realEstate ?? createRealEstate(), economy, month, rng, reScale);
  const realEstate = reStep.re;
  if (Math.abs(reStep.income) > 1) {
    portfolio = { ...portfolio, cash: portfolio.cash + reStep.income };
  }
  for (const note of reStep.notes) {
    if (note.kind === 'event') events.push(ev(month, { type: 'fund', title: g({ de: 'Immobilien', en: 'Real Estate' }), description: note.text }));
  }

  let fundNav = portfolioNav(portfolio, instruments);

  // 4. Fund economics: management fee & carry (paid out of fund NAV to GP) ----
  let fund = state.fund;
  let firm = state.firm;

  // Fee is capped at available fund cash — it can't pull the fund below zero.
  const fee = Math.min(monthlyManagementFee(fund, fundNav, month), Math.max(0, portfolio.cash));
  portfolio = { ...portfolio, cash: portfolio.cash - fee };
  firm = { ...firm, cash: firm.cash + fee, feesEarned: firm.feesEarned + fee };
  post('mgmtFeeRevenue', fee);

  const carryRes = crystalliseCarry(fund, fundNav - fee, month);
  fund = carryRes.fund;
  if (carryRes.carry > 0) {
    portfolio = { ...portfolio, cash: portfolio.cash - carryRes.carry };
    firm = { ...firm, cash: firm.cash + carryRes.carry, carryEarned: firm.carryEarned + carryRes.carry };
    post('carryRevenue', carryRes.carry);
    events.push(ev(month, { type: 'fund', title: g({ de: 'Carry kristallisiert', en: 'Carry Crystallised' }), description: g({ de: `Performance-Fee von $${(carryRes.carry / 1e6).toFixed(2)}M an die GP ausgeschüttet.`, en: `Performance fee of $${(carryRes.carry / 1e6).toFixed(2)}M distributed to the GP.` }) }));
  }
  fundNav = portfolioNav(portfolio, instruments);

  // 4b. Redemptions & liquidity ---------------------------------------------
  // After a lockup, disappointed LPs withdraw — forcing fire sales if the fund
  // is short of cash, exactly when markets are ugly.
  let redeemedCount = 0;
  let fireSaleLoss = 0;
  if (month - fund.vintageMonth > 18) {
    const trailing12 = trailingReturn(portfolio.returnHistory, 12);
    const hwm = portfolio.highWaterMark || fundNav;
    const drawdown = hwm > 0 ? Math.max(0, (hwm - fundNav) / hwm) : 0;
    // Only drawdown BEYOND the market's own drawdown alarms LPs: matching a bear
    // market is expected, not a reason to redeem. Excess drawdown (from leverage
    // or bad picks) is what builds pressure.
    const benchPeak = Math.max(...benchmarkHistory);
    const benchDrawdown = benchPeak > 0 ? Math.max(0, (benchPeak - benchLevel) / benchPeak) : 0;
    const excessDrawdown = Math.max(0, drawdown - benchDrawdown);
    const totalCalledActive = fund.lps.filter((l) => !l.redeemed).reduce((s, l) => s + l.called, 0) || 1;
    const keep: typeof fund.lps = [];
    const redeemers: typeof fund.lps = [];
    for (const lp of fund.lps) {
      if (lp.redeemed) {
        keep.push(lp);
        continue;
      }
      // LPs judge the fund RELATIVE to the market: in a bear year nobody expects
      // +12%, they expect you to hold up better than the index. The effective
      // target is the lesser of the LP's absolute goal and benchmark + 2pts,
      // with a tolerance band before any pressure builds.
      const LP_TOLERANCE = 0.04;
      const trailing = Number.isFinite(trailing12) ? trailing12 : 0;
      const effectiveTarget = Number.isFinite(bench12) ? Math.min(lp.expectedReturn, bench12 + 0.02) : lp.expectedReturn;
      const underperf = Math.max(0, effectiveTarget - LP_TOLERANCE - trailing);
      const pressure = underperf * 1.1 + excessDrawdown * 0.9;
      const prob = Math.max(0, Math.min(0.4, pressure * (1 - lp.patience)));
      if (rng.chance(prob)) redeemers.push(lp);
      else keep.push(lp);
    }
    // At most one LP redeems per month: a rough patch peels capital gradually
    // (leaving room to perform your way back) instead of an all-at-once stampede
    // that would collapse AUM, fees and reputation in a single tick.
    if (redeemers.length > 1) keep.push(...redeemers.splice(1));
    if (redeemers.length > 0) {
      const redeemValue = redeemers.reduce((s, lp) => s + fundNav * (lp.called / totalCalledActive), 0);
      const haircut = economy.volIndex > 25 ? 0.08 : 0.04;
      if (portfolio.cash < redeemValue) {
        const r = raiseCash(portfolio, instruments, redeemValue - portfolio.cash, haircut);
        portfolio = r.portfolio;
        fireSaleLoss = r.haircutLoss;
      }
      const paid = Math.min(redeemValue, Math.max(0, portfolio.cash));
      portfolio = { ...portfolio, cash: portfolio.cash - paid };
      fund = {
        ...fund,
        distributed: fund.distributed + paid,
        committed: Math.max(0, fund.committed - redeemers.reduce((s, l) => s + l.committed, 0)),
        called: Math.max(0, fund.called - redeemers.reduce((s, l) => s + l.called, 0)),
        lps: [...keep, ...redeemers.map((l) => ({ ...l, redeemed: true, distributed: l.distributed + fundNav * (l.called / totalCalledActive) }))],
      };
      redeemedCount = redeemers.length;
      fundNav = portfolioNav(portfolio, instruments);
      events.push(ev(month, {
        type: 'fund',
        title: g({ de: 'Mittelabzug', en: 'Redemption' }),
        description: g({
          de: `${redeemedCount} LP(s) ziehen $${(paid / 1e6).toFixed(1)}M ab${fireSaleLoss > 1000 ? ` · Notverkäufe kosten $${(fireSaleLoss / 1e6).toFixed(1)}M` : ''}.`,
          en: `${redeemedCount} LP(s) withdraw $${(paid / 1e6).toFixed(1)}M${fireSaleLoss > 1000 ? ` · forced sales cost $${(fireSaleLoss / 1e6).toFixed(1)}M` : ''}.`,
        }),
      }));
    }
  }

  // 4c. Re-baseline the NAV series so external LP capital flows (redemptions,
  // and capital calls applied between ticks) are NOT counted as fund returns.
  // A withdrawal is not an investment loss — measuring it as one is what turned
  // a single bad year into an unrecoverable death spiral. Setting the latest NAV
  // point to the post-flow value makes next month's return reflect market P&L on
  // the capital actually at work.
  if (portfolio.navHistory.length > 0) {
    const navH = [...portfolio.navHistory];
    navH[navH.length - 1] = portfolioNav(portfolio, instruments);
    portfolio = { ...portfolio, navHistory: navH };
  }

  // 5. Firm: payroll, opex, morale, attrition -------------------------------
  const profitable = pStep.alphaPnl + pStep.income - pStep.financingCost + fee > 0;
  const firmStep = stepFirm(firm, { openPositions: portfolio.positions.length, profitable, reputation: state.reputation }, rng);
  firm = firmStep.firm;
  // Difficulty raises the cost base.
  const payroll = firmStep.payroll * dp.opexMult;
  const infraOpex = firmStep.infraOpex * dp.opexMult;
  firm = { ...firm, cash: firm.cash - payroll - infraOpex };
  post('salaries', -payroll);
  post('infraOpex', -infraOpex);
  for (const dep of firmStep.departures) {
    events.push(ev(month, { type: 'firm', title: g({ de: 'Kündigung', en: 'Resignation' }), description: g({ de: `${dep.name} (${g(ROLE_LABEL[dep.role])}) verlässt die Firma (Moral ${dep.morale.toFixed(0)}).`, en: `${dep.name} (${g(ROLE_LABEL[dep.role])}) is leaving the firm (morale ${dep.morale.toFixed(0)}).` }) }));
  }
  if (firm.cash < 0) {
    events.push(ev(month, { type: 'firm', title: g({ de: '⚠️ GP-Liquidität negativ', en: '⚠️ GP liquidity negative' }), description: g({ de: 'Die Management-Gesellschaft verbrennt Cash. Hebe Gebühren über mehr AUM oder reduziere Kosten.', en: 'The management company is burning cash. Raise fees via more AUM or cut costs.' }) }));
  }

  // 6. Tax on GP net income (monthly, on positive pre-tax) -------------------
  const preTax = fee + carryRes.carry - payroll - infraOpex;
  const tax = Math.max(0, preTax) * TAX_RATE;
  if (tax > 0) {
    firm = { ...firm, cash: firm.cash - tax };
    post('tax', -tax);
  }

  // 7. Fundraising -----------------------------------------------------------
  const metrics = fundMetrics(fund, fundNav, month);
  const peakSoFar = Math.max(state.peakReputation ?? state.reputation, state.reputation);
  const allowedLpTypes = tierPerks(peakSoFar).lpTypes;
  const newLP = tryRaiseCapital(fund, metrics, capabilities.fundraising, state.reputation, rng, allowedLpTypes);
  if (newLP) {
    fund = { ...fund, committed: fund.committed + newLP.committed, lps: [...fund.lps, newLP] };
    events.push(ev(month, { type: 'fund', title: g({ de: 'Neues LP-Commitment', en: 'New LP Commitment' }), description: g({ de: `${newLP.name} (${g(LP_TYPE_LABEL[newLP.type])}) committed $${(newLP.committed / 1e6).toFixed(1)}M.`, en: `${newLP.name} (${g(LP_TYPE_LABEL[newLP.type])}) commits $${(newLP.committed / 1e6).toFixed(1)}M.` }) }));
  }

  // 8. Reputation ------------------------------------------------------------
  const prevNav = state.portfolio.navHistory[state.portfolio.navHistory.length - 1] ?? fundNav;
  const monthReturn = prevNav > 0 ? fundNav / prevNav - 1 : 0;

  // Rivals & league standing.
  const rivals = stepRivals(state.rivals, economy, rng, dp.rivalSkillBonus);
  const playerTrailing = trailingReturn(portfolio.returnHistory, 12);
  const league = buildLeague(rivals, state.firm.name, playerTrailing, fundNav);
  // The league only judges a real track record — neutral standing in year one.
  const rankFrac = month >= 12 ? playerRankFraction(league) : 0.5;

  let repDelta = Math.max(-2, Math.min(2, monthReturn * 30));
  // Standing vs rivals: top of the table lifts reputation, bottom drags it.
  repDelta += (0.5 - rankFrac) * 0.6;
  repDelta -= pStep.marginCalled.length * 1.5;
  repDelta -= redeemedCount * 0.8;
  if (blackSwan && pStep.marginCalled.length === 0) repDelta += 0.5;
  if (Number.isFinite(metrics.netIrr) && metrics.netIrr > 0.15) repDelta += 0.2;
  // Clear-recovery signal: a strong trailing book wins standing back faster, so
  // performing your way out of a redemption patch is a real, viable path.
  if (Number.isFinite(playerTrailing) && playerTrailing > 0.1) repDelta += 0.6;
  let reputation = Math.max(0, Math.min(100, state.reputation + repDelta));

  // 8b. Objectives / mandates ------------------------------------------------
  const evalState = { ...state, fund, instruments, portfolio, month, reputation } as SimState;
  const objectives = state.objectives.map((obj) => {
    if (obj.status !== 'active' || month < obj.deadlineMonth) return obj;
    const value = metricValue(evalState, obj.metric);
    if (isMet(obj, value)) {
      reputation = Math.min(100, reputation + obj.rewardReputation);
      if (obj.rewardCapital > 0) {
        const lp = createLP('Endowment', obj.rewardCapital, rng);
        fund = { ...fund, committed: fund.committed + lp.committed, lps: [...fund.lps, lp] };
      }
      const lo = localizedObjective(obj, getLang());
      events.push(ev(month, {
        type: 'fund',
        title: g({ de: `Mandat erfüllt: ${lo.title}`, en: `Mandate met: ${lo.title}` }),
        description: g({
          de: `${lo.description} erreicht. +${obj.rewardReputation} Reputation${obj.rewardCapital > 0 ? `, +$${(obj.rewardCapital / 1e6).toFixed(0)}M Commitment` : ''}.`,
          en: `${lo.description} reached. +${obj.rewardReputation} reputation${obj.rewardCapital > 0 ? `, +$${(obj.rewardCapital / 1e6).toFixed(0)}M commitment` : ''}.`,
        }),
      }));
      return { ...obj, status: 'succeeded' as const };
    }
    reputation = Math.max(0, reputation - obj.penaltyReputation);
    const loFail = localizedObjective(obj, getLang());
    events.push(ev(month, { type: 'fund', title: g({ de: `Mandat verfehlt: ${loFail.title}`, en: `Mandate missed: ${loFail.title}` }), description: g({ de: `${loFail.description} nicht erreicht. −${obj.penaltyReputation} Reputation.`, en: `${loFail.description} not reached. −${obj.penaltyReputation} reputation.` }) }));
    return { ...obj, status: 'failed' as const };
  });
  let activeCount = objectives.filter((o) => o.status === 'active').length;
  while (activeCount < 2 && month < TOTAL_MONTHS - 18) {
    const fresh = generateObjective(rng, month, reputation);
    objectives.push(fresh);
    activeCount += 1;
    const loFresh = localizedObjective(fresh, getLang());
    events.push(ev(month, { type: 'fund', title: g({ de: `Neues LP-Mandat: ${loFresh.title}`, en: `New LP mandate: ${loFresh.title}` }), description: g({ de: `${loFresh.description} bis Monat ${fresh.deadlineMonth + 1}.`, en: `${loFresh.description} by month ${fresh.deadlineMonth + 1}.` }) }));
  }
  // Anti-spiral guarantee: cap the TOTAL reputation lost in a single month across
  // all sources (returns, redemptions, margin calls, missed mandates). One bad
  // month dents standing but can never collapse it outright — recovery stays
  // reachable. Gains (mandate rewards, strong returns) are unaffected.
  reputation = Math.max(reputation, state.reputation - 4);

  // 9. Research desk & team-contribution feedback ----------------------------
  const signals = generateSignals(instruments, economy, capabilities, rng, THESES[state.thesis].signalNoiseMult);
  const contribution: TeamContribution = {
    alphaPnl: pStep.alphaPnl,
    financingSaved: pStep.financingSaved,
    marginCallsPrevented: pStep.marginCallsPrevented,
    capitalRaised: newLP ? newLP.committed : 0,
  };
  // Surface a concise team report only when the desk actually did something
  // material, so the log doesn't fill with no-ops.
  const materialAlpha = Math.abs(contribution.alphaPnl) + contribution.financingSaved;
  if (materialAlpha > 15_000 || contribution.marginCallsPrevented > 0) {
    const parts: string[] = [];
    if (Math.abs(contribution.alphaPnl) >= 1_000) parts.push(`Alpha ${contribution.alphaPnl >= 0 ? '+' : ''}$${(contribution.alphaPnl / 1e3).toFixed(0)}K`);
    if (contribution.financingSaved >= 1_000) parts.push(g({ de: `Finanzierung −$${(contribution.financingSaved / 1e3).toFixed(0)}K`, en: `Financing −$${(contribution.financingSaved / 1e3).toFixed(0)}K` }));
    if (contribution.marginCallsPrevented > 0) parts.push(g({ de: `${contribution.marginCallsPrevented} Margin Call(s) vermieden`, en: `${contribution.marginCallsPrevented} margin call(s) avoided` }));
    events.push(ev(month, { type: 'firm', title: g({ de: 'Team-Beitrag', en: 'Team Contribution' }), description: parts.join(' · ') }));
  }

  // 10. Statements -----------------------------------------------------------
  const positionsValue = portfolioNav(portfolio, instruments) - portfolio.cash;
  const incomeStatement: IncomeStatement = buildIncomeStatement(month, ledger);
  const balanceSheet = buildBalanceSheet({ month, firm, fund, fundCash: portfolio.cash, positionsValue });

  const enterprise = firm.cash + fundNav + vcResidualValue(vc) + realEstateEquity(realEstate);

  // Behaviour analytics for the end-of-run coaching report.
  const expo = exposures(portfolio, instruments);
  const grossLev = fundNav > 0 ? expo.gross / fundNav : 0;
  let vgWeighted = 0;
  let vgWeight = 0;
  for (const p of portfolio.positions) {
    if (p.kind !== 'equity') continue;
    const inst = instruments.find((i) => i.id === p.instrumentId);
    if (!inst || inst.kind !== 'equity' || inst.price <= 0) continue;
    const w = Math.abs(p.quantity) * inst.price;
    vgWeighted += (inst.fairValue / inst.price - 1) * w;
    vgWeight += w;
  }
  const prevA = state.analytics ?? EMPTY_ANALYTICS;
  const analytics: RunAnalytics = {
    months: prevA.months + 1,
    grossLevSum: prevA.grossLevSum + grossLev,
    maxGrossLev: Math.max(prevA.maxGrossLev, grossLev),
    monthsOverLev: prevA.monthsOverLev + (grossLev > 2 ? 1 : 0),
    monthsHedged: prevA.monthsHedged + (hedge ? 1 : 0),
    crisisMonths: prevA.crisisMonths + (crisis ? 1 : 0),
    crisisMonthsHedged: prevA.crisisMonthsHedged + (crisis && hedge ? 1 : 0),
    redemptions: prevA.redemptions + redeemedCount,
    redemptionLoss: prevA.redemptionLoss + fireSaleLoss,
    cashQuoteSum: prevA.cashQuoteSum + (fundNav > 0 ? portfolio.cash / fundNav : 0),
    valuationGapSum: prevA.valuationGapSum + (vgWeight > 0 ? vgWeighted / vgWeight : 0),
    valuationSamples: prevA.valuationSamples + (vgWeight > 0 ? 1 : 0),
    gpProfitMonths: prevA.gpProfitMonths + (incomeStatement.netIncome > 0 ? 1 : 0),
    positionsSum: prevA.positionsSum + portfolio.positions.length,
  };

  // Tier progression (sticky) & achievements.
  const peakReputation = Math.max(state.peakReputation ?? state.reputation, reputation);
  const unlocked = new Set((state.achievements ?? []).map((a) => a.id));
  const newlyUnlocked = evaluateAchievements(
    {
      state: { ...state, firm, portfolio, fund, reputation, month, objectives } as SimState,
      enterprise,
      fundNav,
      tvpi: metrics.tvpi,
      netIrr: metrics.netIrr,
      maxDrawdown: maxDrawdown(portfolio.navHistory),
      leagueRank: league.find((e) => e.isPlayer)?.rank ?? 99,
      blackSwanSurvived: blackSwan && pStep.marginCalled.length === 0,
      distinctKinds: new Set(portfolio.positions.map((p) => p.kind)).size,
    },
    unlocked,
  );
  const achievements = [...(state.achievements ?? []), ...newlyUnlocked.map((a) => ({ id: a.id, month }))];
  for (const a of newlyUnlocked) {
    events.push(ev(month, { type: 'info', title: g({ de: `🏅 Auszeichnung: ${g(a.title)}`, en: `🏅 Achievement: ${g(a.title)}` }), description: g(a.description) }));
  }

  const enterpriseStart = state.equityHistory[state.equityHistory.length - 1] ?? enterprise;
  const { gainers, losers } = computeMovers(instruments);
  const report: MonthlyReport = {
    month,
    enterpriseStart,
    enterpriseEnd: enterprise,
    enterpriseChangePct: enterpriseStart > 0 ? enterprise / enterpriseStart - 1 : 0,
    fundNav,
    fundReturnPct: monthReturn,
    gpNetIncome: incomeStatement.netIncome,
    contribution,
    reputationDelta: reputation - state.reputation,
    regime: economy.regime,
    regimeChanged,
    policyRate: economy.policyRate,
    volIndex: economy.volIndex,
    blackSwan,
    gainers,
    losers,
    headlines: events.map((e) => ({ type: e.type, title: e.title, description: e.description })),
  };

  // Fail-fast: a fund with no LPs and (almost) no assets is dead. Count the dead
  // months; rescue decision cards fire during this window — if nothing brings
  // the fund back within a year, end the run instead of a multi-year zombie.
  const activeLpCount = fund.lps.filter((l) => !l.redeemed).length;
  const fundDead = activeLpCount === 0 && fundNav < 2_000_000 && fund.committed < 1_000_000;
  const fundDeadMonths = fundDead ? (state.fundDeadMonths ?? 0) + 1 : 0;
  if (fundDead && fundDeadMonths === 1) {
    events.push(ev(month, { type: 'fund', title: g({ de: '⚠️ Fonds faktisch tot', en: '⚠️ Fund effectively dead' }), description: g({ de: 'Keine LPs, kein Kapital. Ohne Rettung (Re-Seed) wird das Haus binnen 12 Monaten abgewickelt.', en: 'No LPs, no capital. Without a rescue (re-seed) the house winds down within 12 months.' }) }));
  }

  // Grace periods so early bad luck can't end a run in the first year(s).
  // Ironman: no safety net — insolvency ends the run immediately.
  const insolvent = dp.ironman ? firm.cash < 0 : firm.cash < -2_000_000 && month >= 12;
  const ruined = reputation <= 0 && month >= 24;
  const collapsed = fundDeadMonths >= 12 && month >= 24;
  const horizon = month >= TOTAL_MONTHS;
  const gameOver = insolvent || ruined || collapsed || horizon;
  let gameOverReason: GameOverReason | undefined;
  let finalScore: number | undefined;
  let finalGrade: string | undefined;
  if (gameOver) {
    gameOverReason = insolvent ? 'insolvency' : ruined ? 'reputation' : collapsed ? 'collapse' : 'horizon';
    const endState = {
      ...state,
      firm,
      portfolio,
      instruments,
      fund,
      month,
      reputation,
      objectives,
      equityHistory: [...state.equityHistory, enterprise],
      gameOverReason,
    } as SimState;
    const sc = computeScore(endState);
    finalScore = sc.score;
    finalGrade = sc.grade;
    const title = g(
      gameOverReason === 'horizon'
        ? { de: 'Spielende', en: 'Game Over' }
        : gameOverReason === 'insolvency'
          ? { de: 'GP zahlungsunfähig', en: 'GP Insolvent' }
          : gameOverReason === 'collapse'
            ? { de: 'Fonds abgewickelt', en: 'Fund Wound Down' }
            : { de: 'Vertrauen verspielt', en: 'Trust Lost' },
    );
    const desc = g(
      gameOverReason === 'horizon'
        ? { de: `Nach 20 Jahren: Unternehmenswert $${(enterprise / 1e6).toFixed(1)}M. Note ${finalGrade} (${finalScore}).`, en: `After 20 years: enterprise value $${(enterprise / 1e6).toFixed(1)}M. Grade ${finalGrade} (${finalScore}).` }
        : gameOverReason === 'insolvency'
          ? { de: 'Die Management-Gesellschaft ist pleite. Das Haus schließt.', en: 'The management company is bankrupt. The house closes.' }
          : gameOverReason === 'collapse'
            ? { de: 'Ein Jahr ohne LPs und ohne Kapital — das Haus wird abgewickelt.', en: 'A year with no LPs and no capital — the house is wound down.' }
            : { de: 'Die Reputation ist auf null gefallen — die LPs ziehen ab.', en: 'Reputation has fallen to zero — the LPs withdraw.' },
    );
    events.push(ev(month, { type: 'info', title, description: desc }));
  }

  // Decision card (not on the final month). Priority: a due event-chain
  // callback first, then the semi-annual LP meeting, then a random "Extrablatt".
  // (Rescue cards take over inside maybeDecision while the fund is dead.)
  const decisionState = { ...state, firm, portfolio, fund, instruments, reputation, fundDeadMonths } as SimState;
  let pendingChains = state.pendingChains ?? [];
  let pendingDecision: ReturnType<typeof maybeDecision>;
  if (!gameOver) {
    const dueIdx = pendingChains.findIndex((c) => c.fireMonth <= month);
    if (dueIdx >= 0) {
      const due = pendingChains[dueIdx];
      pendingChains = pendingChains.filter((_, i) => i !== dueIdx);
      pendingDecision = buildChain(due.chainId, decisionState, rng);
    }
    if (!pendingDecision) pendingDecision = maybeDecision(decisionState, blackSwan, rng);
    if (!pendingDecision && activeLpCount > 0 && month > 0 && month % 6 === 0) {
      pendingDecision = buildLpMeeting(rng);
    }
  }
  // Special opportunity (don't stack on top of a pending decision).
  const pendingOpportunity = gameOver || pendingDecision ? undefined : maybeOpportunity(reputation, month, portfolio.cash, rng);

  // Archive this month's edition for the newspaper archive.
  const chronicle = [
    ...(state.chronicle ?? []),
    {
      month,
      enterprise,
      changePct: report.enterpriseChangePct,
      regime: economy.regime,
      headline: events.length > 0 ? events[0].title : undefined,
    },
  ].slice(-TOTAL_MONTHS);

  return {
    month,
    started: true,
    gameOver,
    gameOverReason,
    finalScore,
    finalGrade,
    analytics,
    thesis: state.thesis,
    scenario: state.scenario,
    difficulty: state.difficulty ?? DEFAULT_DIFFICULTY,
    // Persist the canonical economy; the crisis spike is transient (this month
    // only) so it can't ratchet the vol index upward across months.
    economy: stepped.economy,
    instruments,
    portfolio,
    firm,
    fund,
    crisis,
    hedge,
    reputation,
    peakReputation,
    achievements,
    rivals,
    objectives,
    signals,
    lastContribution: contribution,
    lastReport: report,
    incomeStatements: [incomeStatement, ...state.incomeStatements].slice(0, 36),
    balanceSheets: [balanceSheet, ...state.balanceSheets].slice(0, 36),
    ledger: [],
    pendingDecision,
    pendingOpportunity,
    lastDecisionIds: state.lastDecisionIds ?? [],
    pendingChains,
    nemesisId: state.nemesisId,
    specialHoldings,
    vc,
    realEstate,
    equityHistory: [...state.equityHistory, enterprise].slice(-TOTAL_MONTHS - 1),
    benchmarkHistory,
    fundDeadMonths,
    chronicle,
    events: [...events, ...state.events].slice(0, 80),
    rngState: rng.getState(),
  };
}
