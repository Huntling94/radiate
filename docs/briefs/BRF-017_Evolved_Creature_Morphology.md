# BRF-017: Evolved Creature Morphology

**Phase:** v0.3 "Living World" — Visual evolution readability
**Depends on:** BRF-016 (IBM Engine Core — individual creatures with genomes)
**SME panel:** Evolutionary morphologist (speculative biology), procedural creature designer (Spore/NMS veteran), comparative anatomist (biomechanics). Full consultancy report in chat history, Session 4.

---

## 1. Objective

Make evolution **visible**. The IBM engine (BRF-016) gives every creature an individual genome with 6 traits, but the 3D renderer previously mapped only 3 of those traits to visual features (size→scale, speed→Z-stretch, tolerances→colour hue). A player could not look at a creature and understand what it had evolved for.

BRF-017 expands the trait-to-morphology mapping so that every genome trait produces visible body features. A cold-adapted herbivore looks insulated with a mane ruff. A fast predator looks sleek with a dorsal crest and tail. A desert producer looks like a cactus. Species within the same trophic level are visually distinct based on their evolutionary specialisation.

### Why now

The IBM engine creates genuine within-species variation and emergent speciation. Without visible morphological differences, the player cannot observe the most compelling outcome of the simulation: creatures adapting to their environment over generations. This is the visual payoff of the IBM investment.

### What BRF-017 Delivers

- **Allometric head scaling** — small creatures get proportionally larger heads (paedomorphic); large creatures get proportionally smaller heads. Based on real allometric scaling laws.
- **Speed-driven body compression** — fast creatures are narrow and elongated; slow creatures are round and compact. X-axis compression added alongside existing Z-stretch.
- **Trophic posture offsets** — predators lean forward aggressively; herbivores lean back defensively. Communicates ecological role at a glance.
- **Role-based eye placement** — herbivore eyes wider apart (prey: panoramic vision); predator eyes closer together and more forward (depth perception for targeting). The single most reliable visual cue in real ecology.
- **Leg nubs** — mobile creatures with speed > 0.8 grow 4 small leg cylinders under the body. Length scales with speed trait. Creates the "this creature walks" visual cue.
- **Cold-tolerance mane** — creatures with coldTolerance > 0.6 grow a torus ring around the neck. Thickness increases with tolerance. Visual: insulation.
- **Heat-tolerance ear plates** — creatures with heatTolerance > 0.6 grow two flattened spheres on either side of the head. Size increases with tolerance. Visual: radiator surfaces (cf. fennec fox ears).
- **Predator dorsal crest** — predators with speed > 1.2 grow a flattened sphere on top of the body. Visual: fast pursuit predator.
- **Predator tail** — predators with speed > 1.5 grow a thin cylinder behind the body. Visual: apex pursuit predator.
- **Herbivore horns** — herbivores with size > 1.0 grow two small cones on the head. Visual: large defensive herbivore.
- **Producer shape variants** — producers now have 5 distinct body plans driven by trait combinations:
  - **Mushroom** (default): short stalk + round cap
  - **Cactus** (heatTolerance > 0.7): thick stalk, tiny cap
  - **Conifer** (coldTolerance > 0.7): cone-shaped cap on stalk
  - **Bush** (size < 0.5): wide flat cap, very short stalk
  - **Tree** (size > 1.2): narrow cap, tall stalk
- **Breathing animation** — all creatures exhibit subtle Y-axis sinusoidal oscillation. Breath rate scales with metabolism (proxy for metabolic rate).
- **Per-individual variation** — creatures of the same species look 90% the same but with ±5% scale jitter and ±3° hue jitter derived from their individual ID hash. Groups look like a species, not clones.
- **Metabolism-driven eye expression** — high metabolism (>1.2): large alert pupils. Low metabolism (<0.5): small droopy pupils shifted downward. Cheapest way to convey personality.
- **Herbivore idle "look around"** — periodic slow Y-rotation during idle state. Prey animals scan their environment.

### What BRF-017 Does NOT Deliver

- New genome traits — all morphology derived from existing 6 traits (size, speed, coldTolerance, heatTolerance, metabolism, reproductionRate)
- Aquatic body plans — requires a new `aquaticAffinity` trait (contract change, deferred to dedicated session with ADR + BRF)
- Burrowing/flying body plans — each requires a new trait + movement system (deferred to v0.4+)
- Terrain texturing — independent workstream, deferred to next session
- Engine or WorldState changes — this is purely a rendering concern
- New tests — all changes are visual; no engine contract changes

---

## 2. Architecture Decisions

### Decision 1: Trait-to-morphology via continuous functions, not discrete archetypes

The SME panel debated discrete body plan archetypes (e.g. "runner" vs "tank" vs "swimmer") versus continuous morphospace. The procedural creature designer (Marcus Chen, Spore/NMS veteran) was emphatic: **do not implement discrete states.** Implement continuous functions where archetypes are attractors in the morphospace.

Every visual feature is driven by a smooth function of one or more trait values. Thresholds (e.g. "legs appear when speed > 0.8") create visual differentiation without hard category boundaries. A creature at speed=0.79 looks subtly different from one at speed=0.81, but the leg appearance at 0.8 creates a memorable "moment" in the evolutionary trajectory.

### Decision 2: Allometric scaling (Huxley's law)

In real biology, body proportions change with size (allometry). Small animals have relatively larger heads and eyes; large animals have relatively smaller heads and thicker limbs. This is one of the most reliable visual signals in biology and immediately makes size variation feel "natural" rather than "uniformly scaled."

Formula: `headRatio = max(0.5, min(0.65, 0.7 - size * 0.1))`

| Size trait | Head ratio | Visual |
|-----------|-----------|--------|
| 0.1 | 0.65 | Big cute head (paedomorphic) |
| 0.5 | 0.65 | Still big-headed |
| 1.0 | 0.60 | Medium proportion |
| 1.5 | 0.55 | Smaller relative head |
| 2.0 | 0.50 | Small head, massive body |

### Decision 3: Speed drives body aspect ratio, not just Z-stretch

The previous implementation only stretched the body along Z for fast creatures. This missed half the story: fast creatures are also *narrow* (low drag cross-section). The new system compresses X while stretching Z, creating a much more visible silhouette difference.

```typescript
function computeBodyAspect(speed: number): { xScale: number; zScale: number } {
  return {
    xScale: Math.max(0.6, 1.0 - speed * 0.1),  // narrow at high speed
    zScale: 0.8 + speed * 0.2,                   // long at high speed
  };
}
```

| Speed | X-scale | Z-scale | Visual |
|-------|---------|---------|--------|
| 0.1 | 0.99 | 0.82 | Nearly spherical |
| 0.5 | 0.95 | 0.90 | Slightly elongated |
| 1.0 | 0.90 | 1.00 | Moderate torpedo |
| 1.5 | 0.85 | 1.10 | Clearly streamlined |
| 2.0 | 0.80 | 1.20 | Very sleek torpedo |

### Decision 4: Eye placement communicates ecological role

The comparative anatomist (Dr. Osei) identified eye placement as the single most reliable visual cue for ecological role in real biology. Prey animals have wide-set lateral eyes for panoramic vision; predators have close-set forward eyes for depth perception.

| Trophic level | Eye spacing (× scale) | Visual cue |
|---------------|----------------------|------------|
| Herbivore | 0.15 (wide) | "I need to see predators coming from any direction" |
| Predator | 0.08 (narrow) | "I need to judge distance to my prey" |
| Producer | 0.16 (wide, default) | Sessile, no locomotion-based constraint |

### Decision 5: Appendages as trait-threshold features

Rather than gradually growing appendages (which would produce many awkward intermediate states), appendages appear at specific trait thresholds. This creates memorable evolutionary "moments" — the player sees a new species with legs for the first time, or spots the first maned cold-adapted herbivore.

| Appendage | Trait condition | Primitives | Target creature |
|-----------|----------------|------------|-----------------|
| 4 leg nubs | speed > 0.8 | 4 cylinders | Any mobile creature |
| Mane ruff | coldTolerance > 0.6 | 1 torus | Any mobile creature |
| Ear plates | heatTolerance > 0.6 | 2 flattened spheres | Any mobile creature |
| Dorsal crest | speed > 1.2 (predator only) | 1 flattened sphere | Fast predator |
| Tail | speed > 1.5 (predator only) | 1 cylinder | Very fast predator |
| Horn nubs | size > 1.0 (herbivore only) | 2 cones | Large herbivore |

### Decision 6: Per-individual variation via deterministic hash

The procedural creature designer emphasised: "If you cannot tell two individuals of the same species apart, they feel like clones." Per-individual variation is generated deterministically from `hashString(speciesId + individualIndex)`, producing:
- **Scale jitter:** ±5% body scale
- **Hue jitter:** ±3° colour hue
- **Unique material names:** prevent Babylon.js material sharing between individuals

This is deterministic (same ID → same jitter), so the variation is stable across frames and re-renders.

### Decision 7: Producer shape variants from trait combinations

Producers (sessile creatures) gain the most visual variety from BRF-017 because the previous system had only one shape (mushroom). The new system selects from 5 shapes based on trait thresholds, evaluated in priority order:

| Priority | Condition | Shape | Visual reference |
|----------|-----------|-------|------------------|
| 1 | heatTolerance > 0.7 | Cactus | Thick stalk, tiny cap |
| 2 | coldTolerance > 0.7 | Conifer | Cone cap on thin stalk |
| 3 | size < 0.5 | Bush | Wide flat cap, short |
| 4 | size > 1.2 | Tree | Narrow cap, tall stalk |
| 5 | (default) | Mushroom | Current shape |

### Decision 8: No engine or WorldState changes

All morphology changes are in the rendering layer (`src/world3d/creatures.ts`). The engine, persistence, components, and types are untouched. This means:
- No save migration needed
- No test changes needed
- No architecture boundary violations
- The change is fully reversible by reverting one file

---

## 3. Detailed Design

### 3.1 Refactored `buildCreatureMesh()` structure

The monolithic `buildCreatureMesh()` function has been refactored into a dispatcher that delegates to trophic-specific builders:

```typescript
function buildCreatureMesh(species, scene, shadowGenerator, individualIndex = 0): TransformNode {
  // Per-individual variation (Phase C)
  const jitter = hashString(species.id + String(individualIndex));
  const scaleJitter = 1.0 + ((jitter % 100) / 100 - 0.5) * 0.1;  // ±5%
  const hueJitter = ((jitter % 60) - 30) / 10;                      // ±3°

  const colour = computeColour(species, hueJitter);
  const scale = computeScale(species) * scaleJitter;
  const traits = expressTraits(species.genome);

  // Create MeshCtx with shared materials and helpers
  const ctx = { root, scene, shadowGenerator, speciesId, bodyMat, eyeWhiteMat, pupilMat };

  // Dispatch to trophic builder
  if (trophicLevel === 'producer') buildProducerMesh(ctx, traits, scale);
  else if (trophicLevel === 'herbivore') buildHerbivoreMesh(ctx, traits, scale);
  else buildPredatorMesh(ctx, traits, scale);
}
```

### 3.2 MeshCtx — shared builder context

A new `MeshCtx` interface replaces the closure-captured variables from the old builder. All mesh helper functions (`makeSphere`, `makeCylinder`, `makeTorus`) accept a `MeshCtx` parameter. This eliminates the need for nested closures and makes the helpers reusable across trophic builders and appendage functions.

```typescript
interface MeshCtx {
  root: TransformNode;
  scene: Scene;
  shadowGenerator: ShadowGenerator;
  speciesId: string;
  bodyMat: ShaderMaterial;
  eyeWhiteMat: ShaderMaterial;
  pupilMat: ShaderMaterial;
}
```

### 3.3 New appearance computation functions

```typescript
// Allometric head scaling (Decision 2)
function computeHeadRatio(size: number): number {
  return Math.max(0.5, Math.min(0.65, 0.7 - size * 0.1));
}

// Speed-driven body aspect ratio (Decision 3)
function computeBodyAspect(speed: number): { xScale: number; zScale: number } {
  return {
    xScale: Math.max(0.6, 1.0 - speed * 0.1),
    zScale: 0.8 + speed * 0.2,
  };
}

// Metabolism-driven pupil expression (Phase C)
function computePupilScale(metabolism: number, baseSize: number): { size: number; yOffset: number } {
  if (metabolism > 1.2) return { size: baseSize * (1.0 + (metabolism - 1.2) * 0.4), yOffset: 0 };
  if (metabolism < 0.5) return { size: baseSize * 0.7, yOffset: -0.02 };
  return { size: baseSize, yOffset: 0 };
}
```

### 3.4 Herbivore builder — annotated

```typescript
function buildHerbivoreMesh(ctx: MeshCtx, traits: Traits, s: number): void {
  const aspect = computeBodyAspect(traits.speed);     // Decision 3
  const headRatio = computeHeadRatio(traits.size);     // Decision 2
  const postureZ = -0.03 * s;                          // Decision 4: lean back

  // Body — chubby, compressed on X by speed
  makeSphere(ctx, 'body', 0.8 * s, ctx.bodyMat,
    new Vector3(0, 0.4 * s, postureZ),
    new Vector3(aspect.xScale * 0.9, 0.85, aspect.zScale));

  // Head — allometric diameter, positioned above body
  const headDiam = 0.8 * s * headRatio;
  const headY = 0.75 * s;
  const headZ = 0.25 * s * aspect.zScale + postureZ;
  makeSphere(ctx, 'head', headDiam, ctx.bodyMat, new Vector3(0, headY, headZ));

  // Eyes — wide apart (Decision 4: prey vision)
  const eyeSpacing = 0.15 * s;
  // ... eye construction with computePupilScale for metabolism expression

  // Conditional appendages (Decision 5)
  if (traits.speed > 0.8) addLegs(ctx, s, traits.speed, bodyY, postureZ);
  if (traits.coldTolerance > 0.6) addMane(ctx, s, traits.coldTolerance, headY - 0.1 * s);
  if (traits.heatTolerance > 0.6) addEarPlates(ctx, s, traits.heatTolerance, headY, headZ);
  if (traits.size > 1.0) addHorns(ctx, s, headY, headZ);
}
```

### 3.5 Animation changes in `updateCreature()`

After existing position/rotation update:

```typescript
// Breathing — all creatures (BRF-017)
const breathRate = 2 + (creature.speed / BASE_MOVE_SPEED) * 2;
creature.mesh.position.y += Math.sin(time * breathRate + creature.facingAngle) * 0.025;

// Herbivore idle: periodic "look around" (BRF-017)
if (creature.trophicLevel === 'herbivore' && creature.state === 'idle') {
  creature.mesh.rotation.y += Math.sin(time * 0.8 + creature.position.z * 2) * 0.3;
}
```

Existing animations preserved:
- Movement bob (walking/fleeing/chasing) — unchanged
- Producer sway — unchanged

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/world3d/creatures.ts` | **MODIFIED** — refactored `buildCreatureMesh()` into trophic-specific builders, added `MeshCtx` interface, 6 appendage functions, 3 appearance functions, animation changes, per-individual variation | MEDIUM — extensive mesh changes but purely additive and rendering-only |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/types.ts` | No new genome traits — all morphology from existing 6 traits |
| `src/engine/creature.ts` | Engine behaviour unchanged — morphology is rendering-only |
| `src/engine/constants.ts` | All thresholds are rendering constants, not simulation constants |
| `src/data/persistence.ts` | No WorldState shape change — no save migration |
| `src/components/*` | Dashboard components unaffected |
| `src/world3d/scene.ts` | Scene lighting/terrain unchanged |
| `src/world3d/terrain.ts` | Terrain rendering unchanged |
| `src/world3d/interaction.ts` | Raycasting/sculpting unchanged (mesh metadata preserved) |
| `src/world3d/camera.ts` | Camera unchanged |
| `src/world3d/World3D.tsx` | Component lifecycle unchanged |

---

## 5. Primitive Budget Analysis

| Creature type | Before BRF-017 | After (minimum) | After (maximum) | Maximum condition |
|---------------|:--------------:|:----------------:|:----------------:|-------------------|
| Producer | 5 | 6 | 7 | Any variant + eyes |
| Herbivore | 5 | 5 | 14 | speed>0.8 + cold>0.6 + heat>0.6 + size>1.0 |
| Predator | 5 | 5 | 14 | speed>1.5 + cold>0.6 + heat>0.6 |

**Typical creature:** 7–10 primitives (1–3 appendages in addition to body/head/eyes).

**Maximum budget of 14 only occurs for extreme genomes** (all threshold traits above their activation point simultaneously). This is rare because trait space is 6-dimensional and natural selection tends to specialise creatures along a few axes, not all of them.

**Performance impact at 100 creatures (DDR-015 rendering):** 100 creatures × 10 avg primitives = ~1,000 meshes. Each mesh is ~50–100 triangles (sphere segments: 10, cylinder tessellation: 8). Total: ~50K–100K additional triangles. Well within budget for Babylon.js at 60fps. The shadow map is the more likely bottleneck (see Risks).

---

## 6. Acceptance Criteria

1. Small creatures (size < 0.5) have visibly larger heads relative to body than large creatures (size > 1.5).
2. Fast creatures (speed > 1.0) are visibly more elongated and narrower than slow creatures (speed < 0.5).
3. Predators lean forward; herbivores lean back. Visible at any camera angle.
4. Predator eyes are noticeably closer together than herbivore eyes on a similar-sized creature.
5. Creatures with coldTolerance > 0.6 have a visible torus mane around their neck.
6. Creatures with heatTolerance > 0.6 have visible ear plates on either side of their head.
7. Predators with speed > 1.2 have a dorsal crest.
8. Predators with speed > 1.5 have a tail.
9. Herbivores with size > 1.0 have horn nubs.
10. Mobile creatures with speed > 0.8 have visible leg nubs.
11. Producers in hot biomes look like cacti; in cold biomes like conifers; small ones like bushes; large ones like trees; default like mushrooms.
12. All creatures exhibit subtle breathing animation.
13. Creatures of the same species look similar but not identical (visible scale/colour variation).
14. High-metabolism creatures have large alert pupils; low-metabolism creatures have small droopy pupils.
15. Herbivores exhibit periodic "look around" rotation during idle state.
16. `npm run build` passes.
17. All 173 tests pass (no engine changes).

---

## 7. Test Strategy

### No new automated tests

BRF-017 is purely a rendering change. All modifications are in `src/world3d/creatures.ts`, which builds Babylon.js meshes. The existing test suite (173 tests) covers the engine, persistence, and spatial systems. Creature mesh building cannot be meaningfully unit-tested without a GPU context (Babylon.js requires a canvas).

The existing `App.test.tsx` smoke test verifies the app renders without error. All engine tests verify that the WorldState contract is unchanged.

### Manual visual verification protocol

The following visual checks replace automated tests for this BRF:

| # | Check | How to verify |
|---|-------|---------------|
| V1 | Allometry | Compare a small creature (size ~0.2) with a large creature (size ~1.5). Small should have proportionally larger head. |
| V2 | Speed → silhouette | Compare a slow creature with a fast creature of the same trophic level. Fast should be noticeably narrower and longer. |
| V3 | Posture | View a predator and herbivore side-by-side. Predator should lean forward, herbivore backward. |
| V4 | Eye spacing | View a predator and herbivore head-on. Predator eyes closer together. |
| V5 | Appendages | Run simulation at 5x for 2 minutes. Observe creatures with legs, manes, ear plates, crests, tails, horns as traits evolve past thresholds. |
| V6 | Producer variants | Inspect producers in different biome types. Desert producers should look like cacti; tundra like conifers; small like bushes; large like trees. |
| V7 | Breathing | Pause the simulation. Observe any creature. It should exhibit subtle vertical oscillation. |
| V8 | Individual variation | Find a group of the same species. Individuals should look similar but not identical in size and colour. |
| V9 | Eye expression | Compare creatures with different metabolism traits. High metabolism = large alert pupils. |
| V10 | The "zoo test" | Screenshot the world. Can you identify at least 3 visually distinct creature types by silhouette alone (ignoring colour)? |

---

## 8. Risks & Mitigations

| # | Risk | Severity | Likelihood | Mitigation |
|---|------|----------|------------|------------|
| 1 | Shadow map performance with 100+ creatures × 10 primitives | MEDIUM | MEDIUM | Each primitive is registered with `shadowGenerator.addShadowCaster()`. At 1000 meshes, shadow pass renders all of them. Mitigated by: shadow map is 1024×1024 (low res), creatures are small, and fog hides distant creatures. If needed: add shadow distance culling in future session. |
| 2 | Material count explosion from per-individual variation | LOW | LOW | Each creature gets unique material names to prevent Babylon.js sharing. With 100 creatures × 3 materials = 300 ShaderMaterial instances. Each is lightweight (only uniform values differ, shader code is shared). Monitor GPU memory. |
| 3 | Appendage thresholds feel abrupt | LOW | MEDIUM | The thresholds (0.6, 0.8, 1.0, 1.2, 1.5) are chosen to space visual milestones across the trait range. If too many creatures hit the same threshold simultaneously, adjust values. The continuous functions (allometry, aspect ratio) provide smooth variation between thresholds. |
| 4 | Producer variant selection ignores edge cases | LOW | LOW | Priority-ordered evaluation means a producer with both heatTolerance > 0.7 AND coldTolerance > 0.7 becomes a cactus (heat wins). This is acceptable — extreme genomes are rare and the visual result is still coherent. |
| 5 | Breathing animation conflicts with movement bob | LOW | LOW | Breathing amplitude (0.025) is smaller than movement bob (0.08) and uses a different frequency. The two sum together naturally. If visual conflict observed, breathing could be suppressed during movement. |
| 6 | Herbivore "look around" rotation looks jerky | LOW | MEDIUM | The rotation is sinusoidal (`sin(time * 0.8)`) and only applies during idle state. If it conflicts with facing angle updates, it could be interpolated more smoothly. |

---

## 9. Trait-to-Morphology Reference Table

Complete mapping of all 6 genome traits to visual features, for future reference:

| Trait | Range | Visual effects |
|-------|-------|---------------|
| **size** (0.1–2.0) | Continuous | Overall scale (0.4–0.8 world units). Allometric head ratio (0.65→0.50). Leg thickness (if present). Producer: bush (<0.5) or tree (>1.2). Herbivore: horns (>1.0). Colour lightness. |
| **speed** (0.1–2.0) | Continuous + thresholds | Body X-compression (1.0→0.6). Body Z-stretch (0.8→1.2). Legs appear (>0.8). Leg length scales continuously. Predator: dorsal crest (>1.2), tail (>1.5). |
| **coldTolerance** (0.0–1.0) | Threshold | Mane ruff appears (>0.6), thickness scales. Producer: conifer shape (>0.7). Colour hue shift toward blue. |
| **heatTolerance** (0.0–1.0) | Threshold | Ear plates appear (>0.6), size scales. Producer: cactus shape (>0.7). Colour hue shift toward red. |
| **metabolism** (0.1–2.0) | Continuous | Pupil size and position (alert >1.2, sleepy <0.5). Colour saturation. Breathing animation rate. |
| **reproductionRate** (0.1–2.0) | — | No direct visual effect in BRF-017. Reserved for future neotenous (high-r) vs ornamented (low-r) features. |
| **trophicLevel** | Categorical | Body shape archetype (mushroom/round/sleek). Posture offset (forward/back). Eye spacing (narrow/wide). Available appendage set. Colour base hue (green/amber/red). |

---

## 10. What This Unlocks

With visible evolutionary morphology, future features become much more meaningful:

- **Aquatic body plans** (future `aquaticAffinity` trait): lateral body compression, fin-to-limb transition, tail fin — the visual framework for continuous morphing is now established
- **Species share codes**: shared creatures carry visible evolutionary history — a maned, horned herbivore tells a story about its origin biome
- **Player attachment**: creatures with visible personality (eye expression, breathing, individual variation) create emotional connection — the idle game's core retention mechanic
- **The "zoo test"**: the north star metric for creature readability is now achievable — 3+ visually distinct types identifiable by silhouette at any zoom level

---

*Radiate · BRF-017 · Pre-Implementation Brief · v0.3 "Living World" · March 2026*
