import { describe, it, expect } from 'vitest';
import { createInitialState } from './factory.ts';
import { isHabitable } from './biome.ts';
import { getTotalPopulation } from './types.ts';

describe('createInitialState', () => {
  // T9: Valid WorldState structure
  it('produces a valid WorldState with all required fields', () => {
    const state = createInitialState(42);

    expect(state.tick).toBe(0);
    expect(state.elapsedSeconds).toBe(0);
    expect(state.temperature).toBe(20);
    expect(state.biomes).toHaveLength(8 * 6);
    expect(state.species).toHaveLength(1);
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

  it('creates one seed species with population > 0', () => {
    const state = createInitialState(42);
    const species = state.species[0];

    expect(species.name).toBe('Proto Alga');
    expect(species.trophicLevel).toBe('producer');
    expect(species.parentSpeciesId).toBeNull();
    expect(species.generation).toBe(0);
    expect(getTotalPopulation(species)).toBeGreaterThan(0);
  });

  // T13: Uninhabitable biomes have zero population
  it('has zero population in ocean and mountain biomes', () => {
    const state = createInitialState(42);
    const species = state.species[0];

    for (const biome of state.biomes) {
      if (!isHabitable(biome.biomeType)) {
        expect(species.populationByBiome[biome.id]).toBeUndefined();
      }
    }
  });

  // T10: Determinism — same seed, same state
  it('produces identical states from the same seed', () => {
    const state1 = createInitialState(42);
    const state2 = createInitialState(42);

    expect(state1.biomes).toEqual(state2.biomes);
    expect(state1.species).toEqual(state2.species);
    expect(state1.config).toEqual(state2.config);
    expect(state1.rngState).toEqual(state2.rngState);
  });

  // T11: Different seeds produce different states
  it('produces different states from different seeds', () => {
    const state1 = createInitialState(42);
    const state2 = createInitialState(99);

    const elevations1 = state1.biomes.map((b) => b.elevation);
    const elevations2 = state2.biomes.map((b) => b.elevation);
    expect(elevations1).not.toEqual(elevations2);
  });
});
