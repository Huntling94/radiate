/**
 * World generation — creates the initial WorldState for a new simulation.
 * Deterministic: same seed always produces the same starting world.
 */

import type { WorldState, Biome, Species, SimConfig } from './types.ts';
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

function createSeedSpecies(rng: Rng, biomes: Biome[]): Species[] {
  const habitableBiomes = biomes.filter((b) => isHabitable(b.biomeType));

  // --- Producer: Proto Alga ---
  // High reproduction, moderate traits, present in all habitable biomes
  const producerGenome = [0.4, 0.2, 0.5, 0.5, 0.3, 0.8]; // size, speed, cold, heat, metabolism, reproduction
  const producerPop: Record<string, number> = {};
  for (const biome of habitableBiomes) {
    producerPop[biome.id] = 200;
  }

  // --- Herbivore: Grazer ---
  // Moderate speed, eats producers, present in most habitable biomes
  const herbivorePop: Record<string, number> = {};
  for (const biome of habitableBiomes) {
    herbivorePop[biome.id] = 50;
  }

  // --- Predator: Stalker ---
  // High speed, eats herbivores, present in fewer biomes with low population
  const predatorPop: Record<string, number> = {};
  let predatorBiomeCount = 0;
  for (const biome of habitableBiomes) {
    if (predatorBiomeCount < Math.ceil(habitableBiomes.length / 2)) {
      predatorPop[biome.id] = 10;
      predatorBiomeCount++;
    }
  }

  // Add slight random variation to genomes for uniqueness
  const varyGenome = (base: number[]): number[] => base.map((v) => v + rng.nextGaussian() * 0.02);

  return [
    {
      id: 'species-0',
      name: 'Proto Alga',
      genome: varyGenome(producerGenome),
      populationByBiome: producerPop,
      trophicLevel: 'producer',
      parentSpeciesId: null,
      originTick: 0,
      generation: 0,
    },
    {
      id: 'species-1',
      name: 'Grazer',
      genome: varyGenome([0.6, 0.5, 0.4, 0.4, 0.5, 0.5]),
      populationByBiome: herbivorePop,
      trophicLevel: 'herbivore',
      parentSpeciesId: null,
      originTick: 0,
      generation: 0,
    },
    {
      id: 'species-2',
      name: 'Stalker',
      genome: varyGenome([0.8, 0.9, 0.3, 0.3, 0.7, 0.3]),
      populationByBiome: predatorPop,
      trophicLevel: 'predator',
      parentSpeciesId: null,
      originTick: 0,
      generation: 0,
    },
  ];
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
  const species = createSeedSpecies(rng, biomes);

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
