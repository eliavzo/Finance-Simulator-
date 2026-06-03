/**
 * Reputation system (0-100).
 *
 * Reputation rewards skill and consistency. It rises with profitable quarters
 * and successful VC exits, and falls with margin calls, blow-ups and large
 * drawdowns. Higher reputation unlocks more & better deal flow and lets the
 * family office draw additional LP capital.
 */

export const REPUTATION_MIN = 0;
export const REPUTATION_MAX = 100;
export const STARTING_REPUTATION = 50;

export function clampReputation(value: number): number {
  return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, value));
}

export interface ReputationInputs {
  /** Combined equity return this quarter (fraction). */
  quarterReturn: number;
  marginCalls: number;
  /** Number of profitable VC exits this quarter. */
  exits: number;
  /** Number of portfolio failures this quarter. */
  failures: number;
  blackSwanSurvived: boolean;
}

/**
 * Compute the delta to apply to reputation for a quarter. Bounded so a single
 * quarter can't swing the score wildly.
 */
export function reputationDelta(input: ReputationInputs): number {
  let delta = 0;
  // Performance: +/- up to ~3 points for a +/-15% quarter.
  delta += Math.max(-3, Math.min(3, input.quarterReturn * 20));
  delta += input.exits * 2;
  delta -= input.failures * 1;
  delta -= input.marginCalls * 2;
  if (input.blackSwanSurvived) delta += 1;
  return Math.max(-6, Math.min(6, delta));
}

/**
 * LP capital that becomes callable at a given reputation level. Capital scales
 * super-linearly with reputation above 50 to reward a strong track record.
 */
export function lpCapitalForReputation(reputation: number): number {
  if (reputation <= 50) return 0;
  const over = (reputation - 50) / 50; // 0..1
  return Math.round(over * over * 25_000_000);
}

export function reputationTier(reputation: number): string {
  if (reputation >= 85) return 'Tier-1 Allocator';
  if (reputation >= 70) return 'Etabliert';
  if (reputation >= 55) return 'Aufsteigend';
  if (reputation >= 40) return 'Solide';
  if (reputation >= 25) return 'Angeschlagen';
  return 'In Ungnade';
}
