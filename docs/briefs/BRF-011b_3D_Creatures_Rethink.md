# BRF-011b: 3D Creatures — Rethink

**Phase:** v0.2 "Naturalist" · 3D World View (Phase 2, revised)
**Supersedes:** BRF-011 (primitive-based creatures — rejected after visual review)
**Commit message:** `rework 3D creatures: cute representative animals with wander AI and larger explorable world`

---

## 1. Objective

BRF-011 produced a cluttered field of geometric primitives locked to biome cells. The result looked more like a data visualisation than a living world. This rethink changes the fundamental approach: the 3D view is a **nature documentary camera**, not a population heatmap.

### What BRF-011b Delivers

- **Cute procedural creatures** — rounded bodies, big heads with eyes, genome-driven proportions and colour
- **Representative creatures** — 3–8 per species total (not per biome), roaming the entire map
- **Wander AI** — creatures walk across terrain, pick targets, turn to face direction, pause and idle
- **Larger, explorable world** — terrain scaled up with WASD camera controls for exploration
- **Toon/soft shading** — MeshToonMaterial for a warmer, more approachable aesthetic

### The core design shift

| Before (BRF-011) | After (BRF-011b) |
|---|---|
| Population visualisation — show data | Nature documentary — show characters |
| ~8 instances per species per biome | 3–8 representatives per species total |
| Locked to biome cell centres | Wander freely across habitable terrain |
| Cones, cylinders, boxes | Rounded bodies with eyes and personality |
| Lambert flat shading | Toon shading for warmth |
| Orbital camera only | WASD exploration + orbital orbit |

---

## 2. Architecture Decisions

### Decision 1: Representative creatures, not population rendering

The simulation tracks thousands of organisms. The 3D view shows a **handful of representatives** per species — enough to see the species' visual identity and behaviour, not enough to visualise population counts. Population data stays in the UI (species cards, charts, phylogenetic tree).

Number of representatives per species: `min(8, max(3, floor(log10(totalPopulation))))`. A species with 100 organisms shows 3 creatures. A species with 100,000 shows 5. This keeps the world readable even with 10+ species.

### Decision 2: Cute creature design language

Every creature follows the same "cute" template scaled by genome:

```
     @@@@          ← Head: large sphere (30-40% of body height)
    @O  O@         ← Eyes: white spheres with dark pupils, forward-facing
    @ ^^ @         ← (no explicit mouth — less is more for cuteness)
     @@@@
    /|||||\        ← Body: shorter rounded shape below
    |     |           Trophic level determines body proportions
    \_____/
```

**Why eyes matter so much:** Humans are hardwired to perceive faces. Two dots on a sphere instantly register as a "creature." Without eyes, even the best body geometry reads as an abstract shape. Eyes create attachment — the player sees *individuals*, not *objects*.

**Trophic body plans:**
- **Producer:** Squat mushroom-like shape. Round cap on short stalk. Eyes on the cap. Gentle side-to-side sway instead of walking.
- **Herbivore:** Chubby round body, large head relative to body. Short legs implied by ground contact. Waddle walk.
- **Predator:** Sleeker body, slightly elongated. Head tilts forward. Faster, more purposeful movement.

**Genome-driven variation:**
- `size` → uniform scale (0.5x–2x)
- `speed` → movement speed and body elongation (fast = slightly stretched)
- `metabolism` → colour saturation (high metabolism = vivid)
- `coldTolerance / heatTolerance` → hue shift (cold-adapted = cooler blue tint, heat = warmer)
- Species ID hash → additional body colour hue variation so siblings look different

### Decision 3: Behaviour AI — wander, chase, flee (rendering layer only)

Creature behaviour depends on trophic level. All behaviour is cosmetic — the Lotka-Volterra engine still drives actual population dynamics. This is visual storytelling.

**Producer state machine:**
```
IDLE (sway) → DRIFT (slow) → IDLE
```
Producers mostly stay still with a gentle sway. Occasional slow drift to a nearby position. No fleeing — they're rooted.

**Herbivore state machine:**
```
IDLE → WANDER → GRAZE (near producer) → WANDER
                ↓ (predator nearby)
              FLEE → IDLE
```
Herbivores wander freely. When near a producer creature, they pause to "graze" (stop, face the producer, bob gently). When a predator creature enters detection range, they **flee** — move away at 2× speed for a few seconds, then resume wandering.

**Predator state machine:**
```
IDLE → WANDER → DETECT (herbivore nearby) → CHASE → CATCH → IDLE
                                                  ↘ MISS → IDLE
```
Predators wander until a herbivore creature enters detection range. They then **chase** — move toward the herbivore at 1.5× speed. If they reach it, a **catch** visual plays: the prey creature fades out, the predator idles briefly (eating), and the prey respawns at a random position after a few seconds. If the prey outruns the predator (exceeds max chase distance), the predator gives up and returns to wandering.

**Detection ranges:**
- Predator detection radius: `8 + speed * 3` world units
- Herbivore flee trigger: `5 + speed * 2` world units
- Chase timeout: 6 seconds max

This makes the food chain visible. The player sees predators hunting, herbivores fleeing, and producers being grazed. When predator population crashes (no prey), the 3D world shows predators wandering aimlessly with nothing to chase — the visual matches the simulation story.

None of this affects the engine. Creature positions are cosmetic. Agent-based simulation (DDR-011) will eventually make these interactions real.

### Decision 4: Larger terrain with WASD camera

**Terrain scale:** Increase `CELL_SIZE` from 4 to 10 world units and increase subdivision from 4 to 6 per cell. This makes the world ~2.5× larger in each dimension, giving creatures space to roam and the player a sense of exploration.

**Camera controls:**
- **WASD** — move camera position horizontally (forward/back/strafe)
- **Mouse drag** — orbit around the camera's look-at point
- **Scroll** — zoom in/out
- **Q/E** — optional rotate (or use right-drag)

Implementation: Replace `OrbitControls` with a custom camera rig. The camera target moves with WASD; orbit behaviour wraps around that moving target. This gives the feel of walking through the world while still being able to look around.

### Decision 5: MeshToonMaterial for warmth

Switch from `MeshLambertMaterial` to `MeshToonMaterial`. Toon shading gives:
- Softer, more stylised look (matches "cute" aesthetic)
- Clear light/shadow boundary (creatures pop from background)
- Game-like rather than tech-demo-like

Terrain keeps `MeshLambertMaterial` (toon shading on terrain looks odd).

### Decision 6: Creature lifecycle synced to simulation

- When the simulation ticks and a new species appears, spawn new representative creatures at random positions in populated biomes
- When a species goes extinct, its creatures fade out (scale to 0 over 1 second) and are removed
- When population shifts between biomes, creatures don't teleport — they gradually migrate (bias new wander targets toward populated biomes)

---

## 3. Detailed Design

### 3.1 Creature mesh builder

```typescript
interface CreatureVisuals {
  bodyGroup: THREE.Group;   // the full creature (body + head + eyes)
  colour: THREE.Color;
  scale: number;
}

function buildCreatureMesh(species: Species): CreatureVisuals {
  // Head: SphereGeometry, large
  // Eyes: two small white SphereGeometry with dark pupil SphereGeometry inset
  // Body: SphereGeometry scaled by trophic level proportions
  // All assembled in a Group
  // MeshToonMaterial for all parts
}
```

### 3.2 Creature instance state

```typescript
interface CreatureInstance {
  speciesId: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  targetPosition: THREE.Vector3;
  state: 'idle' | 'walking';
  stateTimer: number;
  speed: number;
  facingAngle: number;
}
```

### 3.3 Wander system (per frame)

```typescript
function updateCreatureWander(
  creature: CreatureInstance,
  delta: number,
  terrain: TerrainData,
  biomes: Biome[],
  species: Species,
  gridWidth: number,
  gridHeight: number,
): void {
  switch (creature.state) {
    case 'idle':
      creature.stateTimer -= delta;
      if (creature.stateTimer <= 0) {
        creature.targetPosition = pickWanderTarget(...);
        creature.state = 'walking';
      }
      break;
    case 'walking':
      // Move toward target
      // Rotate to face direction
      // Check arrival
      break;
  }
}
```

### 3.4 Camera rig

```typescript
// Custom camera controller
// - Position: moves with WASD relative to camera facing
// - Orbit: mouse drag rotates around the position
// - Zoom: scroll adjusts distance from orbit centre

class ExplorationCamera {
  position: THREE.Vector3;     // where the camera looks at
  orbitAngle: number;          // horizontal orbit angle
  orbitPitch: number;          // vertical pitch
  distance: number;            // distance from position

  update(keys: Set<string>, mouseDelta: {x: number, y: number}, scrollDelta: number): void;
  getCamera(): THREE.PerspectiveCamera;
}
```

### 3.5 Terrain height query for wander

Creatures need to follow terrain height as they walk. Add a `getHeightAtWorldXZ(x, z)` function to `terrain.ts` that interpolates height from the vertex data, so creatures stay on the ground.

### 3.6 World3D.tsx changes

- Maintain a `CreatureInstance[]` array (persists across frames)
- Sync with species list: add creatures for new species, remove for extinct
- Per-frame: update all creature wander states, update mesh transforms
- Replace OrbitControls with ExplorationCamera
- Track key state via `keydown`/`keyup` listeners

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/world3d/creatures.ts` | **REWRITTEN** — cute procedural meshes, wander AI, creature lifecycle | HIGH — complete redesign |
| `src/world3d/terrain.ts` | **MODIFIED** — increase CELL_SIZE, add `getHeightAtWorldXZ()` helper | LOW |
| `src/world3d/camera.ts` | **NEW** — WASD exploration camera with orbit | MEDIUM |
| `src/world3d/scene.ts` | **MODIFIED** — remove OrbitControls, adjust fog/lighting for larger world | LOW |
| `src/world3d/World3D.tsx` | **MODIFIED** — creature instance management, key listeners, camera rig | MEDIUM |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/*` | No engine changes — creatures are rendering-only |
| `src/App.tsx` | Layout unchanged |
| `src/data/persistence.ts` | No WorldState changes |

---

## 5. Acceptance Criteria

1. Each living species has 3–8 representative creatures on the map.
2. Creatures have rounded bodies, visible eyes, and genome-driven colour/size.
3. Producers, herbivores, and predators have distinct silhouettes.
4. Different species of the same trophic level are visually distinguishable.
5. Creatures wander across the terrain, walking between idle stops.
6. Creatures face their movement direction while walking.
7. Creatures stay on habitable terrain (no walking into ocean or through mountains).
8. WASD moves the camera across the terrain for exploration.
9. Mouse drag orbits the camera. Scroll zooms.
10. New species get creatures spawned. Extinct species creatures are removed.
11. The world feels larger and explorable (not a tiny diorama).
12. `npm run build` passes.
13. All existing tests pass.

---

## 6. Test Strategy

No engine changes. Terrain helpers (`getHeightAtWorldXZ`) can be unit tested.

**Manual verification:**
- New game → 3 species visible as cute creatures with eyes
- Zoom in on a creature → can see head, body, eyes, trophic shape
- Creatures walk around, pause, walk again
- WASD moves camera across terrain
- Speciation → new creatures appear
- Extinction → creatures disappear
- Mobile → touch controls still work (tap-drag to orbit, pinch to zoom)

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| WASD camera feels janky without tuning | MEDIUM | Add smooth interpolation (lerp) on position and orbit. Test with different movement speeds. |
| Creatures walk through each other | LOW | Acceptable for v0.2. No collision between creatures. They're representatives, not a physics sim. |
| Wander targets end up in ocean/mountains | MEDIUM | Validate targets against biome habitability before accepting. Retry if invalid. |
| Creature mesh Groups have more draw calls than InstancedMesh | LOW | 3–8 creatures × 10 species = 30–80 Groups. Each Group has ~5 meshes = 150–400 draw calls. Fine for desktop, monitor on mobile. |
| Toon shading looks flat on small creatures at distance | LOW | Add slight emissive to creatures so they glow subtly against terrain. |

---

*Radiate · BRF-011b · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
