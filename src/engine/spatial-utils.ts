/**
 * Spatial coordinate utilities for the simulation engine.
 *
 * Converts between world positions (continuous x/z) and biome grid coordinates.
 * These are the authoritative implementations — src/world3d/terrain.ts will
 * be updated to re-export from here during the IBM integration phase.
 *
 * Pure TypeScript, no rendering dependencies.
 *
 * BRF-016: IBM Engine Core
 */

import type { Biome } from './types.ts';
import { isHabitable } from './biome.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** World units per biome cell. */
export const CELL_SIZE = 10;

/** Maximum terrain height in world units. */
export const MAX_HEIGHT = 12;

/** Ocean floor depth in world units. */
const OCEAN_DEPTH = -2;

// ---------------------------------------------------------------------------
// Coordinate conversion
// ---------------------------------------------------------------------------

/**
 * Convert biome grid coordinates to world x/z position (centre of cell).
 */
export function biomeToWorldXZ(
  biome: { x: number; y: number },
  gridWidth: number,
  gridHeight: number,
): [number, number] {
  const worldWidth = (gridWidth - 1) * CELL_SIZE;
  const worldDepth = (gridHeight - 1) * CELL_SIZE;
  const wx = (biome.x / (gridWidth - 1)) * worldWidth - worldWidth / 2;
  const wz = (biome.y / (gridHeight - 1)) * worldDepth - worldDepth / 2;
  return [wx, wz];
}

/**
 * Convert world x/z position to biome grid coordinates.
 * Returns integer grid coords, clamped to grid bounds.
 */
export function worldXZToBiomeCoords(
  wx: number,
  wz: number,
  gridWidth: number,
  gridHeight: number,
): { gx: number; gy: number } {
  const worldWidth = (gridWidth - 1) * CELL_SIZE;
  const worldDepth = (gridHeight - 1) * CELL_SIZE;

  const nx = (wx + worldWidth / 2) / worldWidth;
  const nz = (wz + worldDepth / 2) / worldDepth;

  const gx = Math.max(0, Math.min(gridWidth - 1, Math.round(nx * (gridWidth - 1))));
  const gy = Math.max(0, Math.min(gridHeight - 1, Math.round(nz * (gridHeight - 1))));

  return { gx, gy };
}

/**
 * Get the world bounds for a given grid size.
 */
export function getWorldBounds(
  gridWidth: number,
  gridHeight: number,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const worldWidth = (gridWidth - 1) * CELL_SIZE;
  const worldDepth = (gridHeight - 1) * CELL_SIZE;
  return {
    minX: -worldWidth / 2,
    maxX: worldWidth / 2,
    minZ: -worldDepth / 2,
    maxZ: worldDepth / 2,
  };
}

// ---------------------------------------------------------------------------
// Biome lookup helpers
// ---------------------------------------------------------------------------

/**
 * Get the biome at grid coordinates. Returns undefined if out of bounds.
 */
function getBiomeAt(
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
  gx: number,
  gy: number,
): Biome | undefined {
  const cx = Math.max(0, Math.min(gridWidth - 1, Math.round(gx)));
  const cy = Math.max(0, Math.min(gridHeight - 1, Math.round(gy)));
  return biomes[cy * gridWidth + cx];
}

/**
 * Bilinear interpolation of elevation at fractional grid coordinates.
 */
function bilinearElevation(
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
  gx: number,
  gy: number,
): number {
  const cx = Math.max(0, Math.min(gridWidth - 1, gx));
  const cy = Math.max(0, Math.min(gridHeight - 1, gy));

  const x0 = Math.floor(cx);
  const x1 = Math.min(x0 + 1, gridWidth - 1);
  const y0 = Math.floor(cy);
  const y1 = Math.min(y0 + 1, gridHeight - 1);

  const fx = cx - x0;
  const fy = cy - y0;

  const e00 = biomes[y0 * gridWidth + x0]?.elevation ?? 0;
  const e10 = biomes[y0 * gridWidth + x1]?.elevation ?? 0;
  const e01 = biomes[y1 * gridWidth + x0]?.elevation ?? 0;
  const e11 = biomes[y1 * gridWidth + x1]?.elevation ?? 0;

  const top = e00 * (1 - fx) + e10 * fx;
  const bottom = e01 * (1 - fx) + e11 * fx;
  return top * (1 - fy) + bottom * fy;
}

// ---------------------------------------------------------------------------
// Height and habitability queries
// ---------------------------------------------------------------------------

/**
 * Get terrain height at any world x/z position by interpolating the biome grid.
 */
export function getHeightAtWorldXZ(
  wx: number,
  wz: number,
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
): number {
  const worldWidth = (gridWidth - 1) * CELL_SIZE;
  const worldDepth = (gridHeight - 1) * CELL_SIZE;

  const nx = (wx + worldWidth / 2) / worldWidth;
  const nz = (wz + worldDepth / 2) / worldDepth;

  const gx = nx * (gridWidth - 1);
  const gy = nz * (gridHeight - 1);

  const elevation = bilinearElevation(biomes, gridWidth, gridHeight, gx, gy);
  const biome = getBiomeAt(biomes, gridWidth, gridHeight, gx, gy);
  const biomeType = biome?.biomeType ?? 'grassland';
  return biomeType === 'ocean' ? OCEAN_DEPTH : elevation * MAX_HEIGHT;
}

/**
 * Check if a world x/z position is on habitable terrain.
 */
export function isPositionHabitable(
  wx: number,
  wz: number,
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
): boolean {
  const worldWidth = (gridWidth - 1) * CELL_SIZE;
  const worldDepth = (gridHeight - 1) * CELL_SIZE;

  const nx = (wx + worldWidth / 2) / worldWidth;
  const nz = (wz + worldDepth / 2) / worldDepth;

  const gx = nx * (gridWidth - 1);
  const gy = nz * (gridHeight - 1);

  const biome = getBiomeAt(biomes, gridWidth, gridHeight, gx, gy);
  return biome ? isHabitable(biome.biomeType) : false;
}

/**
 * Get the biome at a world position. Returns undefined if out of bounds.
 */
export function getBiomeAtWorldXZ(
  wx: number,
  wz: number,
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
): Biome | undefined {
  const { gx, gy } = worldXZToBiomeCoords(wx, wz, gridWidth, gridHeight);
  return biomes[gy * gridWidth + gx];
}
