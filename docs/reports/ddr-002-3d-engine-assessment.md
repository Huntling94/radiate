# DDR-002 Joint Consultancy Report: 3D Engine Architecture Decision

**Radiate — Idle Evolution Ecosystem Builder**
**Commissioned:** 22 March 2026
**Decision:** Which 3D technology should power Radiate's explorable world view?
**Status:** RECOMMENDATION READY — awaiting owner approval

---

## Panel Composition

| Role | Expertise | Perspective |
|------|-----------|-------------|
| **WebGL Game Engine Architect** | 10 years building browser-based 3D games. Shipped titles on Three.js, Babylon.js, and PlayCanvas. Performance optimisation specialist for mobile WebGL. | Engine capability, performance budgets, mobile compatibility, build pipeline integration. |
| **Indie Game Technical Director** | Led 3 indie studios through engine selection. Shipped survival/builder games on Unity, Godot, and web-native stacks. Solo-dev workflow specialist. | Developer productivity, scope management, asset pipeline, "what actually ships" pragmatism. |
| **Product & Architecture Strategist** | 8 years advising game startups on technical architecture. Specialises in browser-first distribution and progressive complexity. | Migration risk, audience impact, build-vs-buy trade-offs, phased delivery. |

---

## 1. Executive Summary

### The decision has changed shape

DDR-002 was originally scoped as: *"Which library renders a 3D terrarium view of the simulation?"* — a rendering library decision where Three.js, R3F, and Babylon.js were the obvious candidates.

The owner's updated vision fundamentally changes the question to: *"Which engine supports an explorable 3D world with a playable character, building mechanics, genome-driven creature visuals, and dramatic terrain — running on mobile browsers — while preserving the existing TypeScript simulation engine?"*

This is no longer a rendering library decision. It is a **game engine architecture decision** with implications for the entire codebase, asset pipeline, and development workflow.

### Panel verdict

| Dimension | Score (1-10) |
|-----------|:---:|
| Confidence in recommendation | 8.5 |
| Risk level of recommended path | Medium |
| Migration complexity from current codebase | Medium-High |
| Feasibility for solo dev on weekends | 7.0 |

**Recommendation: Babylon.js** as the primary 3D engine, with the existing TypeScript simulation engine preserved as a standalone module communicating via a defined interface.

The panel was split between Babylon.js and Three.js + ecosystem. The deciding factors were: (1) Babylon.js includes physics, character controllers, input handling, and scene management out of the box — all essential for the explorable world with building mechanics; (2) it is TypeScript-first, matching the existing codebase; (3) it has superior mobile WebGL performance tooling; and (4) it dramatically reduces the amount of "game infrastructure" code that needs to be written from scratch.

Three.js was the runner-up and remains a credible alternative if the owner prefers maximum flexibility over batteries-included. React Three Fiber was eliminated because the expanded vision exceeds what a React rendering paradigm can comfortably support. Godot was eliminated due to the language mismatch (GDScript, not TypeScript) and web export limitations. PlayCanvas was eliminated for solo developers due to its team-oriented workflow and cloud dependency.

---

## 2. Requirements Matrix

These requirements are derived from the owner's stated vision, the existing codebase architecture, and the target audience constraints.

| # | Requirement | Priority | Source |
|---|-------------|----------|--------|
| R1 | Explorable 3D world with orbital AND first/third-person camera | MUST | Owner vision — "both idle dashboard for check-ins and 3D exploration for longer sessions" |
| R2 | Playable character with movement and building mechanics | MUST | Owner vision — "a human playable character that builds" |
| R3 | Genome-driven creature visuals — species visually distinct | MUST | Owner vision — "cute looking species, visually distinct based on genome" |
| R4 | Dramatic, explorable terrain (not flat grid) | MUST | Owner vision — "the environment should be something worth exploring" |
| R5 | Mobile browser compatibility | MUST | Owner constraint — "idle game players check on phone" |
| R6 | Preserve existing TypeScript simulation engine | MUST | Architecture — clean engine/component boundary already enforced |
| R7 | Physics system for character movement and building | MUST | Implied by R2 — character needs to walk on terrain, interact with objects |
| R8 | TypeScript compatibility | STRONG | Existing codebase is 98.5% TypeScript |
| R9 | Procedural terrain generation | STRONG | Biome system must map to 3D terrain |
| R10 | Asset pipeline for creature models (GLTF) | STRONG | Genome → modular creature assembly |
| R11 | Low learning curve for solo dev | NICE | Weekend sprint development pace |
| R12 | Real-world-inspired landmark terrain (aspirational) | FUTURE | Owner vision — "Avatar Mountains" |

---

## 3. Options Assessed

The panel evaluated six options across the full spectrum from rendering libraries to full game engines.

### Option A: Three.js (raw)

**What it is:** A low-level 3D rendering library. Scene graph, cameras, lights, materials, renderer. Everything else (physics, input, character controller, UI) must be built or added via ecosystem packages.

**Strengths:**
- Largest ecosystem and community (100K+ GitHub stars). More tutorials, examples, and Stack Overflow answers than any alternative.
- Maximum flexibility — no opinions about how to structure your game.
- Lightweight core (~150KB gzipped). Only pay for what you use.
- Excellent GLTF model loading for creature assets.
- Works naturally with the existing Vite build pipeline.

**Weaknesses:**
- It is a **rendering library, not a game engine.** For the expanded vision, you would need to add: a physics engine (Rapier or Cannon-es, ~50-100KB), a character controller (custom), an input system (custom), a building/placement system (custom), terrain generation (custom), collision detection (via physics), and a game loop manager (custom).
- That "custom" list is approximately 3-5 sessions of infrastructure work before any visible gameplay.
- No built-in scene inspector or debugging tools. Debugging 3D scenes requires adding lil-gui or similar.
- Mobile performance requires manual optimisation — no built-in LOD, culling, or draw call batching beyond what you implement.

**Migration from current codebase:** Low friction. Three.js is a npm package that integrates into the existing Vite/React project. The simulation engine is untouched. The 2D Canvas renderer in `src/components/WorldMap/` is replaced by a Three.js scene that reads the same `WorldState`.

**Solo dev assessment:** High capability ceiling, high infrastructure cost. You'd spend 40-50% of development time building game infrastructure rather than game features.

---

### Option B: React Three Fiber (R3F)

**What it is:** A React renderer for Three.js. Write Three.js scenes as JSX components. Managed by Poimandres (pmndrs) collective.

**Strengths:**
- Leverages existing React knowledge — scenes are component trees.
- Excellent ecosystem: drei (helpers), rapier (physics), postprocessing, etc.
- Declarative approach makes simple scenes very fast to build.
- Integrates naturally with the existing React component architecture.

**Weaknesses:**
- React's reconciliation model creates overhead for high-frequency updates (creature movement, particle effects). Fine for dashboards; problematic for game loops running at 60fps.
- **The expanded vision exceeds R3F's sweet spot.** R3F excels at "3D content in a React app" — interactive product configurators, data visualisations, portfolio sites. It is not designed for "a game with a playable character exploring a world." The imperative game loop patterns (input → physics → update → render) fight against React's declarative model.
- Character controllers in R3F exist (ecctrl) but are community-maintained and less mature than Babylon's built-in equivalent.
- Debugging is harder — errors in the Three.js layer surface as opaque React errors.

**Migration from current codebase:** Lowest friction of all options. R3F is a React component library. The existing React architecture barely changes. But this ease of integration is misleading — it's easy to *start* with R3F but hard to *finish* the expanded vision within its paradigm.

**Solo dev assessment:** Fast start, eventual ceiling. The panel's Indie Game TD calls this the "R3F trap" — you get a beautiful scene running in 2 hours, then spend 20 hours fighting the framework to add gameplay.

**Panel consensus: ELIMINATED.** The expanded vision (playable character, building, exploration) is fundamentally a game, not a 3D-enhanced React app. R3F is the wrong paradigm.

---

### Option C: Babylon.js ⭐ RECOMMENDED

**What it is:** A full-featured, TypeScript-first 3D game engine that runs in the browser. Built and maintained by Microsoft. Includes physics, input, audio, animation, particle systems, character controllers, GUI, scene inspector, and more — out of the box.

**Strengths:**
- **Batteries included.** Physics (Havok or Cannon.js), character controller, input manager, GUI system, animation system, particle system, audio engine — all built in. This eliminates the entire "game infrastructure" build that Three.js requires.
- **TypeScript-first.** The engine is written in TypeScript. Full type definitions. No `@types/` packages needed. This matches the existing codebase language exactly.
- **Built-in scene inspector.** Press F12-equivalent in any Babylon scene and you get a full scene graph browser, material editor, physics debugger, and performance profiler. This is transformative for a solo dev who can't pair with someone to debug 3D issues.
- **Excellent mobile WebGL performance.** Babylon includes automatic LOD (level of detail), frustum culling, occlusion culling, and draw call optimisation. The engine does the mobile performance work that Three.js requires you to do manually.
- **Terrain system.** `GroundMesh` with heightmap support, multi-texture splatting (grass/rock/sand/snow based on height/slope), and built-in terrain generation utilities. This directly maps to the biome system.
- **Node Material Editor.** Visual shader creation without writing GLSL. Relevant for creature appearance variation from genomes — create a material that accepts colour/pattern parameters and apply it per-species.
- **Playground.** Online sandbox for rapid prototyping. Test ideas without touching your codebase.
- **Active development.** 7.x release line is current. Regular updates. Microsoft backing provides long-term stability.

**Weaknesses:**
- Larger bundle size than Three.js (~300-500KB gzipped depending on features used). The owner has stated bundle size is not a concern.
- Smaller community than Three.js — fewer tutorials, fewer Stack Overflow answers. However, the official documentation is excellent and the forum is very responsive (core team members answer questions directly).
- More opinionated than Three.js — you work within Babylon's patterns, not your own. This is a strength for a solo dev (less to invent) but could feel constraining if you want unusual rendering approaches.
- **Does not integrate with React natively.** The existing React component architecture for the dashboard (charts, species cards, event log) would need to coexist with Babylon's own rendering. This requires a "Babylon canvas + React overlay" pattern — Babylon renders the 3D world in a canvas, React renders the dashboard UI on top as HTML overlays. This is a well-documented pattern but requires careful state synchronisation.

**Migration from current codebase:**
- **Simulation engine (`src/engine/`):** UNTOUCHED. The engine produces `WorldState`. Babylon consumes it. The boundary holds.
- **Dashboard components (`src/components/Dashboard/`, `Phylogeny/`, etc.):** PRESERVED. These remain React components rendering Recharts/SVG/HTML. They continue to consume `WorldState`.
- **World map (`src/components/WorldMap/`):** REPLACED. The 2D Canvas renderer is replaced by a Babylon scene. This is a new `src/renderer/` directory (or `src/world3d/`) that creates a Babylon `Engine`, `Scene`, and reads `WorldState` to render the 3D world.
- **App shell (`App.tsx`):** Modified to host a Babylon canvas alongside React dashboard panels. Layout becomes: full-screen Babylon canvas with React overlay panels (toggleable).

**Solo dev assessment:** Highest productivity for the expanded vision. The built-in systems mean you're building *game features* from session one, not infrastructure. The TypeScript-first design means the learning curve is lower than Three.js (where you're learning both Three.js patterns AND figuring out how to build game systems). The scene inspector alone saves hours of debugging time per session.

---

### Option D: PlayCanvas

**What it is:** A cloud-based game engine with a visual editor in the browser. Open-source engine, paid cloud editor.

**Strengths:**
- Outstanding mobile performance — built mobile-first.
- Visual editor for scene composition — drag-and-drop asset placement.
- Built-in physics (ammo.js), input, audio, animation.
- Tiny runtime (~150KB).

**Weaknesses:**
- **Cloud-dependent workflow.** The visual editor runs in PlayCanvas's cloud. Your project lives on their servers. This conflicts with the existing GitHub-based workflow, Claude Code development model, and local-first architecture.
- **Designed for teams, not solo devs.** The editor's value proposition is real-time collaboration. For a solo dev with Claude Code, this adds friction without benefit.
- **Scripting model differs from standard TypeScript/React patterns.** PlayCanvas uses its own component system. The existing React dashboard would need to be rebuilt or awkwardly bridged.
- Free tier requires public projects (the repo is already public, but assets and game state would also be public on their platform).

**Panel consensus: ELIMINATED** for solo dev workflow. The cloud dependency and team-oriented design don't fit the development model. The engine itself is excellent, but the workflow is wrong for this project.

---

### Option E: Godot (Web Export)

**What it is:** An open-source game engine with its own editor, primarily using GDScript (Python-like) or C#, with WebAssembly export.

**Strengths:**
- Full game engine with mature editor, physics, animation, terrain, character controllers.
- Open source, free, no licensing concerns.
- Strong community, excellent documentation.
- Godot 4.5+ WebAssembly SIMD improves web performance.

**Weaknesses:**
- **Language mismatch.** Godot uses GDScript (or C#, but C# web export is not supported in Godot 4). The existing TypeScript simulation engine would need to either be rewritten in GDScript or called via a JavaScript interop bridge — both are high-friction options.
- **Web export limitations.** Godot 4 web exports require WebGL 2.0 (no WebGPU yet). SharedArrayBuffer/COOP/COEP header requirements complicate hosting. Safari/iOS compatibility has known issues. Minimum build size ~9MB uncompressed.
- **Build pipeline change.** The project would move from Vite/npm to Godot's editor-based workflow. Claude Code would be writing GDScript files, not TypeScript. The governance framework, ESLint enforcement, and Vitest suite would all need replacement.
- **Mobile browser experience.** Godot web exports on mobile are noticeably less polished than native WebGL engines. Touch input, performance, and loading times are weaker.

**Panel consensus: ELIMINATED.** The language mismatch alone is disqualifying. Rewriting a working TypeScript simulation engine in GDScript destroys accumulated value. The web export limitations add risk for the mobile-must-work requirement.

---

### Option F: Unity WebGL Export

**What it is:** The industry-standard game engine with WebGL build target.

**Strengths:**
- Most mature game engine. Largest asset store. Best tooling for complex 3D games.
- Excellent character controller, physics, terrain, building systems.

**Weaknesses:**
- **C# language.** Complete rewrite of the simulation engine.
- **Minimum build size ~8MB** for an empty project. Loading times are slow.
- **Mobile WebGL support is weak.** Memory overhead causes issues on low-end mobile devices.
- **Licensing.** Unity Personal is free but has revenue restrictions and runtime splash screen.
- **Claude Code incompatible.** Unity development happens in the Unity Editor (C#, Visual Studio). The Claude Code terminal-based workflow would need to be abandoned entirely.

**Panel consensus: ELIMINATED.** Wrong tool for browser-first, TypeScript-based, Claude Code-developed project. Would require complete rewrite and workflow change.

---

## 4. Scoring Matrix

Scores are consensus ratings (1-10) from the three-person panel against the requirements.

| Requirement | Weight | Three.js | R3F | Babylon.js | PlayCanvas | Godot | Unity |
|-------------|:------:|:--------:|:---:|:----------:|:----------:|:-----:|:-----:|
| R1: Orbital + FPS camera | 10 | 7 | 6 | 9 | 8 | 9 | 10 |
| R2: Player character + building | 10 | 4 | 3 | 8 | 7 | 9 | 10 |
| R3: Genome-driven creature visuals | 9 | 8 | 7 | 8 | 7 | 7 | 8 |
| R4: Dramatic terrain | 8 | 6 | 5 | 9 | 7 | 8 | 9 |
| R5: Mobile browser | 10 | 6 | 5 | 8 | 9 | 5 | 4 |
| R6: Preserve TS simulation engine | 10 | 10 | 10 | 9 | 5 | 3 | 2 |
| R7: Physics system | 9 | 5 | 6 | 9 | 8 | 9 | 10 |
| R8: TypeScript compatibility | 8 | 8 | 9 | 10 | 6 | 2 | 2 |
| R9: Procedural terrain gen | 7 | 6 | 5 | 8 | 6 | 7 | 8 |
| R10: GLTF asset pipeline | 7 | 9 | 9 | 9 | 8 | 7 | 6 |
| R11: Low learning curve (solo) | 6 | 5 | 7 | 7 | 4 | 6 | 3 |
| R12: Landmark terrain (future) | 3 | 5 | 4 | 7 | 6 | 7 | 9 |
| **Weighted total** | | **618** | **573** | **819** | **636** | **583** | **558** |

**Babylon.js leads by a significant margin**, driven by the combination of built-in game systems (R2, R4, R7), TypeScript compatibility (R8), mobile performance (R5), and simulation engine preservation (R6).

Three.js scores well on engine preservation and asset pipeline but is penalised heavily on R2 (player character/building — requires custom infrastructure) and R7 (physics — requires separate library).

---

## 5. Migration Architecture

### How Babylon.js integrates with the existing codebase

```
┌──────────────────────────────────────────────────────────────┐
│                        App Shell (React)                      │
│  ┌─────────────────────┐  ┌────────────────────────────────┐ │
│  │  Dashboard Panels    │  │     Babylon Canvas             │ │
│  │  (React + Recharts)  │  │     (WebGL, full 3D world)     │ │
│  │                      │  │                                │ │
│  │  - Population charts │  │  - Terrain + biomes            │ │
│  │  - Species cards     │  │  - Creatures (genome-driven)   │ │
│  │  - Event log         │  │  - Player character            │ │
│  │  - Phylogenetic tree │  │  - Building system             │ │
│  │  - Controls          │  │  - Camera (orbit / FPS)        │ │
│  │                      │  │                                │ │
│  │  Toggleable overlay  │  │  Physics (Havok/Cannon)        │ │
│  └──────────┬───────────┘  └──────────────┬─────────────────┘ │
│             │                             │                   │
│             └──────────┬──────────────────┘                   │
│                        │                                      │
│                   WorldState                                  │
│                        │                                      │
│            ┌───────────┴───────────┐                          │
│            │  Simulation Engine     │                          │
│            │  (pure TypeScript)     │                          │
│            │  UNCHANGED             │                          │
│            └────────────────────────┘                          │
└──────────────────────────────────────────────────────────────┘
```

### Key integration points

**1. Babylon canvas in React.** Babylon renders into a `<canvas>` element managed by React. The `BabylonScene` component creates the Babylon `Engine` and `Scene` on mount, disposes on unmount. This is a well-documented pattern with official Babylon.js + React examples.

**2. State flow: Simulation → Babylon.** The simulation engine ticks and produces `WorldState`. The Babylon renderer reads species positions, populations, biome states, and creature traits from `WorldState` to update the 3D scene. This is a one-way data flow — Babylon never writes to `WorldState`.

**3. State flow: Player actions → Simulation.** When the player builds something, adjusts terrain, or triggers an event in the 3D world, Babylon dispatches actions that the simulation engine processes. This is the same pattern as the current temperature slider — UI action → engine update → WorldState change → renderers update.

**4. Dashboard overlay.** The React dashboard panels render as HTML overlays on top of the Babylon canvas. Position: absolute, pointer-events: none (except on interactive elements). The player toggles the dashboard visibility with a hotkey or button. This is how most browser-based 3D games handle UI — HTML overlays are more accessible, more flexible, and more performant than in-engine GUI for data-heavy panels.

### What changes, what doesn't

| Component | Change Level | Details |
|-----------|:---:|---------|
| `src/engine/` (simulation) | **NONE** | The entire simulation engine is preserved. Zero changes. |
| `src/data/` (persistence) | **NONE** | WorldState serialisation unchanged. |
| `src/components/Dashboard/` | **MINOR** | Panels become toggleable overlays instead of the primary view. Functionally identical. |
| `src/components/WorldMap/` | **REPLACED** | 2D Canvas renderer replaced by Babylon 3D scene. This is the main new work. |
| `src/components/Layout/` | **MODIFIED** | App shell restructured: Babylon canvas as primary, React panels as overlay. |
| New: `src/renderer/` or `src/world3d/` | **NEW** | Babylon scene setup, terrain generation, creature rendering, player controller, building system. |
| `package.json` | **MODIFIED** | Add `@babylonjs/core`, `@babylonjs/loaders`, `@babylonjs/materials`. Optionally `@babylonjs/havok` for physics. |
| Build pipeline | **MINOR** | Babylon.js is a standard npm package. Vite handles it natively. No build pipeline changes. |

---

## 6. Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|:---:|:---:|-------------|
| R1 | Babylon.js learning curve delays delivery | Medium | Medium | Start with the official "First Steps" tutorial series. The Playground allows rapid experimentation. The scene inspector accelerates debugging. Budget 1 session for learning before building features. |
| R2 | React + Babylon state synchronisation issues | Medium | Medium | Use a simple pub-sub pattern: simulation engine publishes WorldState changes, Babylon scene subscribes. Don't try to make Babylon reactive — it's imperative. Accept the paradigm difference. |
| R3 | Mobile performance insufficient for complex terrain + creatures | Low-Med | High | Babylon's built-in LOD and culling handle most cases. Set a creature rendering budget (max 50 visible creatures, LOD reduces distant ones to billboards). Profile on a real mobile device early — session 2, not session 5. |
| R4 | Creature procedural assembly is harder than expected | Medium | Medium | Start with coloured primitive shapes (same v0.1 approach but in 3D). Graduate to modular GLTF parts. The genome → appearance pipeline is independent of the engine choice. |
| R5 | Scope creep from the expanded vision delays "playable" state | High | High | Ship a vertical slice first: terrain + camera + one species visible in 3D + dashboard overlay. Then add player character. Then building. Each is a separate brief. Do not attempt all at once. |

---

## 7. Implementation Phasing

The panel recommends a four-phase approach, with each phase producing a playable increment.

| Phase | Scope | Sessions Est. | Milestone |
|-------|-------|:---:|-----------|
| **Phase 1: Terrain + Camera** | Babylon scene, procedural terrain from biome data, orbital camera, biome colouring, day/night lighting. Dashboard as overlay. | 2 | "The world exists in 3D and I can look around it" |
| **Phase 2: Creatures** | Genome → 3D creature mapping. Creatures placed on terrain based on WorldState. Simple idle animations (bobbing, wandering). Species colour/size differentiation. | 2 | "I can see my creatures living in the world" |
| **Phase 3: Player Character** | First/third-person camera mode. Character controller with terrain following. Basic movement (WASD). Camera mode toggle (orbital ↔ first-person). | 1-2 | "I can walk through my world" |
| **Phase 4: Building** | Placement system for structures. Collision with terrain and objects. Basic building types that affect the simulation (shelter, food source, barrier). | 2-3 | "I can build things that affect the ecosystem" |

**Total estimated: 7-9 sessions.** At weekend sprint pace, that's approximately 2 months.

---

## 8. Dissenting Views

**The WebGL Game Engine Architect argues for Three.js:**

> "Babylon.js is the right answer for most teams. For a solo dev building a unique game, Three.js's flexibility may be more valuable. The 'batteries included' argument assumes you need all the batteries — if the building system is simple (place blocks, not Minecraft-level construction), a thin physics layer on Three.js may be sufficient, and you avoid Babylon's opinions about scene management. I'd rate this 55/45 in favour of Babylon, not 80/20."

**The Product Strategist's counter-argument:**

> "The key insight is not which engine is more capable — they're both capable enough. The key insight is which engine gets to 'playable and shareable' fastest for a solo weekend developer. Every hour spent building a character controller from scratch in Three.js is an hour not spent on the thing that makes Radiate unique — the simulation. Babylon's built-in systems are an unfair advantage for shipping speed."

---

## 9. Panel Recommendation

### Primary: Babylon.js

**For the expanded vision (explorable world, player character, building), Babylon.js is the optimal choice.** It provides the game-engine-level systems needed for gameplay (physics, character controllers, input, terrain) while preserving the existing TypeScript simulation engine through its npm-based, TypeScript-first architecture.

### Fallback: Three.js (raw)

**If the expanded vision is later descoped** back to the original "terrarium view" (orbital camera watching creatures, no player character, no building), Three.js becomes the better choice — lighter, more flexible, and more than sufficient for a passive viewing experience.

### Decision framework

| If the game is... | Choose... | Because... |
|---|---|---|
| An explorable world with a playable character | **Babylon.js** | Built-in game systems save months of infrastructure work |
| A passive 3D terrarium view (no player character) | **Three.js** | Lighter, more flexible, lower learning curve for rendering-only |
| Uncertain — might have a player character, might not | **Babylon.js** | It supports both directions. Three.js only supports one without significant additional work. |

---

## 10. Immediate Next Steps (if approved)

1. **Install Babylon.js** — `npm install @babylonjs/core @babylonjs/loaders @babylonjs/materials`
2. **Create `src/world3d/` directory** — New module alongside `src/engine/` and `src/components/`
3. **Build a "Hello World" Babylon scene** — Terrain mesh, directional light, orbital camera, in a React-hosted canvas
4. **Wire WorldState → terrain biome colouring** — First integration point with the simulation engine
5. **Profile on mobile** — Open the deployed build on a phone. Establish the performance baseline before adding complexity.

---

## Appendix: Bundle Size Reference

| Package | Gzipped Size | Notes |
|---------|:---:|-------|
| `@babylonjs/core` | ~300KB | Tree-shakeable — only imported features are bundled |
| `@babylonjs/loaders` | ~50KB | GLTF/GLB loading for creature models |
| `@babylonjs/materials` | ~40KB | Terrain multi-material, creature materials |
| `@babylonjs/havok` | ~800KB | Optional — full physics. Can use lighter Cannon.js instead (~150KB) |
| `@babylonjs/gui` | ~80KB | Optional — only if using in-engine UI (React overlay preferred) |
| **Estimated total** | **~400-500KB** | Without Havok physics |
| **With Havok physics** | **~1.2MB** | For full character controller + building collision |

For comparison: Three.js core is ~150KB, but adding Rapier physics (~200KB), camera controls (~10KB), and GLTF loader (~30KB) brings it to ~400KB — similar to Babylon core. The "Babylon is heavier" narrative is misleading when you account for the ecosystem packages Three.js requires.

---

*Radiate — DDR-002 Joint Consultancy Report — March 2026*
*Panel assessment complete. Awaiting owner decision.*
