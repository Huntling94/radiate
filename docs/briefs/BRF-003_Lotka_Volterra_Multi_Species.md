# BRF-003: Multi-Species Lotka-Volterra Dynamics

**Radiate v0.1 "First Life" · Chunk 4**

**Commit message:** `add multi-species Lotka-Volterra population dynamics`

---

## 1. Objective

Replace single-species logistic growth with generalised Lotka-Volterra dynamics supporting multiple species, predator-prey interactions, and competition. This is where the simulation transitions from "a number going up" to "an ecosystem with emergent behaviour."

### The Problem

The current `tick()` function (BRF-002) runs logistic growth for a single species: population grows toward carrying capacity and fluctuates around it. There's no interaction between species because there's only one. The simulation isn't interesting yet — there's no drama, no extinction, no arms race.

### What BRF-003 Delivers

- ADR-003: Population dynamics model (generalised Lotka-Volterra with trait-derived coefficients)
- Multi-species population dynamics with predation, competition, and herbivory
- Interaction coefficients derived automatically from species traits (not hardcoded)
- Initial world with 3 species: a producer, an herbivore, and a predator
- Updated UI: multi-line population chart, species colours on biome map, enriched species list
- **Browser milestone: predator-prey oscillations, species going extinct, emergent food web dynamics**

---

## 2. Architecture Decisions

### Decision 1: Generalised Lotka-Volterra equations

For each species i in each biome, the population change per time step is:

```
dPi/dt = ri × Pi × (1 - Σj(aij × Pj) / Ki) + noise
```

Where:
- `Pi` = population of species i in this biome
- `ri` = intrinsic growth rate (from reproduction trait)
- `Ki` = effective carrying capacity for species i in this biome
- `aij` = interaction coefficient between species i and j
- `noise` = multiplicative stochastic noise (same as BRF-002)

The interaction coefficient `aij` encodes the relationship:
- `aij > 0` means species j hurts species i (competition, predation on i)
- `aij < 0` means species j helps species i (prey for predator i)
- `aij = 0` means no interaction
- `aii = 1` always (self-competition — this gives the logistic growth baseline)

**Why generalised Lotka-Volterra over agent-based modelling:**
- O(species² × biomes) per tick, not O(individuals). Scales to 100+ species.
- Closed-form interaction matrix — no emergent pathfinding or spatial queries needed.
- Well-studied mathematical properties: we know what oscillation, exclusion, and coexistence look like.
- Deterministic given the same RNG state — testable.

**Trade-off:** No individual-level behaviour (chasing, fleeing, territorial defence). Acceptable for v0.1 — the simulation is about population-level dynamics, not individual creatures. Individual behaviour is a v0.5+ concern if ever.

### Decision 2: Interaction coefficients derived from traits

Rather than hardcoding "species A eats species B," interaction coefficients are computed from the genome traits of both species. This means new species from mutation/speciation (Chunk 5) automatically have meaningful interactions without manual tuning.

The key computation:

**Predation:** A predator benefits from prey if `predator.speed > prey.speed × threshold`. The magnitude depends on the speed differential and predator size. Prey loses population proportionally.

**Competition:** Two species at the same trophic level compete based on niche overlap. Niche overlap is the inverse of genetic distance — more similar species compete more.

**Herbivory:** Producers compete with each other for carrying capacity. Herbivores consume producers. Predators consume herbivores.

### Decision 3: Multiplicative noise scales with population

Stochastic noise is proportional to population: `noise = P × σ × gaussian() × sqrt(dt)`.

This means:
- Large populations fluctuate in absolute terms but are relatively stable (±5%)
- Small populations have high relative variance — can go extinct from a bad run of noise
- This creates natural stochastic extinction, which is ecologically realistic and good for gameplay (drama!)

### Decision 4: Trophic level determines food chain position

The food chain is: `producer → herbivore → predator`.

- **Producers** grow from carrying capacity (sunlight/nutrients). They don't eat other species.
- **Herbivores** consume producers. Their effective carrying capacity depends on available producer biomass.
- **Predators** consume herbivores. Their effective carrying capacity depends on available herbivore biomass.

This creates bottom-up energy flow: if producers decline (e.g., from temperature change in Chunk 5), herbivores starve, then predators starve. Cascading effects emerge naturally from the equations.

### Decision 5: Three initial species for a basic food chain

The factory creates:
1. **Proto Alga** (producer) — base of the food chain, present in all habitable biomes
2. **Grazer** (herbivore) — eats Proto Alga, moderate speed, present in most biomes
3. **Stalker** (predator) — eats Grazer, high speed, present in fewer biomes with lower initial population

This gives us the classic predator-prey-producer triangle from the start. The dynamics should produce visible oscillations within 50-100 ticks.

---

## 3. Detailed Design

### 3.1 Interaction module (`src/engine/interactions.ts`)

```typescript
interface InteractionMatrix {
  /** coefficient[i][j] = effect of species j on species i's growth */
  coefficients: number[][];
  /** Maps species ID to matrix index */
  indexMap: Map<string, number>;
}

function computeInteractionMatrix(species: Species[]): InteractionMatrix
function computePairInteraction(speciesI: Species, speciesJ: Species): number
```

The matrix is recomputed each tick (species can go extinct mid-tick, changing the matrix). For <20 species this is negligible. If performance becomes an issue at 100+ species, we cache and invalidate on extinction/speciation events.

### 3.2 Updated dynamics in `tick.ts`

Replace the current single-species `updatePopulation()` with a multi-species step that:

1. Computes the interaction matrix for all living species
2. For each biome, for each species:
   - Computes effective growth using the Lotka-Volterra equation
   - Applies stochastic noise
   - Enforces extinction threshold
3. Removes extinct species from the state

### 3.3 Updated factory (`src/engine/factory.ts`)

`createInitialState()` now generates 3 species instead of 1:
- Proto Alga: balanced producer genome, high initial population
- Grazer: herbivore with moderate speed, medium initial population
- Stalker: predator with high speed, low initial population in fewer biomes

### 3.4 Updated UI components

**PopulationChart:** Already supports multiple species lines via `speciesIds` prop — minimal changes needed. Each species gets a distinct colour.

**BiomeMap:** Show dominant species per biome cell using the species' assigned colour (instead of just white overlay).

**SpeciesList:** Add trophic level indicator, diet description, and population trend (up/down/stable based on last 10 ticks in history).

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/interactions.ts` | **NEW** — interaction matrix computation from traits | MEDIUM — core simulation logic |
| `src/engine/interactions.test.ts` | **NEW** — predation, competition, coefficient tests | LOW |
| `src/engine/tick.ts` | **MODIFIED** — replace single-species growth with Lotka-Volterra | MEDIUM — changes core tick loop |
| `src/engine/tick.test.ts` | **MODIFIED** — add multi-species tests, keep existing invariant tests | LOW |
| `src/engine/factory.ts` | **MODIFIED** — generate 3 species instead of 1 | LOW |
| `src/engine/factory.test.ts` | **MODIFIED** — verify 3 species, correct trophic levels | LOW |
| `src/components/BiomeMap.tsx` | **MODIFIED** — colour by dominant species | LOW |
| `src/components/PopulationChart.tsx` | **MODIFIED** — species name labels in tooltip | LOW |
| `src/components/SpeciesList.tsx` | **MODIFIED** — diet description, trend indicator | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/types.ts` | WorldState contract unchanged — supports multi-species already |
| `src/engine/rng.ts` | RNG consumed, not modified |
| `src/engine/biome.ts` | Biome logic unchanged |

---

## 5. Concepts Introduced

**Lotka-Volterra equations:** The classical mathematical model for predator-prey dynamics, published independently by Alfred Lotka (1925) and Vito Volterra (1926). In the simplest form, prey grows exponentially and predators decline without food, but predator feeding on prey links the two populations into oscillating cycles: prey grows → predators have food and grow → prey declines from predation → predators starve and decline → prey recovers → cycle repeats. Our generalised version extends this to N species with an interaction matrix.

**Interaction matrix:** A table where entry `aij` describes how species j affects species i. Think of it like a spreadsheet: rows are "who is affected," columns are "who does the affecting." A positive value means harm (competition/being eaten), a negative value means benefit (eating someone). The diagonal (`aii = 1`) represents self-competition (the logistic growth part).

**Competitive exclusion principle:** Two species competing for exactly the same niche cannot coexist indefinitely — one will always outcompete the other. In our simulation, species with similar genomes have high niche overlap and thus high competition coefficients. This drives divergence: species that differentiate (via mutation in Chunk 5) can coexist; species that don't will see one go extinct.

**Trophic cascade:** When a change at one level of the food chain ripples through other levels. If predators decline, herbivores explode, which crashes producers, which starves herbivores. These cascading effects emerge naturally from the Lotka-Volterra equations — we don't script them. This is the "emergence over scripting" design principle in action.

---

## 6. Test Strategy

| # | Test | What It Verifies |
|---|------|-----------------|
| T1 | Predator-prey oscillation: predator and prey populations cross their respective means ≥3 times in 500 ticks | Classic Lotka-Volterra behaviour |
| T2 | Competitive exclusion: two species with identical genomes at the same trophic level → one declines over 200 ticks | Niche overlap drives exclusion |
| T3 | Stochastic extinction: run 50 simulations with different seeds, verify at least one produces an extinction | Small populations can go extinct |
| T4 | No negative populations after multi-species dynamics (200 ticks) | Core invariant preserved |
| T5 | Predator with higher speed has higher predation coefficient than predator with lower speed | Trait-derived interactions |
| T6 | Species at the same trophic level have positive (competitive) interaction; predator-prey have asymmetric interaction | Interaction matrix correctness |
| T7 | Determinism: same state + same seed → identical result after 100 ticks | Reproducibility preserved |
| T8 | Time-jump 3600s with 3 species — no crash, all populations ≥ 0 | Multi-species time-jump stability |
| T9 | Factory creates 3 species with correct trophic levels (producer, herbivore, predator) | Initial state correctness |
| T10 | Producer extinction causes herbivore decline within 50 ticks (trophic cascade) | Bottom-up energy flow |

---

## 7. Acceptance Criteria

1. `tick()` implements generalised Lotka-Volterra dynamics for N species.
2. Interaction coefficients computed from species traits — no hardcoded species relationships.
3. Predator-prey oscillations visible in the population chart.
4. Competitive exclusion occurs when species overlap heavily.
5. Stochastic extinction possible for small populations.
6. Population never goes negative (invariant).
7. Time-jumps up to 604,800 seconds complete without crash.
8. Factory generates 3 species (producer, herbivore, predator).
9. Population chart shows distinct coloured lines per species.
10. Species list shows trophic level and population.
11. All T1–T10 tests pass.
12. All existing tests continue to pass (no regressions).
13. `npx tsc --noEmit` zero errors.
14. `npx eslint .` zero errors.

---

## 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Lotka-Volterra dynamics unstable with Euler integration (populations oscillate to infinity or crash to zero instantly) | HIGH | Cap population change per step to ±50% of current population. Clamp negative values to 0. Use small enough step size (1 second) that Euler is stable. Monitor in tests T1 and T4. |
| Predator immediately drives prey to extinction before oscillation establishes | MEDIUM | Tune initial populations: producers start at 200/biome, herbivores at 50, predators at 10. Predation coefficient scaled to prevent instant collapse. T1 specifically tests for oscillation. |
| Interaction matrix computation too slow at 100+ species | LOW | O(n²) with n < 20 for v0.1. At n = 100, that's 10,000 coefficient computations per tick — still <1ms. Revisit if profiling shows an issue. |
| Trait-derived coefficients produce degenerate dynamics (all species identical → mutual exclusion → mass extinction) | MEDIUM | Initial species have deliberately different genomes (differentiated traits). Interaction function includes a minimum niche differentiation below which competition is at maximum — prevents pathological convergence. |

---

*Radiate · BRF-003 · Pre-Implementation Brief · March 2026*
