/**
 * End-of-run analysis & coaching.
 *
 * Turns the behaviour aggregates collected during a run (plus the final state)
 * into a structured, plain-language report: a behaviour profile, concrete
 * strengths and weaknesses, and — if the run ended early — exactly why it failed.
 * Pure and rule-based.
 */
import { RunAnalytics, SimState } from './types';
import { sharpeRatio, maxDrawdown } from '../engine/finance';
import { portfolioNav } from './portfolio';
import { fundMetrics } from './fund';
import { vcResidualValue } from './vc';
import { Lang, tr } from '../i18n/lang';

export const EMPTY_ANALYTICS: RunAnalytics = {
  months: 0,
  grossLevSum: 0,
  maxGrossLev: 0,
  monthsOverLev: 0,
  monthsHedged: 0,
  crisisMonths: 0,
  crisisMonthsHedged: 0,
  redemptions: 0,
  redemptionLoss: 0,
  cashQuoteSum: 0,
  valuationGapSum: 0,
  valuationSamples: 0,
  gpProfitMonths: 0,
  positionsSum: 0,
};

export interface Finding {
  kind: 'good' | 'bad' | 'neutral';
  title: string;
  detail: string;
}

export interface AnalysisReport {
  profile: string;
  profileBlurb: string;
  summary: string;
  failure?: string;
  strengths: Finding[];
  weaknesses: Finding[];
  /** Headline metrics for display. */
  metrics: { label: string; value: string }[];
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const money = (x: number) => `$${(x / 1e6).toFixed(1)}M`;

export function analyzeRun(state: SimState, lang: Lang = 'en'): AnalysisReport {
  const L = (de: string, en: string) => tr(lang, { de, en });
  const a = state.analytics ?? EMPTY_ANALYTICS;
  const m = Math.max(1, a.months);
  const nav = portfolioNav(state.portfolio, state.instruments);
  const fm = fundMetrics(state.fund, nav, state.month);
  const enterprise = state.firm.cash + nav + vcResidualValue(state.vc);
  const start = state.equityHistory[0] ?? enterprise;
  const totalReturn = enterprise / start - 1;

  const avgLev = a.grossLevSum / m;
  const overLevFrac = a.monthsOverLev / m;
  const hedgedFrac = a.monthsHedged / m;
  const crisisHedgeRate = a.crisisMonths > 0 ? a.crisisMonthsHedged / a.crisisMonths : 1;
  const avgCash = a.cashQuoteSum / m;
  const avgValGap = a.valuationSamples > 0 ? a.valuationGapSum / a.valuationSamples : 0;
  const gpProfitFrac = a.gpProfitMonths / m;
  const avgPositions = a.positionsSum / m;
  const sharpe = state.portfolio.returnHistory.length >= 12 ? sharpeRatio(state.portfolio.returnHistory, state.economy.policyRate, 12) : NaN;
  const dd = maxDrawdown(state.portfolio.navHistory);
  const marginCalls = state.portfolio.marginCalls;
  const objSucc = state.objectives.filter((o) => o.status === 'succeeded').length;
  const objFail = state.objectives.filter((o) => o.status === 'failed').length;
  const mandateRate = objSucc + objFail > 0 ? objSucc / (objSucc + objFail) : 1;

  const strengths: Finding[] = [];
  const weaknesses: Finding[] = [];

  // --- Leverage & risk ---
  if (overLevFrac > 0.5) {
    weaknesses.push({ kind: 'bad', title: L('Chronisch übergehebelt', 'Chronically over-levered'), detail: L(`In ${pct(overLevFrac)} der Monate lag dein Brutto-Hebel über 2× (Spitze ${avgLev > 0 ? a.maxGrossLev.toFixed(1) : '—'}×). Das verstärkt Drawdowns und Margin-Call-Risiko.`, `In ${pct(overLevFrac)} of months your gross leverage was above 2× (peak ${avgLev > 0 ? a.maxGrossLev.toFixed(1) : '—'}×). That amplifies drawdowns and margin-call risk.`) });
  } else if (avgLev > 0.4 && marginCalls === 0) {
    strengths.push({ kind: 'good', title: L('Diszipliniertes Risiko', 'Disciplined risk'), detail: L(`Du hast Hebel genutzt (Ø ${avgLev.toFixed(1)}×), aber keinen einzigen Margin Call kassiert.`, `You used leverage (avg ${avgLev.toFixed(1)}×) without taking a single margin call.`) });
  }
  if (marginCalls >= 3) {
    weaknesses.push({ kind: 'bad', title: L(`${marginCalls} Margin Calls`, `${marginCalls} margin calls`), detail: L('Mehrfach zwangsliquidiert — Positionsgrößen/Hebel waren zu aggressiv für deine Risikotragfähigkeit.', 'Force-liquidated repeatedly — position sizes/leverage were too aggressive for your risk capacity.') });
  }
  if (dd > 0.4) {
    weaknesses.push({ kind: 'bad', title: L(`Tiefer Drawdown (${pct(dd)})`, `Deep drawdown (${pct(dd)})`), detail: L('Dein Buch fiel zwischenzeitlich stark. Mehr Diversifikation, weniger Hebel oder Absicherung hätten geholfen.', 'Your book fell sharply at times. More diversification, less leverage or some hedging would have helped.') });
  } else if (dd < 0.15 && m > 24) {
    strengths.push({ kind: 'good', title: L(`Flacher Drawdown (${pct(dd)})`, `Shallow drawdown (${pct(dd)})`), detail: L('Du hast Verluste eng kontrolliert.', 'You kept losses tightly controlled.') });
  }

  // --- Value discipline ---
  if (avgValGap > 0.04) {
    strengths.push({ kind: 'good', title: L('Value-Disziplin', 'Value discipline'), detail: L(`Deine gehaltenen Aktien waren im Schnitt ${pct(avgValGap)} unter dem fairen Wert — du hast günstig gekauft.`, `Your held equities averaged ${pct(avgValGap)} below fair value — you bought cheap.`) });
  } else if (avgValGap < -0.04) {
    weaknesses.push({ kind: 'bad', title: L('Zu teuer eingekauft', 'Bought too expensive'), detail: L(`Deine Aktien lagen im Schnitt ${pct(-avgValGap)} über dem fairen Wert. Achte auf die Bewertung (KGV/Fair Value) statt auf Momentum.`, `Your equities averaged ${pct(-avgValGap)} above fair value. Watch valuation (P/E / fair value) instead of momentum.`) });
  }

  // --- Hedging / crises ---
  if (a.crisisMonths >= 3 && crisisHedgeRate < 0.3) {
    weaknesses.push({ kind: 'bad', title: L('Ungehedged durch Krisen', 'Unhedged through crises'), detail: L(`In ${a.crisisMonths} Krisenmonaten warst du fast nie abgesichert. Eine Tail-Absicherung vor/zu Krisenbeginn dämpft Verluste.`, `Across ${a.crisisMonths} crisis months you were almost never hedged. A tail hedge before/at the onset of a crisis cushions losses.`) });
  } else if (a.crisisMonths > 0 && crisisHedgeRate >= 0.5) {
    strengths.push({ kind: 'good', title: L('Krisen abgesichert', 'Hedged the crises'), detail: L('Du hattest in Krisen meist eine Absicherung aktiv — guter Instinkt fürs Abwärtsrisiko.', 'You usually had a hedge on during crises — good instinct for downside risk.') });
  }

  // --- Capital deployment ---
  if (avgCash > 0.55 && m > 24) {
    weaknesses.push({ kind: 'bad', title: L('Kapital lag brach', 'Capital sat idle'), detail: L(`Im Schnitt ${pct(avgCash)} des Fonds lagen in Cash. Ungenutztes Kapital verschenkt Rendite (es deckt kaum die Gebühren).`, `On average ${pct(avgCash)} of the fund sat in cash. Idle capital gives up return (it barely covers the fees).`) });
  } else if (avgPositions < 0.5 && m > 12) {
    weaknesses.push({ kind: 'bad', title: L('Zu passiv', 'Too passive'), detail: L('Du hast kaum investiert. Das Spiel belohnt aktives, bewertungsgetriebenes Allokieren.', 'You barely invested. The game rewards active, valuation-driven allocation.') });
  }

  // --- GP economics ---
  if (gpProfitFrac < 0.4) {
    weaknesses.push({ kind: 'bad', title: L('GP defizitär', 'GP running at a loss'), detail: L(`Nur in ${pct(gpProfitFrac)} der Monate war die Management-Gesellschaft profitabel. Gebühren (auf das AUM) deckten die Kosten (Gehälter/Infra) nicht.`, `The management company was profitable in only ${pct(gpProfitFrac)} of months. Fees (on AUM) didn't cover costs (salaries/infra).`) });
  } else if (gpProfitFrac > 0.7) {
    strengths.push({ kind: 'good', title: L('Solide GP-Ökonomie', 'Solid GP economics'), detail: L(`Die Firma war in ${pct(gpProfitFrac)} der Monate profitabel.`, `The firm was profitable in ${pct(gpProfitFrac)} of months.`) });
  }

  // --- LP relations ---
  if (a.redemptions > 0) {
    weaknesses.push({ kind: 'bad', title: L('Mittelabzüge', 'Redemptions'), detail: L(`LPs zogen ${a.redemptions}× Kapital ab${a.redemptionLoss > 1000 ? ` und Notverkäufe kosteten ${money(a.redemptionLoss)}` : ''}. Abzüge entstehen durch Underperformance gegenüber der LP-Erwartung, nicht durch zu wenig Cash — liefere Rendite über deren Ziel. Ein kleiner Puffer hilft nur, Notverkaufs-Verluste zu vermeiden, wenn doch abgezogen wird.`, `LPs redeemed ${a.redemptions}× ${a.redemptionLoss > 1000 ? `and forced sales cost ${money(a.redemptionLoss)}` : ''}. Redemptions come from underperforming the LPs' expectation, not from holding too little cash — deliver returns above their target. A small buffer only helps avoid fire-sale losses when a redemption does hit.`) });
  }
  if (mandateRate >= 0.6 && objSucc >= 2) {
    strengths.push({ kind: 'good', title: L('Mandate erfüllt', 'Mandates met'), detail: L(`Du hast ${objSucc} LP-Mandate erfüllt (Quote ${pct(mandateRate)}).`, `You met ${objSucc} LP mandates (hit rate ${pct(mandateRate)}).`) });
  } else if (objFail >= 2 && mandateRate < 0.5) {
    weaknesses.push({ kind: 'bad', title: L('Mandate verfehlt', 'Mandates missed'), detail: L(`${objFail} Mandate nicht erreicht — das kostete laufend Reputation.`, `${objFail} mandates missed — that cost reputation over time.`) });
  }

  // --- Performance quality ---
  if (Number.isFinite(sharpe) && sharpe > 0.7) {
    strengths.push({ kind: 'good', title: L('Gute risikoadj. Rendite', 'Good risk-adjusted return'), detail: L(`Sharpe ${sharpe.toFixed(2)} — solide Rendite pro Risikoeinheit.`, `Sharpe ${sharpe.toFixed(2)} — solid return per unit of risk.`) });
  } else if (Number.isFinite(sharpe) && sharpe < 0 && m > 24) {
    weaknesses.push({ kind: 'bad', title: L('Negative Sharpe', 'Negative Sharpe'), detail: L('Deine Renditen lagen risikoadjustiert unter dem risikofreien Zins.', 'Risk-adjusted, your returns trailed the risk-free rate.') });
  }

  // --- Team ---
  if (state.firm.employees.length === 0 && m > 12) {
    weaknesses.push({ kind: 'bad', title: L('Kein Team', 'No team'), detail: L('Ohne Personal fehlen dir Research-Edge, Alpha und Risikokontrolle. Stelle früh Analysten & einen Risk Manager ein.', 'Without staff you lack a research edge, alpha and risk control. Hire analysts and a risk manager early.') });
  }

  // --- Profile label ---
  const aggressive = overLevFrac > 0.4 || avgLev > 1.5;
  const passive = avgPositions < 1 || avgCash > 0.6;
  const valueDriven = avgValGap > 0.03;
  let profile = L('Ausgewogener Allocator', 'Balanced Allocator');
  let profileBlurb = L('Du hast solide zwischen Risiko und Vorsicht balanciert.', 'You balanced risk and caution solidly.');
  if (aggressive && marginCalls >= 2) { profile = L('Aggressiver Zocker', 'Aggressive Gambler'); profileBlurb = L('Viel Hebel, große Wetten — hohe Varianz, oft am Rand des Margin Calls.', 'Heavy leverage, big bets — high variance, often on the edge of a margin call.'); }
  else if (aggressive) { profile = L('Mutiger Risikonehmer', 'Bold Risk-Taker'); profileBlurb = L('Du hast beherzt Hebel eingesetzt und das Risiko (meist) im Griff gehabt.', 'You used leverage boldly and (mostly) kept the risk in hand.'); }
  else if (passive) { profile = L('Passiver Parker', 'Passive Parker'); profileBlurb = L('Viel Cash, wenig Aktivität — sicher, aber renditearm.', 'Lots of cash, little activity — safe but low-return.'); }
  else if (valueDriven) { profile = L('Disziplinierter Value-Investor', 'Disciplined Value Investor'); profileBlurb = L('Du hast günstig gekauft und Risiko kontrolliert — der nachhaltige Weg.', 'You bought cheap and controlled risk — the sustainable path.'); }

  // --- Failure explanation ---
  let failure: string | undefined;
  if (state.gameOverReason === 'insolvency') {
    failure = L(
      `Gescheitert an der Pleite der GP-Gesellschaft: Sie war nur in ${pct(gpProfitFrac)} der Monate profitabel — die Kostenbasis (Gehälter & Infrastruktur) überstieg die Gebühreneinnahmen. Ursachen: zu kleines/kaum gewachsenes AUM, zu hohe Fixkosten${marginCalls > 0 ? `, plus Verluste aus ${marginCalls} Margin Calls` : ''}. Lösung: AUM via Performance & Fundraising vergrößern und Kosten an die Einnahmen anpassen.`,
      `Failed on the insolvency of the GP company: it was profitable in only ${pct(gpProfitFrac)} of months — the cost base (salaries & infrastructure) exceeded fee income. Causes: too small / barely grown AUM, fixed costs too high${marginCalls > 0 ? `, plus losses from ${marginCalls} margin calls` : ''}. Fix: grow AUM via performance & fundraising and size costs to income.`,
    );
  } else if (state.gameOverReason === 'reputation') {
    failure = L(
      `Gescheitert am Reputationsverlust (auf 0): Treiber waren ${objFail > 0 ? `${objFail} verfehlte Mandate` : 'schwache Performance'}${a.redemptions > 0 ? `, ${a.redemptions} Mittelabzüge` : ''} und eine Platzierung hinter den Konkurrenzfonds. Liefere konstantere Renditen und erfülle die LP-Vorgaben.`,
      `Failed on loss of reputation (to 0): drivers were ${objFail > 0 ? `${objFail} missed mandates` : 'weak performance'}${a.redemptions > 0 ? `, ${a.redemptions} redemptions` : ''} and finishing behind the rival funds. Deliver more consistent returns and meet the LP targets.`,
    );
  } else if (state.gameOverReason === 'horizon') {
    failure = undefined;
  }

  const summary = !state.gameOver
    ? L(
        `Zwischenstand nach ${a.months} Monaten: Unternehmenswert ${money(enterprise)} (${totalReturn >= 0 ? '+' : ''}${pct(totalReturn)}). Die Analyse wird mit jedem Monat aussagekräftiger.`,
        `Interim standing after ${a.months} months: enterprise value ${money(enterprise)} (${totalReturn >= 0 ? '+' : ''}${pct(totalReturn)}). The analysis gets more meaningful every month.`,
      )
    : state.gameOverReason === 'horizon'
      ? L(
          `Du hast die vollen 20 Jahre überstanden: Endwert ${money(enterprise)} (${totalReturn >= 0 ? '+' : ''}${pct(totalReturn)}), Netto-IRR ${Number.isFinite(fm.netIrr) ? pct(fm.netIrr) : '—'}, Note ${state.finalGrade ?? '—'}.`,
          `You made it through the full 20 years: final value ${money(enterprise)} (${totalReturn >= 0 ? '+' : ''}${pct(totalReturn)}), net IRR ${Number.isFinite(fm.netIrr) ? pct(fm.netIrr) : '—'}, grade ${state.finalGrade ?? '—'}.`,
        )
      : L(
          `Der Lauf endete vorzeitig nach ${a.months} Monaten bei einem Unternehmenswert von ${money(enterprise)}.`,
          `The run ended early after ${a.months} months at an enterprise value of ${money(enterprise)}.`,
        );

  return {
    profile,
    profileBlurb,
    summary,
    failure,
    strengths,
    weaknesses,
    metrics: [
      { label: L('Ø Brutto-Hebel', 'Avg gross leverage'), value: `${avgLev.toFixed(1)}×` },
      { label: L('Monate übergehebelt', 'Months over-levered'), value: pct(overLevFrac) },
      { label: L('Ø Bewertungslücke', 'Avg valuation gap'), value: `${avgValGap >= 0 ? '+' : ''}${pct(avgValGap)}` },
      { label: L('Ø Cash-Quote', 'Avg cash ratio'), value: pct(avgCash) },
      { label: L('Sharpe', 'Sharpe'), value: Number.isFinite(sharpe) ? sharpe.toFixed(2) : '—' },
      { label: L('Max Drawdown', 'Max drawdown'), value: pct(dd) },
      { label: L('Margin Calls', 'Margin calls'), value: `${marginCalls}` },
      { label: L('Mittelabzüge', 'Redemptions'), value: `${a.redemptions}` },
      { label: L('GP profitabel', 'GP profitable'), value: pct(gpProfitFrac) },
      { label: L('Mandate', 'Mandates'), value: `${objSucc}/${objSucc + objFail}` },
    ],
  };
}
