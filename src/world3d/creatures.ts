/**
 * Cute procedural creatures with trophic behaviour AI.
 * Representative creatures (3–8 per species) that wander, chase, flee.
 * All behaviour is cosmetic — the engine drives actual population dynamics.
 */

import {
  TransformNode,
  MeshBuilder,
  ShaderMaterial,
  Effect,
  Color3,
  Vector3,
  Mesh,
} from '@babylonjs/core';
import type { Scene, ShadowGenerator, AbstractMesh } from '@babylonjs/core';
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
// Toon shader
// ---------------------------------------------------------------------------

let toonShaderRegistered = false;

function ensureToonShader(): void {
  if (toonShaderRegistered) return;
  toonShaderRegistered = true;

  Effect.ShadersStore['toonVertexShader'] = /* glsl */ `
    precision highp float;
    attribute vec3 position;
    attribute vec3 normal;
    uniform mat4 worldViewProjection;
    uniform mat4 world;
    varying vec3 vNormalW;
    varying vec3 vPositionW;
    void main() {
      vec4 worldPos = world * vec4(position, 1.0);
      vPositionW = worldPos.xyz;
      vNormalW = normalize((world * vec4(normal, 0.0)).xyz);
      gl_Position = worldViewProjection * vec4(position, 1.0);
    }
  `;

  Effect.ShadersStore['toonFragmentShader'] = /* glsl */ `
    precision highp float;
    uniform vec3 uColor;
    uniform vec3 uLightDir;
    varying vec3 vNormalW;
    varying vec3 vPositionW;
    void main() {
      vec3 n = normalize(vNormalW);
      float NdotL = max(dot(n, uLightDir), 0.0);
      float toon = floor(NdotL * 3.0 + 0.5) / 3.0;
      vec3 finalColor = uColor * (0.35 + 0.65 * toon);
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;
}

// ---------------------------------------------------------------------------
// HSL to Color3 utility
// ---------------------------------------------------------------------------

/**
 * Convert HSL colour to Babylon Color3.
 * @param h hue in degrees (0–360)
 * @param s saturation (0–1)
 * @param l lightness (0–1)
 */
function hslToColor3(h: number, s: number, l: number): Color3 {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;

  let r: number, g: number, b: number;
  if (hp < 1) {
    r = c;
    g = x;
    b = 0;
  } else if (hp < 2) {
    r = x;
    g = c;
    b = 0;
  } else if (hp < 3) {
    r = 0;
    g = c;
    b = x;
  } else if (hp < 4) {
    r = 0;
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return new Color3(r + m, g + m, b + m);
}

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

function computeColour(species: Species): Color3 {
  const traits = expressTraits(species.genome);
  const baseHue = TROPHIC_HUE[species.trophicLevel];
  const hueShift = (traits.heatTolerance - traits.coldTolerance) * 15;
  const speciesHueOffset = (hashString(species.id) % 30) - 15;
  const hue = (((baseHue + hueShift + speciesHueOffset) % 360) + 360) % 360;
  const saturation = 0.5 + Math.min(0.4, traits.metabolism * 0.2);
  const lightness = 0.4 + Math.min(0.2, traits.size * 0.08);
  return hslToColor3(hue, saturation, lightness);
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
// Toon material creation
// ---------------------------------------------------------------------------

function createToonMaterial(name: string, colour: Color3, scene: Scene): ShaderMaterial {
  ensureToonShader();
  const mat = new ShaderMaterial(name, scene, 'toon', {
    attributes: ['position', 'normal'],
    uniforms: ['worldViewProjection', 'world', 'uColor', 'uLightDir'],
  });
  mat.setVector3('uColor', new Vector3(colour.r, colour.g, colour.b));
  // Light direction normalised — matches sun direction in scene.ts
  mat.setVector3('uLightDir', new Vector3(0.4, 0.6, 0.2).normalize());
  mat.backFaceCulling = true;
  return mat;
}

// ---------------------------------------------------------------------------
// Cute creature mesh builder
// ---------------------------------------------------------------------------

function buildCreatureMesh(
  species: Species,
  scene: Scene,
  shadowGenerator: ShadowGenerator,
): TransformNode {
  const colour = computeColour(species);
  const scale = computeScale(species);
  const traits = expressTraits(species.genome);
  const root = new TransformNode('creature_' + species.id, scene);

  const bodyMat = createToonMaterial('body_' + species.id, colour, scene);
  const eyeWhiteMat = createToonMaterial('eyeW_' + species.id, new Color3(1, 1, 1), scene);
  const pupilMat = createToonMaterial(
    'pupil_' + species.id,
    new Color3(0.067, 0.067, 0.067),
    scene,
  );

  // Helper to create a sphere mesh parented to root
  const makeSphere = (
    name: string,
    diameter: number,
    mat: ShaderMaterial,
    pos: Vector3,
    scaleXYZ?: Vector3,
  ): Mesh => {
    const m = MeshBuilder.CreateSphere(name, { diameter, segments: 10 }, scene);
    m.material = mat;
    m.position = pos;
    if (scaleXYZ) m.scaling = scaleXYZ;
    m.parent = root;
    m.metadata = { speciesId: species.id, pickable: true };
    shadowGenerator.addShadowCaster(m);
    return m;
  };

  // Helper to create a cylinder mesh parented to root
  const makeCylinder = (
    name: string,
    diameterTop: number,
    diameterBottom: number,
    height: number,
    mat: ShaderMaterial,
    pos: Vector3,
  ): Mesh => {
    const m = MeshBuilder.CreateCylinder(
      name,
      { diameterTop, diameterBottom, height, tessellation: 8 },
      scene,
    );
    m.material = mat;
    m.position = pos;
    m.parent = root;
    m.metadata = { speciesId: species.id, pickable: true };
    shadowGenerator.addShadowCaster(m);
    return m;
  };

  if (species.trophicLevel === 'producer') {
    // Mushroom-like: short stalk + round cap
    makeCylinder(
      'stalk',
      0.3 * scale,
      0.4 * scale,
      0.6 * scale,
      bodyMat,
      new Vector3(0, 0.3 * scale, 0),
    );
    makeSphere('cap', 0.9 * scale, bodyMat, new Vector3(0, 0.7 * scale, 0), new Vector3(1, 0.6, 1));

    // Eyes on the cap
    const eyeOffset = 0.18 * scale;
    const eyeY = 0.65 * scale;
    const eyeZ = 0.3 * scale;
    for (const side of [-1, 1]) {
      makeSphere('eyeW', 0.16 * scale, eyeWhiteMat, new Vector3(side * eyeOffset, eyeY, eyeZ));
      makeSphere(
        'pupil',
        0.08 * scale,
        pupilMat,
        new Vector3(side * eyeOffset, eyeY, eyeZ + 0.05 * scale),
      );
    }
  } else if (species.trophicLevel === 'herbivore') {
    // Chubby round body + large head
    const stretch = 0.8 + traits.speed * 0.15;
    makeSphere(
      'body',
      0.8 * scale,
      bodyMat,
      new Vector3(0, 0.4 * scale, 0),
      new Vector3(0.9, 0.85, stretch),
    );
    makeSphere('head', 0.64 * scale, bodyMat, new Vector3(0, 0.75 * scale, 0.25 * scale * stretch));

    // Eyes
    const eyeOffset = 0.12 * scale;
    const eyeY = 0.78 * scale;
    const eyeZ = 0.25 * scale * stretch + 0.2 * scale;
    for (const side of [-1, 1]) {
      makeSphere('eyeW', 0.18 * scale, eyeWhiteMat, new Vector3(side * eyeOffset, eyeY, eyeZ));
      makeSphere(
        'pupil',
        0.09 * scale,
        pupilMat,
        new Vector3(side * eyeOffset, eyeY, eyeZ + 0.06 * scale),
      );
    }
  } else {
    // Predator: sleek body, forward-leaning head
    const stretch = 0.9 + traits.speed * 0.2;
    makeSphere(
      'body',
      0.7 * scale,
      bodyMat,
      new Vector3(0, 0.4 * scale, 0),
      new Vector3(0.75, 0.8, stretch),
    );
    makeSphere(
      'head',
      0.5 * scale,
      bodyMat,
      new Vector3(0, 0.6 * scale, 0.35 * scale * stretch),
      new Vector3(0.9, 0.85, 1.1),
    );

    // Eyes — slightly narrower
    const eyeOffset = 0.1 * scale;
    const eyeY = 0.63 * scale;
    const eyeZ = 0.35 * scale * stretch + 0.18 * scale;
    for (const side of [-1, 1]) {
      makeSphere('eyeW', 0.14 * scale, eyeWhiteMat, new Vector3(side * eyeOffset, eyeY, eyeZ));
      makeSphere(
        'pupil',
        0.08 * scale,
        pupilMat,
        new Vector3(side * eyeOffset, eyeY, eyeZ + 0.05 * scale),
      );
    }
  }

  return root;
}

// ---------------------------------------------------------------------------
// Creature instance state
// ---------------------------------------------------------------------------

type CreatureState = 'idle' | 'walking' | 'fleeing' | 'chasing' | 'catching' | 'hidden';

export interface CreatureInstance {
  speciesId: string;
  trophicLevel: TrophicLevel;
  mesh: TransformNode;
  position: Vector3;
  targetPosition: Vector3;
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
  private scene: Scene;
  private shadowGenerator: ShadowGenerator;
  private biomes: Biome[] = [];
  private gridWidth = 0;
  private gridHeight = 0;

  constructor(scene: Scene, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
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
      this.disposeCreatureMesh(c.mesh);
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
        }
      }
    }
  }

  /**
   * Resolve a hit mesh to its owning creature's species ID.
   * Uses mesh.metadata for direct lookup.
   */
  getSpeciesIdByMesh(hitMesh: AbstractMesh): string | null {
    const meta = hitMesh.metadata as { speciesId?: string } | null;
    if (meta?.speciesId) return meta.speciesId;

    // Walk up parent chain as fallback
    let current: TransformNode | null = hitMesh.parent as TransformNode | null;
    while (current) {
      const parentMeta = current.metadata as { speciesId?: string } | null;
      if (parentMeta?.speciesId) return parentMeta.speciesId;
      current = current.parent as TransformNode | null;
    }
    return null;
  }

  /** Get all creature root nodes for raycasting. */
  getAllMeshGroups(): TransformNode[] {
    return this.creatures.filter((c) => c.mesh.isEnabled()).map((c) => c.mesh);
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

  private disposeCreatureMesh(node: TransformNode): void {
    const children = node.getChildMeshes();
    for (const child of children) {
      this.shadowGenerator.removeShadowCaster(child);
      child.dispose(false, true);
    }
    node.dispose();
  }

  private computeRepCount(species: Species): number {
    let totalPop = 0;
    for (const pop of Object.values(species.populationByBiome)) {
      totalPop += pop;
    }
    if (totalPop <= 0) return 0;
    return Math.min(8, Math.max(3, Math.floor(Math.log10(totalPop + 1))));
  }

  private spawnCreature(species: Species, index: number): CreatureInstance | null {
    const mesh = buildCreatureMesh(species, this.scene, this.shadowGenerator);
    const pos = this.pickSpawnPosition(species, index);
    if (!pos) {
      this.disposeCreatureMesh(mesh);
      return null;
    }

    const wy = getHeightAtWorldXZ(pos.x, pos.z, this.biomes, this.gridWidth, this.gridHeight);
    mesh.position = new Vector3(pos.x, wy, pos.z);

    return {
      speciesId: species.id,
      trophicLevel: species.trophicLevel,
      mesh,
      position: new Vector3(pos.x, wy, pos.z),
      targetPosition: new Vector3(pos.x, wy, pos.z),
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
    creature.mesh.position.copyFrom(creature.position);
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
        creature.state = 'walking';
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
      creature.state = 'idle';
      creature.chaseTarget = null;
      creature.stateTimer = IDLE_MIN;
      return;
    }

    // Chase the prey
    creature.targetPosition.copyFrom(target.position);
    this.moveToward(creature, target.position, creature.speed * CHASE_SPEED_MULT, delta);

    const dist = Vector3.Distance(creature.position, target.position);
    if (dist < CATCH_DISTANCE) {
      creature.state = 'catching';
      creature.stateTimer = 1.5;
      creature.chaseTarget = null;

      // Hide the prey
      target.state = 'hidden';
      target.stateTimer = RESPAWN_DELAY;
      target.mesh.setEnabled(false);
    }
  }

  private updateCatching(creature: CreatureInstance, delta: number): void {
    creature.stateTimer -= delta;
    if (creature.stateTimer <= 0) {
      creature.state = 'idle';
      creature.stateTimer = IDLE_MIN + Math.random() * IDLE_MAX;
    }
  }

  private updateHidden(creature: CreatureInstance, delta: number): void {
    creature.stateTimer -= delta;
    if (creature.stateTimer <= 0) {
      const pos = this.pickRandomHabitablePosition();
      if (pos) {
        const wy = getHeightAtWorldXZ(pos.x, pos.z, this.biomes, this.gridWidth, this.gridHeight);
        creature.position.set(pos.x, wy, pos.z);
      }
      creature.mesh.setEnabled(true);
      creature.state = 'idle';
      creature.stateTimer = IDLE_MIN;
    }
  }

  private startFleeing(creature: CreatureInstance, predator: CreatureInstance): void {
    const dx = creature.position.x - predator.position.x;
    const dz = creature.position.z - predator.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const bounds = getWorldBounds(this.gridWidth, this.gridHeight);

    for (let scale = 1.0; scale >= 0.3; scale -= 0.2) {
      const fleeX = creature.position.x + (dx / dist) * WANDER_RADIUS * scale;
      const fleeZ = creature.position.z + (dz / dist) * WANDER_RADIUS * scale;
      const tx = Math.max(bounds.minX + 2, Math.min(bounds.maxX - 2, fleeX));
      const tz = Math.max(bounds.minZ + 2, Math.min(bounds.maxZ - 2, fleeZ));

      if (isPositionHabitable(tx, tz, this.biomes, this.gridWidth, this.gridHeight)) {
        creature.targetPosition.set(tx, 0, tz);
        creature.state = 'fleeing';
        creature.stateTimer = 3;
        return;
      }
    }

    creature.state = 'idle';
    creature.stateTimer = IDLE_MIN;
  }

  private moveToward(
    creature: CreatureInstance,
    target: Vector3,
    speed: number,
    delta: number,
  ): boolean {
    const dx = target.x - creature.position.x;
    const dz = target.z - creature.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.5) return true;

    creature.facingAngle = Math.atan2(dx, dz);

    const step = Math.min(speed * delta, dist);
    const nextX = creature.position.x + (dx / dist) * step;
    const nextZ = creature.position.z + (dz / dist) * step;

    if (!isPositionHabitable(nextX, nextZ, this.biomes, this.gridWidth, this.gridHeight)) {
      return true;
    }

    creature.position.x = nextX;
    creature.position.z = nextZ;

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

      const dist = Vector3.Distance(creature.position, other.position);
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

      if (tx < bounds.minX + 1 || tx > bounds.maxX - 1) continue;
      if (tz < bounds.minZ + 1 || tz > bounds.maxZ - 1) continue;

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
