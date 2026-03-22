import { useRef, useEffect } from 'react';
import type { WorldState } from '../engine/index.ts';
import { BIOME_COLOURS } from '../engine/index.ts';

interface BiomeMapProps {
  worldState: WorldState;
}

const CELL_SIZE = 48;
const CELL_GAP = 2;

export function BiomeMap({ worldState }: BiomeMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { gridWidth, gridHeight } = worldState.config;
  const canvasWidth = gridWidth * (CELL_SIZE + CELL_GAP) - CELL_GAP;
  const canvasHeight = gridHeight * (CELL_SIZE + CELL_GAP) - CELL_GAP;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Compute max population across all biomes for normalisation
    let maxPop = 0;
    for (const species of worldState.species) {
      for (const pop of Object.values(species.populationByBiome)) {
        if (pop > maxPop) maxPop = pop;
      }
    }

    // Draw biomes
    for (const biome of worldState.biomes) {
      const x = biome.x * (CELL_SIZE + CELL_GAP);
      const y = biome.y * (CELL_SIZE + CELL_GAP);

      // Biome base colour
      ctx.fillStyle = BIOME_COLOURS[biome.biomeType];
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      // Species population overlay — brighter = more populated
      if (maxPop > 0) {
        let biomePop = 0;
        for (const species of worldState.species) {
          biomePop += species.populationByBiome[biome.id] ?? 0;
        }

        if (biomePop > 0) {
          const intensity = Math.min(biomePop / maxPop, 1);
          ctx.fillStyle = `rgba(255, 255, 255, ${(intensity * 0.4).toFixed(2)})`;
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

          // Population dot indicator
          const dotSize = 4 + intensity * 8;
          ctx.beginPath();
          ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${(0.5 + intensity * 0.5).toFixed(2)})`;
          ctx.fill();
        }
      }
    }
  }, [worldState, canvasWidth, canvasHeight]);

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Biome Map
      </h2>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="rounded-lg border border-neutral-800"
      />
    </div>
  );
}
