/**
 * Mutators — optional roguelike rule-flips chosen before a run. Each makes the
 * game harder in a specific way and, like the difficulty "heat", multiplies the
 * end-of-run score. They stack with the difficulty config and with each other.
 */
import { Loc } from '../i18n/lang';

export interface MutatorDef {
  id: string;
  label: Loc;
  blurb: Loc;
  /** End-of-run score multiplier contributed by this mutator. */
  scoreMult: number;
}

export const MUTATORS: MutatorDef[] = [
  {
    id: 'lean',
    label: { de: 'Magere Kasse', en: 'Lean Purse' },
    blurb: { de: 'Halbes Startkapital — jeder Dollar zählt.', en: 'Half the starting capital — every dollar counts.' },
    scoreMult: 1.2,
  },
  {
    id: 'volatile',
    label: { de: 'Wilde Märkte', en: 'Wild Markets' },
    blurb: { de: 'Krisen & Black Swans treffen fast doppelt so oft.', en: 'Crises & black swans strike nearly twice as often.' },
    scoreMult: 1.25,
  },
  {
    id: 'impatient',
    label: { de: 'Nervöse LPs', en: 'Jittery LPs' },
    blurb: { de: 'Investoren ziehen viel schneller Kapital ab.', en: 'Investors pull capital much faster.' },
    scoreMult: 1.2,
  },
  {
    id: 'longonly',
    label: { de: 'Nur Long', en: 'Long Only' },
    blurb: { de: 'Keine Shorts, kein Hebel — reine Disziplin.', en: 'No shorts, no leverage — pure discipline.' },
    scoreMult: 1.15,
  },
  {
    id: 'nohedge',
    label: { de: 'Ohne Netz', en: 'No Safety Net' },
    blurb: { de: 'Tail-Absicherung ist deaktiviert.', en: 'Tail hedging is disabled.' },
    scoreMult: 1.1,
  },
];

export interface MutatorParams {
  startCapitalMult: number;
  crisisMult: number;
  redemptionMult: number;
  longOnly: boolean;
  noHedge: boolean;
  scoreMult: number;
}

export function mutatorParams(ids: string[] = []): MutatorParams {
  const has = (id: string) => ids.includes(id);
  let scoreMult = 1;
  for (const m of MUTATORS) if (has(m.id)) scoreMult *= m.scoreMult;
  return {
    startCapitalMult: has('lean') ? 0.5 : 1,
    crisisMult: has('volatile') ? 1.8 : 1,
    redemptionMult: has('impatient') ? 1.6 : 1,
    longOnly: has('longonly'),
    noHedge: has('nohedge'),
    scoreMult,
  };
}

export function mutatorScoreMult(ids: string[] = []): number {
  return mutatorParams(ids).scoreMult;
}
