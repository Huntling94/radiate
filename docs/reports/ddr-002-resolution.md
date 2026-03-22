# DDR-002 Resolution

**Status:** RESOLVED (conditional)

**Decision:** Three.js (raw) for Phase 1-2 (terrain + creatures). Explicit migration checkpoint at Phase 2 boundary before starting Phase 3 (player character).

**Rationale:** The expanded vision (explorable world, player character, building mechanics) points toward Babylon.js as the optimal long-term engine (see `docs/reports/ddr-002-3d-engine-assessment.md`). However, the 3D world concept is unvalidated. Starting with Three.js allows validating the visual feel (terrain, creatures, camera) at lower learning investment. The rendering layers (terrain, materials, cameras, creature geometry) are a bounded rewrite (~1-2 sessions) if migration to Babylon.js is triggered. The gameplay layers (physics, character controller, building) have NOT been built yet, so no work is wasted.

**Migration checkpoint trigger (DDR-012):** Before starting Phase 3 (player character), commission a brief assessment: "Given what we've learned in Phase 1-2, do we migrate to Babylon.js or continue with Three.js + ecosystem?" Decision criteria:
- Is the player character / building vision still the direction?
- How painful is the Three.js custom character controller path vs Babylon built-in?
- Has anything changed in the engine landscape?

**Constraints on Three.js implementation (to minimise migration cost):**
1. All 3D code lives in `src/world3d/` — isolated from engine and components
2. No Three.js imports outside `src/world3d/`
3. The interface between simulation and renderer is `WorldState` — same contract Babylon would consume
4. Terrain generation logic (heightmap from biomes) is pure TypeScript functions, not Three.js-coupled
5. Creature geometry assembly logic is separated from Three.js mesh creation — genome → trait params is pure, trait params → Three.js mesh is the rendering layer

These constraints mean that a migration to Babylon.js replaces the contents of `src/world3d/` without touching anything else.

**New DDR entry:**

### DDR-012: Phase 2→3 engine migration checkpoint
**Status:** OPEN
**Context:** Three.js chosen for Phase 1-2 rendering. Babylon.js identified as optimal for Phase 3+ gameplay (physics, character controller, building). Migration checkpoint before Phase 3.
**Resolve by:** After Phase 2 completion, before Phase 3 starts.
