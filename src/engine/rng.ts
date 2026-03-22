/**
 * Seed-based pseudorandom number generator using xorshift128.
 *
 * Deterministic: same seed always produces the same sequence.
 * Serialisable: state can be saved/loaded for persistence and replay.
 * See BRF-001 for design rationale.
 */

import type { RngState } from './types.ts';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface Rng {
  /** Returns a uniform random number in [0, 1). */
  next(): number;
  /** Returns a uniform random integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number;
  /** Returns a standard normal random number (mean 0, stddev 1) via Box-Muller. */
  nextGaussian(): number;
  /** Returns the current internal state for serialisation. */
  getState(): RngState;
}

// ---------------------------------------------------------------------------
// Seed expansion (splitmix64-style, 32-bit variant)
// ---------------------------------------------------------------------------

/**
 * Expand a single seed into the 4-word xorshift128 state.
 * Uses a splitmix32-style mixing function to ensure all 4 words
 * are non-zero even for small seed values.
 */
function expandSeed(seed: number): RngState {
  let s = seed >>> 0; // ensure unsigned 32-bit

  function splitmix(): number {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = (z ^ (z >>> 16)) >>> 0;
    z = Math.imul(z, 0x85ebca6b) >>> 0;
    z = (z ^ (z >>> 13)) >>> 0;
    z = Math.imul(z, 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    return z;
  }

  const s0 = splitmix();
  const s1 = splitmix();
  const s2 = splitmix();
  const s3 = splitmix();

  // xorshift128 requires at least one non-zero word. splitmix guarantees this
  // for any input, but guard defensively.
  if ((s0 | s1 | s2 | s3) === 0) {
    return { s0: 1, s1: 0, s2: 0, s3: 0 };
  }

  return { s0, s1, s2, s3 };
}

// ---------------------------------------------------------------------------
// xorshift128 core
// ---------------------------------------------------------------------------

function xorshift128(state: RngState): number {
  let t = state.s3;
  t = (t ^ (t << 11)) >>> 0;
  t = (t ^ (t >>> 8)) >>> 0;

  state.s3 = state.s2;
  state.s2 = state.s1;
  state.s1 = state.s0;

  const s0 = state.s0;
  t = (t ^ s0 ^ (s0 >>> 19)) >>> 0;
  state.s0 = t;

  // Convert to [0, 1) by dividing by 2^32
  return t / 0x100000000;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/** Create a new RNG from a numeric seed. */
export function createRng(seed: number): Rng {
  const state = expandSeed(seed);
  return createRngFromState(state);
}

/** Restore an RNG from a previously serialised state. */
export function createRngFromState(state: RngState): Rng {
  // Clone to avoid external mutation of the state object
  const s: RngState = { s0: state.s0, s1: state.s1, s2: state.s2, s3: state.s3 };

  // Box-Muller spare value cache
  let hasSpare = false;
  let spare = 0;

  return {
    next(): number {
      return xorshift128(s);
    },

    nextInt(min: number, max: number): number {
      const range = max - min + 1;
      return min + Math.floor(xorshift128(s) * range);
    },

    nextGaussian(): number {
      if (hasSpare) {
        hasSpare = false;
        return spare;
      }

      // Box-Muller transform: generate two independent standard normals
      let u: number;
      let v: number;
      let mag: number;
      do {
        u = xorshift128(s) * 2 - 1;
        v = xorshift128(s) * 2 - 1;
        mag = u * u + v * v;
      } while (mag >= 1 || mag === 0);

      const factor = Math.sqrt((-2 * Math.log(mag)) / mag);
      spare = v * factor;
      hasSpare = true;
      return u * factor;
    },

    getState(): RngState {
      return { s0: s.s0, s1: s.s1, s2: s.s2, s3: s.s3 };
    },
  };
}
