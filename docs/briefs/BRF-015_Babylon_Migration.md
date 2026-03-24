# BRF-015: Three.js → Babylon.js Migration

**Phase:** v0.2 → v0.3 bridge · DDR-012 resolution
**Depends on:** BRF-012 (3D Polish + Terrain Sculpting) — all Phase 2 features complete
**Resolves:** DDR-012 (Phase 2→3 engine migration checkpoint)
**Consultancy report:** `docs/reports/ddr-002-3d-engine-assessment.md`
**SME review:** Reviewed by WebGL Game Engine Architect (simulated). P0/P1/P2 corrections incorporated below.

---

## 1. Objective

Replace the Three.js rendering layer in `src/world3d/` with Babylon.js, restoring full feature parity with the current 3D world view. This is a **bounded rewrite** of one directory — the simulation engine, persistence layer, and dashboard components are untouched.

### Why now

DDR-012's trigger condition is met: Phase 2 is complete (F-012 through F-016), and the next feature on the roadmap is the player character (Phase 3). The consultancy report scored Babylon.js 819 vs Three.js 618 on weighted requirements, with the deciding factors being built-in physics, character controller, and input handling — all essential for Phase 3.

### What BRF-015 Delivers

- Babylon.js scene with terrain generated from existing `TerrainData` (pure TS, already engine-agnostic)
- Sky dome, directional + ambient + hemisphere lighting, fog, shadows
- Procedural genome-driven creatures with toon-style shading and behaviour AI
- WASD + orbit camera rig with terrain following
- Click-to-select creatures via raycasting
- Terrain sculpting tools (raise/lower/wet/dry) with brush preview
- Dashboard overlay (React panels over Babylon canvas) — functionally identical to current
- All existing terrain tests passing without modification

### What BRF-015 Does NOT Deliver

- Player character or first-person camera (Phase 3 — separate BRF)
- Physics engine integration (deferred to Phase 3 when needed for character controller)
- Building system (Phase 4 — separate BRF)
- New visual features or creature model improvements
- Any changes to `src/engine/`, `src/data/`, or `src/components/`

---

## 2. Current State Analysis

### File inventory (`src/world3d/`, ~1,968 lines)

| File | Lines | Three.js coupling | Pure logic | Migration effort |
|------|------:|-------------------|-----------|-----------------|
| `terrain.ts` | 289 | **None** — pure TypeScript | 100% | **Zero** — reused as-is |
| `terrain.test.ts` | 132 | **None** — tests pure functions | 100% | **Zero** — passes unchanged |
| `scene.ts` | 207 | 100% — renderer, lights, sky, terrain mesh | 0% | **Full rewrite** |
| `camera.ts` | 202 | ~20% — Camera + Vector3 types | 80% movement math | **Medium** — math transfers |
| `creatures.ts` | 645 | ~40% — mesh building | 60% behaviour AI | **Medium-High** — AI transfers, meshes rewritten |
| `interaction.ts` | 297 | ~50% — raycaster, visual meshes | 50% brush logic | **Medium** — raycasting API change |
| `World3D.tsx` | 196 | Indirect — calls other modules | Component lifecycle | **Low** — swap module calls |

**Key insight:** 421 lines of terrain code (terrain.ts + terrain.test.ts) require zero changes. The behaviour AI in creatures.ts (~390 lines of state machine logic) is pure math and transfers directly. The actual Three.js-specific code that needs rewriting is approximately **800–900 lines**.

### Architecture boundary (preserved)

```
src/engine/  ──→  WorldState  ──→  src/world3d/  (Babylon.js, was Three.js)
                      ↑                    ↑
                  src/data/         src/components/ (React overlay, unchanged)
```

The `WorldState` contract is the only interface between simulation and renderer. Babylon consumes it read-only, same as Three.js did.

---

## 3. Dependency Changes

### Remove
```
three                  (3D rendering — replaced)
@types/three           (type definitions — Babylon is TS-native)
```

### Add
```
@babylonjs/core        (~300KB gzip, tree-shakeable — scene, cameras, lights, materials, meshes)
@babylonjs/materials   (~40KB gzip — advanced materials; may not be needed if toon shading uses custom ShaderMaterial)
```

### Not yet needed (Phase 3+)
```
@babylonjs/havok       (physics — when player character needs collision)
@babylonjs/loaders     (GLTF — when/if creature models move from procedural to assets)
@babylonjs/gui         (not needed — React overlay for all UI)
```

---

## 4. Implementation Plan

### Step 1: Scaffold Babylon scene (`scene.ts` rewrite)

Replace the Three.js renderer/scene/lighting setup with Babylon equivalents.

| Three.js | Babylon.js equivalent |
|----------|----------------------|
| `WebGLRenderer` | `Engine` + `Scene` |
| `Scene` | `Scene` (same concept) |
| `DirectionalLight` + shadow camera | `DirectionalLight` + `ShadowGenerator` |
| `AmbientLight` | `HemisphericLight` (combined ambient + hemisphere) |
| `HemisphereLight` | (merged into above) |
| `FogExp2` | `scene.fogMode = Scene.FOGMODE_EXP2` |
| `ShaderMaterial` sky dome (GLSL) | Babylon `ShaderMaterial` (GLSL compatible) or `GradientMaterial` from `@babylonjs/materials` |
| `BufferGeometry` + `BufferAttribute` for terrain | `Mesh` + `VertexData` |
| `MeshStandardMaterial` (PBR terrain) | `PBRMaterial` or `StandardMaterial` |
| `PlaneGeometry` (water) | `MeshBuilder.CreateGround()` or `CreatePlane()` |

**SceneContext interface changes:**
```typescript
// Before (Three.js)
interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  terrainMesh: THREE.Mesh | null;
  waterMesh: THREE.Mesh | null;
  dispose(): void;
}

// After (Babylon.js)
interface SceneContext {
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  terrainMesh: BABYLON.Mesh | null;
  waterMesh: BABYLON.Mesh | null;
  dispose(): void;
}
```

The terrain mesh is built from the same `TerrainData` output (Float32Array positions, colours, Uint32Array indices) — just applied via `VertexData` instead of `BufferAttribute`.

**Key Babylon terrain pattern:**

> **SME correction (P0):** Babylon's `VertexData.colors` expects RGBA (4 components per vertex), not RGB (3 components). Our `terrain.ts` outputs RGB. Rather than modifying terrain.ts (which is pure TS and engine-agnostic), we write an `rgbToRgba()` shim in scene.ts that expands the Float32Array before applying to VertexData.

> **SME correction (P0):** Three.js uses CCW winding for front faces; Babylon uses CW by default. Setting `scene.useRightHandedSystem = true` as the **first line of scene creation** fixes both coordinate system and winding order, eliminating an entire class of bugs.

> **SME correction:** `VertexData.ComputeNormals` requires a pre-allocated `Float32Array(positions.length)` — it writes in-place, unlike Three.js's `computeVertexNormals()` which handles allocation internally.

```typescript
// RGB→RGBA conversion shim (terrain.ts stays pure)
function rgbToRgba(rgb: Float32Array): Float32Array {
  const rgba = new Float32Array((rgb.length / 3) * 4);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    rgba[j] = rgb[i]; rgba[j+1] = rgb[i+1]; rgba[j+2] = rgb[i+2]; rgba[j+3] = 1;
  }
  return rgba;
}

const vertexData = new VertexData();
vertexData.positions = terrainData.positions;
vertexData.colors = rgbToRgba(terrainData.colours);  // RGB→RGBA shim
vertexData.indices = terrainData.indices;
const normals = new Float32Array(terrainData.positions.length);  // pre-allocate
VertexData.ComputeNormals(terrainData.positions, terrainData.indices, normals);
vertexData.normals = normals;
vertexData.applyToMesh(terrainMesh);
```

**Terrain material:** Use `PBRMaterial` with `roughness = 0.85`, `metallic = 0` (not `StandardMaterial`, which lacks roughness/metalness properties and uses specularColor/specularPower instead). Enable `material.useVertexColors = true`.

**Water surface:** Use `MeshBuilder.CreateGround()` (already oriented horizontally in XZ plane), not `CreatePlane()` (which is vertical XY and would require rotation).

**Terrain updates on sculpt:** Use `mesh.updateVerticesData(VertexBuffer.PositionKind, newPositions)` for in-place updates instead of destroying and recreating the mesh. Cheaper and avoids shadow generator re-registration.

### Step 2: Camera rig (`camera.ts` rewrite)

The movement math (WASD relative to camera angle, orbit interpolation, terrain following) is ~80% engine-agnostic. The changes are:

| Three.js | Babylon.js |
|----------|-----------|
| `PerspectiveCamera` | Use a bare `BABYLON.FreeCamera` or `BABYLON.UniversalCamera` positioned manually |
| `camera.position.set(x, y, z)` | `camera.position.set(x, y, z)` or `camera.position = new Vector3(x, y, z)` |
| `camera.lookAt(target)` | `camera.setTarget(target)` — sets direction, not persistent tracking. Must call every frame (same as current `lookAt` pattern). |
| `camera.updateProjectionMatrix()` | Not needed — Babylon updates automatically. `engine.resize()` handles aspect ratio too. |
| `smoothPos.lerp(desired, t)` (mutating) | `Vector3.LerpToRef(smoothPos, desired, t, smoothPos)` — writes to existing vector, avoids GC pressure in render loop |

> **SME correction (P2):** Use `Vector3.LerpToRef` (writes to pre-allocated vector) instead of `Vector3.Lerp` (allocates new vector each call). In a 60fps render loop, `Lerp` creates 60 garbage vectors/second which causes GC stutter on mobile.

> **SME correction:** `camera.setTarget()` on `FreeCamera` sets direction, not a persistent orbit target. Since our current code calls `lookAt` every frame, this is functionally equivalent — but the semantic difference is worth understanding.

**Approach:** Keep the `CameraRig` interface shape. Replace Three.js types with Babylon types. The `update(delta, getHeight)` function body transfers nearly verbatim.

**Important difference:** Babylon cameras have built-in input handling. We'll **disable** Babylon's default inputs (`camera.inputs.clear()`) and keep our custom WASD + orbit rig, since it's already working and tuned.

**Resize:** `engine.resize()` handles canvas size AND camera aspect ratio automatically. The `handleResize` function simplifies to just calling `engine.resize()`.

**Vector3 API differences:**
- `position.distanceTo(other)` → `Vector3.Distance(a, b)` (static method)
- `position.copy(other)` → `position.copyFrom(other)`
- `position.addScaledVector(dir, s)` → `position.addInPlace(dir.scale(s))` (caution: mutates `dir`) — use a pre-allocated temp vector

### Step 3: Creature rendering (`creatures.ts` rewrite)

Two distinct concerns:

**A. Mesh building (~250 lines, full rewrite):**

> **SME correction (P0):** `CellMaterial` does not exist in Babylon.js. The toon/cel-shading approach requires either a custom `ShaderMaterial` with quantized diffuse bands (~20 lines of GLSL) or a `NodeMaterial` built in the Node Material Editor. Custom ShaderMaterial is simpler and sufficient:
> ```glsl
> float NdotL = max(dot(normal, lightDir), 0.0);
> float toon = floor(NdotL * 3.0) / 3.0;
> gl_FragColor = vec4(baseColor * (0.3 + 0.7 * toon), 1.0);
> ```

> **SME correction (P1):** `mesh.dispose()` does NOT automatically dispose geometry and material. Must call `mesh.dispose(false, true)` or explicitly dispose materials. Without this, GPU memory leaks with every creature spawn/despawn cycle.

> **SME correction (P2):** Write an `hslToColor3(h, s, l): Color3` utility function. `Color3.FromHSV` does not accept HSL values — HSV and HSL are different colour spaces. Passing lightness where value goes will produce wrong colours for every creature.

| Three.js | Babylon.js |
|----------|-----------|
| `MeshToonMaterial` | Custom `ShaderMaterial` with quantized diffuse (see above) |
| `CylinderGeometry` | `MeshBuilder.CreateCylinder()` |
| `SphereGeometry` | `MeshBuilder.CreateSphere()` |
| `Group` (container) | `TransformNode` (parent container) |
| `Color.setHSL(h, s, l)` | `hslToColor3(h, s, l)` — custom utility (HSL ≠ HSV) |
| `mesh.castShadow = true` | `shadowGenerator.addShadowCaster(mesh)` — and `removeShadowCaster(mesh)` before dispose |
| `geometry.dispose()` / `material.dispose()` | `mesh.dispose(false, true)` for proper cleanup |
| `mesh.visible = false` | `mesh.setEnabled(false)` — also skips picking and shadow generation |
| `group.traverse(fn)` | `transformNode.getChildMeshes()` — returns flat array, cleaner |
| `mesh.rotation.y = angle` | `mesh.rotation.y = angle` — same API (Euler Vector3) |

**B. Behaviour AI (~390 lines, zero rewrite):**
The state machine (idle → walking → fleeing → chasing → catching → hidden → respawn), wander logic, chase/flee detection, terrain height following — all pure math. Only the final mesh position/rotation updates change from `mesh.position.set(x, y, z)` to `mesh.position = new Vector3(x, y, z)` (or `mesh.position.x = x` etc.).

### Step 4: Interaction system (`interaction.ts` rewrite)

| Three.js | Babylon.js |
|----------|-----------|
| `Raycaster` + `setFromCamera()` | `scene.pick(x, y)` — Babylon has built-in scene picking |
| `raycaster.intersectObjects()` | `scene.pick()` returns `PickingInfo` with hit mesh, point, distance |
| `RingGeometry` (selection ring) | `MeshBuilder.CreateTorus({diameter, thickness, tessellation})` with small thickness |
| `CircleGeometry` (brush preview) | `MeshBuilder.CreateDisc()` — note: created in XZ plane by default (no rotation needed) |
| `MeshBasicMaterial` | `StandardMaterial` with `disableLighting = true` |
| `material.opacity` | `material.alpha` |
| `material.depthWrite = false` | `material.disableDepthWrite = true` |
| `mesh.renderOrder` | `mesh.renderingGroupId` (0–3, more coarse-grained but sufficient) |

**Key simplification:** Babylon's `scene.pick()` is simpler than Three.js raycasting. No need to manually construct a `Raycaster` and set its origin/direction from NDC coordinates — Babylon does this internally from screen coordinates.

> **SME suggestion:** Use `mesh.metadata = { speciesId: "..." }` on creature meshes instead of walking parent chains to find which creature was clicked. Then `pickResult.pickedMesh?.metadata?.speciesId` gives the answer directly. Cleaner and faster than the Three.js parent-traversal approach.

> **SME suggestion:** Use a predicate function with `scene.pick()` to only test relevant meshes:
> ```typescript
> scene.pick(x, y, (mesh) => mesh.metadata?.pickable === true);
> ```
> Set `isPickable = false` on non-interactive meshes (sky dome, water, selection ring, brush preview) to avoid unnecessary raycast tests with 500+ meshes.

The brush logic (`collectBrushBiomes()`, sculpt action dispatch, click vs drag detection) is pure math and transfers unchanged.

### Step 5: React integration (`World3D.tsx` update)

The component structure stays the same. Changes:

1. Import Babylon module functions instead of Three.js ones
2. `SceneContext` type uses `engine: BABYLON.Engine` instead of `renderer: THREE.WebGLRenderer`
3. Render loop: use `scene.registerBeforeRender()` for update callbacks + `engine.runRenderLoop(() => scene.render())` for rendering (see below)
4. Resize: `engine.resize()` instead of `renderer.setSize()` — also handles camera aspect automatically
5. Disposal: `engine.dispose()` — disposes scene too, so don't call `scene.dispose()` separately first

> **SME correction:** Do NOT use a manual `requestAnimationFrame` loop alongside `engine.runRenderLoop`. This creates double-render or timing mismatches. Instead, register pre-render updates via `scene.registerBeforeRender()`:
> ```typescript
> scene.registerBeforeRender(() => {
>   const delta = engine.getDeltaTime() / 1000;
>   cameraRig.update(delta, getHeight);
>   creatures.update(delta, performance.now() / 1000);
>   interaction.update(camera);
> });
> engine.runRenderLoop(() => scene.render());
> ```
> Use `engine.getDeltaTime()` (in ms) rather than computing delta manually — it's synchronised with the render loop and handles tab-backgrounding edge cases.

> **SME note:** Babylon requires the canvas to have explicit `width`/`height` attributes (not just CSS sizing) or you get a 0x0 render buffer. Either set attributes on mount or call `engine.resize()` after the first `ResizeObserver` callback.

> **SME note:** Dispose in reverse creation order: interaction → creatures → camera → scene → engine. `engine.dispose()` disposes the scene, so calling `scene.dispose()` before `engine.dispose()` will cause errors.

The effect structure (init on mount, sync terrain on biome change, sync creatures on species change) is identical. The animation loop is replaced by `registerBeforeRender` + `runRenderLoop`.

---

## 5. Risk Assessment

| # | Risk | P | Likelihood | Impact | Mitigation |
|---|------|:-:|:---:|:---:|-------------|
| 1 | Index winding order (CW vs CCW) makes all faces invisible | P0 | **High** | High | Set `scene.useRightHandedSystem = true` as first line of scene creation. Three.js uses CCW; Babylon default is CW. This single setting fixes winding, coordinates, and camera math. **Most common bug in Three→Babylon migrations.** |
| 2 | Vertex colours need RGBA not RGB — terrain renders garbage | P0 | **Certain** | High | Write `rgbToRgba()` shim in scene.ts. Terrain.ts stays pure (outputs RGB). Shim expands to RGBA before `VertexData` application. |
| 3 | Toon shading — `CellMaterial` does not exist | P0 | **Certain** | Medium | Write custom `ShaderMaterial` with quantized diffuse bands (~20 lines GLSL). Aesthetic target is "cute and warm", not pixel-perfect Three.js match. |
| 4 | GPU memory leak from improper mesh disposal | P1 | High | Medium | Use `mesh.dispose(false, true)` to dispose material+textures. Call `shadowGenerator.removeShadowCaster(mesh)` before disposing creature meshes. |
| 5 | HSL→HSV colour conversion — all creature colours shifted | P1 | **Certain** | Medium | Write `hslToColor3()` utility. HSL ≠ HSV — cannot just rename parameters. |
| 6 | Render loop double-fire (rAF + runRenderLoop) | P1 | Medium | Medium | Use `scene.registerBeforeRender()` + `engine.runRenderLoop()`. Do NOT also use `requestAnimationFrame`. Use `engine.getDeltaTime()` for delta. |
| 7 | Mobile performance regression from high DPI | P2 | Medium | Medium | Cap pixel ratio: `engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio, 2))`. Babylon's `adaptToDeviceRatio` has no cap and will tank 3x/4x mobile devices. |
| 8 | GC stutter from Vector3 allocation in render loop | P2 | Medium | Low-Med | Use `Vector3.LerpToRef` (writes to existing vector) instead of `Vector3.Lerp` (allocates new vector). Pre-allocate temp vectors for camera math. |
| 9 | Shadow generator holds references to disposed creature meshes | P2 | Medium | Low | Call `shadowGenerator.removeShadowCaster(mesh)` before `mesh.dispose()` in creature cleanup. |
| 10 | Many small meshes — high draw call count on mobile | P2 | Medium | Medium | Consider `Mesh.MergeMeshes()` per creature (merge body parts into one mesh). Or use instancing for same-species creatures sharing geometry. Could reduce ~512 draw calls to ~30. |
| 11 | Bundle size larger than expected | P2 | Low | Medium | Tree-shake imports. Monitor build output. Target ~350KB gzip. If `@babylonjs/materials` not needed (toon via custom shader), skip it entirely. |
| 12 | `scene.pick()` slow with 500+ meshes | P2 | Low | Low | Set `isPickable = false` on non-interactive meshes. Use predicate function in `scene.pick()`. |

---

## 6. Testing Strategy

### Unchanged tests (pass through migration)
- `terrain.test.ts` — 6 tests, pure math, zero Three.js dependencies
- All `src/engine/` tests — simulation is untouched

### New tests needed
- **Scene lifecycle:** Babylon Engine creates and disposes without errors (canvas mock)
- **Terrain mesh construction:** `VertexData` receives correct positions/colours/indices from `TerrainData`
- **Creature mesh construction:** `buildCreatureMesh()` returns a valid `TransformNode` with child meshes for each trophic level
- **Coordinate system:** verify world positions match between terrain queries and Babylon mesh placement (catches left-hand/right-hand issues)

### Manual visual verification
- Terrain colours match biome types
- Creatures are visible, correctly sized, toon-shaded
- Camera WASD movement feels identical
- Click-to-select highlights correct creature
- Terrain sculpting brush preview and effect work
- Dashboard overlay renders correctly over canvas
- Mobile browser: load and navigate (performance baseline)

---

## 7. Implementation Order and Commit Strategy

> **SME correction (P1):** The original strategy (remove Three.js first) would fail pre-commit hooks on commit 1 since all existing code still imports Three.js. Revised to **parallel directory strategy**: build the Babylon implementation alongside the existing Three.js code, then swap.

**Parallel directory approach** — every commit compiles and passes pre-commit hooks:

| # | Commit | State after |
|---|--------|------------|
| 1 | Add `@babylonjs/core` + `@babylonjs/materials` deps (keep Three.js) | Build passes. Both engines available as deps. |
| 2 | Create `src/world3d-babylon/` with full Babylon implementation (scene, camera, creatures, interaction, World3D component). Copy `terrain.ts` + `terrain.test.ts` unchanged. | Both implementations exist. App still uses Three.js. Build passes. |
| 3 | Swap `World3D` import in App to use `world3d-babylon/`. Remove `three` + `@types/three` from deps. Delete `src/world3d/`. Rename `world3d-babylon/` → `world3d/`. | App runs on Babylon.js. Feature parity. All tests pass. |
| 4 | Visual polish — tune lighting, shadows, colours, toon shading, fog | Visual quality matches or exceeds Three.js |
| 5 | Update governance — resolve DDR-012, update feature registry, HANDOVER.md | Clean handover |

**Rollback path:** If Babylon has an unexpected showstopper during commit 2, the app still works on Three.js. Delete the `world3d-babylon/` directory and the Babylon deps. No damage done.

---

## 8. Estimated Effort

| Step | Estimate |
|------|----------|
| Scene + lighting + terrain mesh | ~200 lines |
| Camera rig | ~180 lines |
| Creature mesh building | ~250 lines |
| Creature behaviour AI (port, minimal changes) | ~50 lines of edits |
| Interaction / raycasting | ~250 lines |
| World3D.tsx integration | ~50 lines of edits |
| Visual polish + tuning | ~100 lines |
| Tests | ~80 lines |
| **Total new/modified** | **~1,160 lines** |

The current `src/world3d/` is ~1,968 lines. The migration replaces ~1,550 of those (keeping terrain.ts and terrain.test.ts). Net line count should be similar — Babylon's API is slightly more verbose in some areas (material setup) and more concise in others (raycasting).

**Session estimate:** 1 session for the migration. A second session if visual polish needs significant tuning.

---

## 9. Success Criteria

- [ ] `npm run build` passes (no Three.js imports remain)
- [ ] `npm test` passes (all existing tests, including terrain tests)
- [ ] `npx tsc --noEmit` passes
- [ ] Terrain renders with correct biome colours and elevation
- [ ] Sky dome, lighting, shadows, and fog present
- [ ] Creatures spawn, display genome-driven appearance, and exhibit behaviour AI
- [ ] WASD + orbit camera navigates the world
- [ ] Click-to-select creatures works
- [ ] Terrain sculpting tools work (raise/lower/wet/dry)
- [ ] Dashboard overlay renders and is interactive
- [ ] No Three.js packages in `package.json`
- [ ] No `three` imports anywhere in codebase
- [ ] Mobile browser loads and is navigable

---

## 10. What This Unlocks

With Babylon.js in place, Phase 3 features become straightforward:

- **Player character:** Babylon's `CharacterController` or physics-based character with `Havok` plugin — no custom collision/gravity code needed
- **First/third-person camera:** Babylon's `FollowCamera` or `ArcRotateCamera` attached to player mesh
- **Building system:** Babylon's mesh picking + physics collision for placement validation
- **Physics:** `@babylonjs/havok` plugin — drop-in, no custom integration
- **Scene inspector:** Press F12 equivalent for full scene debugging — transformative for solo development

Each of these would require weeks of custom infrastructure on Three.js. On Babylon.js, they're configuration + game logic.
