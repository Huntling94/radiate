/**
 * Genome clustering for species recognition in the IBM engine.
 *
 * Species is a derived concept — creatures are grouped by genetic similarity.
 * Uses distance-based clustering (simplified DBSCAN) with stable cluster IDs.
 *
 * BRF-016: IBM Engine Core
 */

import type { Biome, TrophicLevel } from './types.ts';
import { geneticDistance } from './genome.ts';
import { generateSpeciesName } from './names.ts';
import type { Rng } from './rng.ts';
import { worldXZToBiomeCoords } from './spatial-utils.ts';
import { CLUSTERING_DISTANCE_THRESHOLD, MIN_CLUSTER_SIZE } from './constants.ts';
import type { Creature } from './creature.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpeciesCluster {
  readonly id: string;
  name: string;
  genome: number[]; // centroid genome
  originalGenome: number[]; // genome at cluster creation
  populationByBiome: Record<string, number>;
  trophicLevel: TrophicLevel;
  parentSpeciesId: string | null;
  originTick: number;
  generation: number;
  memberCount: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Clustering algorithm
// ---------------------------------------------------------------------------

/**
 * Group creatures into species clusters by genetic similarity.
 *
 * Algorithm: for each unassigned creature, find all creatures within
 * CLUSTERING_DISTANCE_THRESHOLD. If the group has >= MIN_CLUSTER_SIZE
 * members, form a cluster. Otherwise, assign to the nearest existing cluster.
 *
 * Stable IDs: match new clusters to previous clusters by centroid similarity.
 */
export function clusterCreatures(
  creatures: readonly Creature[],
  previousClusters: readonly SpeciesCluster[],
  biomes: readonly Biome[],
  gridWidth: number,
  gridHeight: number,
  currentTick: number,
  rng: Rng,
  nextClusterId: () => string,
): { clusters: SpeciesCluster[]; creatureClusterMap: Map<string, string> } {
  if (creatures.length === 0) {
    return { clusters: [], creatureClusterMap: new Map() };
  }

  // Step 1: Build distance-based clusters (greedy seed expansion)
  const assigned = new Set<number>();
  const rawGroups: number[][] = [];

  for (let i = 0; i < creatures.length; i++) {
    if (assigned.has(i)) continue;

    const group = [i];
    assigned.add(i);

    // Find all creatures within threshold distance
    for (let j = i + 1; j < creatures.length; j++) {
      if (assigned.has(j)) continue;
      if (creatures[i].trophicLevel !== creatures[j].trophicLevel) continue;

      const dist = geneticDistance(creatures[i].genome, creatures[j].genome);
      if (dist <= CLUSTERING_DISTANCE_THRESHOLD) {
        group.push(j);
        assigned.add(j);
      }
    }

    rawGroups.push(group);
  }

  // Step 2: Merge small groups into nearest cluster
  const validGroups: number[][] = [];
  const orphans: number[] = [];

  for (const group of rawGroups) {
    if (group.length >= MIN_CLUSTER_SIZE) {
      validGroups.push(group);
    } else {
      for (const idx of group) {
        orphans.push(idx);
      }
    }
  }

  // Assign orphans to nearest valid group
  for (const orphanIdx of orphans) {
    let bestGroupIdx = 0;
    let bestDist = Infinity;

    for (let g = 0; g < validGroups.length; g++) {
      // Distance to group centroid
      const centroid = computeCentroid(validGroups[g].map((i) => creatures[i].genome));
      const dist = geneticDistance(creatures[orphanIdx].genome, centroid);
      // Also require same trophic level
      if (creatures[validGroups[g][0]].trophicLevel !== creatures[orphanIdx].trophicLevel) continue;
      if (dist < bestDist) {
        bestDist = dist;
        bestGroupIdx = g;
      }
    }

    if (validGroups.length > 0) {
      validGroups[bestGroupIdx].push(orphanIdx);
    } else {
      // No valid groups at all — create a singleton group
      validGroups.push([orphanIdx]);
    }
  }

  // Step 3: Create SpeciesCluster objects with stable IDs
  const creatureClusterMap = new Map<string, string>();
  const clusters: SpeciesCluster[] = [];
  const previousCentroidMap = new Map<string, { centroid: number[]; cluster: SpeciesCluster }>();
  for (const prev of previousClusters) {
    previousCentroidMap.set(prev.id, { centroid: prev.genome, cluster: prev });
  }

  for (const group of validGroups) {
    const genomes = group.map((i) => creatures[i].genome);
    const centroid = computeCentroid(genomes);
    const trophicLevel = creatures[group[0]].trophicLevel;

    // Try to match to a previous cluster
    let matchedPrev: SpeciesCluster | null = null;
    let matchDist = Infinity;

    for (const [, { centroid: prevCentroid, cluster: prevCluster }] of previousCentroidMap) {
      if (prevCluster.trophicLevel !== trophicLevel) continue;
      const dist = geneticDistance(centroid, prevCentroid);
      if (dist < matchDist && dist <= CLUSTERING_DISTANCE_THRESHOLD) {
        matchDist = dist;
        matchedPrev = prevCluster;
      }
    }

    const clusterId = matchedPrev ? matchedPrev.id : nextClusterId();
    const clusterName = matchedPrev ? matchedPrev.name : generateSpeciesName(rng);

    // Remove matched cluster from future matching
    if (matchedPrev) {
      previousCentroidMap.delete(matchedPrev.id);
    }

    // Derive populationByBiome from creature positions
    const popByBiome: Record<string, number> = {};
    for (const idx of group) {
      const c = creatures[idx];
      const { gx, gy } = worldXZToBiomeCoords(c.x, c.z, gridWidth, gridHeight);
      const biome = biomes[gy * gridWidth + gx];
      popByBiome[biome.id] = (popByBiome[biome.id] ?? 0) + 1;
    }

    // Find the oldest creature's generation for the cluster
    let minGeneration = Infinity;
    let parentId: string | null = null;
    for (const idx of group) {
      if (creatures[idx].generation < minGeneration) {
        minGeneration = creatures[idx].generation;
        parentId = creatures[idx].parentId;
      }
    }

    const cluster: SpeciesCluster = {
      id: clusterId,
      name: clusterName,
      genome: centroid,
      originalGenome: matchedPrev ? matchedPrev.originalGenome : [...centroid],
      populationByBiome: popByBiome,
      trophicLevel,
      parentSpeciesId: matchedPrev ? matchedPrev.parentSpeciesId : (parentId ?? null),
      originTick: matchedPrev ? matchedPrev.originTick : currentTick,
      generation: matchedPrev
        ? matchedPrev.generation
        : minGeneration === Infinity
          ? 0
          : minGeneration,
      memberCount: group.length,
      color: deriveClusterColor(trophicLevel, centroid),
    };

    for (const idx of group) {
      creatureClusterMap.set(creatures[idx].id, clusterId);
    }

    clusters.push(cluster);
  }

  return { clusters, creatureClusterMap };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the element-wise average of an array of genomes. */
export function computeCentroid(genomes: readonly number[][]): number[] {
  if (genomes.length === 0) return [];
  const len = genomes[0].length;
  const centroid = new Array<number>(len).fill(0);

  for (const g of genomes) {
    for (let i = 0; i < len; i++) {
      centroid[i] += g[i] ?? 0;
    }
  }

  for (let i = 0; i < len; i++) {
    centroid[i] /= genomes.length;
  }

  return centroid;
}

/** Derive a display colour from trophic level and centroid genome. */
function deriveClusterColor(trophicLevel: TrophicLevel, centroid: number[]): string {
  // Use trophic-based hue ranges, modulated by genome
  const heatTol = centroid[3] ?? 0.5;
  const coldTol = centroid[2] ?? 0.5;
  const size = centroid[0] ?? 0.5;

  let hue: number;
  switch (trophicLevel) {
    case 'producer':
      hue = 90 + (heatTol - coldTol) * 40; // green range (70-130)
      break;
    case 'herbivore':
      hue = 30 + size * 30; // amber/orange range (30-60)
      break;
    case 'predator':
      hue = 0 + size * 20; // red range (0-20)
      break;
    default:
      hue = 180;
  }

  const saturation = 60 + (centroid[4] ?? 0.5) * 20; // 60-80%
  const lightness = 40 + (centroid[1] ?? 0.5) * 20; // 40-60%

  return `hsl(${String(Math.round(hue))}, ${String(Math.round(saturation))}%, ${String(Math.round(lightness))}%)`;
}
