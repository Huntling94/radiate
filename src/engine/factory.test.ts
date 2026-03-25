import { describe, it, expect } from 'vitest';
import { createInitialState } from './factory.ts';
import { DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT, INITIAL_CREATURE_COUNT } from './constants.ts';

describe('createInitialState', () => {
  it('produces a valid WorldState with all required fields', () => {
    const state = createInitialState(42);

    expect(state.tick).toBe(0);
    expect(state.elapsedSeconds).toBe(0);
    expect(state.temperature).toBe(20);
    expect(state.biomes).toHaveLength(DEFAULT_GRID_WIDTH * DEFAULT_GRID_HEIGHT);
    expect(state.extinctSpeciesCount).toBe(0);
    expect(state.config.seed).toBe(42);
    expect(state.rngState).toBeDefined();
  });

  it('creates biomes with valid grid coordinates', () => {
    const state = createInitialState(42);

    for (const biome of state.biomes) {
      expect(biome.x).toBeGreaterThanOrEqual(0);
      expect(biome.x).toBeLessThan(DEFAULT_GRID_WIDTH);
      expect(biome.y).toBeGreaterThanOrEqual(0);
      expect(biome.y).toBeLessThan(DEFAULT_GRID_HEIGHT);
    }
  });

  it('creates the expected number of IBM creatures', () => {
    const state = createInitialState(42);
    expect(state.creatures.length).toBe(INITIAL_CREATURE_COUNT);
  });

  it('creates creatures with all three trophic levels', () => {
    const state = createInitialState(42);
    const levels = new Set(state.creatures.map((c) => c.trophicLevel));
    expect(levels.has('producer')).toBe(true);
    expect(levels.has('herbivore')).toBe(true);
    expect(levels.has('predator')).toBe(true);
  });

  it('produces more producers than predators', () => {
    const state = createInitialState(42);
    const producers = state.creatures.filter((c) => c.trophicLevel === 'producer').length;
    const predators = state.creatures.filter((c) => c.trophicLevel === 'predator').length;
    expect(producers).toBeGreaterThan(predators);
  });

  it('runs initial clustering to populate speciesClusters', () => {
    const state = createInitialState(42);
    expect(state.speciesClusters.length).toBeGreaterThan(0);
    // species is an alias for speciesClusters
    expect(state.species).toEqual(state.speciesClusters);
  });

  it('assigns speciesClusterId to all creatures', () => {
    const state = createInitialState(42);
    const clusterIds = new Set(state.speciesClusters.map((c) => c.id));
    for (const creature of state.creatures) {
      expect(clusterIds.has(creature.speciesClusterId)).toBe(true);
    }
  });

  it('produces identical states from the same seed', () => {
    const state1 = createInitialState(42);
    const state2 = createInitialState(42);

    expect(state1.biomes).toEqual(state2.biomes);
    expect(state1.creatures).toEqual(state2.creatures);
    expect(state1.speciesClusters).toEqual(state2.speciesClusters);
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
});
