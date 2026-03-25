# CLAUDE.md — Radiate

> Idle evolution ecosystem builder with genuine emergent simulation and a living social metagame.

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build
- `npx tsc --noEmit` — Type-check (run before every commit)
- `npm test` — Run Vitest suite

## Essential context

- **Read `HANDOVER.md` at session start.** It has project context, owner working preferences, and the phased roadmap.
- **Read `DEFERRED_DECISIONS.md` before proposing new features.** The decision may already be deferred with context.
- **Vision document:** `docs/20260322_vision.md` — full product vision, target market, game loop design.

## Owner working style (non-negotiable)

- **Brief before code.** No medium+ feature without an implementation brief and explicit approval. Use `/plan`.
- **Explain the why.** Will is learning game dev. Explain new concepts, patterns, and trade-offs when they arise.
- **Challenge assumptions.** Present options with trade-offs, not defaults. When Will asks "how do others do this?" — survey approaches genuinely.
- **Consultancy reports for big decisions.** Offer a simulated SME panel report before major architectural choices.
- **Keep governance current.** Update DEFERRED_DECISIONS.md, lessons learned, and feature registry as work progresses.
- **Session handovers.** Offer a handover summary at end of each session (what was built, decisions made, what's next).

## Architecture boundaries

```
src/engine/  →  WorldState  →  src/components/
```

- Engine modules NEVER import from components.
- Components NEVER import from engine directly — they consume WorldState.
- Engine is pure TypeScript. No DOM, no React, no side effects. Must run headless.
- All persistence through `src/data/` layer, never direct localStorage in components.

## Code conventions

- TypeScript strict mode. No `any`.
- Functional React components only. Tailwind for styling.
- Vitest for tests. Engine functions must have unit tests. Tests live next to source files.
- Git: imperative commit messages, < 72 chars. Small focused commits.
- `npx tsc --noEmit` must pass before any commit.

## Quality framework

> Claude is the sole developer. There is no human code reviewer.
> Quality is enforced through automated gates and structured process.

### Automated gates (pre-commit)

Every commit passes through a pre-commit hook (Husky + lint-staged). No bypass.

| Gate | Tool | What it catches |
|------|------|-----------------|
| Type safety | `tsc --noEmit` | Type errors, strict mode violations |
| Tests | `vitest run` | Regressions, broken simulation contracts |
| Lint | `eslint` | Code smells, unused vars, architecture boundary violations |
| Format | `prettier --check` | Style inconsistency |

If any gate fails, the commit is rejected. Fix the root cause.

### Architecture enforcement

The engine/component boundary is enforced at lint time via ESLint's `no-restricted-imports` rule. Engine files cannot import from `src/components/`. This is structural, not discretionary.

### Testing standards

**Engine (`src/engine/`)** — institutional quality:
- Every exported function gets a unit test. No exceptions.
- Tests are pure: given input X, expect output Y. No mocks.
- Deterministic simulation tests: seed a WorldState, tick N times, assert properties (not exact values).
- Invariant tests: conservation laws, no negative populations, valid parent-child species relationships.
- Offline/time-jump tests: verify `tick()` produces sane results for delta = 1s, 60s, 3600s, 86400s, 604800s.
- Coverage target: 80% on `src/engine/`. Revisit at v0.2.

**Components (`src/components/`)** — pragmatic coverage:
- Test complex derived logic (formatters, calculators). Skip pure render tests.
- No coverage threshold. Coverage is a byproduct, not a target.

**Test co-location:** `<module>.test.ts` next to `<module>.ts`.

### Simulation-specific quality

- **Seed-based reproducibility.** The simulation RNG accepts a seed. Tests use fixed seeds. This also enables replay and bug reports ("seed X, tick Y").
- **WorldState snapshot tests.** 3–5 canonical scenarios: known initial state → fixed seed → N ticks → snapshot result. Catches unintended behavioural changes during refactors.

### Velocity/robustness heuristic

> "Can we change this later without rewriting what depends on it?"

| Answer | Action | Examples |
|--------|--------|----------|
| **No** — it's a contract | Slow down. Brief first. Test thoroughly. | WorldState shape, engine interfaces, tick loop, persistence format |
| **Yes** — it's an implementation detail | Move fast. Refactor freely later. | Component styling, chart config, UI layout, tooltip text |

### Process quality (the reviewer replacement)

1. **Post-implementation explanation.** After building a feature, Claude explains: what was built, which pattern was chosen, what alternative was rejected and why. This builds Will's mental model over time.
2. **Mandatory lessons learned.** Any rework gets a row in the Lessons Learned table. No silent fixes.
3. **Architecture Decision Records.** When a pattern constrains future options, document it in `docs/adr/NNN-title.md` before implementing. Half a page max. Three sections: Context (why this decision arose), Decision (what we chose), Consequences (what's easier/harder now). Written before implementation, reviewed by Will — this is where architectural judgement is exercised. Expected: 3–5 ADRs for v0.1.

## Design principles

1. **Simulation is the product.** Does this make the simulation more interesting or more legible?
2. **Engine before renderer.** Simulation works headless. Rendering is a view of state.
3. **Idle-native.** Time jumps, offline catch-up, notifications are structural.
4. **Emergence over scripting.** No predetermined evolution paths.
5. **Legibility over realism.** Causal attribution makes every outcome explicable.
6. **Brief before code.** Speed makes discipline more important, not less.
7. **Defer consciously.** Every "later" gets a DDR entry.

## Current phase

**v0.3 "Living World"** — IBM engine complete (Session 4). Remaining: Web Worker fast-forward, direct IBM creature rendering, edge-of-chaos regulator, species share codes.

v0.2 "Naturalist" is complete (Sessions 2–3). v0.1 "First Life" is complete (Session 1, 2026-03-22).

## Lessons learned

| # | Lesson | Root Cause | Prevention Rule |
|---|--------|-----------|-----------------|
| 1 | Adding fields to WorldState breaks saved games | Old localStorage saves lack new fields, causing TypeError on load | Always add migration logic in `loadWorld()` when adding fields to WorldState. Test with a save from the previous format. |
| 2 | `tsc --noEmit` passes but `tsc -b` (build mode) fails | Build mode uses project references and stricter checking. Type casts that pass `--noEmit` can fail in `-b` mode. | Run `npm run build` (which uses `tsc -b`) before declaring work complete, not just `tsc --noEmit`. |
| 3 | v1 saves cannot migrate to IBM engine | L-V population counts have no spatial information; IBM needs individual creature positions, genomes, energy. No meaningful conversion path. | When a major engine replacement changes the WorldState shape fundamentally (not just adding fields), version-bump the save format and fall back to clean restart. |

## Feature registry

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| F-001 | Core simulation engine (tick loop, Lotka-Volterra) | v0.1 | Complete |
| F-002 | 2D Canvas biome map with species colour coding | v0.1 | Complete |
| F-003 | Population charts (Recharts) | v0.1 | Complete |
| F-004 | Species list with trophic levels | v0.1 | Complete |
| F-005 | Temperature control slider | v0.1 | Complete |
| F-006 | Genome mutation and speciation | v0.1 | Complete |
| F-007 | Offline progression and persistence | v0.1 | Complete |
| F-008 | GitHub Pages auto-deploy | v0.1 | Complete |
| F-009 | Species cards / bestiary | v0.2 | Complete |
| F-010 | Extinct species registry | v0.2 | Complete |
| F-011 | Phylogenetic tree | v0.2 | Complete |
| F-012 | 3D terrain with orbital camera (Phase 1) | v0.2 | Complete |
| F-013 | Genome-driven 3D creatures with behaviour AI (Phase 2) | v0.2 | Complete |
| F-014 | 3D visual polish: sky dome, PBR shading, shadows | v0.2 | Complete |
| F-015 | Click-to-select creatures in 3D view | v0.2 | Complete |
| F-016 | Terrain sculpting (elevation/moisture tools) | v0.2 | Complete |
| F-017 | Three.js → Babylon.js migration (DDR-012) | v0.2→v0.3 | Complete |
| F-018 | Biome energy production + dynamic producer K | v0.2 | Complete |
| F-019 | Trophic energy transfer + consumer K | v0.2 | Complete |
| F-020 | IBM engine — individual creatures replace L-V equations | v0.3 | Complete |
