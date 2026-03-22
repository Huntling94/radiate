/**
 * Core type definitions for the Radiate simulation engine.
 *
 * WorldState is the foundational contract — consumed by every engine module,
 * UI component, and the persistence layer. See ADR-001 for design rationale.
 */

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------

export interface WorldState {
  /** Simulation tick count (increments each step) */
  tick: number;
  /** Total simulated time in seconds */
  elapsedSeconds: number;
  /** Real-world timestamp (Date.now()) at last save — used for offline catch-up */
  lastTimestamp: number;
  /** Global temperature — player-controlled environmental parameter */
  temperature: number;
  /** All biomes in the world (flat array, see ADR-001) */
  biomes: Biome[];
  /** All currently living species */
  species: Species[];
  /** Running count of species that have gone extinct */
  extinctSpeciesCount: number;
  /** Simulation configuration parameters */
  config: SimConfig;
  /** Serialisable PRNG state — persisted with the world for deterministic continuation */
  rngState: RngState;
}

// ---------------------------------------------------------------------------
// Biomes
// ---------------------------------------------------------------------------

export type BiomeType = 'ocean' | 'desert' | 'grassland' | 'forest' | 'tundra' | 'mountain';

export interface Biome {
  /** Unique identifier */
  id: string;
  /** Grid column position */
  x: number;
  /** Grid row position */
  y: number;
  /** Elevation (0–1), affects biome type */
  elevation: number;
  /** Moisture (0–1), affects biome type */
  moisture: number;
  /** Derived from temperature + elevation + moisture */
  biomeType: BiomeType;
  /** Maximum population this biome can sustain */
  baseCarryingCapacity: number;
}

// ---------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------

export type TrophicLevel = 'producer' | 'herbivore' | 'predator';

export interface Species {
  /** Unique identifier */
  id: string;
  /** Generated display name */
  name: string;
  /** Trait values as float array — indices mapped by TRAIT_REGISTRY */
  genome: number[];
  /** Population in each biome: biome ID → population count */
  populationByBiome: Record<string, number>;
  /** Ecological role */
  trophicLevel: TrophicLevel;
  /** Parent species ID, or null for seed species */
  parentSpeciesId: string | null;
  /** Tick when this species first appeared */
  originTick: number;
  /** Generation depth: 0 for seed species, parent.generation + 1 for descendants */
  generation: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface SimConfig {
  /** Initial RNG seed */
  seed: number;
  /** Simulation ticks per real-time second */
  ticksPerSecond: number;
  /** Probability of mutation per reproduction event (0–1) */
  mutationRate: number;
  /** Standard deviation of mutation perturbation */
  mutationMagnitude: number;
  /** Genetic distance threshold that triggers speciation */
  speciationThreshold: number;
  /** Biome grid width (columns) */
  gridWidth: number;
  /** Biome grid height (rows) */
  gridHeight: number;
}

// ---------------------------------------------------------------------------
// RNG state
// ---------------------------------------------------------------------------

export interface RngState {
  /** xorshift128 state word 0 */
  s0: number;
  /** xorshift128 state word 1 */
  s1: number;
  /** xorshift128 state word 2 */
  s2: number;
  /** xorshift128 state word 3 */
  s3: number;
}

// ---------------------------------------------------------------------------
// Trait registry
// ---------------------------------------------------------------------------

export interface TraitDefinition {
  readonly index: number;
  readonly name: string;
  readonly min: number;
  readonly max: number;
}

export const TRAIT_REGISTRY: readonly TraitDefinition[] = [
  { index: 0, name: 'size', min: 0.1, max: 2.0 },
  { index: 1, name: 'speed', min: 0.1, max: 2.0 },
  { index: 2, name: 'coldTolerance', min: 0.0, max: 1.0 },
  { index: 3, name: 'heatTolerance', min: 0.0, max: 1.0 },
  { index: 4, name: 'metabolism', min: 0.1, max: 2.0 },
  { index: 5, name: 'reproductionRate', min: 0.1, max: 2.0 },
] as const;

/** Number of traits in the genome */
export const GENOME_LENGTH = TRAIT_REGISTRY.length;

// ---------------------------------------------------------------------------
// Trait expression
// ---------------------------------------------------------------------------

export interface Traits {
  size: number;
  speed: number;
  coldTolerance: number;
  heatTolerance: number;
  metabolism: number;
  reproductionRate: number;
}

/** Convert a genome array to named traits */
export function expressTraits(genome: number[]): Traits {
  return {
    size: genome[0] ?? 0,
    speed: genome[1] ?? 0,
    coldTolerance: genome[2] ?? 0,
    heatTolerance: genome[3] ?? 0,
    metabolism: genome[4] ?? 0,
    reproductionRate: genome[5] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Look up a biome by grid coordinates. Returns undefined if out of bounds. */
export function getBiome(biomes: readonly Biome[], x: number, y: number): Biome | undefined {
  return biomes.find((b) => b.x === x && b.y === y);
}

/** Compute total population of a species across all biomes. */
export function getTotalPopulation(species: Species): number {
  return Object.values(species.populationByBiome).reduce((sum, pop) => sum + pop, 0);
}
