/**
 * Biome type derivation from environmental conditions.
 * Pure function: temperature + elevation + moisture → BiomeType.
 */

import type { BiomeType } from './types.ts';

/** Derive biome type from environmental parameters. */
export function deriveBiomeType(
  temperature: number,
  elevation: number,
  moisture: number,
): BiomeType {
  if (elevation > 0.8) return 'mountain';
  if (elevation < 0.15) return 'ocean';
  if (temperature < 0 && elevation < 0.8) return 'tundra';
  if (moisture < 0.3) return 'desert';
  if (moisture > 0.6) return 'forest';
  return 'grassland';
}

/** Colour mapping for biome types — used by the renderer. */
export const BIOME_COLOURS: Record<BiomeType, string> = {
  ocean: '#1a6b8a',
  desert: '#c4a74e',
  grassland: '#5b8c3e',
  forest: '#2d5a1e',
  tundra: '#b8c8d0',
  mountain: '#6b6b6b',
};

/** Whether a biome type can sustain species populations. */
export function isHabitable(biomeType: BiomeType): boolean {
  return biomeType !== 'ocean' && biomeType !== 'mountain';
}
