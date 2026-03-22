import { describe, it, expect } from 'vitest';
import { createInitialState } from './factory.ts';
import { isHabitable } from './biome.ts';
import { getTotalPopulation } from './types.ts';

describe('createInitialState', () => {
  it('produces a valid WorldState with all required fields', () => {
    const state = createInitialState(42);

    expect(state.tick).toBe(0);
    expect(state.elapsedSeconds).toBe(0);
    expect(state.temperature).toBe(20);
    expect(state.biomes).toHaveLength(8 * 6);
    expect(state.extinctSpeciesCount).toBe(0);
    expect(state.config.seed).toBe(42);
    expect(state.rngState).toBeDefined();
  });

  it('creates biomes with valid grid coordinates', () => {
    const state = createInitialState(42);

    for (const biome of state.biomes) {
      expect(biome.x).toBeGreaterThanOrEqual(0);
      expect(biome.x).toBeLessThan(8);
      expect(biome.y).toBeGreaterThanOrEqual(0);
      expect(biome.y).toBeLessThan(6);
    }
  });

  // T9: Factory creates 3 species with correct trophic levels
  it('creates 3 species with producer, herbivore, and predator', () => {
    const state = createInitialState(42);

    expect(state.species).toHaveLength(3);

    const trophicLevels = state.species.map((s) => s.trophicLevel).sort();
    expect(trophicLevels).toEqual(['herbivore', 'predator', 'producer']);
  });

  it('all species have population > 0', () => {
    const state = createInitialState(42);

    for (const species of state.species) {
      expect(getTotalPopulation(species)).toBeGreaterThan(0);
    }
  });

  it('has zero population in ocean and mountain biomes', () => {
    const state = createInitialState(42);

    for (const species of state.species) {
      for (const biome of state.biomes) {
        if (!isHabitable(biome.biomeType)) {
          expect(species.populationByBiome[biome.id]).toBeUndefined();
        }
      }
    }
  });

  it('produces identical states from the same seed', () => {
    const state1 = createInitialState(42);
    const state2 = createInitialState(42);

    expect(state1.biomes).toEqual(state2.biomes);
    expect(state1.species).toEqual(state2.species);
    expect(state1.config).toEqual(state2.config);
    expect(state1.rngState).toEqual(state2.rngState);
  });

  it('produces different states from different seeds', () => {
    const state1 = createInitialState(42);
    const state2 = createInitialState(99);

    const elevations1 = state1.biomes.map((b) => b.elevation);
    const elevations2 = state2.biomes.map((b) => b.elevation);
    expect(elevations1).not.toEqual(elevations2);
  });

  it('producer has highest initial population, predator has lowest', () => {
    const state = createInitialState(42);

    const producer = state.species.find((s) => s.trophicLevel === 'producer');
    const predator = state.species.find((s) => s.trophicLevel === 'predator');
    expect(producer).toBeDefined();
    expect(predator).toBeDefined();

    if (producer && predator) {
      expect(getTotalPopulation(producer)).toBeGreaterThan(getTotalPopulation(predator));
    }
  });
});
