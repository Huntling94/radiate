/**
 * React component hosting the Three.js 3D world view.
 * Manages canvas lifecycle, resize, and animation loop.
 */

import { useRef, useEffect } from 'react';
import type { WorldState } from '../engine/index.ts';
import { generateTerrain } from './terrain.ts';
import { createScene, updateTerrainMesh, resizeRenderer, renderFrame } from './scene.ts';
import type { SceneContext } from './scene.ts';
import { updateCreatures } from './creatures.ts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface World3DProps {
  worldState: WorldState;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function World3D({ worldState }: World3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<SceneContext | null>(null);
  const rafRef = useRef<number>(0);
  const worldStateRef = useRef(worldState);

  useEffect(() => {
    worldStateRef.current = worldState;
  }, [worldState]);

  // Initialise Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = createScene(canvas);
    ctxRef.current = ctx;

    // Animation loop — updates creature animations each frame
    function animate(): void {
      rafRef.current = requestAnimationFrame(animate);
      const ws = worldStateRef.current;
      const time = performance.now() / 1000;

      updateCreatures(
        ctx.scene,
        ws.species,
        ws.biomes,
        ws.config.gridWidth,
        ws.config.gridHeight,
        time,
      );

      renderFrame(ctx);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx.dispose();
      ctxRef.current = null;
    };
  }, []);

  // Resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0] as ResizeObserverEntry | undefined;
      if (!entry || !ctxRef.current) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        resizeRenderer(ctxRef.current, width, height);
      }
    });

    observer.observe(container);

    // Initial size
    const rect = container.getBoundingClientRect();
    if (ctxRef.current && rect.width > 0 && rect.height > 0) {
      resizeRenderer(ctxRef.current, rect.width, rect.height);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Update terrain when biomes change (temperature adjustment changes biome types)
  useEffect(() => {
    if (!ctxRef.current) return;

    const data = generateTerrain(
      worldState.biomes,
      worldState.config.gridWidth,
      worldState.config.gridHeight,
      4,
    );
    updateTerrainMesh(ctxRef.current, data);
  }, [worldState.biomes, worldState.config.gridWidth, worldState.config.gridHeight]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
