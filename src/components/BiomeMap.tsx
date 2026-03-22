import { useRef, useEffect, useState, useCallback } from 'react';
import type { WorldState, Biome } from '../engine/index.ts';
import { BIOME_COLOURS } from '../engine/index.ts';

interface BiomeMapProps {
  worldState: WorldState;
}

const MIN_CELL_SIZE = 40;
const MAX_CELL_SIZE = 80;
const CELL_GAP = 3;
const CELL_RADIUS = 5;

const TROPHIC_DOT_COLOURS: Record<string, string> = {
  producer: '#22c55e',
  herbivore: '#eab308',
  predator: '#ef4444',
};

interface TooltipData {
  biome: Biome;
  speciesInBiome: Array<{ name: string; trophicLevel: string; population: number }>;
  x: number;
  y: number;
}

export function BiomeMap({ worldState }: BiomeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [cellSize, setCellSize] = useState(60);

  const { gridWidth, gridHeight } = worldState.config;
  const canvasWidth = gridWidth * (cellSize + CELL_GAP) - CELL_GAP;
  const canvasHeight = gridHeight * (cellSize + CELL_GAP) - CELL_GAP;

  // Compute cell size from container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0] as ResizeObserverEntry | undefined;
      if (!entry) return;
      const availableWidth = entry.contentRect.width;
      const computed = Math.floor((availableWidth + CELL_GAP) / gridWidth) - CELL_GAP;
      setCellSize(Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, computed)));
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [gridWidth]);

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    for (const biome of worldState.biomes) {
      const x = biome.x * (cellSize + CELL_GAP);
      const y = biome.y * (cellSize + CELL_GAP);

      // Rounded rect with biome colour
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, CELL_RADIUS);
      ctx.fillStyle = BIOME_COLOURS[biome.biomeType];
      ctx.fill();

      // Elevation gradient
      const grad = ctx.createLinearGradient(x, y, x, y + cellSize);
      grad.addColorStop(0, `rgba(255,255,255,${(biome.elevation * 0.15).toFixed(2)})`);
      grad.addColorStop(1, `rgba(0,0,0,${(biome.elevation * 0.1).toFixed(2)})`);
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, CELL_RADIUS);
      ctx.fillStyle = grad;
      ctx.fill();

      // Species proportional bars at bottom
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

      if (speciesInBiome.length > 0) {
        const totalPop = speciesInBiome.reduce((sum, s) => sum + s.pop, 0);
        const barHeight = Math.max(4, cellSize * 0.12);
        const barY = y + cellSize - barHeight - 3;
        const barWidth = cellSize - 6;
        let barX = x + 3;

        for (const entry of speciesInBiome) {
          const segWidth = (entry.pop / totalPop) * barWidth;
          ctx.fillStyle = entry.colour;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(barX, barY, segWidth, barHeight);
          ctx.globalAlpha = 1.0;
          barX += segWidth;
        }
      }
    }
  }, [worldState, canvasWidth, canvasHeight, cellSize]);

  // Hover detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const gridX = Math.floor(mx / (cellSize + CELL_GAP));
      const gridY = Math.floor(my / (cellSize + CELL_GAP));

      const cx = gridX * (cellSize + CELL_GAP);
      const cy = gridY * (cellSize + CELL_GAP);
      if (mx < cx || mx > cx + cellSize || my < cy || my > cy + cellSize) {
        setTooltip(null);
        return;
      }

      const biome = worldState.biomes.find((b) => b.x === gridX && b.y === gridY);
      if (!biome) {
        setTooltip(null);
        return;
      }

      const speciesInBiome = worldState.species
        .filter((s) => (s.populationByBiome[biome.id] ?? 0) > 0)
        .map((s) => ({
          name: s.name,
          trophicLevel: s.trophicLevel,
          population: Math.round(s.populationByBiome[biome.id] ?? 0),
        }))
        .sort((a, b) => b.population - a.population);

      setTooltip({ biome, speciesInBiome, x: e.clientX, y: e.clientY });
    },
    [worldState, cellSize],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        World Map
        <span className="ml-2 font-normal text-neutral-600">
          {String(gridWidth)}x{String(gridHeight)}
        </span>
      </h2>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="cursor-crosshair rounded-xl border border-neutral-800/50"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />

      {/* Legend */}
      <div className="mt-3 flex gap-5 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
          Producer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
          Herbivore
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          Predator
        </span>
      </div>

      {/* Tooltip */}
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="font-semibold capitalize text-neutral-200">{tooltip.biome.biomeType}</div>
          <div className="mt-1 text-neutral-500">
            Elev {(tooltip.biome.elevation * 100).toFixed(0)}% · Moist{' '}
            {(tooltip.biome.moisture * 100).toFixed(0)}% · K{' '}
            {String(tooltip.biome.baseCarryingCapacity)}
          </div>
          {tooltip.speciesInBiome.length > 0 ? (
            <div className="mt-2 space-y-0.5">
              {tooltip.speciesInBiome.map((s) => (
                <div key={s.name} className="flex justify-between gap-3">
                  <span
                    className={
                      s.trophicLevel === 'producer'
                        ? 'text-green-400'
                        : s.trophicLevel === 'herbivore'
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }
                  >
                    {s.name}
                  </span>
                  <span className="text-neutral-400">{s.population.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-1 text-neutral-600">Uninhabited</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
