import { useRef, useEffect } from 'react';
import type { WorldState } from '../engine/index.ts';
import { BIOME_COLOURS } from '../engine/index.ts';

interface BiomeMapProps {
  worldState: WorldState;
}

const CELL_SIZE = 48;
const CELL_GAP = 2;

// Species colours by trophic level
const TROPHIC_DOT_COLOURS: Record<string, string> = {
  producer: '#22c55e',
  herbivore: '#eab308',
  predator: '#ef4444',
};

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

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw biomes
    for (const biome of worldState.biomes) {
      const x = biome.x * (CELL_SIZE + CELL_GAP);
      const y = biome.y * (CELL_SIZE + CELL_GAP);

      // Biome base colour
      ctx.fillStyle = BIOME_COLOURS[biome.biomeType];
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      // Draw coloured dots for each species present in this biome
      const speciesInBiome: Array<{ colour: string; pop: number }> = [];
      for (const species of worldState.species) {
        const pop = species.populationByBiome[biome.id];
        if (pop && pop > 0) {
          speciesInBiome.push({
            colour: TROPHIC_DOT_COLOURS[species.trophicLevel] ?? '#ffffff',
            pop,
          });
        }
      }

      // Sort by population (largest first) and take top 5
      speciesInBiome.sort((a, b) => b.pop - a.pop);
      const toShow = speciesInBiome.slice(0, 5);

      if (toShow.length > 0) {
        // Find max pop for scaling
        const maxPop = Math.max(...toShow.map((s) => s.pop));

        // Position dots in a row within the cell
        const dotSpacing = CELL_SIZE / (toShow.length + 1);

        for (let i = 0; i < toShow.length; i++) {
          const entry = toShow[i];
          const intensity = Math.min(entry.pop / maxPop, 1);
          const dotSize = 3 + intensity * 5;
          const dotX = x + dotSpacing * (i + 1);
          const dotY = y + CELL_SIZE / 2;

          ctx.beginPath();
          ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
          ctx.fillStyle = entry.colour;
          ctx.globalAlpha = 0.5 + intensity * 0.5;
          ctx.fill();
          ctx.globalAlpha = 1.0;
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
      <div className="mt-2 flex gap-4 text-xs text-neutral-500">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
          Producer
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
          Herbivore
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
          Predator
        </span>
      </div>
    </div>
  );
}
