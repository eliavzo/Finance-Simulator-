/** Display formatting helpers. All pure. */

/** Compact USD, e.g. 12_300_000 -> "$12.3M", 4500 -> "$4.5K". */
export function fmtMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Full USD with thousands separators, e.g. "$1,234,567". */
export function fmtMoneyFull(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/** Fraction -> percent string, e.g. 0.1234 -> "12.3%". */
export function fmtPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

/** A signed percent, e.g. +12.3% / -4.0%. */
export function fmtPctSigned(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

/** Plain ratio, e.g. 2.345 -> "2.35x". */
export function fmtMultiple(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}x`;
}

/** Bounded number, e.g. Sharpe -> "1.42". */
export function fmtNum(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}
