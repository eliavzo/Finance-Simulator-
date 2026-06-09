/**
 * Achievements / milestones — concrete things to chase. Each is evaluated every
 * month against the game state; once unlocked it stays unlocked. They're for
 * prestige and goal-setting (no mechanical reward), and locked ones stay visible
 * so the player always has something to aim for.
 */
import { SimState } from './types';
import { Loc } from '../i18n/lang';

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
  title: Loc;
  description: Loc;
  test: (c: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'aum50', title: { de: 'Erste 50 Mio.', en: 'First $50M' }, description: { de: 'Fonds-NAV erreicht $50M.', en: 'Fund NAV reaches $50M.' }, test: (c) => c.fundNav >= 50_000_000 },
  { id: 'aum100', title: { de: 'Neunstellig', en: 'Nine Figures' }, description: { de: 'Fonds-NAV erreicht $100M.', en: 'Fund NAV reaches $100M.' }, test: (c) => c.fundNav >= 100_000_000 },
  { id: 'aum500', title: { de: 'Schwergewicht', en: 'Heavyweight' }, description: { de: 'Fonds-NAV erreicht $500M.', en: 'Fund NAV reaches $500M.' }, test: (c) => c.fundNav >= 500_000_000 },
  { id: 'ent1b', title: { de: 'Milliardärs-Club', en: 'Billionaires’ Club' }, description: { de: 'Unternehmenswert erreicht $1 Mrd.', en: 'Enterprise value reaches $1B.' }, test: (c) => c.enterprise >= 1_000_000_000 },
  { id: 'tvpi2', title: { de: 'Verdoppelt', en: 'Doubled' }, description: { de: 'TVPI erreicht 2,0x.', en: 'TVPI reaches 2.0x.' }, test: (c) => c.tvpi >= 2 },
  { id: 'tvpi3', title: { de: 'Verdreifacht', en: 'Tripled' }, description: { de: 'TVPI erreicht 3,0x.', en: 'TVPI reaches 3.0x.' }, test: (c) => c.tvpi >= 3 },
  { id: 'irr20', title: { de: 'Top-Quartil', en: 'Top Quartile' }, description: { de: 'Netto-IRR über 20%.', en: 'Net IRR above 20%.' }, test: (c) => Number.isFinite(c.netIrr) && c.netIrr >= 0.2 },
  { id: 'rep_est', title: { de: 'Etabliert', en: 'Established' }, description: { de: 'Reputation erreicht 70.', en: 'Reputation reaches 70.' }, test: (c) => c.state.reputation >= 70 },
  { id: 'rep_titan', title: { de: 'Titan der Branche', en: 'Industry Titan' }, description: { de: 'Reputation erreicht 85.', en: 'Reputation reaches 85.' }, test: (c) => c.state.reputation >= 85 },
  { id: 'league1', title: { de: 'An der Spitze', en: 'At the Top' }, description: { de: 'Platz 1 der Rangliste.', en: 'Rank 1 on the league table.' }, test: (c) => c.leagueRank === 1 },
  { id: 'team10', title: { de: 'Großes Haus', en: 'Big House' }, description: { de: '10 Mitarbeiter beschäftigt.', en: '10 employees on the payroll.' }, test: (c) => c.state.firm.employees.length >= 10 },
  { id: 'infra_max', title: { de: 'State of the Art', en: 'State of the Art' }, description: { de: 'Alle Infrastruktur auf Maximum.', en: 'All infrastructure maxed out.' }, test: (c) => {
    const i = c.state.firm.infrastructure;
    return i.dataTier >= 3 && i.primeBrokerTier >= 3 && i.quantTier >= 3 && i.officeTier >= 3;
  } },
  { id: 'diversified', title: { de: 'Breit aufgestellt', en: 'Diversified' }, description: { de: 'Positionen in 4 Anlageklassen.', en: 'Positions across 4 asset classes.' }, test: (c) => c.distinctKinds >= 4 },
  { id: 'swan', title: { de: 'Sturmfest', en: 'Storm-Proof' }, description: { de: 'Black Swan ohne Margin Call überstanden.', en: 'Survived a Black Swan with no margin call.' }, test: (c) => c.blackSwanSurvived },
  { id: 'mandates5', title: { de: 'Verlässlich', en: 'Reliable' }, description: { de: '5 LP-Mandate erfüllt.', en: 'Fulfilled 5 LP mandates.' }, test: (c) => c.state.objectives.filter((o) => o.status === 'succeeded').length >= 5 },
  { id: 'ironhand', title: { de: 'Eiserne Disziplin', en: 'Iron Discipline' }, description: { de: 'Max Drawdown unter 10% nach 5 Jahren.', en: 'Max drawdown under 10% after 5 years.' }, test: (c) => c.state.month >= 60 && c.maxDrawdown < 0.1 },
];

/** Return achievement ids newly satisfied this month (excluding already-unlocked). */
export function evaluateAchievements(ctx: AchievementContext, unlocked: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.test(ctx));
}
