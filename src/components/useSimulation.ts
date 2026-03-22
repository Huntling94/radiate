import { useState, useEffect, useCallback, useRef } from 'react';
import type { WorldState, Species, SculptAction } from '../engine/index.ts';
import { createInitialState, tick, getTotalPopulation, applySculpt } from '../engine/index.ts';
import { saveWorld, loadWorld, clearWorld } from '../data/persistence.ts';

// ---------------------------------------------------------------------------
// Population history for charting
// ---------------------------------------------------------------------------

export interface PopulationSnapshot {
  tick: number;
  populations: Record<string, number>;
  names: Record<string, string>;
}

const HISTORY_LENGTH = 200;
const SAVE_INTERVAL_MS = 5000;

export type TickSpeed = 0.5 | 1 | 2 | 5;
const TICK_INTERVALS: Record<TickSpeed, number> = { 0.5: 2000, 1: 1000, 2: 500, 5: 200 };

function takeSnapshot(state: WorldState): PopulationSnapshot {
  const populations: Record<string, number> = {};
  const names: Record<string, string> = {};
  for (const species of state.species) {
    populations[species.id] = getTotalPopulation(species);
    names[species.id] = species.name;
  }
  return { tick: state.tick, populations, names };
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${String(Math.round(seconds))}s`;
  if (seconds < 3600) return `${String(Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${String(Math.round(seconds / 3600))}h`;
  return `${String(Math.round(seconds / 86400))}d`;
}

/** Load saved state and perform offline catch-up. */
function initializeState(seed: number): { state: WorldState; welcome: string | null } {
  const saved = loadWorld();
  if (!saved) return { state: createInitialState(seed), welcome: null };

  const elapsed = (Date.now() - saved.lastTimestamp) / 1000;
  if (elapsed <= 2) return { state: saved, welcome: null };

  const catchUp = tick(saved, elapsed);
  const newSpecies = catchUp.species.length - saved.species.length;
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
  tickSpeed: TickSpeed;
  togglePause: () => void;
  setTemperature: (temp: number) => void;
  setTickSpeed: (speed: TickSpeed) => void;
  sculptBiomes: (actions: SculptAction[]) => void;
  newGame: () => void;
  dismissWelcome: () => void;
}

export function useSimulation(seed = 42): SimulationControls {
  const [{ state: initialState, welcome: initialWelcome }] = useState(() => initializeState(seed));
  const [worldState, setWorldState] = useState<WorldState>(initialState);
  const [history, setHistory] = useState<PopulationSnapshot[]>(() => [takeSnapshot(initialState)]);
  const [isPaused, setIsPaused] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(initialWelcome);
  const [tickSpeed, setTickSpeed] = useState<TickSpeed>(1);
  const lastTickTime = useRef(0);

  useEffect(() => {
    lastTickTime.current = Date.now();
  }, []);

  // Tick loop — interval adjusts with tick speed
  useEffect(() => {
    if (isPaused) return;

    const intervalMs = TICK_INTERVALS[tickSpeed];
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
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [isPaused, tickSpeed]);

  // Auto-save
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
    const handler = () => {
      if (document.hidden) {
        setWorldState((current) => {
          saveWorld(current);
          return current;
        });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
    };
  }, []);

  const togglePause = useCallback(() => {
    if (isPaused) lastTickTime.current = Date.now();
    setIsPaused((p) => !p);
  }, [isPaused]);

  const setTemperature = useCallback((temp: number) => {
    setWorldState((prev) => ({ ...prev, temperature: temp }));
  }, []);

  const sculptBiomes = useCallback((actions: SculptAction[]) => {
    setWorldState((prev) => ({
      ...prev,
      biomes: applySculpt(prev.biomes, actions, prev.temperature),
    }));
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
    tickSpeed,
    togglePause,
    setTemperature,
    setTickSpeed,
    sculptBiomes,
    newGame,
    dismissWelcome,
  };
}
