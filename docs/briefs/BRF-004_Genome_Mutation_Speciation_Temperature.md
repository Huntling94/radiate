# BRF-004: Genome Mutation, Speciation & Temperature Control

**Radiate v0.1 "First Life" · Chunk 5**

**Commit message:** `add genome mutation, speciation, temperature control and species colours`

---

## 1. Objective

Make evolution happen. Species genomes mutate over time, populations diverge genetically, and when divergence exceeds a threshold, a species splits into two. The player controls global temperature, which reshapes biomes and creates selection pressure — species with the wrong temperature tolerance traits decline, creating niches for new species to fill. Species are now visually distinguishable on the biome map via colour-coded indicators.

### The Problem

The current simulation has 3 static species that interact but never change. There's no evolution — no new species appear, no adaptation occurs, and the player has no way to influence the ecosystem. The biome map shows generic white dots with no way to tell which species is where.

### What BRF-004 Delivers

- Genome mutation: traits drift over time via small random perturbations
- Speciation: populations that diverge genetically split into new species
- Temperature control: player slider that affects biome types and species fitness
- Colour-coded species on the biome map (trophic-level based colours)
- Auto-generated species names for newly evolved species
- **Browser milestone: species branching, temperature reshaping the world, coloured creatures on the map**

---

## 2. Architecture Decisions

### Decision 1: Mutation as per-tick genome drift

Each tick, every species' genome is slightly perturbed:

```
genome[i] += mutationMagnitude × gaussian() × mutationRate
```

- `mutationRate` (from SimConfig): probability weighting — higher rate = faster drift
- `mutationMagnitude` (from SimConfig): standard deviation of perturbation
- Values clamped to trait min/max bounds (from TRAIT_REGISTRY)

This is a population-level mutation model, not individual-level. We're saying "the average genome of this species drifts over time." This is simpler than tracking individual genomes (which would require an agent-based model) and produces the same macro behaviour: populations gradually change traits.

**Trade-off:** No within-species genetic diversity in v0.1. Every member of a species has the same genome. This means speciation is triggered by comparing the current genome against the genome at the species' origin (tracked as a new field `originalGenome`). Future versions could track variance within a population for more realistic speciation.

### Decision 2: Speciation via genetic distance from origin

A species speciates (splits) when:

```
geneticDistance(species.genome, species.originalGenome) > speciationThreshold
```

When triggered:
1. The parent species is renamed with a suffix (e.g., "Proto Alga α")
2. A child species is created with the current (drifted) genome
3. The parent's genome is reset to its original genome
4. Population is split 50/50 between parent and child in each biome
5. The child gets a new auto-generated name

This creates a branching tree: the parent "snaps back" to its original form while the child represents the new lineage. Over time, both will drift again and potentially speciate further.

**Why distance-from-origin over population variance:** Simpler, deterministic, and produces clear speciation events. Population variance would require tracking per-individual genomes (agent-based). Distance-from-origin works with our population-level model.

### Decision 3: Temperature affects species fitness

Temperature modifies species growth rate based on their tolerance traits:

```
fitnessMod = 1 - abs(temperature - idealTemp) × sensitivity
```

Where `idealTemp` is derived from `coldTolerance` and `heatTolerance` traits. Species well-suited to the current temperature grow normally; poorly suited species grow slower or decline.

The player controls temperature via a slider (range: -20°C to 50°C, default 20°C). Moving the slider:
- Immediately updates `worldState.temperature`
- Biome types recalculate (e.g., raising temp turns tundra to grassland, grassland to desert)
- Species fitness adjusts — cold-tolerant species thrive when cooled, heat-tolerant thrive when warmed

### Decision 4: Temperature changes biome types dynamically

When temperature changes, `deriveBiomeType()` is re-evaluated for every biome using the new temperature. Biome colours on the map shift accordingly. Carrying capacity may change (deserts support less life than forests).

This is immediate — no gradual transition. In future (v0.2+), we could add climate inertia where biomes take time to shift. For v0.1, instant feedback is more satisfying and teaches the player the cause-effect relationship.

### Decision 5: Colour-coded species on the biome map

Each species gets a colour based on trophic level:
- Producers: green shades (#22c55e)
- Herbivores: amber shades (#eab308)
- Predators: red shades (#ef4444)

Multiple species of the same trophic level get slight hue variations to distinguish them. On the biome map, each cell shows small coloured dots proportional to population — you can see at a glance which species dominate each biome.

### Decision 6: Auto-generated species names

New species get procedurally generated names combining syllables:

```
prefix (2-3 syllables) + suffix based on trophic level
```

Examples: "Vorathi", "Zelkora", "Thrynax". This avoids "Proto Alga 2" naming and gives the world character.

---

## 3. Detailed Design

### 3.1 Genome module (`src/engine/genome.ts`)

```typescript
function mutateGenome(genome: number[], rng: Rng, config: SimConfig): number[]
function geneticDistance(genomeA: number[], genomeB: number[]): number
function clampGenome(genome: number[]): number[]
```

### 3.2 Speciation module (`src/engine/speciation.ts`)

```typescript
interface SpeciationResult {
  updatedSpecies: Species[];  // may include new species
  speciationEvents: Array<{ parentId: string; childId: string }>;
}

function checkSpeciation(species: Species[], rng: Rng, config: SimConfig): SpeciationResult
```

### 3.3 Updated Species interface

Add `originalGenome: number[]` to the Species interface in `types.ts`. This tracks the genome at the time the species was created or last speciated, used as the reference point for speciation distance.

### 3.4 Environment module (`src/engine/environment.ts`)

```typescript
function computeFitnessModifier(species: Species, temperature: number): number
function updateBiomeTypes(biomes: Biome[], temperature: number): Biome[]
```

### 3.5 Temperature control (`src/components/TemperatureControl.tsx`)

Slider component:
- Range: -20°C to 50°C
- Shows current value and a label (e.g., "Warm — forests thriving")
- Updates `worldState.temperature` on change

### 3.6 Updated BiomeMap with species colours

Each biome cell draws small coloured circles per species present, sized proportional to population. Legend shows species name → colour mapping.

### 3.7 Name generator (`src/engine/names.ts`)

Syllable-based procedural name generator. Deterministic given the RNG state.

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/types.ts` | **MODIFIED** — add `originalGenome: number[]` to Species | MEDIUM — contract change, update all Species creation |
| `src/engine/genome.ts` | **NEW** — mutation, genetic distance, clamping | LOW |
| `src/engine/genome.test.ts` | **NEW** | LOW |
| `src/engine/speciation.ts` | **NEW** — speciation check and species splitting | MEDIUM — creates new species |
| `src/engine/speciation.test.ts` | **NEW** | LOW |
| `src/engine/environment.ts` | **NEW** — temperature fitness and biome type updates | LOW |
| `src/engine/environment.test.ts` | **NEW** | LOW |
| `src/engine/names.ts` | **NEW** — procedural name generator | LOW |
| `src/engine/names.test.ts` | **NEW** | LOW |
| `src/engine/tick.ts` | **MODIFIED** — integrate mutation, speciation, environment | MEDIUM |
| `src/engine/factory.ts` | **MODIFIED** — add originalGenome to initial species | LOW |
| `src/engine/index.ts` | **MODIFIED** — re-export new modules | LOW |
| `src/components/TemperatureControl.tsx` | **NEW** — temperature slider | LOW |
| `src/components/BiomeMap.tsx` | **MODIFIED** — colour-coded species dots | MEDIUM |
| `src/components/useSimulation.ts` | **MODIFIED** — expose temperature setter | LOW |
| `src/App.tsx` | **MODIFIED** — add temperature control, pass setter | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/rng.ts` | Consumed, not modified |
| `src/engine/interactions.ts` | Interaction matrix works with any species — no changes needed |
| `src/engine/biome.ts` | `deriveBiomeType()` already accepts temperature as parameter |

---

## 5. Concepts Introduced

**Genetic drift:** In biology, random changes in gene frequency over generations. In our simulation, we model this as small random perturbations to the species' genome each tick. Most mutations are tiny (Gaussian distribution), but over many ticks they accumulate into significant trait changes. This is what drives speciation — a population slowly becomes something new.

**Speciation:** The formation of new species. In biology, this happens when populations become reproductively isolated (can't interbreed). In our simulation, it happens when the accumulated genetic drift exceeds a threshold distance from the original genome. Think of it as: the species has changed so much it's no longer the same thing.

**Selection pressure:** An environmental force that favours certain traits. When you raise the temperature, species with high heat tolerance survive better than those without. Over time, this shapes which species thrive and which go extinct. In our simulation, temperature is the first (and for v0.1, only) selection pressure the player can control.

**Fitness modifier:** A multiplier on growth rate based on how well-suited a species is to its environment. A fitness of 1.0 means optimal conditions; below 1.0 means the species is struggling; below 0 means conditions are lethal. This is the mechanical connection between the player's temperature slider and the simulation's dynamics.

---

## 6. Test Strategy

| # | Test | What It Verifies |
|---|------|-----------------|
| T1 | `mutateGenome()` with fixed seed produces identical result | Mutation determinism |
| T2 | Mutated genome differs from original by small amounts | Mutation magnitude |
| T3 | Mutated genome values stay within TRAIT_REGISTRY min/max | Clamping |
| T4 | `geneticDistance()` of identical genomes is 0 | Distance baseline |
| T5 | `geneticDistance()` of different genomes is > 0 | Distance detection |
| T6 | Species with distance > threshold speciates | Speciation trigger |
| T7 | Species with distance < threshold does not speciate | Speciation guard |
| T8 | Speciation creates exactly 2 species from 1 (parent + child) | Speciation mechanics |
| T9 | Population split 50/50 between parent and child | Population conservation |
| T10 | `computeFitnessModifier()` returns ~1.0 for well-suited species | Fitness baseline |
| T11 | `computeFitnessModifier()` returns < 1.0 for poorly suited species | Fitness penalty |
| T12 | `updateBiomeTypes()` changes biome types when temperature changes | Dynamic biomes |
| T13 | End-to-end: seed X, 1000 ticks → at least one speciation event | Speciation actually happens |
| T14 | Name generator produces deterministic names from seed | Name determinism |
| T15 | Name generator produces different names for different seeds | Name variety |

---

## 7. Acceptance Criteria

1. Species genomes mutate each tick via small Gaussian perturbations.
2. Trait values stay clamped to TRAIT_REGISTRY min/max.
3. Speciation occurs when genetic distance from original genome exceeds threshold.
4. New species get auto-generated names.
5. Population splits 50/50 on speciation.
6. Temperature slider controls global temperature (-20°C to 50°C).
7. Temperature affects species fitness via tolerance traits.
8. Biome types update dynamically when temperature changes.
9. Biome map shows colour-coded dots per species (green/amber/red by trophic level).
10. Species list updates as new species appear.
11. All T1–T15 tests pass.
12. All existing tests continue to pass.
13. `npx tsc --noEmit` zero errors.
14. `npx eslint .` zero errors.

---

## 8. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Adding `originalGenome` to Species interface breaks existing tests/factory | MEDIUM | Small blast radius — only factory and a few tests create Species objects. Update all in this chunk. |
| Speciation creates too many species too fast (population explosion of species) | MEDIUM | Minimum time between speciation events per lineage (e.g., 100 ticks). Speciation threshold tuned to produce 1-2 events per 500 ticks in initial testing. |
| Temperature slider makes the game trivially breakable (set to -20, everything dies) | LOW | This is actually desirable — it's the player's first "oh no" moment. Mass extinction from extreme temperature is a feature, not a bug. Recovery through new species adapted to extreme temps is the interesting outcome. |
| Too many species on the biome map makes it visually noisy | LOW | Limit to top 5 species per biome cell by population. Show others as a faded "other" indicator. |
| Mutation + speciation + temperature + interactions in the same tick loop is complex | MEDIUM | Each system is a separate pure function called sequentially in tick(). Order: mutate → check speciation → update environment → compute interactions → population dynamics. Each function is independently tested. |

---

*Radiate · BRF-004 · Pre-Implementation Brief · March 2026*
