import { difficultyParams, presetLabel, PRESETS, DEFAULT_DIFFICULTY, computeUnlocks, levelUnlocked, presetUnlocked, UNLOCK_AT } from '../difficulty';
import { tr } from '../../i18n/lang';
import { createSimGame, advanceMonth, enterpriseEquity } from '../engine';
import { DifficultyConfig } from '../types';

const cfg = (over: Partial<DifficultyConfig> = {}): DifficultyConfig => ({ ...DEFAULT_DIFFICULTY, ...over });

describe('difficulty params', () => {
  it('normal config is neutral (heat 0, score ×1)', () => {
    const p = difficultyParams(DEFAULT_DIFFICULTY);
    expect(p.heat).toBe(0);
    expect(p.scoreMult).toBeCloseTo(1, 6);
    expect(p.startCapitalMult).toBe(1);
    expect(p.feeMult).toBe(1);
  });

  it('harder settings raise heat & score and tighten params', () => {
    const hard = difficultyParams(cfg({ market: 2, capital: 2, fees: 2 }));
    expect(hard.heat).toBeGreaterThan(0);
    expect(hard.scoreMult).toBeGreaterThan(1);
    expect(hard.startCapitalMult).toBeLessThan(1);
    expect(hard.feeMult).toBeLessThan(1);
    expect(hard.swanProbMult).toBeGreaterThan(1);
  });

  it('easier settings lower heat & score and loosen params', () => {
    const easy = difficultyParams(cfg({ market: -1, capital: -1, fees: -1, rivals: -1 }));
    expect(easy.heat).toBeLessThan(0);
    expect(easy.scoreMult).toBeLessThan(1);
    expect(easy.startCapitalMult).toBeGreaterThan(1);
  });

  it('ironman adds a big heat chunk', () => {
    expect(difficultyParams(cfg({ ironman: true })).heat).toBeGreaterThanOrEqual(8);
  });
});

describe('presets', () => {
  it('round-trip to their labels, deviations become Custom', () => {
    for (const p of PRESETS) {
      expect(presetLabel(p.config, 'de')).toBe(tr('de', p.label));
      expect(presetLabel(p.config, 'en')).toBe(tr('en', p.label));
    }
    expect(presetLabel(cfg({ market: 1 }), 'de')).toBe('Eigene');
    expect(presetLabel(cfg({ market: 1 }), 'en')).toBe('Custom');
  });
});

describe('meta-progression unlocks', () => {
  it('renommee thresholds unlock hard then brutal', () => {
    expect(computeUnlocks({ renommee: 0, horizonFinishes: 0 })).toEqual({ hard: false, brutal: false, ironman: false });
    expect(computeUnlocks({ renommee: UNLOCK_AT.hard, horizonFinishes: 0 }).hard).toBe(true);
    expect(computeUnlocks({ renommee: UNLOCK_AT.brutal, horizonFinishes: 0 }).brutal).toBe(true);
  });

  it('ironman also needs a completed (horizon) run', () => {
    expect(computeUnlocks({ renommee: UNLOCK_AT.ironman, horizonFinishes: 0 }).ironman).toBe(false);
    expect(computeUnlocks({ renommee: UNLOCK_AT.ironman, horizonFinishes: 1 }).ironman).toBe(true);
  });

  it('levels gate by unlock', () => {
    const none = { hard: false, brutal: false, ironman: false };
    const all = { hard: true, brutal: true, ironman: true };
    expect(levelUnlocked(-1, none)).toBe(true);
    expect(levelUnlocked(0, none)).toBe(true);
    expect(levelUnlocked(1, none)).toBe(false);
    expect(levelUnlocked(1, all)).toBe(true);
    expect(levelUnlocked(2, { hard: true, brutal: false, ironman: false })).toBe(false);
  });

  it('presets gate correctly', () => {
    const none = { hard: false, brutal: false, ironman: false };
    const all = { hard: true, brutal: true, ironman: true };
    const byId = (id: string) => PRESETS.find((p) => p.id === id)!.config;
    expect(presetUnlocked(byId('erbe'), none)).toBe(true);
    expect(presetUnlocked(byId('aufsteiger'), none)).toBe(true);
    expect(presetUnlocked(byId('selfmade'), none)).toBe(false);
    expect(presetUnlocked(byId('selfmade'), { hard: true, brutal: false, ironman: false })).toBe(true);
    expect(presetUnlocked(byId('albtraum'), none)).toBe(false);
    expect(presetUnlocked(byId('albtraum'), all)).toBe(true);
  });
});

describe('difficulty in the engine', () => {
  it('scarce capital means a smaller start than flush', () => {
    const flush = createSimGame(1, 'multistrat', 'normal', 'A', cfg({ capital: -1 }));
    const tight = createSimGame(1, 'multistrat', 'normal', 'A', cfg({ capital: 2 }));
    expect(enterpriseEquity(flush)).toBeGreaterThan(enterpriseEquity(tight));
  });

  it('ironman ends the run on insolvency without a grace period', () => {
    const g = createSimGame(1, 'multistrat', 'normal', 'A', cfg({ ironman: true }));
    const broke = { ...g, firm: { ...g.firm, cash: -5_000_000 } };
    const next = advanceMonth(broke);
    expect(next.gameOver).toBe(true);
    expect(next.gameOverReason).toBe('insolvency');
  });
});
