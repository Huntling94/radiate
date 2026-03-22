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

export function TemperatureControl({ temperature, onTemperatureChange }: TemperatureControlProps) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Temperature
      </h2>
      <div className="flex items-center gap-3">
        <span className="w-12 text-right text-sm text-neutral-300">
          {String(Math.round(temperature))}°C
        </span>
        <input
          type="range"
          min={-20}
          max={50}
          value={temperature}
          onChange={(e) => {
            onTemperatureChange(Number(e.target.value));
          }}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-neutral-700"
        />
      </div>
      <p className="mt-1 text-xs text-neutral-500">{getTemperatureLabel(temperature)}</p>
    </div>
  );
}
