/**
 * Simulation tick loop — advances WorldState by a given number of seconds.
 *
 * Pure function: (WorldState, deltaSec) → WorldState.
 * Uses fixed-step Euler integration with a sub-tick cap for time-jumps.
 * See ADR-002 for design rationale.
 */

import type { WorldState, Species } from './types.ts';
import { createRngFromState } from './rng.ts';
import type { Rng } from './rng.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SUB_TICKS = 10_000;
const NOISE_FACTOR = 0.05;
const EXTINCTION_THRESHOLD = 1;
const BASE_GROWTH_RATE = 0.1;

// ---------------------------------------------------------------------------
// Population dynamics (single-species logistic growth)
// ---------------------------------------------------------------------------

/**
 * Update population for one species in one biome for one time step.
 * Logistic growth: dP/dt = r × P × (1 - P/K) + noise
 */
function updatePopulation(
  population: number,
  carryingCapacity: number,
  stepSize: number,
  rng: Rng,
  species: Species,
): number {
  if (population <= 0 || carryingCapacity <= 0) return 0;

  // Growth rate derived from species reproduction trait (genome index 5)
  const reproductionRate = species.genome[5] ?? 0.5;
  const r = BASE_GROWTH_RATE * (0.5 + reproductionRate);

  // Logistic growth
  const growth = r * population * (1 - population / carryingCapacity) * stepSize;

  // Multiplicative stochastic noise (scaled by sqrt of step size for correct variance)
  const noise = population * NOISE_FACTOR * rng.nextGaussian() * Math.sqrt(stepSize);

  const newPop = population + growth + noise;

  // Extinction threshold
  if (newPop < EXTINCTION_THRESHOLD) return 0;

  return Math.max(0, newPop);
}

// ---------------------------------------------------------------------------
// Tick function
// ---------------------------------------------------------------------------

/** Advance the simulation by deltaSec seconds. Pure function. */
export function tick(state: WorldState, deltaSec: number): WorldState {
  if (deltaSec <= 0) return state;

  // Compute step count and size (capped at MAX_SUB_TICKS)
  const steps = Math.min(Math.ceil(deltaSec), MAX_SUB_TICKS);
  const stepSize = deltaSec / steps;

  // Restore RNG from state
  const rng = createRngFromState(state.rngState);

  // Build carrying capacity lookup
  const carryingCapacity = new Map<string, number>();
  for (const biome of state.biomes) {
    carryingCapacity.set(biome.id, biome.baseCarryingCapacity);
  }

  // Deep clone species populations for mutation
  let currentSpecies = state.species.map((s) => ({
    ...s,
    populationByBiome: { ...s.populationByBiome },
  }));

  // Run sub-ticks
  for (let step = 0; step < steps; step++) {
    for (const species of currentSpecies) {
      const biomeIds = Object.keys(species.populationByBiome);
      for (const biomeId of biomeIds) {
        const pop = species.populationByBiome[biomeId] ?? 0;
        const k = carryingCapacity.get(biomeId) ?? 0;
        const newPop = updatePopulation(pop, k, stepSize, rng, species);

        if (newPop <= 0) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete species.populationByBiome[biomeId];
        } else {
          species.populationByBiome[biomeId] = newPop;
        }
      }
    }
  }

  // Count extinctions (species with zero total population)
  let newExtinctions = 0;
  currentSpecies = currentSpecies.filter((s) => {
    const totalPop = Object.values(s.populationByBiome).reduce((sum, p) => sum + p, 0);
    if (totalPop <= 0) {
      newExtinctions++;
      return false;
    }
    return true;
  });

  return {
    ...state,
    tick: state.tick + steps,
    elapsedSeconds: state.elapsedSeconds + deltaSec,
    lastTimestamp: Date.now(),
    species: currentSpecies,
    extinctSpeciesCount: state.extinctSpeciesCount + newExtinctions,
    rngState: rng.getState(),
  };
}
