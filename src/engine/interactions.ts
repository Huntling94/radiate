/**
 * Species interaction matrix — computes how species affect each other's growth.
 *
 * Interaction coefficients are derived from species traits, not hardcoded.
 * New species from mutation/speciation automatically get meaningful interactions.
 * See ADR-003 for design rationale.
 */

import type { Species } from './types.ts';
import { expressTraits } from './types.ts';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface InteractionMatrix {
  /** coefficient[i][j] = effect of species j on species i's growth rate.
   *  Positive = harmful (competition, being eaten).
   *  Negative = beneficial (eating prey). */
  coefficients: number[][];
  /** Maps species ID to matrix row/column index */
  indexMap: Map<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SELF_COMPETITION = 1.0;
const PREDATION_BENEFIT = -0.8;
const PREDATION_COST = 0.6;
const COMPETITION_BASE = 0.3;
const SPEED_ADVANTAGE_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// Pair interactions
// ---------------------------------------------------------------------------

/**
 * Compute the effect of species J on species I.
 * Positive = J hurts I. Negative = J helps I.
 */
export function computePairInteraction(speciesI: Species, speciesJ: Species): number {
  if (speciesI.id === speciesJ.id) return SELF_COMPETITION;

  const traitsI = expressTraits(speciesI.genome);
  const traitsJ = expressTraits(speciesJ.genome);

  // Predator-prey: predator benefits from prey at lower trophic level
  if (isPredatorOf(speciesI, speciesJ)) {
    // I is a predator of J — J's presence benefits I
    const speedRatio = traitsI.speed / Math.max(traitsJ.speed, 0.01);
    const catchEfficiency = Math.min(speedRatio / SPEED_ADVANTAGE_THRESHOLD, 1.5);
    return PREDATION_BENEFIT * catchEfficiency;
  }

  if (isPredatorOf(speciesJ, speciesI)) {
    // J is a predator of I — J's presence hurts I
    const speedRatio = traitsJ.speed / Math.max(traitsI.speed, 0.01);
    const catchEfficiency = Math.min(speedRatio / SPEED_ADVANTAGE_THRESHOLD, 1.5);
    return PREDATION_COST * catchEfficiency;
  }

  // Competition: same trophic level — based on niche overlap (genome similarity)
  if (speciesI.trophicLevel === speciesJ.trophicLevel) {
    const nicheOverlap = computeNicheOverlap(speciesI.genome, speciesJ.genome);
    return COMPETITION_BASE * nicheOverlap;
  }

  // No direct interaction (different trophic levels, not predator-prey)
  return 0;
}

// ---------------------------------------------------------------------------
// Matrix computation
// ---------------------------------------------------------------------------

/** Compute the full interaction matrix for all living species. */
export function computeInteractionMatrix(species: Species[]): InteractionMatrix {
  const n = species.length;
  const indexMap = new Map<string, number>();
  const coefficients: number[][] = [];

  for (let i = 0; i < n; i++) {
    indexMap.set(species[i].id, i);
  }

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(computePairInteraction(species[i], species[j]));
    }
    coefficients.push(row);
  }

  return { coefficients, indexMap };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TROPHIC_ORDER: Record<string, number> = {
  producer: 0,
  herbivore: 1,
  predator: 2,
};

/** Returns true if speciesA preys on speciesB (A is one trophic level above B). */
function isPredatorOf(speciesA: Species, speciesB: Species): boolean {
  const levelA = TROPHIC_ORDER[speciesA.trophicLevel] ?? 0;
  const levelB = TROPHIC_ORDER[speciesB.trophicLevel] ?? 0;
  return levelA === levelB + 1;
}

/** Compute niche overlap (0–1) from genome similarity. Closer genomes = higher overlap. */
function computeNicheOverlap(genomeA: number[], genomeB: number[]): number {
  const len = Math.max(genomeA.length, genomeB.length);
  if (len === 0) return 1;

  let sumSqDiff = 0;
  for (let i = 0; i < len; i++) {
    const diff = (genomeA[i] ?? 0) - (genomeB[i] ?? 0);
    sumSqDiff += diff * diff;
  }

  const distance = Math.sqrt(sumSqDiff);
  // Map distance to overlap: 0 distance = 1.0 overlap, large distance → 0 overlap
  // Using exponential decay with scale factor
  return Math.exp(-distance * 2);
}
