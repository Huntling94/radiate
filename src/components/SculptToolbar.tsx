/**
 * Floating toolbar for terrain sculpting tools.
 * Positioned bottom-left over the 3D canvas.
 */

import type { SculptTool } from '../world3d/interaction.ts';

interface SculptToolbarProps {
  activeTool: SculptTool;
  onToolChange: (tool: SculptTool) => void;
}

const TOOLS: { key: SculptTool; label: string; shortcut: string }[] = [
  { key: 'select', label: 'Select', shortcut: 'Q' },
  { key: 'raise', label: 'Raise', shortcut: '1' },
  { key: 'lower', label: 'Lower', shortcut: '2' },
  { key: 'wet', label: 'Wet', shortcut: '3' },
  { key: 'dry', label: 'Dry', shortcut: '4' },
];

const TOOL_COLOURS: Record<SculptTool, string> = {
  select: 'border-emerald-500 text-emerald-400',
  raise: 'border-green-500 text-green-400',
  lower: 'border-red-500 text-red-400',
  wet: 'border-blue-500 text-blue-400',
  dry: 'border-orange-500 text-orange-400',
};

export function SculptToolbar({ activeTool, onToolChange }: SculptToolbarProps) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex gap-1 rounded-lg border border-neutral-800/50 bg-neutral-950/80 p-1.5 backdrop-blur-sm">
      {TOOLS.map((tool) => (
        <button
          key={tool.key}
          onClick={() => {
            onToolChange(tool.key);
          }}
          title={`${tool.label} (${tool.shortcut})`}
          className={`rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
            activeTool === tool.key
              ? `border ${TOOL_COLOURS[tool.key]} bg-neutral-900`
              : 'border border-transparent text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}
