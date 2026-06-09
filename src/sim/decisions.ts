/**
 * Decision cards — narrative "Extrablatt" events that pause the game and make
 * the player choose, each with a trade-off. They fire occasionally, gated by
 * the firm's state, and are the main source of run-to-run variety.
 */
import { DecisionCard, SimState } from './types';
import { exposures } from './portfolio';
import { createLP } from './fund';
import { g } from '../i18n/lang';
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
      card(
        'poach',
        g({ de: 'Star-Analyst abgeworben', en: 'Star Analyst Poached' }),
        g({
          de: 'Ein Rivale macht deinem besten Kopf ein lukratives Angebot. Hältst du dagegen?',
          en: 'A rival makes your best mind a lucrative offer. Do you fight to keep them?',
        }),
        [
          { label: g({ de: 'Gegenangebot machen', en: 'Make a counter-offer' }), description: g({ de: 'Kostet, hält aber das Team bei Laune.', en: 'Costs money, but keeps the team happy.' }), effect: { cash: -250_000, morale: 6, reputation: 1 } },
          { label: g({ de: 'Ziehen lassen', en: 'Let them go' }), description: g({ de: 'Spart Geld, drückt aber die Moral.', en: 'Saves money but dents morale.' }), effect: { morale: -8, reputation: -1 } },
        ],
      ),
  },
  {
    id: 'probe',
    eligible: () => true,
    build: () =>
      card(
        'probe',
        g({ de: 'Regulierungsprüfung', en: 'Regulatory Probe' }),
        g({ de: 'Die Aufsicht klopft an und verlangt Einblick in deine Bücher.', en: 'The regulator comes knocking and demands a look at your books.' }),
        [
          { label: g({ de: 'Voll kooperieren', en: 'Cooperate fully' }), description: g({ de: 'Anwaltskosten, aber sauberer Ruf.', en: 'Legal costs, but a clean reputation.' }), effect: { cash: -180_000, reputation: 2 } },
          { label: g({ de: 'Mauern', en: 'Stonewall' }), description: g({ de: 'Spart Geld — sieht aber schlecht aus.', en: 'Saves money — but looks bad.' }), effect: { reputation: -6 } },
        ],
      ),
  },
  {
    id: 'tip',
    eligible: (c) => c.reputation > 30,
    build: () =>
      card(
        'tip',
        g({ de: 'Ein heißer Tipp', en: 'A Hot Tip' }),
        g({ de: 'Ein Kontakt flüstert dir nicht-öffentliche Informationen zu. Riecht nach Insiderhandel.', en: 'A contact whispers non-public information to you. It reeks of insider trading.' }),
        [
          { label: g({ de: 'Diskret nutzen', en: 'Use it discreetly' }), description: g({ de: 'Schneller Gewinn — hohes Risiko für den Ruf.', en: 'A quick profit — high risk to your reputation.' }), effect: { fundCash: 900_000, reputation: -8 } },
          { label: g({ de: 'Dankend ablehnen', en: 'Politely decline' }), description: g({ de: 'Integrität zahlt sich langfristig aus.', en: 'Integrity pays off in the long run.' }), effect: { reputation: 2 } },
        ],
      ),
  },
  {
    id: 'activist',
    eligible: (c) => c.grossExposure > 5_000_000,
    build: () =>
      card(
        'activist',
        g({ de: 'Aktivisten-Kampagne', en: 'Activist Campaign' }),
        g({ de: 'Ein bekannter Short-Seller veröffentlicht einen Bericht gegen dein größtes Investment.', en: 'A well-known short-seller publishes a report against your largest investment.' }),
        [
          { label: g({ de: 'Öffentlich kontern', en: 'Counter publicly' }), description: g({ de: 'PR-Aufwand, verteidigt die Position.', en: 'PR effort, defends the position.' }), effect: { cash: -120_000, reputation: 1 } },
          { label: g({ de: 'Ignorieren', en: 'Ignore it' }), description: g({ de: 'Spart Mühe, kostet aber Vertrauen.', en: 'Saves effort but costs trust.' }), effect: { reputation: -3 } },
        ],
      ),
  },
  {
    id: 'biglp',
    eligible: (c) => c.reputation > 55,
    build: () =>
      card(
        'biglp',
        g({ de: 'Großer LP interessiert', en: 'Large LP Interested' }),
        g({ de: 'Ein Staatsfonds erwägt ein Commitment — will dich aber auf einer teuren Roadshow sehen.', en: 'A sovereign fund is weighing a commitment — but wants to see you on an expensive roadshow.' }),
        [
          { label: g({ de: 'Roadshow finanzieren', en: 'Fund the roadshow' }), description: g({ de: 'Teuer, bringt aber großes Kapital.', en: 'Expensive, but brings in big capital.' }), effect: { cash: -200_000, committed: 30_000_000, reputation: 2 } },
          { label: g({ de: 'Verzichten', en: 'Pass' }), description: g({ de: 'Kein Risiko, keine Belohnung.', en: 'No risk, no reward.' }), effect: {} },
        ],
      ),
  },
  {
    id: 'burnout',
    eligible: (c) => c.hasLowMorale,
    build: () =>
      card(
        'burnout',
        g({ de: 'Burnout im Team', en: 'Burnout on the Team' }),
        g({ de: 'Eine Schlüsselperson ist ausgebrannt und droht auszufallen.', en: 'A key person is burnt out and at risk of dropping out.' }),
        [
          { label: g({ de: 'Sabbatical gewähren', en: 'Grant a sabbatical' }), description: g({ de: 'Kostet kurzfristig, rettet die Moral.', en: 'Costs in the short term, saves morale.' }), effect: { cash: -90_000, morale: 12 } },
          { label: g({ de: 'Durcharbeiten lassen', en: 'Push them through' }), description: g({ de: 'Spart Geld — verschärft das Problem.', en: 'Saves money — makes the problem worse.' }), effect: { morale: -10, reputation: -1 } },
        ],
      ),
  },
  {
    id: 'dip',
    eligible: (c) => c.blackSwan,
    build: () =>
      card(
        'dip',
        g({ de: 'Panik an den Märkten', en: 'Panic in the Markets' }),
        g({ de: 'Alles fällt. Dein Risk-Komitee streitet, ob man antizyklisch zukaufen soll.', en: 'Everything is falling. Your risk committee is split on whether to buy the dip.' }),
        [
          { label: g({ de: 'Mutig nachlegen', en: 'Buy boldly' }), description: g({ de: 'Antizyklischer Einstieg — Mut wird honoriert.', en: 'A contrarian entry — boldness is rewarded.' }), effect: { fundCash: 400_000, reputation: 3 } },
          { label: g({ de: 'Risiko rausnehmen', en: 'De-risk' }), description: g({ de: 'Sicherheit zuerst.', en: 'Safety first.' }), effect: { reputation: -1 } },
        ],
      ),
  },
  {
    id: 'media',
    eligible: (c) => c.reputation > 45,
    build: () =>
      card(
        'media',
        g({ de: 'Medien-Porträt', en: 'Media Profile' }),
        g({ de: 'Ein Finanzmagazin will ein Porträt über dein Haus bringen.', en: 'A finance magazine wants to run a profile of your house.' }),
        [
          { label: g({ de: 'Interview geben', en: 'Give the interview' }), description: g({ de: 'Sichtbarkeit hebt den Ruf.', en: 'Visibility lifts your reputation.' }), effect: { reputation: 3 } },
          { label: g({ de: 'Presse meiden', en: 'Avoid the press' }), description: g({ de: 'Diskretion — keine Wirkung.', en: 'Discretion — no effect.' }), effect: {} },
        ],
      ),
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
      { id: `dec-res-${state.month}-${choiceIndex}-${cardCounter}`, month: state.month, type: 'firm' as const, title: card.title, description: g({ de: `Entscheidung: ${choice.label}.`, en: `Decision: ${choice.label}.` }) },
      ...state.events,
    ].slice(0, 80),
  };
}
