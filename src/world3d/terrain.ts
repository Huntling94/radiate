/**
 * Pure TypeScript terrain generation from biome data.
 * No Three.js imports — produces typed arrays consumable by any 3D engine.
 */

import type { Biome, BiomeType } from '../engine/index.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HEIGHT = 8;
const OCEAN_DEPTH = -1.5;
const CELL_SIZE = 4; // world units per biome cell

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
  // Clamp to grid edges
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateTerrain(
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
  subdivisions = 4,
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

      // Map vertex to grid coordinates
      const gx = (vx / (vertexWidth - 1)) * (gridWidth - 1);
      const gy = (vy / (vertexHeight - 1)) * (gridHeight - 1);

      // World position
      const wx = (vx / (vertexWidth - 1)) * worldWidth - worldWidth / 2;
      const wz = (vy / (vertexHeight - 1)) * worldDepth - worldDepth / 2;

      // Elevation via bilinear interpolation
      const elevation = bilinearElevation(biomes, gridWidth, gridHeight, gx, gy);
      const nearestBiome = getBiomeAt(biomes, gridWidth, gridHeight, gx, gy);
      const biomeType = nearestBiome?.biomeType ?? 'grassland';
      const wy = elevationToHeight(elevation, biomeType);

      positions[idx * 3] = wx;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = wz;

      // Vertex colour
      const rgb = BIOME_COLOURS_RGB[biomeType];
      colours[idx * 3] = rgb[0];
      colours[idx * 3 + 1] = rgb[1];
      colours[idx * 3 + 2] = rgb[2];
    }
  }

  // Triangle indices
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

  return {
    positions,
    colours,
    indices,
    vertexWidth,
    vertexHeight,
    worldWidth,
    worldDepth,
  };
}

/**
 * Get the terrain height at a biome's grid position.
 * Used for placing species indicators on the terrain surface.
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

export { CELL_SIZE, MAX_HEIGHT };
