# BRF-012: 3D Polish + Terrain Sculpting

**Phase:** v0.2 "Naturalist" · 3D World View (Phase 2.5 — polish + first player intervention)
**Resolves:** DDR-009 (Explicit geographic features layer)

---

## 1. Objective

Polish the 3D world view with a proper sky, better lighting, and shadows. Add creature selection via click. Introduce terrain sculpting — the player's first strategic intervention beyond the temperature slider. The player can reshape elevation and moisture per biome, which changes biome types, carrying capacities, and the course of evolution.

### What BRF-012 Delivers

- **Sky dome** — gradient sky hemisphere replacing the flat dark background
- **PBR terrain shading** — MeshStandardMaterial with shadows from the directional light
- **Creature shadow casting** — creatures cast shadows onto terrain
- **Click-to-select creatures** — left-click a creature to open its species card
- **Terrain sculpting** — 4 brush tools (raise, lower, wet, dry) that modify biome elevation/moisture
- **Sculpt toolbar** — floating tool palette with keyboard shortcuts (Q, 1-4)
- **Camera rework** — right-click orbits, left-click reserved for tool actions

### What BRF-012 Does NOT Deliver

- Named geographic features (Option B of DDR-009 — deferred, could layer on top later)
- Adjustable brush radius (fixed at 1 biome cell)
- Undo/redo for sculpting (related to DDR-010 rollback, deferred to v0.3)
- Player character (Phase 3, triggers DDR-012)

### DDR-009 Resolution

Enhanced Option A: geography remains emergent from per-biome elevation/moisture, but the player now has direct sculpting tools. This gives the player meaningful world-shaping without the complexity of named `GeographicFeature` objects. Named features could be layered on top later as a narrative system.

---

## 2. Architecture Decisions

### Decision 1: Camera left-click / right-click split

Currently the camera orbits on both left and right mouse button drag. Both click-to-select and terrain sculpting need left-click. Solution:

- **Left-click (button 0):** Tool action — select creature or sculpt terrain
- **Right-click (button 2):** Camera orbit (unchanged behaviour)

Click vs drag distinguished by mouse movement threshold (< 5px = click).

### Decision 2: Interaction modes via active tool

A single interaction system handles both creature selection and terrain sculpting. The active tool determines what left-click does:

| Tool | Left-click | Left-drag | Right-drag |
|------|-----------|-----------|------------|
| Select (Q) | Raycast creatures → species card | No-op | Camera orbit |
| Raise (1) | Raise elevation +0.05 at brush | Continuous raise | Camera orbit |
| Lower (2) | Lower elevation -0.05 at brush | Continuous lower | Camera orbit |
| Wet (3) | Increase moisture +0.05 at brush | Continuous wet | Camera orbit |
| Dry (4) | Decrease moisture -0.05 at brush | Continuous dry | Camera orbit |

### Decision 3: Sculpt function in the engine layer

Terrain sculpting modifies WorldState.biomes (elevation/moisture) — this is a simulation-affecting action, not just cosmetic. The core logic belongs in `src/engine/sculpt.ts` as a pure function:

```typescript
interface SculptAction {
  biomeId: string;
  elevationDelta: number;
  moistureDelta: number;
}

function applySculpt(
  biomes: readonly Biome[],
  actions: readonly SculptAction[],
  temperature: number,
): Biome[]
```

**Why this works seamlessly:** The existing `tick()` function already calls `updateBiomeTypes(biomes, temperature)` which re-derives `biomeType` and `baseCarryingCapacity` from elevation + moisture + temperature. So `applySculpt` just:
1. Applies elevation/moisture deltas (clamped to [0, 1])
2. Calls `updateBiomeTypes()` to re-derive types and capacities
3. Returns the new biomes array

The simulation adapts automatically on the next tick. No engine contract changes needed.

**Sculpting while paused:** `applySculpt` itself calls `updateBiomeTypes()`, so biome types update immediately even without a tick running. Terrain mesh rebuilds via the existing React effect that watches `worldState.biomes`.

### Decision 4: Sky dome via custom shader, not Three.js Sky addon

The Three.js `Sky` addon uses the Preetham atmospheric scattering model — a realistic sun-position-based sky with many parameters. This is overkill for a stylised game.

Instead: an inverted `SphereGeometry` with a simple GLSL fragment shader that blends between a horizon colour and a zenith colour based on the y-component of the view direction. Cheap, small, full aesthetic control, no addon dependency.

### Decision 5: PBR + shadows for terrain depth

Upgrade terrain from `MeshLambertMaterial` to `MeshStandardMaterial`:
- **Roughness 0.85, metalness 0** — matte natural terrain
- **Shadow receiving** — terrain receives shadows from creatures
- **PCFSoftShadowMap** at 1024×1024 — soft-edged shadows, good performance

Creatures get `castShadow = true`. The directional light gets an orthographic shadow camera frustum covering the terrain (±80 units). Shadow bias -0.001 to prevent acne.

Water also upgrades to `MeshStandardMaterial` with low roughness (0.3) for subtle sheen.

### Decision 6: No WorldState shape change

Sculpting modifies existing `Biome.elevation` and `Biome.moisture` fields. No new fields, no new types on WorldState. **No save migration needed** (Lesson 1 does not apply).

---

## 3. Detailed Design

### 3.1 New module: `src/engine/sculpt.ts`

Pure function. Indexes actions by biome ID, accumulates multiple actions on the same biome, clamps elevation/moisture to [0, 1], calls `updateBiomeTypes()` to re-derive biome types and carrying capacities.

### 3.2 New module: `src/world3d/interaction.ts`

Central interaction coordinator. Manages:
- **Raycaster** for both creature meshes and terrain mesh
- **Click detection** (mousedown/mouseup with distance threshold to distinguish from drag)
- **Selection ring** — `RingGeometry` mesh beneath selected creature, follows it each frame, pulsing opacity
- **Brush preview** — `CircleGeometry` mesh projected onto terrain at cursor position, colour-coded by tool (green/red/blue/orange)
- **Sculpt throttle** — 80ms throttle during drag to avoid overwhelming React state updates

### 3.3 New component: `src/components/SculptToolbar.tsx`

Floating tool palette in bottom-left corner. Five buttons: Select, Raise, Lower, Wet, Dry. Active tool highlighted with tool-specific colour. Keyboard shortcuts shown in tooltips.

### 3.4 Callback chain: 3D view → simulation

```
World3D (interaction.ts)
  ↓ onSculpt(SculptAction[])
App.tsx
  ↓ sculptBiomes(SculptAction[])
useSimulation.ts
  ↓ setWorldState(prev => { ...prev, biomes: applySculpt(...) })
React re-render
  ↓ worldState.biomes changed
World3D useEffect
  ↓ generateTerrain() + updateTerrainMesh()
```

### 3.5 Scene changes (`src/world3d/scene.ts`)

- Sky dome added to scene (radius 400, BackSide rendering, no depth write)
- Fog colour changed from `0x1a1a2e` to `0x87a5c0` (matches sky horizon)
- Clear colour matches fog
- Renderer: `shadowMap.enabled = true`, `PCFSoftShadowMap`
- Directional light: `castShadow = true`, shadow camera frustum ±80

### 3.6 Camera changes (`src/world3d/camera.ts`)

Single change: `onMouseDown` only triggers orbit drag on `e.button === 2` (was `0 || 2`).

### 3.7 Creature changes (`src/world3d/creatures.ts`)

- `castShadow = true` on all creature child meshes
- New method `getSpeciesIdByMesh(hitObject)` — walks parent chain to find owning creature group, returns speciesId
- New method `getAllMeshGroups()` — returns all visible creature groups for raycasting

### 3.8 Terrain changes (`src/world3d/terrain.ts`)

New helper `worldXZToBiomeCoords(wx, wz, gridWidth, gridHeight)` — inverse of `biomeToWorldXZ`, converts world position to grid coordinates (rounded, clamped). Used by the brush to determine which biomes to modify.

### 3.9 World3D changes

New props: `activeTool`, `onSelectSpecies`, `onSculpt`. Creates and manages the interaction system alongside the existing camera and creature systems.

### 3.10 App.tsx changes

- Import `SculptToolbar`, `SculptTool` type
- New state: `activeTool` (default: 'select')
- Keyboard listener for tool shortcuts (Q, 1-4)
- Pass `activeTool`, `setSelectedSpeciesId`, `sculptBiomes` to World3D
- Render `SculptToolbar` in bottom-left

---

## 4. File Changes

| File | Change | Risk |
|------|--------|------|
| `src/engine/sculpt.ts` | **NEW** — Pure sculpt function | LOW — pure function, fully testable |
| `src/engine/sculpt.test.ts` | **NEW** — 12 unit tests | LOW |
| `src/engine/index.ts` | **MODIFIED** — export applySculpt + SculptAction | LOW |
| `src/world3d/interaction.ts` | **NEW** — Raycasting, selection, brush system | MEDIUM — new interaction layer |
| `src/world3d/scene.ts` | **MODIFIED** — Sky dome, shadows, PBR materials | MEDIUM — visual changes |
| `src/world3d/camera.ts` | **MODIFIED** — Right-click-only orbit | LOW — single condition change |
| `src/world3d/creatures.ts` | **MODIFIED** — Shadow casting, mesh lookup methods | LOW |
| `src/world3d/terrain.ts` | **MODIFIED** — worldXZToBiomeCoords helper | LOW |
| `src/world3d/terrain.test.ts` | **MODIFIED** — 3 new coordinate tests | LOW |
| `src/world3d/World3D.tsx` | **MODIFIED** — New props, interaction wiring | MEDIUM |
| `src/components/SculptToolbar.tsx` | **NEW** — Tool palette UI | LOW |
| `src/components/useSimulation.ts` | **MODIFIED** — sculptBiomes callback | LOW |
| `src/App.tsx` | **MODIFIED** — Tool state, keyboard shortcuts, wiring | MEDIUM |

### Explicitly Unchanged

| File | Reason |
|------|--------|
| `src/engine/types.ts` | No WorldState shape change — sculpting uses existing fields |
| `src/engine/tick.ts` | Already calls updateBiomeTypes — adapts automatically |
| `src/data/persistence.ts` | No migration needed |
| All other `src/components/*` | Dashboard components unaffected |

---

## 5. Acceptance Criteria

1. Sky shows a gradient from horizon to zenith, replacing the flat dark background.
2. Terrain has PBR shading with visible shadows cast by creatures.
3. Water has a subtle sheen from low-roughness material.
4. Fog blends smoothly into the sky at the horizon.
5. Left-clicking a creature opens its species card in the sidebar.
6. A selection ring pulses beneath the selected creature and follows it.
7. Clicking terrain (not a creature) in select mode clears selection.
8. Tool palette shows 5 tools in bottom-left corner.
9. Keyboard shortcuts Q/1/2/3/4 switch tools.
10. With Raise tool active, clicking terrain raises elevation and changes terrain visibly.
11. With Lower tool active, dragging over terrain lowers it — pushing below 0.15 turns biomes to ocean.
12. With Wet/Dry tools, moisture changes are visible as biome type transitions (grassland ↔ forest ↔ desert).
13. Sculpting effects persist across ticks — the simulation adapts to the new terrain.
14. Right-click orbit still works regardless of active tool.
15. Camera WASD movement unaffected.
16. `npm run build` passes.
17. All tests pass (103 total: 88 existing + 12 sculpt + 3 terrain coordinate).

---

## 6. Test Strategy

### Engine tests (`src/engine/sculpt.test.ts`)

| # | Test | What it verifies |
|---|------|-----------------|
| T1 | Raises elevation | Delta applied correctly |
| T2 | Lowers elevation | Negative delta works |
| T3 | Clamps elevation to [0, 1] | No out-of-range values |
| T4 | Ocean biome when elevation < 0.15 | biomeType re-derivation |
| T5 | Mountain biome when elevation > 0.8 | biomeType re-derivation |
| T6 | Forest biome when moisture > 0.6 | Moisture → biome mapping |
| T7 | Desert biome when moisture < 0.3 | Moisture → biome mapping |
| T8 | Empty actions return unchanged biomes | No-op correctness |
| T9 | Input biomes not mutated | Immutability guarantee |
| T10 | Biome count preserved | Conservation invariant |
| T11 | Multiple actions on same biome accumulate | Delta merging |
| T12 | Unaffected biomes unchanged | Isolation |

### Terrain tests (`src/world3d/terrain.test.ts` — extended)

| # | Test | What it verifies |
|---|------|-----------------|
| T13 | worldXZToBiomeCoords round-trips with biomeToWorldXZ | Coordinate conversion consistency |
| T14 | Out-of-bounds positions clamped to grid edges | Edge case handling |
| T15 | World origin maps to center of grid | Sanity check |

### Manual verification

- Orbit with right-click, select creatures with left-click
- Switch tools with keyboard shortcuts (Q, 1-4)
- Sculpt terrain — watch mountains rise, oceans form, forests spread
- Verify creatures adjust to new terrain heights
- Verify species populations shift as habitable biomes change
- Shadows visible on terrain from creatures
- Sky gradient visible, fog blends at horizon
- Sculpt while paused — terrain updates immediately

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Shadow map too coarse for large terrain | LOW | 1024×1024 covering ±80 units = ~6.4 units/texel. Acceptable for stylised art. Can increase to 2048 if needed. |
| Sculpt drag creates too many React state updates | LOW | 80ms throttle on sculpt callback. generateTerrain() is ~1ms for 96-biome grid. |
| Camera orbit conflicts with sculpt drag | LOW | Strict button separation: left = tool, right = orbit. No ambiguity. |
| Player sculpts all biomes to ocean, killing simulation | MEDIUM | This is a valid gameplay choice. The simulation handles zero habitable biomes gracefully (all species go extinct). Player can sculpt back. |
| Terrain mesh rebuild during sculpt causes visual stutter | LOW | Full geometry rebuild is fast (~1ms). React batches state updates within the same frame. |

---

*Radiate · BRF-012 · Pre-Implementation Brief · v0.2 "Naturalist" · March 2026*
