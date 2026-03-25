# BRF-016: Individual-Based Model Engine Core

**Phase:** v0.3 "Living World" — Engine replacement
**Resolves:** DDR-011 (Individual-level genomes)
**Depends on:** Ecological gaps analysis (`docs/reports/ecological-gaps-and-roadmap.md`)

---

## 1. Objective

Replace the Lotka-Volterra population-level simulation engine with an Individual-Based Model (IBM) where every creature is an independent entity with its own genome, position, energy budget, and behavioural state. Population dynamics emerge from individual birth, death, feeding, and reproduction. What the player sees in 3D is the simulation.

### What BRF-016 Delivers

- **Creature type** — individual entities with genome, position (x/z), energy, age, trophic level, behavioural state
- **Spatial hash** — O(1) amortised neighbour queries for creature interactions
- **IBM tick loop** — trophic-ordered creature processing (producers → herbivores → predators)
- **Creature lifecycle** — photosynthesis, foraging, hunting, fleeing, metabolism, genome-derived lifespan, asexual reproduction
- **Sessile producers** — plants as lightweight creatures with density cap per biome
- **Genome clustering** — DBSCAN-like species recognition with stable IDs, replacing threshold-based speciation
- **25×25 grid** — 625 biomes replacing the 12×8 grid
- **100 seed creatures** — 50 producers, 30 herbivores, 20 predators
- **Save format v2** — v1 saves trigger clean restart (Lesson 3)
- **Dashboard compatibility** — `SpeciesCluster` structurally compatible with `Species`

### What BRF-016 Does NOT Deliver

- Web Worker for fast-forward (DDR-013, Session 5)
- Direct IBM creature rendering in 3D (DDR-015, Session 5)
- Edge-of-chaos regulator (Session 5)
- Sexual reproduction (future enhancement)
- Environmental disturbances (future session)

---

## 2. Design Decisions (resolved with owner)

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| Q1 | Starting creature count | 100 | Balance between early ecosystem dynamics and computational simplicity |
| Q2 | Energy constants | Documented in constants.ts | See energy budget analysis in section 3 |
| Q3 | Reproduction model | Asexual (clone + mutate) | Matches existing genome model; sexual reproduction adds complexity for MVP |
| Q4 | Clustering frequency | Tunable, start at 100 ticks | ~2 min at 1x speed; species don't change faster than this |
| Q5 | Creature lifespan | Genome-derived | BASE_LIFESPAN + size factor + metabolism factor; mimics real biology |
| Q6 | Grid size | 25×25 | Conservative for initial IBM validation; scale to 50×50 in Session 5 |
| Q7 | L-V engine fate | Delete | No practical value as fallback; clean codebase |
| Q8 | Producer model | Sessile creatures, lightweight tick, density cap | Unified creature model (plants evolve!) but minimal computational cost |
| Q9 | Web Worker | Session 5 | Get IBM working on main thread first |
| Q10 | Coordinate utilities | Extract to engine | `spatial-utils.ts` is authoritative; terrain.ts retains copies for now |

---

## 3. Energy Budget Analysis

The energy constants create a self-regulating trophic pyramid:

**Producers:** Gain ~0.49 energy/tick net (photosynthesis minus metabolism). ~200 ticks to reach reproduction threshold (100). With genome-derived lifespan ~235 ticks for average genome, each producer reproduces roughly once before dying. Density cap (20/biome) prevents exponential growth.

**Herbivores:** Gain 15 energy per producer consumed. Need ~7 meals to reproduce. Metabolism drains energy continuously. Must find food within detection range (15 world units) or starve.

**Predators:** Gain 25 energy per herbivore caught. Need ~4 meals but prey is rarer and harder to catch. Larger detection range (20 units) compensates.

**The metabolism r-K trade-off:** High-metabolism creatures grow faster but have shorter lifespans and higher energy costs. Low-metabolism creatures live longer but reproduce more slowly. This creates natural niche differentiation within species.

---

## 4. Implementation (4 commits)

| # | Commit | Files | Tests |
|---|--------|-------|-------|
| 1 | IBM foundation — constants, spatial utils, spatial hash | 6 new | 35 |
| 2 | Creature lifecycle + genome clustering | 4 new | 28 |
| 3 | IBM tick loop + WorldState IBM fields | 2 new, 3 modified | 15 |
| 4 | Atomic swap — wire IBM into app, delete L-V engine | 14 modified, 6 deleted | 173 total |

### New engine modules

| File | Purpose |
|------|---------|
| `src/engine/constants.ts` | All tunable IBM parameters with documented rationale |
| `src/engine/spatial-utils.ts` | Coordinate conversion (world ↔ biome grid) |
| `src/engine/spatial-hash.ts` | Grid-based spatial index for O(1) neighbour queries |
| `src/engine/creature.ts` | Creature lifecycle functions per trophic level |
| `src/engine/clustering.ts` | Genome clustering for species recognition |
| `src/engine/ibm-tick.ts` | IBM simulation loop (replaces tick.ts) |

### Deleted L-V modules

| File | Reason |
|------|--------|
| `src/engine/tick.ts` | L-V population dynamics — replaced by ibm-tick.ts |
| `src/engine/interactions.ts` | Matrix-based species interactions — replaced by individual encounters |
| `src/engine/speciation.ts` | Threshold-based speciation — replaced by genome clustering |

---

## 5. Test Strategy

**Deleted:** ~37 L-V-specific tests
**Kept:** ~65 model-independent tests (rng, genome, biome, sculpt, names, terrain, environment, persistence)
**New:** ~63 IBM tests (spatial-utils, spatial-hash, creature, clustering, ibm-tick)
**Final total:** 173 tests across 17 test files

Key test categories:
- **Invariants:** no negative energy, creatures stay on habitable terrain, population within bounds
- **Determinism:** same seed + delta → identical result
- **Trophic dynamics:** predator population lags herbivore, starvation without food
- **Lifecycle:** creatures die at lifespan, reproduce when energy sufficient
- **Clustering:** stable IDs, speciation/extinction event detection

---

*Radiate · BRF-016 · Implementation Brief · v0.3 "Living World" · March 2026*
