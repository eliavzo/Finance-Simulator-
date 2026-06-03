/**
 * Derives the aggregate {@link PortfolioMetrics} surfaced on the dashboard and
 * charts from the raw {@link GameState}. Pure and cheap; safe to call in render.
 */
import { GameState, PortfolioMetrics } from '../models/types';
import { hedgeFundNav, hedgeFundRiskMetrics } from './hedgefund';
import { vcMetrics } from './vc';

export function computeMetrics(state: GameState): PortfolioMetrics {
  const hfNav = hedgeFundNav(state.hedgeFund, state.assets);
  const risk = hedgeFundRiskMetrics(state.hedgeFund, state.macro.interestRate);
  const vc = vcMetrics(state.vc, state.quarter);

  return {
    totalEquity: hfNav + vc.nav,
    hedgeFundNav: hfNav,
    vcNav: vc.nav,
    cash: state.hedgeFund.cash + state.vc.cash,
    sharpe: risk.sharpe,
    maxDrawdown: risk.maxDrawdown,
    var95: risk.var95,
    vcIrr: vc.irr,
    tvpi: vc.tvpi,
    moic: vc.moic,
  };
}
