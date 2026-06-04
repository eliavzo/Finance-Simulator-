/**
 * Decision cards — narrative "Extrablatt" events that pause the game and make
 * the player choose, each with a trade-off. They fire occasionally, gated by
 * the firm's state, and are the main source of run-to-run variety.
 */
import { DecisionCard, SimState } from './types';
import { exposures } from './portfolio';
import { createLP } from './fund';
import { Rng } from '../engine/rng';

interface CardContext {
  reputation: number;
  firmCash: number;
  hasEmployees: boolean;
  hasHighSkill: boolean;
  hasLowMorale: boolean;
  grossExposure: number;
  blackSwan: boolean;
}

interface CardTemplate {
  id: string;
  eligible: (c: CardContext) => boolean;
  build: () => DecisionCard;
}

let cardCounter = 0;
const card = (id: string, title: string, body: string, choices: DecisionCard['choices']): DecisionCard => {
  cardCounter += 1;
  return { id: `${id}-${cardCounter}`, title, body, choices };
};

const TEMPLATES: CardTemplate[] = [
  {
    id: 'poach',
    eligible: (c) => c.hasHighSkill,
    build: () =>
      card('poach', 'Star-Analyst abgeworben', 'Ein Rivale macht deinem besten Kopf ein lukratives Angebot. Hältst du dagegen?', [
        { label: 'Gegenangebot machen', description: 'Kostet, hält aber das Team bei Laune.', effect: { cash: -250_000, morale: 6, reputation: 1 } },
        { label: 'Ziehen lassen', description: 'Spart Geld, drückt aber die Moral.', effect: { morale: -8, reputation: -1 } },
      ]),
  },
  {
    id: 'probe',
    eligible: () => true,
    build: () =>
      card('probe', 'Regulierungsprüfung', 'Die Aufsicht klopft an und verlangt Einblick in deine Bücher.', [
        { label: 'Voll kooperieren', description: 'Anwaltskosten, aber sauberer Ruf.', effect: { cash: -180_000, reputation: 2 } },
        { label: 'Mauern', description: 'Spart Geld — sieht aber schlecht aus.', effect: { reputation: -6 } },
      ]),
  },
  {
    id: 'tip',
    eligible: (c) => c.reputation > 30,
    build: () =>
      card('tip', 'Ein heißer Tipp', 'Ein Kontakt flüstert dir nicht-öffentliche Informationen zu. Riecht nach Insiderhandel.', [
        { label: 'Diskret nutzen', description: 'Schneller Gewinn — hohes Risiko für den Ruf.', effect: { fundCash: 900_000, reputation: -8 } },
        { label: 'Dankend ablehnen', description: 'Integrität zahlt sich langfristig aus.', effect: { reputation: 2 } },
      ]),
  },
  {
    id: 'activist',
    eligible: (c) => c.grossExposure > 5_000_000,
    build: () =>
      card('activist', 'Aktivisten-Kampagne', 'Ein bekannter Short-Seller veröffentlicht einen Bericht gegen dein größtes Investment.', [
        { label: 'Öffentlich kontern', description: 'PR-Aufwand, verteidigt die Position.', effect: { cash: -120_000, reputation: 1 } },
        { label: 'Ignorieren', description: 'Spart Mühe, kostet aber Vertrauen.', effect: { reputation: -3 } },
      ]),
  },
  {
    id: 'biglp',
    eligible: (c) => c.reputation > 55,
    build: () =>
      card('biglp', 'Großer LP interessiert', 'Ein Staatsfonds erwägt ein Commitment — will dich aber auf einer teuren Roadshow sehen.', [
        { label: 'Roadshow finanzieren', description: 'Teuer, bringt aber großes Kapital.', effect: { cash: -200_000, committed: 30_000_000, reputation: 2 } },
        { label: 'Verzichten', description: 'Kein Risiko, keine Belohnung.', effect: {} },
      ]),
  },
  {
    id: 'burnout',
    eligible: (c) => c.hasLowMorale,
    build: () =>
      card('burnout', 'Burnout im Team', 'Eine Schlüsselperson ist ausgebrannt und droht auszufallen.', [
        { label: 'Sabbatical gewähren', description: 'Kostet kurzfristig, rettet die Moral.', effect: { cash: -90_000, morale: 12 } },
        { label: 'Durcharbeiten lassen', description: 'Spart Geld — verschärft das Problem.', effect: { morale: -10, reputation: -1 } },
      ]),
  },
  {
    id: 'dip',
    eligible: (c) => c.blackSwan,
    build: () =>
      card('dip', 'Panik an den Märkten', 'Alles fällt. Dein Risk-Komitee streitet, ob man antizyklisch zukaufen soll.', [
        { label: 'Mutig nachlegen', description: 'Antizyklischer Einstieg — Mut wird honoriert.', effect: { fundCash: 400_000, reputation: 3 } },
        { label: 'Risiko rausnehmen', description: 'Sicherheit zuerst.', effect: { reputation: -1 } },
      ]),
  },
  {
    id: 'media',
    eligible: (c) => c.reputation > 45,
    build: () =>
      card('media', 'Medien-Porträt', 'Ein Finanzmagazin will ein Porträt über dein Haus bringen.', [
        { label: 'Interview geben', description: 'Sichtbarkeit hebt den Ruf.', effect: { reputation: 3 } },
        { label: 'Presse meiden', description: 'Diskretion — keine Wirkung.', effect: {} },
      ]),
  },
];

/** Possibly produce a decision card this month (≈12% base chance). */
export function maybeDecision(state: SimState, blackSwan: boolean, rng: Rng): DecisionCard | undefined {
  if (!rng.chance(blackSwan ? 0.6 : 0.12)) return undefined;
  const ctx: CardContext = {
    reputation: state.reputation,
    firmCash: state.firm.cash,
    hasEmployees: state.firm.employees.length > 0,
    hasHighSkill: state.firm.employees.some((e) => e.skill >= 70),
    hasLowMorale: state.firm.employees.some((e) => e.morale < 55),
    grossExposure: exposures(state.portfolio, state.instruments).gross,
    blackSwan,
  };
  const eligible = TEMPLATES.filter((t) => t.eligible(ctx));
  if (eligible.length === 0) return undefined;
  return rng.pick(eligible).build();
}

/** Apply the chosen option of the pending decision and return a new state. */
export function applyDecision(state: SimState, choiceIndex: number, rng: Rng): SimState {
  const card = state.pendingDecision;
  if (!card) return state;
  const choice = card.choices[choiceIndex];
  if (!choice) return { ...state, pendingDecision: undefined };
  const e = choice.effect;

  let firm = state.firm;
  let portfolio = state.portfolio;
  let fund = state.fund;

  if (e.cash) firm = { ...firm, cash: firm.cash + e.cash };
  if (e.morale) {
    firm = { ...firm, employees: firm.employees.map((emp) => ({ ...emp, morale: Math.max(0, Math.min(100, emp.morale + e.morale!)) })) };
  }
  if (e.fundCash) portfolio = { ...portfolio, cash: portfolio.cash + e.fundCash };
  if (e.committed && e.committed > 0) {
    const lp = createLP('SovereignWealth', e.committed, rng);
    fund = { ...fund, committed: fund.committed + lp.committed, lps: [...fund.lps, lp] };
  }
  const reputation = e.reputation ? Math.max(0, Math.min(100, state.reputation + e.reputation)) : state.reputation;

  return {
    ...state,
    firm,
    portfolio,
    fund,
    reputation,
    pendingDecision: undefined,
    events: [
      { id: `dec-res-${state.month}-${choiceIndex}-${cardCounter}`, month: state.month, type: 'firm' as const, title: card.title, description: `Entscheidung: ${choice.label}.` },
      ...state.events,
    ].slice(0, 80),
  };
}
