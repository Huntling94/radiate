/**
 * World generation — creates the initial WorldState for a new simulation.
 * Deterministic: same seed always produces the same starting world.
 */

import type { WorldState, Biome, Species, SimConfig } from './types.ts';
import { GENOME_LENGTH } from './types.ts';
import { createRng } from './rng.ts';
import type { Rng } from './rng.ts';
import { deriveBiomeType, isHabitable } from './biome.ts';

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: SimConfig = {
  seed: 42,
  ticksPerSecond: 1,
  mutationRate: 0.05,
  mutationMagnitude: 0.1,
  speciationThreshold: 1.5,
  gridWidth: 8,
  gridHeight: 6,
};

const DEFAULT_TEMPERATURE = 20;
const BASE_CARRYING_CAPACITY = 500;
const INITIAL_POPULATION_PER_BIOME = 50;

// ---------------------------------------------------------------------------
// Biome generation
// ---------------------------------------------------------------------------

function generateBiomes(rng: Rng, config: SimConfig, temperature: number): Biome[] {
  const { gridWidth, gridHeight } = config;

  // Generate raw elevation and moisture
  const rawElevation: number[] = [];
  const rawMoisture: number[] = [];

  for (let i = 0; i < gridWidth * gridHeight; i++) {
    rawElevation.push(rng.next());
    rawMoisture.push(rng.next());
  }

  // Smooth with neighbours for natural-looking clusters
  const elevation = smooth(rawElevation, gridWidth, gridHeight);
  const moisture = smooth(rawMoisture, gridWidth, gridHeight);

  // Build biome array
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

/** Simple neighbour averaging for smoother terrain. */
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
// Seed species
// ---------------------------------------------------------------------------

function createSeedSpecies(rng: Rng, biomes: Biome[]): Species {
  // Balanced genome — middle of each trait range
  const genome: number[] = [];
  for (let i = 0; i < GENOME_LENGTH; i++) {
    // Slight variation around 0.5 for each trait
    genome.push(0.5 + rng.nextGaussian() * 0.05);
  }

  // Distribute initial population across habitable biomes
  const populationByBiome: Record<string, number> = {};
  for (const biome of biomes) {
    if (isHabitable(biome.biomeType)) {
      populationByBiome[biome.id] = INITIAL_POPULATION_PER_BIOME;
    }
  }

  return {
    id: 'species-0',
    name: 'Proto Alga',
    genome,
    populationByBiome,
    trophicLevel: 'producer',
    parentSpeciesId: null,
    originTick: 0,
    generation: 0,
  };
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
  const species = [createSeedSpecies(rng, biomes)];

  return {
    tick: 0,
    elapsedSeconds: 0,
    lastTimestamp: Date.now(),
    temperature,
    biomes,
    species,
    extinctSpeciesCount: 0,
    config,
    rngState: rng.getState(),
  };
}
