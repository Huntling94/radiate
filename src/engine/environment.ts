/**
 * Environmental effects — temperature impacts on species fitness and biome types.
 */

import type { Species, Biome } from './types.ts';
import { expressTraits } from './types.ts';
import { deriveBiomeType, isHabitable } from './biome.ts';

/**
 * Compute a fitness modifier (0–1.5) for a species at a given temperature.
 * Species with matching tolerance traits get ~1.0; poorly matched get < 1.0.
 */
export function computeFitnessModifier(species: Species, temperature: number): number {
  const traits = expressTraits(species.genome);

  // Ideal temperature derived from tolerance traits
  // High heat tolerance → ideal is warmer; high cold tolerance → ideal is cooler
  const idealTemp = 20 + (traits.heatTolerance - traits.coldTolerance) * 30;

  // Distance from ideal temperature, scaled by sensitivity
  const tempDistance = Math.abs(temperature - idealTemp);
  const sensitivity = 0.02; // how much each degree of deviation reduces fitness

  const modifier = Math.max(0, 1 - tempDistance * sensitivity);
  return Math.min(1.5, modifier); // cap at 1.5 for well-adapted species
}

/**
 * Update biome types based on the current temperature.
 * Returns new biome array with updated types and carrying capacities.
 */
export function updateBiomeTypes(biomes: Biome[], temperature: number): Biome[] {
  const BASE_CARRYING_CAPACITY = 500;

  return biomes.map((biome) => {
    const newType = deriveBiomeType(temperature, biome.elevation, biome.moisture);
    return {
      ...biome,
      biomeType: newType,
      baseCarryingCapacity: isHabitable(newType) ? BASE_CARRYING_CAPACITY : 0,
    };
  });
}
