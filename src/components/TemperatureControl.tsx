interface TemperatureControlProps {
  temperature: number;
  onTemperatureChange: (temp: number) => void;
}

function getTemperatureLabel(temp: number): string {
  if (temp < -10) return 'Frozen — tundra dominates';
  if (temp < 5) return 'Cold — tundra expanding';
  if (temp < 15) return 'Cool — temperate climate';
  if (temp < 25) return 'Warm — forests thriving';
  if (temp < 35) return 'Hot — deserts expanding';
  return 'Scorching — extreme heat stress';
}

function getTemperatureColour(temp: number): string {
  if (temp < 0) return 'text-blue-400';
  if (temp < 15) return 'text-cyan-400';
  if (temp < 25) return 'text-emerald-400';
  if (temp < 35) return 'text-amber-400';
  return 'text-red-400';
}

export function TemperatureControl({ temperature, onTemperatureChange }: TemperatureControlProps) {
  return (
    <div className="rounded-lg border border-neutral-800/50 bg-neutral-900/50 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Temperature
      </h2>
      <div className="flex items-center gap-3">
        <span className={`w-12 text-right text-lg font-bold ${getTemperatureColour(temperature)}`}>
          {String(Math.round(temperature))}°
        </span>
        <input
          type="range"
          min={-20}
          max={50}
          value={temperature}
          onChange={(e) => {
            onTemperatureChange(Number(e.target.value));
          }}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-700 accent-emerald-500"
        />
      </div>
      <p className="mt-1.5 text-[10px] text-neutral-600">{getTemperatureLabel(temperature)}</p>
    </div>
  );
}
