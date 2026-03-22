/**
 * Speciation — splitting species when genetic drift exceeds a threshold.
 */

import type { Species, SimConfig } from './types.ts';
import type { Rng } from './rng.ts';
import { geneticDistance } from './genome.ts';
import { generateSpeciesName } from './names.ts';

// Minimum ticks between speciation events for a lineage
const MIN_TICKS_BETWEEN_SPECIATION = 100;

export interface SpeciationEvent {
  parentId: string;
  childId: string;
  childName: string;
  tick: number;
}

/**
 * Check all species for speciation and return updated species list.
 * A species speciates when its genome has drifted far enough from its original.
 */
export function checkSpeciation(
  species: Species[],
  currentTick: number,
  rng: Rng,
  config: SimConfig,
): { species: Species[]; events: SpeciationEvent[] } {
  const result: Species[] = [];
  const events: SpeciationEvent[] = [];
  let nextId = species.length;

  for (const s of species) {
    // Check minimum time since species was created
    if (currentTick - s.originTick < MIN_TICKS_BETWEEN_SPECIATION) {
      result.push(s);
      continue;
    }

    const dist = geneticDistance(s.genome, s.originalGenome);

    if (dist >= config.speciationThreshold) {
      // Speciation event! Split into parent (reset) and child (drifted)
      const childId = `species-${String(nextId)}`;
      nextId++;
      const childName = generateSpeciesName(rng);

      // Parent resets genome to original
      const parent: Species = {
        ...s,
        genome: [...s.originalGenome],
      };

      // Child gets the drifted genome as its new original
      const childPopByBiome: Record<string, number> = {};
      const parentPopByBiome: Record<string, number> = {};

      for (const [biomeId, pop] of Object.entries(s.populationByBiome)) {
        const half = Math.floor(pop / 2);
        if (half > 0) {
          parentPopByBiome[biomeId] = half;
          childPopByBiome[biomeId] = pop - half;
        }
      }

      parent.populationByBiome = parentPopByBiome;

      const child: Species = {
        id: childId,
        name: childName,
        genome: [...s.genome],
        originalGenome: [...s.genome],
        populationByBiome: childPopByBiome,
        trophicLevel: s.trophicLevel,
        parentSpeciesId: s.id,
        originTick: currentTick,
        generation: s.generation + 1,
      };

      result.push(parent, child);
      events.push({ parentId: s.id, childId, childName, tick: currentTick });
    } else {
      result.push(s);
    }
  }

  return { species: result, events };
}
