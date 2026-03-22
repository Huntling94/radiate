/**
 * Pure TypeScript terrain generation from biome data.
 * No Three.js imports — produces typed arrays consumable by any 3D engine.
 */

import type { Biome, BiomeType } from '../engine/index.ts';
import { isHabitable } from '../engine/index.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HEIGHT = 12;
const OCEAN_DEPTH = -2;
const CELL_SIZE = 10; // world units per biome cell
const DEFAULT_SUBDIVISIONS = 6;

/** Biome colours as RGB triples (0–1). */
const BIOME_COLOURS_RGB: Record<BiomeType, [number, number, number]> = {
  ocean: [0.102, 0.42, 0.541],
  desert: [0.769, 0.655, 0.306],
  grassland: [0.357, 0.549, 0.243],
  forest: [0.176, 0.353, 0.118],
  tundra: [0.722, 0.784, 0.816],
  mountain: [0.42, 0.42, 0.42],
};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TerrainData {
  positions: Float32Array;
  colours: Float32Array;
  indices: Uint32Array;
  vertexWidth: number;
  vertexHeight: number;
  worldWidth: number;
  worldDepth: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBiomeAt(
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
  gx: number,
  gy: number,
): Biome | undefined {
  const cx = Math.max(0, Math.min(gridWidth - 1, Math.round(gx)));
  const cy = Math.max(0, Math.min(gridHeight - 1, Math.round(gy)));
  return biomes[cy * gridWidth + cx];
}

function bilinearElevation(
  biomes: Biome[],
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

function elevationToHeight(elevation: number, biomeType: BiomeType): number {
  if (biomeType === 'ocean') {
    return OCEAN_DEPTH;
  }
  return elevation * MAX_HEIGHT;
}

/** Deterministic colour noise from vertex position — returns ±0.05. */
function vertexColourNoise(vx: number, vy: number): number {
  const h = Math.sin(vx * 127.1 + vy * 311.7) * 43758.5453;
  return (h - Math.floor(h)) * 0.1 - 0.05;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateTerrain(
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
  subdivisions = DEFAULT_SUBDIVISIONS,
): TerrainData {
  const vertexWidth = (gridWidth - 1) * subdivisions + 1;
  const vertexHeight = (gridHeight - 1) * subdivisions + 1;
  const vertexCount = vertexWidth * vertexHeight;

  const positions = new Float32Array(vertexCount * 3);
  const colours = new Float32Array(vertexCount * 3);

  const worldWidth = (gridWidth - 1) * CELL_SIZE;
  const worldDepth = (gridHeight - 1) * CELL_SIZE;

  for (let vy = 0; vy < vertexHeight; vy++) {
    for (let vx = 0; vx < vertexWidth; vx++) {
      const idx = vy * vertexWidth + vx;

      const gx = (vx / (vertexWidth - 1)) * (gridWidth - 1);
      const gy = (vy / (vertexHeight - 1)) * (gridHeight - 1);

      const wx = (vx / (vertexWidth - 1)) * worldWidth - worldWidth / 2;
      const wz = (vy / (vertexHeight - 1)) * worldDepth - worldDepth / 2;

      const elevation = bilinearElevation(biomes, gridWidth, gridHeight, gx, gy);
      const nearestBiome = getBiomeAt(biomes, gridWidth, gridHeight, gx, gy);
      const biomeType = nearestBiome?.biomeType ?? 'grassland';
      const wy = elevationToHeight(elevation, biomeType);

      positions[idx * 3] = wx;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = wz;

      const rgb = BIOME_COLOURS_RGB[biomeType];
      const variation = vertexColourNoise(vx, vy);
      colours[idx * 3] = Math.max(0, Math.min(1, rgb[0] + variation));
      colours[idx * 3 + 1] = Math.max(0, Math.min(1, rgb[1] + variation * 0.8));
      colours[idx * 3 + 2] = Math.max(0, Math.min(1, rgb[2] + variation * 0.6));
    }
  }

  const quads = (vertexWidth - 1) * (vertexHeight - 1);
  const indices = new Uint32Array(quads * 6);
  let triIdx = 0;

  for (let vy = 0; vy < vertexHeight - 1; vy++) {
    for (let vx = 0; vx < vertexWidth - 1; vx++) {
      const a = vy * vertexWidth + vx;
      const b = a + 1;
      const c = a + vertexWidth;
      const d = c + 1;

      indices[triIdx++] = a;
      indices[triIdx++] = c;
      indices[triIdx++] = b;

      indices[triIdx++] = b;
      indices[triIdx++] = c;
      indices[triIdx++] = d;
    }
  }

  return { positions, colours, indices, vertexWidth, vertexHeight, worldWidth, worldDepth };
}

/**
 * Get the terrain height at any world x/z position by interpolating the biome grid.
 * Used by creatures and camera to follow terrain surface.
 */
export function getHeightAtWorldXZ(
  wx: number,
  wz: number,
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
): number {
  const worldWidth = (gridWidth - 1) * CELL_SIZE;
  const worldDepth = (gridHeight - 1) * CELL_SIZE;

  // World coords → normalised 0–1
  const nx = (wx + worldWidth / 2) / worldWidth;
  const nz = (wz + worldDepth / 2) / worldDepth;

  // Normalised → grid coords
  const gx = nx * (gridWidth - 1);
  const gy = nz * (gridHeight - 1);

  const elevation = bilinearElevation(biomes, gridWidth, gridHeight, gx, gy);
  const biome = getBiomeAt(biomes, gridWidth, gridHeight, gx, gy);
  const biomeType = biome?.biomeType ?? 'grassland';
  return elevationToHeight(elevation, biomeType);
}

/**
 * Check if a world x/z position is on habitable terrain.
 */
export function isPositionHabitable(
  wx: number,
  wz: number,
  biomes: Biome[],
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
 * Get the terrain height at a biome's grid position.
 */
export function getTerrainHeightAtBiome(
  biome: Biome,
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
): number {
  const elevation = bilinearElevation(biomes, gridWidth, gridHeight, biome.x, biome.y);
  return elevationToHeight(elevation, biome.biomeType);
}

/**
 * Convert biome grid coordinates to world x/z position.
 */
export function biomeToWorldXZ(
  biome: Biome,
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
 * Get the world bounds.
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

/**
 * Convert world x/z position to biome grid coordinates.
 * Inverse of biomeToWorldXZ. Returns fractional grid coords, clamped to grid bounds.
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

export { CELL_SIZE, MAX_HEIGHT };
