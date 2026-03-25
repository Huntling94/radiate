/**
 * World generation — creates the initial WorldState for a new simulation.
 * Deterministic: same seed always produces the same starting world.
 *
 * BRF-016: Creates individual IBM creatures instead of L-V species populations.
 */

import type { WorldState, Biome, SimConfig, Creature, TrophicLevel } from './types.ts';
import { createRng } from './rng.ts';
import type { Rng } from './rng.ts';
import { deriveBiomeType, isHabitable } from './biome.ts';
import { clusterCreatures } from './clustering.ts';
import { biomeToWorldXZ } from './spatial-utils.ts';
import {
  DEFAULT_GRID_WIDTH,
  DEFAULT_GRID_HEIGHT,
  INITIAL_CREATURE_COUNT,
  INITIAL_PRODUCER_FRACTION,
  INITIAL_HERBIVORE_FRACTION,
  INITIAL_CREATURE_ENERGY,
  CLUSTERING_INTERVAL,
} from './constants.ts';

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: SimConfig = {
  seed: 42,
  ticksPerSecond: 1,
  mutationRate: 0.05,
  mutationMagnitude: 0.1,
  speciationThreshold: 1.5,
  gridWidth: DEFAULT_GRID_WIDTH,
  gridHeight: DEFAULT_GRID_HEIGHT,
  clusteringInterval: CLUSTERING_INTERVAL,
};

const DEFAULT_TEMPERATURE = 20;
const BASE_CARRYING_CAPACITY = 500;

// Seed species base genomes
const SEED_GENOMES: Record<TrophicLevel, { genome: number[]; name: string }> = {
  producer: { genome: [0.4, 0.2, 0.5, 0.5, 0.3, 0.8], name: 'Proto Alga' },
  herbivore: { genome: [0.6, 0.5, 0.4, 0.4, 0.5, 0.5], name: 'Grazer' },
  predator: { genome: [0.8, 0.9, 0.3, 0.3, 0.7, 0.3], name: 'Stalker' },
};

// ---------------------------------------------------------------------------
// Biome generation
// ---------------------------------------------------------------------------

function generateBiomes(rng: Rng, config: SimConfig, temperature: number): Biome[] {
  const { gridWidth, gridHeight } = config;

  const rawElevation: number[] = [];
  const rawMoisture: number[] = [];

  for (let i = 0; i < gridWidth * gridHeight; i++) {
    rawElevation.push(rng.next());
    rawMoisture.push(rng.next());
  }

  const elevation = smooth(rawElevation, gridWidth, gridHeight);
  const moisture = smooth(rawMoisture, gridWidth, gridHeight);

  const biomes: Biome[] = [];
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const idx = y * gridWidth + x;
      const elev = elevation[idx] ?? 0;
      const moist = moisture[idx] ?? 0;
      const biomeType = deriveBiomeType(temperature, elev, moist);

      biomes.push({
        id: `biome-${String(x)}-${String(y)}`,
        x,
        y,
        elevation: elev,
        moisture: moist,
        biomeType,
        baseCarryingCapacity: isHabitable(biomeType) ? BASE_CARRYING_CAPACITY : 0,
      });
    }
  }

  return biomes;
}

function smooth(values: number[], width: number, height: number): number[] {
  const result: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += values[ny * width + nx] ?? 0;
            count++;
          }
        }
      }
      result.push(sum / count);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Seed creature generation (IBM)
// ---------------------------------------------------------------------------

function createSeedCreatures(
  rng: Rng,
  biomes: Biome[],
  config: SimConfig,
): { creatures: Creature[]; nextCreatureId: number } {
  const habitableBiomes = biomes.filter((b) => isHabitable(b.biomeType));
  if (habitableBiomes.length === 0) return { creatures: [], nextCreatureId: 0 };

  const creatures: Creature[] = [];
  let nextId = 0;

  const producerCount = Math.round(INITIAL_CREATURE_COUNT * INITIAL_PRODUCER_FRACTION);
  const herbivoreCount = Math.round(INITIAL_CREATURE_COUNT * INITIAL_HERBIVORE_FRACTION);
  const predatorCount = INITIAL_CREATURE_COUNT - producerCount - herbivoreCount;

  const levels: Array<{ level: TrophicLevel; count: number }> = [
    { level: 'producer', count: producerCount },
    { level: 'herbivore', count: herbivoreCount },
    { level: 'predator', count: predatorCount },
  ];

  for (const { level, count } of levels) {
    const seed = SEED_GENOMES[level];
    for (let i = 0; i < count; i++) {
      // Pick a random habitable biome
      const biome = habitableBiomes[rng.nextInt(0, habitableBiomes.length - 1)];
      const [wx, wz] = biomeToWorldXZ(biome, config.gridWidth, config.gridHeight);
      // Add random offset within the biome cell
      const offsetX = (rng.next() - 0.5) * 8;
      const offsetZ = (rng.next() - 0.5) * 8;

      // Add slight random variation to genome
      const genome = seed.genome.map((v) => v + rng.nextGaussian() * 0.02);

      creatures.push({
        id: `c-${String(nextId)}`,
        genome,
        x: wx + offsetX,
        z: wz + offsetZ,
        energy: INITIAL_CREATURE_ENERGY,
        age: 0,
        state: 'idle',
        trophicLevel: level,
        parentId: null,
        generation: 0,
        speciesClusterId: '',
        stateTimer: 0,
        target: null,
      });
      nextId++;
    }
  }

  return { creatures, nextCreatureId: nextId };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Create a new initial WorldState from a seed. Deterministic. */
export function createInitialState(seed: number): WorldState {
  const config: SimConfig = { ...DEFAULT_CONFIG, seed };
  const rng = createRng(seed);
  const temperature = DEFAULT_TEMPERATURE;
  const biomes = generateBiomes(rng, config, temperature);
  const { creatures, nextCreatureId } = createSeedCreatures(rng, biomes, config);

  // Run initial clustering to assign species
  let clusterNextId = nextCreatureId;
  const { clusters, creatureClusterMap } = clusterCreatures(
    creatures,
    [],
    biomes,
    config.gridWidth,
    config.gridHeight,
    0,
    rng,
    () => `sp-${String(clusterNextId++)}`,
  );

  // Assign cluster IDs to creatures
  for (const c of creatures) {
    const clusterId = creatureClusterMap.get(c.id);
    if (clusterId) {
      c.speciesClusterId = clusterId;
    }
  }

  return {
    tick: 0,
    elapsedSeconds: 0,
    lastTimestamp: Date.now(),
    temperature,
    biomes,
    species: clusters, // compatibility: species = speciesClusters
    extinctSpecies: [],
    extinctSpeciesCount: 0,
    config,
    rngState: rng.getState(),
    events: [],
    creatures,
    speciesClusters: clusters,
    nextCreatureId: clusterNextId,
  };
}
