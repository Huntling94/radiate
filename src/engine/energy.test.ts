import { describe, it, expect } from 'vitest';
import {
  moistureFactor,
  temperatureFactor,
  computeBiomeEnergy,
  computeProducerK,
} from './energy.ts';
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

describe('moistureFactor', () => {
  it('returns 0.5 for moisture 0', () => {
    expect(moistureFactor(0)).toBeCloseTo(0.5);
  });

  it('returns 1.5 for moisture 1', () => {
    expect(moistureFactor(1)).toBeCloseTo(1.5);
  });

  it('returns 1.0 for moisture 0.5', () => {
    expect(moistureFactor(0.5)).toBeCloseTo(1.0);
  });
});

describe('temperatureFactor', () => {
  it('returns 1.0 at optimal temperature (20°C)', () => {
    expect(temperatureFactor(20)).toBeCloseTo(1.0);
  });

  it('decreases at temperatures above optimal', () => {
    expect(temperatureFactor(40)).toBeLessThan(1.0);
    expect(temperatureFactor(40)).toBeGreaterThan(0);
  });

  it('decreases at temperatures below optimal', () => {
    expect(temperatureFactor(0)).toBeLessThan(1.0);
    expect(temperatureFactor(0)).toBeGreaterThan(0);
  });

  it('never drops below the floor (0.1)', () => {
    expect(temperatureFactor(-100)).toBeCloseTo(0.1);
    expect(temperatureFactor(200)).toBeCloseTo(0.1);
  });

  it('is symmetric around optimal', () => {
    expect(temperatureFactor(10)).toBeCloseTo(temperatureFactor(30));
  });
});

describe('computeBiomeEnergy', () => {
  it('forest produces more energy than grassland', () => {
    const forest = makeBiome({ biomeType: 'forest', moisture: 0.7 });
    const grassland = makeBiome({ biomeType: 'grassland', moisture: 0.5 });
    expect(computeBiomeEnergy(forest, 20)).toBeGreaterThan(computeBiomeEnergy(grassland, 20));
  });

  it('grassland produces more energy than tundra', () => {
    const grassland = makeBiome({ biomeType: 'grassland', moisture: 0.5 });
    const tundra = makeBiome({ biomeType: 'tundra', moisture: 0.5 });
    expect(computeBiomeEnergy(grassland, 20)).toBeGreaterThan(computeBiomeEnergy(tundra, 20));
  });

  it('tundra produces more energy than desert', () => {
    const tundra = makeBiome({ biomeType: 'tundra', moisture: 0.5 });
    const desert = makeBiome({ biomeType: 'desert', moisture: 0.2 });
    expect(computeBiomeEnergy(tundra, 20)).toBeGreaterThan(computeBiomeEnergy(desert, 20));
  });

  it('ocean produces zero energy', () => {
    const ocean = makeBiome({ biomeType: 'ocean', elevation: 0.05 });
    expect(computeBiomeEnergy(ocean, 20)).toBe(0);
  });

  it('mountain produces zero energy', () => {
    const mountain = makeBiome({ biomeType: 'mountain', elevation: 0.9 });
    expect(computeBiomeEnergy(mountain, 20)).toBe(0);
  });

  it('wet biome produces more energy than dry biome of same type', () => {
    const wet = makeBiome({ biomeType: 'grassland', moisture: 0.9 });
    const dry = makeBiome({ biomeType: 'grassland', moisture: 0.1 });
    expect(computeBiomeEnergy(wet, 20)).toBeGreaterThan(computeBiomeEnergy(dry, 20));
  });

  it('combines type, moisture, and temperature', () => {
    const biome = makeBiome({ biomeType: 'forest', moisture: 1.0 });
    // forest(1000) × moistureFactor(1.0 → 1.5) × temperatureFactor(20 → 1.0) = 1500
    expect(computeBiomeEnergy(biome, 20)).toBeCloseTo(1500);
  });
});

describe('computeProducerK', () => {
  it('wet forest K > dry desert K', () => {
    const forest = makeBiome({ biomeType: 'forest', moisture: 0.8 });
    const desert = makeBiome({ biomeType: 'desert', moisture: 0.1 });
    expect(computeProducerK(forest, 20)).toBeGreaterThan(computeProducerK(desert, 20));
  });

  it('returns 0 for ocean', () => {
    const ocean = makeBiome({ biomeType: 'ocean' });
    expect(computeProducerK(ocean, 20)).toBe(0);
  });

  it('cold desert still produces some K (floor > 0)', () => {
    const desert = makeBiome({ biomeType: 'desert', moisture: 0.0 });
    const k = computeProducerK(desert, -10);
    expect(k).toBeGreaterThan(0);
  });
});
