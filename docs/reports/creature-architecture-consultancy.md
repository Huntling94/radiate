# Creature Architecture Consultancy Report

**Commissioned:** 25 March 2026 (Session 4)
**Panel:** 5 SMEs — Lead Character TA (Spore/NMS), Computational Morphologist, Technical Artist (Ooblets/Slime Rancher), Game Designer (Niche/Ecosystem), WebGL Performance Engineer
**Purpose:** Design a robust, scalable procedural creature system that can express plants, fish, quadrupeds, birds, and megafauna from a unified genome within Radiate's toon-shaded art style.
**Status:** Report complete. Implementation deferred to Session 5.

---

## Unanimous Recommendation

**Parametric Skeleton Graph with Primitive Flesh.** Replace primitive stacking (sphere+sphere snowmen) with a skeleton graph where joints connect via bones, each fleshed with capsule primitives. The skeleton graph maps directly to biological body plan theory — all life forms are branching trees of segments.

---

## Architecture

### Dual Genome (Ecological + Morphological)

Add a separate `morphology: number[]` array (6 traits) to each Creature. **NOT included in speciation clustering distance** — species identity is ecological, not visual (biologically correct).

**Morphological traits:**

| Index | Trait | Range | Default | Visual Effect |
|-------|-------|-------|---------|--------------|
| 0 | limbCount | 0.0-1.0 | 0.5 | 0=limbless, 0.25=biped, 0.5=quadruped, 0.75=hexapod |
| 1 | neckLength | 0.0-1.0 | 0.3 | 0=head on body, 1.0=giraffe neck |
| 2 | limbLength | 0.0-1.0 | 0.4 | 0=nubs/flippers, 1.0=stilts |
| 3 | bodyElongation | 0.0-1.0 | 0.4 | 0=spherical, 1.0=serpentine |
| 4 | appendageType | 0.0-1.0 | 0.3 | Continuous: tail → horns → crest → trunk |
| 5 | branchDensity | 0.0-1.0 | 0.3 | Producers: canopy density. Consumers: ignored |

### Pipeline

```
Creature.genome + Creature.morphology
        ↓
genomeToSkeleton() [pure TS, src/world3d/morphology.ts]
        ↓
SkeletonGraph { joints: Joint[], bones: Bone[] }
        ↓
buildSkeletonMesh() [Babylon.js, src/world3d/creatures.ts]
        ↓
TransformNode hierarchy with capsule/sphere flesh
```

### Example Creatures

| Creature | limbCount | neckLength | limbLength | bodyElongation | appendageType | branchDensity |
|----------|-----------|------------|------------|----------------|---------------|---------------|
| Wolf | 0.5 | 0.4 | 0.5 | 0.5 | 0.3 (tail) | — |
| Elephant | 0.5 | 0.2 | 0.7 | 0.3 | 1.0 (trunk) | — |
| Fish | 0.0 | 0.0 | 0.0 | 0.8 | 0.3 (tail fin) | — |
| Rat | 0.5 | 0.1 | 0.3 | 0.4 | 0.3 (tail) | — |
| Snake | 0.0 | 0.0 | 0.0 | 1.0 | 0.1 (none) | — |
| Oak tree | — | — | — | 0.3 | — | 0.9 |
| Mushroom | — | — | — | 0.1 | — | 0.0 |
| Bush | — | — | — | 0.2 | — | 0.5 |

---

## Art Style Techniques

1. **Capsule primitives** (`MeshBuilder.CreateCapsule()`) — smooth joint blending, no gaps
2. **Minimum chubbiness** (diameter:length ≥ 0.3) — nothing skeletal/grotesque
3. **Eye specular highlight** — tiny white sphere offset from pupil (life cue)
4. **Countershading** — lighter belly, darker back (natural feel)
5. **Squash-and-stretch** — body scaling keyed to movement (Disney principle)
6. **Bilateral symmetry** — structurally enforced in skeleton graph
7. **Outline shader** — second pass with back-face scaled dark mesh (Phase 4 polish)

---

## Procedural Animation

| Creature type | Animation technique | Detail |
|---------------|-------------------|--------|
| Quadruped walk | Sine-wave gait | 4 legs with 0°/180°/90°/270° phase offsets. Body bob at 2× leg frequency. |
| Fish/snake | Spine undulation | Sine wave along body segments, decreasing amplitude head→tail |
| Producer/tree | Branch sway | Per-joint phase-offset sine, varying amplitude |
| All | Squash-and-stretch | Root TransformNode scaling on sine keyed to speed |
| All | Breathing | Existing Y-oscillation, speed from metabolism |

No IK or rigged skeletons needed. All animation is procedural TransformNode rotation.

---

## Performance Strategy (LOD + Instancing)

| LOD level | Distance | Budget | Strategy |
|-----------|----------|--------|----------|
| LOD0 | <30 units | 300-800 verts, animated | Individual TransformNodes, max 30 creatures |
| LOD1 | 30-80 units | 80-200 verts, static | Thin instances per species |
| LOD2 | 80-150 units | 20-40 verts | Single capsule thin instances |
| Culled | >150 units | 0 | Not rendered |

- **Geometry caching:** Build mesh once per species, clone for individuals. Rebuild on clustering (every 100 ticks).
- **Producers:** Always thin-instanced (sessile, no animation). Forest of 200 trees = 3-5 draw calls.
- **Target:** <100 draw calls for creatures, <16ms frame time.

---

## Implementation Roadmap

| Phase | Session | Deliverable | Risk |
|-------|---------|-------------|------|
| 1 | 5 | Skeleton architecture + basic rendering | Medium (type change) |
| 2 | 5-6 | Procedural animation | Low |
| 3 | 6 | LOD + direct IBM rendering (DDR-015) | Medium |
| 4 | 7 | Visual polish (outlines, countershading) | Low |

### Phase 1 requires:
- ADR for morphological genome decision
- BRF for skeleton mesh system
- Save format v3 migration (add default morphology to existing creatures)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Save format change | High | Medium | Version bump. Defaults on load. (Lesson 3 precedent) |
| Morphology mutation chaos | Medium | Medium | Half mutation magnitude for morphology. Constraint rules. |
| Performance cliff | Medium | High | Hard LOD0 cap at 30. Profile in Phase 3. |
| Ugly combinations | Medium | Medium | Constraints: limbless→elongated, symmetry enforced |
| LOD popping | Medium | Low | Lerp + fog covers transitions |

---

*Radiate · Creature Architecture Consultancy · Session 4 · March 2026*
