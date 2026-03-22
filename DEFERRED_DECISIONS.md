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
| DDR-009 | Explicit geographic features layer | OPEN | Mountain ranges, volcanoes, rivers span multiple biomes. Options: (A) emergent from per-biome elevation/moisture (current v0.1 approach), (B) explicit `GeographicFeature` objects with named features spanning biome IDs. Option B enables narrative ("eruption at Mt. Pyroclast") and terrain sculpting. Option A is sufficient while there are no events or terrain tools. | Before v0.3 (terrain sculpting) |
| DDR-010 | Simulation rollback / checkpoints | OPEN | Allow player to rewind to a past WorldState and branch. Options: (A) checkpoint every N ticks storing full WorldState snapshots, (B) checkpoint at significant events only (speciation, extinction), (C) full replay log. Pairs with event log and causal attribution in v0.2. WorldState is already serialisable; adding checkpoints is additive. Compelling feature: "what if I hadn't raised the temperature?" | v0.3 |
| DDR-011 | Individual-level genomes | OPEN | Current model: one genome per species (population-level). Individual-level: each organism has its own genome with variation. Enables within-species diversity, natural selection, individual creature display, and specimen sharing. Cost: O(individuals) per tick (~500x more computation), requires Web Worker. Current architecture supports transition: Species can add `individuals: Individual[]` without breaking population-level dynamics. Population-level sufficient for v0.1 speciation/evolution. | v0.3 or v0.4 |
| DDR-012 | Phase 2→3 engine migration checkpoint | OPEN | Three.js chosen for Phase 1-2 (terrain + creatures). Babylon.js identified as optimal for Phase 3+ (player character, building, physics). Before starting Phase 3, assess: is the player character vision still the direction? How painful is custom character controller in Three.js vs Babylon built-in? Has the engine landscape changed? See `docs/reports/ddr-002-resolution.md`. | After Phase 2 completion |

---

## Resolved Decisions

| DDR | Title | Status | Resolution | Resolved In |
|-----|-------|--------|------------|-------------|
| DDR-002 | 3D rendering approach | RESOLVED | Three.js (raw) for Phase 1-2 (terrain + creatures). Babylon.js for Phase 3+ (player character, building) — conditional on DDR-012 migration checkpoint. All 3D code isolated in `src/world3d/`, terrain generation logic kept as pure TS, WorldState remains the engine↔renderer contract. See `docs/reports/ddr-002-3d-engine-assessment.md` for full consultancy report. | v0.2 / Session 2 |

---

## Decision Log Format

When resolving a DDR, move it from Active to Resolved with:
- **Resolution:** What was decided and why
- **Resolved In:** Which version/session the decision was made

When adding a new DDR, assign the next sequential number and fill in all Active columns.
