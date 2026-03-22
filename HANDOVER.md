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
- Will is learning 3D graphics programming (Three.js) as a future skill — this is deferred to v0.4+ but is a personal learning goal.
- Will is learning game development concepts: ECS architecture, game loops, procedural generation, agent-based simulation. Explain these when they come up.
- Will has React/TypeScript/Vite familiarity from LPMDS but is not a developer. He can follow code and challenge architectural direction, but cannot review code for correctness. Claude must self-govern code quality through automated gates and testing (see Quality Framework in CLAUDE.md).

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
| 9 - Species cards/bestiary | Not started | Detailed species view with traits, lineage, history |
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
TypeScript, React 19, Vite 8, Tailwind CSS v4, Recharts, HTML Canvas 2D. Browser-first (GitHub Pages). PWA for mobile (future).

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
