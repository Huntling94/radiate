# BRF-011: 3D Creatures — Phase 2

**Phase:** v0.2 "Naturalist" · 3D World View (Phase 2 of 4)
**Commit message:** `add genome-driven 3D creatures and improved terrain shading`

---

## 1. Objective

Phase 1 delivered a 3D terrain with coloured circles for species indicators. The result is functional but lifeless — the player can't tell what the circles mean, and the terrain looks flat despite having height variation. Phase 2 brings the world to life.

### What BRF-011 Delivers

- **Procedural 3D creatures** — simple geometric bodies assembled from genome traits (size, shape, colour)
- **Trophic-distinct silhouettes** — producers are low/flat (plant-like), herbivores are rounded (body-like), predators are angular (sharp/sleek)
- **Genome-driven visual variation** — size scales the mesh, speed elongates it, metabolism affects colour saturation
- **Population representation** — instanced meshes per species, count scaled to show density without rendering thousands of individuals
- **Idle animation** — gentle bobbing/rotation so the world feels alive
- **Improved terrain** — subtle noise perturbation on vertex colours for visual depth, stronger normal-based shading

### What BRF-011 Does NOT Deliver

- GLTF model loading or detailed creature art (deferred to later)
- Creature pathfinding or movement across biomes
- Player character or interaction (Phase 3)

---

## 2. Architecture Decisions

### Decision 1: Procedural geometry, not GLTF models

**Chosen:** Build creatures from Three.js primitives (spheres, cones, cylinders, boxes) assembled based on genome traits. Each species gets a unique geometry combination.

**Why:** No asset pipeline needed. Creatures are generated entirely from data the simulation already produces. This is fast to implement, fast to render, and creates emergent visual diversity — the player discovers what their species "look like" based on evolution.

**Deferred:** GLTF modular parts (head + body + legs from a parts library). This is Phase 4+ territory and requires an artist or procedural mesh generation system.

### Decision 2: InstancedMesh for population density

**Chosen:** Each species gets one `THREE.InstancedMesh`. The instance count represents population in that biome, capped at a visual budget (e.g., max 8 instances per species per biome). Instance transforms scatter creatures within the biome cell bounds.

**Why:** Rendering one draw call per species (not per creature) keeps GPU cost low. A world with 10 species × 50 populated biomes = 10 draw calls, not 500+ individual meshes.

**Population mapping:** `min(8, ceil(log2(population)))` instances per biome. This gives visual density without overwhelming the scene.

### Decision 3: Trophic level determines base shape

| Trophic Level | Base Shape | Visual Intent |
|---|---|---|
| **Producer** | Flat cylinder + small sphere on top | Plant/fungus — low, rooted, organic |
| **Herbivore** | Rounded sphere + smaller sphere (head) | Gentle body — soft, bulky |
| **Predator** | Elongated cone + angular box (head) | Sharp, forward-leaning, aggressive |

Genome traits then modify these bases:
- `size` (0.1–2.0): scales the entire creature uniformly
- `speed` (0.1–2.0): stretches the body along the forward axis (fast = elongated)
- `metabolism` (0.1–2.0): increases colour saturation/brightness (high metabolism = vivid)
- `coldTolerance` / `heatTolerance`: shifts hue slightly (cold-adapted = bluer, heat-adapted = warmer)

### Decision 4: Creature colour from trophic level + genome

Base hue from trophic level (green / amber / red), then modulated:
- Saturation: `0.4 + metabolism * 0.3` (high metabolism = vivid colours)
- Lightness: `0.35 + size * 0.1` (larger creatures slightly lighter)
- Hue shift: `coldTolerance * -15° + heatTolerance * +15°` (subtle temperature adaptation tint)

This produces visually distinct species that share a family resemblance within trophic levels.

### Decision 5: Idle animation via shader-free approach

Simple sine-wave bobbing on the y-axis per instance, offset by instance index for organic feel. Rotation oscillates slightly. Updated in the animation loop (not a shader) for simplicity.

```
y_offset = sin(time * 1.5 + instanceIndex * 0.7) * 0.15
rotation_y += sin(time * 0.8 + instanceIndex) * 0.02
```

### Decision 6: Terrain visual improvement

Add subtle vertex colour variation to break up flat biome patches:
- Perturb each vertex's RGB by ±5% based on a hash of its position
- This creates a natural mottled look without textures
- Ensure mountain vertices are slightly varied (rock colour) and grassland vertices have green variation

This is a small change to `terrain.ts` (still pure TS, no Three.js).

### Decision 7: New `creatures.ts` module

```
src/world3d/
  terrain.ts       — Pure TS: biome data → heightmap + colour arrays (improved)
  creatures.ts     — NEW: creature geometry, instanced mesh management, animation
  scene.ts         — Three.js scene setup (unchanged)
  indicators.ts    — REMOVED: replaced by creatures.ts
  World3D.tsx      — Updated: wire creature updates instead of indicators
```

---

## 3. Detailed Design

### 3.1 Creature geometry builder

```typescript
// src/world3d/creatures.ts

interface CreatureAppearance {
  baseScale: number;
  stretchZ: number;      // speed-derived elongation
  hue: number;           // trophic base + tolerance shift
  saturation: number;    // metabolism-derived
  lightness: number;     // size-derived
}

function computeAppearance(species: Species): CreatureAppearance {
  const traits = expressTraits(species.genome);
  // ... map traits to visual params
}

function buildCreatureGeometry(
  trophicLevel: TrophicLevel,
  appearance: CreatureAppearance,
): THREE.BufferGeometry {
  // Assemble from primitives based on trophicLevel
  // Apply scale and stretch transforms
  // Return merged geometry
}
```

### 3.2 Instanced mesh per species

```typescript
interface CreatureGroup {
  speciesId: string;
  mesh: THREE.InstancedMesh;
  instanceCount: number;
}

function updateCreatures(
  scene: THREE.Scene,
  species: Species[],
  biomes: Biome[],
  gridWidth: number,
  gridHeight: number,
  time: number,
): void {
  // For each species:
  //   1. Compute appearance from genome
  //   2. Build or reuse geometry
  //   3. Compute instance positions (scattered within populated biomes)
  //   4. Apply bobbing animation
  //   5. Update InstancedMesh transforms
}
```

### 3.3 Instance scattering within biomes

For each species in each biome with population > 0:
- Compute biome centre world position via `biomeToWorldXZ()`
- Get terrain height via `getTerrainHeightAtBiome()`
- Place `min(8, ceil(log2(population)))` instances
- Scatter positions randomly within `±CELL_SIZE/3` of the biome centre (deterministic from species ID + biome ID hash to avoid jitter between frames)

### 3.4 Terrain colour variation

Add to `generateTerrain()`:
```typescript
// After assigning base biome colour
const hash = simpleHash(vx, vy);
const variation = (hash % 100) / 100 * 0.1 - 0.05; // ±5%
colours[idx * 3] = Math.max(0, Math.min(1, rgb[0] + variation));
colours[idx * 3 + 1] = Math.max(0, Math.min(1, rgb[1] + variation * 0.8));
colours[idx * 3 + 2] = Math.max(0, Math.min(1, rgb[2] + variation * 0.6));
```

### 3.5 World3D.tsx changes

Replace the indicators `useEffect` with a creatures update. Pass `time` from the animation loop to enable bobbing.

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/world3d/creatures.ts` | **NEW** — Creature geometry, instanced meshes, animation | MEDIUM — core new feature |
| `src/world3d/terrain.ts` | **MODIFIED** — Add vertex colour variation for visual depth | LOW — small additive change |
| `src/world3d/World3D.tsx` | **MODIFIED** — Replace indicator updates with creature updates, pass time | LOW |
| `src/world3d/indicators.ts` | **REMOVED** — Replaced by creatures.ts | LOW |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/*` | No engine changes |
| `src/world3d/scene.ts` | Scene setup unchanged |
| `src/App.tsx` | Layout unchanged |

---

## 5. Acceptance Criteria

1. Each living species is represented by 3D procedural creatures on the terrain.
2. Producers, herbivores, and predators have visually distinct silhouettes.
3. Species within the same trophic level look different from each other (genome-driven variation).
4. Creature size visually correlates with the species' size trait.
5. Creatures are scattered across biomes where the species has population.
6. Creature count per biome visually indicates population density.
7. Creatures gently bob/rotate (idle animation) so the world feels alive.
8. Terrain has subtle colour variation (no flat single-colour biome patches).
9. Billboard indicators (circles) are removed.
10. Performance: scene renders at 60fps with 10 species across 50 biomes.
11. `npm run build` passes.
12. All existing tests pass.

---

## 6. Test Strategy

The creature geometry and appearance computation are pure functions that could be unit tested, but the visual output is best verified manually. Terrain colour variation is tested by the existing terrain tests (colours still in valid range).

**Manual verification:**
- New game → 3 seed species visible as distinct creatures
- Producers look plant-like, herbivores rounded, predators angular
- Species with high size trait are visibly larger
- Temperature change → biome colours shift, creatures remain correctly placed
- Speciation → new species appears with a visually different creature
- Zoom in → creatures have distinct geometry and colour
- Zoom out → creatures remain visible, not cluttered
- Mobile → scene renders without frame drops

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Procedural creatures look ugly/abstract | MEDIUM | Start simple — clean geometric shapes with good colour theory are more appealing than detailed but uncanny models. Iterate on proportions after first visual pass. |
| Too many instances cause frame drops | LOW | Capped at 8 instances per species per biome. InstancedMesh keeps draw calls at O(species), not O(instances). |
| Creature positions jitter on re-render | LOW | Use deterministic hash (speciesId + biomeId) for scatter positions, not Math.random(). |
| Merged geometry complexity | LOW | Each creature is 2-3 primitives with low polygon count (~50 tris). Even 500 instances = 25K triangles — trivial. |

---

*Radiate · BRF-011 · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
