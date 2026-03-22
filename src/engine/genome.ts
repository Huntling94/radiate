/**
 * Genome operations — mutation, genetic distance, and trait clamping.
 */

import { TRAIT_REGISTRY } from './types.ts';
import type { SimConfig } from './types.ts';
import type { Rng } from './rng.ts';

/** Mutate a genome by applying small Gaussian perturbations to each trait. */
export function mutateGenome(genome: number[], rng: Rng, config: SimConfig): number[] {
  return genome.map((value, i) => {
    const perturbation = rng.nextGaussian() * config.mutationMagnitude * config.mutationRate;
    const newValue = value + perturbation;
    const trait = TRAIT_REGISTRY[i] as (typeof TRAIT_REGISTRY)[number] | undefined;
    if (!trait) return newValue;
    return Math.max(trait.min, Math.min(trait.max, newValue));
  });
}

/** Euclidean distance between two genomes. */
export function geneticDistance(genomeA: number[], genomeB: number[]): number {
  const len = Math.max(genomeA.length, genomeB.length);
  let sumSqDiff = 0;
  for (let i = 0; i < len; i++) {
    const diff = (genomeA[i] ?? 0) - (genomeB[i] ?? 0);
    sumSqDiff += diff * diff;
  }
  return Math.sqrt(sumSqDiff);
}

/** Clamp all genome values to their TRAIT_REGISTRY min/max bounds. */
export function clampGenome(genome: number[]): number[] {
  return genome.map((value, i) => {
    const trait = TRAIT_REGISTRY[i] as (typeof TRAIT_REGISTRY)[number] | undefined;
    if (!trait) return value;
    return Math.max(trait.min, Math.min(trait.max, value));
  });
}
