import { useSimulation } from './components/useSimulation.ts';
import { BiomeMap } from './components/BiomeMap.tsx';
import { PopulationChart } from './components/PopulationChart.tsx';
import { SpeciesList } from './components/SpeciesList.tsx';

export function App() {
  const { worldState, populationHistory, speciesWithPopulation, isPaused, togglePause } =
    useSimulation();

  const speciesIds = worldState.species.map((s) => s.id);

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
        <h1 className="text-lg font-bold tracking-tight">Radiate</h1>
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <span>Tick {worldState.tick}</span>
          <span>{worldState.species.length} species</span>
          <span>{worldState.temperature}°C</span>
          <button
            onClick={togglePause}
            className="rounded border border-neutral-700 px-3 py-1 text-xs transition-colors hover:border-neutral-500 hover:text-neutral-200"
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Biome map */}
        <div className="flex-1 overflow-auto p-4">
          <BiomeMap worldState={worldState} />
        </div>

        {/* Right: Species list */}
        <div className="w-64 overflow-auto border-l border-neutral-800 p-4">
          <SpeciesList species={speciesWithPopulation} />
        </div>
      </div>

      {/* Bottom: Population chart */}
      <div className="border-t border-neutral-800 p-4">
        <PopulationChart history={populationHistory} speciesIds={speciesIds} />
      </div>
    </div>
  );
}
