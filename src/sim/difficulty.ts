/**
 * Difficulty: a composable "heat" system rather than a flat 1–3 slider.
 *
 * Each modifier has a level (mild / normal / hard / brutal) that nudges a
 * specific engine parameter and contributes heat points. Heat drives the
 * end-game score multiplier, so harder play is rewarded. Named presets set a
 * whole config; tweaking any knob makes it "Eigene".
 */
import { DifficultyConfig, DifficultyLevel } from './types';

export type ModifierKey = 'market' | 'capital' | 'fees' | 'rivals';

export const MODIFIER_LABEL: Record<ModifierKey, string> = {
  market: 'Markt & Krisen',
  capital: 'Kapital & Kosten',
  fees: 'Gebühren',
  rivals: 'Konkurrenz',
};

/** Level labels per modifier (index -1..2 → 0..3). */
export const LEVEL_LABEL: Record<ModifierKey, [string, string, string, string]> = {
  market: ['Ruhig', 'Normal', 'Rau', 'Brutal'],
  capital: ['Üppig', 'Normal', 'Knapp', 'Notlage'],
  fees: ['Großzügig', 'Normal', 'Mager', 'Minimal'],
  rivals: ['Schwach', 'Normal', 'Scharf', 'Elite'],
};

/** Heat points contributed by a level (-1 mild … 2 brutal). */
const LEVEL_HEAT: Record<DifficultyLevel, number> = { '-1': -2, '0': 0, '1': 3, '2': 6 };

export const DEFAULT_DIFFICULTY: DifficultyConfig = { market: 0, capital: 0, fees: 0, rivals: 0, ironman: false };

export const PRESETS: { id: string; label: string; blurb: string; config: DifficultyConfig }[] = [
  { id: 'erbe', label: 'Erbe', blurb: 'Viel Startkapital, ruhige Märkte, schwache Rivalen. Zum Reinkommen.', config: { market: -1, capital: -1, fees: -1, rivals: -1, ironman: false } },
  { id: 'aufsteiger', label: 'Aufsteiger', blurb: 'Ausgewogen — das Standard-Erlebnis.', config: { market: 0, capital: 0, fees: 0, rivals: 0, ironman: false } },
  { id: 'selfmade', label: 'Selfmade', blurb: 'Knappes Kapital, magere Gebühren, raue Märkte, scharfe Konkurrenz.', config: { market: 1, capital: 1, fees: 1, rivals: 1, ironman: false } },
  { id: 'albtraum', label: 'Albtraum', blurb: 'Alles brutal — plus Ironman: kein Zurücksetzen, sofortiges Aus bei Pleite.', config: { market: 2, capital: 2, fees: 2, rivals: 2, ironman: true } },
];

export interface DifficultyParams {
  startCapitalMult: number;
  opexMult: number;
  feeMult: number;
  volMult: number;
  swanProbMult: number;
  crisisProbMult: number;
  rivalSkillBonus: number;
  ironman: boolean;
  heat: number;
  scoreMult: number;
}

const START_CAPITAL: Record<DifficultyLevel, number> = { '-1': 1.4, '0': 1, '1': 0.7, '2': 0.5 };
const OPEX: Record<DifficultyLevel, number> = { '-1': 0.9, '0': 1, '1': 1.15, '2': 1.3 };
const FEE: Record<DifficultyLevel, number> = { '-1': 1.3, '0': 1, '1': 0.7, '2': 0.5 };
const VOL: Record<DifficultyLevel, number> = { '-1': 0.85, '0': 1, '1': 1.25, '2': 1.5 };
const SHOCK: Record<DifficultyLevel, number> = { '-1': 0.5, '0': 1, '1': 1.7, '2': 2.5 };
const RIVAL: Record<DifficultyLevel, number> = { '-1': -0.1, '0': 0, '1': 0.12, '2': 0.22 };

export function difficultyParams(cfg: DifficultyConfig): DifficultyParams {
  const heat =
    LEVEL_HEAT[cfg.market] + LEVEL_HEAT[cfg.capital] + LEVEL_HEAT[cfg.fees] + LEVEL_HEAT[cfg.rivals] + (cfg.ironman ? 8 : 0);
  return {
    startCapitalMult: START_CAPITAL[cfg.capital],
    opexMult: OPEX[cfg.capital],
    feeMult: FEE[cfg.fees],
    volMult: VOL[cfg.market],
    swanProbMult: SHOCK[cfg.market],
    crisisProbMult: SHOCK[cfg.market],
    rivalSkillBonus: RIVAL[cfg.rivals],
    ironman: cfg.ironman,
    heat,
    scoreMult: Math.max(0.4, Math.min(3, 1 + heat * 0.05)),
  };
}

/** Name of the preset matching a config, or 'Eigene'. */
export function presetLabel(cfg: DifficultyConfig): string {
  const match = PRESETS.find(
    (p) =>
      p.config.market === cfg.market &&
      p.config.capital === cfg.capital &&
      p.config.fees === cfg.fees &&
      p.config.rivals === cfg.rivals &&
      p.config.ironman === cfg.ironman,
  );
  return match ? match.label : 'Eigene';
}

export function heatLabel(heat: number): string {
  if (heat >= 24) return 'Höllisch';
  if (heat >= 14) return 'Brutal';
  if (heat >= 6) return 'Hart';
  if (heat >= 1) return 'Fordernd';
  if (heat <= -4) return 'Entspannt';
  return 'Ausgewogen';
}

/* --------------------------- Meta progression ---------------------------- */

/** Persistent cross-run progress that unlocks harder modes. */
export interface MetaProgress {
  /** Cumulative end-of-run score earned across all games. */
  renommee: number;
  /** Number of runs that reached the full 20-year horizon. */
  horizonFinishes: number;
}

export const DEFAULT_META: MetaProgress = { renommee: 0, horizonFinishes: 0 };

/** Renommee thresholds for the unlocks. */
export const UNLOCK_AT = { hard: 150, brutal: 500, ironman: 500 };

export interface Unlocks {
  hard: boolean;
  brutal: boolean;
  ironman: boolean;
}

export function computeUnlocks(meta: MetaProgress): Unlocks {
  const m = meta ?? DEFAULT_META;
  return {
    hard: m.renommee >= UNLOCK_AT.hard,
    brutal: m.renommee >= UNLOCK_AT.brutal,
    // Ironman: enough renommee AND at least one completed (horizon) run.
    ironman: m.renommee >= UNLOCK_AT.ironman && m.horizonFinishes >= 1,
  };
}

/** Is a given modifier level selectable with the current unlocks? */
export function levelUnlocked(level: DifficultyLevel, u: Unlocks): boolean {
  if (level <= 0) return true; // Mild & Normal always available
  if (level === 1) return u.hard;
  return u.brutal; // level 2
}

/** Is a preset fully unlocked? */
export function presetUnlocked(cfg: DifficultyConfig, u: Unlocks): boolean {
  const levelsOk = (['market', 'capital', 'fees', 'rivals'] as ModifierKey[]).every((k) => levelUnlocked(cfg[k], u));
  return levelsOk && (!cfg.ironman || u.ironman);
}

/** Short text describing what's still needed to unlock the next thing. */
export function nextUnlockHint(meta: MetaProgress): string {
  const m = meta ?? DEFAULT_META;
  if (m.renommee < UNLOCK_AT.hard) return `„Hart" ab ${UNLOCK_AT.hard} Renommee`;
  if (m.renommee < UNLOCK_AT.brutal) return `„Brutal" ab ${UNLOCK_AT.brutal} Renommee`;
  if (m.renommee < UNLOCK_AT.ironman || m.horizonFinishes < 1)
    return `Ironman ab ${UNLOCK_AT.ironman} Renommee + 1 abgeschlossenem Lauf`;
  return 'Alles freigeschaltet';
}

