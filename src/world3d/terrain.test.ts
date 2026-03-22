import { describe, it, expect } from 'vitest';
import { generateTerrain } from './terrain.ts';
import { createInitialState } from '../engine/factory.ts';

function makeState(seed = 42) {
  return createInitialState(seed);
}

describe('generateTerrain', () => {
  it('returns correct vertex count for given grid and subdivisions', () => {
    const state = makeState();
    const data = generateTerrain(state.biomes, state.config.gridWidth, state.config.gridHeight, 4);

    const expectedWidth = (state.config.gridWidth - 1) * 4 + 1; // 45
    const expectedHeight = (state.config.gridHeight - 1) * 4 + 1; // 29
    const expectedVertices = expectedWidth * expectedHeight;

    expect(data.vertexWidth).toBe(expectedWidth);
    expect(data.vertexHeight).toBe(expectedHeight);
    expect(data.positions.length).toBe(expectedVertices * 3);
    expect(data.colours.length).toBe(expectedVertices * 3);
  });

  it('mountain biomes produce vertices with high y values', () => {
    const state = makeState();
    const data = generateTerrain(state.biomes, state.config.gridWidth, state.config.gridHeight, 4);

    // Find a mountain biome
    const mountain = state.biomes.find((b) => b.biomeType === 'mountain');
    if (!mountain) return; // Skip if no mountains in this seed

    // The mountain's elevation is > 0.8, so terrain height should be > 0.8 * MAX_HEIGHT = 6.4
    // Check that at least some vertices have high y values
    let maxY = -Infinity;
    for (let i = 1; i < data.positions.length; i += 3) {
      const y = data.positions[i];
      if (y > maxY) maxY = y;
    }
    expect(maxY).toBeGreaterThan(5);
  });

  it('ocean biomes produce vertices at or below sea level', () => {
    const state = makeState();
    const data = generateTerrain(state.biomes, state.config.gridWidth, state.config.gridHeight, 4);

    // Find ocean biomes
    const oceans = state.biomes.filter((b) => b.biomeType === 'ocean');
    if (oceans.length === 0) return; // Skip if no oceans

    // Ocean vertices should have negative y (OCEAN_DEPTH = -1.5)
    // At least some vertices should be below sea level
    let hasNegativeY = false;
    for (let i = 1; i < data.positions.length; i += 3) {
      if (data.positions[i] < 0) {
        hasNegativeY = true;
        break;
      }
    }
    expect(hasNegativeY).toBe(true);
  });

  it('all vertex positions are finite', () => {
    const state = makeState();
    const data = generateTerrain(state.biomes, state.config.gridWidth, state.config.gridHeight, 4);

    for (let i = 0; i < data.positions.length; i++) {
      expect(Number.isFinite(data.positions[i])).toBe(true);
    }
  });

  it('all vertex colours are in valid range', () => {
    const state = makeState();
    const data = generateTerrain(state.biomes, state.config.gridWidth, state.config.gridHeight, 4);

    for (let i = 0; i < data.colours.length; i++) {
      const c = data.colours[i];
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('generates correct number of triangle indices', () => {
    const state = makeState();
    const data = generateTerrain(state.biomes, state.config.gridWidth, state.config.gridHeight, 4);

    const quads = (data.vertexWidth - 1) * (data.vertexHeight - 1);
    expect(data.indices.length).toBe(quads * 6);
  });
});
