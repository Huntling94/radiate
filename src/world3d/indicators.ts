/**
 * Species population indicators — billboard sprites placed on terrain.
 * Shows where species live with trophic-coloured markers.
 */

import * as THREE from 'three';
import type { Species, Biome } from '../engine/index.ts';
import { getTerrainHeightAtBiome, biomeToWorldXZ } from './terrain.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TROPHIC_COLOURS: Record<string, number> = {
  producer: 0x22c55e,
  herbivore: 0xeab308,
  predator: 0xef4444,
};

const INDICATOR_OFFSET_Y = 0.8;
const BASE_SCALE = 0.3;
const MAX_SCALE = 1.2;

// ---------------------------------------------------------------------------
// Sprite texture (shared)
// ---------------------------------------------------------------------------

let sharedTexture: THREE.Texture | null = null;

function getCircleTexture(): THREE.Texture {
  if (sharedTexture) return sharedTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Soft circle with glow
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  sharedTexture = new THREE.CanvasTexture(canvas);
  return sharedTexture;
}

// ---------------------------------------------------------------------------
// Indicator management
// ---------------------------------------------------------------------------

const INDICATOR_GROUP_NAME = '__species_indicators';

export function updateIndicators(
  scene: THREE.Scene,
  species: Species[],
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
): void {
  // Remove existing indicator group
  const existing = scene.getObjectByName(INDICATOR_GROUP_NAME);
  if (existing) {
    scene.remove(existing);
    existing.traverse((obj) => {
      if (obj instanceof THREE.Sprite) {
        obj.material.dispose();
      }
    });
  }

  const group = new THREE.Group();
  group.name = INDICATOR_GROUP_NAME;

  // Find max population across all species/biomes for scaling
  let maxPop = 1;
  for (const s of species) {
    for (const pop of Object.values(s.populationByBiome)) {
      if (pop > maxPop) maxPop = pop;
    }
  }

  const texture = getCircleTexture();
  const biomeMap = new Map(biomes.map((b) => [b.id, b]));

  for (const s of species) {
    const colour = TROPHIC_COLOURS[s.trophicLevel] ?? 0xaaaaaa;

    for (const [biomeId, population] of Object.entries(s.populationByBiome)) {
      if (population <= 0) continue;

      const biome = biomeMap.get(biomeId);
      if (!biome) continue;

      const [wx, wz] = biomeToWorldXZ(biome, gridWidth, gridHeight);
      const wy = getTerrainHeightAtBiome(biome, biomes, gridWidth, gridHeight);

      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        color: colour,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(wx, wy + INDICATOR_OFFSET_Y, wz);

      // Scale by population (log scale)
      const scale =
        BASE_SCALE + (MAX_SCALE - BASE_SCALE) * (Math.log(population + 1) / Math.log(maxPop + 1));
      sprite.scale.set(scale, scale, 1);

      group.add(sprite);
    }
  }

  scene.add(group);
}
