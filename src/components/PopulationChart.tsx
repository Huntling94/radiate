import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { PopulationSnapshot } from './useSimulation.ts';

interface PopulationChartProps {
  history: PopulationSnapshot[];
  speciesIds: string[];
}

const SPECIES_COLOURS = [
  '#22c55e', // green
  '#ef4444', // red
  '#3b82f6', // blue
  '#eab308', // yellow
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
];

export function PopulationChart({ history, speciesIds }: PopulationChartProps) {
  // Transform history into Recharts-compatible data
  const data = history.map((snapshot) => ({
    tick: snapshot.tick,
    ...snapshot.populations,
  }));

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
        Population
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis
            dataKey="tick"
            stroke="#525252"
            tick={{ fontSize: 11, fill: '#737373' }}
            tickLine={false}
          />
          <YAxis
            stroke="#525252"
            tick={{ fontSize: 11, fill: '#737373' }}
            tickLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1c1c1c',
              border: '1px solid #333',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#a3a3a3' }}
          />
          {speciesIds.map((id, i) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={SPECIES_COLOURS[i % SPECIES_COLOURS.length]}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
