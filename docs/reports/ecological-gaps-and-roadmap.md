# Ecological Gaps Analysis, Entity Model, & Development Roadmap

**Radiate — Idle Evolution Ecosystem Builder**
**Commissioned:** 25 March 2026 (Session 3)
**Updated:** 25 March 2026 (architectural decisions made)
**Author:** Claude (AI developer) with Will (product owner)
**Purpose:** Comprehensive analysis of the simulation architecture, missing ecological mechanics, map scaling strategy, and a prioritised roadmap for Sessions 4–7.
**Audience:** Future Claude Code sessions, Will, and any future collaborators.

---

## Table of Contents

1. [Current Engine Architecture](#1-current-engine-architecture)
2. [Architectural Decisions (DECIDED)](#2-architectural-decisions)
3. [The IBM Engine Design](#3-the-ibm-engine-design)
4. [Map Scaling Analysis](#4-map-scaling-analysis)
5. [Ecological Mechanics Analysis](#5-ecological-mechanics-analysis)
6. [Development Roadmap](#6-development-roadmap)
7. [Key Files Reference](#7-key-files-reference)
8. [Open Questions for Session 4](#8-open-questions-for-session-4)

---

## 1. Current Engine Architecture (v0.2 — to be replaced)

### 1.1 What exists today

The current simulation engine (`src/engine/`) uses **population-level Lotka-Volterra dynamics**. It tracks aggregate population counts per biome, not individual creatures. The 3D renderer creates 3–8 "cosmetic" creatures per species for visual storytelling, but these don't influence the simulation.

**Core equation:**
```
dPi/dt = ri × Pi × (1 - Σj(aij × Pj) / Ki) + noise
```

**Key data structure:**
```typescript
interface Species {
  populationByBiome: Record<string, number>;  // biome ID → aggregate count
  genome: Genome;                              // single shared genome per species
  // ... no individual creatures
}
```

### 1.2 Why it's being replaced

The L-V model served well for v0.1–v0.2 (proving the simulation concept, validating 3D rendering, establishing governance). But it has fundamental limitations:

1. **No individual creatures.** The 3D world shows cosmetic fakes, not the actual simulation. The player explores a decoration, not a living ecosystem.
2. **No spatial movement.** Populations are locked to biomes. Species can't colonise, migrate, or respond to terrain changes.
3. **No within-species variation.** All individuals of a species are identical (shared genome). No natural selection within populations.
4. **Speciation is artificial.** Triggered by a distance threshold on a single genome, not by geographic isolation or divergent selection on individuals.
5. **Ecological dynamics are prescribed, not emergent.** Growth rates, carrying capacities, and interaction coefficients are parameters in equations — not outcomes of creature behaviour.

### 1.3 What survives the transition

| Component | Status | Reason |
|-----------|--------|--------|
| `src/engine/genome.ts` | **Reusable** | Genome structure, mutation, trait expression, genetic distance — all applicable to individual genomes |
| `src/engine/biome.ts` | **Reusable** | Biome type derivation from elevation/moisture/temperature |
| `src/engine/environment.ts` | **Partially reusable** | Temperature fitness calculation applies to individuals |
| `src/engine/sculpt.ts` | **Reusable** | Terrain sculpting mechanics |
| `src/engine/names.ts` | **Reusable** | Species name generation |
| `src/engine/rng.ts` | **Reusable** | Deterministic PRNG for reproducibility |
| `src/engine/tick.ts` | **Replaced** | L-V population dynamics → individual creature simulation |
| `src/engine/interactions.ts` | **Replaced** | Matrix-based interactions → individual encounter-based |
| `src/engine/energy.ts` | **Replaced** | Trophic transfer equations → individual energy budgets |
| `src/engine/speciation.ts` | **Replaced** | Threshold-based splitting → emergent genome clustering |
| `src/engine/factory.ts` | **Heavily modified** | Creates individual seed creatures instead of population counts |
| `src/engine/types.ts` | **Heavily modified** | New `Creature` type, revised `WorldState`, species as derived groupings |
| `src/world3d/terrain.ts` | **Reusable** | Pure TS terrain generation, coordinate utilities |
| `src/world3d/terrain.test.ts` | **Reusable** | Terrain tests are engine-agnostic |
| `src/world3d/` (Babylon renderer) | **Modified** | Draws IBM creatures directly instead of cosmetic fakes |
| `src/components/` (dashboard) | **Modified** | Consumes new WorldState shape, species derived from genome clustering |
| `src/data/persistence.ts` | **Modified** | New save format for IBM state |

### 1.4 Key numbers (current configuration — for reference)

| Metric | Value | Notes |
|--------|-------|-------|
| Grid size | 12 × 8 (96 biomes) | Will scale to 100×100+ |
| Cell size | 10 world units per biome | `CELL_SIZE` in terrain.ts |
| World dimensions | 110 × 70 world units | Tiny — 4 seconds to cross |
| Terrain vertices | 2,881 | At 6 subdivisions per cell |
| Existing tests | 132 (14 files) | ~100 are L-V specific, will need replacement |
| Cosmetic creatures | 3–8 per species, ~20–80 total | Replaced by real IBM creatures |

---

## 2. Architectural Decisions (DECIDED)

These decisions were made by the product owner (Will) during Session 3 and are **not open for re-evaluation** without explicit owner approval.

### 2.1 Individual-Based Model (IBM) — DECIDED

**Decision:** Every creature is an independent entity with its own genome, position, energy budget, and behavioural state. Population dynamics emerge from individual birth, death, feeding, and reproduction. The Lotka-Volterra equation-based engine is deprecated.

**Rationale:**
- What the player sees IS the simulation. No cosmetic/engine split.
- Spatial dynamics emerge naturally from creature movement.
- Within-species variation enables genuine natural selection.
- Speciation emerges from geographic isolation + drift, not artificial thresholds.
- Starting with low population keeps computation manageable; complexity grows organically with the ecosystem.

### 2.2 Individual Genomes — DECIDED

**Decision:** Each creature has its own genome, inherited from its parent with mutation. Natural selection operates on individuals. Species is a derived grouping concept based on genome clustering, not a first-class entity that creatures belong to.

**Rationale:**
- Within-species diversity is visible and meaningful.
- Rare beneficial mutations can spread through a population.
- Speciation is a gradual, emergent process — not a sudden threshold event.
- Specimen collecting, rare finds, and individual creature stories become possible.

### 2.3 Simulation Time Model — DECIDED

**Decision:** The simulation is always running — even when the browser is closed. The game has three states:

| State | What happens | Player can... | Speed |
|-------|-------------|---------------|-------|
| **Real-time** | Creatures behave at normal speed. The world is fully interactive and rendered. | Explore, observe, interact, sculpt terrain, see individual behaviours | 1x (1 tick/sec) |
| **Fast-forward** | Player explicitly enters FF mode. A Web Worker runs the IBM at maximum speed. No rendering. Progress bar and event summary shown. Player can exit FF at any time. | Watch progress, stop when desired. This is the idle element — meaningful evolution takes real hours of fast-forward. | 100x–10,000x |
| **Browser closed** | The simulation **continues conceptually** at fast-forward speed. When the browser reopens, the game calculates what happened during the elapsed time by running the IBM at maximum speed in a Web Worker. | See a catch-up progress bar on return. Stop catch-up early if desired. Review what evolved. | Catch-up at max speed |

**How it works:**

1. **Real-time play:** IBM ticks at ~1/sec. Full 3D rendering, creature AI, player interaction. This is the "play the game" mode.

2. **Explicit fast-forward:** Player triggers FF (like sleeping in a game). A Web Worker runs the IBM tick loop with no rendering overhead. The main thread shows:
   - Progress bar (ticks computed / estimated total)
   - Running population count, species count
   - Notable events as they occur (speciation, extinction, disturbances)
   - "Stop" button to exit FF at any point and resume real-time

3. **Browser close → catch-up on return:** The game records `lastTimestamp` when the browser closes (via `visibilitychange` or `beforeunload`). When reopened, it calculates elapsed real time and runs the IBM at max speed to catch up.
   - **Computational cap:** Catch-up is capped at a maximum duration (e.g., "simulate up to 24 hours of evolution, then stop"). This prevents multi-day absences from requiring hours of computation.
   - **Progress bar:** The catch-up shows the same FF progress UI. The player sees evolution unfolding as a summary.
   - **Early stop:** The player can halt catch-up at any point and enter real-time with whatever state has been computed so far. The world is valid at any interruption point.
   - **Persistence:** WorldState (including all creature data) is saved to localStorage/IndexedDB periodically during FF and on browser close. The catch-up starts from the last saved state, not from the moment the browser closed — so some time may be "lost" (minutes, not hours).

**Catch-up computational profile:**

| Elapsed time | Creatures | Ticks to compute | Est. catch-up time (Web Worker) |
|-------------|-----------|-------------------|---------------------------------|
| 1 hour | 1,000 | 3,600 | < 1 sec |
| 1 hour | 10,000 | 3,600 | ~5 sec |
| 8 hours | 5,000 | 28,800 | ~30 sec |
| 8 hours | 50,000 | 28,800 | ~5 min |
| 24 hours | 10,000 | 86,400 | ~2 min |
| 24 hours | 50,000 | 86,400 | ~15 min |

These are estimates assuming ~1M creature-updates/sec in a Web Worker. Actual performance depends on spatial hash efficiency and creature behaviour complexity. The key design lever is the **catch-up cap** — limiting how many ticks are computed regardless of elapsed time.

**Rationale:**
- The world feels alive. It evolved while you were away. This is the core idle game fantasy.
- The catch-up cap prevents runaway computation while preserving the "time passed" feeling.
- Early-stop lets the player choose how much evolution they want to process.
- The progress bar is itself a game experience — watching species counts rise and fall, seeing extinction events scroll by, anticipating what the world looks like now.
- Periodic persistence means browser crashes don't lose significant progress.

---

## 3. The IBM Engine Design

### 3.1 Core data model

```typescript
interface Creature {
  id: string;
  genome: Genome;              // individual genome (6 float traits, same structure as current)
  position: { x: number; z: number };  // continuous world position
  energy: number;              // current energy budget (0 = death)
  age: number;                 // ticks since birth
  state: CreatureState;        // 'idle' | 'foraging' | 'fleeing' | 'hunting' | 'reproducing'
  trophicLevel: TrophicLevel;  // derived from genome or inherited
  parentId: string | null;     // for lineage tracking
  generation: number;          // depth in phylogenetic tree
  speciesClusterId: string;    // assigned by clustering algorithm, updated periodically
}

// Species is a DERIVED concept, not a first-class entity
interface SpeciesCluster {
  id: string;
  centroidGenome: Genome;      // average genome of members
  memberCount: number;
  trophicLevel: TrophicLevel;
  name: string;                // generated name
  color: Color;                // derived from centroid genome
  appearedAtTick: number;
}
```

### 3.2 IBM tick loop (per tick)

Each tick, every creature executes this pipeline:

1. **Sense environment:** Query spatial hash for nearby food, predators, mates. Check current biome type and conditions.
2. **Decide action** (state machine):
   - **Producer:** Absorb energy from biome. Reproduce if energy > threshold. Die if energy ≤ 0.
   - **Herbivore:** Search for nearest producer within detection range. Move toward it. Eat (transfer energy). Flee from nearby predators. Reproduce if energy > threshold.
   - **Predator:** Search for nearest herbivore within detection range. Chase. Catch (speed-dependent probability). Eat (transfer energy). Reproduce if energy > threshold.
3. **Move:** Update position based on state and speed trait. Check `isPositionHabitable()`. Ocean and mountain are impassable.
4. **Metabolise:** Deduct energy per tick based on metabolism trait (the cost of being alive). Larger creatures cost more.
5. **Age:** Increment age. Check against lifespan (derived from genome or constant).
6. **Die** if energy ≤ 0 or age > lifespan. Remove from spatial hash. Record death event.
7. **Reproduce** if energy > reproduction threshold:
   - Spend energy (reproduction cost).
   - Create offspring at nearby position.
   - Offspring genome = parent genome + mutation (Gaussian perturbation, same as current `mutateGenome()`).
   - Offspring starts with fraction of parent's energy.

### 3.3 Speciation (emergent, not triggered)

**No explicit speciation trigger.** Instead:

1. **Genome clustering** runs periodically (every N ticks, not every tick — it's O(C²) where C = creature count).
2. Clustering algorithm (e.g., DBSCAN or simple distance-based grouping) groups creatures by genetic similarity.
3. When a cluster splits into two distinct groups (separated by genetic distance > threshold in trait space), a new species is recognised.
4. When two clusters merge (previously separated populations reconnect and interbreed), species may be merged.
5. Species names, colours, and IDs are stable — the clustering provides continuity, not reinvention each time it runs.

**How speciation actually happens:**
- A mountain range separates two populations of the same species (geographic barrier).
- Over many generations, both populations mutate independently.
- Environmental differences (temperature, food availability) create different selection pressures.
- Genomes drift apart. Eventually the clustering algorithm recognises two distinct species.
- If the barrier is removed (player sculpts terrain), the populations may reconnect. If genomes are close enough, they remerge. If too distant, they remain separate species and may compete.

This is **allopatric speciation** — the most common mechanism in real ecology — and it emerges for free from the IBM + spatial world.

### 3.4 Energy model

Energy is the currency that connects everything:

| Source | Mechanism |
|--------|-----------|
| **Sunlight → Producers** | Producers in habitable biomes gain energy per tick proportional to biome productivity (forest > grassland > desert > tundra). Same `biomeEnergy()` calculation from current `energy.ts`. |
| **Producers → Herbivores** | Herbivore eats a producer → producer loses energy (or dies), herbivore gains a fraction (transfer efficiency ~10–30%, governed by traits). |
| **Herbivores → Predators** | Same mechanism. Predator catches and eats herbivore. |
| **Metabolism cost** | Every creature loses energy per tick: `cost = baseCost × size × metabolism`. This is the cost of being alive. |
| **Reproduction cost** | Offspring creation costs energy: `cost = offspringStartEnergy + fixedOverhead`. |
| **Death → Nutrient pool (future)** | Dead creatures could add to a biome nutrient pool that boosts producer energy. Deferred to a later session. |

### 3.5 Computational profile

| Creature count | Ops/tick (with spatial hash) | Feasibility at 1x | Feasibility at 100x |
|----------------|-----------------------------|--------------------|---------------------|
| 100 | ~1,000 | Trivial | Trivial |
| 1,000 | ~10,000 | Easy | Easy |
| 5,000 | ~50,000 | Easy | Feasible |
| 10,000 | ~100,000 | Feasible | Needs Web Worker |
| 50,000 | ~500,000 | Needs Web Worker | Needs optimisation |
| 100,000 | ~1,000,000 | Web Worker + spatial culling | Challenge |

**Starting target:** 100–500 creatures (seed population). Grow to 5,000–10,000 as ecosystem matures. Web Worker handles fast-forward at any count.

**Spatial hashing:** O(1) amortised neighbour lookups. Cell size = max detection range (~20 world units). Eliminates the O(N²) all-pairs distance checks that would otherwise be the bottleneck.

---

## 4. Map Scaling Analysis

### 4.1 Target world sizes

| Scale | Grid | World extents | Walk time (30 u/s) | Character |
|-------|------|---------------|---------------------|-----------|
| Current | 12 × 8 | 110 × 70 | 4 sec | Proof of concept |
| **Near-term** | **50 × 50** | **490 × 490** | **23 sec** | **Small island** |
| **Medium-term** | **100 × 100** | **990 × 990** | **47 sec** | **Continent** |
| Aspirational | 500 × 500 | 4,990 × 4,990 | 4 min | Open world |

### 4.2 What scales and what breaks

#### Terrain rendering

| Grid | Vertices (6 subdiv) | Memory | Solution |
|------|---------------------|--------|----------|
| 50×50 | 87K | 5 MB | Direct render (fine) |
| 100×100 | 348K | 21 MB | LOD for distant terrain |
| 500×500 | 8.7M | 520 MB | **Chunked terrain** — render only near camera |

**Chunked terrain** (needed at 100×100+): Divide world into 16×16 biome chunks. Full-resolution terrain near camera; low-poly or flat-colour distant chunks. Babylon's `Mesh.createInstance()` and LOD system support this natively.

#### Creature rendering

With IBM, creature count grows with the ecosystem. At 10,000 creatures with ~500 vertices each = 5M vertices total. Solutions:

1. **Distance culling:** Only create Babylon meshes for creatures within render distance (~200 units). Creatures beyond that exist in the spatial registry but have no mesh.
2. **Instancing:** Same-species creatures share geometry via `createInstance()`. Reduces draw calls from thousands to dozens.
3. **LOD:** Distant creatures rendered as simple billboards or dots. Close creatures get full mesh.

#### Simulation computation (IBM)

The bottleneck shifts from O(biomes × species) to O(creatures) per tick. With spatial hashing, each creature's sense/decide/move is O(1) amortised. The total per-tick cost is linear in creature count.

| Creatures | Ops/tick | At 100x FF | Web Worker needed? |
|-----------|----------|------------|-------------------|
| 1,000 | 10K | 1M/sec | No |
| 10,000 | 100K | 10M/sec | Yes |
| 50,000 | 500K | 50M/sec | Yes + optimisation |

**Web Worker architecture for fast-forward:**
- Main thread: sends "start fast-forward" message with current WorldState
- Worker: runs IBM tick loop at maximum speed, no rendering
- Worker: periodically posts progress updates (tick count, population, events) to main thread
- Main thread: displays progress summary
- Player exits fast-forward: worker posts final WorldState, main thread resumes rendering

### 4.3 Recommended scaling path

| Phase | Grid | Key changes |
|-------|------|-------------|
| Session 4 | 25×25 (625 biomes) | Build IBM engine, spatial hash, basic rendering |
| Session 5 | 50×50 (2,500 biomes) | Distance culling, instancing, Web Worker for FF |
| Session 6–7 | 100×100 (10,000 biomes) | Chunked terrain, LOD creatures |
| Future | 500×500+ | Procedural biome generation, regional simulation |

---

## 5. Ecological Mechanics Analysis

### 5.1 What IBM gives us for free

Many ecological mechanics that required explicit implementation in the L-V model **emerge naturally** from individual-based simulation:

| Mechanic | L-V model | IBM |
|----------|-----------|-----|
| **Spatial dispersal** | Required new diffusion equations between biomes | **Free.** Creatures walk. They cross biome boundaries by moving. |
| **Allee effects** | Required explicit growth modifier for small populations | **Free.** Small populations = fewer individuals = harder to find mates = fewer offspring. |
| **Ecological succession** | Would need explicit pioneer/climax species roles | **Free.** Fast-reproducing, stress-tolerant species colonise disturbed areas first. Slow-growing competitors displace them over time. |
| **Density-dependent dispersal** | Required population/K ratio calculation | **Free.** Overcrowded areas have less food per individual. Hungry creatures wander further. |
| **Within-species variation** | Impossible (single shared genome) | **Free.** Every creature has its own genome. Bell curves of trait values within populations. |
| **Natural selection** | Implicit in L-V coefficients (traits affect growth rate) | **Explicit.** Individuals with better traits survive longer, eat more, reproduce more. Their genes spread. |
| **Geographic speciation** | Artificial threshold on genome distance | **Free.** Separated populations drift apart genetically. |
| **Predator-prey spatial dynamics** | Abstract coefficient in interaction matrix | **Explicit.** Predators chase prey. Prey flee. Speed matters. The hunt is visible. |
| **Starvation** | Binary check (has prey species = lives, doesn't = 50% penalty) | **Explicit.** Individual energy budgets. No food nearby = energy drains = death. |

### 5.2 What still needs explicit implementation

| # | Mechanic | Priority | Why it's still needed |
|---|----------|----------|----------------------|
| 1 | **Environmental disturbances** | **Session 4** | Wildfires, droughts, cold snaps don't emerge from individual behaviour. They are exogenous events that modify biome conditions. Still need a disturbance system that reduces biome energy production, kills vegetation, etc. |
| 2 | **Biome energy production** | **Session 4** | Producers need a mechanism to gain energy from their biome. The current `biomeEnergy()` function from `energy.ts` can be reused. Sunlight → producer energy is an input to the system, not an emergent property. |
| 3 | **Edge-of-chaos regulator** | **Session 4–5** | The simulation can still stagnate (everything goes extinct) or explode (one species dominates). A regulator that monitors diversity and nudges mutation rate, energy production, or disturbance frequency prevents degenerate states. |
| 4 | **Seasonal cycles** | **Session 5–6** | Temperature variation over time doesn't emerge from creature behaviour. Still need sinusoidal temperature modulation applied to the biome system. |
| 5 | **Nutrient cycling** | **Session 6+** | Dead biomass feeding back into producer energy is a system-level process, not individual behaviour. Add nutrient pool per biome, fed by deaths, boosting producer energy gain. |
| 6 | **Disease / parasitism** | **Later** | Could be modeled as individual-level infection (creature-to-creature transmission). More complex than L-V disease (which was just a density modifier). Defer until IBM is stable. |
| 7 | **Mutualism / symbiosis** | **Later** | Individual-level mutualism: creature A provides resource to creature B, creature B provides resource to creature A. Interesting but complex. Defer. |

### 5.3 Updated priority matrix

| # | Mechanic | IBM status | Explicit work needed | Priority |
|---|----------|-----------|---------------------|----------|
| 1 | Spatial dispersal | **Free** | None — creatures walk | — |
| 2 | Allee effects | **Free** | None — mate-finding difficulty | — |
| 3 | Ecological succession | **Free** | None — emergent from colonisation speed | — |
| 4 | Within-species variation | **Free** | None — individual genomes | — |
| 5 | Natural selection | **Free** | None — differential survival/reproduction | — |
| 6 | Geographic speciation | **Free** | Genome clustering algorithm needed | Session 4 |
| 7 | Biome energy production | Reuse existing | Wire into individual producer energy gain | Session 4 |
| 8 | Environmental disturbances | Not emergent | New disturbance system | Session 4 |
| 9 | Edge-of-chaos regulator | Not emergent | New regulator system | Session 4–5 |
| 10 | Seasonal cycles | Not emergent | Temperature modulation | Session 5–6 |
| 11 | Nutrient cycling | Not emergent | Nutrient pool per biome | Session 6+ |
| 12 | Disease / parasitism | Could be individual-level | Infection mechanics | Later |
| 13 | Mutualism | Could be individual-level | Resource exchange mechanics | Later |
| 14 | Age/stage structure | **Free** (if age affects traits) | Optional: age-dependent energy cost | Low priority |

---

## 6. Development Roadmap

### 6.1 Strategic context

The decision to build an IBM engine is a **major scope commitment**. It effectively replaces the core of the application. The roadmap must reflect this:

- **Session 4 is almost entirely engine work.** Building the IBM from scratch is the priority. No new game features, no social layer, no visual polish.
- **The existing L-V engine continues to run** until the IBM reaches feature parity. The transition is not a flag day — it's a gradual replacement.
- **Testing is critical.** The IBM must produce stable, interesting dynamics before any other work builds on it. Premature feature work on an unstable simulation is wasted.

### 6.2 Session 4: "Living World" — Build the IBM engine

**Goal:** Replace the L-V population dynamics with an individual-based model. Every creature in the 3D world IS the simulation.

| # | Deliverable | Scope |
|---|-------------|-------|
| 1 | `Creature` type and spatial registry | New types, spatial hash, position-to-biome mapping |
| 2 | IBM tick loop | Sense → Decide → Move → Metabolise → Age → Die → Reproduce |
| 3 | Individual genomes with inheritance + mutation | Reuse `genome.ts` mutation, apply per-creature |
| 4 | Energy model | Biome → producer energy gain, predation energy transfer, metabolism cost |
| 5 | Genome clustering for species recognition | Periodic DBSCAN or distance-based grouping |
| 6 | Renderer integration | Draw IBM creatures directly (replace cosmetic creature system) |
| 7 | Grid size increase to 25×25 | Larger world for spatial dynamics |
| 8 | Basic disturbance system | Wildfire, drought, cold snap (exogenous biome modifiers) |
| 9 | Save migration | New WorldState format with creature array |
| 10 | Tests | New IBM-specific tests: creature lifecycle, energy conservation, reproduction, spatial hash |

**Architecture:**
- New `src/engine/creature.ts` — Creature type, lifecycle (birth, death, reproduction)
- New `src/engine/spatial-hash.ts` — Grid-based spatial indexing for O(1) neighbour queries
- New `src/engine/ibm-tick.ts` — The IBM tick loop (replaces `tick.ts`)
- New `src/engine/clustering.ts` — Genome clustering for species recognition
- New `src/engine/disturbance.ts` — Stochastic disturbance generation and application
- Modified `src/engine/types.ts` — New WorldState with `creatures: Creature[]`, derived `speciesClusters`
- Modified `src/engine/factory.ts` — Create individual seed creatures
- Modified `src/world3d/creatures.ts` — Draw from IBM creature registry
- Modified `src/world3d/World3D.tsx` — Remove cosmetic creature sync, use IBM creatures directly

### 6.3 Session 5: "Fast Forward" — Web Worker + social layer

**Goal:** Enable fast-forward mode and begin the social layer.

| # | Deliverable |
|---|-------------|
| 1 | Web Worker for IBM simulation (fast-forward mode) |
| 2 | Fast-forward UI (progress indicator, event summary, exit button) |
| 3 | Edge-of-chaos regulator (monitors diversity, nudges parameters) |
| 4 | Species share codes (export/import creature genomes) |
| 5 | Grid size increase to 50×50 with distance culling |

### 6.4 Session 6: "Epochs" — Progression + depth

| # | Deliverable |
|---|-------------|
| 1 | Seasonal cycles (sinusoidal temperature modulation) |
| 2 | Nutrient cycling (death biomass → biome nutrient pool → producer energy) |
| 3 | Epoch/prestige system (completion conditions, fossil record, museum) |
| 4 | Backend technology choice + species gallery (resolves DDR-001) |
| 5 | Grid size increase to 100×100 with chunked terrain |

### 6.5 Session 7: "Explorer" — Player character

| # | Deliverable |
|---|-------------|
| 1 | Player character on terrain (Babylon CharacterController + Havok physics) |
| 2 | First/third person camera modes |
| 3 | Direct creature interaction (click to inspect, see genome, lineage) |
| 4 | Building mechanics (structures that modify biome properties) |

### 6.6 Explicitly deferred

| Item | Reason | Revisit when |
|------|--------|-------------|
| Offline simulation / background service worker | Simulation pauses when browser closed. Simpler architecture. | If players demand "true idle" (leave and come back to evolution) |
| Disease / parasitism | Complex individual-level infection mechanics | After IBM is stable and producing good dynamics |
| Mutualism (DDR-008) | Complex individual-level resource exchange | After disease works |
| Competitive ecology / world templates | Too complex for current player base | After social layers 1–3 validated |
| Mobile/PWA | Web PMF not validated | When WAU > 2K |

---

## 7. Key Files Reference

### 7.1 Reusable engine modules

| File | Exports | Why reusable |
|------|---------|-------------|
| `src/engine/genome.ts` | `mutateGenome()`, `expressTraits()`, `geneticDistance()`, `Genome` | Genome structure and operations apply directly to individual genomes |
| `src/engine/biome.ts` | `updateBiomeTypes()`, `isHabitable()` | Biome type derivation unchanged |
| `src/engine/environment.ts` | `computeFitness()` | Temperature fitness applies to individual creatures |
| `src/engine/sculpt.ts` | `applySculpt()` | Terrain sculpting unchanged |
| `src/engine/names.ts` | `generateSpeciesName()` | Name generation for new species clusters |
| `src/engine/rng.ts` | `createRng()`, `Rng` | Deterministic PRNG for reproducibility |

### 7.2 Reusable spatial utilities (pure TS, in `src/world3d/terrain.ts`)

| Function | Purpose | Note |
|----------|---------|------|
| `worldXZToBiomeCoords()` | World position → biome grid coords | Needs to be accessible from engine (move or duplicate) |
| `biomeToWorldXZ()` | Biome → world center position | Same |
| `isPositionHabitable()` | Check if world position is walkable | Same |
| `getHeightAtWorldXZ()` | Terrain Y height at any position | Same |
| `getWorldBounds()` | Min/max world coordinates | Same |

**Architecture note:** These functions are in `src/world3d/terrain.ts` which is pure TS (no Babylon imports), but the engine must not import from world3d. Either move these to `src/engine/spatial-utils.ts` or extract a shared `src/shared/` module.

### 7.3 New files to create (Session 4)

| File | Purpose |
|------|---------|
| `src/engine/creature.ts` | Creature type, lifecycle (birth, metabolise, die, reproduce) |
| `src/engine/spatial-hash.ts` | Grid-based spatial indexing for O(1) neighbour queries |
| `src/engine/ibm-tick.ts` | IBM tick loop: for each creature → sense, decide, move, metabolise, age, die, reproduce |
| `src/engine/clustering.ts` | Genome clustering for species recognition (DBSCAN or distance-based) |
| `src/engine/disturbance.ts` | Stochastic disturbance generation and biome modifier application |
| `src/engine/spatial-utils.ts` | Coordinate math moved from world3d/terrain.ts for engine access |

---

## 8. Open Questions for Session 4

These must be resolved in the implementation brief (BRF) before coding begins.

| # | Question | Options | Impact |
|---|----------|---------|--------|
| 1 | **Starting creature count** | 30 (minimal), 100 (moderate), 500 (rich) | Determines how quickly the ecosystem becomes interesting vs. computational cost |
| 2 | **Energy constants** | How much energy does a biome give a producer per tick? How much does metabolism cost? What's the reproduction threshold? | These are the tuning knobs that determine whether the ecosystem is stable, oscillating, or collapsed. Need experimentation. |
| 3 | **Reproduction model** | Asexual (clone + mutate, like current), or sexual (two parents, genome crossover + mutate)? | Asexual is simpler and matches current model. Sexual adds realism and within-species diversity but requires mate-finding mechanics. |
| 4 | **Speciation clustering frequency** | Every tick (expensive), every 100 ticks, every 1000 ticks? | Too frequent = expensive. Too infrequent = species labels feel stale. |
| 5 | **Creature lifespan** | Fixed (e.g., 200 ticks), genome-derived, or energy-only (die when energy ≤ 0)? | Fixed lifespan creates generational turnover. Energy-only means creatures can live forever if well-fed (unrealistic but simpler). |
| 6 | **Grid size for Session 4** | 25×25 (conservative, 625 biomes) or 50×50 (ambitious, 2,500 biomes) | Larger is more interesting but harder to debug. Start conservative. |
| 7 | **What happens to the L-V engine during transition?** | Delete immediately? Keep as fallback? Run both in parallel for validation? | Keeping it as a reference for expected dynamics is valuable during tuning. |
| 8 | **How to handle producers?** | Producers are creatures that don't move? Or are they "vegetation tiles" that creatures eat? | If producers are individual creatures, the creature count explodes (most biomass is plant matter). If they're biome properties, the IBM is only for animals. |
| 9 | **Fast-forward: when to build Web Worker?** | Session 4 (build immediately) or Session 5 (after IBM is working)? | Web Worker adds complexity. Better to get IBM working on main thread first, then move to worker. |
| 10 | **Terrain coordinate utilities: move or duplicate?** | Move `worldXZToBiomeCoords` etc. to `src/engine/` (breaking world3d import) or create shared module? | Architecture boundary decision. Shared module is cleanest. |

---

*Radiate — Ecological Gaps Analysis, Entity Model, & Development Roadmap — March 2026*
*Architectural decisions finalised. Ready for Session 4 implementation brief.*
