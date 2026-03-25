/**
 * Creature type definition and lifecycle functions for the IBM engine.
 *
 * Each creature is an independent entity with its own genome, position,
 * energy budget, and behavioural state. All functions are pure.
 *
 * BRF-016: IBM Engine Core
 */

import type { Biome, TrophicLevel, Traits, SimConfig } from './types.ts';
import { expressTraits } from './types.ts';
import { mutateGenome } from './genome.ts';
import { computeBiomeEnergy } from './energy.ts';
import { computeFitnessModifier } from './environment.ts';
import { isHabitable } from './biome.ts';
import type { Rng } from './rng.ts';
import type { SpatialHash } from './spatial-hash.ts';
import {
  worldXZToBiomeCoords,
  isPositionHabitable,
  getWorldBounds,
  getBiomeAtWorldXZ,
} from './spatial-utils.ts';
import {
  BASE_METABOLISM_COST,
  PRODUCER_ENERGY_GAIN,
  MAX_BIOME_ENERGY,
  REPRODUCTION_ENERGY_THRESHOLD,
  REPRODUCTION_ENERGY_COST,
  OFFSPRING_STARTING_ENERGY,
  HERBIVORE_FEED_ENERGY,
  PREDATOR_FEED_ENERGY,
  HERBIVORE_DETECTION_RANGE,
  PREDATOR_DETECTION_RANGE,
  FLEE_DETECTION_RANGE,
  BASE_MOVE_SPEED,
  FLEE_SPEED_MULTIPLIER,
  CHASE_SPEED_MULTIPLIER,
  FEED_DISTANCE,
  FLEE_DURATION,
  CHASE_TIMEOUT,
  WANDER_RADIUS,
  BASE_LIFESPAN,
  LIFESPAN_SIZE_FACTOR,
  LIFESPAN_METABOLISM_FACTOR,
  MINIMUM_LIFESPAN,
  PRODUCER_DENSITY_CAP,
  PRODUCER_SPAWN_RADIUS,
} from './constants.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreatureState = 'idle' | 'foraging' | 'fleeing' | 'hunting' | 'reproducing';

export interface Creature {
  readonly id: string;
  genome: number[];
  /** World x position. Top-level for SpatialEntry compatibility. */
  x: number;
  /** World z position. Top-level for SpatialEntry compatibility. */
  z: number;
  energy: number;
  age: number;
  state: CreatureState;
  readonly trophicLevel: TrophicLevel;
  readonly parentId: string | null;
  readonly generation: number;
  speciesClusterId: string;
  /** Ticks remaining in current flee/chase state. */
  stateTimer: number;
  /** Current movement target, if any. */
  target: { x: number; z: number } | null;
}

/** Result of processing one creature's tick. */
export interface CreatureTickResult {
  dead: boolean;
  offspring: Creature | null;
  /** ID of a creature killed by this creature (feeding). */
  killedId: string | null;
}

// ---------------------------------------------------------------------------
// Lifespan
// ---------------------------------------------------------------------------

/** Compute genome-derived lifespan in ticks. */
export function computeLifespan(genome: number[]): number {
  const traits = expressTraits(genome);
  const raw =
    BASE_LIFESPAN +
    traits.size * LIFESPAN_SIZE_FACTOR +
    traits.metabolism * LIFESPAN_METABOLISM_FACTOR;
  return Math.max(MINIMUM_LIFESPAN, Math.round(raw));
}

// ---------------------------------------------------------------------------
// Metabolism
// ---------------------------------------------------------------------------

/** Compute per-tick energy cost for a creature. */
export function metabolismCost(traits: Traits): number {
  return BASE_METABOLISM_COST * traits.size * traits.metabolism;
}

// ---------------------------------------------------------------------------
// Reproduction
// ---------------------------------------------------------------------------

/** Check if a creature has enough energy to reproduce. */
export function canReproduce(creature: Creature): boolean {
  return creature.energy >= REPRODUCTION_ENERGY_THRESHOLD;
}

/**
 * Create an offspring from a parent creature.
 * Returns the offspring; caller must deduct energy from parent.
 */
export function reproduce(
  parent: Creature,
  offspringId: string,
  rng: Rng,
  config: SimConfig,
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
): Creature | null {
  // Find a nearby habitable spawn position
  const spawnPos = findSpawnPosition(
    parent.x,
    parent.z,
    parent.trophicLevel === 'producer' ? PRODUCER_SPAWN_RADIUS : WANDER_RADIUS,
    rng,
    biomes,
    gridWidth,
    gridHeight,
  );
  if (!spawnPos) return null;

  const childGenome = mutateGenome([...parent.genome], rng, config);

  return {
    id: offspringId,
    genome: childGenome,
    x: spawnPos.x,
    z: spawnPos.z,
    energy: OFFSPRING_STARTING_ENERGY,
    age: 0,
    state: 'idle',
    trophicLevel: parent.trophicLevel,
    parentId: parent.id,
    generation: parent.generation + 1,
    speciesClusterId: parent.speciesClusterId,
    stateTimer: 0,
    target: null,
  };
}

// ---------------------------------------------------------------------------
// Movement helpers
// ---------------------------------------------------------------------------

function findSpawnPosition(
  cx: number,
  cz: number,
  radius: number,
  rng: Rng,
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
): { x: number; z: number } | null {
  const bounds = getWorldBounds(gridWidth, gridHeight);
  // Try up to 5 random positions
  for (let attempt = 0; attempt < 5; attempt++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = rng.next() * radius;
    const nx = cx + Math.cos(angle) * dist;
    const nz = cz + Math.sin(angle) * dist;

    // Clamp to world bounds
    const x = Math.max(bounds.minX, Math.min(bounds.maxX, nx));
    const z = Math.max(bounds.minZ, Math.min(bounds.maxZ, nz));

    if (isPositionHabitable(x, z, biomes, gridWidth, gridHeight)) {
      return { x, z };
    }
  }
  return null;
}

function moveToward(
  creature: Creature,
  targetX: number,
  targetZ: number,
  speed: number,
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
): void {
  const dx = targetX - creature.x;
  const dz = targetZ - creature.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.01) return;

  const step = Math.min(speed, dist);
  const nx = creature.x + (dx / dist) * step;
  const nz = creature.z + (dz / dist) * step;

  // Only move if new position is habitable
  if (isPositionHabitable(nx, nz, biomes, gridWidth, gridHeight)) {
    creature.x = nx;
    creature.z = nz;
  }
}

function moveAwayFrom(
  creature: Creature,
  threatX: number,
  threatZ: number,
  speed: number,
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
): void {
  const dx = creature.x - threatX;
  const dz = creature.z - threatZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.01) return;

  const nx = creature.x + (dx / dist) * speed;
  const nz = creature.z + (dz / dist) * speed;

  const bounds = getWorldBounds(gridWidth, gridHeight);
  const clampedX = Math.max(bounds.minX, Math.min(bounds.maxX, nx));
  const clampedZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, nz));

  if (isPositionHabitable(clampedX, clampedZ, biomes, gridWidth, gridHeight)) {
    creature.x = clampedX;
    creature.z = clampedZ;
  }
}

function pickWanderTarget(
  creature: Creature,
  rng: Rng,
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
): { x: number; z: number } | null {
  return findSpawnPosition(
    creature.x,
    creature.z,
    WANDER_RADIUS,
    rng,
    biomes,
    gridWidth,
    gridHeight,
  );
}

// ---------------------------------------------------------------------------
// Per-tick creature processing
// ---------------------------------------------------------------------------

/** Count producers in the same biome cell as a position. */
export function countProducersInBiome(
  x: number,
  z: number,
  hash: SpatialHash<Creature>,
  gridWidth: number,
  gridHeight: number,
): number {
  const { gx, gy } = worldXZToBiomeCoords(x, z, gridWidth, gridHeight);
  // Query a radius roughly covering one biome cell
  const nearby = hash.query(x, z, 15); // slightly larger than CELL_SIZE to catch edges
  let count = 0;
  for (const c of nearby) {
    if (c.trophicLevel !== 'producer') continue;
    const cCoords = worldXZToBiomeCoords(c.x, c.z, gridWidth, gridHeight);
    if (cCoords.gx === gx && cCoords.gy === gy) count++;
  }
  return count;
}

/**
 * Process a producer creature's tick (lightweight — no sense/decide/move).
 */
export function producerTick(
  creature: Creature,
  hash: SpatialHash<Creature>,
  biomes: readonly Biome[],
  temperature: number,
  rng: Rng,
  config: SimConfig,
  gridWidth: number,
  gridHeight: number,
  deaths: ReadonlySet<string>,
  nextId: () => string,
): CreatureTickResult {
  const traits = expressTraits(creature.genome);

  // Photosynthesis — gain energy from biome
  const biome = getBiomeAtWorldXZ(creature.x, creature.z, biomes, gridWidth, gridHeight);
  if (biome && isHabitable(biome.biomeType)) {
    const energy = computeBiomeEnergy(biome, temperature);
    const fraction = energy / MAX_BIOME_ENERGY;
    // computeFitnessModifier only reads .genome; construct minimal Species shape
    const asSpecies = {
      id: creature.id,
      name: '',
      genome: creature.genome,
      originalGenome: creature.genome,
      populationByBiome: {} as Record<string, number>,
      trophicLevel: creature.trophicLevel,
      parentSpeciesId: null,
      originTick: 0,
      generation: creature.generation,
    };
    const fitness = computeFitnessModifier(asSpecies, temperature);
    const producerCount = countProducersInBiome(
      creature.x,
      creature.z,
      hash,
      gridWidth,
      gridHeight,
    );
    const crowdingPenalty = producerCount >= PRODUCER_DENSITY_CAP ? 0.5 : 1.0;
    creature.energy += PRODUCER_ENERGY_GAIN * fraction * fitness * crowdingPenalty;
  }

  // Metabolise
  creature.energy -= metabolismCost(traits);

  // Age
  creature.age += 1;

  // Die check
  const lifespan = computeLifespan(creature.genome);
  if (creature.energy <= 0 || creature.age > lifespan) {
    return { dead: true, offspring: null, killedId: null };
  }

  // Reproduce check
  if (canReproduce(creature)) {
    const producerCount = countProducersInBiome(
      creature.x,
      creature.z,
      hash,
      gridWidth,
      gridHeight,
    );
    if (producerCount < PRODUCER_DENSITY_CAP) {
      const child = reproduce(creature, nextId(), rng, config, biomes, gridWidth, gridHeight);
      if (child) {
        creature.energy -= REPRODUCTION_ENERGY_COST;
        return { dead: false, offspring: child, killedId: null };
      }
    }
  }

  return { dead: false, offspring: null, killedId: null };
}

/**
 * Process a herbivore creature's tick.
 */
export function herbivoreTick(
  creature: Creature,
  hash: SpatialHash<Creature>,
  biomes: readonly Biome[],
  temperature: number,
  rng: Rng,
  config: SimConfig,
  gridWidth: number,
  gridHeight: number,
  deaths: ReadonlySet<string>,
  nextId: () => string,
): CreatureTickResult {
  const traits = expressTraits(creature.genome);
  const moveSpeed = BASE_MOVE_SPEED * traits.speed;
  let killedId: string | null = null;

  // Sense: check for predators (flee) and food (forage)
  const nearestPredator = hash.nearest(
    creature.x,
    creature.z,
    FLEE_DETECTION_RANGE,
    (e) => e.trophicLevel === 'predator' && !deaths.has(e.id) && e.id !== creature.id,
  );

  if (nearestPredator) {
    // Flee!
    creature.state = 'fleeing';
    creature.stateTimer = FLEE_DURATION;
    moveAwayFrom(
      creature,
      nearestPredator.x,
      nearestPredator.z,
      moveSpeed * FLEE_SPEED_MULTIPLIER,
      biomes,
      gridWidth,
      gridHeight,
    );
  } else if (creature.state === 'fleeing' && creature.stateTimer > 0) {
    // Continue fleeing
    creature.stateTimer--;
    if (creature.stateTimer <= 0) creature.state = 'idle';
  } else {
    // Look for food (producers)
    const nearestFood = hash.nearest(
      creature.x,
      creature.z,
      HERBIVORE_DETECTION_RANGE,
      (e) => e.trophicLevel === 'producer' && !deaths.has(e.id) && e.id !== creature.id,
    );

    if (nearestFood) {
      creature.state = 'foraging';
      const dx = nearestFood.x - creature.x;
      const dz = nearestFood.z - creature.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < FEED_DISTANCE) {
        // Eat the producer
        creature.energy += HERBIVORE_FEED_ENERGY;
        killedId = nearestFood.id;
      } else {
        moveToward(
          creature,
          nearestFood.x,
          nearestFood.z,
          moveSpeed,
          biomes,
          gridWidth,
          gridHeight,
        );
      }
    } else {
      // Wander
      creature.state = 'idle';
      if (!creature.target) {
        creature.target = pickWanderTarget(creature, rng, biomes, gridWidth, gridHeight);
      }
      if (creature.target) {
        moveToward(
          creature,
          creature.target.x,
          creature.target.z,
          moveSpeed,
          biomes,
          gridWidth,
          gridHeight,
        );
        const dx = creature.target.x - creature.x;
        const dz = creature.target.z - creature.z;
        if (dx * dx + dz * dz < 1) creature.target = null;
      }
    }
  }

  // Metabolise
  creature.energy -= metabolismCost(traits);

  // Age
  creature.age += 1;

  // Die check
  const lifespan = computeLifespan(creature.genome);
  if (creature.energy <= 0 || creature.age > lifespan) {
    return { dead: true, offspring: null, killedId };
  }

  // Reproduce check
  if (canReproduce(creature)) {
    const child = reproduce(creature, nextId(), rng, config, biomes, gridWidth, gridHeight);
    if (child) {
      creature.energy -= REPRODUCTION_ENERGY_COST;
      return { dead: false, offspring: child, killedId };
    }
  }

  return { dead: false, offspring: null, killedId };
}

/**
 * Process a predator creature's tick.
 */
export function predatorTick(
  creature: Creature,
  hash: SpatialHash<Creature>,
  biomes: readonly Biome[],
  temperature: number,
  rng: Rng,
  config: SimConfig,
  gridWidth: number,
  gridHeight: number,
  deaths: ReadonlySet<string>,
  nextId: () => string,
): CreatureTickResult {
  const traits = expressTraits(creature.genome);
  const moveSpeed = BASE_MOVE_SPEED * traits.speed;
  let killedId: string | null = null;

  // Look for prey (herbivores)
  const nearestPrey = hash.nearest(
    creature.x,
    creature.z,
    PREDATOR_DETECTION_RANGE,
    (e) => e.trophicLevel === 'herbivore' && !deaths.has(e.id) && e.id !== creature.id,
  );

  if (nearestPrey) {
    creature.state = 'hunting';
    creature.stateTimer = CHASE_TIMEOUT;
    const dx = nearestPrey.x - creature.x;
    const dz = nearestPrey.z - creature.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < FEED_DISTANCE) {
      // Catch and eat the herbivore
      creature.energy += PREDATOR_FEED_ENERGY;
      killedId = nearestPrey.id;
    } else {
      moveToward(
        creature,
        nearestPrey.x,
        nearestPrey.z,
        moveSpeed * CHASE_SPEED_MULTIPLIER,
        biomes,
        gridWidth,
        gridHeight,
      );
    }
  } else if (creature.state === 'hunting' && creature.stateTimer > 0) {
    creature.stateTimer--;
    if (creature.stateTimer <= 0) creature.state = 'idle';
  } else {
    // Wander
    creature.state = 'idle';
    if (!creature.target) {
      creature.target = pickWanderTarget(creature, rng, biomes, gridWidth, gridHeight);
    }
    if (creature.target) {
      moveToward(
        creature,
        creature.target.x,
        creature.target.z,
        moveSpeed,
        biomes,
        gridWidth,
        gridHeight,
      );
      const dx = creature.target.x - creature.x;
      const dz = creature.target.z - creature.z;
      if (dx * dx + dz * dz < 1) creature.target = null;
    }
  }

  // Metabolise
  creature.energy -= metabolismCost(traits);

  // Age
  creature.age += 1;

  // Die check
  const lifespan = computeLifespan(creature.genome);
  if (creature.energy <= 0 || creature.age > lifespan) {
    return { dead: true, offspring: null, killedId };
  }

  // Reproduce check
  if (canReproduce(creature)) {
    const child = reproduce(creature, nextId(), rng, config, biomes, gridWidth, gridHeight);
    if (child) {
      creature.energy -= REPRODUCTION_ENERGY_COST;
      return { dead: false, offspring: child, killedId };
    }
  }

  return { dead: false, offspring: null, killedId };
}
