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
import { maybeDecision } from './decisions';
import { maybeOpportunity, payoffMultiple, OPP_LABEL } from './opportunities';
import { createVC, refreshDeals, stepVC, vcResidualValue } from './vc';
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
    rivals: createRivals(rng),
    objectives: [generateObjective(rng, 0, 50), generateObjective(rng, 0, 50)],
    signals: signals0,
    lastContribution: NO_CONTRIBUTION,
    incomeStatements: [],
    balanceSheets: [],
    ledger: [],
    equityHistory: [enterprise],
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

/** Total enterprise equity = GP cash + fund NAV + venture residual value. */
export function enterpriseEquity(state: SimState): number {
  return state.firm.cash + portfolioNav(state.portfolio, state.instruments) + vcResidualValue(state.vc);
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

  let fundNav = portfolioNav(portfolio, instruments);

  // 4. Fund economics: management fee & carry (paid out of fund NAV to GP) ----
  let fund = state.fund;
  let firm = state.firm;

  const fee = monthlyManagementFee(fund, fundNav, month);
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
    const totalCalledActive = fund.lps.filter((l) => !l.redeemed).reduce((s, l) => s + l.called, 0) || 1;
    const keep: typeof fund.lps = [];
    const redeemers: typeof fund.lps = [];
    for (const lp of fund.lps) {
      if (lp.redeemed) {
        keep.push(lp);
        continue;
      }
      const underperf = Math.max(0, lp.expectedReturn - (Number.isFinite(trailing12) ? trailing12 : 0));
      const pressure = underperf * 1.5 + drawdown * 1.2 + (economy.regime === 'contraction' ? 0.06 : 0);
      const prob = Math.max(0, Math.min(0.5, pressure * (1 - lp.patience)));
      if (rng.chance(prob)) redeemers.push(lp);
      else keep.push(lp);
    }
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
  const rankFrac = playerRankFraction(league);

  let repDelta = Math.max(-2, Math.min(2, monthReturn * 30));
  // Standing vs rivals: top of the table lifts reputation, bottom drags it.
  repDelta += (0.5 - rankFrac) * 0.6;
  repDelta -= pStep.marginCalled.length * 1.5;
  repDelta -= redeemedCount * 0.8;
  if (blackSwan && pStep.marginCalled.length === 0) repDelta += 0.5;
  if (Number.isFinite(metrics.netIrr) && metrics.netIrr > 0.15) repDelta += 0.2;
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

  const enterprise = firm.cash + fundNav + vcResidualValue(vc);

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

  // Grace periods so early bad luck can't end a run in the first year(s).
  // Ironman: no safety net — insolvency ends the run immediately.
  const insolvent = dp.ironman ? firm.cash < 0 : firm.cash < -2_000_000 && month >= 12;
  const ruined = reputation <= 0 && month >= 24;
  const horizon = month >= TOTAL_MONTHS;
  const gameOver = insolvent || ruined || horizon;
  let gameOverReason: GameOverReason | undefined;
  let finalScore: number | undefined;
  let finalGrade: string | undefined;
  if (gameOver) {
    gameOverReason = insolvent ? 'insolvency' : ruined ? 'reputation' : 'horizon';
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
          : { de: 'Vertrauen verspielt', en: 'Trust Lost' },
    );
    const desc = g(
      gameOverReason === 'horizon'
        ? { de: `Nach 20 Jahren: Unternehmenswert $${(enterprise / 1e6).toFixed(1)}M. Note ${finalGrade} (${finalScore}).`, en: `After 20 years: enterprise value $${(enterprise / 1e6).toFixed(1)}M. Grade ${finalGrade} (${finalScore}).` }
        : gameOverReason === 'insolvency'
          ? { de: 'Die Management-Gesellschaft ist pleite. Das Haus schließt.', en: 'The management company is bankrupt. The house closes.' }
          : { de: 'Die Reputation ist auf null gefallen — die LPs ziehen ab.', en: 'Reputation has fallen to zero — the LPs withdraw.' },
    );
    events.push(ev(month, { type: 'info', title, description: desc }));
  }

  // Decision card (not on the final month).
  const decisionState = { ...state, firm, portfolio, instruments, reputation } as SimState;
  const pendingDecision = gameOver ? undefined : maybeDecision(decisionState, blackSwan, rng);
  // Special opportunity (don't stack on top of a pending decision).
  const pendingOpportunity = gameOver || pendingDecision ? undefined : maybeOpportunity(reputation, month, portfolio.cash, rng);

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
    specialHoldings,
    vc,
    equityHistory: [...state.equityHistory, enterprise].slice(-TOTAL_MONTHS - 1),
    events: [...events, ...state.events].slice(0, 80),
    rngState: rng.getState(),
  };
}
