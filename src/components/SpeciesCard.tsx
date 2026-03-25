import type { SpeciesCluster, ExtinctSpecies, Biome, SimEvent, Traits } from '../engine/index.ts';
import { TRAIT_REGISTRY, expressTraits } from '../engine/index.ts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SpeciesCardProps {
  species: SpeciesCluster & { totalPopulation: number };
  allSpecies: SpeciesCluster[];
  extinctSpecies: ExtinctSpecies[];
  biomes: Biome[];
  events: SimEvent[];
  currentTick: number;
  gridWidth: number;
  onBack: () => void;
  onSelectSpecies: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Trophic styling (shared with SpeciesList)
// ---------------------------------------------------------------------------

const TROPHIC_LABELS: Record<string, string> = {
  producer: 'Producer',
  herbivore: 'Herbivore',
  predator: 'Predator',
};

const TROPHIC_COLOURS: Record<string, string> = {
  producer: 'text-green-400',
  herbivore: 'text-amber-400',
  predator: 'text-red-400',
};

const TROPHIC_BAR_BG: Record<string, string> = {
  producer: 'bg-green-500',
  herbivore: 'bg-amber-500',
  predator: 'bg-red-500',
};

const TROPHIC_CELL_BG: Record<string, string> = {
  producer: 'rgb(34 197 94)', // green-500
  herbivore: 'rgb(245 158 11)', // amber-500
  predator: 'rgb(239 68 68)', // red-500
};

// ---------------------------------------------------------------------------
// Event styling (shared with EventLog)
// ---------------------------------------------------------------------------

const EVENT_DOT_COLOURS: Record<string, string> = {
  speciation: 'bg-emerald-400',
  extinction: 'bg-red-400',
  milestone: 'bg-blue-400',
};

// ---------------------------------------------------------------------------
// Lineage resolver
// ---------------------------------------------------------------------------

interface LineageEntry {
  id: string;
  name: string;
  alive: boolean;
}

function resolveLineage(
  species: SpeciesCluster,
  allSpecies: SpeciesCluster[],
  extinctSpecies: ExtinctSpecies[],
): LineageEntry[] {
  const chain: LineageEntry[] = [];
  const aliveMap = new Map(allSpecies.map((s) => [s.id, s]));
  const extinctMap = new Map(extinctSpecies.map((s) => [s.id, s]));

  let current: SpeciesCluster | ExtinctSpecies | undefined = species;
  while (current) {
    const isAlive = aliveMap.has(current.id);
    chain.unshift({ id: current.id, name: current.name, alive: isAlive });
    if (current.parentSpeciesId) {
      const parent: SpeciesCluster | ExtinctSpecies | undefined =
        aliveMap.get(current.parentSpeciesId) ?? extinctMap.get(current.parentSpeciesId);
      if (parent) {
        current = parent;
      } else {
        // Parent predates the registry (old save without extinctSpecies)
        chain.unshift({
          id: current.parentSpeciesId,
          name: `Gen ${String(species.generation - chain.length)}`,
          alive: false,
        });
        break;
      }
    } else {
      current = undefined;
    }
  }

  return chain;
}

// ---------------------------------------------------------------------------
// Detailed trait bar with parent comparison
// ---------------------------------------------------------------------------

function DetailedTraitBar({
  name,
  value,
  min,
  max,
  parentValue,
  barColour,
}: {
  name: string;
  value: number;
  min: number;
  max: number;
  parentValue: number | null;
  barColour: string;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const parentPct =
    parentValue !== null
      ? Math.max(0, Math.min(100, ((parentValue - min) / (max - min)) * 100))
      : null;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] capitalize text-neutral-500">{name}</span>
        <span className="font-mono text-[10px] text-neutral-400">{value.toFixed(2)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-neutral-800">
        <div className={`h-full rounded-full ${barColour}`} style={{ width: `${String(pct)}%` }} />
        {parentPct !== null ? (
          <div
            className="absolute top-0 h-full w-0.5 rounded-full bg-white/40"
            style={{ left: `${String(parentPct)}%` }}
            title={`Parent: ${parentValue?.toFixed(2) ?? ''}`}
          />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Biome distribution mini-grid
// ---------------------------------------------------------------------------

function BiomeDistribution({
  species,
  biomes,
  gridWidth,
  trophicLevel,
}: {
  species: SpeciesCluster;
  biomes: Biome[];
  gridWidth: number;
  trophicLevel: string;
}) {
  const maxPop = Math.max(1, ...biomes.map((b) => species.populationByBiome[b.id] ?? 0));
  const baseColour = TROPHIC_CELL_BG[trophicLevel] ?? 'rgb(163 163 163)';

  return (
    <div
      className="grid gap-px"
      style={{
        gridTemplateColumns: `repeat(${String(gridWidth)}, 1fr)`,
      }}
    >
      {biomes.map((b) => {
        const pop = species.populationByBiome[b.id] ?? 0;
        const opacity = pop > 0 ? 0.15 + 0.85 * (pop / maxPop) : 0;
        return (
          <div
            key={b.id}
            className="aspect-square rounded-sm"
            style={{
              backgroundColor: pop > 0 ? baseColour : undefined,
              opacity: pop > 0 ? opacity : 1,
            }}
            title={pop > 0 ? `${b.biomeType} (${String(Math.round(pop))})` : b.biomeType}
          >
            {pop === 0 ? <div className="h-full w-full rounded-sm bg-neutral-900" /> : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Species card
// ---------------------------------------------------------------------------

export function SpeciesCard({
  species,
  allSpecies,
  extinctSpecies,
  biomes,
  events,
  currentTick,
  gridWidth,
  onBack,
  onSelectSpecies,
}: SpeciesCardProps) {
  const traits = expressTraits(species.genome);
  const isExtinct = !allSpecies.some((s) => s.id === species.id);
  const extinctRecord = isExtinct ? extinctSpecies.find((s) => s.id === species.id) : null;

  const parent = species.parentSpeciesId
    ? (allSpecies.find((s) => s.id === species.parentSpeciesId) ??
      extinctSpecies.find((s) => s.id === species.parentSpeciesId) ??
      null)
    : null;
  const parentTraits: Traits | null = parent ? expressTraits(parent.genome) : null;

  const age =
    isExtinct && extinctRecord
      ? extinctRecord.extinctionTick - species.originTick
      : currentTick - species.originTick;
  const biomeCount = Object.values(species.populationByBiome).filter((p) => p > 0).length;
  const lineage = resolveLineage(species, allSpecies, extinctSpecies);
  const speciesEvents = events
    .filter((e) => e.speciesId === species.id)
    .sort((a, b) => b.tick - a.tick);

  const trophicColour = TROPHIC_COLOURS[species.trophicLevel] ?? 'text-neutral-500';
  const barColour = TROPHIC_BAR_BG[species.trophicLevel] ?? 'bg-neutral-500';

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
      >
        <span>←</span>
        <span>Back to list</span>
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-100">{species.name}</span>
            {isExtinct ? (
              <span className="rounded bg-red-950 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-400">
                Extinct
              </span>
            ) : null}
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${trophicColour}`}>
            {TROPHIC_LABELS[species.trophicLevel] ?? species.trophicLevel}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
          <span>
            Gen <span className="text-neutral-400">{String(species.generation)}</span>
          </span>
          <span>
            Age <span className="text-neutral-400">{age.toLocaleString()} ticks</span>
          </span>
          <span>
            Pop{' '}
            <span className="text-neutral-400">
              {Math.round(species.totalPopulation).toLocaleString()}
            </span>
          </span>
          <span>
            <span className="text-neutral-400">{String(biomeCount)}</span> biome
            {biomeCount !== 1 ? 's' : ''}
          </span>
          {extinctRecord ? (
            <span>
              Died tick{' '}
              <span className="text-neutral-400">
                {extinctRecord.extinctionTick.toLocaleString()}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Lineage */}
      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
          Lineage
        </h3>
        <div className="flex flex-wrap items-center gap-1 text-[11px]">
          {lineage.map((entry, i) => (
            <span key={entry.id} className="flex items-center gap-1">
              {i > 0 ? <span className="text-neutral-700">→</span> : null}
              {entry.id !== species.id ? (
                <button
                  onClick={() => {
                    onSelectSpecies(entry.id);
                  }}
                  className={
                    entry.alive
                      ? 'text-emerald-500 hover:text-emerald-300'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }
                >
                  {entry.name}
                </button>
              ) : (
                <span className="font-medium text-neutral-200">{entry.name}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Traits */}
      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
          Traits
        </h3>
        <div className="space-y-1.5">
          {TRAIT_REGISTRY.map((trait) => (
            <DetailedTraitBar
              key={trait.name}
              name={trait.name}
              value={traits[trait.name as keyof Traits]}
              min={trait.min}
              max={trait.max}
              parentValue={parentTraits ? parentTraits[trait.name as keyof Traits] : null}
              barColour={barColour}
            />
          ))}
        </div>
        {parent ? (
          <p className="mt-1.5 text-[10px] text-neutral-600">
            <span className="inline-block h-2 w-0.5 rounded-full bg-white/40" /> = parent trait
            value
          </p>
        ) : null}
      </div>

      {/* Biome distribution */}
      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
          Distribution
        </h3>
        <BiomeDistribution
          species={species}
          biomes={biomes}
          gridWidth={gridWidth}
          trophicLevel={species.trophicLevel}
        />
      </div>

      {/* Event history */}
      <div>
        <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">
          History
          {speciesEvents.length > 0 ? (
            <span className="ml-1.5 font-normal text-neutral-700">
              {String(speciesEvents.length)}
            </span>
          ) : null}
        </h3>
        {speciesEvents.length === 0 ? (
          <p className="text-[11px] text-neutral-600">No recorded events</p>
        ) : (
          <div className="max-h-32 space-y-1.5 overflow-y-auto pr-1">
            {speciesEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-2">
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${EVENT_DOT_COLOURS[event.type] ?? 'bg-neutral-500'}`}
                  />
                  <span className="w-10 text-right font-mono text-[10px] text-neutral-600">
                    {String(event.tick)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-400">{event.description}</p>
                  <p className="text-[10px] text-neutral-600">{event.cause}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
