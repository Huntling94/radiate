export type {
  WorldState,
  Biome,
  BiomeType,
  Species,
  ExtinctSpecies,
  TrophicLevel,
  SimConfig,
  RngState,
  TraitDefinition,
  Traits,
  SimEvent,
  SimEventType,
} from './types.ts';

export {
  TRAIT_REGISTRY,
  GENOME_LENGTH,
  MAX_EVENTS,
  expressTraits,
  getBiome,
  getTotalPopulation,
} from './types.ts';

export type { Rng } from './rng.ts';
export { createRng, createRngFromState } from './rng.ts';

export { deriveBiomeType, BIOME_COLOURS, isHabitable } from './biome.ts';

export { createInitialState } from './factory.ts';

export { tick } from './tick.ts';

export type { InteractionMatrix } from './interactions.ts';
export { computeInteractionMatrix, computePairInteraction } from './interactions.ts';

export { mutateGenome, geneticDistance, clampGenome } from './genome.ts';

export { checkSpeciation } from './speciation.ts';

export { computeFitnessModifier, updateBiomeTypes } from './environment.ts';

export { generateSpeciesName } from './names.ts';
