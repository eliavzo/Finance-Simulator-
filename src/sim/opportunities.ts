/**
 * Special one-off opportunities — IPO allocations, block trades, private
 * placements and activist stakes. They deploy fund cash (competing with the
 * trading book), lock it up, and resolve later to a type-specific payoff,
 * adding capital-allocation decisions beyond ordinary trading.
 */
import { OpportunityType, SpecialOpportunity } from './types';
import { Loc, g } from '../i18n/lang';
import { Rng } from '../engine/rng';

interface OppConfig {
  label: Loc;
  body: Loc;
  resolveMonths: [number, number];
  cap: number;
  expected: Loc;
}

const CONFIG: Record<OpportunityType, OppConfig> = {
  ipo: {
    label: { de: 'IPO-Zuteilung', en: 'IPO Allocation' },
    body: {
      de: 'Ein heißer Börsengang bietet dir eine Zuteilung zum Ausgabepreis. Kann durch die Decke gehen — oder floppen.',
      en: 'A hot listing offers you an allocation at the offer price. Could rocket — or flop.',
    },
    resolveMonths: [1, 3],
    cap: 8_000_000,
    expected: { de: 'Hohe Varianz · 0,4×–2,4×', en: 'High variance · 0.4×–2.4×' },
  },
  block: {
    label: { de: 'Block-Trade', en: 'Block Trade' },
    body: {
      de: 'Ein Verkäufer muss ein großes Paket loswerden und bietet es mit Abschlag — aber für einige Monate illiquide.',
      en: 'A seller must offload a large block at a discount — but it stays illiquid for a few months.',
    },
    resolveMonths: [2, 4],
    cap: 12_000_000,
    expected: { de: 'Geringe Varianz · ~0,95×–1,4×', en: 'Low variance · ~0.95×–1.4×' },
  },
  private: {
    label: { de: 'Private Placement', en: 'Private Placement' },
    body: {
      de: 'Eine private Finanzierungsrunde, langfristig gebunden, mit ordentlichem Renditepotenzial.',
      en: 'A private financing round, locked up for the long term, with solid return potential.',
    },
    resolveMonths: [6, 12],
    cap: 15_000_000,
    expected: { de: 'Mittel · 0,8×–2,0×', en: 'Medium · 0.8×–2.0×' },
  },
  activist: {
    label: { de: 'Aktivisten-Stake', en: 'Activist Stake' },
    body: {
      de: 'Baue eine große Position in einer schlecht geführten Firma auf und dränge auf Veränderung. Erfolg hebt den Wert — Scheitern kostet.',
      en: 'Build a large stake in a badly run company and push for change. Success lifts the value — failure costs.',
    },
    resolveMonths: [4, 8],
    cap: 12_000_000,
    expected: { de: 'Wette · Erfolg 1,5×–3×, sonst 0,4×–0,9×', en: 'A bet · success 1.5×–3×, else 0.4×–0.9×' },
  },
};

export const OPP_LABEL: Record<OpportunityType, Loc> = {
  ipo: { de: 'IPO-Zuteilung', en: 'IPO Allocation' },
  block: { de: 'Block-Trade', en: 'Block Trade' },
  private: { de: 'Private Placement', en: 'Private Placement' },
  activist: { de: 'Aktivisten-Stake', en: 'Activist Stake' },
};

let oppCounter = 0;

/** Possibly offer an opportunity this month (gated by available cash). */
export function maybeOpportunity(reputation: number, month: number, cash: number, rng: Rng): SpecialOpportunity | undefined {
  if (cash < 1_000_000) return undefined;
  // Better reputation surfaces more inbound deals.
  const prob = 0.06 + Math.max(0, (reputation - 50) / 100) * 0.06;
  if (!rng.chance(prob)) return undefined;

  const types: OpportunityType[] = ['ipo', 'block', 'private', 'activist'];
  const type = rng.pick(types);
  const cfg = CONFIG[type];
  const maxInvest = Math.min(cfg.cap, Math.max(1_000_000, cash * 0.6));
  const resolveMonths = rng.int(cfg.resolveMonths[0], cfg.resolveMonths[1]);
  oppCounter += 1;
  return {
    id: `opp-${month}-${oppCounter}`,
    type,
    title: g(cfg.label),
    body: g(cfg.body),
    minInvest: 1_000_000,
    maxInvest: Math.round(maxInvest / 100_000) * 100_000,
    resolveMonths,
    expected: g(cfg.expected),
  };
}

/** Resolution multiple for a holding, by type (reputation aids activist odds). */
export function payoffMultiple(type: OpportunityType, reputation: number, rng: Rng): number {
  switch (type) {
    case 'ipo':
      return rng.chance(0.55) ? rng.range(1.2, 2.4) : rng.range(0.4, 0.95);
    case 'block':
      return rng.range(0.95, 1.4);
    case 'private':
      return rng.chance(0.6) ? rng.range(1.2, 2.0) : rng.range(0.8, 1.15);
    case 'activist': {
      const successOdds = 0.45 + Math.max(0, (reputation - 50) / 100) * 0.3;
      return rng.chance(successOdds) ? rng.range(1.5, 3.0) : rng.range(0.4, 0.9);
    }
  }
}
