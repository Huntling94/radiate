import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { PopulationSnapshot } from './useSimulation.ts';

interface PopulationChartProps {
  history: PopulationSnapshot[];
  speciesIds: string[];
}

const SPECIES_COLOURS = [
  '#22c55e',
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f43f5e',
];

export function PopulationChart({ history, speciesIds }: PopulationChartProps) {
  // Build a stable name map from the latest snapshot
  const nameMap = useMemo(() => {
    const latest = history[history.length - 1];
    return latest.names;
  }, [history]);

  const data = history.map((snapshot) => ({
    tick: snapshot.tick,
    ...snapshot.populations,
  }));

  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Population History
      </h2>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <XAxis
            dataKey="tick"
            stroke="#333"
            tick={{ fontSize: 10, fill: '#555' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#333"
            tick={{ fontSize: 10, fill: '#555' }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#141414',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              fontSize: '11px',
              padding: '8px 12px',
            }}
            labelStyle={{ color: '#666', marginBottom: '4px' }}
            formatter={(value: number, _name: string, props: { dataKey?: string | number }) => {
              const id = String(props.dataKey ?? '');
              const name = nameMap[id] ?? id;
              return [Math.round(value).toLocaleString(), name];
            }}
          />
          {speciesIds.map((id, i) => (
            <Line
              key={id}
              type="monotone"
              dataKey={id}
              stroke={SPECIES_COLOURS[i % SPECIES_COLOURS.length]}
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
