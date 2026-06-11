/**
 * Difficulty: a composable "heat" system rather than a flat 1–3 slider.
 *
 * Each modifier has a level (mild / normal / hard / brutal) that nudges a
 * specific engine parameter and contributes heat points. Heat drives the
 * end-game score multiplier, so harder play is rewarded. Named presets set a
 * whole config; tweaking any knob makes it "Eigene".
 */
import { DifficultyConfig, DifficultyLevel } from './types';
import { Lang, Loc, tr } from '../i18n/lang';

export type ModifierKey = 'market' | 'capital' | 'fees' | 'rivals';

export const MODIFIER_LABEL: Record<ModifierKey, Loc> = {
  market: { de: 'Markt & Krisen', en: 'Market & Crises' },
  capital: { de: 'Kapital & Kosten', en: 'Capital & Costs' },
  fees: { de: 'Gebühren', en: 'Fees' },
  rivals: { de: 'Konkurrenz', en: 'Rivals' },
};

/** Level labels per modifier (index -1..2 → 0..3). */
export const LEVEL_LABEL: Record<ModifierKey, [Loc, Loc, Loc, Loc]> = {
  market: [
    { de: 'Ruhig', en: 'Calm' },
    { de: 'Normal', en: 'Normal' },
    { de: 'Rau', en: 'Rough' },
    { de: 'Brutal', en: 'Brutal' },
  ],
  capital: [
    { de: 'Üppig', en: 'Ample' },
    { de: 'Normal', en: 'Normal' },
    { de: 'Knapp', en: 'Tight' },
    { de: 'Notlage', en: 'Distress' },
  ],
  fees: [
    { de: 'Großzügig', en: 'Generous' },
    { de: 'Normal', en: 'Normal' },
    { de: 'Mager', en: 'Lean' },
    { de: 'Minimal', en: 'Minimal' },
  ],
  rivals: [
    { de: 'Schwach', en: 'Weak' },
    { de: 'Normal', en: 'Normal' },
    { de: 'Scharf', en: 'Sharp' },
    { de: 'Elite', en: 'Elite' },
  ],
};

/** Heat points contributed by a level (-1 mild … 2 brutal). */
const LEVEL_HEAT: Record<DifficultyLevel, number> = { '-1': -2, '0': 0, '1': 3, '2': 6 };

export const DEFAULT_DIFFICULTY: DifficultyConfig = { market: 0, capital: 0, fees: 0, rivals: 0, ironman: false };

export const PRESETS: { id: string; label: Loc; blurb: Loc; config: DifficultyConfig }[] = [
  {
    id: 'erbe',
    label: { de: 'Erbe', en: 'Heir' },
    blurb: { de: 'Viel Startkapital, ruhige Märkte, schwache Rivalen. Zum Reinkommen.', en: 'Plenty of starting capital, calm markets, weak rivals. To ease in.' },
    config: { market: -1, capital: -1, fees: -1, rivals: -1, ironman: false },
  },
  {
    id: 'aufsteiger',
    label: { de: 'Aufsteiger', en: 'Climber' },
    blurb: { de: 'Ausgewogen — das Standard-Erlebnis.', en: 'Balanced — the standard experience.' },
    config: { market: 0, capital: 0, fees: 0, rivals: 0, ironman: false },
  },
  {
    id: 'selfmade',
    label: { de: 'Selfmade', en: 'Self-Made' },
    blurb: { de: 'Knappes Kapital, magere Gebühren, raue Märkte, scharfe Konkurrenz.', en: 'Tight capital, lean fees, rough markets, sharp competition.' },
    config: { market: 1, capital: 1, fees: 1, rivals: 1, ironman: false },
  },
  {
    id: 'albtraum',
    label: { de: 'Albtraum', en: 'Nightmare' },
    blurb: { de: 'Alles brutal — plus Ironman: kein Zurücksetzen, sofortiges Aus bei Pleite.', en: 'Everything brutal — plus Ironman: no reset, instant game over on insolvency.' },
    config: { market: 2, capital: 2, fees: 2, rivals: 2, ironman: true },
  },
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

/** The preset matching a config, or undefined ("custom"). */
export function presetMatch(cfg: DifficultyConfig) {
  return PRESETS.find(
    (p) =>
      p.config.market === cfg.market &&
      p.config.capital === cfg.capital &&
      p.config.fees === cfg.fees &&
      p.config.rivals === cfg.rivals &&
      p.config.ironman === cfg.ironman,
  );
}

/** Localised name of the preset matching a config, or "Custom". */
export function presetLabel(cfg: DifficultyConfig, lang: Lang): string {
  const match = presetMatch(cfg);
  return match ? tr(lang, match.label) : tr(lang, { de: 'Eigene', en: 'Custom' });
}

export function heatLabel(heat: number, lang: Lang): string {
  if (heat >= 24) return tr(lang, { de: 'Höllisch', en: 'Hellish' });
  if (heat >= 14) return tr(lang, { de: 'Brutal', en: 'Brutal' });
  if (heat >= 6) return tr(lang, { de: 'Hart', en: 'Hard' });
  if (heat >= 1) return tr(lang, { de: 'Fordernd', en: 'Demanding' });
  if (heat <= -4) return tr(lang, { de: 'Entspannt', en: 'Relaxed' });
  return tr(lang, { de: 'Ausgewogen', en: 'Balanced' });
}

/* --------------------------- Meta progression ---------------------------- */

/** One finished run, archived for the cross-run history. */
export interface RunRecord {
  officeName: string;
  score: number;
  grade: string;
  /** Months survived. */
  months: number;
  reason: string;
  /** Heat of the difficulty the run was played on. */
  heat: number;
}

/** Persistent cross-run progress that unlocks harder modes. */
export interface MetaProgress {
  /** Cumulative end-of-run score earned across all games. */
  renommee: number;
  /** Number of runs that reached the full 20-year horizon. */
  horizonFinishes: number;
  /** Archive of finished runs (most recent first, bounded). */
  runs?: RunRecord[];
}

export const DEFAULT_META: MetaProgress = { renommee: 0, horizonFinishes: 0, runs: [] };

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
export function nextUnlockHint(meta: MetaProgress, lang: Lang): string {
  const m = meta ?? DEFAULT_META;
  if (m.renommee < UNLOCK_AT.hard) return tr(lang, { de: `„Hart" ab ${UNLOCK_AT.hard} Renommee`, en: `“Hard” at ${UNLOCK_AT.hard} renown` });
  if (m.renommee < UNLOCK_AT.brutal) return tr(lang, { de: `„Brutal" ab ${UNLOCK_AT.brutal} Renommee`, en: `“Brutal” at ${UNLOCK_AT.brutal} renown` });
  if (m.renommee < UNLOCK_AT.ironman || m.horizonFinishes < 1)
    return tr(lang, { de: `Ironman ab ${UNLOCK_AT.ironman} Renommee + 1 abgeschlossenem Lauf`, en: `Ironman at ${UNLOCK_AT.ironman} renown + 1 completed run` });
  return tr(lang, { de: 'Alles freigeschaltet', en: 'Everything unlocked' });
}

