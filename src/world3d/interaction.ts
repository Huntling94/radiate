/**
 * Interaction system — raycasting, creature selection, terrain sculpt brush.
 * Dispatches left-click actions based on active tool mode.
 */

import * as THREE from 'three';
import type { Biome } from '../engine/index.ts';
import type { SculptAction } from '../engine/index.ts';
import type { CreatureManager } from './creatures.ts';
import { worldXZToBiomeCoords, CELL_SIZE } from './terrain.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SculptTool = 'select' | 'raise' | 'lower' | 'wet' | 'dry';

export interface InteractionCallbacks {
  onSelectSpecies: (speciesId: string | null) => void;
  onSculpt: (actions: SculptAction[]) => void;
}

export interface InteractionState {
  activeTool: SculptTool;
  update: (camera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLICK_THRESHOLD = 5; // pixels — below this is a click, above is a drag
const SCULPT_DELTA = 0.05; // elevation/moisture change per stroke
const SCULPT_THROTTLE_MS = 80;
const BRUSH_RADIUS = 1; // grid cells
const SELECTION_RING_SEGMENTS = 32;

// Brush colours per tool
const BRUSH_COLOURS: Record<string, number> = {
  raise: 0x44dd44,
  lower: 0xdd4444,
  wet: 0x4488ff,
  dry: 0xffaa44,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createInteraction(
  canvas: HTMLCanvasElement,
  scene: THREE.Scene,
  creatures: CreatureManager,
  callbacks: InteractionCallbacks,
  getTerrainMesh: () => THREE.Mesh | null,
  getBiomes: () => { biomes: Biome[]; gridWidth: number; gridHeight: number },
): InteractionState {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let activeTool: SculptTool = 'select';

  // Mouse tracking for click vs drag detection
  let mouseDownPos = { x: 0, y: 0 };
  let isMouseDown = false;
  let lastSculptTime = 0;

  // Selection ring
  const ringGeometry = new THREE.RingGeometry(0.6, 0.8, SELECTION_RING_SEGMENTS);
  ringGeometry.rotateX(-Math.PI / 2);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x44ffaa,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
  selectionRing.visible = false;
  scene.add(selectionRing);
  let selectedSpeciesId: string | null = null;

  // Brush preview
  const brushGeometry = new THREE.CircleGeometry(CELL_SIZE * 0.5, 24);
  brushGeometry.rotateX(-Math.PI / 2);
  const brushMaterial = new THREE.MeshBasicMaterial({
    color: 0x44dd44,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const brushPreview = new THREE.Mesh(brushGeometry, brushMaterial);
  brushPreview.visible = false;
  brushPreview.renderOrder = 999;
  scene.add(brushPreview);

  // Camera reference for raycasting
  let currentCamera: THREE.PerspectiveCamera | null = null;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function setMouseFromEvent(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function raycastCreatures(camera: THREE.PerspectiveCamera): string | null {
    raycaster.setFromCamera(mouse, camera);
    const groups = creatures.getAllMeshGroups();
    const allMeshes: THREE.Object3D[] = [];
    for (const group of groups) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) allMeshes.push(child);
      });
    }
    const hits = raycaster.intersectObjects(allMeshes, false);
    if (hits.length > 0) {
      return creatures.getSpeciesIdByMesh(hits[0].object);
    }
    return null;
  }

  function raycastTerrain(camera: THREE.PerspectiveCamera): THREE.Vector3 | null {
    const terrain = getTerrainMesh();
    if (!terrain) return null;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(terrain, false);
    if (hits.length > 0) return hits[0].point;
    return null;
  }

  function collectBrushBiomes(worldPoint: THREE.Vector3): SculptAction[] {
    const { biomes, gridWidth, gridHeight } = getBiomes();
    const center = worldXZToBiomeCoords(worldPoint.x, worldPoint.z, gridWidth, gridHeight);
    const actions: SculptAction[] = [];

    for (const biome of biomes) {
      const dx = biome.x - center.gx;
      const dy = biome.y - center.gy;
      if (dx * dx + dy * dy <= BRUSH_RADIUS * BRUSH_RADIUS) {
        const tool = activeTool;
        actions.push({
          biomeId: biome.id,
          elevationDelta: tool === 'raise' ? SCULPT_DELTA : tool === 'lower' ? -SCULPT_DELTA : 0,
          moistureDelta: tool === 'wet' ? SCULPT_DELTA : tool === 'dry' ? -SCULPT_DELTA : 0,
        });
      }
    }

    return actions;
  }

  function handleClick(e: MouseEvent): void {
    if (!currentCamera) return;
    setMouseFromEvent(e);

    if (activeTool === 'select') {
      // Try creature selection
      const speciesId = raycastCreatures(currentCamera);
      selectedSpeciesId = speciesId;
      selectionRing.visible = false;
      callbacks.onSelectSpecies(speciesId);
    } else {
      // Sculpt at click point
      applySculptAtMouse();
    }
  }

  function applySculptAtMouse(): void {
    if (!currentCamera) return;
    const now = performance.now();
    if (now - lastSculptTime < SCULPT_THROTTLE_MS) return;
    lastSculptTime = now;

    const point = raycastTerrain(currentCamera);
    if (!point) return;

    const actions = collectBrushBiomes(point);
    if (actions.length > 0) {
      callbacks.onSculpt(actions);
    }
  }

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return; // left-click only
    mouseDownPos = { x: e.clientX, y: e.clientY };
    isMouseDown = true;
  };

  const onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!isMouseDown) return;
    isMouseDown = false;

    const dx = e.clientX - mouseDownPos.x;
    const dy = e.clientY - mouseDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CLICK_THRESHOLD) {
      handleClick(e);
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!currentCamera) return;
    setMouseFromEvent(e);

    // Sculpt drag
    if (isMouseDown && activeTool !== 'select') {
      applySculptAtMouse();
    }

    // Brush preview for sculpt tools
    if (activeTool !== 'select') {
      const point = raycastTerrain(currentCamera);
      if (point) {
        brushPreview.position.set(point.x, point.y + 0.2, point.z);
        brushPreview.visible = true;
        brushMaterial.color.setHex(BRUSH_COLOURS[activeTool] ?? 0xffffff);
      } else {
        brushPreview.visible = false;
      }
    } else {
      brushPreview.visible = false;
    }
  };

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);

  // -----------------------------------------------------------------------
  // Update (called each frame)
  // -----------------------------------------------------------------------

  function update(camera: THREE.PerspectiveCamera): void {
    currentCamera = camera;

    // Follow selected creature with selection ring
    if (selectedSpeciesId && activeTool === 'select') {
      const groups = creatures.getAllMeshGroups();
      for (const group of groups) {
        const sid = creatures.getSpeciesIdByMesh(group);
        if (sid === selectedSpeciesId && group.visible) {
          selectionRing.position.copy(group.position);
          selectionRing.position.y += 0.05;
          selectionRing.visible = true;
          // Pulse opacity
          selectionRing.material.opacity = 0.5 + Math.sin(performance.now() * 0.005) * 0.2;
          return;
        }
      }
      // Selected creature not found (hidden or extinct) — hide ring
      selectionRing.visible = false;
    } else {
      selectionRing.visible = false;
    }
  }

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  function dispose(): void {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    scene.remove(selectionRing);
    ringGeometry.dispose();
    ringMaterial.dispose();
    scene.remove(brushPreview);
    brushGeometry.dispose();
    brushMaterial.dispose();
  }

  return {
    get activeTool() {
      return activeTool;
    },
    set activeTool(tool: SculptTool) {
      activeTool = tool;
      if (tool === 'select') {
        brushPreview.visible = false;
      }
    },
    update,
    dispose,
  };
}
