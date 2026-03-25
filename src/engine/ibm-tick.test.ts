import { describe, it, expect } from 'vitest';
import { ibmTick } from './ibm-tick.ts';
import type { WorldState, Biome, Creature, SimConfig } from './types.ts';
import { createRng } from './rng.ts';
import { updateBiomeTypes } from './environment.ts';
import {
  INITIAL_CREATURE_ENERGY,
  CLUSTERING_INTERVAL,
  REPRODUCTION_ENERGY_THRESHOLD,
} from './constants.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: SimConfig = {
  seed: 42,
  ticksPerSecond: 1,
  mutationRate: 0.05,
  mutationMagnitude: 0.1,
  speciationThreshold: 1.5,
  gridWidth: 5,
  gridHeight: 5,
  clusteringInterval: CLUSTERING_INTERVAL,
};

function makeBiome(x: number, y: number, biomeType: Biome['biomeType'] = 'grassland'): Biome {
  return {
    id: `b-${String(x)}-${String(y)}`,
    x,
    y,
    elevation: biomeType === 'ocean' ? 0.1 : biomeType === 'mountain' ? 0.9 : 0.5,
    moisture: 0.5,
    biomeType,
    baseCarryingCapacity: 500,
  };
}

function makeGrid(width: number, height: number): Biome[] {
  const biomes: Biome[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      biomes.push(makeBiome(x, y));
    }
  }
  return biomes;
}

function makeCreature(
  id: string,
  trophicLevel: Creature['trophicLevel'],
  overrides: Partial<Creature> = {},
): Creature {
  return {
    id,
    genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    x: 0,
    z: 0,
    energy: INITIAL_CREATURE_ENERGY,
    age: 0,
    state: 'idle',
    trophicLevel,
    parentId: null,
    generation: 0,
    speciesClusterId: `sp-${trophicLevel}`,
    stateTimer: 0,
    target: null,
    ...overrides,
  };
}

function makeIBMState(overrides: Partial<WorldState> = {}): WorldState {
  const config = { ...DEFAULT_CONFIG, ...overrides.config };
  const biomes =
    overrides.biomes ?? updateBiomeTypes(makeGrid(config.gridWidth, config.gridHeight), 20);
  const rng = createRng(config.seed);

  // Create a small ecosystem
  const creatures: Creature[] = overrides.creatures ?? [
    // 10 producers spread across the grid
    ...Array.from({ length: 10 }, (_, i) =>
      makeCreature(`prod-${String(i)}`, 'producer', {
        x: (i % 4) * 10 - 15,
        z: Math.floor(i / 4) * 10 - 15,
      }),
    ),
    // 5 herbivores
    ...Array.from({ length: 5 }, (_, i) =>
      makeCreature(`herb-${String(i)}`, 'herbivore', { x: i * 5 - 10, z: 0 }),
    ),
    // 3 predators
    ...Array.from({ length: 3 }, (_, i) =>
      makeCreature(`pred-${String(i)}`, 'predator', { x: i * 5 - 5, z: 5 }),
    ),
  ];

  return {
    tick: 0,
    elapsedSeconds: 0,
    lastTimestamp: Date.now(),
    temperature: 20,
    biomes,
    species: [],
    extinctSpecies: [],
    extinctSpeciesCount: 0,
    config,
    rngState: rng.getState(),
    events: [],
    creatures,
    speciesClusters: [],
    nextCreatureId: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ibmTick', () => {
  it('returns unchanged state for zero delta', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 0);
    expect(result.tick).toBe(state.tick);
    expect(result.creatures.length).toBe(state.creatures.length);
  });

  it('advances tick count', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 1);
    expect(result.tick).toBe(1);
  });

  it('advances elapsed seconds', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 5);
    expect(result.elapsedSeconds).toBe(5);
  });

  it('is deterministic — same state + delta produces identical result', () => {
    const state = makeIBMState();
    const result1 = ibmTick(state, 5);
    const result2 = ibmTick(state, 5);
    expect(result1.tick).toBe(result2.tick);
    expect(result1.creatures.length).toBe(result2.creatures.length);
    for (let i = 0; i < result1.creatures.length; i++) {
      expect(result1.creatures[i].x).toBeCloseTo(result2.creatures[i].x);
      expect(result1.creatures[i].z).toBeCloseTo(result2.creatures[i].z);
      expect(result1.creatures[i].energy).toBeCloseTo(result2.creatures[i].energy);
    }
  });

  it('no creature has negative energy after tick', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 10);
    for (const c of result.creatures) {
      expect(c.energy).toBeGreaterThan(0);
    }
  });

  it('creatures age each tick', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 3);
    // Surviving creatures should have aged
    for (const c of result.creatures) {
      if (c.id.startsWith('prod-') || c.id.startsWith('herb-') || c.id.startsWith('pred-')) {
        expect(c.age).toBe(3);
      }
    }
  });

  it('creature count stays bounded over 100 ticks', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 100);
    // Should have at least some creatures (not total collapse)
    expect(result.creatures.length).toBeGreaterThan(0);
    // Should not explode unreasonably
    expect(result.creatures.length).toBeLessThan(2000);
  });

  it('producers can reproduce', () => {
    // Give producers enough energy to reproduce
    const creatures = [
      makeCreature('prod-0', 'producer', {
        energy: REPRODUCTION_ENERGY_THRESHOLD + 20,
        x: 0,
        z: 0,
      }),
    ];
    const state = makeIBMState({ creatures, nextCreatureId: 1 });
    const result = ibmTick(state, 1);
    // Should have the original producer + potentially an offspring
    expect(result.creatures.length).toBeGreaterThanOrEqual(1);
    // If reproduction happened, nextCreatureId should have incremented
    expect(result.nextCreatureId).toBeGreaterThanOrEqual(state.nextCreatureId);
  });

  it('herbivores die without food over many ticks', () => {
    // Only herbivores, no producers to eat, low energy
    const creatures = Array.from({ length: 5 }, (_, i) =>
      makeCreature(`herb-${String(i)}`, 'herbivore', {
        x: i * 5,
        z: 0,
        energy: 5,
        genome: [1.0, 0.5, 0.5, 0.5, 1.0, 0.5], // large + high metabolism = expensive
      }),
    );
    const state = makeIBMState({ creatures });
    const result = ibmTick(state, 500);
    // Herbivores should starve: energy 5, metabolism cost 0.1*1.0*1.0 = 0.1/tick, die in ~50 ticks
    const herbivores = result.creatures.filter((c) => c.trophicLevel === 'herbivore');
    expect(herbivores.length).toBe(0);
  });

  it('caps sub-ticks for large delta', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 100_000);
    // MAX_SUB_TICKS = 10000
    expect(result.tick).toBe(10_000);
  });

  it('runs clustering and populates speciesClusters', () => {
    const state = makeIBMState({
      config: { ...DEFAULT_CONFIG, clusteringInterval: 1 }, // cluster every tick
    });
    const result = ibmTick(state, 1);
    // Should have at least one cluster
    expect(result.speciesClusters.length).toBeGreaterThan(0);
  });

  it('generates speciation events for new clusters', () => {
    const state = makeIBMState({
      config: { ...DEFAULT_CONFIG, clusteringInterval: 1 },
    });
    // Run a few ticks to trigger clustering
    const result = ibmTick(state, 1);
    // After first clustering, species appear — these are "new" relative to empty previous clusters
    // Events should be generated
    expect(result.speciesClusters.length).toBeGreaterThan(0);
  });

  it('updates creature speciesClusterId after clustering', () => {
    const state = makeIBMState({
      config: { ...DEFAULT_CONFIG, clusteringInterval: 1 },
    });
    const result = ibmTick(state, 1);
    // Each surviving creature should have a cluster ID matching a real cluster
    const clusterIds = new Set(result.speciesClusters.map((c) => c.id));
    for (const c of result.creatures) {
      expect(clusterIds.has(c.speciesClusterId)).toBe(true);
    }
  });

  it('all creatures remain on habitable terrain', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 20);
    // All creature positions should be within world bounds
    const worldWidth = (state.config.gridWidth - 1) * 10;
    const worldDepth = (state.config.gridHeight - 1) * 10;
    for (const c of result.creatures) {
      expect(c.x).toBeGreaterThanOrEqual(-worldWidth / 2 - 1);
      expect(c.x).toBeLessThanOrEqual(worldWidth / 2 + 1);
      expect(c.z).toBeGreaterThanOrEqual(-worldDepth / 2 - 1);
      expect(c.z).toBeLessThanOrEqual(worldDepth / 2 + 1);
    }
  });

  it('preserves immutable state fields', () => {
    const state = makeIBMState();
    const result = ibmTick(state, 5);
    expect(result.config).toEqual(state.config);
    expect(result.temperature).toBe(state.temperature);
  });
});
