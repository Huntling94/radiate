# BRF-008: Species Cards / Bestiary

**Phase:** v0.2 "Naturalist" · Chunk 9
**Commit message:** `add species cards with detailed traits, lineage, biome distribution, and event history`

---

## 1. Objective

The current SpeciesList shows a compact summary: name, trophic level, population, generation, and 6 trait bars. This is good for at-a-glance monitoring, but the "Naturalist" phase promises players a deeper, more rewarding way to inspect their species — the field guide experience.

### What BRF-008 Delivers

- **Species card view** — click a species in the list to open a detailed card replacing the list content in the right sidebar
- **Full trait breakdown** — larger trait bars with numeric values, comparison to parent species traits (drift visualisation)
- **Lineage breadcrumb** — trace ancestry back through parent chain to seed species
- **Biome distribution** — mini heatmap or bar showing which biomes the species inhabits
- **Species event history** — filtered view of speciation/extinction/milestone events related to this species
- **Derived stats** — age (ticks since origin), biome count (niche breadth), genetic drift from parent

### Why this matters

In an idle evolution game, **species are the player's creations** — they're the emergent output the player cares about most. The bestiary transforms species from statistical rows into characters with stories, lineage, and ecological niches. It also lays groundwork for the phylogenetic tree (BRF-009), share codes (BRF-010), and image export (BRF-011) which all operate on individual species.

---

## 2. Architecture Decisions

### Decision 1: In-sidebar detail view (not a modal)

**Chosen:** When a species is clicked in the list, the sidebar content replaces the list with the species card. A back button returns to the list.

**Rejected alternative — modal overlay:** Modals feel application-like, not game-like. They obscure the map and break the feeling of observing a living world. The sidebar is already the species context panel; expanding it in-place keeps the player's eyes on the same screen region.

**Rejected alternative — wider panel / drawer:** Adding a wider drawer or expanding the sidebar would push the map and cause layout shifts. The 288px (w-72) sidebar is sufficient for a card layout — it just needs vertical scroll.

### Decision 2: Trait comparison via parent delta markers

Each trait bar shows the current value plus a small marker indicating the parent species' value at the same trait. This creates an instant "how has this species drifted?" visual without needing a separate comparison view.

For seed species (no parent), no delta marker is shown.

### Decision 3: Biome distribution as a mini grid

Rather than a text list of biomes, show a miniature version of the world grid where cells are coloured by this species' population density in each biome. Empty biomes are dark/neutral. This reuses the BiomeMap colour logic and gives an instant spatial intuition about where the species lives.

The mini grid is small — roughly 12×8 cells at ~8px each = 96×64px. Fits comfortably in the sidebar.

### Decision 4: Event history filtered from WorldState.events

No new data structures needed. Filter `worldState.events` by `speciesId === selectedSpecies.id`. Show newest-first, reusing EventLog's visual style but inline within the card.

Limitation: events are capped at 200 globally. A very long-running sim may have dropped early events for a species. This is acceptable for v0.2 — the event cap is a known constraint (DDR candidate if it becomes a problem).

### Decision 5: Lineage as a clickable breadcrumb

Show `Seed → Gen1 → Gen2 → [this species]` as a breadcrumb trail. Each ancestor name is clickable if the species is still alive (navigates the card to that species). Extinct ancestors are shown greyed out and non-clickable.

This is a lightweight lineage view. The full phylogenetic tree (BRF-009) will provide the comprehensive visual.

### Decision 6: Selection state lives in App, not in the hook

The `selectedSpeciesId` state is owned by `App.tsx` and passed down as props. The simulation hook doesn't need to know about UI selection — it remains a pure state manager.

---

## 3. Detailed Design

### 3.1 State management

```typescript
// In App.tsx
const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);

// Auto-clear selection if species goes extinct
useEffect(() => {
  if (selectedSpeciesId && !worldState.species.some(s => s.id === selectedSpeciesId)) {
    setSelectedSpeciesId(null);
  }
}, [worldState.species, selectedSpeciesId]);
```

### 3.2 SpeciesList changes

Add `onSelectSpecies` callback prop. Each species list item becomes clickable (cursor-pointer, hover state). No other changes to the list component.

```typescript
interface SpeciesListProps {
  species: Array<Species & { totalPopulation: number }>;
  extinctCount: number;
  onSelectSpecies: (id: string) => void;  // NEW
}
```

### 3.3 SpeciesCard component

New file: `src/components/SpeciesCard.tsx`

**Props:**
```typescript
interface SpeciesCardProps {
  species: Species & { totalPopulation: number };
  allSpecies: Species[];          // For lineage lookup
  biomes: Biome[];                // For distribution mini-grid
  events: SimEvent[];             // Full events array (filtered internally)
  currentTick: number;            // For age calculation
  onBack: () => void;             // Return to species list
  onSelectSpecies: (id: string) => void;  // Navigate to ancestor
}
```

**Layout (top to bottom, all within w-72 sidebar):**

```
┌─────────────────────────────────┐
│ ← Back to list                  │
├─────────────────────────────────┤
│ Species Name          PREDATOR  │
│ Gen 3 · Age 847 ticks           │
│ Pop: 1,234 across 7 biomes     │
├─────────────────────────────────┤
│ LINEAGE                         │
│ Primordius → Velocira → [this]  │
├─────────────────────────────────┤
│ TRAITS                          │
│ size         ████████░░  1.42   │
│              ↑ parent: 1.20     │
│ speed        ██████░░░░  0.89   │
│ ...                             │
├─────────────────────────────────┤
│ DISTRIBUTION                    │
│ ┌──────────────────────┐        │
│ │ [12×8 mini grid]     │        │
│ └──────────────────────┘        │
├─────────────────────────────────┤
│ HISTORY                         │
│ Tick 231: Speciated from...     │
│ Tick 189: ...                   │
└─────────────────────────────────┘
```

### 3.4 Trait bars with parent comparison

Each trait bar renders:
1. Bar background (neutral-800)
2. Filled bar to current value (trophic-coloured)
3. A thin vertical marker at the parent's trait value (white/50% opacity, 1px wide)
4. Numeric value to the right of the bar

```typescript
function DetailedTraitBar({ name, value, min, max, parentValue, colour }: {
  name: string;
  value: number;
  min: number;
  max: number;
  parentValue: number | null;
  colour: string;
}) { /* ... */ }
```

### 3.5 Biome distribution mini-grid

A small canvas or CSS grid rendering the world grid. Each cell's opacity maps to the species' population fraction in that biome (pop in biome / max pop across all biomes). Cells with zero population are `bg-neutral-900`. Populated cells use the species' trophic colour at varying opacity.

Implementation: CSS grid with divs (simpler than canvas for this size, no interactivity needed).

### 3.6 Lineage resolver

```typescript
function resolveLineage(species: Species, allSpecies: Species[]): Array<{
  id: string;
  name: string;
  alive: boolean;
}> {
  // Walk parentSpeciesId chain to root
  // Check if each ancestor is in allSpecies (alive) or not (extinct)
}
```

Note: extinct species are removed from `worldState.species`. We can only resolve lineage for ancestors that are still alive. Extinct ancestors in the chain will appear as gaps. This is a known limitation — future work (DDR candidate) could persist a minimal species registry for lineage tracking.

**Mitigation for v0.2:** The lineage breadcrumb shows what we can resolve. If the parent is extinct and gone from state, we show "Unknown ancestor" for that generation. The species' own `parentSpeciesId` and `generation` fields are always available, so we know the depth even if we can't name every ancestor.

### 3.7 Sidebar routing in App.tsx

```tsx
{/* Right sidebar */}
<div className="flex w-72 flex-col gap-4 overflow-auto border-l border-neutral-800/50 p-4">
  <TemperatureControl ... />
  {selectedSpeciesId ? (
    <SpeciesCard
      species={speciesWithPopulation.find(s => s.id === selectedSpeciesId)!}
      allSpecies={worldState.species}
      biomes={worldState.biomes}
      events={worldState.events}
      currentTick={worldState.tick}
      onBack={() => setSelectedSpeciesId(null)}
      onSelectSpecies={setSelectedSpeciesId}
    />
  ) : (
    <SpeciesList
      species={speciesWithPopulation}
      extinctCount={worldState.extinctSpeciesCount}
      onSelectSpecies={setSelectedSpeciesId}
    />
  )}
</div>
```

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/components/SpeciesCard.tsx` | **NEW** — Species detail card component | LOW — new file, no existing code modified |
| `src/components/SpeciesList.tsx` | **MODIFIED** — add `onSelectSpecies` prop, cursor-pointer on items, hover state | LOW — additive change |
| `src/App.tsx` | **MODIFIED** — add `selectedSpeciesId` state, conditional rendering in sidebar | LOW — small state addition |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/*` | No engine changes — all data already available in WorldState |
| `src/components/useSimulation.ts` | Selection is UI state, not simulation state |
| `src/data/persistence.ts` | No WorldState schema changes — no migration needed |

---

## 5. Acceptance Criteria

1. Clicking a species in the list opens its detail card in the sidebar.
2. A back button returns to the species list.
3. The card shows: species name, trophic level, generation, age (ticks since origin), total population, biome count.
4. All 6 traits are displayed with numeric values and visual bars.
5. Trait bars show a marker indicating the parent species' trait value (where parent is alive).
6. Lineage breadcrumb traces ancestry back toward seed species. Living ancestors are clickable.
7. Biome distribution mini-grid shows population density across the world grid.
8. Species event history shows all events related to this species (filtered from WorldState.events), newest first.
9. If the selected species goes extinct, the card automatically closes and returns to the list.
10. `npm run build` passes with zero errors.
11. All existing tests pass.

---

## 6. Test Strategy

No new engine code, so no new engine tests. The feature is purely presentational, consuming existing WorldState data.

**Manual verification:**
- Click species → card opens with correct data
- Click back → returns to list
- Click ancestor in lineage → navigates to that species' card
- Species goes extinct while card is open → returns to list
- Verify trait delta markers align with parent species values
- Verify mini-grid population distribution matches BiomeMap observations

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Extinct ancestors can't be resolved (not in WorldState.species) | MEDIUM | Show "Unknown ancestor" with generation number. Defer full lineage persistence to a DDR. |
| Event cap (200) means old species events may be dropped | LOW | Acceptable for v0.2. Note in DDR if it becomes a player pain point. |
| Mini-grid performance with frequent re-renders | LOW | CSS grid with 96 divs is trivially fast. No canvas needed. |

---

*Radiate · BRF-008 · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
