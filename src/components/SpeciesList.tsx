import type { SpeciesCluster } from '../engine/index.ts';
import { TRAIT_REGISTRY, expressTraits } from '../engine/index.ts';

interface SpeciesListProps {
  species: Array<SpeciesCluster & { totalPopulation: number }>;
  extinctCount: number;
  onSelectSpecies: (id: string) => void;
}

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

const TROPHIC_BAR_COLOURS: Record<string, string> = {
  producer: 'bg-green-500',
  herbivore: 'bg-amber-500',
  predator: 'bg-red-500',
};

function TraitBar({
  name,
  value,
  min,
  max,
}: {
  name: string;
  value: number;
  min: number;
  max: number;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 truncate text-right text-[10px] text-neutral-600">{name}</span>
      <div className="h-1.5 flex-1 rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-neutral-500" style={{ width: `${String(pct)}%` }} />
      </div>
    </div>
  );
}

export function SpeciesList({ species, extinctCount, onSelectSpecies }: SpeciesListProps) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Species
        <span className="ml-2 font-normal text-neutral-600">
          {species.length} alive
          {extinctCount > 0 ? ` · ${String(extinctCount)} extinct` : ''}
        </span>
      </h2>
      {species.length === 0 ? (
        <p className="text-sm text-neutral-600">No living species</p>
      ) : (
        <ul className="space-y-2">
          {species.map((s) => {
            const traits = expressTraits(s.genome);
            return (
              <li
                key={s.id}
                onClick={() => {
                  onSelectSpecies(s.id);
                }}
                className="cursor-pointer rounded-lg border border-neutral-800/50 bg-neutral-900/50 p-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-200">{s.name}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider ${TROPHIC_COLOURS[s.trophicLevel] ?? 'text-neutral-500'}`}
                  >
                    {TROPHIC_LABELS[s.trophicLevel] ?? s.trophicLevel}
                  </span>
                </div>

                {/* Population */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${TROPHIC_BAR_COLOURS[s.trophicLevel] ?? 'bg-neutral-500'}`}
                  />
                  <span className="text-sm text-neutral-300">
                    {Math.round(s.totalPopulation).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-neutral-600">Gen {String(s.generation)}</span>
                </div>

                {/* Trait bars */}
                <div className="mt-2 space-y-1">
                  {TRAIT_REGISTRY.map((trait) => (
                    <TraitBar
                      key={trait.name}
                      name={trait.name}
                      value={traits[trait.name as keyof typeof traits]}
                      min={trait.min}
                      max={trait.max}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
