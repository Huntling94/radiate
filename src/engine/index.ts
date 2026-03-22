export type {
  WorldState,
  Biome,
  BiomeType,
  Species,
  TrophicLevel,
  SimConfig,
  RngState,
  TraitDefinition,
  Traits,
} from './types.ts';

export {
  TRAIT_REGISTRY,
  GENOME_LENGTH,
  expressTraits,
  getBiome,
  getTotalPopulation,
} from './types.ts';

export type { Rng } from './rng.ts';
export { createRng, createRngFromState } from './rng.ts';
