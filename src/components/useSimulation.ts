import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorldState, Species } from '../engine/index.ts';
import { createInitialState, tick, getTotalPopulation } from '../engine/index.ts';
import { saveWorld, loadWorld, clearWorld } from '../data/persistence.ts';

// ---------------------------------------------------------------------------
// Population history for charting
// ---------------------------------------------------------------------------

export interface PopulationSnapshot {
  tick: number;
  populations: Record<string, number>; // species ID → total population
}

const HISTORY_LENGTH = 200;
const SAVE_INTERVAL_MS = 5000;

function takeSnapshot(state: WorldState): PopulationSnapshot {
  const populations: Record<string, number> = {};
  for (const species of state.species) {
    populations[species.id] = getTotalPopulation(species);
  }
  return { tick: state.tick, populations };
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${String(Math.round(seconds))}s`;
  if (seconds < 3600) return `${String(Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${String(Math.round(seconds / 3600))}h`;
  return `${String(Math.round(seconds / 86400))}d`;
}

/** Load saved state and perform offline catch-up. */
function initializeState(seed: number): { state: WorldState; welcome: string | null } {
  const saved = loadWorld();
  if (!saved) {
    return { state: createInitialState(seed), welcome: null };
  }

  const elapsed = (Date.now() - saved.lastTimestamp) / 1000;
  if (elapsed <= 2) {
    return { state: saved, welcome: null };
  }

  const catchUp = tick(saved, elapsed);

  const speciesBefore = saved.species.length;
  const speciesAfter = catchUp.species.length;
  const newSpecies = speciesAfter - speciesBefore;
  const extinctions = catchUp.extinctSpeciesCount - saved.extinctSpeciesCount;

  let msg = `Welcome back! ${formatElapsed(elapsed)} elapsed.`;
  if (newSpecies > 0) msg += ` ${String(newSpecies)} new species evolved.`;
  if (extinctions > 0) msg += ` ${String(extinctions)} went extinct.`;

  return { state: catchUp, welcome: msg };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface SimulationControls {
  worldState: WorldState;
  populationHistory: PopulationSnapshot[];
  speciesWithPopulation: Array<Species & { totalPopulation: number }>;
  isPaused: boolean;
  welcomeMessage: string | null;
  togglePause: () => void;
  setTemperature: (temp: number) => void;
  newGame: () => void;
  dismissWelcome: () => void;
}

export function useSimulation(seed = 42): SimulationControls {
  const [{ state: initialState, welcome: initialWelcome }] = useState(() => initializeState(seed));
  const [worldState, setWorldState] = useState<WorldState>(initialState);
  const [history, setHistory] = useState<PopulationSnapshot[]>(() => [takeSnapshot(initialState)]);
  const [isPaused, setIsPaused] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(initialWelcome);
  const lastTickTime = useRef(0);

  // Initialize tick timer
  useEffect(() => {
    lastTickTime.current = Date.now();
  }, []);

  // Tick loop
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

  // Auto-save on interval
  useEffect(() => {
    const interval = setInterval(() => {
      setWorldState((current) => {
        saveWorld(current);
        return current;
      });
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Save on tab blur
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWorldState((current) => {
          saveWorld(current);
          return current;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const togglePause = useCallback(() => {
    if (isPaused) {
      lastTickTime.current = Date.now();
    }
    setIsPaused((p) => !p);
  }, [isPaused]);

  const setTemperature = useCallback((temp: number) => {
    setWorldState((prev) => ({ ...prev, temperature: temp }));
  }, []);

  const newGame = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 1_000_000);
    const fresh = createInitialState(newSeed);
    clearWorld();
    setWorldState(fresh);
    setHistory([takeSnapshot(fresh)]);
    setWelcomeMessage(null);
    lastTickTime.current = Date.now();
  }, []);

  const dismissWelcome = useCallback(() => {
    setWelcomeMessage(null);
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
    welcomeMessage,
    togglePause,
    setTemperature,
    newGame,
    dismissWelcome,
  };
}
