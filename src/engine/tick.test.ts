import { describe, it, expect } from 'vitest';
import { tick } from './tick.ts';
import { createInitialState } from './factory.ts';
import { getTotalPopulation } from './types.ts';

function makeState(seed = 42) {
  return createInitialState(seed);
}

describe('tick', () => {
  // T7: Determinism
  it('produces identical results from the same state and delta', () => {
    const state = makeState();
    const result1 = tick(state, 1);
    const result2 = tick(state, 1);

    expect(result1.species).toEqual(result2.species);
    expect(result1.rngState).toEqual(result2.rngState);
    expect(result1.tick).toEqual(result2.tick);
  });

  // T4: Population never goes negative
  it('population never goes negative', () => {
    let state = makeState();

    for (let i = 0; i < 200; i++) {
      state = tick(state, 1);
      for (const species of state.species) {
        for (const pop of Object.values(species.populationByBiome)) {
          expect(pop).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  // T1: Predator-prey oscillation
  it('predator-prey populations oscillate over 500 ticks', () => {
    let state = makeState();
    const herbPops: number[] = [];

    for (let i = 0; i < 500; i++) {
      state = tick(state, 1);
      const herbivore = state.species.find((s) => s.trophicLevel === 'herbivore');
      if (herbivore) {
        herbPops.push(getTotalPopulation(herbivore));
      }
    }

    // Count direction changes (oscillations)
    let directionChanges = 0;
    for (let i = 2; i < herbPops.length; i++) {
      const prev = (herbPops[i - 1] ?? 0) - (herbPops[i - 2] ?? 0);
      const curr = (herbPops[i] ?? 0) - (herbPops[i - 1] ?? 0);
      if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
        directionChanges++;
      }
    }

    // Should have multiple oscillations (stochastic dynamics will produce many direction changes)
    expect(directionChanges).toBeGreaterThan(3);
  });

  // T3: Stochastic extinction — a species with no food and tiny population dies
  it('isolated species with no food source goes extinct', () => {
    let state = makeState();

    // Remove all prey (herbivores and producers), leaving only predator
    // with tiny population in one biome — predator has no food
    const predator = state.species.find((s) => s.trophicLevel === 'predator');
    expect(predator).toBeDefined();

    const biomeId = Object.keys(predator?.populationByBiome ?? {})[0] ?? '';
    state = {
      ...state,
      species: [
        {
          ...predator!,
          populationByBiome: { [biomeId]: 5 },
        },
      ],
    };

    // Without food, predator should decline and go extinct
    for (let i = 0; i < 200; i++) {
      state = tick(state, 1);
    }

    // Predator should have gone extinct (no food, tiny population, negative growth)
    expect(state.species.length).toBe(0);
  });

  // T8: Time-jump with 3 species
  it('handles a 1-hour time-jump with multiple species without crash', () => {
    const state = makeState();
    const result = tick(state, 3600);

    expect(result.species.length).toBeGreaterThanOrEqual(0);
    for (const species of result.species) {
      for (const pop of Object.values(species.populationByBiome)) {
        expect(pop).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('handles a 1-week time-jump without crash', () => {
    const state = makeState();
    const result = tick(state, 604800);

    expect(result.tick).toBeGreaterThan(0);
    expect(result.elapsedSeconds).toBe(604800);
  });

  it('returns state unchanged for zero delta', () => {
    const state = makeState();
    const result = tick(state, 0);
    expect(result).toBe(state);
  });

  it('increments tick count by number of steps', () => {
    const state = makeState();
    const result = tick(state, 5);
    expect(result.tick).toBe(5);
    expect(result.elapsedSeconds).toBe(5);
  });

  // T10: Trophic cascade — producer extinction causes herbivore decline
  it('removing producers causes herbivore population decline', () => {
    let state = makeState();

    // Run 50 ticks to establish dynamics
    for (let i = 0; i < 50; i++) {
      state = tick(state, 1);
    }

    // Remove all producers
    const herbBefore = state.species.find((s) => s.trophicLevel === 'herbivore');
    const herbPopBefore = herbBefore ? getTotalPopulation(herbBefore) : 0;

    state = {
      ...state,
      species: state.species.filter((s) => s.trophicLevel !== 'producer'),
    };

    // Run 100 more ticks without producers
    for (let i = 0; i < 100; i++) {
      state = tick(state, 1);
    }

    const herbAfter = state.species.find((s) => s.trophicLevel === 'herbivore');
    const herbPopAfter = herbAfter ? getTotalPopulation(herbAfter) : 0;

    // Herbivore should have declined (or gone extinct) without producers
    expect(herbPopAfter).toBeLessThan(herbPopBefore);
  });
});
