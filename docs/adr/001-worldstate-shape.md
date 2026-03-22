# ADR-001: WorldState Shape

**Status:** Accepted
**Date:** 2026-03-22

## Context

The simulation engine needs a shared data shape that serves as the contract between engine modules, UI components, and the persistence layer. This is the highest-cost contract in the project — changing it after multiple consumers exist requires coordinated rework across every layer. The shape must support all v0.1 features (tick loop, population dynamics, speciation, environment, persistence) while remaining extensible for v0.2+.

## Decision

WorldState is a single immutable snapshot of the entire simulation. Each `tick()` call takes a WorldState and returns a new one (pure function, no mutation).

Key structural choices:
- **Biomes as flat array** with `(x, y)` grid coordinates — easier to iterate/filter than 2D arrays, serialises cleanly
- **Species population stored per-biome** (`Record<string, number>`) — required for geographic speciation, biome rendering, and per-biome carrying capacity
- **Genome as `number[]`** with a separate trait registry — simple mutation (perturb each element), clean genetic distance (Euclidean), extensible (add traits by extending the array)
- **Serialisable RNG state** in WorldState — enables save/load without losing determinism
- **SimConfig embedded** — simulation parameters travel with the state

## Consequences

**Easier:**
- Persistence: serialise one object, done
- Testing: create a WorldState, pass it to a function, assert on the output
- React rendering: reference equality detects changes
- Replay/undo: store historical snapshots

**Harder:**
- Large-scale worlds (10,000+ species): immutable copies become expensive. Acceptable for v0.1 scale (dozens of species, 48 biomes). Revisit if scale increases dramatically.
- Querying by position: flat biome array requires a scan or index. Mitigated by small grid size (48 cells) and utility functions.

## Deferred

The following fields are **not** included in v0.1 and will be added in later versions:
- `eventLog: SimEvent[]` — causal event log (v0.2)
- `phylogenyMetadata` — tree structure for phylogenetic view (v0.2)
- `shareMetadata` — species export/import tracking (v0.2)
- `features: GeographicFeature[]` — named multi-biome features like mountain ranges (v0.3, see DDR-009)
