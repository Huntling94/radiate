import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorldState, Species } from '../engine/index.ts';
import { createInitialState, tick, getTotalPopulation } from '../engine/index.ts';

// ---------------------------------------------------------------------------
// Population history for charting
// ---------------------------------------------------------------------------

export interface PopulationSnapshot {
  tick: number;
  populations: Record<string, number>; // species ID → total population
}

const HISTORY_LENGTH = 200;

function takeSnapshot(state: WorldState): PopulationSnapshot {
  const populations: Record<string, number> = {};
  for (const species of state.species) {
    populations[species.id] = getTotalPopulation(species);
  }
  return { tick: state.tick, populations };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface SimulationControls {
  worldState: WorldState;
  populationHistory: PopulationSnapshot[];
  speciesWithPopulation: Array<Species & { totalPopulation: number }>;
  isPaused: boolean;
  togglePause: () => void;
  setTemperature: (temp: number) => void;
}

export function useSimulation(seed = 42): SimulationControls {
  const [worldState, setWorldState] = useState<WorldState>(() => createInitialState(seed));
  const [history, setHistory] = useState<PopulationSnapshot[]>(() => [
    takeSnapshot(createInitialState(seed)),
  ]);
  const [isPaused, setIsPaused] = useState(false);
  const lastTickTime = useRef(0);

  useEffect(() => {
    lastTickTime.current = Date.now();
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastTickTime.current) / 1000;
      lastTickTime.current = now;

      setWorldState((prev) => {
        const next = tick(prev, elapsed);

        setHistory((prevHistory) => {
          const snapshot = takeSnapshot(next);
          const updated = [...prevHistory, snapshot];
          return updated.length > HISTORY_LENGTH ? updated.slice(-HISTORY_LENGTH) : updated;
        });

        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isPaused]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      // Resuming — reset lastTickTime so we don't get a huge delta
      lastTickTime.current = Date.now();
    }
    setIsPaused((p) => !p);
  }, [isPaused]);

  const setTemperature = useCallback((temp: number) => {
    setWorldState((prev) => ({ ...prev, temperature: temp }));
  }, []);

  const speciesWithPopulation = worldState.species.map((s) => ({
    ...s,
    totalPopulation: getTotalPopulation(s),
  }));

  return {
    worldState,
    populationHistory: history,
    speciesWithPopulation,
    isPaused,
    togglePause,
    setTemperature,
  };
}
