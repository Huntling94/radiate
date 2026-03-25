/**
 * Individual-Based Model tick loop.
 *
 * Replaces the Lotka-Volterra population-level tick with individual creature
 * simulation. Each creature senses, decides, moves, metabolises, ages, dies,
 * and reproduces independently. Population dynamics emerge from these
 * individual interactions.
 *
 * BRF-016: IBM Engine Core
 */

import type { WorldState, SimEvent, Biome } from './types.ts';
import { MAX_EVENTS } from './types.ts';
import { updateBiomeTypes } from './environment.ts';
import { createRngFromState } from './rng.ts';
import type { Rng } from './rng.ts';
import { createSpatialHash } from './spatial-hash.ts';
import type { Creature } from './types.ts';
import { producerTick, herbivoreTick, predatorTick } from './creature.ts';
import { clusterCreatures } from './clustering.ts';
import { MAX_SUB_TICKS, CLUSTERING_INTERVAL, SPATIAL_HASH_CELL_SIZE } from './constants.ts';

// ---------------------------------------------------------------------------
// IBM tick
// ---------------------------------------------------------------------------

/**
 * Run the IBM simulation for the given time delta.
 *
 * Each sub-tick processes all creatures by trophic level:
 * producers → herbivores → predators.
 * Clustering runs periodically to derive species groupings.
 */
export function ibmTick(state: WorldState, deltaSec: number): WorldState {
  if (deltaSec <= 0) return state;

  const steps = Math.min(Math.ceil(deltaSec * state.config.ticksPerSecond), MAX_SUB_TICKS);
  if (steps <= 0) return state;

  const rng = createRngFromState(state.rngState);
  const biomes = updateBiomeTypes(state.biomes, state.temperature);
  const { gridWidth, gridHeight } = state.config;

  // Clone creatures for mutation
  let creatures: Creature[] = state.creatures.map((c) => ({ ...c }));
  let nextCreatureId = state.nextCreatureId;
  let speciesClusters = [...state.speciesClusters];
  let events = [...state.events];
  const extinctSpecies = [...state.extinctSpecies];
  let extinctSpeciesCount = state.extinctSpeciesCount;
  const clusteringInterval = state.config.clusteringInterval ?? CLUSTERING_INTERVAL;

  function nextId(): string {
    return `c-${String(nextCreatureId++)}`;
  }

  function nextClusterId(): string {
    return `sp-${String(nextCreatureId++)}`;
  }

  for (let step = 0; step < steps; step++) {
    const currentTick = state.tick + step + 1;

    // Build spatial hash for this tick
    const hash = createSpatialHash<Creature>(SPATIAL_HASH_CELL_SIZE);
    for (const c of creatures) {
      hash.insert(c);
    }

    const births: Creature[] = [];
    const deaths = new Set<string>();

    // Process by trophic order: producers → herbivores → predators
    processCreaturesByLevel(
      'producer',
      creatures,
      hash,
      biomes,
      state.temperature,
      rng,
      state.config,
      gridWidth,
      gridHeight,
      deaths,
      births,
      nextId,
    );
    processCreaturesByLevel(
      'herbivore',
      creatures,
      hash,
      biomes,
      state.temperature,
      rng,
      state.config,
      gridWidth,
      gridHeight,
      deaths,
      births,
      nextId,
    );
    processCreaturesByLevel(
      'predator',
      creatures,
      hash,
      biomes,
      state.temperature,
      rng,
      state.config,
      gridWidth,
      gridHeight,
      deaths,
      births,
      nextId,
    );

    // Apply births and deaths
    if (deaths.size > 0) {
      creatures = creatures.filter((c) => !deaths.has(c.id));
    }
    if (births.length > 0) {
      creatures.push(...births);
    }

    // Periodic clustering
    if (currentTick % clusteringInterval === 0 || step === steps - 1) {
      const previousClusters = speciesClusters;
      const { clusters, creatureClusterMap } = clusterCreatures(
        creatures,
        previousClusters,
        biomes,
        gridWidth,
        gridHeight,
        currentTick,
        rng,
        nextClusterId,
      );

      // Update creature cluster assignments
      for (const c of creatures) {
        const clusterId = creatureClusterMap.get(c.id);
        if (clusterId) {
          c.speciesClusterId = clusterId;
        }
      }

      // Detect speciation events (new clusters that weren't in previous)
      const prevIds = new Set(previousClusters.map((c) => c.id));
      for (const cluster of clusters) {
        if (!prevIds.has(cluster.id) && previousClusters.length > 0) {
          events.push(
            makeEvent(
              currentTick,
              'speciation',
              `${cluster.name} has emerged as a new ${cluster.trophicLevel} species`,
              `Genome divergence in ${cluster.trophicLevel} population created a distinct cluster of ${String(cluster.memberCount)} individuals`,
              cluster.id,
              rng,
            ),
          );
        }
      }

      // Detect extinction events (previous clusters no longer present)
      const newIds = new Set(clusters.map((c) => c.id));
      for (const prev of previousClusters) {
        if (!newIds.has(prev.id)) {
          events.push(
            makeEvent(
              currentTick,
              'extinction',
              `${prev.name} has gone extinct`,
              `All ${prev.trophicLevel} individuals of this species have died`,
              prev.id,
              rng,
            ),
          );

          // Archive the extinct cluster
          extinctSpecies.push({
            ...prev,
            // SpeciesCluster → ExtinctSpecies compatibility
            originalGenome: prev.originalGenome,
            populationByBiome: {},
            extinctionTick: currentTick,
          });
          extinctSpeciesCount++;
        }
      }

      speciesClusters = clusters;

      // Cap events
      if (events.length > MAX_EVENTS) {
        events = events.slice(-MAX_EVENTS);
      }
    }
  }

  return {
    ...state,
    tick: state.tick + steps,
    elapsedSeconds: state.elapsedSeconds + deltaSec,
    lastTimestamp: Date.now(),
    biomes,
    creatures,
    speciesClusters,
    species: speciesClusters, // compatibility alias
    extinctSpecies,
    extinctSpeciesCount,
    nextCreatureId,
    rngState: rng.getState(),
    events,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function processCreaturesByLevel(
  level: 'producer' | 'herbivore' | 'predator',
  creatures: Creature[],
  hash: ReturnType<typeof createSpatialHash<Creature>>,
  biomes: readonly Biome[],
  temperature: number,
  rng: Rng,
  config: WorldState['config'],
  gridWidth: number,
  gridHeight: number,
  deaths: Set<string>,
  births: Creature[],
  nextId: () => string,
): void {
  const tickFn =
    level === 'producer' ? producerTick : level === 'herbivore' ? herbivoreTick : predatorTick;

  for (const creature of creatures) {
    if (creature.trophicLevel !== level) continue;
    if (deaths.has(creature.id)) continue;

    const result = tickFn(
      creature,
      hash,
      biomes,
      temperature,
      rng,
      config,
      gridWidth,
      gridHeight,
      deaths,
      nextId,
    );

    if (result.dead) {
      deaths.add(creature.id);
    }
    if (result.offspring) {
      births.push(result.offspring);
    }
    if (result.killedId) {
      deaths.add(result.killedId);
    }
  }
}

function makeEvent(
  tick: number,
  type: 'speciation' | 'extinction',
  description: string,
  cause: string,
  speciesId: string,
  rng: Rng,
): SimEvent {
  return {
    id: `evt-${String(tick)}-${String(rng.nextInt(0, 9999))}`,
    tick,
    type,
    description,
    cause,
    speciesId,
  };
}
