/**
 * Babylon.js scene setup — engine, lighting, sky dome, terrain mesh management.
 * Camera is managed separately by camera.ts.
 */

import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Mesh,
  VertexData,
  MeshBuilder,
  PBRMaterial,
  ShaderMaterial,
  Effect,
  VertexBuffer,
} from '@babylonjs/core';
import type { TerrainData } from './terrain.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HORIZON_COLOUR = Color3.FromHexString('#87a5c0');
const ZENITH_COLOUR = Color3.FromHexString('#1a2a4a');
const FOG_DENSITY = 0.005;
const SHADOW_MAP_SIZE = 1024;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneContext {
  engine: Engine;
  scene: Scene;
  shadowGenerator: ShadowGenerator;
  terrainMesh: Mesh | null;
  waterMesh: Mesh | null;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// RGB→RGBA shim (terrain.ts outputs RGB, Babylon VertexData needs RGBA)
// ---------------------------------------------------------------------------

function rgbToRgba(rgb: Float32Array): Float32Array {
  const vertexCount = rgb.length / 3;
  const rgba = new Float32Array(vertexCount * 4);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    rgba[j] = rgb[i];
    rgba[j + 1] = rgb[i + 1];
    rgba[j + 2] = rgb[i + 2];
    rgba[j + 3] = 1;
  }
  return rgba;
}

// ---------------------------------------------------------------------------
// Sky dome
// ---------------------------------------------------------------------------

const SKY_VERTEX_SHADER = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  uniform mat4 worldViewProjection;
  uniform mat4 world;
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = world * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = worldViewProjection * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uCameraPosition;
  varying vec3 vWorldPosition;
  void main() {
    vec3 dir = normalize(vWorldPosition - uCameraPosition);
    float t = max(0.0, dir.y);
    float blend = smoothstep(0.0, 0.6, t);
    gl_FragColor = vec4(mix(uHorizon, uZenith, blend), 1.0);
  }
`;

function createSkyDome(scene: Scene): Mesh {
  // Register custom shader
  Effect.ShadersStore['skyVertexShader'] = SKY_VERTEX_SHADER;
  Effect.ShadersStore['skyFragmentShader'] = SKY_FRAGMENT_SHADER;

  const skyMaterial = new ShaderMaterial('skyMat', scene, 'sky', {
    attributes: ['position'],
    uniforms: ['worldViewProjection', 'world', 'uHorizon', 'uZenith', 'uCameraPosition'],
  });
  skyMaterial.setVector3(
    'uHorizon',
    new Vector3(HORIZON_COLOUR.r, HORIZON_COLOUR.g, HORIZON_COLOUR.b),
  );
  skyMaterial.setVector3('uZenith', new Vector3(ZENITH_COLOUR.r, ZENITH_COLOUR.g, ZENITH_COLOUR.b));
  skyMaterial.backFaceCulling = false;
  skyMaterial.disableDepthWrite = true;

  const skyMesh = MeshBuilder.CreateSphere('sky', { diameter: 800, segments: 32 }, scene);
  skyMesh.material = skyMaterial;
  skyMesh.isPickable = false;
  skyMesh.infiniteDistance = true;

  return skyMesh;
}

// ---------------------------------------------------------------------------
// Scene creation
// ---------------------------------------------------------------------------

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const engine = new Engine(canvas, true, { stencil: true });

  // Cap pixel ratio to 2x for mobile performance
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  engine.setHardwareScalingLevel(1 / pixelRatio);

  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(HORIZON_COLOUR.r, HORIZON_COLOUR.g, HORIZON_COLOUR.b, 1);

  // Fog
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = FOG_DENSITY;
  scene.fogColor = new Color3(HORIZON_COLOUR.r, HORIZON_COLOUR.g, HORIZON_COLOUR.b);

  // Sky dome
  const skyMesh = createSkyDome(scene);

  // Hemisphere light (combines ambient + sky/ground fill)
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.6;
  hemi.diffuse = Color3.FromHexString('#87ceeb');
  hemi.groundColor = Color3.FromHexString('#3d5c3a');

  // Warm directional sun with shadows
  const sun = new DirectionalLight('sun', new Vector3(-0.4, -0.6, -0.2).normalize(), scene);
  sun.intensity = 1.4;
  sun.diffuse = Color3.FromHexString('#ffeedd');
  sun.position = new Vector3(40, 60, 20);

  // Shadow generator
  const shadowGenerator = new ShadowGenerator(SHADOW_MAP_SIZE, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 8;
  shadowGenerator.bias = 0.001;

  // Update sky dome camera position each frame
  scene.registerBeforeRender(() => {
    const cam = scene.activeCamera;
    if (cam) {
      (skyMesh.material as ShaderMaterial).setVector3('uCameraPosition', cam.position);
    }
  });

  const ctx: SceneContext = {
    engine,
    scene,
    shadowGenerator,
    terrainMesh: null,
    waterMesh: null,
    dispose: () => {
      engine.dispose();
    },
  };

  return ctx;
}

// ---------------------------------------------------------------------------
// Terrain mesh
// ---------------------------------------------------------------------------

export function updateTerrainMesh(ctx: SceneContext, data: TerrainData): void {
  // Dispose old terrain
  if (ctx.terrainMesh) {
    ctx.shadowGenerator.removeShadowCaster(ctx.terrainMesh);
    ctx.terrainMesh.dispose(false, true);
  }
  if (ctx.waterMesh) {
    ctx.waterMesh.dispose(false, true);
  }

  // Build terrain mesh from TerrainData
  const terrainMesh = new Mesh('terrain', ctx.scene);

  const vertexData = new VertexData();
  vertexData.positions = data.positions;
  vertexData.colors = rgbToRgba(data.colours);
  vertexData.indices = data.indices;

  // Compute normals
  const normals = new Float32Array(data.positions.length);
  VertexData.ComputeNormals(
    data.positions as unknown as number[],
    data.indices as unknown as number[],
    normals as unknown as number[],
  );
  vertexData.normals = normals;
  vertexData.applyToMesh(terrainMesh, true); // updatable = true for sculpting

  // PBR material — vertex colours are auto-detected from mesh vertex buffer
  const terrainMaterial = new PBRMaterial('terrainMat', ctx.scene);
  terrainMaterial.albedoColor = new Color3(1, 1, 1); // tint multiplier — white preserves vertex colours
  terrainMaterial.roughness = 0.85;
  terrainMaterial.metallic = 0;
  terrainMaterial.backFaceCulling = false;
  terrainMesh.material = terrainMaterial;
  terrainMesh.receiveShadows = true;
  ctx.terrainMesh = terrainMesh;

  // Water plane
  const waterMesh = MeshBuilder.CreateGround(
    'water',
    { width: data.worldWidth + 20, height: data.worldDepth + 20 },
    ctx.scene,
  );
  waterMesh.position.y = -0.1;

  const waterMaterial = new PBRMaterial('waterMat', ctx.scene);
  waterMaterial.albedoColor = Color3.FromHexString('#1a6b8a');
  waterMaterial.alpha = 0.65;
  waterMaterial.roughness = 0.3;
  waterMaterial.metallic = 0.1;
  waterMesh.material = waterMaterial;
  waterMesh.receiveShadows = true;
  waterMesh.isPickable = false;
  ctx.waterMesh = waterMesh;
}

/**
 * Update terrain vertex data in-place (for sculpting — avoids full mesh rebuild).
 */
export function updateTerrainVertices(ctx: SceneContext, data: TerrainData): void {
  if (!ctx.terrainMesh) {
    updateTerrainMesh(ctx, data);
    return;
  }

  ctx.terrainMesh.updateVerticesData(VertexBuffer.PositionKind, data.positions);
  ctx.terrainMesh.updateVerticesData(VertexBuffer.ColorKind, rgbToRgba(data.colours));

  const normals = new Float32Array(data.positions.length);
  VertexData.ComputeNormals(
    data.positions as unknown as number[],
    data.indices as unknown as number[],
    normals as unknown as number[],
  );
  ctx.terrainMesh.updateVerticesData(VertexBuffer.NormalKind, normals);
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

export function resizeRenderer(ctx: SceneContext): void {
  ctx.engine.resize();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export function renderFrame(ctx: SceneContext): void {
  ctx.scene.render();
}
