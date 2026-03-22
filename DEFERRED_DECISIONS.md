# Deferred Decisions Register — Radiate

> Decisions explicitly deferred for later. Nothing is forgotten, only postponed.
> Format follows the LPMDS governance pattern established across 32 sessions.

---

## Active Decisions

| DDR | Title | Status | Context | Resolve By |
|-----|-------|--------|---------|------------|
| DDR-001 | Social backend technology | OPEN | Species gallery, leaderboard, and introduction tracking (v0.3+) require a backend. Options: Supabase, Cloudflare Workers + D1, Firebase. | Before v0.3 |
| DDR-002 | 3D rendering approach | OPEN | 3D low-poly "zoom in" view brought forward from v0.4 to v0.2. Options: Three.js (raw), React Three Fiber, Babylon.js. Will is seeking external guidance on this decision. | Before 3D implementation (next feature) |
| DDR-003 | Monetisation model | OPEN | Options: free + OSS, free browser + paid Steam ($5–10), Patreon-supported. Premature before product-market fit. | When WAU > 2K |
| DDR-004 | Mobile distribution | OPEN | PWA vs native app. PWA provides push notifications and home screen install with no app store friction. | Post-launch |
| DDR-005 | Simulation pacing | OPEN | Events per real hour. Options: high (1/5min), medium (1/15min), configurable. Requires playtesting data. | v0.3 tuning |
| DDR-006 | Species invasion UX | OPEN | How player controls biosecurity when random invasions toggled on. Options: simple toggle, quarantine preview, trait-based filters. | Before v0.4 |
| DDR-007 | Epoch prestige mechanics | OPEN | What persists between worlds. Options: tools only, tools + species museum, tools + unlocked trait archetypes. | Before v0.4 |
| DDR-008 | Co-evolution modelling | OPEN | Symbiosis types to implement first. Options: parasitism (simplest), pollination (most visual), defer entirely. Core pred-prey must be stable first. | When v0.2 sim stable |
| DDR-009 | Explicit geographic features layer | OPEN | Mountain ranges, volcanoes, rivers span multiple biomes. Options: (A) emergent from per-biome elevation/moisture (current v0.1 approach), (B) explicit `GeographicFeature` objects with named features spanning biome IDs. Option B enables narrative ("eruption at Mt. Pyroclast") and terrain sculpting. Option A is sufficient while there are no events or terrain tools. | Before v0.3 (terrain sculpting) |
| DDR-010 | Simulation rollback / checkpoints | OPEN | Allow player to rewind to a past WorldState and branch. Options: (A) checkpoint every N ticks storing full WorldState snapshots, (B) checkpoint at significant events only (speciation, extinction), (C) full replay log. Pairs with event log and causal attribution in v0.2. WorldState is already serialisable; adding checkpoints is additive. Compelling feature: "what if I hadn't raised the temperature?" | v0.3 |
| DDR-011 | Individual-level genomes | OPEN | Current model: one genome per species (population-level). Individual-level: each organism has its own genome with variation. Enables within-species diversity, natural selection, individual creature display, and specimen sharing. Cost: O(individuals) per tick (~500x more computation), requires Web Worker. Current architecture supports transition: Species can add `individuals: Individual[]` without breaking population-level dynamics. Population-level sufficient for v0.1 speciation/evolution. | v0.3 or v0.4 |

---

## Resolved Decisions

| DDR | Title | Status | Resolution | Resolved In |
|-----|-------|--------|------------|-------------|
| (None yet) | | | | |

---

## Decision Log Format

When resolving a DDR, move it from Active to Resolved with:
- **Resolution:** What was decided and why
- **Resolved In:** Which version/session the decision was made

When adding a new DDR, assign the next sequential number and fill in all Active columns.
