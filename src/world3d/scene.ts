/**
 * Three.js scene setup — camera, lighting, renderer, controls.
 * Only file (along with indicators.ts and World3D.tsx) that imports Three.js.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TerrainData } from './terrain.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  terrainMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Scene creation
// ---------------------------------------------------------------------------

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x111111);

  // Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x111111, 0.015);

  // Camera
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  camera.position.set(25, 20, 25);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 80;
  controls.minPolarAngle = 0.2;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.update();

  // Lighting
  const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
  sun.position.set(20, 30, 10);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambient);

  const ctx: SceneContext = {
    renderer,
    scene,
    camera,
    controls,
    terrainMesh: null,
    waterMesh: null,
    dispose: () => {
      controls.dispose();
      renderer.dispose();
      scene.clear();
    },
  };

  return ctx;
}

// ---------------------------------------------------------------------------
// Terrain mesh
// ---------------------------------------------------------------------------

export function updateTerrainMesh(ctx: SceneContext, data: TerrainData): void {
  // Remove old terrain
  if (ctx.terrainMesh) {
    ctx.scene.remove(ctx.terrainMesh);
    ctx.terrainMesh.geometry.dispose();
    if (Array.isArray(ctx.terrainMesh.material)) {
      ctx.terrainMesh.material.forEach((m) => {
        m.dispose();
      });
    } else {
      ctx.terrainMesh.material.dispose();
    }
  }

  // Remove old water
  if (ctx.waterMesh) {
    ctx.scene.remove(ctx.waterMesh);
    ctx.waterMesh.geometry.dispose();
    if (Array.isArray(ctx.waterMesh.material)) {
      ctx.waterMesh.material.forEach((m) => {
        m.dispose();
      });
    } else {
      ctx.waterMesh.material.dispose();
    }
  }

  // Build terrain geometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colours, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  ctx.scene.add(mesh);
  ctx.terrainMesh = mesh;

  // Water plane
  const waterGeometry = new THREE.PlaneGeometry(data.worldWidth + 8, data.worldDepth + 8);
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = new THREE.MeshLambertMaterial({
    color: 0x1a6b8a,
    transparent: true,
    opacity: 0.65,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = -0.1;
  ctx.scene.add(water);
  ctx.waterMesh = water;

  // Recentre camera target
  ctx.controls.target.set(0, 1, 0);
  ctx.controls.update();
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

export function resizeRenderer(ctx: SceneContext, width: number, height: number): void {
  ctx.renderer.setSize(width, height, false);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------

export function renderFrame(ctx: SceneContext): void {
  ctx.controls.update();
  ctx.renderer.render(ctx.scene, ctx.camera);
}
