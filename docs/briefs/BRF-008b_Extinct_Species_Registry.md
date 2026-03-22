# BRF-008b: Extinct Species Registry

**Phase:** v0.2 "Naturalist" · Addendum to BRF-008
**Commit message:** `add extinct species registry for complete lineage tracking`

---

## 1. Objective

Species that go extinct are currently removed from `worldState.species`, losing their identity permanently. This breaks lineage resolution — the species card shows "Gen N" placeholders for extinct ancestors, and the upcoming phylogenetic tree (BRF-009) cannot render full evolutionary history.

### What BRF-008b Delivers

- New `extinctSpecies` array on WorldState containing minimal records of all species that have gone extinct
- Complete lineage resolution from any living species back to the seed species, regardless of how many ancestors have gone extinct
- Species cards for extinct species (clickable in lineage breadcrumbs)
- Save migration for existing worlds (adds empty `extinctSpecies` array)

### Design rationale

The two arrays (`species` and `extinctSpecies`) form a partition: every species that has ever existed is in exactly one. Living species are in `species` (mutable, used by the simulation). Extinct species are in `extinctSpecies` (immutable archive, never read by the engine for simulation purposes). This keeps the engine loop untouched — no filtering, no flags.

---

## 2. Architecture Decisions

### Decision 1: Approach A — separate `extinctSpecies` array

When a species goes extinct in `tick()`, push a record to `extinctSpecies` instead of silently dropping it. The `extinctSpeciesCount` field becomes derivable (`extinctSpecies.length`) but is kept for backward compatibility and O(1) access.

### Decision 2: Store full Species shape, plus `extinctionTick`

Rather than a minimal record (id + name), store the full `Species` interface plus an `extinctionTick` field. Cost is negligible (a few hundred bytes per extinction) and it enables:
- Species cards for extinct species (trait bars, biome distribution at time of death)
- Phylogenetic tree with trait data at branching points
- Future "museum" / bestiary of all species that ever lived

The type is `ExtinctSpecies = Species & { extinctionTick: number }`.

### Decision 3: Keep `extinctSpeciesCount` as derived consistency check

`extinctSpeciesCount` remains on WorldState but is now always equal to `extinctSpecies.length`. The migration sets it from the existing count. Going forward, `tick()` sets it from the array length.

---

## 3. Detailed Design

### 3.1 Type changes (`src/engine/types.ts`)

```typescript
export interface ExtinctSpecies extends Species {
  extinctionTick: number;
}

export interface WorldState {
  // ... existing fields ...
  extinctSpecies: ExtinctSpecies[];  // NEW
}
```

### 3.2 Tick changes (`src/engine/tick.ts`)

At the extinction handling block (lines 246–276), instead of just counting extinctions, push each extinct species to the new array:

```typescript
const newExtinctSpecies: ExtinctSpecies[] = extinctSpecies.map((s) => ({
  ...s,
  extinctionTick: finalTick,
}));

return {
  ...state,
  extinctSpecies: [...state.extinctSpecies, ...newExtinctSpecies],
  extinctSpeciesCount: state.extinctSpecies.length + newExtinctSpecies.length,
};
```

### 3.3 Factory changes (`src/engine/factory.ts`)

Add `extinctSpecies: []` to the initial state.

### 3.4 Migration (`src/data/persistence.ts`)

```typescript
if (!Array.isArray(state['extinctSpecies'])) {
  state['extinctSpecies'] = [];
}
```

Existing saves lose historical extinct species (they were never stored). The count is preserved. Going forward, all extinctions are archived.

### 3.5 SpeciesCard changes

- Lineage resolver searches both `allSpecies` and `extinctSpecies`
- Extinct ancestors are clickable → opens their card with an "Extinct" badge
- Extinct species cards show trait bars and final population distribution (frozen at death)

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/types.ts` | **MODIFIED** — add `ExtinctSpecies` interface, add `extinctSpecies` to WorldState | LOW — additive |
| `src/engine/tick.ts` | **MODIFIED** — populate `extinctSpecies` array on extinction | LOW — small change in existing extinction block |
| `src/engine/factory.ts` | **MODIFIED** — add `extinctSpecies: []` to initial state | LOW |
| `src/engine/index.ts` | **MODIFIED** — export `ExtinctSpecies` type | LOW |
| `src/data/persistence.ts` | **MODIFIED** — migration for missing `extinctSpecies` | LOW |
| `src/components/SpeciesCard.tsx` | **MODIFIED** — accept extinct species, show extinct badge, resolve lineage from both arrays | LOW |
| `src/components/App.tsx` | **MODIFIED** — pass `extinctSpecies` to SpeciesCard, allow selecting extinct species | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/interactions.ts` | Only operates on living species |
| `src/engine/speciation.ts` | Only operates on living species |
| `src/components/SpeciesList.tsx` | Only shows living species |

---

## 5. Acceptance Criteria

1. When a species goes extinct, it appears in `worldState.extinctSpecies` with correct `extinctionTick`.
2. `extinctSpeciesCount` equals `extinctSpecies.length` after every tick.
3. Lineage breadcrumbs resolve all ancestors (living or extinct) back to the seed species.
4. Clicking an extinct ancestor in the lineage opens its species card.
5. Extinct species cards show an "Extinct" badge and the tick of extinction.
6. Existing saves load correctly with an empty `extinctSpecies` array.
7. `npm run build` passes.
8. All existing tests pass, plus new tests for extinction archival.

---

## 6. Test Strategy

| # | Test | What it verifies |
|---|------|-----------------|
| T1 | Species that goes extinct appears in `extinctSpecies` with correct fields | Archival works |
| T2 | `extinctSpeciesCount === extinctSpecies.length` after tick with extinction | Count consistency |
| T3 | Extinct species is removed from `species` (not duplicated) | Partition invariant |
| T4 | `extinctionTick` matches the tick when extinction occurred | Correct timestamp |
| T5 | Multiple extinctions in one tick all archived | Batch handling |

---

*Radiate · BRF-008b · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
