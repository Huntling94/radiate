/**
 * Genome-driven 3D creature system.
 * Procedural geometry from traits, instanced rendering, idle animation.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Species, TrophicLevel, Biome } from '../engine/index.ts';
import { expressTraits } from '../engine/index.ts';
import { getTerrainHeightAtBiome, biomeToWorldXZ, CELL_SIZE } from './terrain.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_INSTANCES_PER_BIOME = 8;
const CREATURE_GROUP_NAME = '__creatures';

// Trophic base hues (degrees on HSL wheel)
const TROPHIC_HUE: Record<TrophicLevel, number> = {
  producer: 120, // green
  herbivore: 45, // amber/orange
  predator: 0, // red
};

// ---------------------------------------------------------------------------
// Deterministic hash for scatter positions
// ---------------------------------------------------------------------------

function hashPair(a: number, b: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Creature appearance from genome
// ---------------------------------------------------------------------------

interface CreatureAppearance {
  baseScale: number;
  stretchZ: number;
  colour: THREE.Color;
}

function computeAppearance(species: Species): CreatureAppearance {
  const traits = expressTraits(species.genome);

  // Scale from size trait (0.1–2.0 → 0.3–1.0 world units)
  const baseScale = 0.2 + traits.size * 0.3;

  // Elongation from speed (fast = stretched)
  const stretchZ = 0.8 + traits.speed * 0.3;

  // Colour: trophic base hue, shifted by temperature tolerances
  const baseHue = TROPHIC_HUE[species.trophicLevel];
  const hueShift = (traits.heatTolerance - traits.coldTolerance) * 15;
  const hue = (((baseHue + hueShift) % 360) + 360) % 360;

  // Saturation from metabolism
  const saturation = 0.4 + Math.min(0.5, traits.metabolism * 0.25);

  // Lightness
  const lightness = 0.35 + Math.min(0.2, traits.size * 0.08);

  const colour = new THREE.Color();
  colour.setHSL(hue / 360, saturation, lightness);

  return { baseScale, stretchZ, colour };
}

// ---------------------------------------------------------------------------
// Procedural geometry per trophic level
// ---------------------------------------------------------------------------

function buildProducerGeometry(appearance: CreatureAppearance): THREE.BufferGeometry {
  const s = appearance.baseScale;

  // Stem: thin cylinder
  const stem = new THREE.CylinderGeometry(s * 0.15, s * 0.2, s * 1.2, 6);
  stem.translate(0, s * 0.6, 0);

  // Top: flattened sphere (canopy/cap)
  const top = new THREE.SphereGeometry(s * 0.5, 8, 6);
  top.scale(1, 0.5, 1);
  top.translate(0, s * 1.2, 0);

  return mergeGeometries([stem, top], false);
}

function buildHerbivoreGeometry(appearance: CreatureAppearance): THREE.BufferGeometry {
  const s = appearance.baseScale;
  const sz = appearance.stretchZ;

  // Body: stretched sphere
  const body = new THREE.SphereGeometry(s * 0.5, 8, 6);
  body.scale(0.9, 0.8, sz);
  body.translate(0, s * 0.5, 0);

  // Head: smaller sphere
  const head = new THREE.SphereGeometry(s * 0.25, 6, 5);
  head.translate(0, s * 0.85, s * 0.4 * sz);

  return mergeGeometries([body, head], false);
}

function buildPredatorGeometry(appearance: CreatureAppearance): THREE.BufferGeometry {
  const s = appearance.baseScale;
  const sz = appearance.stretchZ;

  // Body: elongated cone
  const body = new THREE.ConeGeometry(s * 0.35, s * 1.0, 6);
  body.scale(0.8, 1, sz);
  body.rotateX(Math.PI / 2);
  body.translate(0, s * 0.45, 0);

  // Head: angular box
  const head = new THREE.BoxGeometry(s * 0.3, s * 0.25, s * 0.35);
  head.translate(0, s * 0.65, s * 0.45 * sz);

  return mergeGeometries([body, head], false);
}

function buildCreatureGeometry(
  trophicLevel: TrophicLevel,
  appearance: CreatureAppearance,
): THREE.BufferGeometry {
  switch (trophicLevel) {
    case 'producer':
      return buildProducerGeometry(appearance);
    case 'herbivore':
      return buildHerbivoreGeometry(appearance);
    case 'predator':
      return buildPredatorGeometry(appearance);
  }
}

// ---------------------------------------------------------------------------
// Instance placement
// ---------------------------------------------------------------------------

interface BiomePlacement {
  worldX: number;
  worldZ: number;
  terrainY: number;
  count: number;
}

function computePlacements(
  species: Species,
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
): BiomePlacement[] {
  const biomeMap = new Map(biomes.map((b) => [b.id, b]));
  const placements: BiomePlacement[] = [];

  for (const [biomeId, population] of Object.entries(species.populationByBiome)) {
    if (population <= 0) continue;
    const biome = biomeMap.get(biomeId);
    if (!biome) continue;

    const [wx, wz] = biomeToWorldXZ(biome, gridWidth, gridHeight);
    const wy = getTerrainHeightAtBiome(biome, biomes, gridWidth, gridHeight);
    const count = Math.min(
      MAX_INSTANCES_PER_BIOME,
      Math.max(1, Math.ceil(Math.log2(population + 1))),
    );

    placements.push({ worldX: wx, worldZ: wz, terrainY: wy, count });
  }

  return placements;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function updateCreatures(
  scene: THREE.Scene,
  species: Species[],
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
  time: number,
): void {
  // Remove existing creature group
  const existing = scene.getObjectByName(CREATURE_GROUP_NAME);
  if (existing) {
    existing.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        (obj.geometry as THREE.BufferGeometry).dispose();
        const mat = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) {
          for (const m of mat) m.dispose();
        } else {
          mat.dispose();
        }
      }
    });
    scene.remove(existing);
  }

  const group = new THREE.Group();
  group.name = CREATURE_GROUP_NAME;

  const dummy = new THREE.Object3D();

  for (const s of species) {
    const appearance = computeAppearance(s);
    const geometry = buildCreatureGeometry(s.trophicLevel, appearance);
    const material = new THREE.MeshLambertMaterial({ color: appearance.colour });

    const placements = computePlacements(s, biomes, gridWidth, gridHeight);

    // Count total instances
    let totalInstances = 0;
    for (const p of placements) {
      totalInstances += p.count;
    }

    if (totalInstances === 0) continue;

    const mesh = new THREE.InstancedMesh(geometry, material, totalInstances);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    let instanceIdx = 0;
    const speciesHash = hashString(s.id);

    for (const placement of placements) {
      for (let i = 0; i < placement.count; i++) {
        // Deterministic scatter within biome cell
        const scatterSeed1 = hashPair(speciesHash + i, instanceIdx * 17);
        const scatterSeed2 = hashPair(instanceIdx * 31, speciesHash + i * 7);
        const offsetX = (scatterSeed1 - 0.5) * CELL_SIZE * 0.6;
        const offsetZ = (scatterSeed2 - 0.5) * CELL_SIZE * 0.6;

        // Idle animation: bobbing + rotation
        const bobPhase = time * 1.5 + instanceIdx * 0.7;
        const bobY = Math.sin(bobPhase) * 0.15;
        const rotY = time * 0.3 + instanceIdx * 1.3 + Math.sin(time * 0.8 + instanceIdx) * 0.3;

        dummy.position.set(
          placement.worldX + offsetX,
          placement.terrainY + bobY,
          placement.worldZ + offsetZ,
        );
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();

        mesh.setMatrixAt(instanceIdx, dummy.matrix);
        instanceIdx++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  scene.add(group);
}
