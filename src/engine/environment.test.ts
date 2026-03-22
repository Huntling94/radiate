import { describe, it, expect } from 'vitest';
import { computeFitnessModifier, updateBiomeTypes } from './environment.ts';
import type { Species, Biome } from './types.ts';

function makeSpecies(coldTol: number, heatTol: number): Species {
  return {
    id: 'test',
    name: 'Test',
    genome: [0.5, 0.5, coldTol, heatTol, 0.5, 0.5],
    originalGenome: [0.5, 0.5, coldTol, heatTol, 0.5, 0.5],
    populationByBiome: {},
    trophicLevel: 'producer',
    parentSpeciesId: null,
    originTick: 0,
    generation: 0,
  };
}

describe('computeFitnessModifier', () => {
  // T10: Well-suited species gets ~1.0
  it('returns ~1.0 for a balanced species at default temperature', () => {
    const species = makeSpecies(0.5, 0.5); // balanced tolerances → ideal ~20°C
    const fitness = computeFitnessModifier(species, 20);
    expect(fitness).toBeGreaterThan(0.9);
    expect(fitness).toBeLessThanOrEqual(1.5);
  });

  // T11: Poorly suited species gets < 1.0
  it('returns < 1.0 for a cold-adapted species in hot conditions', () => {
    const coldSpecies = makeSpecies(0.9, 0.1); // ideal temp ~-4°C
    const fitness = computeFitnessModifier(coldSpecies, 40);
    expect(fitness).toBeLessThan(0.5);
  });

  it('returns < 1.0 for a heat-adapted species in cold conditions', () => {
    const hotSpecies = makeSpecies(0.1, 0.9); // ideal temp ~44°C
    const fitness = computeFitnessModifier(hotSpecies, -10);
    expect(fitness).toBeLessThan(0.5);
  });

  it('heat-tolerant species does better at high temps than cold-tolerant species', () => {
    const hotSpecies = makeSpecies(0.1, 0.9);
    const coldSpecies = makeSpecies(0.9, 0.1);

    const hotFitness = computeFitnessModifier(hotSpecies, 40);
    const coldFitness = computeFitnessModifier(coldSpecies, 40);

    expect(hotFitness).toBeGreaterThan(coldFitness);
  });

  it('never returns negative', () => {
    const species = makeSpecies(0.5, 0.5);
    // Extreme temperature
    const fitness = computeFitnessModifier(species, -100);
    expect(fitness).toBeGreaterThanOrEqual(0);
  });
});

describe('updateBiomeTypes', () => {
  const testBiome: Biome = {
    id: 'test',
    x: 0,
    y: 0,
    elevation: 0.5,
    moisture: 0.5,
    biomeType: 'grassland',
    baseCarryingCapacity: 500,
  };

  // T12: Temperature changes biome types
  it('changes biome type when temperature drops below freezing', () => {
    const biomes = [testBiome];
    const updated = updateBiomeTypes(biomes, -10);
    expect(updated[0].biomeType).toBe('tundra');
  });

  it('preserves biome type at normal temperature', () => {
    const biomes = [testBiome];
    const updated = updateBiomeTypes(biomes, 20);
    expect(updated[0].biomeType).toBe('grassland');
  });

  it('sets carrying capacity to 0 for uninhabitable biomes', () => {
    const oceanBiome: Biome = { ...testBiome, elevation: 0.05 };
    const updated = updateBiomeTypes([oceanBiome], 20);
    expect(updated[0].biomeType).toBe('ocean');
    expect(updated[0].baseCarryingCapacity).toBe(0);
  });
});
