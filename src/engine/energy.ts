/**
 * Biome energy production and trophic carrying capacity derivation.
 * Pure functions: biome data → energy values → carrying capacity.
 *
 * Phase 1 (BRF-013): Producer K from biome energy.
 * Phase 2 (BRF-014): Consumer K from trophic transfer.
 */

import type { Biome, BiomeType, Species, TrophicLevel } from './types.ts';
import { expressTraits } from './types.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base energy production per biome type (net primary productivity units). */
const BIOME_ENERGY: Record<BiomeType, number> = {
  forest: 1000,
  grassland: 700,
  tundra: 300,
  desert: 200,
  ocean: 0,
  mountain: 0,
};

/** Temperature at which energy production peaks. */
const OPTIMAL_TEMPERATURE = 20;

/** Rate at which energy declines per degree from optimal. */
const TEMPERATURE_DECLINE_RATE = 0.015;

/** Minimum temperature factor — prevents total shutdown at extreme temps. */
const TEMPERATURE_FLOOR = 0.1;

/** Minimum moisture contribution — even dry biomes produce some energy. */
const MOISTURE_BASE = 0.5;

/** Fraction of energy transferred between trophic levels (Lindeman's rule). */
const TRANSFER_EFFICIENCY = 0.1;

/** Minimum consumer K in habitable biomes — prevents instant death spirals. */
const MIN_CONSUMER_K = 5;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Moisture contribution to energy production. Range [0.5, 1.5]. */
export function moistureFactor(moisture: number): number {
  return MOISTURE_BASE + moisture;
}

/** Temperature contribution to energy production. Peaks at 20°C, floor at 0.1. */
export function temperatureFactor(temperature: number): number {
  const deviation = Math.abs(temperature - OPTIMAL_TEMPERATURE);
  return Math.max(TEMPERATURE_FLOOR, 1 - deviation * TEMPERATURE_DECLINE_RATE);
}

/** Total energy produced by a biome, combining type, moisture, and temperature. */
export function computeBiomeEnergy(biome: Biome, temperature: number): number {
  const base = BIOME_ENERGY[biome.biomeType];
  if (base === 0) return 0;
  return base * moistureFactor(biome.moisture) * temperatureFactor(temperature);
}

/**
 * Compute carrying capacity for producers in a biome.
 * Producer K equals biome energy — the amount of plant biomass the biome can sustain.
 */
export function computeProducerK(biome: Biome, temperature: number): number {
  return computeBiomeEnergy(biome, temperature);
}

// ---------------------------------------------------------------------------
// Consumer carrying capacity (BRF-014)
// ---------------------------------------------------------------------------

/**
 * Metabolism-based K modifier for consumers.
 * High metabolism → lower K (each individual needs more energy).
 * Low metabolism → higher K (more efficient, fewer calories per individual).
 */
export function metabolismKModifier(species: Species): number {
  const traits = expressTraits(species.genome);
  return 1.0 / (0.5 + traits.metabolism * 0.5);
}

/**
 * Sum total population of a given trophic level in a specific biome.
 */
function sumTrophicPopInBiome(
  biomeId: string,
  trophicLevel: TrophicLevel,
  biomePopulations: Map<string, number[]>,
  allSpecies: readonly Species[],
): number {
  const pops = biomePopulations.get(biomeId);
  if (!pops) return 0;

  let total = 0;
  for (let i = 0; i < allSpecies.length; i++) {
    if (allSpecies[i].trophicLevel === trophicLevel) {
      total += pops[i] ?? 0;
    }
  }
  return total;
}

/**
 * Compute carrying capacity for a herbivore species in a biome.
 * Derived from total producer biomass × transfer efficiency × metabolism modifier.
 */
export function computeHerbivoreK(
  biomeId: string,
  species: Species,
  biomePopulations: Map<string, number[]>,
  allSpecies: readonly Species[],
): number {
  const producerBiomass = sumTrophicPopInBiome(biomeId, 'producer', biomePopulations, allSpecies);
  const k = producerBiomass * TRANSFER_EFFICIENCY * metabolismKModifier(species);
  return Math.max(MIN_CONSUMER_K, k);
}

/**
 * Compute carrying capacity for a predator species in a biome.
 * Derived from total herbivore biomass × transfer efficiency × metabolism modifier.
 */
export function computePredatorK(
  biomeId: string,
  species: Species,
  biomePopulations: Map<string, number[]>,
  allSpecies: readonly Species[],
): number {
  const herbivoreBiomass = sumTrophicPopInBiome(biomeId, 'herbivore', biomePopulations, allSpecies);
  const k = herbivoreBiomass * TRANSFER_EFFICIENCY * metabolismKModifier(species);
  return Math.max(MIN_CONSUMER_K, k);
}
