# BRF-002: Tick Loop, Canvas Biome Map & React Shell

**Radiate v0.1 "First Life" · Chunk 3**

**Commit message:** `add tick loop, biome map, population chart and species list`

---

## 1. Objective

Make the simulation come alive. Build the tick loop that advances the simulation over time, generate an initial world, and render it in the browser with a biome map, population chart, and species list.

### The Problem

We have types and an RNG (BRF-001), but nothing runs and nothing is visible. The engine needs a `tick()` function that takes a WorldState and returns the next state, a factory that generates a starting world, and a UI that renders the state to the screen.

This is the first chunk that crosses the engine/component boundary. The architecture contract is: engine produces WorldState, components consume it. No component may import from engine directly — they receive WorldState through a React hook.

### What BRF-002 Delivers

- ADR-002: Tick loop and time-jump strategy
- `tick()` function — single-species logistic growth with stochastic noise
- `createInitialState()` — generates a starting world with an 8×6 biome grid and one seed species
- HTML Canvas 2D biome map showing coloured biome cells with species population indicators
- Recharts population chart showing species population over time
- Species list panel
- React simulation hook managing the tick loop on an interval
- **Browser milestone: a living biome map with a fluctuating population**

---

## 2. Architecture Decisions

### Decision 1: Fixed-step Euler integration for the tick loop

The `tick()` function advances the simulation by a given number of seconds. It subdivides large time deltas into fixed-size steps (1 second each), running the population dynamics equation at each step.

**Why fixed-step Euler over other approaches:**

| Approach | How it works | Pro | Con |
|----------|-------------|-----|-----|
| **Fixed-step Euler** (chosen) | Subdivide delta into 1s steps, run equation each step | Simple, stable, extensible — any future dynamics "just work" | Slower for very large deltas (many steps) |
| Analytical solution | Solve the logistic equation exactly | O(1) for any delta | Only works for simple equations. The moment we add predator-prey (Chunk 4) or stochastic noise, there's no closed-form solution. We'd have to rewrite. |
| Adaptive step-size (RK4) | Variable step size based on error estimate | More accurate per step | Over-engineered for a game. We're not solving differential equations for science — we need "interesting enough" dynamics, not precision. |

Fixed-step Euler is the standard approach in game simulation. It generalises to any future dynamics (Lotka-Volterra in Chunk 4, speciation in Chunk 5) without architectural changes.

### Decision 2: Sub-tick cap for offline time-jumps

When the player returns after hours/days, the elapsed time could be very large. Rather than running millions of 1-second steps:

- **Max sub-ticks per call: 10,000.** If delta exceeds 10,000 seconds (~2.8 hours), increase step size proportionally. A week offline (604,800s) runs as 10,000 steps of ~60s each.
- This means long offline periods have lower temporal resolution — population fluctuations within each 60s step are averaged out. This is acceptable because:
  - The player wasn't watching anyway
  - The macro behaviour (species growth/decline toward equilibrium) is preserved
  - Performance is bounded: tick() always completes in <100ms regardless of delta

### Decision 3: Logistic growth as the v0.1 population model

For this chunk (single species), population dynamics use the **logistic growth equation**:

```
dP/dt = r × P × (1 - P/K) + noise
```

Where:
- `P` = current population in a biome
- `r` = growth rate (derived from species' reproductionRate trait)
- `K` = carrying capacity of the biome
- `noise` = multiplicative stochastic term: `P × σ × gaussian()`

This is the simplest non-trivial population model. It has two key behaviours:
1. **Exponential growth when small:** Population far below K grows rapidly
2. **Self-regulation near capacity:** Growth slows and oscillates around K

The stochastic noise makes it visually interesting — population fluctuates rather than converging to a flat line. Chunk 4 replaces this with full Lotka-Volterra, but the `tick()` function signature and architecture stay identical.

### Decision 4: Biome generation using simple noise

The initial world's biome properties (elevation, moisture) are generated using the RNG rather than Perlin noise. For an 8×6 grid (48 cells), Perlin noise is over-engineered. Instead:

- Each biome gets a random elevation (0–1) and moisture (0–1)
- Biome type is derived deterministically from temperature + elevation + moisture
- Adjacent biomes are smoothed slightly (average with neighbours) to create natural-looking clusters

This is sufficient for v0.1. If we want more realistic terrain in v0.2+, we can swap the generation algorithm without changing the WorldState shape.

### Decision 5: Population history is UI-only state

The population chart needs historical data (population at each tick), but WorldState only stores the current snapshot. Historical data is accumulated in the React component's local state — not in WorldState.

**Why not store history in WorldState:**
- WorldState would grow linearly with tick count (memory leak for long sessions)
- Persistence would save and load increasingly large objects
- History is a rendering concern, not a simulation concern

The chart stores the last N data points (e.g., 200) as a ring buffer in the `useSimulation` hook.

### Decision 6: Component architecture

```
App
├── BiomeMap (Canvas 2D)       — renders biome grid + species indicators
├── PopulationChart (Recharts) — line chart of population over time
└── SpeciesList                — list of species with stats
```

All three components receive WorldState (or derived data) as props. None import from `src/engine/`. The `useSimulation` hook in `src/components/` owns the simulation loop and provides state to `App`.

---

## 3. Detailed Design

### 3.1 `tick()` function (`src/engine/tick.ts`)

```typescript
function tick(state: WorldState, deltaSec: number): WorldState
```

Pure function. Takes current state and elapsed seconds, returns new state. Algorithm:

1. Compute number of sub-steps: `steps = min(deltaSec, MAX_SUB_TICKS)`, `stepSize = deltaSec / steps`
2. Create RNG from `state.rngState`
3. For each sub-step:
   a. For each species, for each biome with population > 0:
      - Compute growth: `r × P × (1 - P/K) × stepSize`
      - Add noise: `P × noiseFactor × gaussian() × sqrt(stepSize)`
      - New population = max(0, P + growth + noise)
      - If population < 1, species goes extinct in this biome (set to 0)
   b. Increment tick count and elapsed time
4. Save final RNG state
5. Return new WorldState

### 3.2 `createInitialState()` function (`src/engine/factory.ts`)

```typescript
function createInitialState(seed: number): WorldState
```

Generates a starting world:
- 8×6 grid of biomes with random elevation/moisture, smoothed with neighbours
- Biome types derived from temperature (default 20°C) + elevation + moisture
- One seed species ("Proto Alga") — a producer with balanced genome values
- Initial population distributed across habitable biomes (non-ocean, non-mountain)
- Default SimConfig values

### 3.3 Biome type derivation (`src/engine/biome.ts`)

```typescript
function deriveBiomeType(temperature: number, elevation: number, moisture: number): BiomeType
```

Simple threshold rules:
- elevation > 0.8 → 'mountain'
- elevation < 0.15 → 'ocean'
- temperature < 0 and elevation < 0.8 → 'tundra'
- moisture < 0.3 → 'desert'
- moisture > 0.6 → 'forest'
- else → 'grassland'

Temperature effect: as global temperature rises, thresholds shift — tundra retreats, desert expands. This is a placeholder for the richer environmental model in Chunk 5.

### 3.4 `useSimulation` hook (`src/components/useSimulation.ts`)

```typescript
function useSimulation(): {
  worldState: WorldState;
  populationHistory: PopulationSnapshot[];
  isPaused: boolean;
  togglePause: () => void;
}
```

- Creates initial state on mount using `createInitialState(seed)`
- Runs `tick(state, 1)` every second via `setInterval`
- Accumulates population snapshots (last 200 ticks) for the chart
- Provides pause/resume control

### 3.5 BiomeMap component (`src/components/BiomeMap.tsx`)

HTML Canvas 2D. Draws an 8×6 grid where each cell is coloured by biome type:
- Ocean: `#1a6b8a`
- Desert: `#c4a74e`
- Grassland: `#5b8c3e`
- Forest: `#2d5a1e`
- Tundra: `#b8c8d0`
- Mountain: `#6b6b6b`

Species population shown as opacity overlay or dot density on each cell. More population = more visible presence.

### 3.6 PopulationChart component (`src/components/PopulationChart.tsx`)

Recharts `LineChart` with:
- X-axis: tick number
- Y-axis: population count
- One line per species (different colour)
- Last 200 data points

### 3.7 SpeciesList component (`src/components/SpeciesList.tsx`)

List showing each species:
- Name
- Total population (sum across biomes)
- Trophic level
- Simple trend indicator (growing/stable/declining based on last 10 ticks)

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/tick.ts` | **NEW** — tick loop with logistic growth and time-jump handling | MEDIUM — core simulation loop, must be deterministic and stable |
| `src/engine/tick.test.ts` | **NEW** — determinism, invariant, and time-jump tests | LOW |
| `src/engine/factory.ts` | **NEW** — initial world generation | LOW — self-contained |
| `src/engine/factory.test.ts` | **NEW** — validates initial state structure | LOW |
| `src/engine/biome.ts` | **NEW** — biome type derivation from environment | LOW — pure function |
| `src/engine/biome.test.ts` | **NEW** — threshold tests | LOW |
| `src/engine/index.ts` | **MODIFIED** — re-export new modules | LOW |
| `src/App.tsx` | **MODIFIED** — full layout with three panels | MEDIUM — first real UI |
| `src/components/useSimulation.ts` | **NEW** — simulation loop hook | MEDIUM — bridges engine and React |
| `src/components/BiomeMap.tsx` | **NEW** — Canvas 2D biome renderer | LOW — rendering only |
| `src/components/PopulationChart.tsx` | **NEW** — Recharts population line chart | LOW — rendering only |
| `src/components/SpeciesList.tsx` | **NEW** — species stats list | LOW — rendering only |
| `docs/adr/002-tick-loop-and-time-jumps.md` | **NEW** — ADR for tick architecture | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/types.ts` | WorldState contract unchanged — this chunk consumes it |
| `src/engine/rng.ts` | RNG module consumed, not modified |
| All config files | No tooling changes |
| `src/data/` | Persistence deferred to Chunk 6 |

---

## 5. Concepts Introduced

**Logistic growth equation:** The simplest population model that's actually interesting. Population grows exponentially when small (lots of food, few competitors), then slows as it approaches the carrying capacity K (food becomes scarce). The formula `dP/dt = r × P × (1 - P/K)` produces an S-shaped curve — rapid initial growth levelling off to a plateau. In our simulation, stochastic noise prevents the flat plateau, creating realistic population fluctuations. This is the building block for the full Lotka-Volterra model in Chunk 4.

**Euler integration:** A method for simulating continuous processes in discrete time steps. Instead of solving the equation analytically (which is only possible for simple cases), we take small steps: "what's the population *right now*? → apply the growth rate for 1 second → that's the new population." Each step introduces a small error, but over many steps the behaviour is correct enough for a game. The step size (1 second) is a trade-off: smaller steps are more accurate but slower; larger steps are faster but less stable.

**Carrying capacity (K):** The maximum population a habitat can sustain. In ecology, this is determined by food, water, space, and other resources. In our simulation, each biome has a `baseCarryingCapacity`. When population approaches K, growth rate drops to zero. When population exceeds K (possible due to noise or migration), growth goes negative — population shrinks back down. This self-regulation prevents populations from exploding to infinity.

**Ring buffer for history:** Instead of storing every historical data point (which would grow forever), we keep only the last N points. When the buffer is full, the oldest point is discarded as a new one is added. This bounds memory usage regardless of how long the simulation runs.

---

## 6. Test Strategy

| # | Test | What It Verifies |
|---|------|-----------------|
| T1 | `tick(state, 1)` with fixed seed produces identical result on two calls | Determinism |
| T2 | Population converges toward carrying capacity over 100 ticks | Logistic growth behaviour |
| T3 | Population never goes negative after any tick | Core invariant |
| T4 | Population never exceeds 10× carrying capacity | Overflow guard |
| T5 | `tick(state, 3600)` — population near K, no crash | 1-hour time-jump |
| T6 | `tick(state, 86400)` — population within sane bounds | 1-day time-jump |
| T7 | `tick(state, 604800)` — no crash, population within bounds | 1-week time-jump |
| T8 | `tick(state, 0)` returns state unchanged (identity) | Zero-delta edge case |
| T9 | `createInitialState(42)` produces valid WorldState: all biomes present, one species, population > 0 | Factory correctness |
| T10 | `createInitialState(42)` and `createInitialState(42)` produce identical states | Factory determinism |
| T11 | `createInitialState(42)` and `createInitialState(99)` produce different states | Seed variation |
| T12 | `deriveBiomeType()` returns correct type for known inputs | Biome classification |
| T13 | Ocean and mountain biomes have zero initial species population | Uninhabitable biomes |

---

## 7. Acceptance Criteria

1. `tick()` is a pure function: `(WorldState, number) → WorldState`.
2. Population follows logistic growth toward carrying capacity.
3. Population never goes negative.
4. Time-jumps up to 604,800 seconds complete without crash and produce sane populations.
5. `createInitialState(seed)` generates a deterministic 8×6 world with one species.
6. Biome types derived correctly from temperature + elevation + moisture.
7. Canvas biome map renders a coloured grid with species population indicators.
8. Population chart shows species population over time (last 200 ticks).
9. Species list displays species name, population, and trophic level.
10. Simulation runs at ~1 tick/second via `useSimulation` hook.
11. Pause/resume control works.
12. No engine imports in any component file (architecture boundary enforced by ESLint).
13. All T1–T13 tests pass.
14. `npx tsc --noEmit` zero errors.
15. `npx eslint .` zero errors.

---

## 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Logistic growth with noise causes population instability (wild oscillations or instant extinction) | MEDIUM | Noise magnitude scales with `sqrt(stepSize)` and population size. Small populations get small absolute noise. Extinction threshold at population < 1 prevents negative values. Tuning parameters: noiseFactor in SimConfig. |
| Canvas rendering performance on large grids | LOW | 48 cells (8×6) is trivial for Canvas. Even 100×100 would be fine. Performance only matters at v0.5+ scale. |
| Recharts re-renders every tick (60fps waste for 1 tick/sec) | LOW | Chart only receives new data every tick (1/second). React's `memo` or `useMemo` prevents unnecessary re-renders. |
| `setInterval` drift over long sessions | LOW | For a 1-second interval, drift is negligible. We pass actual elapsed time to `tick()`, not a fixed 1.0, so accumulated drift doesn't affect simulation accuracy. |
| First real UI may reveal WorldState shape issues | MEDIUM | This is actually desirable — better to discover now with only 2 consumers (tick + factory) than after 6 modules depend on the shape. Any changes to types.ts at this stage have low blast radius. |

---

*Radiate · BRF-002 · Pre-Implementation Brief · March 2026*
