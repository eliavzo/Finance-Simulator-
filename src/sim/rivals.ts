/**
 * Rival funds — AI competitors that run their own books, raise capital and rank
 * against the player in a league table. Beating them lifts your standing (and,
 * via reputation, your own fundraising); lagging them drags it.
 */
import { EconomyState, FundThesis, RivalFund } from './types';
import { THESES } from './thesis';
import { Rng } from '../engine/rng';

const RIVAL_NAMES = ['Brightwater', 'Kestrel Capital', 'Meridian Partners', 'Stonebridge', 'Aurelia Asset Mgmt', 'Falcon Point', 'Thornwood', 'Greylock Macro'];
const THESIS_KEYS: FundThesis[] = ['quant', 'macro', 'longshort', 'credit', 'multistrat'];

export function createRivals(rng: Rng): RivalFund[] {
  const names = [...RIVAL_NAMES];
  const out: RivalFund[] = [];
  const count = 5;
  for (let i = 0; i < count; i++) {
    const idx = rng.int(0, names.length - 1);
    const name = names.splice(idx, 1)[0];
    out.push({
      id: `rival-${i}`,
      name,
      thesis: rng.pick(THESIS_KEYS),
      aum: rng.range(15_000_000, 120_000_000),
      skill: rng.range(0.35, 0.85),
      reputation: rng.range(45, 75),
      ytdReturn: 0,
      monthlyReturns: [],
    });
  }
  return out;
}

let spawnCtr = 0;
/** A breakaway rival founded by a departing star (`skill` in [0,100]). */
export function spawnRival(founderName: string, skill: number, rng: Rng): RivalFund {
  spawnCtr += 1;
  const last = founderName.split(' ').slice(-1)[0] || founderName;
  return {
    id: `rival-spin-${spawnCtr}`,
    name: `${last} Capital`,
    thesis: rng.pick(THESIS_KEYS),
    aum: rng.range(8_000_000, 30_000_000),
    skill: Math.max(0.35, Math.min(0.95, skill / 100)),
    reputation: rng.range(40, 60),
    ytdReturn: 0,
    monthlyReturns: [],
  };
}

/** Trailing-N-month compounded return from a series of monthly returns. */
export function trailingReturn(returns: number[], n = 12): number {
  if (returns.length === 0) return 0;
  const slice = returns.slice(-n);
  return slice.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

/** Advance every rival one month. `skillBonus` (difficulty) sharpens them. */
export function stepRivals(rivals: RivalFund[], econ: EconomyState, rng: Rng, skillBonus = 0): RivalFund[] {
  const marketMonthly = (0.04 + econ.sentiment * 0.07 + (econ.gdpGrowth - 0.02) * 1.2 - (econ.policyRate - 0.03) * 0.6) / 12;
  const volMonthly = Math.max(0.02, econ.volIndex / 100 / Math.sqrt(12));

  return rivals.map((r) => {
    const alpha = (Math.min(0.95, r.skill + skillBonus) - 0.5) * 0.012; // skill edge per month
    const ret = rng.normal(marketMonthly + alpha, volMonthly * (0.8 + 0.6 * (1 - r.skill)));
    const aum = Math.max(2_000_000, r.aum * (1 + ret) * (1 + (r.reputation > 60 ? 0.004 : 0))); // perf + slow inflows
    const monthlyReturns = [...r.monthlyReturns, ret].slice(-12);
    const reputation = Math.max(0, Math.min(100, r.reputation + ret * 25 + rng.normal(0, 0.3)));
    return { ...r, aum, monthlyReturns, ytdReturn: trailingReturn(monthlyReturns, 12), reputation };
  });
}

export interface LeagueEntry {
  rank: number;
  name: string;
  trailingReturn: number;
  aum: number;
  isPlayer: boolean;
}

/** Build the ranked league table (by trailing 12-month return). */
export function buildLeague(rivals: RivalFund[], playerName: string, playerReturn: number, playerAum: number): LeagueEntry[] {
  const rows = [
    { name: playerName, trailingReturn: playerReturn, aum: playerAum, isPlayer: true },
    ...rivals.map((r) => ({ name: r.name, trailingReturn: r.ytdReturn, aum: r.aum, isPlayer: false })),
  ];
  rows.sort((a, b) => b.trailingReturn - a.trailingReturn);
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/** The player's rank fraction in [0,1] (0 = top). Used for reputation effects. */
export function playerRankFraction(league: LeagueEntry[]): number {
  const me = league.find((e) => e.isPlayer);
  if (!me || league.length <= 1) return 0.5;
  return (me.rank - 1) / (league.length - 1);
}
