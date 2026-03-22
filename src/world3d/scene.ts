/**
 * Three.js scene setup — lighting, renderer, sky dome, terrain mesh management.
 * Camera is managed separately by camera.ts.
 */

import * as THREE from 'three';
import type { TerrainData } from './terrain.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HORIZON_COLOUR = 0x87a5c0;
const ZENITH_COLOUR = 0x1a2a4a;
const FOG_DENSITY = 0.005;
const SHADOW_MAP_SIZE = 1024;
const SHADOW_FRUSTUM = 80;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  terrainMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Sky dome
// ---------------------------------------------------------------------------

const SKY_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  varying vec3 vWorldPosition;
  void main() {
    vec3 dir = normalize(vWorldPosition - cameraPosition);
    float t = max(0.0, dir.y);
    // Smooth blend from horizon to zenith
    float blend = smoothstep(0.0, 0.6, t);
    gl_FragColor = vec4(mix(uHorizon, uZenith, blend), 1.0);
  }
`;

function createSkyDome(scene: THREE.Scene): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(400, 32, 16);
  const horizonColour = new THREE.Color(HORIZON_COLOUR);
  const zenithColour = new THREE.Color(ZENITH_COLOUR);

  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    uniforms: {
      uHorizon: { value: horizonColour },
      uZenith: { value: zenithColour },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Scene creation
// ---------------------------------------------------------------------------

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(HORIZON_COLOUR);

  // Shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(HORIZON_COLOUR, FOG_DENSITY);

  // Sky dome
  const skyMesh = createSkyDome(scene);

  // Warm sun with shadows
  const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
  sun.position.set(40, 60, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.camera.left = -SHADOW_FRUSTUM;
  sun.shadow.camera.right = SHADOW_FRUSTUM;
  sun.shadow.camera.top = SHADOW_FRUSTUM;
  sun.shadow.camera.bottom = -SHADOW_FRUSTUM;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambient);

  // Hemisphere light for natural sky/ground fill
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d5c3a, 0.3);
  scene.add(hemi);

  const ctx: SceneContext = {
    renderer,
    scene,
    terrainMesh: null,
    waterMesh: null,
    dispose: () => {
      renderer.dispose();
      skyMesh.geometry.dispose();
      (skyMesh.material as THREE.Material).dispose();
      scene.clear();
    },
  };

  return ctx;
}

// ---------------------------------------------------------------------------
// Terrain mesh
// ---------------------------------------------------------------------------

export function updateTerrainMesh(ctx: SceneContext, data: TerrainData): void {
  if (ctx.terrainMesh) {
    ctx.scene.remove(ctx.terrainMesh);
    ctx.terrainMesh.geometry.dispose();
    const mat = ctx.terrainMesh.material as THREE.Material;
    mat.dispose();
  }

  if (ctx.waterMesh) {
    ctx.scene.remove(ctx.waterMesh);
    ctx.waterMesh.geometry.dispose();
    const mat = ctx.waterMesh.material as THREE.Material;
    mat.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
  ctx.terrainMesh = mesh;

  // Water plane
  const waterGeometry = new THREE.PlaneGeometry(data.worldWidth + 20, data.worldDepth + 20);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a6b8a,
    transparent: true,
    opacity: 0.65,
    roughness: 0.3,
    metalness: 0.1,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = -0.1;
  water.receiveShadow = true;
  ctx.scene.add(water);
  ctx.waterMesh = water;
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

export function resizeRenderer(ctx: SceneContext, width: number, height: number): void {
  ctx.renderer.setSize(width, height, false);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export function renderFrame(ctx: SceneContext, camera: THREE.PerspectiveCamera): void {
  ctx.renderer.render(ctx.scene, camera);
}
