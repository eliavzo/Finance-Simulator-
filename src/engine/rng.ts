/**
 * Deterministic, seedable PRNG.
 *
 * We persist only a single integer of state so an in-flight game can be saved
 * and resumed with an identical sequence of "random" events. The generator is
 * Mulberry32 (fast, good enough for a game) plus a Box-Muller wrapper for
 * normal draws used by the GBM market model.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force into a uint32 so behaviour matches across platforms.
    this.state = seed >>> 0;
  }

  /** Current internal state — persist this to resume the exact sequence. */
  getState(): number {
    return this.state;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Returns true with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Standard normal draw via Box-Muller. */
  normal(mean = 0, sd = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + sd * z;
  }

  /** Pick a random element from a non-empty array. */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}
