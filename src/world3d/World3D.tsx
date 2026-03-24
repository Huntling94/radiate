/**
 * React component hosting the Babylon.js 3D world view.
 * Manages canvas lifecycle, resize, creature lifecycle, interaction, and render loop.
 */

import { useRef, useEffect } from 'react';
import type { WorldState } from '../engine/index.ts';
import type { SculptAction } from '../engine/index.ts';
import { generateTerrain, getHeightAtWorldXZ } from './terrain.ts';
import { createScene, updateTerrainMesh, resizeRenderer } from './scene.ts';
import type { SceneContext } from './scene.ts';
import { createCameraRig } from './camera.ts';
import type { CameraRig } from './camera.ts';
import { CreatureManager } from './creatures.ts';
import { createInteraction } from './interaction.ts';
import type { InteractionState, SculptTool } from './interaction.ts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface World3DProps {
  worldState: WorldState;
  activeTool?: SculptTool;
  onSelectSpecies?: (speciesId: string | null) => void;
  onSculpt?: (actions: SculptAction[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function World3D({
  worldState,
  activeTool = 'select',
  onSelectSpecies,
  onSculpt,
}: World3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<SceneContext | null>(null);
  const cameraRef = useRef<CameraRig | null>(null);
  const creaturesRef = useRef<CreatureManager | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const worldStateRef = useRef(worldState);
  const callbacksRef = useRef({ onSelectSpecies, onSculpt });

  useEffect(() => {
    worldStateRef.current = worldState;
  }, [worldState]);

  useEffect(() => {
    callbacksRef.current = { onSelectSpecies, onSculpt };
  }, [onSelectSpecies, onSculpt]);

  // Sync active tool
  useEffect(() => {
    if (interactionRef.current) {
      interactionRef.current.activeTool = activeTool;
    }
  }, [activeTool]);

  // Initialise Babylon.js scene, camera, creatures, interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure canvas has dimensions before Babylon Engine init
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const ctx = createScene(canvas);
    ctxRef.current = ctx;

    const cameraRig = createCameraRig(canvas, ctx.scene);
    cameraRef.current = cameraRig;

    // Set as active camera so scene.render() uses it
    ctx.scene.activeCamera = cameraRig.camera;

    const creatures = new CreatureManager(ctx.scene, ctx.shadowGenerator);
    creaturesRef.current = creatures;

    const interaction = createInteraction(
      canvas,
      ctx.scene,
      creatures,
      {
        onSelectSpecies: (id) => callbacksRef.current.onSelectSpecies?.(id),
        onSculpt: (actions) => callbacksRef.current.onSculpt?.(actions),
      },
      () => ctx.terrainMesh,
      () => {
        const ws = worldStateRef.current;
        return {
          biomes: ws.biomes,
          gridWidth: ws.config.gridWidth,
          gridHeight: ws.config.gridHeight,
        };
      },
    );
    interactionRef.current = interaction;

    // Register pre-render updates using Babylon's observable pattern
    ctx.scene.registerBeforeRender(() => {
      const delta = ctx.engine.getDeltaTime() / 1000;
      const clampedDelta = Math.min(delta, 0.1);
      const now = performance.now() / 1000;

      const ws = worldStateRef.current;

      cameraRig.update(clampedDelta, (x, z) =>
        getHeightAtWorldXZ(x, z, ws.biomes, ws.config.gridWidth, ws.config.gridHeight),
      );

      creatures.update(clampedDelta, now);
      interaction.update(cameraRig.camera);
    });

    // Start render loop
    ctx.engine.runRenderLoop(() => {
      ctx.scene.render();
    });

    return () => {
      ctx.engine.stopRenderLoop();
      interaction.dispose();
      cameraRig.dispose();
      // engine.dispose() also disposes the scene — no separate scene.dispose()
      ctx.dispose();
      ctxRef.current = null;
      cameraRef.current = null;
      creaturesRef.current = null;
      interactionRef.current = null;
    };
  }, []);

  // Resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (ctxRef.current) {
        resizeRenderer(ctxRef.current);
      }
    });

    observer.observe(container);

    // Initial resize
    if (ctxRef.current) {
      resizeRenderer(ctxRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Update terrain when biomes change
  useEffect(() => {
    if (!ctxRef.current) return;

    const data = generateTerrain(
      worldState.biomes,
      worldState.config.gridWidth,
      worldState.config.gridHeight,
    );
    updateTerrainMesh(ctxRef.current, data);
  }, [worldState.biomes, worldState.config.gridWidth, worldState.config.gridHeight]);

  // Sync creatures with species
  useEffect(() => {
    if (!creaturesRef.current) return;

    creaturesRef.current.syncSpecies(
      worldState.species,
      worldState.biomes,
      worldState.config.gridWidth,
      worldState.config.gridHeight,
    );
  }, [
    worldState.species,
    worldState.biomes,
    worldState.config.gridWidth,
    worldState.config.gridHeight,
  ]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
