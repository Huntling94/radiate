# BRF-006: UI Overhaul — Game-Quality Visual Experience

**Radiate v0.2 "Naturalist" · Chunk 7**

**Commit message:** `overhaul UI with game-quality layout, richer map and species details`

---

## 1. Objective

Transform the functional-but-basic v0.1 interface into a polished game experience. The simulation engine is strong — the UI needs to match it. This chunk addresses layout, biome map richness, information density, and visual identity.

### The Problem

The current UI looks like a developer dashboard, not a game. Specific issues:
- Small 8x6 grid with tiny dots is hard to read
- No hover interactions — the player can't inspect biomes or species
- No visual identity (generic dark theme, no typography hierarchy)
- Species list shows minimal info (name and number)
- No tick speed control — player can only pause/resume
- Population chart shows IDs not names in tooltip

### What BRF-006 Delivers

**Layout:**
- Game-like dark theme with emerald/amber accent palette
- Three-panel layout: map (dominant), sidebar (species + controls), footer (chart)
- Responsive — works at 1280px+ width

**Biome map:**
- Larger cells with rounded corners and biome-appropriate gradient fills
- Species shown as proportional coloured segments within each cell
- Hover tooltip showing biome type, elevation, moisture, carrying capacity, species populations
- Temperature effect visible through colour temperature shifts

**Species panel:**
- Trait bars showing genome values visually (not just numbers)
- Population trend indicator (arrow up/down/stable)
- Collapsible species cards
- Extinct species count

**Controls:**
- Tick speed selector (0.5x, 1x, 2x, 5x)
- Elapsed time display in human-readable format
- Seed display for bug reports / sharing

**Chart:**
- Species names in tooltip (not IDs)
- Better colour contrast
- Y-axis auto-scaling

---

## 2. Architecture Decisions

### Decision 1: No new engine code

This is purely a UI chunk. The engine is untouched. All data comes from the existing WorldState interface. This validates the architecture boundary — the renderer is a view of state.

### Decision 2: Tick speed via interval adjustment

Tick speed control changes the `setInterval` delay in `useSimulation`, not the simulation itself. 2x speed means ticking every 500ms instead of 1000ms. The `tick()` function still receives actual elapsed time, so simulation correctness is unaffected.

### Decision 3: Tailwind-first styling

All styling through Tailwind utility classes. No custom CSS files beyond the Tailwind import. This keeps the styling co-located with components and avoids a separate CSS architecture.

### Decision 4: Canvas remains for the biome map

We stay with HTML Canvas 2D for the map. The richer visuals (gradients, rounded rects, hover detection) are all achievable with Canvas. Switching to SVG or a different renderer is unnecessary complexity for v0.2.

---

## 3. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/App.tsx` | **MODIFIED** — new layout structure, tick speed, elapsed time | MEDIUM |
| `src/components/BiomeMap.tsx` | **MODIFIED** — larger cells, gradients, species segments, hover tooltip | MEDIUM |
| `src/components/PopulationChart.tsx` | **MODIFIED** — species names, better colours, auto-scaling | LOW |
| `src/components/SpeciesList.tsx` | **MODIFIED** — trait bars, trend indicators, expandable cards | MEDIUM |
| `src/components/TemperatureControl.tsx` | **MODIFIED** — visual polish | LOW |
| `src/components/useSimulation.ts` | **MODIFIED** — tick speed control, elapsed time formatting | LOW |
| `src/components/BiomeTooltip.tsx` | **NEW** — hover tooltip for biome cells | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| All `src/engine/` files | UI-only chunk, engine untouched |
| `src/data/` | No persistence changes |
| All test files | No engine logic changes, existing tests verify unchanged behaviour |

---

## 4. Acceptance Criteria

1. Map cells are visually distinct by biome type with gradient fills.
2. Hovering a biome cell shows a tooltip with biome details and species populations.
3. Species are shown as coloured proportional segments within biome cells.
4. Species list shows trait bars for each genome value.
5. Tick speed can be changed between 0.5x, 1x, 2x, and 5x.
6. Elapsed time shown in human-readable format.
7. Population chart tooltips show species names, not IDs.
8. Layout is responsive at 1280px+ width.
9. All existing 78 tests pass without modification.
10. `npx tsc --noEmit` zero errors.
11. `npx eslint .` zero errors.

---

## 5. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Canvas hover detection is complex | LOW | Track mouse position, compute which cell is hovered from coordinates. Standard Canvas pattern. |
| Larger cells might not fit on small screens | LOW | Use CSS grid with min-width cells. At 1280px minimum, 8 cells fit comfortably at 80px each with gaps. |
| Tick speed > 1x may cause performance issues on slow devices | LOW | Tick function is fast (<5ms even at 3 species). 5x speed = 200ms interval, well within budget. Cap at 5x. |

---

*Radiate · BRF-006 · Pre-Implementation Brief · March 2026*
