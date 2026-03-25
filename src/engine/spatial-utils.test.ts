import { describe, it, expect } from 'vitest';
import {
  biomeToWorldXZ,
  worldXZToBiomeCoords,
  getWorldBounds,
  getHeightAtWorldXZ,
  isPositionHabitable,
  getBiomeAtWorldXZ,
  CELL_SIZE,
} from './spatial-utils.ts';
import type { Biome } from './types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBiome(overrides: Partial<Biome> = {}): Biome {
  return {
    id: 'b0',
    x: 0,
    y: 0,
    elevation: 0.5,
    moisture: 0.5,
    biomeType: 'grassland',
    baseCarryingCapacity: 500,
    ...overrides,
  };
}

/** Create a simple 3×3 grid for testing. */
function makeGrid3x3(): { biomes: Biome[]; gridWidth: number; gridHeight: number } {
  const biomes: Biome[] = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const isOcean = x === 0 && y === 0;
      const isMountain = x === 2 && y === 2;
      biomes.push(
        makeBiome({
          id: `b-${String(x)}-${String(y)}`,
          x,
          y,
          elevation: isMountain ? 0.9 : isOcean ? 0.1 : 0.5,
          biomeType: isOcean ? 'ocean' : isMountain ? 'mountain' : 'grassland',
        }),
      );
    }
  }
  return { biomes, gridWidth: 3, gridHeight: 3 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('biomeToWorldXZ and worldXZToBiomeCoords', () => {
  it('round-trips for interior biomes', () => {
    const gridWidth = 12;
    const gridHeight = 8;
    const biome = makeBiome({ x: 5, y: 3 });

    const [wx, wz] = biomeToWorldXZ(biome, gridWidth, gridHeight);
    const { gx, gy } = worldXZToBiomeCoords(wx, wz, gridWidth, gridHeight);

    expect(gx).toBe(5);
    expect(gy).toBe(3);
  });

  it('round-trips for corner biomes', () => {
    const gridWidth = 10;
    const gridHeight = 10;

    // Top-left corner
    const [wx0, wz0] = biomeToWorldXZ({ x: 0, y: 0 }, gridWidth, gridHeight);
    const c0 = worldXZToBiomeCoords(wx0, wz0, gridWidth, gridHeight);
    expect(c0.gx).toBe(0);
    expect(c0.gy).toBe(0);

    // Bottom-right corner
    const [wx1, wz1] = biomeToWorldXZ({ x: 9, y: 9 }, gridWidth, gridHeight);
    const c1 = worldXZToBiomeCoords(wx1, wz1, gridWidth, gridHeight);
    expect(c1.gx).toBe(9);
    expect(c1.gy).toBe(9);
  });

  it('clamps out-of-bounds positions', () => {
    const gridWidth = 10;
    const gridHeight = 10;

    const neg = worldXZToBiomeCoords(-9999, -9999, gridWidth, gridHeight);
    expect(neg.gx).toBe(0);
    expect(neg.gy).toBe(0);

    const pos = worldXZToBiomeCoords(9999, 9999, gridWidth, gridHeight);
    expect(pos.gx).toBe(gridWidth - 1);
    expect(pos.gy).toBe(gridHeight - 1);
  });
});

describe('getWorldBounds', () => {
  it('returns symmetric bounds for square grid', () => {
    const bounds = getWorldBounds(25, 25);
    expect(bounds.minX).toBe(-bounds.maxX);
    expect(bounds.minZ).toBe(-bounds.maxZ);
  });

  it('scales with CELL_SIZE', () => {
    const bounds = getWorldBounds(11, 11);
    // (11-1) * 10 = 100 world units total width
    expect(bounds.maxX - bounds.minX).toBe(10 * CELL_SIZE);
    expect(bounds.maxZ - bounds.minZ).toBe(10 * CELL_SIZE);
  });
});

describe('getHeightAtWorldXZ', () => {
  it('returns positive height for grassland biome', () => {
    const { biomes, gridWidth, gridHeight } = makeGrid3x3();
    // Centre of grid (biome 1,1 = grassland, elevation 0.5)
    const height = getHeightAtWorldXZ(0, 0, biomes, gridWidth, gridHeight);
    expect(height).toBeGreaterThan(0);
    expect(Number.isFinite(height)).toBe(true);
  });

  it('returns negative height for ocean biome', () => {
    const { biomes, gridWidth, gridHeight } = makeGrid3x3();
    // Top-left corner (biome 0,0 = ocean)
    const bounds = getWorldBounds(gridWidth, gridHeight);
    const height = getHeightAtWorldXZ(bounds.minX, bounds.minZ, biomes, gridWidth, gridHeight);
    expect(height).toBeLessThan(0);
  });
});

describe('isPositionHabitable', () => {
  it('returns true for grassland position', () => {
    const { biomes, gridWidth, gridHeight } = makeGrid3x3();
    expect(isPositionHabitable(0, 0, biomes, gridWidth, gridHeight)).toBe(true);
  });

  it('returns false for ocean position', () => {
    const { biomes, gridWidth, gridHeight } = makeGrid3x3();
    const bounds = getWorldBounds(gridWidth, gridHeight);
    expect(isPositionHabitable(bounds.minX, bounds.minZ, biomes, gridWidth, gridHeight)).toBe(
      false,
    );
  });

  it('returns false for mountain position', () => {
    const { biomes, gridWidth, gridHeight } = makeGrid3x3();
    const bounds = getWorldBounds(gridWidth, gridHeight);
    expect(isPositionHabitable(bounds.maxX, bounds.maxZ, biomes, gridWidth, gridHeight)).toBe(
      false,
    );
  });
});

describe('getBiomeAtWorldXZ', () => {
  it('returns the correct biome for a world position', () => {
    const { biomes, gridWidth, gridHeight } = makeGrid3x3();
    const bounds = getWorldBounds(gridWidth, gridHeight);

    // Top-left corner should be ocean biome (0,0)
    const biome = getBiomeAtWorldXZ(bounds.minX, bounds.minZ, biomes, gridWidth, gridHeight);
    expect(biome).toBeDefined();
    expect(biome?.biomeType).toBe('ocean');
  });
});
