# BRF-013: Biome Energy Production + Producer Carrying Capacity

**Phase:** v0.2 "Naturalist" · Engine deepening (Phase 1 of 2)
**Depends on:** Energy system consultancy report (Approach B — Hybrid L-V + Energy)
**Prerequisite for:** BRF-014 (Trophic Transfer + Consumer K)

---

## 1. Objective

Replace the flat carrying capacity (K=500 for all habitable biomes) with a **biome-type-specific energy production system** that drives producer carrying capacity. Forests should support more plant life than deserts. Moisture and temperature should modulate energy output. The `metabolism` trait should begin affecting simulation dynamics.

This is Phase 1 of 2 — it only changes **producer** K. Consumer K (herbivores, predators) remains at the biome's base carrying capacity until BRF-014 introduces trophic transfer.

### What BRF-013 Delivers

- **Biome energy production** — each biome type produces a base energy value representing net primary productivity (NPP)
- **Dynamic producer K** — producer carrying capacity derived from biome energy × moisture factor × temperature factor
- **Metabolism trait activation (partial)** — metabolism modulates producer growth rate (r-strategist vs K-strategist)
- **New engine module** — `src/engine/energy.ts` with pure functions, fully testable
- **WorldState unchanged** — energy production is derived, not stored; no save migration needed

### What BRF-013 Does NOT Deliver

- Consumer carrying capacity from trophic transfer (BRF-014)
- Metabolism effect on consumer carrying capacity (BRF-014)
- UI changes to display energy values (future UX work, separate from engine)
- Individual-level energy budgets (DDR-011, future)

### Design principle: upgradeable to individual energy

The energy functions accept a biome and return energy/K values. This per-biome interface is the same calculation that would run per-individual if DDR-011 is adopted — each individual would query the energy of the biome it occupies. The architecture preserves this upgrade path without committing to it.

---

## 2. Architecture Decisions

### Decision 1: Energy values by biome type

Each biome type gets a base energy value representing net primary productivity. Values are tuned to create a ~7.5x range between the harshest habitable biome (desert) and the richest (forest), matching real-world NPP ratios.

| Biome Type | Base Energy | Real-World NPP Analogue |
|------------|-------------|------------------------|
| Forest | 1000 | Tropical/temperate forest: 1000–2000 g C/m²/yr |
| Grassland | 700 | Temperate grassland: 500–1000 g C/m²/yr |
| Tundra | 300 | Arctic tundra: 100–400 g C/m²/yr |
| Desert | 200 | Hot desert: 50–300 g C/m²/yr |
| Ocean | 0 | Uninhabitable |
| Mountain | 0 | Uninhabitable |

These are tuning parameters — the exact values can be adjusted based on playtesting (DDR-005).

### Decision 2: Moisture and temperature modifiers

Raw energy is modified by the biome's moisture and the global temperature:

```
producerK(biome, temperature) = baseEnergy[biomeType]
                                × moistureFactor(biome.moisture)
                                × temperatureFactor(temperature)

moistureFactor(m)    = 0.5 + m           // range [0.5, 1.5]
temperatureFactor(t) = max(0.1, 1 - |t - 20| × 0.015)  // peaks at 20°C
```

**Why these formulas:**
- **Moisture factor** has a floor of 0.5 — even a dry biome produces some energy. This addresses the game designer's concern from the consultancy report about deserts becoming dead zones.
- **Temperature factor** peaks at 20°C (the default) and declines symmetrically. At ±50°C deviation, production drops to 25%. The 0.1 floor prevents total shutdown.
- Both are multiplicative, giving a combined range of ~0.05 to 1.5.

**Resulting K ranges:**
- Warm wet forest: 1000 × 1.5 × 1.0 = **1500**
- Dry cold desert: 200 × 0.5 × 0.55 = **55**
- This is a **~27x range**, making biome type meaningfully different.

### Decision 3: Metabolism trait effect on producer growth rate

The `metabolism` trait (genome index 4, range 0.1–2.0) is currently unused. BRF-013 activates it for producers only — it modulates the growth rate calculation:

```
r = BASE_GROWTH_RATE × (0.5 + reproductionRate) × (0.8 + metabolism × 0.2) × fitnessModifier
```

The `(0.8 + metabolism × 0.2)` term gives a range of [0.82, 1.2] — a moderate effect that makes metabolism visible in population dynamics without overwhelming the existing balance.

Full metabolism activation (including the K trade-off for consumers) is deferred to BRF-014.

### Decision 4: Only producer K changes; consumer K unchanged

In this phase, herbivore and predator carrying capacity remains at `baseCarryingCapacity` (which is the biome's energy-derived value). The per-trophic-level K split happens in BRF-014. This allows incremental testing — we can verify producer dynamics are stable before layering on consumer dependencies.

### Decision 5: Computed K, not stored K

Energy production and the resulting K are **computed each tick**, not stored on the Biome object. This means:
- No WorldState shape change
- No save migration needed (Lesson 1)
- Rewind/checkpoint (DDR-010) works automatically — rewinding WorldState restores the correct energy state because it is derived, not accumulated
- Energy is always consistent with current biome state

### Decision 6: Tick integration point

The K lookup in `tick.ts` currently reads `biome.baseCarryingCapacity` for all species. BRF-013 changes this to:
- **Producers:** K from `computeProducerK(biome, temperature)`
- **Consumers:** K from `biome.baseCarryingCapacity` (unchanged, becomes energy-derived in BRF-014)

The `updateBiomeTypes` function in `environment.ts` already sets `baseCarryingCapacity` to the flat 500. After BRF-013, this value still exists as a fallback for consumers but producers use the energy-derived K.

---

## 3. Detailed Design

### 3.1 New module: `src/engine/energy.ts`

```typescript
// Base energy production per biome type (net primary productivity)
const BIOME_ENERGY: Record<BiomeType, number> = {
  forest: 1000,
  grassland: 700,
  tundra: 300,
  desert: 200,
  ocean: 0,
  mountain: 0,
};

function moistureFactor(moisture: number): number
  // 0.5 + moisture → range [0.5, 1.5]

function temperatureFactor(temperature: number): number
  // max(0.1, 1 - |t - 20| × 0.015)

function computeBiomeEnergy(biome: Biome, temperature: number): number
  // BIOME_ENERGY[biomeType] × moistureFactor × temperatureFactor

function computeProducerK(biome: Biome, temperature: number): number
  // = computeBiomeEnergy(biome, temperature)
  // (In this phase, producer K equals biome energy directly.
  //  BRF-014 may scale this if needed.)
```

All functions are pure, no side effects, no imports outside `src/engine/`.

### 3.2 Modified: `src/engine/tick.ts`

Replace the carrying capacity lookup:

**Before:**
```typescript
const carryingCapacity = new Map<string, number>();
for (const biome of biomes) {
  carryingCapacity.set(biome.id, biome.baseCarryingCapacity);
}
// ... later, for all species:
const k = carryingCapacity.get(biomeId) ?? 0;
```

**After:**
```typescript
// Build two K maps: one for producers (energy-derived), one for consumers (base)
const producerK = new Map<string, number>();
const consumerK = new Map<string, number>();
for (const biome of biomes) {
  producerK.set(biome.id, computeProducerK(biome, state.temperature));
  consumerK.set(biome.id, biome.baseCarryingCapacity);
}
// ... later, per species:
const k = species.trophicLevel === 'producer'
  ? (producerK.get(biomeId) ?? 0)
  : (consumerK.get(biomeId) ?? 0);
```

### 3.3 Modified: `src/engine/tick.ts` — growth rate

Add metabolism to the growth rate calculation in `updateSpeciesPopulation`:

**Before:**
```typescript
const r = BASE_GROWTH_RATE * (0.5 + traits.reproductionRate) * fitnessModifier;
```

**After:**
```typescript
const metabolismBoost = 0.8 + traits.metabolism * 0.2;
const r = BASE_GROWTH_RATE * (0.5 + traits.reproductionRate) * metabolismBoost * fitnessModifier;
```

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/energy.ts` | **NEW** — biome energy production, moisture/temperature factors, producer K | LOW — pure functions |
| `src/engine/energy.test.ts` | **NEW** — ~10 tests | LOW |
| `src/engine/tick.ts` | **MODIFIED** — producer K from energy module, metabolism in growth rate | MEDIUM — core simulation change |
| `src/engine/index.ts` | **MODIFIED** — export energy functions | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/types.ts` | No WorldState shape change |
| `src/engine/environment.ts` | `updateBiomeTypes` still sets baseCarryingCapacity (used by consumers) |
| `src/data/persistence.ts` | No migration needed |
| `src/world3d/*` | Engine-only change — no rendering impact |
| `src/components/*` | No UI changes |

---

## 5. Acceptance Criteria

1. Forest biomes produce higher energy than grasslands, which produce higher than tundra, which produce higher than desert.
2. Ocean and mountain biomes produce zero energy.
3. Moisture increases energy production (wet forest > dry forest).
4. Temperature 20°C gives maximum energy; extreme temperatures reduce production.
5. Producer carrying capacity in a forest biome is measurably higher than in a desert biome.
6. Producer populations in forests grow larger than in deserts over 100+ ticks.
7. The `metabolism` trait affects producer growth rate — high-metabolism producers grow faster.
8. Consumer (herbivore/predator) carrying capacity is unchanged from the current model.
9. Existing predator-prey oscillations and competitive exclusion still work.
10. Offline catch-up (time-jump) produces sane results.
11. `npm run build` passes.
12. All existing tests pass (103). New tests bring total to ~113.

---

## 6. Test Strategy

### New tests (`src/engine/energy.test.ts`)

| # | Test | What it verifies |
|---|------|-----------------|
| T1 | Forest energy > grassland > tundra > desert | Base energy ordering |
| T2 | Ocean and mountain produce zero energy | Uninhabitable biomes |
| T3 | moistureFactor(0) = 0.5, moistureFactor(1) = 1.5 | Moisture range |
| T4 | temperatureFactor(20) = 1.0 (peak) | Temperature optimum |
| T5 | temperatureFactor at extreme temps > 0.1 | Temperature floor |
| T6 | computeBiomeEnergy combines type × moisture × temperature | Integration test |
| T7 | computeProducerK for wet forest > dry desert | End-to-end K comparison |
| T8 | computeProducerK returns 0 for ocean | Uninhabitable guard |

### Modified tests (`src/engine/tick.test.ts` — extend)

| # | Test | What it verifies |
|---|------|-----------------|
| T9 | Producer population in forest biome > desert biome after 50 ticks | Energy-derived K works in simulation |
| T10 | Metabolism trait affects producer growth rate | Trait activation |

### Existing tests

All 103 existing tests must continue to pass. The Lotka-Volterra dynamics are unchanged — only K values differ, and existing tests use `createInitialState` which generates biomes with varied types. The dynamic K will produce different exact population values, but invariant tests (no negative populations, no NaN, time-jump stability) should all hold.

**Risk:** Snapshot tests that assert exact population values may need updated expectations. These should be checked during implementation.

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Dynamic K destabilises population dynamics | MEDIUM | The L-V solver is unchanged. K values are in a similar range (55–1500 vs flat 500). Euler stability cap (±80%) still applies. Run existing invariant tests to verify. |
| Producers in desert biomes die out too quickly | LOW | moistureFactor floor of 0.5 ensures even deserts get K ≥ 55. Test with extreme parameters. |
| Existing snapshot tests break | LOW | Expected — update exact values. Invariant tests (conservation, no-negative, time-jump) are the critical ones. |
| Metabolism change shifts overall balance | LOW | The (0.8 + metabolism × 0.2) range is narrow [0.82, 1.2]. Seed species metabolism is 0.3, giving a boost of 0.86 — close to 1.0. |

---

*Radiate · BRF-013 · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
