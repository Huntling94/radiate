/**
 * Cute procedural creatures with trophic behaviour AI.
 * Representative creatures (3–8 per species) that wander, chase, flee.
 * All behaviour is cosmetic — the engine drives actual population dynamics.
 */

import * as THREE from 'three';
import type { Species, TrophicLevel, Biome } from '../engine/index.ts';
import { expressTraits } from '../engine/index.ts';
import {
  getHeightAtWorldXZ,
  isPositionHabitable,
  biomeToWorldXZ,
  getWorldBounds,
  CELL_SIZE,
} from './terrain.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_MOVE_SPEED = 3;
const WANDER_RADIUS = 20;
const IDLE_MIN = 1.5;
const IDLE_MAX = 4;
const PREDATOR_DETECT_RANGE = 14;
const HERBIVORE_FLEE_RANGE = 10;
const CHASE_TIMEOUT = 6;
const CATCH_DISTANCE = 1.5;
const RESPAWN_DELAY = 3;
const FLEE_SPEED_MULT = 2;
const CHASE_SPEED_MULT = 1.6;
const MAX_WANDER_ATTEMPTS = 10;

// Trophic base hues (HSL degrees)
const TROPHIC_HUE: Record<TrophicLevel, number> = {
  producer: 120,
  herbivore: 45,
  predator: 0,
};

// ---------------------------------------------------------------------------
// Deterministic hash
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
// Creature appearance
// ---------------------------------------------------------------------------

function computeColour(species: Species): THREE.Color {
  const traits = expressTraits(species.genome);
  const baseHue = TROPHIC_HUE[species.trophicLevel];
  const hueShift = (traits.heatTolerance - traits.coldTolerance) * 15;
  // Add species-specific hue variation
  const speciesHueOffset = (hashString(species.id) % 30) - 15;
  const hue = (((baseHue + hueShift + speciesHueOffset) % 360) + 360) % 360;
  const saturation = 0.5 + Math.min(0.4, traits.metabolism * 0.2);
  const lightness = 0.4 + Math.min(0.2, traits.size * 0.08);

  const colour = new THREE.Color();
  colour.setHSL(hue / 360, saturation, lightness);
  return colour;
}

function computeScale(species: Species): number {
  const traits = expressTraits(species.genome);
  return 0.4 + traits.size * 0.4;
}

function computeSpeed(species: Species): number {
  const traits = expressTraits(species.genome);
  return BASE_MOVE_SPEED * (0.5 + traits.speed * 0.5);
}

// ---------------------------------------------------------------------------
// Cute creature mesh builder
// ---------------------------------------------------------------------------

function buildCreatureMesh(species: Species): THREE.Group {
  const colour = computeColour(species);
  const scale = computeScale(species);
  const traits = expressTraits(species.genome);
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshToonMaterial({ color: colour });
  const eyeWhiteMat = new THREE.MeshToonMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshToonMaterial({ color: 0x111111 });

  // Enable shadow casting on all child meshes
  const enableShadows = (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });
  };

  if (species.trophicLevel === 'producer') {
    // Mushroom-like: short stalk + round cap
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, 0.6 * scale, 8),
      bodyMat,
    );
    stalk.position.y = 0.3 * scale;
    group.add(stalk);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.45 * scale, 12, 8), bodyMat);
    cap.scale.set(1, 0.6, 1);
    cap.position.y = 0.7 * scale;
    group.add(cap);

    // Eyes on the cap
    const eyeOffset = 0.18 * scale;
    const eyeY = 0.65 * scale;
    const eyeZ = 0.3 * scale;
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.08 * scale, 8, 6), eyeWhiteMat);
      eyeWhite.position.set(side * eyeOffset, eyeY, eyeZ);
      group.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04 * scale, 6, 4), pupilMat);
      pupil.position.set(side * eyeOffset, eyeY, eyeZ + 0.05 * scale);
      group.add(pupil);
    }
  } else if (species.trophicLevel === 'herbivore') {
    // Chubby round body + large head
    const stretch = 0.8 + traits.speed * 0.15;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4 * scale, 12, 10), bodyMat);
    body.scale.set(0.9, 0.85, stretch);
    body.position.y = 0.4 * scale;
    group.add(body);

    // Head — big relative to body
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 12, 10), bodyMat);
    head.position.set(0, 0.75 * scale, 0.25 * scale * stretch);
    group.add(head);

    // Eyes
    const eyeOffset = 0.12 * scale;
    const eyeY = 0.78 * scale;
    const eyeZ = 0.25 * scale * stretch + 0.2 * scale;
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 8, 6), eyeWhiteMat);
      eyeWhite.position.set(side * eyeOffset, eyeY, eyeZ);
      group.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045 * scale, 6, 4), pupilMat);
      pupil.position.set(side * eyeOffset, eyeY, eyeZ + 0.06 * scale);
      group.add(pupil);
    }
  } else {
    // Predator: sleek body, forward-leaning head
    const stretch = 0.9 + traits.speed * 0.2;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35 * scale, 12, 10), bodyMat);
    body.scale.set(0.75, 0.8, stretch);
    body.position.y = 0.4 * scale;
    group.add(body);

    // Head — slightly smaller, angular position
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25 * scale, 10, 8), bodyMat);
    head.scale.set(0.9, 0.85, 1.1);
    head.position.set(0, 0.6 * scale, 0.35 * scale * stretch);
    group.add(head);

    // Eyes — slightly narrower
    const eyeOffset = 0.1 * scale;
    const eyeY = 0.63 * scale;
    const eyeZ = 0.35 * scale * stretch + 0.18 * scale;
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 6), eyeWhiteMat);
      eyeWhite.position.set(side * eyeOffset, eyeY, eyeZ);
      group.add(eyeWhite);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04 * scale, 6, 4), pupilMat);
      pupil.position.set(side * eyeOffset, eyeY, eyeZ + 0.05 * scale);
      group.add(pupil);
    }
  }

  enableShadows(group);
  return group;
}

// ---------------------------------------------------------------------------
// Creature instance state
// ---------------------------------------------------------------------------

type CreatureState = 'idle' | 'walking' | 'fleeing' | 'chasing' | 'catching' | 'hidden';

export interface CreatureInstance {
  speciesId: string;
  trophicLevel: TrophicLevel;
  mesh: THREE.Group;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  state: CreatureState;
  stateTimer: number;
  speed: number;
  facingAngle: number;
  chaseTarget: CreatureInstance | null;
}

// ---------------------------------------------------------------------------
// Creature manager
// ---------------------------------------------------------------------------

export class CreatureManager {
  private creatures: CreatureInstance[] = [];
  private scene: THREE.Scene;
  private biomes: Biome[] = [];
  private gridWidth = 0;
  private gridHeight = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Sync creature instances with the current species list.
   * Adds creatures for new species, removes for extinct.
   */
  syncSpecies(species: Species[], biomes: Biome[], gridWidth: number, gridHeight: number): void {
    this.biomes = biomes;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;

    const currentSpeciesIds = new Set(species.map((s) => s.id));
    const existingSpeciesIds = new Set(this.creatures.map((c) => c.speciesId));

    // Remove creatures for extinct species
    const toRemove = this.creatures.filter((c) => !currentSpeciesIds.has(c.speciesId));
    for (const c of toRemove) {
      this.scene.remove(c.mesh);
      disposeMeshGroup(c.mesh);
    }
    this.creatures = this.creatures.filter((c) => currentSpeciesIds.has(c.speciesId));

    // Add creatures for new species
    for (const s of species) {
      if (existingSpeciesIds.has(s.id)) continue;

      const count = this.computeRepCount(s);
      for (let i = 0; i < count; i++) {
        const creature = this.spawnCreature(s, i);
        if (creature) {
          this.creatures.push(creature);
          this.scene.add(creature.mesh);
        }
      }
    }
  }

  /**
   * Resolve a hit mesh to its owning creature's species ID.
   * Walks up the parent chain to find a creature group.
   */
  getSpeciesIdByMesh(hitObject: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = hitObject;
    while (current) {
      for (const creature of this.creatures) {
        if (creature.mesh === current) return creature.speciesId;
      }
      current = current.parent;
    }
    return null;
  }

  /** Get all creature root groups for raycasting. */
  getAllMeshGroups(): THREE.Group[] {
    return this.creatures.filter((c) => c.mesh.visible).map((c) => c.mesh);
  }

  /**
   * Update all creature behaviours for one frame.
   */
  update(delta: number, time: number): void {
    for (const creature of this.creatures) {
      this.updateCreature(creature, delta, time);
    }
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private computeRepCount(species: Species): number {
    let totalPop = 0;
    for (const pop of Object.values(species.populationByBiome)) {
      totalPop += pop;
    }
    if (totalPop <= 0) return 0;
    return Math.min(8, Math.max(3, Math.floor(Math.log10(totalPop + 1))));
  }

  private spawnCreature(species: Species, index: number): CreatureInstance | null {
    const mesh = buildCreatureMesh(species);
    const pos = this.pickSpawnPosition(species, index);
    if (!pos) return null;

    const wy = getHeightAtWorldXZ(pos.x, pos.z, this.biomes, this.gridWidth, this.gridHeight);
    mesh.position.set(pos.x, wy, pos.z);

    return {
      speciesId: species.id,
      trophicLevel: species.trophicLevel,
      mesh,
      position: new THREE.Vector3(pos.x, wy, pos.z),
      targetPosition: new THREE.Vector3(pos.x, wy, pos.z),
      state: 'idle',
      stateTimer: Math.random() * 2,
      speed: computeSpeed(species),
      facingAngle: Math.random() * Math.PI * 2,
      chaseTarget: null,
    };
  }

  private pickSpawnPosition(species: Species, index: number): { x: number; z: number } | null {
    // Pick a populated biome and scatter within it
    const populatedBiomes = this.biomes.filter((b) => (species.populationByBiome[b.id] ?? 0) > 0);
    if (populatedBiomes.length === 0) return null;

    const seed = hashString(species.id) + index;
    const biome = populatedBiomes[seed % populatedBiomes.length];
    const [bx, bz] = biomeToWorldXZ(biome, this.gridWidth, this.gridHeight);

    const offsetX = (hashPair(seed, 1) - 0.5) * CELL_SIZE * 0.8;
    const offsetZ = (hashPair(seed, 2) - 0.5) * CELL_SIZE * 0.8;

    return { x: bx + offsetX, z: bz + offsetZ };
  }

  private updateCreature(creature: CreatureInstance, delta: number, time: number): void {
    switch (creature.state) {
      case 'idle':
        this.updateIdle(creature, delta, time);
        break;
      case 'walking':
        this.updateWalking(creature, delta, time);
        break;
      case 'fleeing':
        this.updateWalking(creature, delta, time); // same movement, higher speed
        break;
      case 'chasing':
        this.updateChasing(creature, delta, time);
        break;
      case 'catching':
        this.updateCatching(creature, delta);
        break;
      case 'hidden':
        this.updateHidden(creature, delta);
        break;
    }

    // Update mesh position and rotation
    creature.mesh.position.copy(creature.position);
    creature.mesh.rotation.y = creature.facingAngle;

    // Gentle bob while moving
    if (
      creature.state === 'walking' ||
      creature.state === 'fleeing' ||
      creature.state === 'chasing'
    ) {
      creature.mesh.position.y += Math.sin(time * 6 + creature.facingAngle * 3) * 0.08;
    }

    // Gentle sway for producers
    if (creature.trophicLevel === 'producer') {
      creature.mesh.rotation.z = Math.sin(time * 1.5 + creature.position.x) * 0.06;
    }
  }

  private updateIdle(creature: CreatureInstance, delta: number, _time: number): void {
    creature.stateTimer -= delta;

    // Check for trophic interactions
    if (creature.trophicLevel === 'predator') {
      const prey = this.findNearbyCreature(creature, 'herbivore', PREDATOR_DETECT_RANGE);
      if (prey && prey.state !== 'hidden') {
        creature.state = 'chasing';
        creature.chaseTarget = prey;
        creature.stateTimer = CHASE_TIMEOUT;
        return;
      }
    }
    if (creature.trophicLevel === 'herbivore') {
      const predator = this.findNearbyCreature(creature, 'predator', HERBIVORE_FLEE_RANGE);
      if (predator && predator.state !== 'hidden') {
        this.startFleeing(creature, predator);
        return;
      }
    }

    if (creature.stateTimer <= 0) {
      const target = this.pickWanderTarget(creature);
      if (target) {
        creature.targetPosition.set(target.x, 0, target.z);
        creature.state = creature.trophicLevel === 'producer' ? 'walking' : 'walking';
        creature.stateTimer = 0;
      } else {
        creature.stateTimer = IDLE_MIN;
      }
    }
  }

  private updateWalking(creature: CreatureInstance, delta: number, _time: number): void {
    // Check for trophic interactions while walking
    if (creature.trophicLevel === 'predator') {
      const prey = this.findNearbyCreature(creature, 'herbivore', PREDATOR_DETECT_RANGE);
      if (prey && prey.state !== 'hidden') {
        creature.state = 'chasing';
        creature.chaseTarget = prey;
        creature.stateTimer = CHASE_TIMEOUT;
        return;
      }
    }
    if (creature.trophicLevel === 'herbivore') {
      const predator = this.findNearbyCreature(creature, 'predator', HERBIVORE_FLEE_RANGE);
      if (predator && predator.state !== 'hidden') {
        this.startFleeing(creature, predator);
        return;
      }
    }

    const speed = creature.state === 'fleeing' ? creature.speed * FLEE_SPEED_MULT : creature.speed;
    const arrived = this.moveToward(creature, creature.targetPosition, speed, delta);

    if (arrived || (creature.state === 'fleeing' && (creature.stateTimer -= delta) <= 0)) {
      creature.state = 'idle';
      creature.stateTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
    }
  }

  private updateChasing(creature: CreatureInstance, delta: number, _time: number): void {
    creature.stateTimer -= delta;
    const target = creature.chaseTarget;

    if (!target || target.state === 'hidden' || creature.stateTimer <= 0) {
      // Give up
      creature.state = 'idle';
      creature.chaseTarget = null;
      creature.stateTimer = IDLE_MIN;
      return;
    }

    // Chase the prey
    creature.targetPosition.copy(target.position);
    this.moveToward(creature, target.position, creature.speed * CHASE_SPEED_MULT, delta);

    const dist = creature.position.distanceTo(target.position);
    if (dist < CATCH_DISTANCE) {
      // Caught!
      creature.state = 'catching';
      creature.stateTimer = 1.5;
      creature.chaseTarget = null;

      // Hide the prey
      target.state = 'hidden';
      target.stateTimer = RESPAWN_DELAY;
      target.mesh.visible = false;
    }
  }

  private updateCatching(creature: CreatureInstance, delta: number): void {
    // Eating animation — just idle in place
    creature.stateTimer -= delta;
    if (creature.stateTimer <= 0) {
      creature.state = 'idle';
      creature.stateTimer = IDLE_MIN + Math.random() * IDLE_MAX;
    }
  }

  private updateHidden(creature: CreatureInstance, delta: number): void {
    creature.stateTimer -= delta;
    if (creature.stateTimer <= 0) {
      // Respawn at a random position
      const pos = this.pickRandomHabitablePosition();
      if (pos) {
        const wy = getHeightAtWorldXZ(pos.x, pos.z, this.biomes, this.gridWidth, this.gridHeight);
        creature.position.set(pos.x, wy, pos.z);
      }
      creature.mesh.visible = true;
      creature.state = 'idle';
      creature.stateTimer = IDLE_MIN;
    }
  }

  private startFleeing(creature: CreatureInstance, predator: CreatureInstance): void {
    // Flee away from the predator
    const dx = creature.position.x - predator.position.x;
    const dz = creature.position.z - predator.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const fleeX = creature.position.x + (dx / dist) * WANDER_RADIUS;
    const fleeZ = creature.position.z + (dz / dist) * WANDER_RADIUS;

    // Clamp to world bounds
    const bounds = getWorldBounds(this.gridWidth, this.gridHeight);
    const tx = Math.max(bounds.minX + 2, Math.min(bounds.maxX - 2, fleeX));
    const tz = Math.max(bounds.minZ + 2, Math.min(bounds.maxZ - 2, fleeZ));

    creature.targetPosition.set(tx, 0, tz);
    creature.state = 'fleeing';
    creature.stateTimer = 3;
  }

  private moveToward(
    creature: CreatureInstance,
    target: THREE.Vector3,
    speed: number,
    delta: number,
  ): boolean {
    const dx = target.x - creature.position.x;
    const dz = target.z - creature.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.5) return true;

    // Face direction
    creature.facingAngle = Math.atan2(dx, dz);

    // Move
    const step = Math.min(speed * delta, dist);
    creature.position.x += (dx / dist) * step;
    creature.position.z += (dz / dist) * step;

    // Follow terrain
    creature.position.y = getHeightAtWorldXZ(
      creature.position.x,
      creature.position.z,
      this.biomes,
      this.gridWidth,
      this.gridHeight,
    );

    return false;
  }

  private findNearbyCreature(
    creature: CreatureInstance,
    trophicLevel: TrophicLevel,
    range: number,
  ): CreatureInstance | null {
    let closest: CreatureInstance | null = null;
    let closestDist = range;

    for (const other of this.creatures) {
      if (other === creature || other.trophicLevel !== trophicLevel) continue;
      if (other.state === 'hidden') continue;

      const dist = creature.position.distanceTo(other.position);
      if (dist < closestDist) {
        closest = other;
        closestDist = dist;
      }
    }

    return closest;
  }

  private pickWanderTarget(creature: CreatureInstance): { x: number; z: number } | null {
    const bounds = getWorldBounds(this.gridWidth, this.gridHeight);

    for (let attempt = 0; attempt < MAX_WANDER_ATTEMPTS; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * WANDER_RADIUS;
      const tx = creature.position.x + Math.cos(angle) * dist;
      const tz = creature.position.z + Math.sin(angle) * dist;

      // Check bounds
      if (tx < bounds.minX + 1 || tx > bounds.maxX - 1) continue;
      if (tz < bounds.minZ + 1 || tz > bounds.maxZ - 1) continue;

      // Check habitable
      if (!isPositionHabitable(tx, tz, this.biomes, this.gridWidth, this.gridHeight)) continue;

      return { x: tx, z: tz };
    }

    return null;
  }

  private pickRandomHabitablePosition(): { x: number; z: number } | null {
    const bounds = getWorldBounds(this.gridWidth, this.gridHeight);

    for (let attempt = 0; attempt < MAX_WANDER_ATTEMPTS * 3; attempt++) {
      const tx = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      const tz = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

      if (isPositionHabitable(tx, tz, this.biomes, this.gridWidth, this.gridHeight)) {
        return { x: tx, z: tz };
      }
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

function disposeMeshGroup(group: THREE.Group): void {
  group.traverse((obj) => {
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
}
