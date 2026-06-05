import { difficultyParams, presetLabel, PRESETS, DEFAULT_DIFFICULTY } from '../difficulty';
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
  it('round-trip to their labels, deviations become Eigene', () => {
    for (const p of PRESETS) expect(presetLabel(p.config)).toBe(p.label);
    expect(presetLabel(cfg({ market: 1 }))).toBe('Eigene');
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
