import { describe, it, expect } from 'vitest';
import { tick } from './tick.ts';
import { createInitialState } from './factory.ts';
import type { WorldState } from './types.ts';
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

  it('handles a 1-week time-jump without crash', { timeout: 60000 }, () => {
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

  // --- Extinct species registry (BRF-008b) ---

  it('archives extinct species with correct fields', () => {
    let state = makeState();

    // Isolate predator with no food — guaranteed extinction
    const predator = state.species.find((s) => s.trophicLevel === 'predator')!;
    const biomeId = Object.keys(predator.populationByBiome)[0] ?? '';
    state = {
      ...state,
      species: [{ ...predator, populationByBiome: { [biomeId]: 5 } }],
      extinctSpecies: [],
    };

    for (let i = 0; i < 200; i++) {
      state = tick(state, 1);
    }

    // Predator should be extinct and archived
    expect(state.species.length).toBe(0);
    expect(state.extinctSpecies.length).toBe(1);
    const archived = state.extinctSpecies[0];
    expect(archived.id).toBe(predator.id);
    expect(archived.name).toBe(predator.name);
    expect(archived.trophicLevel).toBe(predator.trophicLevel);
    expect(archived.extinctionTick).toBeGreaterThan(0);
  });

  it('extinctSpeciesCount equals extinctSpecies.length', () => {
    let state = makeState();

    // Isolate predator — will go extinct
    const predator = state.species.find((s) => s.trophicLevel === 'predator')!;
    const biomeId = Object.keys(predator.populationByBiome)[0] ?? '';
    state = {
      ...state,
      species: [{ ...predator, populationByBiome: { [biomeId]: 5 } }],
      extinctSpecies: [],
    };

    for (let i = 0; i < 200; i++) {
      state = tick(state, 1);
      expect(state.extinctSpeciesCount).toBe(state.extinctSpecies.length);
    }
  });

  it('extinct species is not duplicated in species array', () => {
    let state = makeState();

    for (let i = 0; i < 500; i++) {
      state = tick(state, 1);
    }

    const aliveIds = new Set(state.species.map((s) => s.id));
    const extinctIds = new Set(state.extinctSpecies.map((s) => s.id));

    // No overlap between living and extinct
    for (const id of extinctIds) {
      expect(aliveIds.has(id)).toBe(false);
    }
  });

  it('archives multiple extinctions in one tick', () => {
    let state = makeState();

    // Remove all food sources so herbivore and predator both starve
    const consumers = state.species.filter((s) => s.trophicLevel !== 'producer');
    state = {
      ...state,
      species: consumers.map((s) => {
        const biomeId = Object.keys(s.populationByBiome)[0] ?? '';
        return { ...s, populationByBiome: { [biomeId]: 3 } };
      }),
      extinctSpecies: [],
    };

    for (let i = 0; i < 200; i++) {
      state = tick(state, 1);
    }

    // Both consumers should be extinct and archived
    expect(state.species.length).toBe(0);
    expect(state.extinctSpecies.length).toBe(consumers.length);
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

  // T14: Energy-derived producer K — forest biomes support more producers than deserts
  it('producers grow larger populations in forest biomes than desert biomes', () => {
    const state = makeState();

    // Find a forest and a desert biome
    const forestBiome = state.biomes.find((b) => b.biomeType === 'forest');
    const desertBiome = state.biomes.find((b) => b.biomeType === 'desert');
    if (!forestBiome || !desertBiome) return; // skip if seed doesn't produce both

    // Create a controlled state with one producer species in both biomes
    const producer = state.species.find((s) => s.trophicLevel === 'producer');
    if (!producer) return;

    // Set equal starting populations
    const controlled: WorldState = {
      ...state,
      species: [
        {
          ...producer,
          genome: [...producer.genome],
          originalGenome: [...producer.originalGenome],
          populationByBiome: {
            [forestBiome.id]: 100,
            [desertBiome.id]: 100,
          },
        },
      ],
    };

    // Run 50 ticks
    let result = controlled;
    for (let i = 0; i < 50; i++) {
      result = tick(result, 1);
    }

    expect(result.species.length).toBeGreaterThan(0);
    const forestPop = result.species[0].populationByBiome[forestBiome.id] ?? 0;
    const desertPop = result.species[0].populationByBiome[desertBiome.id] ?? 0;

    expect(forestPop).toBeGreaterThan(desertPop);
  });

  // T15: Metabolism trait affects growth rate
  it('high-metabolism producer grows faster initially than low-metabolism', () => {
    const state = makeState();
    const forestBiome = state.biomes.find((b) => b.biomeType === 'forest');
    if (!forestBiome) return;

    const baseGenome = [0.4, 0.2, 0.5, 0.5, 0.3, 0.8]; // size, speed, cold, heat, metabolism, repro

    const lowMetabolism: WorldState = {
      ...state,
      species: [
        {
          id: 'low-meta',
          name: 'Low Meta',
          genome: [...baseGenome.slice(0, 4), 0.1, ...baseGenome.slice(5)],
          originalGenome: [...baseGenome.slice(0, 4), 0.1, ...baseGenome.slice(5)],
          populationByBiome: { [forestBiome.id]: 50 },
          trophicLevel: 'producer' as const,
          parentSpeciesId: null,
          originTick: 0,
          generation: 0,
        },
      ],
    };

    const highMetabolism: WorldState = {
      ...state,
      species: [
        {
          id: 'high-meta',
          name: 'High Meta',
          genome: [...baseGenome.slice(0, 4), 2.0, ...baseGenome.slice(5)],
          originalGenome: [...baseGenome.slice(0, 4), 2.0, ...baseGenome.slice(5)],
          populationByBiome: { [forestBiome.id]: 50 },
          trophicLevel: 'producer' as const,
          parentSpeciesId: null,
          originTick: 0,
          generation: 0,
        },
      ],
    };

    // Run 10 ticks — short horizon to measure initial growth rate
    let lowResult = lowMetabolism;
    let highResult = highMetabolism;
    for (let i = 0; i < 10; i++) {
      lowResult = tick(lowResult, 1);
      highResult = tick(highResult, 1);
    }

    const lowPop = lowResult.species[0]?.populationByBiome[forestBiome.id] ?? 0;
    const highPop = highResult.species[0]?.populationByBiome[forestBiome.id] ?? 0;

    // High metabolism gives faster growth rate, so should have grown more
    expect(highPop).toBeGreaterThan(lowPop);
  });
});
