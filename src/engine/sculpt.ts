/**
 * Terrain sculpting — pure functions to modify biome elevation/moisture.
 * Player's first strategic intervention: reshape the world.
 */

import type { Biome } from './types.ts';
import { updateBiomeTypes } from './environment.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SculptAction {
  /** Biome to modify */
  biomeId: string;
  /** Change to elevation (-1 to 1 typical range: ±0.05 per stroke) */
  elevationDelta: number;
  /** Change to moisture (-1 to 1 typical range: ±0.05 per stroke) */
  moistureDelta: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply sculpt actions to biomes, re-derive biome types and carrying capacities.
 * Returns a new biomes array — does not mutate the input.
 */
export function applySculpt(
  biomes: readonly Biome[],
  actions: readonly SculptAction[],
  temperature: number,
): Biome[] {
  if (actions.length === 0) return biomes.map((b) => ({ ...b }));

  // Index actions by biome ID for O(1) lookup
  const deltaMap = new Map<string, { elev: number; moist: number }>();
  for (const action of actions) {
    const existing = deltaMap.get(action.biomeId);
    if (existing) {
      existing.elev += action.elevationDelta;
      existing.moist += action.moistureDelta;
    } else {
      deltaMap.set(action.biomeId, {
        elev: action.elevationDelta,
        moist: action.moistureDelta,
      });
    }
  }

  // Apply deltas and clamp
  const modified = biomes.map((biome) => {
    const delta = deltaMap.get(biome.id);
    if (!delta) return { ...biome };

    return {
      ...biome,
      elevation: Math.max(0, Math.min(1, biome.elevation + delta.elev)),
      moisture: Math.max(0, Math.min(1, biome.moisture + delta.moist)),
    };
  });

  // Re-derive biome types and carrying capacities
  return updateBiomeTypes(modified, temperature);
}
