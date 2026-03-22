# Deferred Decisions Register — Radiate

> Decisions explicitly deferred for later. Nothing is forgotten, only postponed.
> Format follows the LPMDS governance pattern established across 32 sessions.

---

## Active Decisions

| DDR | Title | Status | Context | Resolve By |
|-----|-------|--------|---------|------------|
| DDR-001 | Social backend technology | OPEN | Species gallery, leaderboard, and introduction tracking (v0.3+) require a backend. Options: Supabase, Cloudflare Workers + D1, Firebase. | Before v0.3 |
| DDR-002 | 3D rendering approach | OPEN | Long-term vision includes 3D low-poly "zoom in" view. Options: Three.js (raw), React Three Fiber, Babylon.js. | Before v0.4 |
| DDR-003 | Monetisation model | OPEN | Options: free + OSS, free browser + paid Steam ($5–10), Patreon-supported. Premature before product-market fit. | When WAU > 2K |
| DDR-004 | Mobile distribution | OPEN | PWA vs native app. PWA provides push notifications and home screen install with no app store friction. | Post-launch |
| DDR-005 | Simulation pacing | OPEN | Events per real hour. Options: high (1/5min), medium (1/15min), configurable. Requires playtesting data. | v0.2 tuning |
| DDR-006 | Species invasion UX | OPEN | How player controls biosecurity when random invasions toggled on. Options: simple toggle, quarantine preview, trait-based filters. | Before v0.4 |
| DDR-007 | Epoch prestige mechanics | OPEN | What persists between worlds. Options: tools only, tools + species museum, tools + unlocked trait archetypes. | Before v0.4 |
| DDR-008 | Co-evolution modelling | OPEN | Symbiosis types to implement first. Options: parasitism (simplest), pollination (most visual), defer entirely. Core pred-prey must be stable first. | When v0.2 sim stable |

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
