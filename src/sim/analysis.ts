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

export function analyzeRun(state: SimState): AnalysisReport {
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
    weaknesses.push({ kind: 'bad', title: 'Chronisch übergehebelt', detail: `In ${pct(overLevFrac)} der Monate lag dein Brutto-Hebel über 2× (Spitze ${avgLev > 0 ? a.maxGrossLev.toFixed(1) : '—'}×). Das verstärkt Drawdowns und Margin-Call-Risiko.` });
  } else if (avgLev > 0.4 && marginCalls === 0) {
    strengths.push({ kind: 'good', title: 'Diszipliniertes Risiko', detail: `Du hast Hebel genutzt (Ø ${avgLev.toFixed(1)}×), aber keinen einzigen Margin Call kassiert.` });
  }
  if (marginCalls >= 3) {
    weaknesses.push({ kind: 'bad', title: `${marginCalls} Margin Calls`, detail: 'Mehrfach zwangsliquidiert — Positionsgrößen/Hebel waren zu aggressiv für deine Risikotragfähigkeit.' });
  }
  if (dd > 0.4) {
    weaknesses.push({ kind: 'bad', title: `Tiefer Drawdown (${pct(dd)})`, detail: 'Dein Buch fiel zwischenzeitlich stark. Mehr Diversifikation, weniger Hebel oder Absicherung hätten geholfen.' });
  } else if (dd < 0.15 && m > 24) {
    strengths.push({ kind: 'good', title: `Flacher Drawdown (${pct(dd)})`, detail: 'Du hast Verluste eng kontrolliert.' });
  }

  // --- Value discipline ---
  if (avgValGap > 0.04) {
    strengths.push({ kind: 'good', title: 'Value-Disziplin', detail: `Deine gehaltenen Aktien waren im Schnitt ${pct(avgValGap)} unter dem fairen Wert — du hast günstig gekauft.` });
  } else if (avgValGap < -0.04) {
    weaknesses.push({ kind: 'bad', title: 'Zu teuer eingekauft', detail: `Deine Aktien lagen im Schnitt ${pct(-avgValGap)} über dem fairen Wert. Achte auf die Bewertung (KGV/Fair Value) statt auf Momentum.` });
  }

  // --- Hedging / crises ---
  if (a.crisisMonths >= 3 && crisisHedgeRate < 0.3) {
    weaknesses.push({ kind: 'bad', title: 'Ungehedged durch Krisen', detail: `In ${a.crisisMonths} Krisenmonaten warst du fast nie abgesichert. Eine Tail-Absicherung vor/zu Krisenbeginn dämpft Verluste.` });
  } else if (a.crisisMonths > 0 && crisisHedgeRate >= 0.5) {
    strengths.push({ kind: 'good', title: 'Krisen abgesichert', detail: 'Du hattest in Krisen meist eine Absicherung aktiv — guter Instinkt fürs Abwärtsrisiko.' });
  }

  // --- Capital deployment ---
  if (avgCash > 0.55 && m > 24) {
    weaknesses.push({ kind: 'bad', title: 'Kapital lag brach', detail: `Im Schnitt ${pct(avgCash)} des Fonds lagen in Cash. Ungenutztes Kapital verschenkt Rendite (es deckt kaum die Gebühren).` });
  } else if (avgPositions < 0.5 && m > 12) {
    weaknesses.push({ kind: 'bad', title: 'Zu passiv', detail: 'Du hast kaum investiert. Das Spiel belohnt aktives, bewertungsgetriebenes Allokieren.' });
  }

  // --- GP economics ---
  if (gpProfitFrac < 0.4) {
    weaknesses.push({ kind: 'bad', title: 'GP defizitär', detail: `Nur in ${pct(gpProfitFrac)} der Monate war die Management-Gesellschaft profitabel. Gebühren (auf das AUM) deckten die Kosten (Gehälter/Infra) nicht.` });
  } else if (gpProfitFrac > 0.7) {
    strengths.push({ kind: 'good', title: 'Solide GP-Ökonomie', detail: `Die Firma war in ${pct(gpProfitFrac)} der Monate profitabel.` });
  }

  // --- LP relations ---
  if (a.redemptions > 0) {
    weaknesses.push({ kind: 'bad', title: 'Mittelabzüge', detail: `LPs zogen ${a.redemptions}× Kapital ab${a.redemptionLoss > 1000 ? ` und Notverkäufe kosteten ${money(a.redemptionLoss)}` : ''}. Halte einen Liquiditätspuffer und liefere Performance.` });
  }
  if (mandateRate >= 0.6 && objSucc >= 2) {
    strengths.push({ kind: 'good', title: 'Mandate erfüllt', detail: `Du hast ${objSucc} LP-Mandate erfüllt (Quote ${pct(mandateRate)}).` });
  } else if (objFail >= 2 && mandateRate < 0.5) {
    weaknesses.push({ kind: 'bad', title: 'Mandate verfehlt', detail: `${objFail} Mandate nicht erreicht — das kostete laufend Reputation.` });
  }

  // --- Performance quality ---
  if (Number.isFinite(sharpe) && sharpe > 0.7) {
    strengths.push({ kind: 'good', title: `Gute risikoadj. Rendite`, detail: `Sharpe ${sharpe.toFixed(2)} — solide Rendite pro Risikoeinheit.` });
  } else if (Number.isFinite(sharpe) && sharpe < 0 && m > 24) {
    weaknesses.push({ kind: 'bad', title: 'Negative Sharpe', detail: 'Deine Renditen lagen risikoadjustiert unter dem risikofreien Zins.' });
  }

  // --- Team ---
  if (state.firm.employees.length === 0 && m > 12) {
    weaknesses.push({ kind: 'bad', title: 'Kein Team', detail: 'Ohne Personal fehlen dir Research-Edge, Alpha und Risikokontrolle. Stelle früh Analysten & einen Risk Manager ein.' });
  }

  // --- Profile label ---
  const aggressive = overLevFrac > 0.4 || avgLev > 1.5;
  const passive = avgPositions < 1 || avgCash > 0.6;
  const valueDriven = avgValGap > 0.03;
  let profile = 'Ausgewogener Allocator';
  let profileBlurb = 'Du hast solide zwischen Risiko und Vorsicht balanciert.';
  if (aggressive && marginCalls >= 2) { profile = 'Aggressiver Zocker'; profileBlurb = 'Viel Hebel, große Wetten — hohe Varianz, oft am Rand des Margin Calls.'; }
  else if (aggressive) { profile = 'Mutiger Risikonehmer'; profileBlurb = 'Du hast beherzt Hebel eingesetzt und das Risiko (meist) im Griff gehabt.'; }
  else if (passive) { profile = 'Passiver Parker'; profileBlurb = 'Viel Cash, wenig Aktivität — sicher, aber renditearm.'; }
  else if (valueDriven) { profile = 'Disziplinierter Value-Investor'; profileBlurb = 'Du hast günstig gekauft und Risiko kontrolliert — der nachhaltige Weg.'; }

  // --- Failure explanation ---
  let failure: string | undefined;
  if (state.gameOverReason === 'insolvency') {
    failure = `Gescheitert an der Pleite der GP-Gesellschaft: Sie war nur in ${pct(gpProfitFrac)} der Monate profitabel — die Kostenbasis (Gehälter & Infrastruktur) überstieg die Gebühreneinnahmen. Ursachen: zu kleines/kaum gewachsenes AUM, zu hohe Fixkosten${marginCalls > 0 ? `, plus Verluste aus ${marginCalls} Margin Calls` : ''}. Lösung: AUM via Performance & Fundraising vergrößern und Kosten an die Einnahmen anpassen.`;
  } else if (state.gameOverReason === 'reputation') {
    failure = `Gescheitert am Reputationsverlust (auf 0): Treiber waren ${objFail > 0 ? `${objFail} verfehlte Mandate` : 'schwache Performance'}${a.redemptions > 0 ? `, ${a.redemptions} Mittelabzüge` : ''} und eine Platzierung hinter den Konkurrenzfonds. Liefere konstantere Renditen und erfülle die LP-Vorgaben.`;
  } else if (state.gameOverReason === 'horizon') {
    failure = undefined;
  }

  const summary = !state.gameOver
    ? `Zwischenstand nach ${a.months} Monaten: Unternehmenswert ${money(enterprise)} (${totalReturn >= 0 ? '+' : ''}${pct(totalReturn)}). Die Analyse wird mit jedem Monat aussagekräftiger.`
    : state.gameOverReason === 'horizon'
      ? `Du hast die vollen 20 Jahre überstanden: Endwert ${money(enterprise)} (${totalReturn >= 0 ? '+' : ''}${pct(totalReturn)}), Netto-IRR ${Number.isFinite(fm.netIrr) ? pct(fm.netIrr) : '—'}, Note ${state.finalGrade ?? '—'}.`
      : `Der Lauf endete vorzeitig nach ${a.months} Monaten bei einem Unternehmenswert von ${money(enterprise)}.`;

  return {
    profile,
    profileBlurb,
    summary,
    failure,
    strengths,
    weaknesses,
    metrics: [
      { label: 'Ø Brutto-Hebel', value: `${avgLev.toFixed(1)}×` },
      { label: 'Monate übergehebelt', value: pct(overLevFrac) },
      { label: 'Ø Bewertungslücke', value: `${avgValGap >= 0 ? '+' : ''}${pct(avgValGap)}` },
      { label: 'Ø Cash-Quote', value: pct(avgCash) },
      { label: 'Sharpe', value: Number.isFinite(sharpe) ? sharpe.toFixed(2) : '—' },
      { label: 'Max Drawdown', value: pct(dd) },
      { label: 'Margin Calls', value: `${marginCalls}` },
      { label: 'Mittelabzüge', value: `${a.redemptions}` },
      { label: 'GP profitabel', value: pct(gpProfitFrac) },
      { label: 'Mandate', value: `${objSucc}/${objSucc + objFail}` },
    ],
  };
}
