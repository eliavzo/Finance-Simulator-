/**
 * Portfolio risk analytics: a one-factor (market) parametric VaR and a set of
 * named historical stress scenarios.
 *
 * Each position is reduced to a signed dollar exposure, a market beta and an
 * idiosyncratic monthly variance. Options are linearised via their delta. The
 * covariance matrix is then β_iβ_j·σ²_mkt + diag(idio), and VaR follows from
 * {@link parametricVaR}.
 */
import { EconomyState, Instrument, Position, PortfolioState } from './types';
import { blackScholes, bondModifiedDuration, parametricVaR } from './quant';

interface PositionRisk {
  exposure: number; // signed dollars
  beta: number;
  idioVarMonthly: number;
}

function positionRisk(pos: Position, instruments: Instrument[], econ: EconomyState): PositionRisk | null {
  const inst = instruments.find((i) => i.id === pos.instrumentId);
  if (!inst) return null;

  switch (inst.kind) {
    case 'equity': {
      const exposure = pos.quantity * inst.price;
      return { exposure, beta: inst.beta, idioVarMonthly: (inst.vol * inst.vol) / 12 };
    }
    case 'commodity': {
      const exposure = pos.quantity * inst.price;
      return { exposure, beta: inst.cyclicality * 0.4, idioVarMonthly: (inst.vol * inst.vol) / 12 };
    }
    case 'fx': {
      const exposure = pos.quantity * inst.price;
      return { exposure, beta: 0.1, idioVarMonthly: (inst.vol * inst.vol) / 12 };
    }
    case 'bond': {
      const dur = bondModifiedDuration(inst.ytm, inst.couponRate, inst.maturityYears, inst.couponsPerYear, inst.faceValue);
      const yieldVol = 0.012; // annual stdev of yield changes
      const priceVol = Math.abs(dur) * yieldVol;
      const exposure = pos.quantity * inst.price;
      return { exposure, beta: -0.25, idioVarMonthly: (priceVol * priceVol) / 12 };
    }
    case 'option': {
      const underlying = instruments.find((i) => i.id === inst.underlyingId);
      if (!underlying) return null;
      const t = Math.max(0.02, (inst.expiryMonth - 0) / 12); // approximate remaining life
      const sigma = underlying.kind === 'equity' ? underlying.vol : 0.3;
      const r = econ.policyRate;
      const { delta } = blackScholes(inst.optionType, underlying.price, inst.strike, t, r, sigma);
      const beta = underlying.kind === 'equity' ? underlying.beta : 0.8;
      // Delta-equivalent exposure to the underlying.
      const exposure = pos.quantity * inst.multiplier * delta * underlying.price;
      return { exposure, beta, idioVarMonthly: (sigma * sigma) / 12 };
    }
  }
}

export interface RiskReport {
  var95: number;
  var99: number;
  grossExposure: number;
  netExposure: number;
  /** Net market beta of the book in dollars / equity. */
  netBeta: number;
}

/** Compute the parametric VaR report for the book. */
export function computeRisk(portfolio: PortfolioState, instruments: Instrument[], econ: EconomyState): RiskReport {
  const risks = portfolio.positions
    .map((p) => positionRisk(p, instruments, econ))
    .filter((r): r is PositionRisk => r !== null);

  if (risks.length === 0) {
    return { var95: 0, var99: 0, grossExposure: 0, netExposure: 0, netBeta: 0 };
  }

  const marketVarMonthly = Math.pow(Math.max(0.08, econ.volIndex / 100), 2) / 12;
  const n = risks.length;
  const exposures = risks.map((r) => r.exposure);

  // cov_ij = beta_i * beta_j * marketVar + (i==j ? idioVar : 0)
  const cov: number[][] = [];
  for (let i = 0; i < n; i++) {
    cov[i] = [];
    for (let j = 0; j < n; j++) {
      cov[i][j] = risks[i].beta * risks[j].beta * marketVarMonthly + (i === j ? risks[i].idioVarMonthly : 0);
    }
  }

  const grossExposure = exposures.reduce((a, e) => a + Math.abs(e), 0);
  const netExposure = exposures.reduce((a, e) => a + e, 0);
  const netBeta = risks.reduce((a, r) => a + r.beta * r.exposure, 0);

  return {
    var95: parametricVaR(exposures, cov, 1.645),
    var99: parametricVaR(exposures, cov, 2.326),
    grossExposure,
    netExposure,
    netBeta,
  };
}

/* ------------------------------- Stress ---------------------------------- */

export interface StressScenario {
  id: string;
  name: string;
  /** Returns the shock (return) applied to an instrument under this scenario. */
  shock: (inst: Instrument) => number;
}

const isHY = (inst: Instrument) => inst.kind === 'bond' && (inst.rating === 'BB' || inst.rating === 'B');

export const STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 'gfc',
    name: '2008 Finanzkrise',
    shock: (i) => {
      if (i.kind === 'equity') return i.sector === 'Financials' ? -0.6 : -0.45;
      if (i.kind === 'commodity') return i.symbol === 'GOLD' ? 0.08 : -0.5;
      if (i.kind === 'bond') return isHY(i) ? -0.25 : 0.06; // flight to quality
      if (i.kind === 'fx') return -0.08;
      if (i.kind === 'option') return 0; // handled via underlying linearisation elsewhere
      return -0.3;
    },
  },
  {
    id: 'rate-shock',
    name: 'Zinsschock +200bp',
    shock: (i) => {
      if (i.kind === 'bond') {
        const dur = bondModifiedDuration(i.ytm, i.couponRate, i.maturityYears, i.couponsPerYear, i.faceValue);
        return -dur * 0.02;
      }
      if (i.kind === 'equity') return i.sector === 'Financials' ? 0.02 : -0.1;
      return -0.05;
    },
  },
  {
    id: 'tech-crash',
    name: 'Tech-Crash',
    shock: (i) => {
      if (i.kind === 'equity') return i.sector === 'Tech' ? -0.4 : -0.1;
      return -0.05;
    },
  },
  {
    id: 'stagflation',
    name: 'Stagflation',
    shock: (i) => {
      if (i.kind === 'commodity') return 0.3;
      if (i.kind === 'equity') return -0.2;
      if (i.kind === 'bond') return -0.1;
      return -0.05;
    },
  },
];

/**
 * Estimate the book's P/L under a stress scenario by shocking each position's
 * instrument price. Options are linearised through delta. Returns signed
 * dollars (negative = loss).
 */
export function stressPnl(scenario: StressScenario, portfolio: PortfolioState, instruments: Instrument[], econ: EconomyState): number {
  let pnl = 0;
  for (const pos of portfolio.positions) {
    const inst = instruments.find((i) => i.id === pos.instrumentId);
    if (!inst) continue;
    if (inst.kind === 'option') {
      const underlying = instruments.find((i) => i.id === inst.underlyingId);
      if (!underlying) continue;
      const t = Math.max(0.02, (inst.expiryMonth - 0) / 12);
      const sigma = underlying.kind === 'equity' ? underlying.vol : 0.3;
      const { delta } = blackScholes(inst.optionType, underlying.price, inst.strike, t, econ.policyRate, sigma);
      const uShock = scenario.shock(underlying) * underlying.price;
      pnl += pos.quantity * inst.multiplier * delta * uShock;
    } else {
      pnl += pos.quantity * inst.price * scenario.shock(inst);
    }
  }
  return pnl;
}
