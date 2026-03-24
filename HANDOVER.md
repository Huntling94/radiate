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
| `DEFERRED_DECISIONS.md` | 11 decisions explicitly deferred with context and resolve-by triggers |
| `HANDOVER.md` | This document — project context and session history |
| `docs/20260322_vision.md` | Full product vision document (March 2026) |
| `docs/adr/` | Architecture decision records (3 ADRs) |
| `docs/briefs/` | Implementation briefs (7 BRFs) |
