/**
 * Three.js scene setup — lighting, renderer, terrain mesh management.
 * Camera is managed separately by camera.ts.
 */

import * as THREE from 'three';
import type { TerrainData } from './terrain.ts';

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
// Scene creation
// ---------------------------------------------------------------------------

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x1a1a2e);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.006);

  // Warm sun + cool ambient for depth
  const sun = new THREE.DirectionalLight(0xffeedd, 1.4);
  sun.position.set(40, 60, 20);
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

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  ctx.scene.add(mesh);
  ctx.terrainMesh = mesh;

  // Water plane
  const waterGeometry = new THREE.PlaneGeometry(data.worldWidth + 20, data.worldDepth + 20);
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
