# BRF-007: Event Log with Causal Attribution & Larger World Map

**Radiate v0.2 "Naturalist" · Chunk 8**

**Commit message:** `add event log with causal attribution and expand world map`

---

## 1. Objective

Record every significant simulation event (speciation, extinction, population milestone) with a causal explanation, and display it in a scrollable event log. Also expand the world map to a larger grid (12x8) that fills more of the screen.

### The Problem

The simulation produces emergent events — species branch, go extinct, populations crash — but none of it is recorded or explained. The player can't understand *why* something happened. The vision doc calls this "legibility over realism: causal attribution makes every outcome explicable."

Additionally, the 8x6 world feels small. A larger map gives more geographic diversity and room for species to spread, making the simulation more visually interesting.

### What BRF-007 Delivers

- Event recording in the engine (speciation, extinction, population milestones)
- Causal attribution: each event explains why it happened
- Scrollable event log panel in the UI
- Expanded world grid: 12x8 (96 biomes, up from 48)
- Map takes more screen space (flexible sizing)

---

## 2. Architecture Decisions

### Decision 1: Events stored in WorldState

Add `events: SimEvent[]` to WorldState. Events are appended during `tick()`. This is a WorldState contract change, but it's additive (new field, no existing fields modified). The ADR-001 "Deferred" section already anticipated this field.

Events are capped at the last 200 to prevent unbounded growth. Older events are discarded.

### Decision 2: Causal attribution via structured event data

Each event includes a `cause` string explaining what triggered it:

- Speciation: "Genetic distance reached 1.52 (threshold: 1.5). Key trait divergence: speed +0.3, metabolism -0.2"
- Extinction: "Population dropped below 1 in all biomes. Cause: no prey available in occupied biomes"
- Population milestone: "Proto Alga reached 5,000 total population across 20 biomes"

These are generated at event creation time using the simulation state, not reconstructed later.

### Decision 3: Grid size configurable via SimConfig

Change default `gridWidth` from 8 to 12 and `gridHeight` from 6 to 8. The grid size is already in SimConfig, so this is just a default change. All engine code already uses `config.gridWidth/gridHeight` — no hardcoded grid sizes to update.

### Decision 4: Map fills available space

The Canvas biome map scales to fill its container rather than using fixed cell sizes. Cell size is computed from container width / gridWidth. This makes the map responsive and dominant in the layout.

---

## 3. Detailed Design

### 3.1 Event types (`src/engine/types.ts`)

```typescript
interface SimEvent {
  id: string;
  tick: number;
  type: 'speciation' | 'extinction' | 'milestone';
  description: string;
  cause: string;
  speciesId: string | null;
}
```

### 3.2 Event recording in tick.ts

- After speciation: record event with genetic distance and trait divergence details
- After extinction: record event with cause (starvation, predation pressure, or population noise)
- Population milestones: when a species first exceeds 1000, 5000, 10000 total population

### 3.3 Event log panel (`src/components/EventLog.tsx`)

Scrollable panel showing events newest-first, with colour coding:
- Green for speciation (new life)
- Red for extinction (death)
- Blue for milestones (achievement)

### 3.4 Layout change

Move from two-column to three-section layout:
- Top: Map (dominant, flexible height) + Controls sidebar
- Middle: Event log (collapsible)
- Bottom: Population chart

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/types.ts` | **MODIFIED** — add SimEvent interface, events field to WorldState | MEDIUM — contract change |
| `src/engine/tick.ts` | **MODIFIED** — record events during tick | MEDIUM |
| `src/engine/speciation.ts` | **MODIFIED** — return cause details for event recording | LOW |
| `src/engine/factory.ts` | **MODIFIED** — grid 12x8, initialise empty events array | LOW |
| `src/engine/index.ts` | **MODIFIED** — re-export SimEvent | LOW |
| `src/components/EventLog.tsx` | **NEW** — scrollable event log panel | LOW |
| `src/components/BiomeMap.tsx` | **MODIFIED** — responsive cell sizing | MEDIUM |
| `src/App.tsx` | **MODIFIED** — layout with event log, larger map area | LOW |
| `src/engine/factory.test.ts` | **MODIFIED** — update for 12x8 grid | LOW |

---

## 5. Acceptance Criteria

1. Speciation events recorded with genetic distance and trait divergence.
2. Extinction events recorded with cause.
3. Event log panel displays events newest-first.
4. Events colour-coded by type.
5. World grid is 12x8 (96 biomes).
6. Map fills available container width.
7. Events capped at 200 (oldest discarded).
8. All existing tests pass (updated for new grid size).
9. `npx tsc --noEmit` zero errors.
10. `npx eslint .` zero errors.

---

*Radiate · BRF-007 · Pre-Implementation Brief · March 2026*
