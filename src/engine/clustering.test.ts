import { describe, it, expect } from 'vitest';
import { clusterCreatures, computeCentroid } from './clustering.ts';
import type { Creature } from './creature.ts';
import type { Biome } from './types.ts';
import { createRng } from './rng.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    speciesClusterId: '',
    stateTimer: 0,
    target: null,
    ...overrides,
  };
}

function makeGrid3x3(): Biome[] {
  const biomes: Biome[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      biomes.push({
        id: `b-${String(x)}-${String(y)}`,
        x,
        y,
        elevation: 0.5,
        moisture: 0.5,
        biomeType: 'grassland',
        baseCarryingCapacity: 500,
      });
    }
  }
  return biomes;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeCentroid', () => {
  it('returns element-wise average of genomes', () => {
    const genomes = [
      [0.2, 0.4, 0.6],
      [0.8, 0.6, 0.4],
    ];
    const centroid = computeCentroid(genomes);
    expect(centroid[0]).toBeCloseTo(0.5);
    expect(centroid[1]).toBeCloseTo(0.5);
    expect(centroid[2]).toBeCloseTo(0.5);
  });

  it('returns the genome itself for a single genome', () => {
    const centroid = computeCentroid([[0.3, 0.7, 0.5]]);
    expect(centroid).toEqual([0.3, 0.7, 0.5]);
  });

  it('returns empty array for no genomes', () => {
    expect(computeCentroid([])).toEqual([]);
  });
});

describe('clusterCreatures', () => {
  it('groups identical genomes into one cluster', () => {
    const creatures = [
      makeCreature({ id: 'c1', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
      makeCreature({ id: 'c2', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
      makeCreature({ id: 'c3', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
    ];
    const rng = createRng(42);
    let nextId = 1;

    const { clusters, creatureClusterMap } = clusterCreatures(
      creatures,
      [],
      makeGrid3x3(),
      3,
      3,
      100,
      rng,
      () => `sp${String(nextId++)}`,
    );

    expect(clusters).toHaveLength(1);
    expect(clusters[0].memberCount).toBe(3);
    expect(creatureClusterMap.size).toBe(3);
  });

  it('separates genetically distant creatures into different clusters', () => {
    const creatures = [
      makeCreature({ id: 'c1', genome: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1] }),
      makeCreature({ id: 'c2', genome: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1] }),
      makeCreature({ id: 'c3', genome: [1.9, 1.9, 0.9, 0.9, 1.9, 1.9] }),
      makeCreature({ id: 'c4', genome: [1.9, 1.9, 0.9, 0.9, 1.9, 1.9] }),
    ];
    const rng = createRng(42);
    let nextId = 1;

    const { clusters } = clusterCreatures(
      creatures,
      [],
      makeGrid3x3(),
      3,
      3,
      100,
      rng,
      () => `sp${String(nextId++)}`,
    );

    expect(clusters.length).toBeGreaterThanOrEqual(2);
  });

  it('preserves stable cluster IDs across re-clustering', () => {
    const creatures = [
      makeCreature({ id: 'c1', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
      makeCreature({ id: 'c2', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
    ];
    const rng = createRng(42);
    let nextId = 1;

    // First clustering
    const { clusters: clusters1 } = clusterCreatures(
      creatures,
      [],
      makeGrid3x3(),
      3,
      3,
      100,
      rng,
      () => `sp${String(nextId++)}`,
    );

    // Second clustering with same creatures but providing previous clusters
    const { clusters: clusters2 } = clusterCreatures(
      creatures,
      clusters1,
      makeGrid3x3(),
      3,
      3,
      200,
      rng,
      () => `sp${String(nextId++)}`,
    );

    expect(clusters2[0].id).toBe(clusters1[0].id);
    expect(clusters2[0].name).toBe(clusters1[0].name);
  });

  it('returns empty clusters for empty creatures', () => {
    const rng = createRng(42);
    let nextId = 1;

    const { clusters, creatureClusterMap } = clusterCreatures(
      [],
      [],
      makeGrid3x3(),
      3,
      3,
      100,
      rng,
      () => `sp${String(nextId++)}`,
    );

    expect(clusters).toHaveLength(0);
    expect(creatureClusterMap.size).toBe(0);
  });

  it('derives populationByBiome from creature positions', () => {
    const creatures = [
      makeCreature({ id: 'c1', x: 0, z: 0 }),
      makeCreature({ id: 'c2', x: 0, z: 0 }),
      makeCreature({ id: 'c3', x: 5, z: 5 }),
    ];
    const rng = createRng(42);
    let nextId = 1;

    const { clusters } = clusterCreatures(
      creatures,
      [],
      makeGrid3x3(),
      3,
      3,
      100,
      rng,
      () => `sp${String(nextId++)}`,
    );

    const cluster = clusters[0];
    const totalPop = Object.values(cluster.populationByBiome).reduce((s, n) => s + n, 0);
    expect(totalPop).toBe(3);
  });

  it('separates creatures of different trophic levels', () => {
    const creatures = [
      makeCreature({ id: 'c1', trophicLevel: 'producer', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
      makeCreature({ id: 'c2', trophicLevel: 'producer', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
      makeCreature({ id: 'c3', trophicLevel: 'herbivore', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
      makeCreature({ id: 'c4', trophicLevel: 'herbivore', genome: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }),
    ];
    const rng = createRng(42);
    let nextId = 1;

    const { clusters } = clusterCreatures(
      creatures,
      [],
      makeGrid3x3(),
      3,
      3,
      100,
      rng,
      () => `sp${String(nextId++)}`,
    );

    // Should have at least 2 clusters (one per trophic level)
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    const trophicLevels = new Set(clusters.map((c) => c.trophicLevel));
    expect(trophicLevels.has('producer')).toBe(true);
    expect(trophicLevels.has('herbivore')).toBe(true);
  });

  it('assigns a colour to each cluster', () => {
    const creatures = [makeCreature({ id: 'c1' }), makeCreature({ id: 'c2' })];
    const rng = createRng(42);
    let nextId = 1;

    const { clusters } = clusterCreatures(
      creatures,
      [],
      makeGrid3x3(),
      3,
      3,
      100,
      rng,
      () => `sp${String(nextId++)}`,
    );

    expect(clusters[0].color).toMatch(/^hsl\(/);
  });
});
