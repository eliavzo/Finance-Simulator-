/**
 * Builds the GP management company's monthly income statement and a
 * consolidated balance sheet from the period ledger and current state.
 *
 * Ledger convention: revenue/income positive, expenses negative.
 */
import {
  BalanceSheet,
  FirmState,
  FundState,
  IncomeStatement,
  LedgerAccount,
  LedgerEntry,
} from './types';

function sumAccount(ledger: LedgerEntry[], account: LedgerAccount): number {
  return ledger.filter((e) => e.account === account).reduce((a, e) => a + e.amount, 0);
}

export function buildIncomeStatement(month: number, ledger: LedgerEntry[]): IncomeStatement {
  const mgmtFeeRevenue = sumAccount(ledger, 'mgmtFeeRevenue');
  const carryRevenue = sumAccount(ledger, 'carryRevenue');
  const salaries = -sumAccount(ledger, 'salaries'); // stored negative → show positive
  const infraOpex = -sumAccount(ledger, 'infraOpex');
  const tax = -sumAccount(ledger, 'tax');
  const otherExpense = 0;
  const netIncome = mgmtFeeRevenue + carryRevenue - salaries - infraOpex - otherExpense - tax;
  return { month, mgmtFeeRevenue, carryRevenue, salaries, infraOpex, otherExpense, tax, netIncome };
}

export interface BalanceSheetInputs {
  month: number;
  firm: FirmState;
  fund: FundState;
  fundCash: number;
  positionsValue: number;
}

export function buildBalanceSheet({ month, firm, fund, fundCash, positionsValue }: BalanceSheetInputs): BalanceSheet {
  const firmCash = firm.cash;
  const totalAssets = fundCash + firmCash + positionsValue;
  // Leverage is embedded in net position equity, so the only modelled
  // liability is carry owed to the GP out of fund NAV.
  const accruedCarry = fund.accruedCarry;
  const totalLiabilities = accruedCarry;
  const totalEquity = totalAssets - totalLiabilities;
  const gpEquity = firmCash;
  const lpCapital = totalEquity - gpEquity;
  return {
    month,
    fundCash,
    firmCash,
    positionsValue,
    borrowings: 0,
    accruedCarry,
    lpCapital,
    gpEquity,
    totalAssets,
    totalLiabilities,
    totalEquity,
  };
}
