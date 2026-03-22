import { describe, it, expect } from 'vitest';
import { createRng, createRngFromState } from './rng.ts';

describe('createRng', () => {
  // T1: Determinism — same seed, same sequence
  it('produces identical sequences from the same seed', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(42);

    const seq1 = Array.from({ length: 100 }, () => rng1.next());
    const seq2 = Array.from({ length: 100 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  // T2: Different seeds diverge
  it('produces different sequences from different seeds', () => {
    const rng1 = createRng(42);
    const rng2 = createRng(99);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).not.toEqual(seq2);
  });
});

describe('next', () => {
  // T3: Range bounds [0, 1)
  it('returns values in [0, 1)', () => {
    const rng = createRng(123);

    for (let i = 0; i < 10_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  // T4: Uniform distribution — mean near 0.5
  it('has a mean near 0.5 over many samples', () => {
    const rng = createRng(456);
    const n = 10_000;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += rng.next();
    }

    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });
});

describe('nextGaussian', () => {
  // T5: Gaussian mean near 0
  it('has a mean near 0.0 over many samples', () => {
    const rng = createRng(789);
    const n = 10_000;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += rng.nextGaussian();
    }

    const mean = sum / n;
    expect(mean).toBeGreaterThan(-0.05);
    expect(mean).toBeLessThan(0.05);
  });

  // T6: Gaussian stddev near 1
  it('has a standard deviation near 1.0 over many samples', () => {
    const rng = createRng(101);
    const n = 10_000;
    const values: number[] = [];

    for (let i = 0; i < n; i++) {
      values.push(rng.nextGaussian());
    }

    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);

    expect(stddev).toBeGreaterThan(0.9);
    expect(stddev).toBeLessThan(1.1);
  });
});

describe('nextInt', () => {
  // T7: Integer range [min, max]
  it('returns integers in [min, max] inclusive', () => {
    const rng = createRng(202);
    const counts = new Map<number, number>();

    for (let i = 0; i < 10_000; i++) {
      const v = rng.nextInt(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    // Every value in [1, 6] should appear at least once in 10,000 rolls
    for (let i = 1; i <= 6; i++) {
      expect(counts.get(i)).toBeGreaterThan(0);
    }
  });
});

describe('state serialisation', () => {
  // T8: Save state, restore, sequence continues identically
  it('round-trips state and continues the same sequence', () => {
    const rng1 = createRng(303);

    // Advance 50 steps
    for (let i = 0; i < 50; i++) {
      rng1.next();
    }

    // Save state
    const savedState = rng1.getState();

    // Continue for 50 more steps from rng1
    const continuation1 = Array.from({ length: 50 }, () => rng1.next());

    // Restore from saved state
    const rng2 = createRngFromState(savedState);
    const continuation2 = Array.from({ length: 50 }, () => rng2.next());

    expect(continuation1).toEqual(continuation2);
  });

  it('clones state so external mutation does not affect the RNG', () => {
    const rng = createRng(404);
    const state = rng.getState();

    // Mutate the returned state
    state.s0 = 0;
    state.s1 = 0;
    state.s2 = 0;
    state.s3 = 0;

    // RNG should be unaffected
    const value = rng.next();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
