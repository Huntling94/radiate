# BRF-005: Persistence, Offline Progression & Polish

**Radiate v0.1 "First Life" · Chunk 6 (Final)**

**Commit message:** `add save/load persistence, offline catch-up and UI polish`

---

## 1. Objective

Make the simulation persistent. The player can close the browser, return hours or days later, and the world continues from where it left off. Offline time is caught up via the existing time-jump mechanism. The UI is polished for the v0.1 release.

### The Problem

Currently, refreshing the page resets the simulation. All progress is lost. For an idle game, persistence is structural — the game's core value proposition is "your world evolves while you're away."

### What BRF-005 Delivers

- Auto-save WorldState to localStorage every 5 seconds and on tab blur
- Load saved state on startup with offline time catch-up
- "Welcome back" indicator showing elapsed time and what changed
- New game / reset controls
- UI polish: responsive layout, proper spacing
- WorldState snapshot tests for canonical scenarios
- Coverage audit toward 80% on `src/engine/`
- **Browser milestone: close browser, return, see what evolved. v0.1 complete.**

---

## 2. Architecture Decisions

### Decision 1: localStorage with versioned JSON

Save format: `{ version: 1, state: WorldState }`. The version field enables future migration if the WorldState shape changes.

**Why localStorage over IndexedDB:** WorldState at v0.1 scale is <50KB. localStorage handles this trivially. IndexedDB adds async complexity for no benefit at this size. We can migrate to IndexedDB later if world state grows significantly — the `src/data/` abstraction layer means components never call localStorage directly.

### Decision 2: Debounced auto-save

Save on a 5-second interval and immediately on `visibilitychange` (tab blur/close). Not every tick — saving 50KB every second is wasteful and causes UI jank on slower devices.

### Decision 3: Offline catch-up via existing tick()

On load, compute `Date.now() - state.lastTimestamp` and pass the elapsed seconds to `tick()`. The existing time-jump mechanism (ADR-002) handles deltas up to a week. This is architecturally free — we built it in Chunk 3.

### Decision 4: All persistence through src/data/ layer

Components never call localStorage. The `src/data/persistence.ts` module owns all storage operations. This matches CLAUDE.md architecture boundaries and makes the storage backend swappable.

---

## 3. Detailed Design

### 3.1 Persistence module (`src/data/persistence.ts`)

```typescript
const STORAGE_KEY = 'radiate-world-v1';

interface SaveFormat {
  version: number;
  state: WorldState;
}

function saveWorld(state: WorldState): void
function loadWorld(): WorldState | null
function clearWorld(): void
```

### 3.2 Offline catch-up in useSimulation hook

On mount:
1. Try `loadWorld()` — if found, compute elapsed time
2. If elapsed > 0, run `tick(state, elapsedSeconds)` for catch-up
3. Show brief "Welcome back" message with elapsed time

### 3.3 Auto-save integration

The `useSimulation` hook sets up:
- A 5-second `setInterval` calling `saveWorld(state)`
- A `visibilitychange` listener for immediate save on tab blur

### 3.4 New game / reset

- "New Game" button generates a new random seed and creates fresh state
- Clears localStorage

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/data/persistence.ts` | **NEW** — save/load/clear with versioned format | LOW |
| `src/data/persistence.test.ts` | **NEW** — round-trip, version check | LOW |
| `src/components/useSimulation.ts` | **MODIFIED** — load on mount, auto-save, offline catch-up | MEDIUM |
| `src/App.tsx` | **MODIFIED** — new game button, welcome back message | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| All engine modules | Persistence is a data layer concern, not engine |
| `src/engine/tick.ts` | Time-jump already works — just calling it with larger delta |

---

## 5. Test Strategy

| # | Test | What It Verifies |
|---|------|-----------------|
| T1 | `saveWorld()` then `loadWorld()` returns identical state | Round-trip |
| T2 | `loadWorld()` returns null when no save exists | Empty state |
| T3 | `clearWorld()` removes saved state | Reset |
| T4 | Saved format includes version number | Migration readiness |

---

## 6. Acceptance Criteria

1. WorldState auto-saves to localStorage every 5 seconds.
2. WorldState saves immediately on tab blur.
3. On page load, saved state is restored.
4. Offline time is caught up via `tick()`.
5. "New Game" button resets to fresh state and clears storage.
6. Save format is versioned for future migration.
7. No direct localStorage calls outside `src/data/`.
8. All T1-T4 tests pass.
9. All existing tests continue to pass.
10. `npx tsc --noEmit` zero errors.
11. `npx eslint .` zero errors.

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| localStorage quota exceeded | LOW | v0.1 WorldState is <50KB. localStorage limit is 5-10MB. Not a concern until hundreds of species. |
| Save format incompatible with future WorldState changes | MEDIUM | Version field enables migration. When loading v1 with a v2 reader, migration function transforms the shape. |
| Offline catch-up takes too long for very large deltas | LOW | Already handled by 10,000 sub-tick cap in tick(). A week offline processes in <100ms. |

---

*Radiate · BRF-005 · Pre-Implementation Brief · March 2026*
