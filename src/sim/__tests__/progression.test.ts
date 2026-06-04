import { tierForReputation, tierPerks } from '../tiers';
import { evaluateAchievements, ACHIEVEMENTS } from '../achievements';
import { createSimGame, advanceMonth } from '../engine';
import { AchievementContext } from '../achievements';

describe('reputation tiers', () => {
  it('maps reputation to the right tier', () => {
    expect(tierForReputation(40)).toBe('boutique');
    expect(tierForReputation(60)).toBe('rising');
    expect(tierForReputation(75)).toBe('established');
    expect(tierForReputation(90)).toBe('titan');
  });

  it('unlocks more leverage & options with tier', () => {
    expect(tierPerks(50).maxLeverage).toBe(2);
    expect(tierPerks(50).allowOptions).toBe(false);
    expect(tierPerks(60).allowOptions).toBe(true);
    expect(tierPerks(90).maxLeverage).toBe(5);
    expect(tierPerks(90).lpTypes).toContain('SovereignWealth');
  });
});

describe('achievements', () => {
  const ctx = (over: Partial<AchievementContext>): AchievementContext => ({
    state: createSimGame(1),
    enterprise: 10_000_000,
    fundNav: 10_000_000,
    tvpi: 1,
    netIrr: 0,
    maxDrawdown: 0,
    leagueRank: 3,
    blackSwanSurvived: false,
    distinctKinds: 0,
    ...over,
  });

  it('unlocks an AUM milestone when crossed', () => {
    const got = evaluateAchievements(ctx({ fundNav: 60_000_000 }), new Set());
    expect(got.some((a) => a.id === 'aum50')).toBe(true);
  });

  it('does not re-award already-unlocked achievements', () => {
    const got = evaluateAchievements(ctx({ fundNav: 60_000_000 }), new Set(['aum50']));
    expect(got.some((a) => a.id === 'aum50')).toBe(false);
  });

  it('league #1 unlocks the standings achievement', () => {
    expect(evaluateAchievements(ctx({ leagueRank: 1 }), new Set()).some((a) => a.id === 'league1')).toBe(true);
  });

  it('every achievement has a unique id', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe('progression state', () => {
  it('initialises and carries peakReputation & achievements', () => {
    const g = createSimGame(7);
    expect(g.peakReputation).toBe(50);
    expect(g.achievements).toEqual([]);
    const next = advanceMonth(g);
    expect(next.peakReputation).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(next.achievements)).toBe(true);
  });
});
