/**
 * Biome energy production and trophic carrying capacity derivation.
 * Pure functions: biome data → energy values → carrying capacity.
 *
 * Phase 1 (BRF-013): Producer K from biome energy.
 * Phase 2 (BRF-014): Consumer K from trophic transfer.
 */

import type { Biome, BiomeType } from './types.ts';

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
