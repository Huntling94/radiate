/**
 * Simulation tick loop — advances WorldState by a given number of seconds.
 *
 * Pure function: (WorldState, deltaSec) → WorldState.
 * Uses generalised Lotka-Volterra with trait-derived interaction coefficients.
 * See ADR-002 (tick loop) and ADR-003 (population dynamics).
 */

import type { WorldState, Species } from './types.ts';
import { expressTraits } from './types.ts';
import { createRngFromState } from './rng.ts';
import type { Rng } from './rng.ts';
import { computeInteractionMatrix } from './interactions.ts';
import type { InteractionMatrix } from './interactions.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SUB_TICKS = 10_000;
const NOISE_FACTOR = 0.05;
const EXTINCTION_THRESHOLD = 1;
const BASE_GROWTH_RATE = 0.15;
const MAX_POPULATION_CHANGE_RATIO = 0.8;

// ---------------------------------------------------------------------------
// Population dynamics (generalised Lotka-Volterra)
// ---------------------------------------------------------------------------

/**
 * Update population for one species in one biome for one time step.
 *
 * dPi/dt = ri × Pi × (1 - Σj(aij × Pj) / Ki) + noise
 */
function updateSpeciesPopulation(
  speciesIdx: number,
  biomeId: string,
  populations: Map<string, number[]>,
  carryingCapacity: number,
  stepSize: number,
  rng: Rng,
  matrix: InteractionMatrix,
  species: Species,
): number {
  const currentPops = populations.get(biomeId);
  if (!currentPops) return 0;

  const pop = currentPops[speciesIdx] ?? 0;
  if (pop <= 0 || carryingCapacity <= 0) return 0;

  // Growth rate from reproduction trait
  const traits = expressTraits(species.genome);
  const r = BASE_GROWTH_RATE * (0.5 + traits.reproductionRate);

  // Consumers (herbivores, predators) need food to sustain population.
  // Check if any prey exists in this biome — if not, apply starvation.
  let hasFoodSource = species.trophicLevel === 'producer'; // producers don't need prey
  if (!hasFoodSource) {
    const row = matrix.coefficients[speciesIdx];
    for (let j = 0; j < row.length; j++) {
      const coeff = row[j] ?? 0;
      const otherPop = currentPops[j] ?? 0;
      // Negative coefficient means this species benefits from j (j is prey)
      if (coeff < 0 && otherPop > 0) {
        hasFoodSource = true;
        break;
      }
    }
  }

  // Without food, consumers starve (negative growth)
  if (!hasFoodSource) {
    const starvation = -r * pop * 0.5 * stepSize;
    const noise = pop * NOISE_FACTOR * rng.nextGaussian() * Math.sqrt(stepSize);
    const newPop = pop + starvation + noise;
    if (newPop < EXTINCTION_THRESHOLD) return 0;
    return Math.max(0, newPop);
  }

  // Compute interaction pressure: Σj(aij × Pj)
  let interactionSum = 0;
  const interactionRow = matrix.coefficients[speciesIdx];
  for (let j = 0; j < interactionRow.length; j++) {
    const coeff = interactionRow[j] ?? 0;
    const otherPop = currentPops[j] ?? 0;
    interactionSum += coeff * otherPop;
  }

  // Lotka-Volterra growth
  const growth = r * pop * (1 - interactionSum / carryingCapacity) * stepSize;

  // Multiplicative stochastic noise
  const noise = pop * NOISE_FACTOR * rng.nextGaussian() * Math.sqrt(stepSize);

  // Cap population change to prevent Euler instability
  const change = Math.max(
    -pop * MAX_POPULATION_CHANGE_RATIO,
    Math.min(pop * MAX_POPULATION_CHANGE_RATIO, growth + noise),
  );

  const newPop = pop + change;

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
    // Recompute interaction matrix (species may go extinct mid-simulation)
    const matrix = computeInteractionMatrix(currentSpecies);

    // Build per-biome population arrays for efficient lookup
    const biomePopulations = new Map<string, number[]>();
    const allBiomeIds = new Set<string>();
    for (const species of currentSpecies) {
      for (const biomeId of Object.keys(species.populationByBiome)) {
        allBiomeIds.add(biomeId);
      }
    }
    for (const biomeId of allBiomeIds) {
      const pops: number[] = [];
      for (const species of currentSpecies) {
        pops.push(species.populationByBiome[biomeId] ?? 0);
      }
      biomePopulations.set(biomeId, pops);
    }

    // Update each species in each biome
    for (let i = 0; i < currentSpecies.length; i++) {
      const species = currentSpecies[i];
      const biomeIds = Object.keys(species.populationByBiome);

      for (const biomeId of biomeIds) {
        const k = carryingCapacity.get(biomeId) ?? 0;
        const newPop = updateSpeciesPopulation(
          i,
          biomeId,
          biomePopulations,
          k,
          stepSize,
          rng,
          matrix,
          species,
        );

        if (newPop <= 0) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete species.populationByBiome[biomeId];
        } else {
          species.populationByBiome[biomeId] = newPop;
        }
      }
    }

    // Remove extinct species (zero population in all biomes)
    currentSpecies = currentSpecies.filter((s) => Object.keys(s.populationByBiome).length > 0);
  }

  // Count extinctions
  const survivors = new Set(currentSpecies.map((s) => s.id));
  const extinctions = state.species.filter((s) => !survivors.has(s.id)).length;

  return {
    ...state,
    tick: state.tick + steps,
    elapsedSeconds: state.elapsedSeconds + deltaSec,
    lastTimestamp: Date.now(),
    species: currentSpecies,
    extinctSpeciesCount: state.extinctSpeciesCount + extinctions,
    rngState: rng.getState(),
  };
}
