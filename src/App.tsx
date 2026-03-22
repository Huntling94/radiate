import { useState } from 'react';
import { useSimulation, formatElapsed } from './components/useSimulation.ts';
import type { TickSpeed } from './components/useSimulation.ts';
import { BiomeMap } from './components/BiomeMap.tsx';
import { PopulationChart } from './components/PopulationChart.tsx';
import { SpeciesList } from './components/SpeciesList.tsx';
import { SpeciesCard } from './components/SpeciesCard.tsx';
import { TemperatureControl } from './components/TemperatureControl.tsx';
import { EventLog } from './components/EventLog.tsx';
import { PhylogeneticTree } from './components/PhylogeneticTree.tsx';
import type { Species } from './engine/index.ts';

type BottomTab = 'events' | 'chart' | 'tree';

const BOTTOM_TABS: { key: BottomTab; label: string }[] = [
  { key: 'events', label: 'Events' },
  { key: 'chart', label: 'Chart' },
  { key: 'tree', label: 'Tree' },
];

const TICK_SPEEDS: TickSpeed[] = [0.5, 1, 2, 5];

export function App() {
  const {
    worldState,
    populationHistory,
    speciesWithPopulation,
    isPaused,
    welcomeMessage,
    tickSpeed,
    togglePause,
    setTemperature,
    setTickSpeed,
    newGame,
    dismissWelcome,
  } = useSimulation();

  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>('events');

  // Auto-clear: if the selected ID no longer exists anywhere, treat as no selection
  const resolvedSelectedId =
    selectedSpeciesId &&
    (worldState.species.some((s) => s.id === selectedSpeciesId) ||
      worldState.extinctSpecies.some((s) => s.id === selectedSpeciesId))
      ? selectedSpeciesId
      : null;

  // Look up selected species from living (with population) or extinct (with 0 population)
  const selectedSpecies: (Species & { totalPopulation: number }) | null = resolvedSelectedId
    ? (speciesWithPopulation.find((s) => s.id === resolvedSelectedId) ??
      (() => {
        const ext = worldState.extinctSpecies.find((s) => s.id === resolvedSelectedId);
        return ext ? { ...ext, totalPopulation: 0 } : null;
      })())
    : null;

  const speciesIds = worldState.species.map((s) => s.id);

  return (
    <div className="flex h-screen flex-col bg-neutral-950 text-neutral-100">
      {/* Welcome back banner */}
      {welcomeMessage ? (
        <div className="flex items-center justify-between bg-emerald-950/60 px-4 py-2 text-sm text-emerald-300">
          <span>{welcomeMessage}</span>
          <button
            onClick={dismissWelcome}
            className="ml-4 text-xs text-emerald-500 hover:text-emerald-300"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-800/50 px-5 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight text-emerald-400">Radiate</h1>
          <span className="text-[10px] text-neutral-600">v0.2</span>
        </div>

        <div className="flex items-center gap-5 text-xs text-neutral-500">
          <span>
            Tick <span className="text-neutral-300">{worldState.tick}</span>
          </span>
          <span>
            <span className="text-neutral-300">{worldState.species.length}</span> species
          </span>
          <span>
            Elapsed{' '}
            <span className="text-neutral-300">{formatElapsed(worldState.elapsedSeconds)}</span>
          </span>
          <span>
            Seed{' '}
            <span className="font-mono text-neutral-400">{String(worldState.config.seed)}</span>
          </span>

          {/* Tick speed */}
          <div className="flex items-center gap-1 rounded border border-neutral-800 px-1.5 py-0.5">
            {TICK_SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => {
                  setTickSpeed(speed);
                }}
                className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                  tickSpeed === speed
                    ? 'bg-emerald-900 text-emerald-300'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          <button
            onClick={togglePause}
            className={`rounded px-3 py-1 text-xs transition-colors ${
              isPaused
                ? 'border border-emerald-700 text-emerald-400 hover:bg-emerald-900/30'
                : 'border border-neutral-700 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={newGame}
            className="rounded border border-neutral-800 px-3 py-1 text-xs text-neutral-600 transition-colors hover:border-red-800 hover:text-red-400"
          >
            New
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {/* Left: Map + Event log + Chart */}
        <div className="flex flex-1 flex-col overflow-auto">
          {/* Map area */}
          <div className="flex-1 p-5">
            <BiomeMap worldState={worldState} />
          </div>

          {/* Bottom panel tabs */}
          <div className="flex border-t border-neutral-800/50">
            {BOTTOM_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setBottomTab(tab.key);
                }}
                className={`px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                  bottomTab === tab.key
                    ? 'border-b-2 border-emerald-500 text-emerald-400'
                    : 'text-neutral-600 hover:text-neutral-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Bottom panel content */}
          <div className="min-h-0 flex-shrink-0 px-5 py-3">
            {bottomTab === 'events' ? (
              <EventLog events={worldState.events} />
            ) : bottomTab === 'chart' ? (
              <PopulationChart history={populationHistory} speciesIds={speciesIds} />
            ) : (
              <PhylogeneticTree
                species={worldState.species}
                extinctSpecies={worldState.extinctSpecies}
                currentTick={worldState.tick}
                selectedSpeciesId={resolvedSelectedId}
                onSelectSpecies={setSelectedSpeciesId}
              />
            )}
          </div>
        </div>

        {/* Right sidebar: Species + Temperature */}
        <div className="flex w-72 flex-col gap-4 overflow-auto border-l border-neutral-800/50 p-4">
          <TemperatureControl
            temperature={worldState.temperature}
            onTemperatureChange={setTemperature}
          />
          {selectedSpecies ? (
            <SpeciesCard
              species={selectedSpecies}
              allSpecies={worldState.species}
              extinctSpecies={worldState.extinctSpecies}
              biomes={worldState.biomes}
              events={worldState.events}
              currentTick={worldState.tick}
              gridWidth={worldState.config.gridWidth}
              onBack={() => {
                setSelectedSpeciesId(null);
              }}
              onSelectSpecies={setSelectedSpeciesId}
            />
          ) : (
            <SpeciesList
              species={speciesWithPopulation}
              extinctCount={worldState.extinctSpeciesCount}
              onSelectSpecies={setSelectedSpeciesId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
