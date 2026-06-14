import { maybeDecision, applyDecision } from '../decisions';
import { createSimGame } from '../engine';
import { Rng } from '../../engine/rng';
import { DecisionCard, SimState } from '../types';

function flush(month = 30): SimState {
  const g = createSimGame(1, 'multistrat', 'normal');
  return { ...g, month, reputation: 70, firm: { ...g.firm, cash: 3_000_000 } };
}

describe('decision variety & anti-repeat', () => {
  it('produces many distinct event types', () => {
    const base = flush();
    const ids = new Set<string>();
    for (let s = 0; s < 600; s++) {
      const card = maybeDecision(base, false, new Rng(s + 1));
      if (card?.cardId) ids.add(card.cardId);
    }
    expect(ids.size).toBeGreaterThanOrEqual(12);
  });

  it('cards carry a kicker and a stable cardId', () => {
    for (let s = 0; s < 50; s++) {
      const card = maybeDecision(flush(), false, new Rng(s + 1));
      if (card) {
        expect(typeof card.kicker).toBe('string');
        expect((card.kicker ?? '').length).toBeGreaterThan(0);
        expect(typeof card.cardId).toBe('string');
        break;
      }
    }
  });

  it('applyDecision records the cardId and excludes it next time', () => {
    let g = flush();
    let card: DecisionCard | undefined;
    for (let s = 0; s < 200 && !card; s++) card = maybeDecision(g, false, new Rng(s + 7));
    expect(card).toBeTruthy();
    g = { ...g, pendingDecision: card };
    const after = applyDecision(g, 0, new Rng(99));
    expect(after.lastDecisionIds?.[0]).toBe(card!.cardId);
    expect(after.pendingDecision).toBeUndefined();
  });
});

describe('new decision effects', () => {
  const run = (effect: Record<string, unknown>): SimState => {
    const g = flush();
    const card: DecisionCard = { id: 'x-1', cardId: 'x', kicker: 'K', title: 't', body: 'b', choices: [{ label: 'a', description: 'd', effect }] };
    return applyDecision({ ...g, pendingDecision: card }, 0, new Rng(3));
  };

  it('infraGift raises an infrastructure tier', () => {
    const before = flush().firm.infrastructure.dataTier;
    const after = run({ infraGift: 'dataTier' });
    expect(after.firm.infrastructure.dataTier).toBe(before + 1);
  });

  it('loseEmployee removes a staffer', () => {
    const before = flush().firm.employees.length;
    const after = run({ loseEmployee: true });
    expect(after.firm.employees.length).toBe(before - 1);
  });

  it('volSpike raises the vol index; sentiment shifts mood', () => {
    const before = flush().economy;
    const after = run({ volSpike: 10, sentiment: -0.2 });
    expect(after.economy.volIndex).toBeGreaterThan(before.volIndex);
    expect(after.economy.sentiment).toBeLessThan(before.sentiment);
  });

  it('gamble resolves to exactly one branch', () => {
    const after = run({ gamble: { p: 1, win: { reputation: 5 }, lose: { reputation: -50 } } });
    expect(after.reputation).toBeGreaterThan(flush().reputation); // p=1 always wins
  });
});
