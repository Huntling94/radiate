import { describe, it, expect } from 'vitest';
import {
  moistureFactor,
  temperatureFactor,
  computeBiomeEnergy,
  computeProducerK,
  metabolismKModifier,
  computeHerbivoreK,
  computePredatorK,
} from './energy.ts';
import type { Biome, Species } from './types.ts';

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

// ---------------------------------------------------------------------------
// Consumer K (BRF-014)
// ---------------------------------------------------------------------------

function makeSpecies(overrides: Partial<Species> = {}): Species {
  return {
    id: 's0',
    name: 'Test Species',
    genome: [0.5, 0.5, 0.5, 0.5, 1.0, 0.5], // metabolism = 1.0 (neutral)
    originalGenome: [0.5, 0.5, 0.5, 0.5, 1.0, 0.5],
    populationByBiome: {},
    trophicLevel: 'herbivore',
    parentSpeciesId: null,
    originTick: 0,
    generation: 0,
    ...overrides,
  };
}

describe('metabolismKModifier', () => {
  it('returns ~1.0 for metabolism 1.0', () => {
    const species = makeSpecies({ genome: [0.5, 0.5, 0.5, 0.5, 1.0, 0.5] });
    expect(metabolismKModifier(species)).toBeCloseTo(1.0);
  });

  it('returns > 1.0 for low metabolism (K-strategist)', () => {
    const species = makeSpecies({ genome: [0.5, 0.5, 0.5, 0.5, 0.1, 0.5] });
    expect(metabolismKModifier(species)).toBeGreaterThan(1.0);
  });

  it('returns < 1.0 for high metabolism (r-strategist)', () => {
    const species = makeSpecies({ genome: [0.5, 0.5, 0.5, 0.5, 2.0, 0.5] });
    expect(metabolismKModifier(species)).toBeLessThan(1.0);
  });
});

describe('computeHerbivoreK', () => {
  it('increases with more producers in the biome', () => {
    const herbivore = makeSpecies({ trophicLevel: 'herbivore' });
    const producer = makeSpecies({ id: 'p0', trophicLevel: 'producer' });

    const lowPops = new Map([['b0', [50, 0]]]);
    const highPops = new Map([['b0', [200, 0]]]);
    const species = [producer, herbivore];

    const kLow = computeHerbivoreK('b0', herbivore, lowPops, species);
    const kHigh = computeHerbivoreK('b0', herbivore, highPops, species);
    expect(kHigh).toBeGreaterThan(kLow);
  });

  it('returns MIN_CONSUMER_K with zero producers', () => {
    const herbivore = makeSpecies({ trophicLevel: 'herbivore' });
    const producer = makeSpecies({ id: 'p0', trophicLevel: 'producer' });

    const pops = new Map([['b0', [0, 0]]]);
    const k = computeHerbivoreK('b0', herbivore, pops, [producer, herbivore]);
    expect(k).toBe(5); // MIN_CONSUMER_K
  });

  it('high-metabolism herbivore gets lower K than low-metabolism', () => {
    const producer = makeSpecies({ id: 'p0', trophicLevel: 'producer' });
    const pops = new Map([['b0', [500, 0, 0]]]);

    const lowMeta = makeSpecies({
      id: 'h-low',
      trophicLevel: 'herbivore',
      genome: [0.5, 0.5, 0.5, 0.5, 0.1, 0.5],
    });
    const highMeta = makeSpecies({
      id: 'h-high',
      trophicLevel: 'herbivore',
      genome: [0.5, 0.5, 0.5, 0.5, 2.0, 0.5],
    });

    const kLow = computeHerbivoreK('b0', lowMeta, pops, [producer, lowMeta, highMeta]);
    const kHigh = computeHerbivoreK('b0', highMeta, pops, [producer, lowMeta, highMeta]);
    expect(kLow).toBeGreaterThan(kHigh);
  });

  it('applies ~10% transfer efficiency', () => {
    const herbivore = makeSpecies({ trophicLevel: 'herbivore' }); // metabolism=1.0 → modifier=1.0
    const producer = makeSpecies({ id: 'p0', trophicLevel: 'producer' });

    const pops = new Map([['b0', [1000, 0]]]);
    const k = computeHerbivoreK('b0', herbivore, pops, [producer, herbivore]);
    // 1000 × 0.10 × 1.0 = 100
    expect(k).toBeCloseTo(100);
  });
});

describe('computePredatorK', () => {
  it('increases with more herbivores in the biome', () => {
    const predator = makeSpecies({ trophicLevel: 'predator' });
    const herbivore = makeSpecies({ id: 'h0', trophicLevel: 'herbivore' });

    const lowPops = new Map([['b0', [0, 20]]]);
    const highPops = new Map([['b0', [0, 100]]]);
    const species = [predator, herbivore];

    const kLow = computePredatorK('b0', predator, lowPops, species);
    const kHigh = computePredatorK('b0', predator, highPops, species);
    expect(kHigh).toBeGreaterThan(kLow);
  });

  it('returns MIN_CONSUMER_K with zero herbivores', () => {
    const predator = makeSpecies({ trophicLevel: 'predator' });
    const herbivore = makeSpecies({ id: 'h0', trophicLevel: 'herbivore' });

    const pops = new Map([['b0', [0, 0]]]);
    const k = computePredatorK('b0', predator, pops, [predator, herbivore]);
    expect(k).toBe(5);
  });
});
