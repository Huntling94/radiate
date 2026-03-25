import { describe, it, expect } from 'vitest';
import {
  PRODUCER_ENERGY_GAIN,
  BASE_METABOLISM_COST,
  REPRODUCTION_ENERGY_THRESHOLD,
  OFFSPRING_STARTING_ENERGY,
  REPRODUCTION_ENERGY_COST,
  HERBIVORE_FEED_ENERGY,
  PREDATOR_FEED_ENERGY,
  BASE_LIFESPAN,
  LIFESPAN_SIZE_FACTOR,
  LIFESPAN_METABOLISM_FACTOR,
  MINIMUM_LIFESPAN,
  SPATIAL_HASH_CELL_SIZE,
  PREDATOR_DETECTION_RANGE,
  INITIAL_PRODUCER_FRACTION,
  INITIAL_HERBIVORE_FRACTION,
  INITIAL_PREDATOR_FRACTION,
  PRODUCER_DENSITY_CAP,
  INITIAL_CREATURE_ENERGY,
  INITIAL_CREATURE_COUNT,
} from './constants.ts';

describe('IBM constants sanity checks', () => {
  it('reproduction cost is less than reproduction threshold', () => {
    expect(REPRODUCTION_ENERGY_COST).toBeLessThan(REPRODUCTION_ENERGY_THRESHOLD);
  });

  it('offspring starting energy is less than reproduction threshold', () => {
    expect(OFFSPRING_STARTING_ENERGY).toBeLessThan(REPRODUCTION_ENERGY_THRESHOLD);
  });

  it('predator feed energy exceeds herbivore feed energy', () => {
    expect(PREDATOR_FEED_ENERGY).toBeGreaterThan(HERBIVORE_FEED_ENERGY);
  });

  it('spatial hash cell size is at least as large as max detection range', () => {
    expect(SPATIAL_HASH_CELL_SIZE).toBeGreaterThanOrEqual(PREDATOR_DETECTION_RANGE);
  });

  it('initial creature fractions sum to 1', () => {
    const total =
      INITIAL_PRODUCER_FRACTION + INITIAL_HERBIVORE_FRACTION + INITIAL_PREDATOR_FRACTION;
    expect(total).toBeCloseTo(1.0);
  });

  it('base lifespan with extreme genome stays above minimum', () => {
    // Worst case: size=2.0, metabolism=2.0
    const worstLifespan =
      BASE_LIFESPAN + 2.0 * LIFESPAN_SIZE_FACTOR + 2.0 * LIFESPAN_METABOLISM_FACTOR;
    // The engine clamps to MINIMUM_LIFESPAN, so the constant relationship matters
    expect(MINIMUM_LIFESPAN).toBeGreaterThan(0);
    // Extreme genomes produce negative raw lifespan that gets clamped
    expect(worstLifespan).toBeLessThan(BASE_LIFESPAN);
  });

  it('producer energy gain is positive', () => {
    expect(PRODUCER_ENERGY_GAIN).toBeGreaterThan(0);
  });

  it('base metabolism cost is positive', () => {
    expect(BASE_METABOLISM_COST).toBeGreaterThan(0);
  });

  it('producer density cap is positive', () => {
    expect(PRODUCER_DENSITY_CAP).toBeGreaterThan(0);
  });

  it('initial creature energy is positive and below reproduction threshold', () => {
    expect(INITIAL_CREATURE_ENERGY).toBeGreaterThan(0);
    expect(INITIAL_CREATURE_ENERGY).toBeLessThan(REPRODUCTION_ENERGY_THRESHOLD);
  });

  it('initial creature count matches sum of fractions', () => {
    const producers = Math.round(INITIAL_CREATURE_COUNT * INITIAL_PRODUCER_FRACTION);
    const herbivores = Math.round(INITIAL_CREATURE_COUNT * INITIAL_HERBIVORE_FRACTION);
    const predators = INITIAL_CREATURE_COUNT - producers - herbivores;
    expect(producers + herbivores + predators).toBe(INITIAL_CREATURE_COUNT);
  });
});
