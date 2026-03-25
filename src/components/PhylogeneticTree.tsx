import { useRef, useEffect, useState, useCallback } from 'react';
import type { SpeciesCluster, ExtinctSpecies } from '../engine/index.ts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhylogeneticTreeProps {
  species: SpeciesCluster[];
  extinctSpecies: ExtinctSpecies[];
  currentTick: number;
  selectedSpeciesId: string | null;
  onSelectSpecies: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Tree data structure
// ---------------------------------------------------------------------------

interface TreeNode {
  species: SpeciesCluster;
  isExtinct: boolean;
  extinctionTick: number | null;
  startTick: number;
  endTick: number;
  children: TreeNode[];
  y: number; // computed slot (centre y in canvas coords)
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const TROPHIC_COLOURS: Record<string, string> = {
  producer: '#22c55e',
  herbivore: '#eab308',
  predator: '#ef4444',
};

const EXTINCT_COLOUR = '#525252'; // neutral-600
const HIGHLIGHT_COLOUR = '#34d399'; // emerald-400
const BG_COLOUR = '#0a0a0a'; // neutral-950

// ---------------------------------------------------------------------------
// Layout algorithm — DFS slot assignment
// ---------------------------------------------------------------------------

function buildTree(
  allSpecies: SpeciesCluster[],
  extinctSpecies: ExtinctSpecies[],
  currentTick: number,
): TreeNode[] {
  // Combine all species into a lookup
  const speciesMap = new Map<string, SpeciesCluster>();
  const extinctSet = new Set<string>();
  const extinctionTicks = new Map<string, number>();

  for (const s of allSpecies) {
    speciesMap.set(s.id, s);
  }
  for (const s of extinctSpecies) {
    speciesMap.set(s.id, s);
    extinctSet.add(s.id);
    extinctionTicks.set(s.id, s.extinctionTick);
  }

  // Build children map
  const childrenMap = new Map<string, SpeciesCluster[]>();
  for (const s of speciesMap.values()) {
    if (s.parentSpeciesId) {
      const siblings = childrenMap.get(s.parentSpeciesId) ?? [];
      siblings.push(s);
      childrenMap.set(s.parentSpeciesId, siblings);
    }
  }

  // Sort children by originTick for consistent ordering
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.originTick - b.originTick);
  }

  // Find roots (no parent)
  const roots = [...speciesMap.values()].filter((s) => s.parentSpeciesId === null);
  roots.sort((a, b) => a.originTick - b.originTick);

  // DFS to build TreeNode hierarchy
  function buildNode(species: SpeciesCluster): TreeNode {
    const isExtinct = extinctSet.has(species.id);
    const extTick = extinctionTicks.get(species.id) ?? null;
    const childSpecies = childrenMap.get(species.id) ?? [];
    const children = childSpecies.map(buildNode);

    return {
      species,
      isExtinct,
      extinctionTick: extTick,
      startTick: species.originTick,
      endTick: isExtinct && extTick !== null ? extTick : currentTick,
      children,
      y: 0, // assigned below
    };
  }

  const rootNodes = roots.map(buildNode);

  // Assign y-slots via DFS
  let nextSlot = 0;
  function assignSlots(node: TreeNode): void {
    if (node.children.length === 0) {
      node.y = nextSlot;
      nextSlot++;
      return;
    }
    for (const child of node.children) {
      assignSlots(child);
    }
    // Parent y = midpoint of its children
    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];
    node.y = (firstChild.y + lastChild.y) / 2;
  }

  for (const root of rootNodes) {
    assignSlots(root);
  }

  return rootNodes;
}

// Flatten tree for hit-testing
function flattenTree(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(node: TreeNode): void {
    result.push(node);
    for (const child of node.children) {
      walk(child);
    }
  }
  for (const root of roots) {
    walk(root);
  }
  return result;
}

// Collect ancestor IDs for highlighting
function getAncestorIds(speciesId: string, allNodes: TreeNode[]): Set<string> {
  const nodeMap = new Map<string, TreeNode>();
  for (const n of allNodes) {
    nodeMap.set(n.species.id, n);
  }

  const ancestors = new Set<string>();
  let current = nodeMap.get(speciesId);
  while (current) {
    ancestors.add(current.species.id);
    const parentId = current.species.parentSpeciesId;
    current = parentId ? nodeMap.get(parentId) : undefined;
  }
  return ancestors;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipData {
  node: TreeNode;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLOT_HEIGHT = 28;
const NODE_RADIUS = 5;
const PADDING_LEFT = 12;
const PADDING_RIGHT = 80; // space for labels
const PADDING_TOP = 16;
const PADDING_BOTTOM = 16;
const MIN_CANVAS_HEIGHT = 120;
const EXTINCT_MARKER_SIZE = 3;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PhylogeneticTree({
  species,
  extinctSpecies,
  currentTick,
  selectedSpeciesId,
  onSelectSpecies,
}: PhylogeneticTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  // Build tree
  const roots = buildTree(species, extinctSpecies, currentTick);
  const allNodes = flattenTree(roots);
  const totalSlots = allNodes.length;
  const canvasHeight = Math.max(
    MIN_CANVAS_HEIGHT,
    totalSlots * SLOT_HEIGHT + PADDING_TOP + PADDING_BOTTOM,
  );

  // Highlighted path
  const highlightedIds = selectedSpeciesId
    ? getAncestorIds(selectedSpeciesId, allNodes)
    : new Set<string>();

  // Coordinate helpers
  const drawWidth = canvasWidth - PADDING_LEFT - PADDING_RIGHT;
  const maxTick = Math.max(currentTick, 1);

  const tickToX = useCallback(
    (tick: number) => PADDING_LEFT + (tick / maxTick) * drawWidth,
    [maxTick, drawWidth],
  );

  const slotToY = useCallback(
    (slot: number) => PADDING_TOP + slot * SLOT_HEIGHT + SLOT_HEIGHT / 2,
    [],
  );

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0] as ResizeObserverEntry | undefined;
      if (!entry) return;
      setCanvasWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Background
    ctx.fillStyle = BG_COLOUR;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw each node
    function drawNode(node: TreeNode): void {
      if (!ctx) return;
      const x1 = tickToX(node.startTick);
      const x2 = tickToX(node.endTick);
      const y = slotToY(node.y);

      const isHighlighted = highlightedIds.has(node.species.id);
      const isSelected = node.species.id === selectedSpeciesId;
      const colour = node.isExtinct
        ? EXTINCT_COLOUR
        : (TROPHIC_COLOURS[node.species.trophicLevel] ?? EXTINCT_COLOUR);

      // Branch line
      ctx.beginPath();
      ctx.strokeStyle = isHighlighted ? HIGHLIGHT_COLOUR : colour;
      ctx.lineWidth = isHighlighted ? 2.5 : node.isExtinct ? 1 : 1.5;
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      // Vertical connector from parent's line to this node
      if (node.species.parentSpeciesId) {
        const parentNode = allNodes.find((n) => n.species.id === node.species.parentSpeciesId);
        if (parentNode) {
          const parentY = slotToY(parentNode.y);
          const branchX = tickToX(node.startTick);
          ctx.beginPath();
          ctx.strokeStyle = isHighlighted ? HIGHLIGHT_COLOUR : colour;
          ctx.lineWidth = isHighlighted ? 2.5 : 1;
          ctx.moveTo(branchX, parentY);
          ctx.lineTo(branchX, y);
          ctx.stroke();
        }
      }

      // Tip node
      if (node.isExtinct) {
        // × marker for extinct
        ctx.beginPath();
        ctx.strokeStyle = isHighlighted ? HIGHLIGHT_COLOUR : EXTINCT_COLOUR;
        ctx.lineWidth = 1.5;
        ctx.moveTo(x2 - EXTINCT_MARKER_SIZE, y - EXTINCT_MARKER_SIZE);
        ctx.lineTo(x2 + EXTINCT_MARKER_SIZE, y + EXTINCT_MARKER_SIZE);
        ctx.moveTo(x2 + EXTINCT_MARKER_SIZE, y - EXTINCT_MARKER_SIZE);
        ctx.lineTo(x2 - EXTINCT_MARKER_SIZE, y + EXTINCT_MARKER_SIZE);
        ctx.stroke();
      } else {
        // Filled circle for living
        ctx.beginPath();
        ctx.arc(x2, y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? HIGHLIGHT_COLOUR : colour;
        ctx.fill();
        if (isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Label
      ctx.fillStyle = node.isExtinct ? '#737373' : '#d4d4d4'; // neutral-500 / neutral-300
      ctx.font = '10px ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      const labelX = x2 + (node.isExtinct ? EXTINCT_MARKER_SIZE + 4 : NODE_RADIUS + 4);
      ctx.fillText(node.species.name, labelX, y);

      // Draw children
      for (const child of node.children) {
        drawNode(child);
      }
    }

    for (const root of roots) {
      drawNode(root);
    }
  }, [
    canvasWidth,
    canvasHeight,
    roots,
    allNodes,
    currentTick,
    selectedSpeciesId,
    highlightedIds,
    tickToX,
    slotToY,
  ]);

  // Hit testing
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      // Find closest node tip
      let closest: TreeNode | null = null;
      let closestDist = Infinity;

      for (const node of allNodes) {
        const nx = tickToX(node.endTick);
        const ny = slotToY(node.y);
        const dist = Math.sqrt((mx - nx) ** 2 + (my - ny) ** 2);
        if (dist < 12 && dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }

      if (closest) {
        setTooltip({
          node: closest,
          x: e.clientX,
          y: e.clientY,
        });
        canvas.style.cursor = 'pointer';
      } else {
        setTooltip(null);
        canvas.style.cursor = 'default';
      }
    },
    [allNodes, canvasWidth, canvasHeight, tickToX, slotToY],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasWidth / rect.width;
      const scaleY = canvasHeight / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      for (const node of allNodes) {
        const nx = tickToX(node.endTick);
        const ny = slotToY(node.y);
        const dist = Math.sqrt((mx - nx) ** 2 + (my - ny) ** 2);
        if (dist < 12) {
          onSelectSpecies(node.species.id);
          return;
        }
      }
    },
    [allNodes, canvasWidth, canvasHeight, tickToX, slotToY, onSelectSpecies],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Empty state
  if (totalSlots === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-neutral-600">No species yet</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-auto">
      <canvas
        ref={canvasRef}
        style={{ width: canvasWidth, height: canvasHeight }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />

      {/* Tooltip */}
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 rounded border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 10,
          }}
        >
          <div className="font-medium text-neutral-200">{tooltip.node.species.name}</div>
          <div className="text-neutral-500">
            {tooltip.node.species.trophicLevel.charAt(0).toUpperCase() +
              tooltip.node.species.trophicLevel.slice(1)}{' '}
            · Gen {String(tooltip.node.species.generation)}
          </div>
          {tooltip.node.isExtinct ? (
            <div className="text-red-400">
              Extinct at tick {String(tooltip.node.extinctionTick ?? 0)} · Lived{' '}
              {String((tooltip.node.extinctionTick ?? 0) - tooltip.node.startTick)} ticks
            </div>
          ) : (
            <div className="text-neutral-400">
              Pop: {tooltip.node.species.memberCount.toLocaleString()} · Age{' '}
              {String(currentTick - tooltip.node.startTick)} ticks
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
