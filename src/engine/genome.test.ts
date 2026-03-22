import { describe, it, expect } from 'vitest';
import { mutateGenome, geneticDistance, clampGenome } from './genome.ts';
import { createRng } from './rng.ts';
import { TRAIT_REGISTRY } from './types.ts';
import type { SimConfig } from './types.ts';

const defaultConfig: SimConfig = {
  seed: 42,
  ticksPerSecond: 1,
  mutationRate: 0.05,
  mutationMagnitude: 0.1,
  speciationThreshold: 1.5,
  gridWidth: 8,
  gridHeight: 6,
};

describe('mutateGenome', () => {
  // T1: Determinism
  it('produces identical results with the same seed', () => {
    const genome = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const result1 = mutateGenome(genome, createRng(42), defaultConfig);
    const result2 = mutateGenome(genome, createRng(42), defaultConfig);
    expect(result1).toEqual(result2);
  });

  // T2: Small perturbations
  it('produces small changes from the original', () => {
    const genome = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const mutated = mutateGenome(genome, createRng(42), defaultConfig);

    for (let i = 0; i < genome.length; i++) {
      const diff = Math.abs(mutated[i] - genome[i]);
      expect(diff).toBeLessThan(0.1); // mutations are small
    }
  });

  // T3: Values stay within bounds
  it('clamps values to trait registry bounds', () => {
    // Genome at the extremes
    const genome = TRAIT_REGISTRY.map((t) => t.max);
    const rng = createRng(99);

    // Mutate many times to push past bounds
    let current = genome;
    for (let i = 0; i < 100; i++) {
      current = mutateGenome(current, rng, {
        ...defaultConfig,
        mutationRate: 1.0,
        mutationMagnitude: 0.5,
      });
    }

    for (let i = 0; i < current.length; i++) {
      const trait = TRAIT_REGISTRY[i];
      expect(current[i]).toBeGreaterThanOrEqual(trait.min);
      expect(current[i]).toBeLessThanOrEqual(trait.max);
    }
  });
});

describe('geneticDistance', () => {
  // T4: Identical genomes have zero distance
  it('returns 0 for identical genomes', () => {
    const genome = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    expect(geneticDistance(genome, genome)).toBe(0);
  });

  // T5: Different genomes have positive distance
  it('returns positive distance for different genomes', () => {
    const a = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const b = [0.6, 0.4, 0.7, 0.3, 0.8, 0.2];
    expect(geneticDistance(a, b)).toBeGreaterThan(0);
  });

  it('more different genomes have larger distance', () => {
    const base = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const close = [0.51, 0.49, 0.51, 0.49, 0.51, 0.49];
    const far = [1.0, 0.1, 1.0, 0.1, 1.0, 0.1];

    expect(geneticDistance(base, far)).toBeGreaterThan(geneticDistance(base, close));
  });
});

describe('clampGenome', () => {
  it('clamps values to trait bounds', () => {
    const genome = [-1, 5, -1, 5, -1, 5]; // way out of bounds
    const clamped = clampGenome(genome);

    for (let i = 0; i < clamped.length; i++) {
      const trait = TRAIT_REGISTRY[i];
      expect(clamped[i]).toBeGreaterThanOrEqual(trait.min);
      expect(clamped[i]).toBeLessThanOrEqual(trait.max);
    }
  });

  it('does not modify values already within bounds', () => {
    const genome = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const clamped = clampGenome(genome);
    expect(clamped).toEqual(genome);
  });
});
