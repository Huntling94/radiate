import { describe, it, expect } from 'vitest';
import {
  computeLifespan,
  metabolismCost,
  canReproduce,
  reproduce,
  producerTick,
  herbivoreTick,
  predatorTick,
} from './creature.ts';
import type { Creature } from './creature.ts';
import type { Biome, SimConfig } from './types.ts';
import { expressTraits } from './types.ts';
import { createRng } from './rng.ts';
import { createSpatialHash } from './spatial-hash.ts';
import {
  MINIMUM_LIFESPAN,
  REPRODUCTION_ENERGY_THRESHOLD,
  OFFSPRING_STARTING_ENERGY,
  SPATIAL_HASH_CELL_SIZE,
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
  gridWidth: 3,
  gridHeight: 3,
};

function makeCreature(overrides: Partial<Creature> = {}): Creature {
  return {
    id: 'c0',
    genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    x: 0,
    z: 0,
    energy: 60,
    age: 0,
    state: 'idle',
    trophicLevel: 'producer',
    parentId: null,
    generation: 0,
    speciesClusterId: 'sp0',
    stateTimer: 0,
    target: null,
    ...overrides,
  };
}

function makeBiome(overrides: Partial<Biome> = {}): Biome {
  return {
    id: 'b0',
    x: 0,
    y: 0,
    elevation: 0.5,
    moisture: 0.5,
    biomeType: 'grassland',
    baseCarryingCapacity: 500,
    ...overrides,
  };
}

function makeGrid3x3(): Biome[] {
  const biomes: Biome[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      biomes.push(
        makeBiome({
          id: `b-${String(x)}-${String(y)}`,
          x,
          y,
          biomeType: 'grassland',
          elevation: 0.5,
          moisture: 0.5,
        }),
      );
    }
  }
  return biomes;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeLifespan', () => {
  it('returns a positive value for any valid genome', () => {
    expect(computeLifespan([0.5, 0.5, 0.5, 0.5, 0.5, 0.5])).toBeGreaterThan(0);
  });

  it('clamps to minimum lifespan for extreme genomes', () => {
    // Large size + high metabolism = shortest lifespan
    const lifespan = computeLifespan([2.0, 0.5, 0.5, 0.5, 2.0, 0.5]);
    expect(lifespan).toBe(MINIMUM_LIFESPAN);
  });

  it('larger creatures have shorter lifespans than smaller ones', () => {
    const smallLifespan = computeLifespan([0.2, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const largeLifespan = computeLifespan([1.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(smallLifespan).toBeGreaterThan(largeLifespan);
  });

  it('high metabolism creatures have shorter lifespans', () => {
    const lowMeta = computeLifespan([0.5, 0.5, 0.5, 0.5, 0.2, 0.5]);
    const highMeta = computeLifespan([0.5, 0.5, 0.5, 0.5, 1.5, 0.5]);
    expect(lowMeta).toBeGreaterThan(highMeta);
  });
});

describe('metabolismCost', () => {
  it('returns a positive value', () => {
    const traits = expressTraits([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(metabolismCost(traits)).toBeGreaterThan(0);
  });

  it('increases with size', () => {
    const small = metabolismCost(expressTraits([0.2, 0.5, 0.5, 0.5, 0.5, 0.5]));
    const large = metabolismCost(expressTraits([1.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(large).toBeGreaterThan(small);
  });

  it('increases with metabolism trait', () => {
    const low = metabolismCost(expressTraits([0.5, 0.5, 0.5, 0.5, 0.2, 0.5]));
    const high = metabolismCost(expressTraits([0.5, 0.5, 0.5, 0.5, 1.5, 0.5]));
    expect(high).toBeGreaterThan(low);
  });
});

describe('canReproduce', () => {
  it('returns false when energy is below threshold', () => {
    const creature = makeCreature({ energy: REPRODUCTION_ENERGY_THRESHOLD - 1 });
    expect(canReproduce(creature)).toBe(false);
  });

  it('returns true when energy meets threshold', () => {
    const creature = makeCreature({ energy: REPRODUCTION_ENERGY_THRESHOLD });
    expect(canReproduce(creature)).toBe(true);
  });
});

describe('reproduce', () => {
  it('creates an offspring with mutated genome', () => {
    const rng = createRng(42);
    const parent = makeCreature({ energy: 200 });
    const biomes = makeGrid3x3();

    const child = reproduce(parent, 'c1', rng, DEFAULT_CONFIG, biomes, 3, 3);
    expect(child).not.toBeNull();
    expect(child?.id).toBe('c1');
    expect(child?.parentId).toBe('c0');
    expect(child?.generation).toBe(1);
    expect(child?.energy).toBe(OFFSPRING_STARTING_ENERGY);
    // Genome should be different due to mutation
    expect(child?.genome).not.toEqual(parent.genome);
  });

  it('offspring inherits trophic level from parent', () => {
    const rng = createRng(42);
    const parent = makeCreature({ trophicLevel: 'herbivore', energy: 200 });
    const biomes = makeGrid3x3();

    const child = reproduce(parent, 'c1', rng, DEFAULT_CONFIG, biomes, 3, 3);
    expect(child?.trophicLevel).toBe('herbivore');
  });
});

describe('producerTick', () => {
  it('gains energy from photosynthesis in habitable biome', () => {
    const creature = makeCreature({ energy: 50, trophicLevel: 'producer' });
    const biomes = makeGrid3x3();
    const hash = createSpatialHash<Creature>(SPATIAL_HASH_CELL_SIZE);
    hash.insert(creature);
    const rng = createRng(42);
    let id = 1;

    const result = producerTick(
      creature,
      hash,
      biomes,
      20,
      rng,
      DEFAULT_CONFIG,
      3,
      3,
      new Set(),
      () => `c${String(id++)}`,
    );

    expect(result.dead).toBe(false);
    // Energy should have changed (gained from photosynthesis, lost from metabolism)
    expect(creature.energy).not.toBe(50);
    expect(creature.age).toBe(1);
  });

  it('dies when age exceeds lifespan', () => {
    const lifespan = computeLifespan([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const creature = makeCreature({
      energy: 50,
      trophicLevel: 'producer',
      age: lifespan + 1,
    });
    const biomes = makeGrid3x3();
    const hash = createSpatialHash<Creature>(SPATIAL_HASH_CELL_SIZE);
    hash.insert(creature);
    const rng = createRng(42);
    let id = 1;

    const result = producerTick(
      creature,
      hash,
      biomes,
      20,
      rng,
      DEFAULT_CONFIG,
      3,
      3,
      new Set(),
      () => `c${String(id++)}`,
    );

    expect(result.dead).toBe(true);
  });

  it('reproduces when energy exceeds threshold', () => {
    const creature = makeCreature({
      energy: REPRODUCTION_ENERGY_THRESHOLD + 10,
      trophicLevel: 'producer',
    });
    const biomes = makeGrid3x3();
    const hash = createSpatialHash<Creature>(SPATIAL_HASH_CELL_SIZE);
    hash.insert(creature);
    const rng = createRng(42);
    let id = 1;

    const result = producerTick(
      creature,
      hash,
      biomes,
      20,
      rng,
      DEFAULT_CONFIG,
      3,
      3,
      new Set(),
      () => `c${String(id++)}`,
    );

    expect(result.offspring).not.toBeNull();
    expect(creature.energy).toBeLessThan(REPRODUCTION_ENERGY_THRESHOLD);
  });
});

describe('herbivoreTick', () => {
  it('moves toward a nearby producer', () => {
    const herbivore = makeCreature({
      id: 'h0',
      trophicLevel: 'herbivore',
      energy: 50,
      x: 0,
      z: 0,
    });
    const producer = makeCreature({
      id: 'p0',
      trophicLevel: 'producer',
      energy: 50,
      x: 5,
      z: 0,
    });

    const hash = createSpatialHash<Creature>(SPATIAL_HASH_CELL_SIZE);
    hash.insert(herbivore);
    hash.insert(producer);

    const biomes = makeGrid3x3();
    const rng = createRng(42);
    let id = 1;

    herbivoreTick(
      herbivore,
      hash,
      biomes,
      20,
      rng,
      DEFAULT_CONFIG,
      3,
      3,
      new Set(),
      () => `c${String(id++)}`,
    );

    // Herbivore should have moved toward the producer
    expect(herbivore.x).toBeGreaterThan(0);
  });

  it('gains energy when eating a producer', () => {
    const herbivore = makeCreature({
      id: 'h0',
      trophicLevel: 'herbivore',
      energy: 50,
      x: 0,
      z: 0,
    });
    // Place producer within FEED_DISTANCE
    const producer = makeCreature({
      id: 'p0',
      trophicLevel: 'producer',
      energy: 50,
      x: 1,
      z: 0,
    });

    const hash = createSpatialHash<Creature>(SPATIAL_HASH_CELL_SIZE);
    hash.insert({ ...herbivore, x: 0, z: 0 });
    hash.insert({ ...producer, x: 1, z: 0 });

    const biomes = makeGrid3x3();
    const rng = createRng(42);
    let id = 1;

    const result = herbivoreTick(
      herbivore,
      hash,
      biomes,
      20,
      rng,
      DEFAULT_CONFIG,
      3,
      3,
      new Set(),
      () => `c${String(id++)}`,
    );

    expect(result.killedId).toBe('p0');
    // Energy should include feed energy minus metabolism
    expect(herbivore.energy).toBeGreaterThan(50);
  });
});

describe('predatorTick', () => {
  it('hunts nearby herbivores', () => {
    const predator = makeCreature({
      id: 'pred0',
      trophicLevel: 'predator',
      energy: 50,
      x: 0,
      z: 0,
      genome: [0.5, 1.0, 0.5, 0.5, 0.5, 0.5], // fast
    });
    const herbivore = makeCreature({
      id: 'h0',
      trophicLevel: 'herbivore',
      energy: 50,
      x: 5,
      z: 0,
    });

    const hash = createSpatialHash<Creature>(SPATIAL_HASH_CELL_SIZE);
    hash.insert({ ...predator, x: 0, z: 0 });
    hash.insert({ ...herbivore, x: 5, z: 0 });

    const biomes = makeGrid3x3();
    const rng = createRng(42);
    let id = 1;

    predatorTick(
      predator,
      hash,
      biomes,
      20,
      rng,
      DEFAULT_CONFIG,
      3,
      3,
      new Set(),
      () => `c${String(id++)}`,
    );

    expect(predator.state).toBe('hunting');
    expect(predator.x).toBeGreaterThan(0);
  });

  it('gains energy when catching a herbivore', () => {
    const predator = makeCreature({
      id: 'pred0',
      trophicLevel: 'predator',
      energy: 50,
      x: 0,
      z: 0,
    });
    const herbivore = makeCreature({
      id: 'h0',
      trophicLevel: 'herbivore',
      energy: 50,
      x: 1,
      z: 0,
    });

    const hash = createSpatialHash<Creature>(SPATIAL_HASH_CELL_SIZE);
    hash.insert({ ...predator, x: 0, z: 0 });
    hash.insert({ ...herbivore, x: 1, z: 0 });

    const biomes = makeGrid3x3();
    const rng = createRng(42);
    let id = 1;

    const result = predatorTick(
      predator,
      hash,
      biomes,
      20,
      rng,
      DEFAULT_CONFIG,
      3,
      3,
      new Set(),
      () => `c${String(id++)}`,
    );

    expect(result.killedId).toBe('h0');
    expect(predator.energy).toBeGreaterThan(50);
  });
});
