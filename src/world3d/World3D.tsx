/**
 * React component hosting the Three.js 3D world view.
 * Manages canvas lifecycle, resize, creature lifecycle, interaction, and animation loop.
 */

import { useRef, useEffect } from 'react';
import type { WorldState } from '../engine/index.ts';
import type { SculptAction } from '../engine/index.ts';
import { generateTerrain, getHeightAtWorldXZ } from './terrain.ts';
import { createScene, updateTerrainMesh, resizeRenderer, renderFrame } from './scene.ts';
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
  const rafRef = useRef<number>(0);
  const worldStateRef = useRef(worldState);
  const lastTimeRef = useRef(0);
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

  // Initialise Three.js scene, camera, creatures, interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = createScene(canvas);
    ctxRef.current = ctx;

    const cameraRig = createCameraRig(canvas);
    cameraRef.current = cameraRig;

    const creatures = new CreatureManager(ctx.scene);
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

    lastTimeRef.current = performance.now() / 1000;

    // Animation loop
    function animate(): void {
      rafRef.current = requestAnimationFrame(animate);
      const now = performance.now() / 1000;
      const delta = Math.min(now - lastTimeRef.current, 0.1);
      lastTimeRef.current = now;

      const ws = worldStateRef.current;

      cameraRig.update(delta, (x, z) =>
        getHeightAtWorldXZ(x, z, ws.biomes, ws.config.gridWidth, ws.config.gridHeight),
      );

      creatures.update(delta, now);
      interaction.update(cameraRig.camera);

      renderFrame(ctx, cameraRig.camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      interaction.dispose();
      cameraRig.dispose();
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

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0] as ResizeObserverEntry | undefined;
      if (!entry || !ctxRef.current || !cameraRef.current) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        resizeRenderer(ctxRef.current, width, height);
        cameraRef.current.handleResize(width, height);
      }
    });

    observer.observe(container);

    const rect = container.getBoundingClientRect();
    if (ctxRef.current && cameraRef.current && rect.width > 0 && rect.height > 0) {
      resizeRenderer(ctxRef.current, rect.width, rect.height);
      cameraRef.current.handleResize(rect.width, rect.height);
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
