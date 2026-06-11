/**
 * Decision cards — narrative "Extrablatt" events that pause the game and make
 * the player choose, each with a trade-off. They fire occasionally, gated by
 * the firm's state, and are the main source of run-to-run variety.
 */
import { DecisionCard, DecisionEffect, Employee, SimState } from './types';
import { exposures } from './portfolio';
import { createLP } from './fund';
import { fairSalary } from './firm';
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
  month: number;
  rivalName: string;
}

interface CardTemplate {
  id: string;
  eligible: (c: CardContext) => boolean;
  build: (c: CardContext) => DecisionCard;
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
    id: 'rivalshort',
    eligible: (c) => c.month > 12 && c.reputation > 40,
    build: (c) =>
      card(
        'rivalshort',
        g({ de: `Schieflage bei ${c.rivalName}`, en: `${c.rivalName} in Trouble` }),
        g({ de: 'Dein Desk sieht massive Risse im Buch eines Rivalen. Positionierst du dich öffentlich dagegen?', en: 'Your desk sees deep cracks in a rival’s book. Do you publicly position against them?' }),
        [
          {
            label: g({ de: 'Dagegen wetten', en: 'Bet against them' }),
            description: g({ de: 'Riskant: großer Gewinn, wenn der Desk recht hat — teuer, wenn nicht.', en: 'Risky: a big win if the desk is right — costly if not.' }),
            effect: { gamble: { p: 0.55, win: { fundCash: 1_200_000, reputation: 2 }, lose: { fundCash: -800_000, reputation: -1 } } },
          },
          { label: g({ de: 'Finger weg', en: 'Stay out' }), description: g({ de: 'Kein Risiko, keine Schlagzeile.', en: 'No risk, no headline.' }), effect: {} },
        ],
      ),
  },
  {
    id: 'poachstar',
    eligible: (c) => c.reputation > 55 && c.firmCash > 600_000,
    build: (c) =>
      card(
        'poachstar',
        g({ de: `Star bei ${c.rivalName} unzufrieden`, en: `Star at ${c.rivalName} Unhappy` }),
        g({ de: 'Ein hochkarätiger Kopf der Konkurrenz ist wechselwillig — gegen eine satte Antrittsprämie.', en: 'A top mind at a rival is open to moving — for a hefty signing bonus.' }),
        [
          { label: g({ de: 'Abwerben', en: 'Poach them' }), description: g({ de: 'Teuer, aber Elite-Skill fürs Team.', en: 'Expensive, but elite skill for the team.' }), effect: { cash: -500_000, hireStar: 'Analyst', reputation: 1 } },
          { label: g({ de: 'Zu teuer', en: 'Too expensive' }), description: g({ de: 'Das Budget bleibt verschont.', en: 'The budget is spared.' }), effect: {} },
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

/** The dead-fund rescue card: an anchor backer offers a re-seed. */
function buildRescue(reputation: number): DecisionCard {
  if (reputation >= 25) {
    return card(
      'reseed',
      g({ de: 'Rettungs-Re-Seed', en: 'Rescue Re-Seed' }),
      g({ de: 'Ein Anker-Investor bietet an, den toten Fonds neu zu verankern — gegen einen dauerhaften Gebührenrabatt.', en: 'An anchor investor offers to re-seed the dead fund — in exchange for a permanent fee discount.' }),
      [
        { label: g({ de: 'Re-Seed annehmen', en: 'Accept the re-seed' }), description: g({ de: '$10M Commitment, aber 0,5 Pkt. weniger Management-Fee.', en: '$10M commitment, but 0.5pts less management fee.' }), effect: { committed: 10_000_000, feeRate: -0.005, reputation: 1 } },
        { label: g({ de: 'Stolz ablehnen', en: 'Proudly decline' }), description: g({ de: 'Keine Bedingungen — und kein Kapital.', en: 'No strings — and no capital.' }), effect: {} },
      ],
    );
  }
  return card(
    'ffround',
    g({ de: 'Friends & Family', en: 'Friends & Family' }),
    g({ de: 'Dein Ruf ist angeschlagen, aber das private Netzwerk würde dir noch einmal Startkapital anvertrauen.', en: 'Your standing is dented, but your private network would entrust you with seed capital once more.' }),
    [
      { label: g({ de: 'Annehmen', en: 'Accept' }), description: g({ de: '$4M Commitment — die letzte Chance, es zu beweisen.', en: '$4M commitment — the last chance to prove it.' }), effect: { committed: 4_000_000, morale: 4 } },
      { label: g({ de: 'Ablehnen', en: 'Decline' }), description: g({ de: 'Kein privates Geld aufs Spiel setzen.', en: 'Don’t put private money at risk.' }), effect: {} },
    ],
  );
}

/** Semi-annual LP meeting: negotiate expectations, fees and goodwill. */
export function buildLpMeeting(rng: Rng): DecisionCard {
  void rng;
  return card(
    'lpmeeting',
    g({ de: 'LP-Versammlung', en: 'LP Meeting' }),
    g({ de: 'Die halbjährliche Versammlung deiner Investoren. Wie trittst du auf?', en: 'The semi-annual meeting of your investors. How do you present?' }),
    [
      { label: g({ de: 'Erwartungen dämpfen', en: 'Temper expectations' }), description: g({ de: 'Ehrlichkeit kauft Geduld, dämpft aber den Glanz.', en: 'Honesty buys patience but dims the shine.' }), effect: { patience: 0.08, reputation: -1 } },
      { label: g({ de: 'Große Versprechen', en: 'Big promises' }), description: g({ de: 'Hebt den Ruf — und die Fallhöhe.', en: 'Lifts your standing — and the height of the fall.' }), effect: { reputation: 2, patience: -0.06 } },
      { label: g({ de: 'Fee-Rabatt anbieten', en: 'Offer a fee discount' }), description: g({ de: '0,25 Pkt. weniger Fee, deutlich geduldigere LPs.', en: '0.25pts less fee, markedly more patient LPs.' }), effect: { feeRate: -0.0025, patience: 0.12 } },
    ],
  );
}

/** Possibly produce a decision card this month (≈12% base chance). */
export function maybeDecision(state: SimState, blackSwan: boolean, rng: Rng): DecisionCard | undefined {
  // While the fund is dead, rescue offers dominate the news cycle.
  if ((state.fundDeadMonths ?? 0) >= 2 && rng.chance(0.45)) return buildRescue(state.reputation);
  if (!rng.chance(blackSwan ? 0.6 : 0.12)) return undefined;
  const ctx: CardContext = {
    reputation: state.reputation,
    firmCash: state.firm.cash,
    hasEmployees: state.firm.employees.length > 0,
    hasHighSkill: state.firm.employees.some((e) => e.skill >= 70),
    hasLowMorale: state.firm.employees.some((e) => e.morale < 55),
    grossExposure: exposures(state.portfolio, state.instruments).gross,
    blackSwan,
    month: state.month,
    rivalName: state.rivals.length > 0 ? rng.pick(state.rivals).name : 'Meridian Capital',
  };
  const eligible = TEMPLATES.filter((t) => t.eligible(ctx));
  if (eligible.length === 0) return undefined;
  return rng.pick(eligible).build(ctx);
}

/** Apply the chosen option of the pending decision and return a new state. */
export function applyDecision(state: SimState, choiceIndex: number, rng: Rng): SimState {
  const card = state.pendingDecision;
  if (!card) return state;
  const choice = card.choices[choiceIndex];
  if (!choice) return { ...state, pendingDecision: undefined };

  let firm = state.firm;
  let portfolio = state.portfolio;
  let fund = state.fund;
  let reputation = state.reputation;
  let gambleNote: string | undefined;

  const applyEffect = (e: DecisionEffect) => {
    if (e.cash) firm = { ...firm, cash: firm.cash + e.cash };
    if (e.morale) {
      firm = { ...firm, employees: firm.employees.map((emp) => ({ ...emp, morale: Math.max(0, Math.min(100, emp.morale + e.morale!)) })) };
    }
    if (e.fundCash) portfolio = { ...portfolio, cash: portfolio.cash + e.fundCash };
    if (e.committed && e.committed > 0) {
      const lp = createLP('SovereignWealth', e.committed, rng);
      fund = { ...fund, committed: fund.committed + lp.committed, lps: [...fund.lps, lp] };
    }
    if (e.patience) {
      fund = { ...fund, lps: fund.lps.map((lp) => (lp.redeemed ? lp : { ...lp, patience: Math.max(0.2, Math.min(0.95, lp.patience + e.patience!)) })) };
    }
    if (e.feeRate) fund = { ...fund, mgmtFeeRate: Math.max(0.005, fund.mgmtFeeRate + e.feeRate) };
    if (e.hireStar) {
      cardCounter += 1;
      const star: Employee = {
        id: `star-${state.month}-${cardCounter}`,
        name: g({ de: 'Der Neuzugang', en: 'The New Signing' }),
        role: e.hireStar,
        skill: 85,
        salary: fairSalary(e.hireStar, 85) * 1.35,
        morale: 80,
        hiredMonth: state.month,
      };
      firm = { ...firm, employees: [...firm.employees, star] };
    }
    if (e.reputation) reputation = Math.max(0, Math.min(100, reputation + e.reputation));
    if (e.gamble) {
      const won = rng.chance(e.gamble.p);
      gambleNote = won ? g({ de: 'Die Wette ging auf.', en: 'The bet paid off.' }) : g({ de: 'Die Wette ging schief.', en: 'The bet went wrong.' });
      applyEffect(won ? e.gamble.win : e.gamble.lose);
    }
  };
  applyEffect(choice.effect);

  return {
    ...state,
    firm,
    portfolio,
    fund,
    reputation,
    pendingDecision: undefined,
    events: [
      { id: `dec-res-${state.month}-${choiceIndex}-${cardCounter}`, month: state.month, type: 'firm' as const, title: card.title, description: g({ de: `Entscheidung: ${choice.label}.`, en: `Decision: ${choice.label}.` }) + (gambleNote ? ` ${gambleNote}` : '') },
      ...state.events,
    ].slice(0, 80),
  };
}
