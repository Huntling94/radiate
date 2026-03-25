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
import type { SpeciesCluster, TrophicLevel, Biome } from '../engine/index.ts';
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
// Creature appearance — trait-to-morphology mapping (BRF-017)
// ---------------------------------------------------------------------------

function computeColour(species: SpeciesCluster, hueJitter = 0): Color3 {
  const traits = expressTraits(species.genome);
  const baseHue = TROPHIC_HUE[species.trophicLevel];
  const hueShift = (traits.heatTolerance - traits.coldTolerance) * 15;
  const speciesHueOffset = (hashString(species.id) % 30) - 15;
  const hue = (((baseHue + hueShift + speciesHueOffset + hueJitter) % 360) + 360) % 360;
  const saturation = 0.5 + Math.min(0.4, traits.metabolism * 0.2);
  const lightness = 0.4 + Math.min(0.2, traits.size * 0.08);
  return hslToColor3(hue, saturation, lightness);
}

function computeScale(species: SpeciesCluster): number {
  const traits = expressTraits(species.genome);
  return 0.4 + traits.size * 0.4;
}

function computeSpeed(species: SpeciesCluster): number {
  const traits = expressTraits(species.genome);
  return BASE_MOVE_SPEED * (0.5 + traits.speed * 0.5);
}

/** Allometric head scaling: small creatures get proportionally larger heads. */
function computeHeadRatio(size: number): number {
  return Math.max(0.5, Math.min(0.65, 0.7 - size * 0.1));
}

/** Speed-driven body aspect: fast = narrow+long, slow = round. */
function computeBodyAspect(speed: number): { xScale: number; zScale: number } {
  return {
    xScale: Math.max(0.6, 1.0 - speed * 0.1),
    zScale: 0.8 + speed * 0.2,
  };
}

/** Metabolism-driven pupil expression. */
function computePupilScale(
  metabolism: number,
  baseSize: number,
): { size: number; yOffset: number } {
  if (metabolism > 1.2) {
    // Alert: large pupils
    return { size: baseSize * (1.0 + (metabolism - 1.2) * 0.4), yOffset: 0 };
  }
  if (metabolism < 0.5) {
    // Sleepy: small droopy pupils
    return { size: baseSize * 0.7, yOffset: -0.02 };
  }
  return { size: baseSize, yOffset: 0 };
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
  mat.setVector3('uLightDir', new Vector3(0.4, 0.6, 0.2).normalize());
  mat.backFaceCulling = true;
  return mat;
}

// ---------------------------------------------------------------------------
// Mesh builder context (shared helpers for all trophic builders)
// ---------------------------------------------------------------------------

interface MeshCtx {
  root: TransformNode;
  scene: Scene;
  shadowGenerator: ShadowGenerator;
  speciesId: string;
  bodyMat: ShaderMaterial;
  eyeWhiteMat: ShaderMaterial;
  pupilMat: ShaderMaterial;
}

function makeSphere(
  ctx: MeshCtx,
  name: string,
  diameter: number,
  mat: ShaderMaterial,
  pos: Vector3,
  scaleXYZ?: Vector3,
): Mesh {
  const m = MeshBuilder.CreateSphere(name, { diameter, segments: 10 }, ctx.scene);
  m.material = mat;
  m.position = pos;
  if (scaleXYZ) m.scaling = scaleXYZ;
  m.parent = ctx.root;
  m.metadata = { speciesId: ctx.speciesId, pickable: true };
  ctx.shadowGenerator.addShadowCaster(m);
  return m;
}

function makeCylinder(
  ctx: MeshCtx,
  name: string,
  diameterTop: number,
  diameterBottom: number,
  height: number,
  mat: ShaderMaterial,
  pos: Vector3,
): Mesh {
  const m = MeshBuilder.CreateCylinder(
    name,
    { diameterTop, diameterBottom, height, tessellation: 8 },
    ctx.scene,
  );
  m.material = mat;
  m.position = pos;
  m.parent = ctx.root;
  m.metadata = { speciesId: ctx.speciesId, pickable: true };
  ctx.shadowGenerator.addShadowCaster(m);
  return m;
}

function makeTorus(
  ctx: MeshCtx,
  name: string,
  diameter: number,
  thickness: number,
  mat: ShaderMaterial,
  pos: Vector3,
): Mesh {
  const m = MeshBuilder.CreateTorus(name, { diameter, thickness, tessellation: 16 }, ctx.scene);
  m.material = mat;
  m.position = pos;
  m.parent = ctx.root;
  m.metadata = { speciesId: ctx.speciesId, pickable: true };
  ctx.shadowGenerator.addShadowCaster(m);
  return m;
}

// ---------------------------------------------------------------------------
// Appendage builders (BRF-017 Phase B)
// ---------------------------------------------------------------------------

/** 4 leg nubs under the body. Speed > 0.8 for mobile creatures. */
function addLegs(
  ctx: MeshCtx,
  s: number,
  speed: number,
  _bodyY: number,
  bodyZOffset: number,
): void {
  const legHeight = 0.15 * s * (0.5 + speed * 0.3);
  const legDiam = 0.08 * s + 0.02 * s;
  const legSpreadX = 0.15 * s;
  const legSpreadZ = 0.12 * s + bodyZOffset * 0.3;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      makeCylinder(
        ctx,
        'leg',
        legDiam,
        legDiam * 1.1,
        legHeight,
        ctx.bodyMat,
        new Vector3(sx * legSpreadX, legHeight * 0.5, sz * legSpreadZ),
      );
    }
  }
}

/** Cold-tolerance mane (torus around neck). coldTolerance > 0.6. */
function addMane(ctx: MeshCtx, s: number, coldTol: number, neckY: number): void {
  const thickness = 0.06 * s * (1 + (coldTol - 0.6) * 2);
  const diameter = 0.35 * s;
  makeTorus(ctx, 'mane', diameter, thickness, ctx.bodyMat, new Vector3(0, neckY, 0));
}

/** Heat-tolerance ear plates. heatTolerance > 0.6. */
function addEarPlates(
  ctx: MeshCtx,
  s: number,
  heatTol: number,
  headY: number,
  headZ: number,
): void {
  const earSize = 0.12 * s * (1 + (heatTol - 0.6) * 1.5);
  for (const side of [-1, 1]) {
    makeSphere(
      ctx,
      'ear',
      earSize,
      ctx.bodyMat,
      new Vector3(side * 0.18 * s, headY + 0.05 * s, headZ),
      new Vector3(0.3, 0.7, 0.15),
    );
  }
}

/** Predator dorsal crest. speed > 1.2. */
function addDorsalCrest(ctx: MeshCtx, s: number, bodyY: number): void {
  makeSphere(
    ctx,
    'crest',
    0.2 * s,
    ctx.bodyMat,
    new Vector3(0, bodyY + 0.2 * s, 0),
    new Vector3(0.15, 0.5, 0.6),
  );
}

/** Predator tail. speed > 1.5. */
function addTail(
  ctx: MeshCtx,
  s: number,
  speed: number,
  bodyY: number,
  bodyZStretch: number,
): void {
  const tailLen = 0.25 * s * (0.5 + speed * 0.3);
  makeCylinder(
    ctx,
    'tail',
    0.02 * s,
    0.05 * s,
    tailLen,
    ctx.bodyMat,
    new Vector3(0, bodyY, -0.2 * s * bodyZStretch - tailLen * 0.5),
  );
}

/** Herbivore horn nubs. size > 1.0. */
function addHorns(ctx: MeshCtx, s: number, headY: number, headZ: number): void {
  for (const side of [-1, 1]) {
    makeCylinder(
      ctx,
      'horn',
      0,
      0.04 * s,
      0.12 * s,
      ctx.bodyMat,
      new Vector3(side * 0.08 * s, headY + 0.12 * s, headZ - 0.02 * s),
    );
  }
}

// ---------------------------------------------------------------------------
// Trophic-specific mesh builders (BRF-017)
// ---------------------------------------------------------------------------

import type { Traits } from '../engine/index.ts';

function buildProducerMesh(ctx: MeshCtx, traits: Traits, s: number): void {
  // Producer shape variants based on traits
  const isHotAdapted = traits.heatTolerance > 0.7;
  const isColdAdapted = traits.coldTolerance > 0.7;
  const isSmall = traits.size < 0.5;
  const isTall = traits.size > 1.2;

  if (isHotAdapted) {
    // Cactus: thick stalk, tiny cap
    makeCylinder(ctx, 'stalk', 0.35 * s, 0.4 * s, 0.8 * s, ctx.bodyMat, new Vector3(0, 0.4 * s, 0));
    makeSphere(ctx, 'cap', 0.3 * s, ctx.bodyMat, new Vector3(0, 0.85 * s, 0));
  } else if (isColdAdapted) {
    // Conifer: cone-shaped cap on stalk
    makeCylinder(ctx, 'stalk', 0.2 * s, 0.3 * s, 0.4 * s, ctx.bodyMat, new Vector3(0, 0.2 * s, 0));
    makeCylinder(ctx, 'cap', 0, 0.5 * s, 0.7 * s, ctx.bodyMat, new Vector3(0, 0.75 * s, 0));
  } else if (isSmall) {
    // Low bush: wide flat cap, short stalk
    makeCylinder(
      ctx,
      'stalk',
      0.2 * s,
      0.25 * s,
      0.3 * s,
      ctx.bodyMat,
      new Vector3(0, 0.15 * s, 0),
    );
    makeSphere(
      ctx,
      'cap',
      0.9 * s,
      ctx.bodyMat,
      new Vector3(0, 0.45 * s, 0),
      new Vector3(1.2, 0.4, 1.2),
    );
  } else if (isTall) {
    // Tall tree: narrow cap, tall stalk
    makeCylinder(
      ctx,
      'stalk',
      0.15 * s,
      0.25 * s,
      1.0 * s,
      ctx.bodyMat,
      new Vector3(0, 0.5 * s, 0),
    );
    makeSphere(
      ctx,
      'cap',
      0.6 * s,
      ctx.bodyMat,
      new Vector3(0, 1.1 * s, 0),
      new Vector3(0.8, 0.7, 0.8),
    );
  } else {
    // Default mushroom
    makeCylinder(ctx, 'stalk', 0.3 * s, 0.4 * s, 0.6 * s, ctx.bodyMat, new Vector3(0, 0.3 * s, 0));
    makeSphere(
      ctx,
      'cap',
      0.9 * s,
      ctx.bodyMat,
      new Vector3(0, 0.7 * s, 0),
      new Vector3(1, 0.6, 1),
    );
  }

  // Eyes on the body (slightly adjusted per variant)
  const eyeY = isSmall ? 0.4 * s : isTall ? 1.0 * s : isColdAdapted ? 0.5 * s : 0.65 * s;
  const eyeZ = 0.25 * s;
  const eyeOffset = 0.16 * s;
  const pupil = computePupilScale(traits.metabolism, 0.08 * s);

  for (const side of [-1, 1]) {
    makeSphere(ctx, 'eyeW', 0.14 * s, ctx.eyeWhiteMat, new Vector3(side * eyeOffset, eyeY, eyeZ));
    makeSphere(
      ctx,
      'pupil',
      pupil.size,
      ctx.pupilMat,
      new Vector3(side * eyeOffset, eyeY + pupil.yOffset * s, eyeZ + 0.04 * s),
    );
  }
}

function buildHerbivoreMesh(ctx: MeshCtx, traits: Traits, s: number): void {
  const aspect = computeBodyAspect(traits.speed);
  const headRatio = computeHeadRatio(traits.size);
  // Trophic posture: herbivores lean back slightly
  const postureZ = -0.03 * s;

  // Body — chubby, with speed-driven aspect ratio
  const bodyY = 0.4 * s;
  makeSphere(
    ctx,
    'body',
    0.8 * s,
    ctx.bodyMat,
    new Vector3(0, bodyY, postureZ),
    new Vector3(aspect.xScale * 0.9, 0.85, aspect.zScale),
  );

  // Head — allometric: smaller heads on larger creatures
  const headDiam = 0.8 * s * headRatio;
  const headY = 0.75 * s;
  const headZ = 0.25 * s * aspect.zScale + postureZ;
  makeSphere(ctx, 'head', headDiam, ctx.bodyMat, new Vector3(0, headY, headZ));

  // Eyes — wide apart (prey: wide field of view)
  const eyeSpacing = 0.15 * s; // wider than predator
  const eyeY = headY + 0.03 * s;
  const eyeZ2 = headZ + headDiam * 0.35;
  const pupil = computePupilScale(traits.metabolism, 0.09 * s);
  for (const side of [-1, 1]) {
    makeSphere(ctx, 'eyeW', 0.18 * s, ctx.eyeWhiteMat, new Vector3(side * eyeSpacing, eyeY, eyeZ2));
    makeSphere(
      ctx,
      'pupil',
      pupil.size,
      ctx.pupilMat,
      new Vector3(side * eyeSpacing, eyeY + pupil.yOffset * s, eyeZ2 + 0.06 * s),
    );
  }

  // Conditional appendages
  if (traits.speed > 0.8) addLegs(ctx, s, traits.speed, bodyY, postureZ);
  if (traits.coldTolerance > 0.6) addMane(ctx, s, traits.coldTolerance, headY - 0.1 * s);
  if (traits.heatTolerance > 0.6) addEarPlates(ctx, s, traits.heatTolerance, headY, headZ);
  if (traits.size > 1.0) addHorns(ctx, s, headY, headZ);
}

function buildPredatorMesh(ctx: MeshCtx, traits: Traits, s: number): void {
  const aspect = computeBodyAspect(traits.speed);
  const headRatio = computeHeadRatio(traits.size);
  // Trophic posture: predators lean forward aggressively
  const postureZ = 0.05 * s;

  // Body — sleek, with more aggressive speed stretching
  const bodyY = 0.4 * s;
  makeSphere(
    ctx,
    'body',
    0.7 * s,
    ctx.bodyMat,
    new Vector3(0, bodyY, postureZ),
    new Vector3(aspect.xScale * 0.75, 0.8, aspect.zScale * 1.1),
  );

  // Head — allometric + forward-pointing
  const headDiam = 0.7 * s * headRatio;
  const headY = 0.6 * s;
  const headZ = 0.35 * s * aspect.zScale + postureZ;
  makeSphere(
    ctx,
    'head',
    headDiam,
    ctx.bodyMat,
    new Vector3(0, headY, headZ),
    new Vector3(0.9, 0.85, 1.1),
  );

  // Eyes — close together and forward (predator: depth perception)
  const eyeSpacing = 0.08 * s; // narrower than herbivore
  const eyeY = headY + 0.03 * s;
  const eyeZ2 = headZ + headDiam * 0.4;
  const pupil = computePupilScale(traits.metabolism, 0.08 * s);
  for (const side of [-1, 1]) {
    makeSphere(ctx, 'eyeW', 0.14 * s, ctx.eyeWhiteMat, new Vector3(side * eyeSpacing, eyeY, eyeZ2));
    makeSphere(
      ctx,
      'pupil',
      pupil.size,
      ctx.pupilMat,
      new Vector3(side * eyeSpacing, eyeY + pupil.yOffset * s, eyeZ2 + 0.05 * s),
    );
  }

  // Conditional appendages
  if (traits.speed > 0.8) addLegs(ctx, s, traits.speed, bodyY, postureZ);
  if (traits.coldTolerance > 0.6) addMane(ctx, s, traits.coldTolerance, headY - 0.05 * s);
  if (traits.heatTolerance > 0.6) addEarPlates(ctx, s, traits.heatTolerance, headY, headZ);
  if (traits.speed > 1.2) addDorsalCrest(ctx, s, bodyY);
  if (traits.speed > 1.5) addTail(ctx, s, traits.speed, bodyY, aspect.zScale);
}

// ---------------------------------------------------------------------------
// Top-level creature mesh builder (BRF-017)
// ---------------------------------------------------------------------------

function buildCreatureMesh(
  species: SpeciesCluster,
  scene: Scene,
  shadowGenerator: ShadowGenerator,
  individualIndex = 0,
): TransformNode {
  // Per-individual variation (Phase C)
  const jitter = hashString(species.id + String(individualIndex));
  const scaleJitter = 1.0 + ((jitter % 100) / 100 - 0.5) * 0.1; // ±5%
  const hueJitter = ((jitter % 60) - 30) / 10; // ±3°

  const colour = computeColour(species, hueJitter);
  const scale = computeScale(species) * scaleJitter;
  const traits = expressTraits(species.genome);
  const root = new TransformNode('creature_' + species.id, scene);

  const bodyMat = createToonMaterial(
    'body_' + species.id + '_' + String(individualIndex),
    colour,
    scene,
  );
  const eyeWhiteMat = createToonMaterial(
    'eyeW_' + species.id + '_' + String(individualIndex),
    new Color3(1, 1, 1),
    scene,
  );
  const pupilMat = createToonMaterial(
    'pupil_' + species.id + '_' + String(individualIndex),
    new Color3(0.067, 0.067, 0.067),
    scene,
  );

  const ctx: MeshCtx = {
    root,
    scene,
    shadowGenerator,
    speciesId: species.id,
    bodyMat,
    eyeWhiteMat,
    pupilMat,
  };

  if (species.trophicLevel === 'producer') {
    buildProducerMesh(ctx, traits, scale);
  } else if (species.trophicLevel === 'herbivore') {
    buildHerbivoreMesh(ctx, traits, scale);
  } else {
    buildPredatorMesh(ctx, traits, scale);
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
  syncSpecies(
    species: readonly SpeciesCluster[],
    biomes: Biome[],
    gridWidth: number,
    gridHeight: number,
  ): void {
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

  private computeRepCount(species: SpeciesCluster): number {
    let totalPop = 0;
    for (const pop of Object.values(species.populationByBiome)) {
      totalPop += pop;
    }
    if (totalPop <= 0) return 0;
    return Math.min(8, Math.max(3, Math.floor(Math.log10(totalPop + 1))));
  }

  private spawnCreature(species: SpeciesCluster, index: number): CreatureInstance | null {
    const mesh = buildCreatureMesh(species, this.scene, this.shadowGenerator, index);
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

  private pickSpawnPosition(
    species: SpeciesCluster,
    index: number,
  ): { x: number; z: number } | null {
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

    // Breathing animation — subtle Y oscillation, speed from metabolism (BRF-017)
    const breathRate = 2 + (creature.speed / BASE_MOVE_SPEED) * 2;
    const breathAmp = 0.025;
    creature.mesh.position.y += Math.sin(time * breathRate + creature.facingAngle) * breathAmp;

    // Gentle sway for producers
    if (creature.trophicLevel === 'producer') {
      creature.mesh.rotation.z = Math.sin(time * 1.5 + creature.position.x) * 0.06;
    }

    // Herbivore idle: periodic "look around" (BRF-017)
    if (creature.trophicLevel === 'herbivore' && creature.state === 'idle') {
      creature.mesh.rotation.y += Math.sin(time * 0.8 + creature.position.z * 2) * 0.3;
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
