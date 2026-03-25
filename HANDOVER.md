# Project Handover — Radiate

> Context document for onboarding new Claude Code sessions.
> Read this alongside CLAUDE.md and DEFERRED_DECISIONS.md.

---

## Who is the owner

Will is the sole product owner, stakeholder, and business strategist for Radiate. He provides product direction, makes all scope decisions, and guides the project from a business and customer perspective. Claude is the sole developer.

Will is a strategy consultant with a computer science background — not a software developer. He provides product direction, architectural challenge, and business strategy. He cannot review code for correctness; quality governance must be automated and structural (see Quality Framework in CLAUDE.md). He has built a separate institutional-grade financial analytics platform (LPMDS) over 32+ sessions with a previous Claude instance. That project established the governance patterns used here: brief-first workflow, deferred decisions register, consultancy reports, lessons learned, feature registry, and session handover documents.

---

## How Will works — observed preferences

These preferences were observed across 32 sessions of collaborative development on a separate project. Claude Code should follow these patterns:

### Decision-making style
- **Will challenges assumptions.** He expects Claude to present options with trade-offs rather than defaulting to the first solution. When Will asks "how do others do this?" he wants a genuine survey of approaches, not a single recommendation.
- **Will thinks in business terms.** He frames features around customer needs, market positioning, and competitive differentiation. Claude should connect technical decisions to their business implications.
- **Will uses consultancy reports to stress-test thinking.** Before committing to major architectural decisions, he commissions simulated SME panel reports. These are 3-person panels with relevant expertise, structured scoring, and explicit recommendations. Claude should offer to produce these when the decision is significant.
- **Will wants to understand the "why."** He engages substantively with methodology trade-offs and financial/technical concepts. Claude should explain reasoning step-by-step when introducing new concepts, not just present conclusions.

### Communication preferences
- **Brief before code, always.** Will expects an implementation brief (BRF format, see `docs/briefs/`) before any medium or large feature is built. Wait for explicit approval before writing code.
- **Step-by-step calculations / reasoning printed in chat.** When explaining how something works, walk through the logic concretely.
- **No demo language.** Never say "as a demo" or "for demonstration purposes." Everything built is real, production-intent code.
- **Governance documents are first-class deliverables.** CLAUDE.md, DEFERRED_DECISIONS.md, handover notes, and consultancy reports are as important as code. Keep them current.

### Quality standards
- **TypeScript strict mode, no exceptions.** Run `npm run build` before declaring anything complete (Lesson 2).
- **Tests for every engine function.** The simulation engine is the product — untested simulation code is unshipped code.
- **Clean architecture boundaries.** Engine never imports from components. Components never import from engine directly. The WorldState interface is the contract.
- **Always add migration logic when changing WorldState shape** (Lesson 1).

### What Will is learning
- This is Will's first project using Claude Code (he's learning the tool alongside building the game).
- Will is learning 3D graphics programming (Babylon.js, migrated from Three.js in Session 3) as a personal learning goal.
- Will is learning game development concepts: ECS architecture, game loops, procedural generation, agent-based simulation. Explain these when they come up.
- Will has React/TypeScript/Vite familiarity from LPMDS but is not a developer. He can follow code and challenge architectural direction, but cannot review code for correctness. Claude must self-govern code quality through automated gates and testing (see Quality Framework in CLAUDE.md).

---

## Session 4 summary (2026-03-25)

### What was built

**v0.3 "Living World" — IBM Engine Core (BRF-016):**
- **Individual-Based Model engine** replaces Lotka-Volterra population equations. Every creature is an independent entity with its own genome, position, energy budget, and behavioural state. Population dynamics emerge from individual birth, death, feeding, and reproduction.
- **New engine modules:**
  - `constants.ts` — all tunable IBM constants with documented rationale
  - `spatial-utils.ts` — coordinate conversion (extracted from world3d/terrain.ts for engine access)
  - `spatial-hash.ts` — O(1) amortised neighbour queries for creature interactions
  - `creature.ts` — creature lifecycle: photosynthesis, foraging, hunting, fleeing, metabolism, reproduction
  - `clustering.ts` — genome-based species clustering (DBSCAN-like) with stable IDs
  - `ibm-tick.ts` — IBM simulation loop replacing L-V tick
- **Deleted L-V engine:** `tick.ts`, `interactions.ts`, `speciation.ts` and all associated tests
- **WorldState expanded:** `Creature[]`, `SpeciesCluster[]`, `nextCreatureId` fields added. `SpeciesCluster` is structurally compatible with `Species` — all dashboard components work with minimal changes.
- **25×25 grid** (625 biomes, ~400 habitable) replaces 12×8 grid
- **100 seed creatures** (50 producers, 30 herbivores, 20 predators) with individual genomes
- **Sessile producers** — plants are creatures with lightweight ticks (no sense/decide/move), density-capped per biome
- **Genome-derived lifespan** — creatures age and die based on their traits
- **Persistence v2** — v1 L-V saves cannot migrate to IBM; clean restart on load
- 173 tests (17 test files), 4 new BRFs (but only BRF-016 implemented this session)

### Design decisions resolved with owner

| # | Question | Decision |
|---|----------|----------|
| Q1 | Starting creature count | **100** |
| Q2 | Energy constants | Documented in constants.ts with rationale |
| Q3 | Reproduction model | **Asexual** (clone + mutate) |
| Q4 | Clustering frequency | **Tunable constant, start at 100 ticks** |
| Q5 | Creature lifespan | **Genome-derived** |
| Q6 | Grid size | **25×25** |
| Q7 | L-V engine fate | **Delete** (not kept as fallback) |
| Q8 | Producer model | **Sessile creatures, lightweight tick, density cap** |
| Q9 | Web Worker | **Session 5** (DDR-013) |
| Q10 | Coordinate utilities | **Extract to engine** |

### Commits (Session 4)
1. `a592441` — IBM foundation: constants, spatial utilities, spatial hash (BRF-016)
2. `e5c9d75` — Creature lifecycle and genome clustering modules (BRF-016)
3. `423c89f` — IBM tick loop and WorldState IBM fields (BRF-016)
4. `c9926c9` — Switch engine from L-V to IBM — delete old engine, wire IBM into app (BRF-016)

### Key decisions made this session
1. **Every creature is an independent entity** — no more population-level equations. What the player sees is the simulation.
2. **Species is a derived concept** — genome clustering groups creatures by genetic similarity, not a first-class entity.
3. **Producers are sessile creatures** — plants don't move but do photosynthesise, reproduce, and evolve. Density cap prevents population explosion.
4. **Asexual reproduction** — clone + mutate. Sexual reproduction deferred as future enhancement.
5. **L-V engine deleted, not kept as fallback** — clean break. The IBM is the engine now.
6. **v1 saves cannot migrate to IBM** — fundamental WorldState shape change (Lesson 3).

### What's next

| Feature | Priority | Delivers | Notes |
|---------|----------|----------|-------|
| **Web Worker fast-forward** | Session 5 | FF mode + offline catch-up without UI blocking | DDR-013. ibmTick() is pure and worker-ready. |
| **Direct IBM creature rendering** | Session 5 | 3D creatures positioned from IBM data, not cosmetic | DDR-015. True "what you see is the simulation." |
| **Edge-of-chaos regulator** | Session 5 | Prevents stagnation or explosion | Monitors diversity, nudges mutation/energy. |
| **Species share codes** | Session 5–6 | Export/import creature genomes as URL-encoded JSON | Social layer 1. |
| **Player character** | Session 7 | Babylon CharacterController + Havok physics | DDR-012 resolved — Babylon.js ready. |

### Active DDRs
- DDR-001: Social backend technology (before v0.3)
- DDR-005: Simulation pacing (v0.3 tuning)
- DDR-010: Simulation rollback/checkpoints (v0.3)
- DDR-013: Web Worker for fast-forward (Session 5)
- DDR-014: Statistical fast-forward for long absences (when players report slow catch-up)
- DDR-015: Direct IBM creature rendering (Session 5)

### Architecture notes for next session
- `src/engine/ibm-tick.ts` is the simulation entry point — `ibmTick(state, deltaSec): WorldState`
- `src/engine/creature.ts` has per-trophic-level tick functions: `producerTick()`, `herbivoreTick()`, `predatorTick()`
- `src/engine/clustering.ts` runs DBSCAN-like clustering every `clusteringInterval` ticks (default 100)
- `src/engine/spatial-hash.ts` provides O(1) neighbour queries — rebuilt each tick
- `src/engine/constants.ts` contains all tunable parameters with documented rationale
- `src/engine/spatial-utils.ts` has coordinate conversion functions (authoritative; world3d/terrain.ts still has its own copies)
- `WorldState.creatures: Creature[]` — individual creatures with `x`, `z` top-level for SpatialEntry compatibility
- `WorldState.speciesClusters: SpeciesCluster[]` — derived species groupings. `species` field aliases this for dashboard compatibility.
- `WorldState.species` is typed as `SpeciesCluster[]` — all components use `SpeciesCluster` type
- 3D view still uses cosmetic creature system (`syncSpecies` from speciesClusters) — DDR-015 will switch to direct rendering

---

## Session 3 summary (2026-03-22 to 2026-03-25)

### What was built

**v0.2 completion — 3D Polish + Terrain Sculpting (BRF-012):**
- Sky dome (GLSL gradient shader), PBR terrain shading with shadows, creature shadow casting
- Click-to-select creatures via raycasting (mesh.metadata pattern)
- Terrain sculpting tools: raise/lower elevation, wet/dry moisture, with keyboard shortcuts (Q/1-4)
- Right-click orbit, left-click tool action separation
- Fix: creatures walking through ocean and mountain terrain

**v0.2 completion — Energy System (BRF-013 + BRF-014):**
- Biome energy production: forest > grassland > tundra > desert, modulated by moisture and temperature
- Dynamic producer carrying capacity from biome energy
- Trophic energy transfer: herbivore K from producer biomass, predator K from herbivore biomass
- Metabolism r-K trade-off: high metabolism = fast growth but smaller equilibrium

**Three.js → Babylon.js Migration (BRF-015):**
- Full renderer replacement: `@babylonjs/core` + `@babylonjs/materials`
- Custom toon ShaderMaterial (GLSL quantized diffuse bands) replacing MeshToonMaterial
- Right-handed coordinate system (`scene.useRightHandedSystem = true`)
- All 3D features ported with visual parity: terrain, sky, creatures, camera, interaction, sculpting
- DDR-012 resolved — Phase 3 (player character) now unblocked

**Ecological gaps analysis and roadmap:**
- Comprehensive report: `docs/reports/ecological-gaps-and-roadmap.md`
- IBM engine design, map scaling analysis, 5-session development roadmap
- 10 open questions catalogued for Session 4 (all resolved)

### Commits (Session 3)
1. `b64c465` — 3D polish, click-to-select creatures, and terrain sculpting (BRF-012)
2. `5d3071d` — Fix creatures walking through ocean and mountain terrain
3. `a77f5f4` — Biome energy production and dynamic producer carrying capacity (BRF-013)
4. `f938582` — Trophic energy transfer and consumer carrying capacity (BRF-014)
5. `bd642a2` — Migrate 3D renderer from Three.js to Babylon.js (BRF-015)
6. `c355a98` — Fix terrain flicker and bump global test timeout to 30s
7. `a5f10d6` — New roadmap (ecological gaps analysis)

### Key decisions made this session
1. **IBM engine is the future** — L-V equations replaced by individual creature simulation (implemented in Session 4)
2. **Babylon.js migration now** — DDR-012 resolved ahead of schedule to unblock Phase 3
3. **Energy system layered in two phases** — producer K from biome energy (BRF-013), then consumer K from trophic transfer (BRF-014)
4. **25×25 grid for IBM** — conservative start, scale to 50×50 in Session 5

---

## Session 2 summary (2026-03-22)

### What was built

**v0.2 Chunk 9 — Species Cards / Bestiary (BRF-008 + BRF-008b):**
- Species card detail view in sidebar: click any species in the list to see full traits with parent delta markers, lineage breadcrumb, biome distribution mini-grid, and filtered event history
- Extinct species registry (`ExtinctSpecies` type on WorldState): archives every extinction with full Species data + `extinctionTick`, enabling complete lineage resolution back to seed species
- Save migration for existing worlds (adds empty `extinctSpecies` array)
- 4 new tests (82 total), 2 new BRFs

**v0.2 Chunk 10 — Phylogenetic Tree (BRF-009):**
- Interactive horizontal dendrogram rendered on Canvas, showing all living and extinct species
- Time flows left-to-right, living branches extend to current tick, extinct branches terminate with × marker
- Clickable nodes open species cards; selected species ancestry path highlighted in emerald
- Tab system in bottom panel (Events | Chart | Tree) replaces stacked layout
- No new dependencies — custom DFS slot-based layout algorithm

**3D World View — Phase 1: Terrain (BRF-010):**
- Three.js 3D terrain generated from biome elevation/moisture data with vertex colours
- Water plane at sea level, orbital camera (OrbitControls), species indicator billboards
- Full-screen 3D canvas with toggleable dashboard sidebar overlay
- All Three.js code isolated in `src/world3d/` per DDR-002 migration constraints
- 6 new terrain tests (88 total)

**3D World View — Phase 2: Creatures (BRF-011 → BRF-011b rethink):**
- First attempt (BRF-011) used geometric primitives locked to biome cells — looked like a data visualisation, rejected after visual review
- Rethink (BRF-011b): cute procedural creatures with rounded bodies, big heads, visible eyes
- 3–8 representative creatures per species roaming freely across the map
- Behaviour AI: producers sway, herbivores wander and flee, predators chase and catch prey
- WASD exploration camera replaces orbit-only controls
- Terrain scaled up (CELL_SIZE 4→10) for a larger explorable world
- MeshToonMaterial for warmer aesthetic

**Vision shift:** Owner commissioned external consultancy report identifying Babylon.js as the optimal long-term engine for the expanded vision (explorable world with playable character and building mechanics). Three.js chosen for Phase 1-2 to validate the 3D concept first. Migration checkpoint (DDR-012) before Phase 3.

### Commits (Session 2)
1. `3c1e22e` — Species cards with extinct species registry (BRF-008 + 008b)
2. `f571d94` — Handover update
3. `bc451a2` — Phylogenetic tree with bottom panel tabs (BRF-009)
4. `a513d83` — DDR timeline updates for reprioritisation
5. `5a18fba` — DDR-002 resolution + consultancy report + BRF-010 brief
6. `ae4a8b2` — 3D terrain with Three.js (BRF-010)
7. `e0bb107` — Genome-driven 3D creatures (BRF-011, superseded)
8. `a730b6a` — Creature rework: cute representatives with behaviour AI (BRF-011b)

### Reprioritisation (Session 2)

- Species share codes (chunk 11) and image export (chunk 12) **deferred to v0.3** — deliver most value alongside the social backend
- 3D world view **brought forward from v0.4** — completed Phase 1 (terrain) and Phase 2 (creatures)
- DDR-002 **resolved**: Three.js for Phase 1-2, Babylon.js for Phase 3+ (conditional on DDR-012 checkpoint)
- DDR-012 **created**: migration checkpoint before player character phase

### What's next

| Feature | Priority | Delivers | Notes |
|---------|----------|----------|-------|
| **3D polish + terrain sculpting** | Next (Session 3) | Sky dome, better shading, click-to-select creatures. Player can reshape terrain elevation/moisture — first strategic intervention. | Combined BRF pending. Resolves DDR-009 (geographic features). |
| Phase 3 — player character | After polish + sculpting | First/third-person camera, character on terrain | Triggers DDR-012 migration checkpoint |
| Species share codes | Deferred to v0.3 | Export/import species as URL-encoded JSON | Social backend (DDR-001) |
| Image export + tuning | Deferred to v0.3 | PNG export, edge-of-chaos regulator | DDR-005 (simulation pacing) |

### Active DDRs
- DDR-005: Simulation pacing (deferred to v0.3 tuning)
- DDR-009: Explicit geographic features layer (resolve during terrain sculpting)
- DDR-010: Simulation rollback/checkpoints (v0.3)
- DDR-012: Phase 2→3 engine migration checkpoint (after Phase 2, before player character)

### Key decisions made this session
1. **Extinct species are archived, not discarded** — `ExtinctSpecies` array on WorldState preserves full lineage for phylogenetic tree and species cards
2. **3D view is a nature documentary, not a data visualisation** — small number of representative creatures with personality, not population heatmaps
3. **Predator-prey behaviour is visual storytelling** — chase/flee/catch dramatises the Lotka-Volterra dynamics without changing the engine
4. **Three.js now, Babylon.js later** — validate 3D concept cheaply, migrate at Phase 3 boundary if vision still includes player character

### Architecture notes for next session
- `src/world3d/` contains all Babylon.js code — migrated from Three.js in Session 3 (BRF-015)
- `terrain.ts` is pure TypeScript (no Babylon.js) — survived the engine migration unchanged
- `creatures.ts` `CreatureManager` class manages creature lifecycle and behaviour — uses custom toon ShaderMaterial (GLSL quantized diffuse bands)
- `camera.ts` is a custom WASD+orbit rig — Babylon's built-in inputs disabled (`camera.inputs.clear()`)
- `scene.ts` uses `scene.useRightHandedSystem = true` to match Three.js coordinate conventions
- `scene.registerBeforeRender()` pattern for update loop — no manual requestAnimationFrame
- Pixel ratio capped at 2x via `engine.setHardwareScalingLevel()`
- Creature picking uses `mesh.metadata = { speciesId, pickable: true }` — no parent chain walking
- Shadow generator requires explicit `addShadowCaster()` / `removeShadowCaster()` for each mesh
- Dashboard overlay (species cards, phylogenetic tree, charts) floats over the Babylon canvas via absolute positioning
- **Phase 3 unlocked:** Babylon.js built-in CharacterController, Havok physics, FollowCamera available for player character work

---

## Session 1 summary (2026-03-22)

### What was built

**v0.1 "First Life" — Complete:**
- Core simulation engine: Lotka-Volterra multi-species dynamics, logistic growth, trait-derived interaction matrix
- Genome mutation and speciation (distance-from-origin model)
- Temperature control affecting biome types and species fitness
- 2D Canvas biome map with colour-coded species indicators and hover tooltips
- Population charts (Recharts), species list with trait bars
- Offline progression via tick() time-jumps, localStorage persistence
- GitHub Actions CI/deploy to GitHub Pages
- 78 tests across 11 test files, 3 ADRs, 7 BRFs

**v0.2 "Naturalist" — Started:**
- UI overhaul: game-like dark theme, larger biome cells, responsive map, tick speed control, trait bars
- Event log with causal attribution (speciation and extinction events recorded with reasons)
- World expanded to 12x8 grid (96 biomes)
- Save migration for WorldState schema changes

### Commits (Session 1)
1. `87f30de` — Governance docs
2. `0dcfabd` — Project scaffold + tooling + CI/deploy
3. `72dfc40` — WorldState types + RNG (BRF-001)
4. `d45120d` — Tick loop + Canvas map + React shell (BRF-002)
5. `93c60c3` — Multi-species Lotka-Volterra (BRF-003)
6. `0a4d153` — Genome mutation + speciation + temperature (BRF-004)
7. `af60363` — Persistence + offline progression (BRF-005)
8. `cab4421` — Governance update for v0.2
9. `97dc77f` — UI overhaul (BRF-006)
10. `db96ce1` — Event log + larger world (BRF-007)
11. `06acb3b` — Save migration fix
12. `556c69a` — Lesson learned: save migration
13. `3515471` — Lesson learned: tsc -b vs tsc --noEmit

### What's next (v0.2 remaining)

| Chunk | Status | Delivers |
|-------|--------|----------|
| 7 - UI overhaul | Complete | Polished layout, trait bars, tick speed, responsive map |
| 8 - Event log | Complete | Causal attribution, 12x8 world |
| 9 - Species cards/bestiary | Complete | Detailed species view with traits, lineage, history, extinct species registry |
| 10 - Phylogenetic tree | Not started | Visual branching tree of evolutionary history |
| 11 - Species share codes | Not started | Export/import species as URL-encoded JSON |
| 12 - Image export + tuning | Not started | PNG export, edge-of-chaos regulator |

### Active DDRs requiring attention
- DDR-005: Simulation pacing (resolve during v0.2 tuning)
- DDR-010: Simulation rollback/checkpoints (v0.2)

### Known issues
- GitHub Pages deployment requires `gh auth login` from PowerShell (gh CLI not on bash PATH in Claude Code)
- Browser localStorage may contain old save format — migration handles this but player may need to click "New Game" once

---

## Project context

### What Radiate is
An idle evolution ecosystem builder. The player shapes a world's environment and watches evolution unfold over geological timescales. The simulation runs while the player is away. Species can be shared between players' worlds.

### Tech stack
TypeScript, React 19, Vite 8, Tailwind CSS v4, Recharts, Babylon.js (3D engine). Browser-first (GitHub Pages). PWA for mobile (future).

### Architecture
```
src/engine/  →  WorldState  →  src/components/
     ↑                              ↑
  Pure TS, no DOM              React, Tailwind
  Fully tested                 Consumes WorldState
     ↓                              ↓
src/data/  (persistence layer, no direct localStorage in components)
```

### Live URL
https://huntling94.github.io/radiate/

### Development pace
Weekend sprints. Will provides product direction; Claude writes all code.

---

## Reference documents in this repo

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Governance framework, architecture, conventions, quality framework, lessons learned, feature registry |
| `DEFERRED_DECISIONS.md` | 15 deferred decisions (11 active, 4 resolved) with context and resolve-by triggers |
| `HANDOVER.md` | This document — project context and session history |
| `docs/20260322_vision.md` | Full product vision document (March 2026) |
| `docs/adr/` | Architecture decision records (3 ADRs) |
| `docs/briefs/` | Implementation briefs (16 BRFs: BRF-001 through BRF-016) |
| `docs/reports/` | Consultancy reports: 3D engine assessment, ecological gaps & roadmap |
