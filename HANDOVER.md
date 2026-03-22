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
- **Brief before code, always.** Will expects an implementation brief before any medium or large feature is built. Use `/plan` to produce this. Wait for explicit approval ("shall I proceed?" → Will says yes) before writing code.
- **Step-by-step calculations / reasoning printed in chat.** When explaining how something works (an algorithm, a design pattern, a simulation mechanic), walk through the logic concretely. Don't hand-wave.
- **No demo language.** Never say "as a demo" or "for demonstration purposes." Everything built is real, production-intent code.
- **Governance documents are first-class deliverables.** CLAUDE.md, DEFERRED_DECISIONS.md, handover notes, and consultancy reports are as important as code. Keep them current.

### Quality standards
- **TypeScript strict mode, no exceptions.** Run `npx tsc --noEmit` before declaring anything complete.
- **Tests for every engine function.** The simulation engine is the product — untested simulation code is unshipped code.
- **Clean architecture boundaries.** Engine never imports from components. Components never import from engine directly. The WorldState interface is the contract.

### What Will is learning
- This is Will's first project using Claude Code (he's learning the tool alongside building the game).
- Will is learning 3D graphics programming (Three.js) as a future skill — this is deferred to v0.4+ but is a personal learning goal.
- Will is learning game development concepts: ECS architecture, game loops, procedural generation, agent-based simulation. Explain these when they come up.
- Will has React/TypeScript/Vite familiarity from LPMDS but is not a developer. He can follow code and challenge architectural direction, but cannot review code for correctness. Claude must self-govern code quality through automated gates and testing (see Quality Framework in CLAUDE.md).

---

## Project context

### What Radiate is
An idle evolution ecosystem builder. The player shapes a world's environment and watches evolution unfold over geological timescales. The simulation runs while the player is away. Species can be shared between players' worlds.

### Why it exists
- Will has always wanted to build an evolution simulation game
- The idle format was identified as the unique market positioning (no existing game combines genuine emergent simulation with idle mechanics)
- Inspired by The Sapling's visual aesthetic (3D low-poly) but differentiated by idle gameplay, social metagame, and phylogenetic tree as first-class UI

### Target audience (in priority order)
1. **Idle/incremental game community** — r/incremental_games, itch.io. Mechanically novel idle game with emergent simulation.
2. **Science & speculative evolution fans** — r/SpeculativeEvolution, YouTube spec evo community. A toy for exploring evolutionary dynamics.
3. **Lapsed base-builder players** — Factorio/Rimworld fans who can't commit 6-hour sessions anymore. System-design satisfaction in 10-min bursts.

### The social metagame
Species can be exported as share codes and imported into other players' worlds. A public species gallery tracks robustness across worlds. Leaderboards rank species by survival rate, disruptiveness, and longevity. Random invasion events (toggleable) introduce species from the global pool.

### Tech stack
TypeScript, React 18, Vite, Tailwind CSS, Recharts, HTML Canvas 2D. Browser-first (GitHub Pages). PWA for mobile.

### Development pace
Weekend sprints. Estimated 1–2 months to v0.1. Will provides product direction; Claude writes all code.

---

## Phased roadmap

| Phase | Codename | Delivers |
|-------|----------|----------|
| v0.1 | First Life | Core simulation engine, 2D biome map, population charts, species list, 1 environmental control, offline progression, GitHub Pages deploy |
| v0.2 | Naturalist | Phylogenetic tree, species cards/bestiary, naturalist mode, event log with causal attribution, species share codes, image export |
| v0.3 | Connected | Public species gallery (backend), robustness leaderboard, push notifications (PWA), terrain sculpting, epoch progression, enhanced 2D sprites |
| v0.4 | Invasion | Random invasion events, co-evolution/symbiosis, competitive ecology, expanded biomes, edge-of-chaos regulator tuning |
| v0.5+ | Aquarium | 3D low-poly zoom-in view (Three.js), modular creature meshes, seasonal visual transitions, sound design, Steam consideration |

---

## Reference documents in this repo

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Governance framework, architecture, conventions, design principles |
| `DEFERRED_DECISIONS.md` | Decisions explicitly deferred with context and resolve-by triggers |
| `HANDOVER.md` | This document — project context and owner working preferences |
| `docs/vision.md` | Full product vision document (March 2026) |
