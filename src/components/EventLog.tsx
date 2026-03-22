import type { SimEvent } from '../engine/index.ts';

interface EventLogProps {
  events: SimEvent[];
}

const EVENT_COLOURS: Record<string, { dot: string; text: string }> = {
  speciation: { dot: 'bg-emerald-500', text: 'text-emerald-400' },
  extinction: { dot: 'bg-red-500', text: 'text-red-400' },
  milestone: { dot: 'bg-blue-500', text: 'text-blue-400' },
};

export function EventLog({ events }: EventLogProps) {
  // Show newest first
  const reversed = [...events].reverse();

  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Event Log
        <span className="ml-2 font-normal text-neutral-600">{events.length} events</span>
      </h2>
      {reversed.length === 0 ? (
        <p className="text-xs text-neutral-600">No events yet...</p>
      ) : (
        <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
          {reversed.map((event) => {
            const colours = EVENT_COLOURS[event.type] ?? {
              dot: 'bg-neutral-500',
              text: 'text-neutral-400',
            };
            return (
              <div key={event.id} className="flex gap-2 text-[11px]">
                <div className="flex shrink-0 items-start gap-1.5 pt-0.5">
                  <span className={`mt-0.5 inline-block h-1.5 w-1.5 rounded-full ${colours.dot}`} />
                  <span className="w-10 text-right font-mono text-neutral-600">
                    {String(event.tick)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className={colours.text}>{event.description}</span>
                  <span className="ml-1.5 text-neutral-600">{event.cause}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
