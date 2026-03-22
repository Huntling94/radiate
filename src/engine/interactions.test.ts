import { describe, it, expect } from 'vitest';
import { computePairInteraction, computeInteractionMatrix } from './interactions.ts';
import type { Species } from './types.ts';

function makeSpecies(overrides: Partial<Species> & { id: string }): Species {
  return {
    name: overrides.id,
    genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    populationByBiome: {},
    trophicLevel: 'producer',
    parentSpeciesId: null,
    originTick: 0,
    generation: 0,
    ...overrides,
  };
}

describe('computePairInteraction', () => {
  // T6: Self-interaction is always 1 (self-competition)
  it('returns 1.0 for self-interaction', () => {
    const species = makeSpecies({ id: 'a' });
    expect(computePairInteraction(species, species)).toBe(1.0);
  });

  // T6: Predator-prey have asymmetric interaction
  it('gives predator a negative coefficient (benefit) from prey', () => {
    const predator = makeSpecies({
      id: 'pred',
      trophicLevel: 'predator',
      genome: [0.5, 0.8, 0.5, 0.5, 0.5, 0.5], // high speed
    });
    const herbivore = makeSpecies({
      id: 'herb',
      trophicLevel: 'herbivore',
      genome: [0.5, 0.4, 0.5, 0.5, 0.5, 0.5], // lower speed
    });

    const effect = computePairInteraction(predator, herbivore);
    expect(effect).toBeLessThan(0); // prey benefits predator
  });

  it('gives prey a positive coefficient (harm) from predator', () => {
    const predator = makeSpecies({
      id: 'pred',
      trophicLevel: 'predator',
      genome: [0.5, 0.8, 0.5, 0.5, 0.5, 0.5],
    });
    const herbivore = makeSpecies({
      id: 'herb',
      trophicLevel: 'herbivore',
      genome: [0.5, 0.4, 0.5, 0.5, 0.5, 0.5],
    });

    const effect = computePairInteraction(herbivore, predator);
    expect(effect).toBeGreaterThan(0); // predator hurts prey
  });

  // T5: Faster predator has higher predation coefficient
  it('faster predator has stronger predation effect', () => {
    const prey = makeSpecies({
      id: 'prey',
      trophicLevel: 'herbivore',
      genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    });
    const slowPredator = makeSpecies({
      id: 'slow',
      trophicLevel: 'predator',
      genome: [0.5, 0.3, 0.5, 0.5, 0.5, 0.5], // slower than prey
    });
    const fastPredator = makeSpecies({
      id: 'fast',
      trophicLevel: 'predator',
      genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], // same speed as prey
    });

    const slowEffect = computePairInteraction(prey, slowPredator);
    const fastEffect = computePairInteraction(prey, fastPredator);

    // Both harm prey (positive), but fast predator harms more
    expect(fastEffect).toBeGreaterThan(slowEffect);
  });

  // T6: Same trophic level → positive (competitive) interaction
  it('returns positive competition coefficient for same trophic level', () => {
    const a = makeSpecies({ id: 'a', trophicLevel: 'herbivore' });
    const b = makeSpecies({ id: 'b', trophicLevel: 'herbivore' });

    const effect = computePairInteraction(a, b);
    expect(effect).toBeGreaterThan(0);
  });

  it('similar genomes have higher competition than dissimilar ones', () => {
    const base = makeSpecies({
      id: 'base',
      trophicLevel: 'herbivore',
      genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    });
    const similar = makeSpecies({
      id: 'similar',
      trophicLevel: 'herbivore',
      genome: [0.51, 0.49, 0.52, 0.48, 0.5, 0.5],
    });
    const different = makeSpecies({
      id: 'different',
      trophicLevel: 'herbivore',
      genome: [1.5, 0.1, 0.9, 0.1, 1.5, 0.1],
    });

    const similarComp = computePairInteraction(base, similar);
    const differentComp = computePairInteraction(base, different);

    expect(similarComp).toBeGreaterThan(differentComp);
  });

  it('returns 0 for non-interacting trophic levels', () => {
    const producer = makeSpecies({ id: 'prod', trophicLevel: 'producer' });
    const predator = makeSpecies({ id: 'pred', trophicLevel: 'predator' });

    // Producer and predator don't directly interact (2 levels apart)
    expect(computePairInteraction(producer, predator)).toBe(0);
  });
});

describe('computeInteractionMatrix', () => {
  it('produces a square matrix with correct dimensions', () => {
    const species = [makeSpecies({ id: 'a' }), makeSpecies({ id: 'b' }), makeSpecies({ id: 'c' })];

    const matrix = computeInteractionMatrix(species);

    expect(matrix.coefficients).toHaveLength(3);
    expect(matrix.coefficients[0]).toHaveLength(3);
    expect(matrix.indexMap.size).toBe(3);
  });

  it('diagonal entries are all 1.0 (self-competition)', () => {
    const species = [makeSpecies({ id: 'a' }), makeSpecies({ id: 'b' })];

    const matrix = computeInteractionMatrix(species);

    expect(matrix.coefficients[0][0]).toBe(1.0);
    expect(matrix.coefficients[1][1]).toBe(1.0);
  });
});
