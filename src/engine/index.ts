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
  Creature,
  CreatureState,
  SpeciesCluster,
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

// IBM engine replaces L-V tick
export { ibmTick as tick } from './ibm-tick.ts';

export { mutateGenome, geneticDistance, clampGenome } from './genome.ts';

export { computeFitnessModifier, updateBiomeTypes } from './environment.ts';

export { generateSpeciesName } from './names.ts';

export type { SculptAction } from './sculpt.ts';
export { applySculpt } from './sculpt.ts';

export {
  moistureFactor,
  temperatureFactor,
  computeBiomeEnergy,
  computeProducerK,
} from './energy.ts';

export { computeLifespan, metabolismCost } from './creature.ts';
export { clusterCreatures, computeCentroid } from './clustering.ts';
export { createSpatialHash } from './spatial-hash.ts';
export {
  biomeToWorldXZ,
  worldXZToBiomeCoords,
  getWorldBounds,
  getHeightAtWorldXZ,
  isPositionHabitable as isPositionHabitableEngine,
  getBiomeAtWorldXZ,
  CELL_SIZE as ENGINE_CELL_SIZE,
} from './spatial-utils.ts';
