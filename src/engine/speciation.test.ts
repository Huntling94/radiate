import { describe, it, expect } from 'vitest';
import { checkSpeciation } from './speciation.ts';
import { createRng } from './rng.ts';
import type { Species, SimConfig } from './types.ts';

const config: SimConfig = {
  seed: 42,
  ticksPerSecond: 1,
  mutationRate: 0.05,
  mutationMagnitude: 0.1,
  speciationThreshold: 0.5, // low threshold for testing
  gridWidth: 8,
  gridHeight: 6,
};

function makeSpecies(id: string, genome: number[], originalGenome: number[]): Species {
  return {
    id,
    name: 'Test Species',
    genome,
    originalGenome,
    populationByBiome: { 'biome-0-0': 100, 'biome-1-0': 100 },
    trophicLevel: 'producer',
    parentSpeciesId: null,
    originTick: 0,
    generation: 0,
  };
}

describe('checkSpeciation', () => {
  // T6: Species with distance > threshold speciates
  it('speciates when genetic distance exceeds threshold', () => {
    const species = makeSpecies(
      's1',
      [1.0, 1.0, 1.0, 1.0, 1.0, 1.0], // drifted
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], // original
    );

    const result = checkSpeciation([species], 200, createRng(42), config);

    expect(result.species).toHaveLength(2);
    expect(result.events).toHaveLength(1);
  });

  // T7: Species with distance < threshold does not speciate
  it('does not speciate when genetic distance is below threshold', () => {
    const species = makeSpecies(
      's1',
      [0.51, 0.51, 0.51, 0.51, 0.51, 0.51], // barely drifted
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    );

    const result = checkSpeciation([species], 200, createRng(42), config);

    expect(result.species).toHaveLength(1);
    expect(result.events).toHaveLength(0);
  });

  // T8: Speciation creates parent + child
  it('creates parent with original genome and child with drifted genome', () => {
    const original = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const drifted = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    const species = makeSpecies('s1', drifted, original);

    const result = checkSpeciation([species], 200, createRng(42), config);

    const parent = result.species.find((s) => s.id === 's1');
    const child = result.species.find((s) => s.id !== 's1');

    expect(parent).toBeDefined();
    expect(child).toBeDefined();

    // Parent genome resets to original
    expect(parent?.genome).toEqual(original);
    // Child genome is the drifted version
    expect(child?.genome).toEqual(drifted);
    // Child's original genome is set to its current genome
    expect(child?.originalGenome).toEqual(drifted);
  });

  // T9: Population splits 50/50
  it('splits population approximately 50/50', () => {
    const species = makeSpecies(
      's1',
      [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    );
    species.populationByBiome = { 'biome-0': 100, 'biome-1': 200 };

    const result = checkSpeciation([species], 200, createRng(42), config);

    const parent = result.species.find((s) => s.id === 's1');
    const child = result.species.find((s) => s.id !== 's1');

    // Population should be split
    const parentPop = Object.values(parent?.populationByBiome ?? {}).reduce((a, b) => a + b, 0);
    const childPop = Object.values(child?.populationByBiome ?? {}).reduce((a, b) => a + b, 0);

    expect(parentPop + childPop).toBe(300); // conserved
    expect(parentPop).toBeGreaterThan(0);
    expect(childPop).toBeGreaterThan(0);
  });

  it('does not speciate if species was created recently', () => {
    const species = makeSpecies(
      's1',
      [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    );
    species.originTick = 150; // created at tick 150

    // Current tick is 200 — only 50 ticks since creation, below MIN_TICKS_BETWEEN_SPECIATION
    const result = checkSpeciation([species], 200, createRng(42), config);

    expect(result.species).toHaveLength(1);
    expect(result.events).toHaveLength(0);
  });

  it('child has correct parentSpeciesId and generation', () => {
    const species = makeSpecies(
      's1',
      [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    );

    const result = checkSpeciation([species], 200, createRng(42), config);
    const child = result.species.find((s) => s.id !== 's1');

    expect(child?.parentSpeciesId).toBe('s1');
    expect(child?.generation).toBe(1);
  });
});
