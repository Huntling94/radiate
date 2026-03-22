import type { Species } from '../engine/index.ts';

interface SpeciesListProps {
  species: Array<Species & { totalPopulation: number }>;
}

export function SpeciesList({ species }: SpeciesListProps) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Species
      </h2>
      {species.length === 0 ? (
        <p className="text-sm text-neutral-500">No living species</p>
      ) : (
        <ul className="space-y-2">
          {species.map((s) => (
            <li key={s.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-200">{s.name}</span>
                <span className="text-xs text-neutral-500">{s.trophicLevel}</span>
              </div>
              <div className="mt-1 text-sm text-neutral-400">
                Pop: {Math.round(s.totalPopulation).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                Gen {s.generation} · Tick {s.originTick}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
