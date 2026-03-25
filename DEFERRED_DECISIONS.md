# Deferred Decisions Register — Radiate

> Decisions explicitly deferred for later. Nothing is forgotten, only postponed.
> Format follows the LPMDS governance pattern established across 32 sessions.

---

## Active Decisions

| DDR | Title | Status | Context | Resolve By |
|-----|-------|--------|---------|------------|
| DDR-001 | Social backend technology | OPEN | Species gallery, leaderboard, and introduction tracking (v0.3+) require a backend. Options: Supabase, Cloudflare Workers + D1, Firebase. | Before v0.3 |
| DDR-002 | 3D rendering approach | RESOLVED | See Resolved Decisions below. | Session 2 |
| DDR-003 | Monetisation model | OPEN | Options: free + OSS, free browser + paid Steam ($5–10), Patreon-supported. Premature before product-market fit. | When WAU > 2K |
| DDR-004 | Mobile distribution | OPEN | PWA vs native app. PWA provides push notifications and home screen install with no app store friction. | Post-launch |
| DDR-005 | Simulation pacing | OPEN | Events per real hour. Options: high (1/5min), medium (1/15min), configurable. Requires playtesting data. | v0.3 tuning |
| DDR-006 | Species invasion UX | OPEN | How player controls biosecurity when random invasions toggled on. Options: simple toggle, quarantine preview, trait-based filters. | Before v0.4 |
| DDR-007 | Epoch prestige mechanics | OPEN | What persists between worlds. Options: tools only, tools + species museum, tools + unlocked trait archetypes. | Before v0.4 |
| DDR-008 | Co-evolution modelling | OPEN | Symbiosis types to implement first. Options: parasitism (simplest), pollination (most visual), defer entirely. Core pred-prey must be stable first. | When v0.2 sim stable |
| DDR-009 | Explicit geographic features layer | RESOLVED | See Resolved Decisions below. | v0.2 / Session 3 |
| DDR-010 | Simulation rollback / checkpoints | OPEN | Allow player to rewind to a past WorldState and branch. Options: (A) checkpoint every N ticks storing full WorldState snapshots, (B) checkpoint at significant events only (speciation, extinction), (C) full replay log. Pairs with event log and causal attribution in v0.2. WorldState is already serialisable; adding checkpoints is additive. Compelling feature: "what if I hadn't raised the temperature?" | v0.3 |
| DDR-011 | Individual-level genomes | RESOLVED | See Resolved Decisions below. | Session 4 |
| DDR-012 | Phase 2→3 engine migration checkpoint | RESOLVED | See Resolved Decisions below. | Session 3 |
| DDR-013 | Web Worker for fast-forward | OPEN | IBM engine runs on main thread at 1 tick/sec. Fast-forward (100x–10,000x) and offline catch-up need a Web Worker to avoid blocking the UI. ibmTick() is pure and worker-ready. | Session 5 |
| DDR-014 | Statistical fast-forward for long absences | OPEN | MAX_SUB_TICKS caps catch-up at ~2.8 hours of simulation. Multi-day absences need either a higher cap (slow) or a statistical approximation (estimate births/deaths without simulating each tick). | When players report slow catch-up |
| DDR-015 | Direct IBM creature rendering | OPEN | 3D view currently renders cosmetic creatures from speciesClusters data. Could render actual IBM creatures by position for true "what you see is the simulation" experience. Requires mesh management for 100+ creatures with instancing/LOD. | Session 5 |

---

## Resolved Decisions

| DDR | Title | Status | Resolution | Resolved In |
|-----|-------|--------|------------|-------------|
| DDR-002 | 3D rendering approach | RESOLVED | Three.js (raw) for Phase 1-2 (terrain + creatures). Babylon.js for Phase 3+ (player character, building) — conditional on DDR-012 migration checkpoint. All 3D code isolated in `src/world3d/`, terrain generation logic kept as pure TS, WorldState remains the engine↔renderer contract. See `docs/reports/ddr-002-3d-engine-assessment.md` for full consultancy report. | v0.2 / Session 2 |
| DDR-009 | Explicit geographic features layer | RESOLVED | Enhanced Option A: geography is emergent from per-biome elevation/moisture, with player terrain sculpting tools for direct manipulation. Player can raise/lower elevation and increase/decrease moisture, which automatically changes biome types and carrying capacities through the existing `updateBiomeTypes()` pipeline. Named geographic features (Option B) may be layered on top later as a naming/narrative system but are not needed for the core sculpting mechanic. | v0.2 / Session 3 |
| DDR-011 | Individual-level genomes | RESOLVED | Implemented in BRF-016 (IBM Engine Core). Every creature now has its own genome, inherited from parent with mutation. Species is a derived concept via genome clustering (DBSCAN-like). Within-species variation, natural selection on individuals, and emergent speciation from geographic isolation are all now possible. The L-V population-level engine has been deleted. | v0.3 / Session 4 |
| DDR-012 | Phase 2→3 engine migration checkpoint | RESOLVED | Migration to Babylon.js completed. Player character vision confirmed by owner. Three.js replaced with Babylon.js (`@babylonjs/core` + `@babylonjs/materials`) in `src/world3d/`. All Phase 2 features (terrain, creatures, behaviour AI, camera, interaction, sculpting) ported with full feature parity. Simulation engine, persistence, and dashboard components untouched. See `docs/briefs/BRF-015_Babylon_Migration.md` for the full migration brief with SME review. | v0.2→v0.3 / Session 3 |

---

## Decision Log Format

When resolving a DDR, move it from Active to Resolved with:
- **Resolution:** What was decided and why
- **Resolved In:** Which version/session the decision was made

When adding a new DDR, assign the next sequential number and fill in all Active columns.
