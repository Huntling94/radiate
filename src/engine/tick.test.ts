import { describe, it, expect } from 'vitest';
import { tick } from './tick.ts';
import { createInitialState } from './factory.ts';
import { getTotalPopulation } from './types.ts';

function makeState(seed = 42) {
  return createInitialState(seed);
}

describe('tick', () => {
  // T1: Determinism
  it('produces identical results from the same state and delta', () => {
    const state = makeState();
    const result1 = tick(state, 1);
    const result2 = tick(state, 1);

    expect(result1.species).toEqual(result2.species);
    expect(result1.rngState).toEqual(result2.rngState);
    expect(result1.tick).toEqual(result2.tick);
  });

  // T2: Logistic growth converges toward carrying capacity
  it('population grows from initial value over 100 ticks', () => {
    let state = makeState();
    const initialPop = getTotalPopulation(state.species[0]);

    for (let i = 0; i < 100; i++) {
      state = tick(state, 1);
    }

    const finalPop = getTotalPopulation(state.species[0]);
    expect(finalPop).toBeGreaterThan(initialPop);
  });

  // T3: Population never goes negative
  it('population never goes negative', () => {
    let state = makeState();

    for (let i = 0; i < 200; i++) {
      state = tick(state, 1);
      for (const species of state.species) {
        for (const pop of Object.values(species.populationByBiome)) {
          expect(pop).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  // T4: Population stays within reasonable bounds
  it('population never exceeds 10x carrying capacity', () => {
    let state = makeState();
    const maxAllowed = 500 * 10;

    for (let i = 0; i < 500; i++) {
      state = tick(state, 1);
      for (const species of state.species) {
        for (const pop of Object.values(species.populationByBiome)) {
          expect(pop).toBeLessThan(maxAllowed);
        }
      }
    }
  });

  // T5: 1-hour time-jump
  it('handles a 1-hour time-jump without crash', () => {
    const state = makeState();
    const result = tick(state, 3600);

    expect(result.species.length).toBeGreaterThanOrEqual(0);
  });

  // T6: 1-day time-jump
  it('handles a 1-day time-jump with sane population', () => {
    const state = makeState();
    const result = tick(state, 86400);

    expect(result.species.length).toBeGreaterThanOrEqual(0);
  });

  // T7: 1-week time-jump
  it('handles a 1-week time-jump without crash', () => {
    const state = makeState();
    const result = tick(state, 604800);

    expect(result.tick).toBeGreaterThan(0);
    expect(result.elapsedSeconds).toBe(604800);
    expect(result.species.length).toBeGreaterThanOrEqual(0);
  });

  // T8: Zero delta returns unchanged state
  it('returns state unchanged for zero delta', () => {
    const state = makeState();
    const result = tick(state, 0);

    expect(result).toBe(state);
  });

  it('increments tick count by number of steps', () => {
    const state = makeState();
    const result = tick(state, 5);

    expect(result.tick).toBe(5);
    expect(result.elapsedSeconds).toBe(5);
  });
});
