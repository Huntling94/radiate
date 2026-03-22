# BRF-001: WorldState Contract & Seed-Based RNG

**Radiate v0.1 "First Life" · Chunk 2**

**Commit message:** `add WorldState types and seed-based RNG module`

---

## 1. Objective

Define the foundational data contract that every engine module and UI component will consume, and implement the seed-based random number generator that makes the simulation deterministic and reproducible.

### The Problem

The simulation engine needs a shared data shape (WorldState) that serves as the contract between:
- Engine modules (tick loop, population dynamics, speciation, environment)
- UI components (biome map, population chart, species list)
- The persistence layer (save/load)

If this shape is wrong, everything built on top of it needs rework. This is the highest-cost contract in the project — the velocity heuristic says "slow down, get it right."

Additionally, the simulation needs randomness (mutation, stochastic noise, speciation) but that randomness must be **reproducible**: given the same seed, the same simulation plays out identically. This enables deterministic testing, bug reproduction ("seed X, tick Y"), and future replay features.

### What BRF-001 Delivers

- `WorldState` interface and all supporting types — the contract for the entire v0.1
- ADR-001 documenting the shape, rationale, and what's deferred
- Seed-based PRNG with serialisable state (can be saved/loaded mid-simulation)
- Full test coverage on the RNG module

---

## 2. Architecture Decisions

### Decision 1: WorldState as a single immutable snapshot

The `WorldState` interface represents the entire simulation at a point in time. The `tick()` function (Chunk 3) will take a WorldState and return a new WorldState — pure function, no mutation. This pattern is called **immutable state** and it means:
- Every tick produces a new snapshot, making undo/replay trivially possible in future
- React can detect changes cheaply (reference equality)
- Debugging is easier — you can inspect any historical state
- Persistence is straightforward — serialise one object

**Trade-off:** Creates more garbage for the GC (garbage collector) than mutation-in-place. For our scale (dozens of species, 48 biomes), this is irrelevant — a WorldState will be <10KB. If we ever hit 10,000+ species, we'd reconsider (but that's a v0.5+ concern at earliest).

### Decision 2: Biomes as a flat array with grid coordinates

Biomes are stored as `Biome[]` with each biome having `(x, y)` grid coordinates, rather than a 2D array `Biome[][]`.

**Why flat array over 2D array:**
- Easier to iterate, filter, and map (common operations: "all biomes where temperature > X")
- Serialises cleanly to JSON (no nested arrays)
- Grid lookup is O(1) via a utility function `getBiome(biomes, x, y)` if needed
- The Canvas renderer iterates all biomes anyway — flat is natural

### Decision 3: Species population stored per-biome

Each species tracks its population in each biome individually (`populationByBiome: Record<string, number>`) rather than a single global total.

**Why per-biome:**
- Geographic speciation (Chunk 5) requires knowing where sub-populations are
- The biome map renderer needs per-biome population to show species distribution
- Carrying capacity is per-biome, so population dynamics must be per-biome
- Global population is derived: `totalPopulation = sum(Object.values(populationByBiome))`

### Decision 4: Genome as `number[]`

A species' genome is an array of floating-point numbers, where each index represents a trait (index 0 = size, index 1 = speed, etc.). A separate trait registry maps indices to names and ranges.

**Why `number[]` over an object/map:**
- Mutation is a simple loop: perturb each element
- Genetic distance is Euclidean distance: `sqrt(sum((a[i] - b[i])²))`
- Extensible: adding a new trait means extending the array and registry
- Compact for serialisation

**Trade-off:** Less self-documenting than `{ size: 0.7, speed: 0.4 }`. Mitigated by the trait registry and `expressTraits()` function that converts to named traits.

### Decision 5: xorshift128 for the PRNG

xorshift128 is a well-known pseudorandom number generator with:
- 128-bit state (4 × 32-bit integers) — serialisable as 4 numbers
- Period of 2^128 - 1 (effectively infinite for our purposes)
- Good statistical properties for game simulation (passes BigCrush)
- Fast: ~2ns per number

**Why not `Math.random()`:** Not seedable, not serialisable, not reproducible across platforms. Useless for deterministic testing or save/load.

**Why not a cryptographic RNG:** We need speed and reproducibility, not security. Crypto RNGs are ~100x slower and non-deterministic by design.

### Decision 6: Gaussian distribution via Box-Muller transform

Mutation and stochastic noise need normally distributed random numbers (most mutations are small, few are large). The Box-Muller transform converts two uniform random numbers into two independent standard normal values. Simple, well-understood, no external dependencies.

---

## 3. Detailed Design

### 3.1 Core interfaces (`src/engine/types.ts`)

```typescript
interface WorldState {
  tick: number                    // simulation tick count
  elapsedSeconds: number          // total simulated time
  lastTimestamp: number           // real-world Date.now() at last save
  temperature: number             // global temperature (player-controlled)
  biomes: Biome[]                 // flat array, grid coordinates on each biome
  species: Species[]              // all living species
  extinctSpeciesCount: number     // count of species that have gone extinct
  config: SimConfig               // simulation parameters
  rngState: RngState              // serialisable PRNG state for save/load
}

interface Biome {
  id: string                      // unique identifier
  x: number                       // grid column
  y: number                       // grid row
  elevation: number               // 0-1, affects biome type
  moisture: number                // 0-1, affects biome type
  biomeType: BiomeType            // derived from temp + elevation + moisture
  baseCarryingCapacity: number    // max population this biome supports
}

type BiomeType = 'ocean' | 'desert' | 'grassland' | 'forest' | 'tundra' | 'mountain'

interface Species {
  id: string                      // unique identifier
  name: string                    // generated name
  genome: number[]                // trait values (see trait registry)
  populationByBiome: Record<string, number>  // biome ID → population count
  trophicLevel: TrophicLevel      // producer, herbivore, or predator
  parentSpeciesId: string | null  // null for seed species
  originTick: number              // tick when this species first appeared
  generation: number              // 0 for seed species, parent.generation + 1
}

type TrophicLevel = 'producer' | 'herbivore' | 'predator'

interface SimConfig {
  seed: number                    // initial RNG seed
  ticksPerSecond: number          // simulation speed
  mutationRate: number            // probability of mutation per reproduction event
  mutationMagnitude: number       // stddev of mutation perturbation
  speciationThreshold: number     // genetic distance threshold for speciation
  gridWidth: number               // biome grid columns (default 8)
  gridHeight: number              // biome grid rows (default 6)
}

interface RngState {
  s0: number                      // xorshift128 state word 0
  s1: number                      // xorshift128 state word 1
  s2: number                      // xorshift128 state word 2
  s3: number                      // xorshift128 state word 3
}
```

### 3.2 Trait registry

```typescript
const TRAIT_REGISTRY = [
  { index: 0, name: 'size',           min: 0.1, max: 2.0 },
  { index: 1, name: 'speed',          min: 0.1, max: 2.0 },
  { index: 2, name: 'coldTolerance',  min: 0.0, max: 1.0 },
  { index: 3, name: 'heatTolerance',  min: 0.0, max: 1.0 },
  { index: 4, name: 'metabolism',     min: 0.1, max: 2.0 },
  { index: 5, name: 'reproductionRate', min: 0.1, max: 2.0 },
] as const
```

This is extensible — adding a trait means adding a row. The `expressTraits()` function maps `genome[i]` to named values using this registry.

### 3.3 RNG module (`src/engine/rng.ts`)

```typescript
interface Rng {
  next(): number           // uniform [0, 1)
  nextInt(min: number, max: number): number  // uniform integer [min, max]
  nextGaussian(): number   // standard normal (mean 0, stddev 1)
  getState(): RngState     // serialise current state
}

function createRng(seed: number): Rng
function createRngFromState(state: RngState): Rng
```

`createRng(seed)` initialises the 4-word state from a single seed using a splitmix64-style seed expansion. `createRngFromState(state)` restores from a saved state — this is how save/load preserves RNG continuity.

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/types.ts` | **NEW** — all core interfaces and type definitions | LOW — new file, no dependencies to break |
| `src/engine/rng.ts` | **NEW** — xorshift128 PRNG with seed expansion, Gaussian via Box-Muller | LOW — self-contained pure module |
| `src/engine/rng.test.ts` | **NEW** — determinism, distribution, serialisation tests | LOW |
| `src/engine/index.ts` | **MODIFIED** — re-export types and RNG | LOW |
| `docs/adr/001-worldstate-shape.md` | **NEW** — ADR documenting WorldState design decisions | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/App.tsx` | No UI changes in this chunk |
| `src/components/` | Not yet populated |
| All config files | Scaffolding complete from Chunk 1 |

---

## 5. Concepts Introduced

**Immutable state pattern:** Instead of modifying a data structure in place, every operation returns a new copy. This is standard in React (state updates) and functional programming. The benefit for simulation: any historical state can be inspected without corruption, and React's rendering optimisations work naturally.

**Pseudorandom number generator (PRNG):** An algorithm that produces a sequence of numbers that *appear* random but are fully determined by an initial seed. Same seed → same sequence, every time, on every machine. This is how games enable replay systems, deterministic netcode, and reproducible testing. `Math.random()` is a PRNG too, but you can't control its seed.

**Box-Muller transform:** A method to generate normally distributed random numbers from uniformly distributed ones. If you plot many values from `next()`, you get a flat distribution (every value equally likely). If you plot many values from `nextGaussian()`, you get a bell curve (most values near 0, few values far from 0). Mutations use the bell curve — most mutations are tiny, few are dramatic.

---

## 6. Test Strategy

| # | Test | What It Verifies |
|---|------|-----------------|
| T1 | `createRng(42)` produces identical first 100 values on two separate calls | Determinism — same seed, same sequence |
| T2 | `createRng(42)` and `createRng(99)` produce different sequences | Different seeds diverge |
| T3 | 10,000 calls to `next()` — all values in [0, 1) | Range bounds |
| T4 | 10,000 calls to `next()` — mean is within 0.02 of 0.5 | Uniform distribution |
| T5 | 10,000 calls to `nextGaussian()` — mean is within 0.05 of 0.0 | Gaussian mean |
| T6 | 10,000 calls to `nextGaussian()` — stddev is within 0.1 of 1.0 | Gaussian spread |
| T7 | `nextInt(1, 6)` over 10,000 calls — all values in [1, 6], none outside | Integer range |
| T8 | `getState()` after N calls → `createRngFromState(state)` → next M values match fresh `createRng(seed)` after N calls followed by M calls | Serialisation round-trip |
| T9 | All interfaces in `types.ts` compile without error (`tsc --noEmit`) | Type correctness |

---

## 7. Acceptance Criteria

1. `WorldState`, `Biome`, `Species`, `SimConfig`, `RngState` interfaces defined in `src/engine/types.ts`.
2. Trait registry defined with 6 initial traits.
3. `createRng(seed)` returns a deterministic PRNG.
4. `createRngFromState(state)` restores from serialised state with identical continuation.
5. `next()` returns values in [0, 1).
6. `nextInt(min, max)` returns integers in [min, max].
7. `nextGaussian()` returns approximately normally distributed values (mean ~0, stddev ~1).
8. All T1–T9 tests pass.
9. ADR-001 documents WorldState shape with context, decision, and consequences.
10. `npx tsc --noEmit` zero errors.
11. `npx eslint .` zero errors.

---

## 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| WorldState shape missing fields needed by later chunks | MEDIUM | Shape designed with all v0.1 chunks in mind (tick loop, dynamics, speciation, environment, persistence). ADR includes "Deferred" section listing fields explicitly excluded. If a later chunk reveals a gap, the blast radius is small (only Chunk 3 will depend on these types at that point). |
| Trait registry too rigid (wrong traits or ranges) | LOW | The registry is a constant array, trivially modified. Traits are consumed by index, so reordering breaks nothing. Adding a trait extends the array. |
| xorshift128 statistical properties insufficient for simulation | LOW | xorshift128 passes BigCrush. For game simulation (not cryptography), this is more than sufficient. If issues arise, the `Rng` interface abstracts the implementation — swap to a different algorithm with no consumer changes. |
| Gaussian distribution via Box-Muller produces rare extreme values | LOW | This is correct behaviour (fat tails exist in normal distributions). Mutation code in Chunk 5 will clamp values to trait ranges after applying perturbation. |

---

*Radiate · BRF-001 · Pre-Implementation Brief · March 2026*
