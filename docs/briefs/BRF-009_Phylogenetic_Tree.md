# BRF-009: Phylogenetic Tree

**Phase:** v0.2 "Naturalist" · Chunk 10
**Commit message:** `add interactive phylogenetic tree with living and extinct species`

---

## 1. Objective

The phylogenetic tree is identified in the vision document as one of two "primary shareable artifacts" (alongside the world map). It visualises the complete evolutionary history of a world — every species that has ever existed, how they branched from one another, and which survived.

Currently the only way to understand evolutionary relationships is via the lineage breadcrumb in the species card. This is linear (one path at a time). The phylogenetic tree shows the full picture: all branches, all extinctions, all living tips.

### What BRF-009 Delivers

- **Interactive phylogenetic tree** rendered on Canvas, showing every species (living and extinct) as nodes connected by branches
- **Time axis** — x-axis represents simulation ticks, so the tree grows left-to-right over time
- **Living vs extinct distinction** — living species are bright, extinct species are dimmed/greyed
- **Clickable nodes** — clicking a species node opens its species card in the sidebar
- **Highlighted ancestry path** — when a species is selected, its path from the root is highlighted
- **Tab system** — the tree occupies the bottom-left panel area, toggled via a tab alongside the existing event log and population chart
- **No new dependencies** — custom layout algorithm, Canvas rendering (proven pattern from BiomeMap)

---

## 2. Architecture Decisions

### Decision 1: Canvas rendering with custom tree layout

**Chosen:** Canvas 2D rendering using the same `useRef` + `useEffect` pattern proven in BiomeMap. Tree node positions computed by a simple depth-first layout algorithm.

**Rejected — SVG:** SVG gives free DOM events per node (no hit-testing math), but doesn't scale as well for large trees and makes future PNG export harder (canvas has `toDataURL()` natively). Since we already have the canvas hit-testing pattern from BiomeMap, the marginal cost is low.

**Rejected — visx/D3:** Adding a dependency for a layout algorithm we can implement in ~30 lines is unnecessary. The tree structure is simple: each species has at most one parent, and species counts will be in the tens, not thousands.

### Decision 2: Horizontal dendrogram with time on x-axis

**Chosen:** Root (seed species) on the left. Time flows left-to-right. Each speciation event creates a horizontal branch at the tick it occurred. Living species extend to the current tick (right edge). Extinct species terminate at their `extinctionTick`.

This is the standard phylogenetic layout used in biology (cladograms, FigTree, MEGA). It's intuitive: older = left, newer = right, and the rightmost tips are the living species.

**Rejected — vertical (top-down):** Works but wastes horizontal space in the wide bottom panel. Harder to label species names (they'd need to be rotated or very short).

**Rejected — radial:** Compact but harder to read, harder to implement, and doesn't convey time linearly.

### Decision 3: Tab system in the bottom-left panel

**Chosen:** Add a simple tab bar (`Events` | `Chart` | `Tree`) above the bottom-left panel area. Each tab shows one of: EventLog, PopulationChart, or PhylogeneticTree. Only one is visible at a time.

This avoids layout changes or additional scrolling. The bottom panel already has two sections (event log and population chart) — the tab system makes all three accessible without vertical stacking.

**Rejected — sidebar placement:** The sidebar is 288px (w-72). A phylogenetic tree needs horizontal space to show time progression meaningfully. The left panel (~700–900px) is far better.

**Rejected — dedicated full-screen view:** Overengineered for v0.2. Can be added later if the tree becomes a sharing/export focus.

### Decision 4: Layout algorithm — slot-based depth-first

Each species occupies a horizontal "slot" (y-position). The algorithm:

1. Build a children map from all species (living + extinct): `parentId → [childSpecies]`
2. Depth-first traversal from each seed species (parentSpeciesId === null)
3. Assign each species a y-slot in traversal order (ensures parent is vertically between its children)
4. x-position = `originTick` (scaled to canvas width)
5. Branch end x-position = `extinctionTick` for extinct species, or `currentTick` for living species
6. Draw horizontal line from originTick to end, with a vertical connector from parent's line to child's y-slot at the child's originTick

This is a simplified Reingold-Tilford. It produces clean non-overlapping trees for the expected scale (10–50 species).

### Decision 5: Interaction via canvas hit-testing

Reuse the BiomeMap pattern:
- On mouse move, check if cursor is within a node's bounding rectangle
- Show a tooltip with species name, trophic level, status (alive/extinct), generation
- On click, set `selectedSpeciesId` to navigate to that species' card

### Decision 6: No engine changes

All required data is already on WorldState:
- `species[]` — living species with `parentSpeciesId`, `originTick`, `generation`
- `extinctSpecies[]` — extinct species with the same fields plus `extinctionTick`

The tree is a pure view component. No new state, no new persistence.

---

## 3. Detailed Design

### 3.1 Tree data structure (computed per render)

```typescript
interface TreeNode {
  species: Species | ExtinctSpecies;
  isExtinct: boolean;
  startTick: number;        // originTick
  endTick: number;          // extinctionTick or currentTick
  children: TreeNode[];
  y: number;                // computed slot position
}
```

Built from `[...worldState.species, ...worldState.extinctSpecies]` by mapping `parentSpeciesId → children[]`. Seed species (parentSpeciesId === null) are the roots.

### 3.2 Layout computation

```typescript
function layoutTree(
  allSpecies: Species[],
  extinctSpecies: ExtinctSpecies[],
  currentTick: number,
): TreeNode[] {
  // 1. Build parentId → children map
  // 2. Find roots (parentSpeciesId === null)
  // 3. DFS from each root, assigning y-slots incrementally
  // 4. Return flat list of TreeNode with computed y positions
}
```

The y-slot assignment ensures:
- Children are adjacent
- Parent's y-position is the midpoint of its children's y-range
- No overlap between subtrees

### 3.3 Canvas rendering

```
              Seed species
  tick 0      tick 100     tick 250     tick 400 (now)
    │
    ├─────────────────────────── Proto Alga ──────►  (alive)
    │         │
    │         ├───────────────── Grazer ──────────►  (alive)
    │         │      │
    │         │      ├── Red Grazer ──── ×          (extinct t=300)
    │         │      │
    │         │      └────────── Sprinter ────────►  (alive)
    │         │
    │         └─── Stalker ──────────────────────►  (alive)
```

**Visual elements:**
- **Branch lines:** 1px neutral-600 for extinct, 2px trophic-coloured for living
- **Nodes:** Small circles at speciation points and at line tips
- **Living nodes:** Filled circle, trophic colour (green/amber/red)
- **Extinct nodes:** Hollow circle with × marker, neutral-600
- **Selected path:** Highlighted in emerald-400, thicker line from root to selected species
- **Labels:** Species name next to the tip node, `text-[10px]`, truncated if needed

**Scaling:**
- x-scale: `canvasWidth / currentTick` (or min 1px per tick, with horizontal scroll if needed)
- y-scale: `canvasHeight / totalSlots` with min spacing of 24px per slot

### 3.4 Tooltip

On hover over a node:
```
Proto Alga
Producer · Gen 0
Pop: 12,345 · 8 biomes
Alive since tick 0
```

For extinct:
```
Red Grazer
Herbivore · Gen 2
Extinct at tick 300
Lived 200 ticks
```

### 3.5 Tab system in App.tsx

```tsx
type BottomTab = 'events' | 'chart' | 'tree';
const [bottomTab, setBottomTab] = useState<BottomTab>('events');

{/* Tab bar */}
<div className="flex border-t border-neutral-800/50">
  {(['events', 'chart', 'tree'] as const).map((tab) => (
    <button key={tab} onClick={() => setBottomTab(tab)} ...>
      {tab === 'events' ? 'Events' : tab === 'chart' ? 'Chart' : 'Tree'}
    </button>
  ))}
</div>

{/* Tab content */}
{bottomTab === 'events' && <EventLog ... />}
{bottomTab === 'chart' && <PopulationChart ... />}
{bottomTab === 'tree' && <PhylogeneticTree ... />}
```

### 3.6 Component props

```typescript
interface PhylogeneticTreeProps {
  species: Species[];
  extinctSpecies: ExtinctSpecies[];
  currentTick: number;
  selectedSpeciesId: string | null;
  onSelectSpecies: (id: string) => void;
}
```

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/components/PhylogeneticTree.tsx` | **NEW** — Tree layout, Canvas rendering, interaction | MEDIUM — custom layout algorithm, but data is simple |
| `src/App.tsx` | **MODIFIED** — add bottom tab system, render PhylogeneticTree | LOW — additive, tab replaces stacked layout |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/*` | No engine changes — all data already on WorldState |
| `src/components/useSimulation.ts` | No new state needed |
| `src/data/persistence.ts` | No WorldState schema changes |
| `src/components/SpeciesCard.tsx` | Unchanged — tree clicks route through existing selectedSpeciesId |

---

## 5. Acceptance Criteria

1. The phylogenetic tree renders all living and extinct species as a horizontal dendrogram.
2. Time flows left-to-right. Seed species start at the left edge.
3. Living species branches extend to the right edge (current tick). Extinct branches terminate at their extinction tick.
4. Living species nodes are trophic-coloured (green/amber/red). Extinct nodes are greyed.
5. Clicking a node sets `selectedSpeciesId`, opening that species' card in the sidebar.
6. When a species is selected, the path from root to that species is highlighted.
7. Hover tooltip shows species name, trophic level, generation, population (or extinction info).
8. A tab bar (`Events` | `Chart` | `Tree`) switches the bottom-left panel content.
9. The tree handles worlds with 0 species gracefully (empty state message).
10. No new dependencies added.
11. `npm run build` passes.
12. All existing tests pass.

---

## 6. Test Strategy

No engine changes, so no new engine tests. The feature is a pure view component.

The layout algorithm (`layoutTree`) is a pure function that could be unit-tested, but the input/output shapes are visual (y-positions). If the algorithm proves fragile, we can extract it and add tests. For v0.2, manual verification is sufficient.

**Manual verification:**
- New game → 3 seed species appear as 3 horizontal lines from the left
- Let simulation run → speciation creates new branches at the correct tick
- Extinction → branch terminates with × marker at correct tick
- Click node → sidebar shows that species' card
- Tab switching works between Events, Chart, Tree
- Large tree (20+ species) doesn't overlap or overflow

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tree becomes visually cluttered with many species | MEDIUM | Min 24px vertical spacing between slots. Horizontal scroll if tree exceeds canvas width. Collapse extinct subtrees in a future iteration if needed. |
| Layout algorithm produces overlapping branches | LOW | DFS slot assignment with subtree size accounting prevents overlap by construction. |
| Canvas hit-testing with many nodes | LOW | Node count is small (tens, not thousands). Linear scan is fine. |
| Seed species from old saves (pre-registry) have no extinct ancestors | LOW | These appear as standalone roots. No data loss — just incomplete history for pre-registry worlds. |

---

*Radiate · BRF-009 · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
