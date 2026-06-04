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
import { REGIME_LABEL, stepEconomy } from './economy';
import { createInstruments, stepMarket } from './market';
import { THESES } from './thesis';
import { scenarioEconomy, applyScenarioToInstruments } from './scenarios';
import { generateObjective, metricValue, isMet, computeScore } from './objectives';
import { createRivals, stepRivals, buildLeague, trailingReturn, playerRankFraction } from './rivals';
import { maybeDecision } from './decisions';
import { FundThesis, GameOverReason, Scenario } from './types';
import { createPortfolio, portfolioNav, stepPortfolio } from './portfolio';
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
): SimState {
  evCounter = 0;
  const rng = new Rng(seed);
  const economy = scenarioEconomy(scenario);
  const instruments = applyScenarioToInstruments(scenario, createInstruments());
  const firm = createFirm('Dein Family Office', GP_RUNWAY, rng);

  let fund = createFund(0, ANCHOR_COMMITMENT, rng);
  // Two seed LPs join at launch, so the fund has enough AUM for fees to
  // support a lean team through the J-curve.
  const seedLPs = [createLP('Endowment', 12_000_000, rng), createLP('Pension', 13_000_000, rng)];
  const committed = ANCHOR_COMMITMENT + seedLPs.reduce((a, l) => a + l.committed, 0);
  const called = Math.min(INITIAL_CALL, committed);
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
    economy,
    instruments,
    portfolio,
    firm,
    fund,
    reputation: 50,
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
        title: 'Firma gegründet',
        description: `GP-Runway $${(GP_RUNWAY / 1e6).toFixed(1)}M · Fund committed $${(committed / 1e6).toFixed(0)}M (davon $${(called / 1e6).toFixed(0)}M abgerufen). Baue Track-Record auf, um mehr LP-Kapital zu raisen.`,
      }),
    ],
    rngState: rng.getState(),
  };
}

/** Total enterprise equity = GP cash + fund NAV. */
export function enterpriseEquity(state: SimState): number {
  return state.firm.cash + portfolioNav(state.portfolio, state.instruments);
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
  const month = state.month + 1;
  const events: SimEvent[] = [];
  const ledger: LedgerEntry[] = [];
  const post = (account: LedgerEntry['account'], amount: number, memo?: string) =>
    ledger.push({ month, account, amount, memo });

  // 1. Economy ---------------------------------------------------------------
  const { economy, regimeChanged } = stepEconomy(state.economy, rng);
  if (regimeChanged) {
    events.push(ev(month, {
      type: 'economy',
      title: `Konjunkturwende: ${REGIME_LABEL[economy.regime]}`,
      description: `BIP ${(economy.gdpGrowth * 100).toFixed(1)}%, Leitzins ${(economy.policyRate * 100).toFixed(1)}%, Vola-Index ${economy.volIndex.toFixed(0)}.`,
    }));
  }

  // 2. Market ----------------------------------------------------------------
  const { instruments, blackSwan } = stepMarket(state.instruments, economy, month, rng);
  if (blackSwan) {
    events.push(ev(month, { type: 'blackswan', title: '🦢 Black Swan', description: 'Ein extremer Schock erschüttert die Märkte – gehebelte Positionen sind in Gefahr.' }));
  }

  // 3. Trading book ----------------------------------------------------------
  const capabilities = firmCapabilities(state.firm, state.reputation, state.thesis);
  const pStep = stepPortfolio(state.portfolio, instruments, month, {
    policyRate: economy.policyRate,
    primeBrokerTier: state.firm.infrastructure.primeBrokerTier,
    capabilities,
    financingBonus: THESES[state.thesis].financingBonus,
  });
  let portfolio = pStep.portfolio;
  if (pStep.financingCost) post('financingCost', -pStep.financingCost);
  if (pStep.income) post('couponIncome', pStep.income);
  if (pStep.marginCalled.length > 0) {
    events.push(ev(month, { type: 'risk', title: 'Margin Call', description: `Zwangsliquidation: ${pStep.marginCalled.join(', ')}.` }));
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
    events.push(ev(month, { type: 'fund', title: 'Carry kristallisiert', description: `Performance-Fee von $${(carryRes.carry / 1e6).toFixed(2)}M an die GP ausgeschüttet.` }));
  }
  fundNav = portfolioNav(portfolio, instruments);

  // 5. Firm: payroll, opex, morale, attrition -------------------------------
  const profitable = pStep.alphaPnl + pStep.income - pStep.financingCost + fee > 0;
  const firmStep = stepFirm(firm, { openPositions: portfolio.positions.length, profitable, reputation: state.reputation }, rng);
  firm = firmStep.firm;
  firm = { ...firm, cash: firm.cash - firmStep.payroll - firmStep.infraOpex };
  post('salaries', -firmStep.payroll);
  post('infraOpex', -firmStep.infraOpex);
  for (const dep of firmStep.departures) {
    events.push(ev(month, { type: 'firm', title: 'Kündigung', description: `${dep.name} (${dep.role}) verlässt die Firma (Moral ${dep.morale.toFixed(0)}).` }));
  }
  if (firm.cash < 0) {
    events.push(ev(month, { type: 'firm', title: '⚠️ GP-Liquidität negativ', description: 'Die Management-Gesellschaft verbrennt Cash. Hebe Gebühren über mehr AUM oder reduziere Kosten.' }));
  }

  // 6. Tax on GP net income (monthly, on positive pre-tax) -------------------
  const preTax = fee + carryRes.carry - firmStep.payroll - firmStep.infraOpex;
  const tax = Math.max(0, preTax) * TAX_RATE;
  if (tax > 0) {
    firm = { ...firm, cash: firm.cash - tax };
    post('tax', -tax);
  }

  // 7. Fundraising -----------------------------------------------------------
  const metrics = fundMetrics(fund, fundNav, month);
  const newLP = tryRaiseCapital(fund, metrics, capabilities.fundraising, state.reputation, rng);
  if (newLP) {
    fund = { ...fund, committed: fund.committed + newLP.committed, lps: [...fund.lps, newLP] };
    events.push(ev(month, { type: 'fund', title: 'Neues LP-Commitment', description: `${newLP.name} (${newLP.type}) committed $${(newLP.committed / 1e6).toFixed(1)}M.` }));
  }

  // 8. Reputation ------------------------------------------------------------
  const prevNav = state.portfolio.navHistory[state.portfolio.navHistory.length - 1] ?? fundNav;
  const monthReturn = prevNav > 0 ? fundNav / prevNav - 1 : 0;

  // Rivals & league standing.
  const rivals = stepRivals(state.rivals, economy, rng);
  const playerTrailing = trailingReturn(portfolio.returnHistory, 12);
  const league = buildLeague(rivals, state.firm.name, playerTrailing, fundNav);
  const rankFrac = playerRankFraction(league);

  let repDelta = Math.max(-2, Math.min(2, monthReturn * 30));
  // Standing vs rivals: top of the table lifts reputation, bottom drags it.
  repDelta += (0.5 - rankFrac) * 0.6;
  repDelta -= pStep.marginCalled.length * 1.5;
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
      events.push(ev(month, {
        type: 'fund',
        title: `Mandat erfüllt: ${obj.title}`,
        description: `${obj.description} erreicht. +${obj.rewardReputation} Reputation${obj.rewardCapital > 0 ? `, +$${(obj.rewardCapital / 1e6).toFixed(0)}M Commitment` : ''}.`,
      }));
      return { ...obj, status: 'succeeded' as const };
    }
    reputation = Math.max(0, reputation - obj.penaltyReputation);
    events.push(ev(month, { type: 'fund', title: `Mandat verfehlt: ${obj.title}`, description: `${obj.description} nicht erreicht. −${obj.penaltyReputation} Reputation.` }));
    return { ...obj, status: 'failed' as const };
  });
  let activeCount = objectives.filter((o) => o.status === 'active').length;
  while (activeCount < 2 && month < TOTAL_MONTHS - 18) {
    const fresh = generateObjective(rng, month, reputation);
    objectives.push(fresh);
    activeCount += 1;
    events.push(ev(month, { type: 'fund', title: `Neues LP-Mandat: ${fresh.title}`, description: `${fresh.description} bis Monat ${fresh.deadlineMonth + 1}.` }));
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
    if (contribution.financingSaved >= 1_000) parts.push(`Finanzierung −$${(contribution.financingSaved / 1e3).toFixed(0)}K`);
    if (contribution.marginCallsPrevented > 0) parts.push(`${contribution.marginCallsPrevented} Margin Call(s) vermieden`);
    events.push(ev(month, { type: 'firm', title: 'Team-Beitrag', description: parts.join(' · ') }));
  }

  // 10. Statements -----------------------------------------------------------
  const positionsValue = portfolioNav(portfolio, instruments) - portfolio.cash;
  const incomeStatement: IncomeStatement = buildIncomeStatement(month, ledger);
  const balanceSheet = buildBalanceSheet({ month, firm, fund, fundCash: portfolio.cash, positionsValue });

  const enterprise = firm.cash + fundNav;
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
  const insolvent = firm.cash < -2_000_000 && month >= 12;
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
    const title = gameOverReason === 'horizon' ? 'Spielende' : gameOverReason === 'insolvency' ? 'GP zahlungsunfähig' : 'Vertrauen verspielt';
    const desc =
      gameOverReason === 'horizon'
        ? `Nach 20 Jahren: Unternehmenswert $${(enterprise / 1e6).toFixed(1)}M. Note ${finalGrade} (${finalScore}).`
        : gameOverReason === 'insolvency'
          ? 'Die Management-Gesellschaft ist pleite. Das Haus schließt.'
          : 'Die Reputation ist auf null gefallen — die LPs ziehen ab.';
    events.push(ev(month, { type: 'info', title, description: desc }));
  }

  // Decision card (not on the final month).
  const decisionState = { ...state, firm, portfolio, instruments, reputation } as SimState;
  const pendingDecision = gameOver ? undefined : maybeDecision(decisionState, blackSwan, rng);

  return {
    month,
    started: true,
    gameOver,
    gameOverReason,
    finalScore,
    finalGrade,
    thesis: state.thesis,
    scenario: state.scenario,
    economy,
    instruments,
    portfolio,
    firm,
    fund,
    reputation,
    rivals,
    objectives,
    signals,
    lastContribution: contribution,
    lastReport: report,
    incomeStatements: [incomeStatement, ...state.incomeStatements].slice(0, 36),
    balanceSheets: [balanceSheet, ...state.balanceSheets].slice(0, 36),
    ledger: [],
    pendingDecision,
    equityHistory: [...state.equityHistory, enterprise].slice(-TOTAL_MONTHS - 1),
    events: [...events, ...state.events].slice(0, 80),
    rngState: rng.getState(),
  };
}
