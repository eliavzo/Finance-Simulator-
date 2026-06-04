/**
 * Achievements / milestones — concrete things to chase. Each is evaluated every
 * month against the game state; once unlocked it stays unlocked. They're for
 * prestige and goal-setting (no mechanical reward), and locked ones stay visible
 * so the player always has something to aim for.
 */
import { SimState } from './types';

export interface AchievementContext {
  state: SimState;
  enterprise: number;
  fundNav: number;
  tvpi: number;
  netIrr: number;
  maxDrawdown: number;
  leagueRank: number;
  blackSwanSurvived: boolean;
  distinctKinds: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  test: (c: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'aum50', title: 'Erste 50 Mio.', description: 'Fonds-NAV erreicht $50M.', test: (c) => c.fundNav >= 50_000_000 },
  { id: 'aum100', title: 'Neunstellig', description: 'Fonds-NAV erreicht $100M.', test: (c) => c.fundNav >= 100_000_000 },
  { id: 'aum500', title: 'Schwergewicht', description: 'Fonds-NAV erreicht $500M.', test: (c) => c.fundNav >= 500_000_000 },
  { id: 'ent1b', title: 'Milliardärs-Club', description: 'Unternehmenswert erreicht $1 Mrd.', test: (c) => c.enterprise >= 1_000_000_000 },
  { id: 'tvpi2', title: 'Verdoppelt', description: 'TVPI erreicht 2,0x.', test: (c) => c.tvpi >= 2 },
  { id: 'tvpi3', title: 'Verdreifacht', description: 'TVPI erreicht 3,0x.', test: (c) => c.tvpi >= 3 },
  { id: 'irr20', title: 'Top-Quartil', description: 'Netto-IRR über 20%.', test: (c) => Number.isFinite(c.netIrr) && c.netIrr >= 0.2 },
  { id: 'rep_est', title: 'Etabliert', description: 'Reputation erreicht 70.', test: (c) => c.state.reputation >= 70 },
  { id: 'rep_titan', title: 'Titan der Branche', description: 'Reputation erreicht 85.', test: (c) => c.state.reputation >= 85 },
  { id: 'league1', title: 'An der Spitze', description: 'Platz 1 der Rangliste.', test: (c) => c.leagueRank === 1 },
  { id: 'team10', title: 'Großes Haus', description: '10 Mitarbeiter beschäftigt.', test: (c) => c.state.firm.employees.length >= 10 },
  { id: 'infra_max', title: 'State of the Art', description: 'Alle Infrastruktur auf Maximum.', test: (c) => {
    const i = c.state.firm.infrastructure;
    return i.dataTier >= 3 && i.primeBrokerTier >= 3 && i.quantTier >= 3 && i.officeTier >= 3;
  } },
  { id: 'diversified', title: 'Breit aufgestellt', description: 'Positionen in 4 Anlageklassen.', test: (c) => c.distinctKinds >= 4 },
  { id: 'swan', title: 'Sturmfest', description: 'Black Swan ohne Margin Call überstanden.', test: (c) => c.blackSwanSurvived },
  { id: 'mandates5', title: 'Verlässlich', description: '5 LP-Mandate erfüllt.', test: (c) => c.state.objectives.filter((o) => o.status === 'succeeded').length >= 5 },
  { id: 'ironhand', title: 'Eiserne Disziplin', description: 'Max Drawdown unter 10% nach 5 Jahren.', test: (c) => c.state.month >= 60 && c.maxDrawdown < 0.1 },
];

/** Return achievement ids newly satisfied this month (excluding already-unlocked). */
export function evaluateAchievements(ctx: AchievementContext, unlocked: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.test(ctx));
}
