import { describe, it, expect } from 'vitest';
import { applySculpt } from './sculpt.ts';
import type { Biome } from './types.ts';

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

describe('applySculpt', () => {
  it('raises elevation', () => {
    const biomes = [makeBiome()];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b0', elevationDelta: 0.1, moistureDelta: 0 }],
      20,
    );
    expect(result[0].elevation).toBeCloseTo(0.6, 5);
  });

  it('lowers elevation', () => {
    const biomes = [makeBiome({ elevation: 0.3 })];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b0', elevationDelta: -0.1, moistureDelta: 0 }],
      20,
    );
    expect(result[0].elevation).toBeCloseTo(0.2, 5);
  });

  it('clamps elevation to [0, 1]', () => {
    const biomes = [makeBiome({ elevation: 0.95 })];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b0', elevationDelta: 0.2, moistureDelta: 0 }],
      20,
    );
    expect(result[0].elevation).toBe(1);

    const biomes2 = [makeBiome({ elevation: 0.05 })];
    const result2 = applySculpt(
      biomes2,
      [{ biomeId: 'b0', elevationDelta: -0.2, moistureDelta: 0 }],
      20,
    );
    expect(result2[0].elevation).toBe(0);
  });

  it('changes biome to ocean when elevation drops below threshold', () => {
    const biomes = [makeBiome({ elevation: 0.2 })];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b0', elevationDelta: -0.1, moistureDelta: 0 }],
      20,
    );
    expect(result[0].elevation).toBeCloseTo(0.1, 5);
    expect(result[0].biomeType).toBe('ocean');
    expect(result[0].baseCarryingCapacity).toBe(0);
  });

  it('changes biome to mountain when elevation exceeds threshold', () => {
    const biomes = [makeBiome({ elevation: 0.75 })];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b0', elevationDelta: 0.1, moistureDelta: 0 }],
      20,
    );
    expect(result[0].biomeType).toBe('mountain');
    expect(result[0].baseCarryingCapacity).toBe(0);
  });

  it('changes biome to forest when moisture exceeds 0.6', () => {
    const biomes = [makeBiome({ moisture: 0.55 })];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b0', elevationDelta: 0, moistureDelta: 0.1 }],
      20,
    );
    expect(result[0].biomeType).toBe('forest');
  });

  it('changes biome to desert when moisture drops below 0.3', () => {
    const biomes = [makeBiome({ moisture: 0.35 })];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b0', elevationDelta: 0, moistureDelta: -0.1 }],
      20,
    );
    expect(result[0].biomeType).toBe('desert');
  });

  it('returns unchanged biomes for empty actions', () => {
    const biomes = [makeBiome()];
    const result = applySculpt(biomes, [], 20);
    expect(result[0].elevation).toBe(0.5);
    expect(result[0].moisture).toBe(0.5);
  });

  it('does not mutate input biomes', () => {
    const biomes = [makeBiome()];
    applySculpt(biomes, [{ biomeId: 'b0', elevationDelta: 0.1, moistureDelta: 0.1 }], 20);
    expect(biomes[0].elevation).toBe(0.5);
    expect(biomes[0].moisture).toBe(0.5);
  });

  it('preserves total biome count', () => {
    const biomes = [
      makeBiome({ id: 'b0' }),
      makeBiome({ id: 'b1', x: 1 }),
      makeBiome({ id: 'b2', x: 2 }),
    ];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b1', elevationDelta: 0.1, moistureDelta: 0 }],
      20,
    );
    expect(result.length).toBe(3);
  });

  it('accumulates multiple actions on same biome', () => {
    const biomes = [makeBiome()];
    const result = applySculpt(
      biomes,
      [
        { biomeId: 'b0', elevationDelta: 0.1, moistureDelta: 0 },
        { biomeId: 'b0', elevationDelta: 0.1, moistureDelta: 0 },
      ],
      20,
    );
    expect(result[0].elevation).toBeCloseTo(0.7, 5);
  });

  it('leaves unaffected biomes unchanged', () => {
    const biomes = [makeBiome({ id: 'b0' }), makeBiome({ id: 'b1', x: 1, elevation: 0.3 })];
    const result = applySculpt(
      biomes,
      [{ biomeId: 'b0', elevationDelta: 0.1, moistureDelta: 0 }],
      20,
    );
    expect(result[1].elevation).toBe(0.3);
  });
});
