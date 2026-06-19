import { createRealEstate, generatePropertyDeal, buyProperty, sellProperty, stepRealEstate, realEstateEquity, reMetrics } from '../realestate';
import { createSimGame, advanceMonth, enterpriseEquity } from '../engine';
import { Rng } from '../../engine/rng';

function reWithDeal() {
  const rng = new Rng(7);
  const re = { ...createRealEstate(), deals: [generatePropertyDeal(rng, 1)] };
  return { re, deal: re.deals[0], rng };
}

describe('real estate', () => {
  it('buys for cash (no debt) and with a mortgage (50% down + debt)', () => {
    const { re, deal } = reWithDeal();
    const cashBuy = buyProperty(re, deal.id, 1, false);
    expect(cashBuy.ok).toBe(true);
    expect(cashBuy.cash).toBe(deal.price);
    expect(cashBuy.re!.portfolio[0].debt).toBe(0);

    const mortBuy = buyProperty(re, deal.id, 1, true);
    expect(mortBuy.cash).toBeCloseTo(deal.price * 0.5, 0);
    expect(mortBuy.re!.portfolio[0].debt).toBeCloseTo(deal.price * 0.5, 0);
  });

  it('pays net rent into the fund and drifts value/occupancy', () => {
    const { re, deal, rng } = reWithDeal();
    const bought = buyProperty(re, deal.id, 1, false).re!;
    const econ = createSimGame(1).economy;
    const step = stepRealEstate(bought, econ, 1, rng, 1);
    expect(step.income).toBeGreaterThan(0); // unlevered, occupied -> positive rent
    expect(step.re.portfolio[0].value).toBeGreaterThan(0);
  });

  it('sells net of transaction costs and mortgage', () => {
    const { re, deal } = reWithDeal();
    const bought = buyProperty(re, deal.id, 1, true).re!; // 50% debt
    const id = bought.portfolio[0].id;
    const sold = sellProperty(bought, id, 2, 15);
    expect(sold.ok).toBe(true);
    // proceeds ≈ value - 3% - debt(50%) < value
    expect(sold.cash!).toBeLessThan(bought.portfolio[0].value * 0.5);
    expect(sold.re!.portfolio[0].status).toBe('sold');
  });

  it('equity counts net of debt; metrics are sane', () => {
    const { re, deal } = reWithDeal();
    const bought = buyProperty(re, deal.id, 1, true).re!;
    const eq = realEstateEquity(bought);
    expect(eq).toBeCloseTo(deal.price - deal.price * 0.5, 0);
    expect(reMetrics(bought, 1).activeCount).toBe(1);
  });

  it('is wired into the engine: a fresh game has deals and enterprise value includes property equity', () => {
    const g = createSimGame(3);
    expect((g.realEstate?.deals.length ?? 0)).toBeGreaterThan(0);
    const next = advanceMonth(g);
    expect(next.realEstate).toBeTruthy();
    // buying property then valuing enterprise should reflect equity
    const deal = g.realEstate!.deals[0];
    const re2 = buyProperty(g.realEstate!, deal.id, 0, false).re!;
    const withProp = { ...g, realEstate: re2 };
    expect(enterpriseEquity(withProp)).toBeGreaterThan(0);
  });
});
