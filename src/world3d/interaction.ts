/**
 * Interaction system — scene.pick() based creature selection and terrain sculpt brush.
 * Dispatches left-click actions based on active tool mode.
 */

import { MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';
import type { Scene, FreeCamera } from '@babylonjs/core';
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
  update: (camera: FreeCamera) => void;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLICK_THRESHOLD = 5;
const SCULPT_DELTA = 0.05;
const SCULPT_THROTTLE_MS = 80;
const BRUSH_RADIUS = 1;

// Brush colours per tool
const BRUSH_COLOURS: Record<string, string> = {
  raise: '#44dd44',
  lower: '#dd4444',
  wet: '#4488ff',
  dry: '#ffaa44',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createInteraction(
  canvas: HTMLCanvasElement,
  scene: Scene,
  creatures: CreatureManager,
  callbacks: InteractionCallbacks,
  getTerrainMesh: () => Mesh | null,
  getBiomes: () => { biomes: Biome[]; gridWidth: number; gridHeight: number },
): InteractionState {
  let activeTool: SculptTool = 'select';
  let mouseX = 0;
  let mouseY = 0;

  // Mouse tracking for click vs drag detection
  let mouseDownPos = { x: 0, y: 0 };
  let isMouseDown = false;
  let lastSculptTime = 0;

  // Selection ring (torus with small thickness)
  const selectionRing = MeshBuilder.CreateTorus(
    'selectionRing',
    { diameter: 1.4, thickness: 0.1, tessellation: 32 },
    scene,
  );
  const ringMaterial = new StandardMaterial('ringMat', scene);
  ringMaterial.diffuseColor = Color3.FromHexString('#44ffaa');
  ringMaterial.alpha = 0.7;
  ringMaterial.disableLighting = true;
  ringMaterial.disableDepthWrite = true;
  selectionRing.material = ringMaterial;
  selectionRing.isPickable = false;
  selectionRing.setEnabled(false);
  selectionRing.renderingGroupId = 1;
  let selectedSpeciesId: string | null = null;

  // Brush preview (disc — Babylon CreateDisc is in XZ plane by default in RHS)
  const brushPreview = MeshBuilder.CreateDisc(
    'brushPreview',
    { radius: CELL_SIZE * 0.5, tessellation: 24 },
    scene,
  );
  // Rotate to lie flat (XZ plane) — CreateDisc faces the camera (XY) by default
  brushPreview.rotation.x = Math.PI / 2;
  const brushMaterial = new StandardMaterial('brushMat', scene);
  brushMaterial.diffuseColor = Color3.FromHexString('#44dd44');
  brushMaterial.alpha = 0.3;
  brushMaterial.disableLighting = true;
  brushMaterial.disableDepthWrite = true;
  brushPreview.material = brushMaterial;
  brushPreview.isPickable = false;
  brushPreview.setEnabled(false);
  brushPreview.renderingGroupId = 1;

  // Camera reference
  let currentCamera: FreeCamera | null = null;

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function updateMouseFromEvent(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }

  function raycastCreatures(): string | null {
    const pickResult = scene.pick(mouseX, mouseY, (mesh) => {
      const meta = mesh.metadata as { pickable?: boolean } | null;
      return meta?.pickable === true;
    });

    if (pickResult.hit && pickResult.pickedMesh) {
      return creatures.getSpeciesIdByMesh(pickResult.pickedMesh);
    }
    return null;
  }

  function raycastTerrain(): { x: number; y: number; z: number } | null {
    const terrain = getTerrainMesh();
    if (!terrain) return null;

    const pickResult = scene.pick(mouseX, mouseY, (mesh) => mesh === terrain);
    if (pickResult.hit && pickResult.pickedPoint) {
      return {
        x: pickResult.pickedPoint.x,
        y: pickResult.pickedPoint.y,
        z: pickResult.pickedPoint.z,
      };
    }
    return null;
  }

  function collectBrushBiomes(worldPoint: { x: number; z: number }): SculptAction[] {
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

  function handleClick(): void {
    if (!currentCamera) return;

    if (activeTool === 'select') {
      const speciesId = raycastCreatures();
      selectedSpeciesId = speciesId;
      selectionRing.setEnabled(false);
      callbacks.onSelectSpecies(speciesId);
    } else {
      applySculptAtMouse();
    }
  }

  function applySculptAtMouse(): void {
    if (!currentCamera) return;
    const now = performance.now();
    if (now - lastSculptTime < SCULPT_THROTTLE_MS) return;
    lastSculptTime = now;

    const point = raycastTerrain();
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
    if (e.button !== 0) return;
    mouseDownPos = { x: e.clientX, y: e.clientY };
    isMouseDown = true;
    updateMouseFromEvent(e);
  };

  const onMouseUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!isMouseDown) return;
    isMouseDown = false;

    const dx = e.clientX - mouseDownPos.x;
    const dy = e.clientY - mouseDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CLICK_THRESHOLD) {
      updateMouseFromEvent(e);
      handleClick();
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!currentCamera) return;
    updateMouseFromEvent(e);

    // Sculpt drag
    if (isMouseDown && activeTool !== 'select') {
      applySculptAtMouse();
    }

    // Brush preview for sculpt tools
    if (activeTool !== 'select') {
      const point = raycastTerrain();
      if (point) {
        brushPreview.position.set(point.x, point.y + 0.2, point.z);
        brushPreview.setEnabled(true);
        brushMaterial.diffuseColor = Color3.FromHexString(BRUSH_COLOURS[activeTool] ?? '#ffffff');
      } else {
        brushPreview.setEnabled(false);
      }
    } else {
      brushPreview.setEnabled(false);
    }
  };

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', onMouseMove);

  // -----------------------------------------------------------------------
  // Update (called each frame)
  // -----------------------------------------------------------------------

  function update(camera: FreeCamera): void {
    currentCamera = camera;

    // Follow selected creature with selection ring
    if (selectedSpeciesId && activeTool === 'select') {
      const groups = creatures.getAllMeshGroups();
      for (const group of groups) {
        const sid = creatures.getSpeciesIdByMesh(group as unknown as Mesh);
        if (sid === selectedSpeciesId && group.isEnabled()) {
          selectionRing.position.copyFrom(group.position);
          selectionRing.position.y += 0.05;
          selectionRing.setEnabled(true);
          // Pulse opacity
          ringMaterial.alpha = 0.5 + Math.sin(performance.now() * 0.005) * 0.2;
          return;
        }
      }
      // Selected creature not found (hidden or extinct) — hide ring
      selectionRing.setEnabled(false);
    } else {
      selectionRing.setEnabled(false);
    }
  }

  // -----------------------------------------------------------------------
  // Dispose
  // -----------------------------------------------------------------------

  function dispose(): void {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    selectionRing.dispose(false, true);
    brushPreview.dispose(false, true);
  }

  return {
    get activeTool() {
      return activeTool;
    },
    set activeTool(tool: SculptTool) {
      activeTool = tool;
      if (tool === 'select') {
        brushPreview.setEnabled(false);
      }
    },
    update,
    dispose,
  };
}
