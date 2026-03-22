# BRF-014: Trophic Transfer + Consumer Carrying Capacity

**Phase:** v0.2 "Naturalist" · Engine deepening (Phase 2 of 2)
**Depends on:** BRF-013 (Biome Energy Production + Producer K)
**Completes:** Energy system consultancy report Approach B (Hybrid L-V + Energy)

---

## 1. Objective

Complete the trophic energy chain by deriving **herbivore and predator carrying capacity from the biomass of the trophic level below them**. Herbivore K is constrained by producer biomass in each biome. Predator K is constrained by herbivore biomass. The `metabolism` trait gains its full r-K trade-off — high-metabolism species grow faster but are supported in smaller numbers.

After BRF-014, every species' carrying capacity is causally connected to the energy chain: sunlight → biome energy → producer biomass → herbivore support → predator support. The player's terrain sculpting now has a measurable cascade effect through the entire food web.

### What BRF-014 Delivers

- **Herbivore K per biome** derived from total producer population in that biome × transfer efficiency
- **Predator K per biome** derived from total herbivore population in that biome × transfer efficiency
- **Metabolism r-K trade-off for consumers** — high metabolism boosts growth rate but reduces carrying capacity (each individual needs more energy)
- **Transfer efficiency** — ~10% baseline (Lindeman's rule), modulated by species traits
- **Trophic cascade behaviour** — removing producers crashes herbivore K, which crashes predator K

### What BRF-014 Does NOT Deliver

- UI changes to display energy/K values (future UX work)
- Variable transfer efficiency by biome type (consultancy report noted this as a potential refinement — defer)
- Individual-level energy budgets (DDR-011)

---

## 2. Architecture Decisions

### Decision 1: Consumer K from biomass of prey trophic level

The core formula:

```
K_herbivore(biome) = totalProducerPop(biome) × TRANSFER_EFFICIENCY
                     × metabolismKModifier(species)

K_predator(biome)  = totalHerbivorePop(biome) × TRANSFER_EFFICIENCY
                     × metabolismKModifier(species)

TRANSFER_EFFICIENCY = 0.10   (Lindeman's 10% rule)
```

**Why total population, not total biomass?** The simulation does not currently track biomass — population is the proxy. Population counts already reflect carrying capacity constraints, so using population as the energy proxy is self-consistent. If individual-level simulation (DDR-011) is adopted later, biomass (population × size trait) would be a better proxy.

### Decision 2: Metabolism r-K trade-off for consumers

The `metabolism` trait already boosts growth rate (BRF-013). BRF-014 adds the complementary penalty — high metabolism reduces carrying capacity:

```
metabolismKModifier(species) = 1.0 / (0.5 + traits.metabolism × 0.5)
```

| Metabolism | K Modifier | Growth Modifier (BRF-013) | Strategy |
|-----------|-----------|--------------------------|----------|
| 0.1 | 1.82× | 0.82× | K-strategist: slow growth, large stable population |
| 0.5 | 1.33× | 0.90× | Balanced |
| 1.0 | 1.00× | 1.00× | Neutral |
| 2.0 | 0.67× | 1.20× | r-strategist: fast growth, smaller equilibrium |

This creates the classic r-K trade-off from ecology (MacArthur & Wilson, 1967). Players will observe it in species cards — some species grow explosively but plateau lower, others grow slowly but dominate long-term.

### Decision 3: K floor for consumers

Consumer K derived from prey biomass can become very low if prey populations are small. A zero K causes immediate extinction. To prevent death spirals:

```
effectiveK = max(MIN_CONSUMER_K, derivedK)
MIN_CONSUMER_K = 5
```

This gives consumers a small buffer to survive temporary prey population dips. The value is low enough that it does not meaningfully distort the energy chain — 5 individuals is barely above the extinction threshold of 1.

### Decision 4: Consumer K is recomputed each sub-tick

Because consumer K depends on current populations, and populations change each sub-tick, the K values must be recalculated inside the sub-tick loop. This differs from producer K, which is stable within a tick (it depends only on biome type and temperature).

```
// Inside sub-tick loop:
// 1. Compute producer K (from biome energy — stable)
// 2. Update producer populations
// 3. Compute herbivore K (from updated producer populations)
// 4. Update herbivore populations
// 5. Compute predator K (from updated herbivore populations)
// 6. Update predator populations
```

This trophic ordering ensures each level's K reflects the current state of the level below it. It is a simple refactor of the existing per-species loop to process trophic levels in order.

### Decision 5: Starvation mechanics preserved

The existing starvation check (consumers with no prey get negative growth) remains unchanged. The energy-derived K is an additional constraint — even with prey present, consumers cannot exceed the energy budget. The two mechanisms complement each other:

- **No prey at all** → starvation (rapid decline)
- **Prey present but scarce** → low K (population capped, slow decline toward K)
- **Prey abundant** → high K (population can grow)

### Decision 6: Separation from rendering

All changes are in `src/engine/energy.ts` and `src/engine/tick.ts`. No Three.js, no component changes, no WorldState shape change. The Babylon.js migration (DDR-012) remains an orthogonal concern.

---

## 3. Detailed Design

### 3.1 New functions in `src/engine/energy.ts`

```typescript
const TRANSFER_EFFICIENCY = 0.10;
const MIN_CONSUMER_K = 5;

function metabolismKModifier(species: Species): number
  // 1.0 / (0.5 + traits.metabolism × 0.5)

function computeHerbivoreK(
  biomeId: string,
  species: Species,
  biomePopulations: Map<string, number[]>,
  allSpecies: Species[],
): number
  // Sum producer populations in biome
  // × TRANSFER_EFFICIENCY × metabolismKModifier
  // Floor at MIN_CONSUMER_K (if biome is habitable)

function computePredatorK(
  biomeId: string,
  species: Species,
  biomePopulations: Map<string, number[]>,
  allSpecies: Species[],
): number
  // Sum herbivore populations in biome
  // × TRANSFER_EFFICIENCY × metabolismKModifier
  // Floor at MIN_CONSUMER_K (if biome is habitable)
```

### 3.2 Modified: `src/engine/tick.ts`

The sub-tick loop changes from processing all species in arbitrary order to processing by trophic level:

**Before:**
```typescript
for (let i = 0; i < currentSpecies.length; i++) {
  const species = currentSpecies[i];
  const k = species.trophicLevel === 'producer'
    ? producerK.get(biomeId) : consumerK.get(biomeId);
  // ... update population
}
```

**After:**
```typescript
// Phase 1: Update producers (K from biome energy)
for (const [i, species] of producerIndices) {
  for (const biomeId of biomeIds) {
    const k = producerCarryingCapacity.get(biomeId) ?? 0;
    // ... update population
  }
}
// Refresh biomePopulations after producer updates

// Phase 2: Update herbivores (K from producer biomass)
for (const [i, species] of herbivoreIndices) {
  for (const biomeId of biomeIds) {
    const k = computeHerbivoreK(biomeId, species, biomePopulations, currentSpecies);
    // ... update population
  }
}
// Refresh biomePopulations after herbivore updates

// Phase 3: Update predators (K from herbivore biomass)
for (const [i, species] of predatorIndices) {
  for (const biomeId of biomeIds) {
    const k = computePredatorK(biomeId, species, biomePopulations, currentSpecies);
    // ... update population
  }
}
```

The biomePopulations map is rebuilt between phases so that herbivores see updated producer counts and predators see updated herbivore counts.

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/energy.ts` | **MODIFIED** — add metabolismKModifier, computeHerbivoreK, computePredatorK, constants | LOW — pure functions |
| `src/engine/energy.test.ts` | **MODIFIED** — ~10 new tests | LOW |
| `src/engine/tick.ts` | **MODIFIED** — trophic ordering in sub-tick loop, consumer K from energy module | MEDIUM — structural change to tick loop |
| `src/engine/tick.test.ts` | **MODIFIED** — ~3 new tests for trophic cascade | LOW |
| `src/engine/index.ts` | **MODIFIED** — export new energy functions | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/types.ts` | No WorldState shape change |
| `src/engine/interactions.ts` | Interaction matrix unchanged |
| `src/data/persistence.ts` | No migration needed |
| `src/world3d/*` | Engine-only change |
| `src/components/*` | No UI changes |

---

## 5. Acceptance Criteria

1. Herbivore carrying capacity in a biome is proportional to total producer population in that biome.
2. Predator carrying capacity in a biome is proportional to total herbivore population in that biome.
3. Sculpting a grassland into a forest increases producer K, which increases herbivore K, which increases predator K over subsequent ticks.
4. Sculpting a forest into ocean crashes producer K, causing herbivore and predator populations to decline.
5. High-metabolism consumers grow faster than low-metabolism consumers (BRF-013 growth rate boost still applies).
6. High-metabolism consumers have lower equilibrium populations than low-metabolism consumers (new K penalty).
7. Consumer K never drops below MIN_CONSUMER_K (5) in habitable biomes — prevents instant extinction cascades.
8. Trophic levels are processed in order: producers → herbivores → predators within each sub-tick.
9. Existing predator-prey oscillations still occur (the L-V solver is unchanged).
10. Offline catch-up (time-jump) produces sane results.
11. `npm run build` passes.
12. All existing tests pass (123). New tests bring total to ~136.

---

## 6. Test Strategy

### New energy tests (`src/engine/energy.test.ts` — extend)

| # | Test | What it verifies |
|---|------|-----------------|
| T1 | metabolismKModifier(metabolism=1.0) ≈ 1.0 | Neutral point |
| T2 | metabolismKModifier(metabolism=0.1) > 1.0 | Low metabolism → K bonus |
| T3 | metabolismKModifier(metabolism=2.0) < 1.0 | High metabolism → K penalty |
| T4 | computeHerbivoreK increases with more producers | Trophic transfer |
| T5 | computeHerbivoreK returns MIN_CONSUMER_K with zero producers | Floor enforcement |
| T6 | computePredatorK increases with more herbivores | Trophic transfer |
| T7 | computePredatorK returns MIN_CONSUMER_K with zero herbivores | Floor enforcement |
| T8 | High-metabolism herbivore gets lower K than low-metabolism | r-K trade-off |
| T9 | Transfer efficiency ≈ 10% | Lindeman's rule |

### New tick tests (`src/engine/tick.test.ts` — extend)

| # | Test | What it verifies |
|---|------|-----------------|
| T10 | Herbivore population tracks producer population over 100 ticks | Trophic coupling |
| T11 | Removing all producers causes herbivore decline | Trophic cascade |
| T12 | High-metabolism herbivore has lower equilibrium than low-metabolism | r-K trade-off in simulation |

### Existing tests

All 123 tests must continue to pass. The tick loop structural change (trophic ordering) produces the same results for the same inputs when K values are unchanged. Invariant tests (no-negative, time-jump stability) are the critical guards.

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Trophic ordering changes population dynamics subtly | MEDIUM | The change is that herbivores now see updated producer counts within the same sub-tick. Previously, all species saw stale (start-of-tick) counts. Run full test suite to verify invariants hold. |
| Consumer K becomes very volatile (swings with prey populations) | MEDIUM | MIN_CONSUMER_K floor of 5 prevents zero-K crashes. The L-V stability cap (±80% per step) prevents explosive swings. Monitor predator-prey oscillation test. |
| Biome population map rebuild between phases is expensive | LOW | O(species × biomes) — same as existing population map build. With 96 biomes and ~10 species, this is trivial (~1000 operations per sub-tick). |
| r-K trade-off makes metabolism the dominant trait | LOW | The modifier range is moderate (0.67× to 1.82×). Other traits (speed, tolerance, reproduction) have comparable or larger effects on fitness. |

---

*Radiate · BRF-014 · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
