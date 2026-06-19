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

import { buildChain } from '../decisions';
import { advanceMonth } from '../engine';

describe('event chains & nemesis', () => {
  const flush2 = () => {
    const g = createSimGame(2, 'multistrat', 'normal');
    return { ...g, month: 20, reputation: 60, firm: { ...g.firm, cash: 3_000_000 } };
  };

  it('scheduleChain queues a future follow-up', () => {
    const g = flush2();
    const card: DecisionCard = { id: 'b-1', cardId: 'bribe', kicker: 'K', title: 't', body: 'b', choices: [{ label: 'pay', description: 'd', effect: { committed: 1_000_000, scheduleChain: { id: 'bribeFallout', inMonths: 22 } } }] };
    const after = applyDecision({ ...g, pendingDecision: card }, 0, new Rng(5));
    expect(after.pendingChains?.some((c) => c.chainId === 'bribeFallout' && c.fireMonth === g.month + 22)).toBe(true);
  });

  it('buildChain produces a card for a known id, undefined otherwise', () => {
    const g = flush2();
    expect(buildChain('tipProbe', g, new Rng(1))?.cardId).toBe('tipProbe');
    expect(buildChain('does-not-exist', g, new Rng(1))).toBeUndefined();
  });

  it('a due chain fires on the next month, bypassing the random gate', () => {
    let g = createSimGame(2, 'multistrat', 'normal');
    g = { ...g, pendingChains: [{ fireMonth: g.month + 1, chainId: 'tipProbe' }] };
    const next = advanceMonth(g);
    expect(next.pendingDecision?.cardId).toBe('tipProbe');
    expect(next.pendingChains?.length ?? 0).toBe(0);
  });

  it('assigns a nemesis at game start', () => {
    const g = createSimGame(2, 'multistrat', 'normal');
    expect(g.nemesisId).toBeTruthy();
    expect(g.rivals.some((r) => r.id === g.nemesisId)).toBe(true);
  });
});
